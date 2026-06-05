/**
 * WTC worker - cron-style scheduler. With DATABASE_URL set it runs direct DB repository jobs.
 * Without DATABASE_URL it runs the in-memory demo loop for local development only.
 *
 * The durable DB tick is exported so verification can run the exact same worker path once without
 * starting the long-running interval.
 */
import { createMemoryTvStore, TvAccessService } from '@wtc/tradingview-access';
import { createConsoleAuditWriter } from '@wtc/audit';
import { getBotAdapter } from '@wtc/bot-adapters';
import type { Db } from '@wtc/db';
import { pathToFileURL } from 'node:url';
import { reconcileEntitlements, sweepTradingViewAccess, snapshotTortilaJournal, type BotSnapshotStatus } from './jobs.ts';
import { reconcileExpiredLmsObjectMaterials, reconcilePendingLmsObjectCleanupTasks } from './lms-object-cleanup.ts';
import { snapshotLegacyBotPostgres } from './legacy-live.ts';

const TICK_MS = 60_000;

type WorkerEnv = Record<string, string | undefined>;

export interface DbWorkerTickResult {
  entitlementsChanged: number;
  tvExpiringSoon: number;
  tvExpired: number;
  tvTasksQueued: number;
  tvTasksRepaired: number;
  handoffJtisPurged: number;
  lmsMaterialsPurged: number;
  lmsObjectMaterialsScanned: number;
  lmsObjectDeleteAttempted: number;
  lmsObjectDeleteConfirmed: number;
  lmsObjectMetadataOnlyPurged: number;
  lmsObjectMaterialsPurged: number;
  lmsObjectCleanupFailed: number;
  lmsPendingObjectCleanupScanned: number;
  lmsPendingObjectDeleteAttempted: number;
  lmsPendingObjectDeleteConfirmed: number;
  lmsPendingObjectCleanupCompleted: number;
  lmsPendingObjectCleanupFailed: number;
  lmsPendingObjectCleanupDeadLettered: number;
  workerHealthStatus: 'ok' | 'not_configured' | 'misconfigured' | 'error';
  botContinuityStatus: 'ok' | 'attention' | 'error';
  tortilaSnapshot: BotSnapshotStatus;
  tortilaLastError: string | null;
  legacySnapshot: BotSnapshotStatus;
  legacyLastError: string | null;
}

/** Read BOT_ADAPTER_MODE from env. Fails closed to 'mock' for any unknown/missing value. */
function getBotAdapterMode(env: WorkerEnv = process.env): 'mock' | 'read-only' | 'audited' {
  const m = env.BOT_ADAPTER_MODE;
  if (m === 'read-only' || m === 'audited') return m;
  return 'mock';
}

function flagEnabled(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

function redactedOperationalMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/(password|secret|token|key)=([^&\s]+)/gi, '$1=[REDACTED]')
    .slice(0, 200);
}

type WorkerWarnLogger = Pick<Console, 'warn'>;

export interface SerializedDbWorkerTickState {
  inFlight: boolean;
  startedAtMs: number | null;
  skippedWhileInFlight: number;
  lastSkipAtMs: number | null;
}

export type SerializedDbWorkerTickOutcome<T> =
  | {
      status: 'ran';
      result: T;
      startedAtMs: number;
      finishedAtMs: number;
      durationMs: number;
    }
  | {
      status: 'skipped_in_flight';
      startedAtMs: number | null;
      skippedAtMs: number;
      ageMs: number;
      skippedWhileInFlight: number;
    };

export function createSerializedDbWorkerTickRunner<T>(input: {
  runTick: () => Promise<T>;
  now?: () => number;
  logger?: WorkerWarnLogger;
}): {
  run: () => Promise<SerializedDbWorkerTickOutcome<T>>;
  getState: () => SerializedDbWorkerTickState;
} {
  const now = input.now ?? Date.now;
  const logger = input.logger ?? console;
  let inFlight = false;
  let startedAtMs: number | null = null;
  let skippedWhileInFlight = 0;
  let lastSkipAtMs: number | null = null;

  return {
    async run(): Promise<SerializedDbWorkerTickOutcome<T>> {
      if (inFlight) {
        const skippedAtMs = now();
        const ageMs = startedAtMs === null ? 0 : Math.max(0, skippedAtMs - startedAtMs);
        skippedWhileInFlight += 1;
        lastSkipAtMs = skippedAtMs;
        logger.warn(
          `[worker:db] tick skipped: previous db worker tick still in flight; age_ms=${ageMs}; skipped_while_in_flight=${skippedWhileInFlight}`,
        );
        return {
          status: 'skipped_in_flight',
          startedAtMs,
          skippedAtMs,
          ageMs,
          skippedWhileInFlight,
        };
      }

      inFlight = true;
      startedAtMs = now();
      try {
        const result = await input.runTick();
        const finishedAtMs = now();
        return {
          status: 'ran',
          result,
          startedAtMs,
          finishedAtMs,
          durationMs: Math.max(0, finishedAtMs - startedAtMs),
        };
      } finally {
        inFlight = false;
        startedAtMs = null;
        skippedWhileInFlight = 0;
      }
    },
    getState(): SerializedDbWorkerTickState {
      return { inFlight, startedAtMs, skippedWhileInFlight, lastSkipAtMs };
    },
  };
}

export function workerSafetyState(env: WorkerEnv = process.env): {
  liveControlDisabled: boolean;
  tvAutomationDisabled: boolean;
  status: 'ok' | 'misconfigured';
} {
  const liveControlDisabled = !flagEnabled(env.FEATURE_LIVE_BOT_CONTROL);
  const tvAutomationDisabled = !flagEnabled(env.FEATURE_TV_AUTOMATION);
  return {
    liveControlDisabled,
    tvAutomationDisabled,
    status: liveControlDisabled && tvAutomationDisabled ? 'ok' : 'misconfigured',
  };
}

export function workerRequiresDatabase(env: WorkerEnv = process.env): boolean {
  return env.NODE_ENV === 'production' || env.APP_ENV === 'staging' || env.APP_ENV === 'production';
}

type BotContinuityOutcome = { snapshot: BotSnapshotStatus; readState?: string | null; healthStatus?: string | null };

function botSnapshotNeedsWorkerError(input: {
  snapshot: BotSnapshotStatus;
  readState?: string | null;
  healthStatus?: string | null;
}): boolean {
  if (input.snapshot === 'error') return true;
  if (input.healthStatus === 'error') return true;
  return input.readState === 'unreachable' || input.readState === 'malformed';
}

export function finalWorkerHealthStatus(
  baseStatus: DbWorkerTickResult['workerHealthStatus'],
  outcomes: BotContinuityOutcome[],
): DbWorkerTickResult['workerHealthStatus'] {
  if (baseStatus === 'error') return 'error';
  if (outcomes.some(botSnapshotNeedsWorkerError)) return 'error';
  if (baseStatus === 'misconfigured') return 'misconfigured';
  return outcomes.every((outcome) => outcome.snapshot === 'ok' && outcome.readState === 'ok')
    ? 'ok'
    : 'not_configured';
}

export function botContinuityStatus(outcomes: BotContinuityOutcome[]): 'ok' | 'attention' | 'error' {
  if (outcomes.some(botSnapshotNeedsWorkerError)) return 'error';
  return outcomes.every((outcome) => outcome.snapshot === 'ok' && outcome.readState === 'ok') ? 'ok' : 'attention';
}

export async function runDbWorkerTick(db: Db, now = Date.now(), env: WorkerEnv = process.env): Promise<DbWorkerTickResult> {
  const {
    reconcileAllEntitlements,
    markExpiringSoon,
    sweepTvExpiry,
    repairMissingTvRevokeTasks,
    purgeExpiredHandoffJtis,
    purgeExpiredLmsMaterialFiles,
    recordHealthCheck,
    ensureBotInstance,
  } = await import('@wtc/db');
  const botAdapterMode = getBotAdapterMode(env);
  const safety = workerSafetyState(env);

  let ent: { changed: number };
  let expiring: { marked: number };
  let tv: { expired: number; tasksQueued: number };
  let tvRepair: { repaired: number };
  let jti: { purged: number };
  let lmsMaterials: { purged: number };
  let lmsObjectMaterials: { scanned: number; objectDeleteAttempted: number; objectDeleteConfirmed: number; metadataOnlyPurged: number; purged: number; failed: number };
  let lmsPendingObjectCleanup: { scanned: number; objectDeleteAttempted: number; objectDeleteConfirmed: number; completed: number; failed: number; deadLettered: number };
  try {
    ent = await reconcileAllEntitlements(db, now);
    // markExpiringSoon must run before sweepTvExpiry so the state progression is granted -> expiring_soon -> revoked.
    expiring = await markExpiringSoon(db, now);
    tv = await sweepTvExpiry(db, now);
    tvRepair = await repairMissingTvRevokeTasks(db, now);
    jti = await purgeExpiredHandoffJtis(db, now);
    lmsMaterials = await purgeExpiredLmsMaterialFiles(db, now);
    lmsObjectMaterials = await reconcileExpiredLmsObjectMaterials(db, now, env);
    lmsPendingObjectCleanup = await reconcilePendingLmsObjectCleanupTasks(db, now, env);
  } catch (err) {
    const error = redactedOperationalMessage(err);
    await recordHealthCheck(db, 'worker', 'error', {
      error,
      adapterMode: botAdapterMode,
      liveControlDisabled: safety.liveControlDisabled,
      tvAutomationDisabled: safety.tvAutomationDisabled,
    });
    throw err;
  }
  const workerCoreStatus = lmsObjectMaterials.failed > 0 || lmsPendingObjectCleanup.failed > 0 || lmsPendingObjectCleanup.deadLettered > 0 ? 'error' : safety.status;
  const workerCoreDetail = {
    entitlementsChanged: ent.changed,
    tvExpiringSoon: expiring.marked,
    tvExpired: tv.expired,
    tvTasksQueued: tv.tasksQueued,
    tvTasksRepaired: tvRepair.repaired,
    handoffJtisPurged: jti.purged,
    lmsMaterialsPurged: lmsMaterials.purged,
    lmsObjectMaterialsScanned: lmsObjectMaterials.scanned,
    lmsObjectDeleteAttempted: lmsObjectMaterials.objectDeleteAttempted,
    lmsObjectDeleteConfirmed: lmsObjectMaterials.objectDeleteConfirmed,
    lmsObjectMetadataOnlyPurged: lmsObjectMaterials.metadataOnlyPurged,
    lmsObjectMaterialsPurged: lmsObjectMaterials.purged,
    lmsObjectCleanupFailed: lmsObjectMaterials.failed,
    lmsPendingObjectCleanupScanned: lmsPendingObjectCleanup.scanned,
    lmsPendingObjectDeleteAttempted: lmsPendingObjectCleanup.objectDeleteAttempted,
    lmsPendingObjectDeleteConfirmed: lmsPendingObjectCleanup.objectDeleteConfirmed,
    lmsPendingObjectCleanupCompleted: lmsPendingObjectCleanup.completed,
    lmsPendingObjectCleanupFailed: lmsPendingObjectCleanup.failed,
    lmsPendingObjectCleanupDeadLettered: lmsPendingObjectCleanup.deadLettered,
    adapterMode: botAdapterMode,
    liveControlDisabled: safety.liveControlDisabled,
    tvAutomationDisabled: safety.tvAutomationDisabled,
  };

  const tortilaBaseUrl = env.TORTILA_JOURNAL_URL ?? env.TORTILA_JOURNAL_BASE_URL;
  const botInstanceId = env.SYSTEM_BOT_INSTANCE_ID ?? null;
  const systemBotOwnerId = env.SYSTEM_BOT_OWNER_ID ?? null;
  let tortilaSnapshot: DbWorkerTickResult['tortilaSnapshot'] = 'skipped';
  let tortilaLastError: string | null = null;
  let tortilaHealthStatus: string | null = null;
  let tortilaReadState: string | null = null;
  let tortilaReadStateDetail: string | null = null;
  let tortilaMetricsAvailable = false;
  let tortilaPositionsSnapshotted = 0;
  let tortilaTradesSeen = 0;
  let tortilaTradesImported = 0;
  let legacySnapshot: DbWorkerTickResult['legacySnapshot'] = 'skipped';
  let legacyLastError: string | null = null;
  let legacyHealthStatus: string | null = null;
  let legacyReadState: string | null = null;
  let legacyAccountsSeen = 0;
  let legacySettingsSeen = 0;
  let legacyPositionsSeen = 0;
  let legacyProviderAccountsScoped = 0;

  if (!botInstanceId && !systemBotOwnerId) {
    tortilaReadState = 'not_configured';
    tortilaReadStateDetail = 'set SYSTEM_BOT_INSTANCE_ID or SYSTEM_BOT_OWNER_ID to enable snapshots';
    tortilaHealthStatus = 'not_configured';
    await recordHealthCheck(db, 'tortila-journal', 'not_configured', {
      readState: tortilaReadState,
      readStateDetail: tortilaReadStateDetail,
      adapterMode: botAdapterMode,
    });
    console.warn('[worker:tortila-snapshot] skipped: SYSTEM_BOT_INSTANCE_ID or SYSTEM_BOT_OWNER_ID not set');
  } else if (botAdapterMode !== 'mock' && !tortilaBaseUrl) {
    tortilaReadState = 'not_configured';
    tortilaReadStateDetail = 'set TORTILA_JOURNAL_URL or TORTILA_JOURNAL_BASE_URL for read-only snapshots';
    tortilaHealthStatus = 'not_configured';
    await recordHealthCheck(db, 'tortila-journal', 'not_configured', {
      readState: tortilaReadState,
      readStateDetail: tortilaReadStateDetail,
      adapterMode: botAdapterMode,
    });
    console.warn('[worker:tortila-snapshot] skipped: TORTILA_JOURNAL_URL or TORTILA_JOURNAL_BASE_URL not set for read-only mode');
  } else {
    try {
      const resolvedInstanceId = botInstanceId ?? (await ensureBotInstance(db, {
        userId: systemBotOwnerId!,
        productCode: 'tortila_bot',
      })).id;

      const adapter = getBotAdapter('tortila_bot', {
        mode: botAdapterMode,
        tortilaBaseUrl,
        tortilaReadToken: env.JOURNAL_READ_TOKEN,
      });

      const snap = await snapshotTortilaJournal(db, adapter, resolvedInstanceId, now);
      tortilaSnapshot = snap.snapshotStatus;
      tortilaLastError = snap.lastError ? redactedOperationalMessage(snap.lastError) : null;
      tortilaHealthStatus = snap.healthStatus;
      tortilaReadState = snap.readState;
      tortilaReadStateDetail = snap.readStateDetail;
      tortilaMetricsAvailable = snap.metricsAvailable;
      tortilaPositionsSnapshotted = snap.positionsSnapshotted;
      tortilaTradesSeen = snap.tradesSeen;
      tortilaTradesImported = snap.tradesImported;
      if (snap.snapshotStatus === 'ok') {
        console.log(`[worker:tortila-snapshot] ok (mode=${botAdapterMode}, sourceAdapter=${adapter.mode === 'real' ? 'tortila' : 'tortila-mock'})`);
      } else if (snap.snapshotStatus === 'skipped') {
        console.warn(`[worker:tortila-snapshot] skipped: ${snap.readStateDetail ?? 'runtime not configured'}`);
      } else {
        console.warn(`[worker:tortila-snapshot] error: ${tortilaLastError ?? 'unknown'}`);
      }
    } catch (err) {
      tortilaSnapshot = 'error';
      tortilaHealthStatus = 'error';
      tortilaLastError = redactedOperationalMessage(err);
      console.error(`[worker:tortila-snapshot] unhandled error (tick continues): ${tortilaLastError}`);
    }
  }

  try {
    const legacy = await snapshotLegacyBotPostgres(db, now, env);
    legacySnapshot = legacy.status;
    legacyLastError = legacy.lastError ? redactedOperationalMessage(legacy.lastError) : null;
    legacyHealthStatus = legacy.healthStatus;
    legacyReadState = legacy.readState;
    legacyAccountsSeen = legacy.accountsSeen;
    legacySettingsSeen = legacy.settingsSeen;
    legacyPositionsSeen = legacy.positionsSeen;
    legacyProviderAccountsScoped = legacy.providerAccountsScoped;
    if (legacy.status === 'ok') {
      console.log(
        `[worker:legacy-snapshot] ok (sourceAdapter=legacy-db, accounts=${legacy.accountsSeen}, settings=${legacy.settingsSeen}, positions=${legacy.positionsSeen})`,
      );
    } else if (legacy.status === 'error') {
      console.warn(`[worker:legacy-snapshot] error: ${legacy.lastError ?? 'unknown'}`);
    } else {
      console.warn('[worker:legacy-snapshot] skipped: LEGACY_LIVE_READS_ENABLED/LEGACY_DATABASE_URL/system owner not configured');
    }
  } catch (err) {
    legacySnapshot = 'error';
    legacyHealthStatus = 'error';
    legacyLastError = redactedOperationalMessage(err);
    console.error(`[worker:legacy-snapshot] unhandled error (tick continues): ${legacyLastError}`);
  }

  const botOutcomes = [
    { snapshot: tortilaSnapshot, readState: tortilaReadState, healthStatus: tortilaHealthStatus },
    { snapshot: legacySnapshot, readState: legacyReadState, healthStatus: legacyHealthStatus },
  ];
  const workerHealthStatus = finalWorkerHealthStatus(workerCoreStatus, botOutcomes);
  const continuityStatus = botContinuityStatus(botOutcomes);
  await recordHealthCheck(db, 'worker', workerHealthStatus, {
    ...workerCoreDetail,
    coreWorkerStatus: workerCoreStatus,
    botContinuityStatus: continuityStatus,
    tortilaSnapshot,
    tortilaHealthStatus,
    tortilaReadState,
    tortilaReadStateDetail,
    tortilaMetricsAvailable,
    tortilaPositionsSnapshotted,
    tortilaTradesSeen,
    tortilaTradesImported,
    tortilaLastError,
    legacySnapshot,
    legacyHealthStatus,
    legacyReadState,
    legacyAccountsSeen,
    legacySettingsSeen,
    legacyPositionsSeen,
    legacyProviderAccountsScoped,
    legacyLastError,
  });
  console.log(
    `[worker:db] status ${workerHealthStatus}, bot_continuity ${continuityStatus}, tortila ${tortilaSnapshot}, legacy ${legacySnapshot}, entitlements changed ${ent.changed}, tv expiring_soon ${expiring.marked}, tv expired ${tv.expired}, revoke tasks ${tv.tasksQueued}, repaired revoke tasks ${tvRepair.repaired}, handoff jtis purged ${jti.purged}, lms materials purged ${lmsMaterials.purged}, lms object materials scanned ${lmsObjectMaterials.scanned}, lms object delete attempted ${lmsObjectMaterials.objectDeleteAttempted}, lms object delete confirmed ${lmsObjectMaterials.objectDeleteConfirmed}, lms object metadata-only purged ${lmsObjectMaterials.metadataOnlyPurged}, lms object materials purged ${lmsObjectMaterials.purged}, lms object cleanup failed ${lmsObjectMaterials.failed}, lms pending object cleanup scanned ${lmsPendingObjectCleanup.scanned}, lms pending object delete attempted ${lmsPendingObjectCleanup.objectDeleteAttempted}, lms pending object delete confirmed ${lmsPendingObjectCleanup.objectDeleteConfirmed}, lms pending object cleanup completed ${lmsPendingObjectCleanup.completed}, lms pending object cleanup failed ${lmsPendingObjectCleanup.failed}, lms pending object cleanup dead-lettered ${lmsPendingObjectCleanup.deadLettered}`,
  );

  return {
    entitlementsChanged: ent.changed,
    tvExpiringSoon: expiring.marked,
    tvExpired: tv.expired,
    tvTasksQueued: tv.tasksQueued,
    tvTasksRepaired: tvRepair.repaired,
    handoffJtisPurged: jti.purged,
    lmsMaterialsPurged: lmsMaterials.purged,
    lmsObjectMaterialsScanned: lmsObjectMaterials.scanned,
    lmsObjectDeleteAttempted: lmsObjectMaterials.objectDeleteAttempted,
    lmsObjectDeleteConfirmed: lmsObjectMaterials.objectDeleteConfirmed,
    lmsObjectMetadataOnlyPurged: lmsObjectMaterials.metadataOnlyPurged,
    lmsObjectMaterialsPurged: lmsObjectMaterials.purged,
    lmsObjectCleanupFailed: lmsObjectMaterials.failed,
    lmsPendingObjectCleanupScanned: lmsPendingObjectCleanup.scanned,
    lmsPendingObjectDeleteAttempted: lmsPendingObjectCleanup.objectDeleteAttempted,
    lmsPendingObjectDeleteConfirmed: lmsPendingObjectCleanup.objectDeleteConfirmed,
    lmsPendingObjectCleanupCompleted: lmsPendingObjectCleanup.completed,
    lmsPendingObjectCleanupFailed: lmsPendingObjectCleanup.failed,
    lmsPendingObjectCleanupDeadLettered: lmsPendingObjectCleanup.deadLettered,
    workerHealthStatus,
    botContinuityStatus: continuityStatus,
    tortilaSnapshot,
    tortilaLastError,
    legacySnapshot,
    legacyLastError,
  };
}

export async function dbTick(url: string, now = Date.now(), env: WorkerEnv = process.env): Promise<DbWorkerTickResult> {
  const { createDbClient } = await import('@wtc/db');
  const { client, db } = createDbClient(url);
  try {
    return await runDbWorkerTick(db, now, env);
  } finally {
    await client.end({ timeout: 5 });
  }
}

export async function memoryTick(): Promise<void> {
  const now = Date.now();
  const audit = createConsoleAuditWriter();
  const tv = new TvAccessService(createMemoryTvStore());
  const { changed } = await reconcileEntitlements([], now, audit);
  const swept = sweepTradingViewAccess(tv, now);
  console.log(`[worker:memory] entitlements changed ${changed.length}, tv ${JSON.stringify(swept)}`);
}

export async function tick(): Promise<DbWorkerTickResult | void> {
  const url = process.env.DATABASE_URL;
  if (url) return dbTick(url);
  if (workerRequiresDatabase(process.env)) {
    throw new Error('DATABASE_URL is required for worker in staging/production');
  }
  return memoryTick();
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  console.log('[worker] starting;', url ? 'DB jobs (DATABASE_URL set)' : 'in-memory demo loop (no DATABASE_URL)');
  if (!url) {
    if (workerRequiresDatabase(process.env)) {
      console.error('[worker] DATABASE_URL is required for worker in staging/production');
      process.exitCode = 2;
      return;
    }
    await memoryTick();
    setInterval(() => {
      void memoryTick();
    }, TICK_MS);
    return;
  }

  const { createDbClient } = await import('@wtc/db');
  const { db } = createDbClient(url);
  const dbTickRunner = createSerializedDbWorkerTickRunner({
    runTick: () => runDbWorkerTick(db),
  });
  try {
    await dbTickRunner.run();
  } catch (err) {
    console.error(`[worker:db] initial tick failed: ${redactedOperationalMessage(err)}`);
  }
  setInterval(() => {
    void dbTickRunner.run().catch((err) => {
      console.error(`[worker:db] tick failed: ${redactedOperationalMessage(err)}`);
    });
  }, TICK_MS);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
