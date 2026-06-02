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
import { reconcileEntitlements, sweepTradingViewAccess, snapshotTortilaJournal } from './jobs.ts';
import { reconcileExpiredLmsObjectMaterials, reconcilePendingLmsObjectCleanupTasks } from './lms-object-cleanup.ts';

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
  workerHealthStatus: 'ok' | 'misconfigured' | 'error';
  tortilaSnapshot: 'ok' | 'error' | 'skipped';
  tortilaLastError: string | null;
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
  const workerHealthStatus = lmsObjectMaterials.failed > 0 || lmsPendingObjectCleanup.failed > 0 || lmsPendingObjectCleanup.deadLettered > 0 ? 'error' : safety.status;
  await recordHealthCheck(db, 'worker', workerHealthStatus, {
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
  });
  console.log(`[worker:db] status ${workerHealthStatus}, entitlements changed ${ent.changed}, tv expiring_soon ${expiring.marked}, tv expired ${tv.expired}, revoke tasks ${tv.tasksQueued}, repaired revoke tasks ${tvRepair.repaired}, handoff jtis purged ${jti.purged}, lms materials purged ${lmsMaterials.purged}, lms object materials scanned ${lmsObjectMaterials.scanned}, lms object delete attempted ${lmsObjectMaterials.objectDeleteAttempted}, lms object delete confirmed ${lmsObjectMaterials.objectDeleteConfirmed}, lms object metadata-only purged ${lmsObjectMaterials.metadataOnlyPurged}, lms object materials purged ${lmsObjectMaterials.purged}, lms object cleanup failed ${lmsObjectMaterials.failed}, lms pending object cleanup scanned ${lmsPendingObjectCleanup.scanned}, lms pending object delete attempted ${lmsPendingObjectCleanup.objectDeleteAttempted}, lms pending object delete confirmed ${lmsPendingObjectCleanup.objectDeleteConfirmed}, lms pending object cleanup completed ${lmsPendingObjectCleanup.completed}, lms pending object cleanup failed ${lmsPendingObjectCleanup.failed}, lms pending object cleanup dead-lettered ${lmsPendingObjectCleanup.deadLettered}`);

  const tortilaBaseUrl = env.TORTILA_JOURNAL_URL ?? env.TORTILA_JOURNAL_BASE_URL;
  const botInstanceId = env.SYSTEM_BOT_INSTANCE_ID ?? null;
  const systemBotOwnerId = env.SYSTEM_BOT_OWNER_ID ?? null;
  let tortilaSnapshot: DbWorkerTickResult['tortilaSnapshot'] = 'skipped';
  let tortilaLastError: string | null = null;

  if (!botInstanceId && !systemBotOwnerId) {
    if (!tortilaBaseUrl && botAdapterMode === 'mock') {
      await recordHealthCheck(db, 'tortila-journal', 'not_configured', {
        readState: 'not_configured',
        readStateDetail: 'set SYSTEM_BOT_INSTANCE_ID or SYSTEM_BOT_OWNER_ID to enable snapshots',
        adapterMode: botAdapterMode,
      });
    }
    console.warn('[worker:tortila-snapshot] skipped: SYSTEM_BOT_INSTANCE_ID or SYSTEM_BOT_OWNER_ID not set');
  } else if (botAdapterMode !== 'mock' && !tortilaBaseUrl) {
    await recordHealthCheck(db, 'tortila-journal', 'not_configured', {
      readState: 'not_configured',
      readStateDetail: 'set TORTILA_JOURNAL_URL or TORTILA_JOURNAL_BASE_URL for read-only snapshots',
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
      tortilaSnapshot = snap.ok ? 'ok' : 'error';
      tortilaLastError = snap.lastError;
      if (snap.ok) {
        console.log(`[worker:tortila-snapshot] ok (mode=${botAdapterMode}, sourceAdapter=${adapter.mode === 'real' ? 'tortila' : 'tortila-mock'})`);
      } else {
        console.warn(`[worker:tortila-snapshot] error: ${snap.lastError ?? 'unknown'}`);
      }
    } catch (err) {
      tortilaSnapshot = 'error';
      tortilaLastError = err instanceof Error ? err.message : String(err);
      console.error(`[worker:tortila-snapshot] unhandled error (tick continues): ${tortilaLastError}`);
    }
  }

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
    tortilaSnapshot,
    tortilaLastError,
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
  try {
    await runDbWorkerTick(db);
  } catch (err) {
    console.error(`[worker:db] initial tick failed: ${redactedOperationalMessage(err)}`);
  }
  setInterval(() => {
    void runDbWorkerTick(db).catch((err) => {
      console.error(`[worker:db] tick failed: ${redactedOperationalMessage(err)}`);
    });
  }, TICK_MS);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
