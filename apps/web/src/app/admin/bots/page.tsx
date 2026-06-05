import Link from 'next/link';
import type { ReactNode } from 'react';
import { requireUser } from '@/lib/session';
import { assertAdmin } from '@wtc/auth';
import { Card, SectionHeader, StatusPill, MetricCard, EmptyState, RiskWarningBanner, buttonClasses, type Tone } from '@wtc/ui';
import { loadAdminBotHealth } from '@/features/admin/queries';
import { AdminBotRuntimeEvidencePanel, type AdminEvidenceMetric, type AdminEvidenceRow } from '@/features/admin/AdminBotRuntimeEvidencePanel';
import { TORTILA_PERSISTENT_WARNINGS } from '@wtc/bot-adapters';
import { fmtDateTime, fmtMoney, fmtNum } from '@/lib/format';
import type { AdminBotHealthResult, AdminBotWarningSummary, HealthCheckView, LegacyMappedUserAdminView } from '@/features/admin/types';

/**
 * Derive an honest journal read-state pill (PG8 — surfaces the PG2 readState taxonomy at the admin
 * ops layer) from the DB-backed health-check signals already in AdminBotHealthResult. No live probe:
 * an ops page reflects the LAST worker cycle, not a synchronous network call during render
 * (DESIGN_SYSTEM.md §14.6). Demo mode reads nothing, so it is labelled as such.
 */
function journalReadStatePill(snap: AdminBotHealthResult): { tone: Tone; label: string } {
  if (snap.mode === 'demo') return { tone: 'warn', label: 'journal: demo mode' };
  if (snap.tortilaJournalReadState === 'unreachable') return { tone: 'bad', label: 'journal: unreachable' };
  if (snap.tortilaJournalReadState === 'malformed') return { tone: 'bad', label: 'journal: malformed' };
  if (snap.tortilaJournalReadState === 'stale') return { tone: 'warn', label: 'journal: stale' };
  if (snap.tortilaJournalReadState === 'not_configured') return { tone: 'warn', label: 'journal: setup needed' };
  if (snap.tortilaJournalStatus === 'not_configured') return { tone: 'warn', label: 'journal: setup needed' };
  if (snap.tortilaJournalStatus === 'unreachable' || snap.tortilaJournalStatus === 'down') return { tone: 'bad', label: 'journal: unreachable' };
  if (snap.tortilaJournalStatus === 'malformed' || snap.tortilaJournalStatus === 'error') {
    return { tone: 'bad', label: 'journal: last check error' };
  }
  if (snap.tortilaJournalStatus === 'stale') return { tone: 'warn', label: 'journal: stale' };
  if (snap.tortilaLastError !== null) return { tone: 'bad', label: 'journal: last check error' };
  if (snap.tortilaLastOkAt !== null) return { tone: 'ok', label: 'journal: last check ok' };
  return { tone: 'neutral', label: 'journal: no checks (worker not run)' };
}

function healthCheckPill(row: HealthCheckView | null): { tone: Tone; label: string } {
  if (!row) return { tone: 'warn', label: 'health missing' };
  const readState = typeof row.detail?.readState === 'string' ? row.detail.readState : null;
  if (readState === 'unreachable') return { tone: 'bad', label: 'unreachable' };
  if (readState === 'malformed') return { tone: 'bad', label: 'malformed' };
  if (readState === 'stale') return { tone: 'warn', label: 'stale' };
  if (readState === 'not_configured') return { tone: 'warn', label: 'setup needed' };
  if (row.status === 'error' || row.status === 'down' || row.status === 'malformed' || row.status === 'unreachable') {
    return { tone: 'bad', label: row.status };
  }
  if (row.status === 'stale' || row.status === 'not_configured' || row.status === 'degraded') {
    return { tone: 'warn', label: row.status };
  }
  if (row.status === 'ok' || row.status === 'healthy') return { tone: 'ok', label: row.status };
  return { tone: 'neutral', label: row.status };
}

function runtimeGateStatus(runtime: { tone: Tone; label: string }, fallback: { tone: Tone; label: string }): { tone: Tone; label: string } {
  if (runtime.tone === 'bad' || runtime.tone === 'warn') return runtime;
  return fallback;
}

function legacyAccountStatusPill(
  account: AdminBotHealthResult['legacyProviderAccounts'][number],
  runtime: { tone: Tone; label: string },
): { tone: Tone; label: string } {
  return runtimeGateStatus(runtime, {
    tone: account.quarantined ? 'bad' : account.running ? 'ok' : 'warn',
    label: account.quarantined ? 'quarantined' : account.running ? 'running' : 'paused',
  });
}

function workerContinuityPill(snap: AdminBotHealthResult): { tone: Tone; label: string } {
  const continuity = snap.workerBotContinuity;
  if (!continuity) return { tone: 'warn', label: 'worker continuity: missing' };
  if (
    continuity.botContinuityStatus === 'error' ||
    continuity.status === 'error' ||
    continuity.tortilaSnapshot === 'error' ||
    continuity.legacySnapshot === 'error' ||
    continuity.tortilaReadState === 'unreachable' ||
    continuity.tortilaReadState === 'malformed' ||
    continuity.legacyReadState === 'unreachable' ||
    continuity.legacyReadState === 'malformed'
  ) {
    return { tone: 'bad', label: 'worker continuity: error' };
  }
  if (continuity.freshness === 'stale') return { tone: 'warn', label: 'worker continuity: stale' };
  if (
    continuity.botContinuityStatus === 'attention' ||
    continuity.status === 'not_configured' ||
    continuity.status === 'degraded'
  ) {
    return { tone: 'warn', label: 'worker continuity: attention' };
  }
  if (continuity.botContinuityStatus === 'ok' && continuity.status === 'ok') return { tone: 'ok', label: 'worker continuity: ok' };
  return { tone: 'neutral', label: `worker continuity: ${continuity.botContinuityStatus ?? continuity.status ?? 'unknown'}` };
}

function ageLabel(seconds: number | null | undefined): string {
  if (seconds == null) return 'age unknown';
  if (seconds < 60) return `${seconds}s old`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m old`;
  return `${Math.round(seconds / 3600)}h old`;
}

function freshnessWindowLabel(seconds: number | null | undefined): string {
  return seconds == null ? 'stale window unknown' : `stale after ${seconds}s`;
}

function workerFreshnessSummary(continuity: NonNullable<AdminBotHealthResult['workerBotContinuity']>): string {
  return `${continuity.freshness}; ${ageLabel(continuity.ageSeconds)} / ${freshnessWindowLabel(continuity.staleAfterSeconds)}`;
}

type UserLinkSummary = Pick<LegacyMappedUserAdminView, 'userId' | 'displayName' | 'email'>;

type AdminOwnerDrilldownRow = {
  id: string;
  product: 'Tortila Bot' | 'Legacy Bot';
  owner: UserLinkSummary | null;
  detailAnchor: 'bot-tortila_bot' | 'bot-legacy_bot';
  runtimeIdentity: string;
  scope: string;
  status: { tone: Tone; label: string };
  latestAt: number | null;
  metrics: string;
};

type AdminAcceptanceGateRow = {
  gate: string;
  status: Tone;
  state: string;
  evidence: string;
  next: string;
};

function envPresence(name: string): 'SET' | 'NOT_SET' {
  return process.env[name] ? 'SET' : 'NOT_SET';
}

function envTone(name: string): Tone {
  return envPresence(name) === 'SET' ? 'warn' : 'neutral';
}

function adminAcceptanceGateRows(snap: AdminBotHealthResult, worker: { tone: Tone; label: string }): AdminAcceptanceGateRow[] {
  const workerEnv = envPresence('WORKER_CONTINUITY_ADMIN_DATABASE_URL');
  const adminMatrixEnv = envPresence('ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL');
  const legacySourceEnv = envPresence('LEGACY_DATABASE_URL');
  const tortilaSourceEnv = envPresence('TORTILA_JOURNAL_URL');
  const legacyReadReady = snap.legacyDbLiveReadEnabled && snap.legacyDatabaseConfigured;

  return [
    {
      gate: 'Persisted worker tuple',
      status: worker.tone,
      state: worker.label.replace('worker continuity: ', ''),
      evidence: snap.workerBotContinuity
        ? `freshness=${workerFreshnessSummary(snap.workerBotContinuity)}; core=${snap.workerBotContinuity.coreWorkerStatus ?? snap.workerBotContinuity.status ?? 'unknown'}; tortila=${snap.workerBotContinuity.tortilaSnapshot ?? 'unknown'}; legacy=${snap.workerBotContinuity.legacySnapshot ?? 'unknown'}`
        : 'No target=worker row has been persisted yet.',
      next: worker.tone === 'ok' ? 'Keep monitoring cadence' : 'Run worker snapshot cycle, then refresh this page; stale worker rows cannot prove continuity.',
    },
    {
      gate: 'Managed continuity acceptance',
      status: envTone('WORKER_CONTINUITY_ADMIN_DATABASE_URL'),
      state: `WORKER_CONTINUITY_ADMIN_DATABASE_URL ${workerEnv}`,
      evidence: 'Runner creates and drops a throwaway worker-continuity database; this page never prints or opens the DSN.',
      next: workerEnv === 'SET' ? 'Run npm run accept:worker:continuity:managed from the repo shell.' : 'Provide the admin maintenance DB env only for the managed runner.',
    },
    {
      gate: 'Selected-user DB matrix',
      status: envTone('ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL'),
      state: `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL ${adminMatrixEnv}`,
      evidence: 'Matrix runner creates and drops a throwaway admin-user-bots database and proves selected-user readiness render paths.',
      next: adminMatrixEnv === 'SET' ? 'Run npm run e2e:admin-user-bots:db:managed:matrix from the repo shell.' : 'Provide the admin matrix DB env only for the opt-in runner.',
    },
    {
      gate: 'Legacy live-read source',
      status: legacyReadReady ? 'ok' : 'warn',
      state: legacyReadReady ? 'worker DB snapshots enabled' : `LEGACY_DATABASE_URL ${legacySourceEnv}`,
      evidence: legacyReadReady
        ? 'Legacy provider pub_id snapshots can be read through the worker DB path.'
        : 'Provider runtime snapshots are not configured here; do not call Legacy HTTP/control paths from the admin page.',
      next: legacyReadReady ? 'Review mapped pub_id rows below.' : 'Configure read-only Legacy DB source for worker snapshots, not live control.',
    },
    {
      gate: 'Legacy closed-trade analytics',
      status: 'warn',
      state: 'source proof blocked',
      evidence: 'Win rate, realized PnL, fees, funding, and profit factor require stable closed-trade ids and close timestamps. Active orders or slots are not accepted substitutes.',
      next: 'Provide a source-proof table/API contract before implementing the importer.',
    },
    {
      gate: 'Tortila journal source',
      status: tortilaSourceEnv === 'SET' || snap.tortilaBaseUrlConfigured ? 'warn' : 'neutral',
      state: snap.tortilaBaseUrlConfigured ? 'base URL configured' : `TORTILA_JOURNAL_URL ${tortilaSourceEnv}`,
      evidence: 'Tortila source proof is worker-persisted journal health and snapshots, not a live probe during admin render.',
      next: snap.tortilaBaseUrlConfigured ? 'Check persisted journal health below.' : 'Configure journal source for the worker, then run a read-only snapshot cycle.',
    },
    {
      gate: 'Live bot control',
      status: 'bad',
      state: 'DISABLED',
      evidence: 'No admin page can start, stop, apply runtime config, close positions, or ping an exchange/provider.',
      next: 'Requires separate bot-integration and security approval before any live-control adapter exists.',
    },
  ];
}

function ownerIdentitySummary(mappedUser: UserLinkSummary | null): ReactNode {
  if (!mappedUser) {
    return <span className="wtc-dim">fleet-only / unmapped</span>;
  }
  return (
    <span>
      <strong>{mappedUser.displayName}</strong>
      <br />
      <span className="wtc-dim" style={{ fontSize: 12 }}>{mappedUser.email}</span>
      <br />
      <span className="wtc-mono wtc-dim" style={{ fontSize: 11 }}>User ID {mappedUser.userId}</span>
    </span>
  );
}

function mappedUserSummary(mappedUser: UserLinkSummary | null): ReactNode {
  if (!mappedUser) return ownerIdentitySummary(null);
  return (
    <span>
      {ownerIdentitySummary(mappedUser)}
      <br />
      <Link href={`/admin/users/${mappedUser.userId}/bots`} className="wtc-link" style={{ fontSize: 12 }}>
        Open read-only user view
      </Link>
    </span>
  );
}

function ownerDetailAction(row: AdminOwnerDrilldownRow): ReactNode {
  const mappedUser = row.owner;
  if (!mappedUser) {
    return <StatusPill tone="warn">mapping required</StatusPill>;
  }
  return (
    <Link
      href={`/admin/users/${mappedUser.userId}/bots#${row.detailAnchor}`}
      className={buttonClasses('secondary')}
      style={{ padding: '5px 10px', fontSize: 12, whiteSpace: 'nowrap' }}
    >
      Open read-only user view
    </Link>
  );
}

function botOwnerDrilldownRows(snap: AdminBotHealthResult): AdminOwnerDrilldownRow[] {
  const tortilaRuntime = journalReadStatePill(snap);
  const legacyRuntime = healthCheckPill(snap.botHealthChecks.find((row) => row.target === 'legacy-bot') ?? null);
  const tortilaRows: AdminOwnerDrilldownRow[] = snap.tortilaFleetSnapshots.map((row) => ({
    id: `tortila:${row.botInstanceId}`,
    product: 'Tortila Bot',
    owner: row.ownerUser,
    detailAnchor: 'bot-tortila_bot',
    runtimeIdentity: 'WTC bot instance owner',
    scope: 'user instance snapshot',
    status: runtimeGateStatus(tortilaRuntime, {
      tone: row.sourceAdapter.includes('mock') ? 'warn' : 'ok',
      label: row.sourceAdapter.includes('mock') ? 'mock snapshot' : 'snapshot persisted',
    }),
    latestAt: row.snapshotAt,
    metrics: `${row.walletEquityUsd ? fmtMoney(Number(row.walletEquityUsd)) : '-'} equity / ${fmtNum(row.tradeCount)} trades`,
  }));

  const legacyRows: AdminOwnerDrilldownRow[] = snap.legacyProviderAccounts.map((account) => ({
    id: `legacy:${account.pubId}:${account.mappedUser?.userId ?? 'unmapped'}`,
    product: 'Legacy Bot',
    owner: account.mappedUser,
    detailAnchor: 'bot-legacy_bot',
    runtimeIdentity: `pub_id ${account.pubId}`,
    scope: account.mappedUser ? 'provider account mapped' : 'fleet diagnostics only',
    status: legacyAccountStatusPill(account, legacyRuntime),
    latestAt: account.latestSnapshotAt,
    metrics: `${fmtNum(account.symbols)} symbols / ${fmtNum(account.activeSlots)} slots / ${fmtNum(account.activeOrders)} orders`,
  }));

  return [...tortilaRows, ...legacyRows].sort((a, b) => {
    const ownerA = a.owner?.displayName ?? 'zzzz';
    const ownerB = b.owner?.displayName ?? 'zzzz';
    return ownerA.localeCompare(ownerB) || a.product.localeCompare(b.product) || a.runtimeIdentity.localeCompare(b.runtimeIdentity);
  });
}

function warningSummaryTone(summary: AdminBotWarningSummary): Tone {
  if (summary.maxSeverity === 'error') return 'bad';
  if (summary.maxSeverity === 'warning') return 'warn';
  return 'neutral';
}

function warningProductLabel(productCode: AdminBotWarningSummary['productCode']): string {
  return productCode === 'legacy_bot' ? 'Legacy' : 'Tortila';
}

function fleetEvidenceMetrics(input: {
  snap: AdminBotHealthResult;
  journalLabel: string;
  ownerRows: AdminOwnerDrilldownRow[];
  mappedOwnerRows: AdminOwnerDrilldownRow[];
  unmappedLegacyRows: AdminBotHealthResult['legacyProviderAccounts'];
}): AdminEvidenceMetric[] {
  const warningCount = input.snap.botWarningSummaries.reduce((sum, summary) => sum + summary.count, 0);
  const worker = workerContinuityPill(input.snap);
  const latestLegacyAt = input.snap.legacyProviderAccounts.reduce<number | null>((latest, account) => {
    if (!account.latestSnapshotAt) return latest;
    return latest === null ? account.latestSnapshotAt : Math.max(latest, account.latestSnapshotAt);
  }, null);
  return [
    {
      label: 'Worker continuity',
      value: worker.label.replace('worker continuity: ', ''),
      sub: input.snap.workerBotContinuity
        ? `${workerFreshnessSummary(input.snap.workerBotContinuity)}; checked ${fmtDateTime(input.snap.workerBotContinuity.checkedAt)}`
        : 'latest worker row missing',
      tone: worker.tone === 'ok' ? 'up' : worker.tone === 'bad' ? 'down' : undefined,
    },
    {
      label: 'Journal proof',
      value: input.journalLabel,
      sub: input.snap.tortilaLastOkAt ? fmtDateTime(input.snap.tortilaLastOkAt) : 'latest worker check only',
      tone: input.journalLabel.endsWith('ok') ? 'up' : input.journalLabel.includes('error') || input.journalLabel.includes('unreachable') ? 'down' : undefined,
    },
    {
      label: 'Owner rows',
      value: fmtNum(input.ownerRows.length),
      sub: `${fmtNum(input.mappedOwnerRows.length)} mapped / ${fmtNum(input.unmappedLegacyRows.length)} unmapped Legacy`,
      tone: input.ownerRows.length > 0 ? 'up' : undefined,
    },
    {
      label: 'Latest Tortila metric',
      value: input.snap.latestSnapshot ? fmtDateTime(input.snap.latestSnapshot.snapshotAt) : 'none',
      sub: input.snap.latestSnapshot?.sourceAdapter ?? 'bot_metric_snapshots pending',
      tone: input.snap.latestSnapshot ? 'up' : undefined,
    },
    {
      label: 'Latest Legacy pub_id',
      value: latestLegacyAt ? fmtDateTime(latestLegacyAt) : 'none',
      sub: 'provider snapshot freshness',
      tone: latestLegacyAt ? 'up' : undefined,
    },
    {
      label: 'Warning notices',
      value: fmtNum(warningCount),
      sub: `${fmtNum(input.snap.botWarningSummaries.length)} evaluated target summaries`,
      tone: warningCount > 0 ? 'down' : undefined,
    },
  ];
}

function fleetEvidenceRows(input: {
  snap: AdminBotHealthResult;
  journalPill: { tone: Tone; label: string };
  mappedOwnerRows: AdminOwnerDrilldownRow[];
  unmappedLegacyRows: AdminBotHealthResult['legacyProviderAccounts'];
}): AdminEvidenceRow[] {
  const worker = workerContinuityPill(input.snap);
  const legacyRuntime = healthCheckPill(input.snap.botHealthChecks.find((row) => row.target === 'legacy-bot') ?? null);
  return [
    {
      layer: 'Worker continuity',
      status: worker.tone,
      statusLabel: worker.label.replace('worker continuity: ', ''),
      proof: input.snap.workerBotContinuity
        ? `${workerFreshnessSummary(input.snap.workerBotContinuity)}; core ${input.snap.workerBotContinuity.coreWorkerStatus ?? input.snap.workerBotContinuity.status}; Tortila ${input.snap.workerBotContinuity.tortilaSnapshot ?? 'unknown'}; Legacy ${input.snap.workerBotContinuity.legacySnapshot ?? 'unknown'}`
        : 'missing worker row',
      detail: "Derived from the latest persisted worker integration_health_checks row. Rows older than the admin freshness window stay attention, not green; the admin page does not run a live worker tick during render.",
    },
    {
      layer: 'Fleet health row',
      status: input.journalPill.tone,
      statusLabel: input.journalPill.label.replace('journal: ', ''),
      proof: input.snap.tortilaJournalStatus ?? input.snap.mode,
      detail: 'Derived from persisted integration_health_checks rows. This page does not probe the journal during render.',
    },
    {
      layer: 'Tortila owner snapshots',
      status: input.snap.tortilaFleetSnapshots.length > 0
        ? input.journalPill.tone === 'bad' || input.journalPill.tone === 'warn'
          ? input.journalPill.tone
          : 'ok'
        : input.snap.mode === 'demo' ? 'warn' : 'neutral',
      statusLabel: input.snap.tortilaFleetSnapshots.length > 0 ? 'owner-scoped' : 'pending',
      proof: `${fmtNum(input.snap.tortilaFleetSnapshots.length)} WTC bot instance owner rows`,
      detail: 'Tortila admin ownership is derived from WTC bot instances joined to persisted metric snapshots; runtime health still comes from the latest journal health row.',
    },
    {
      layer: 'Legacy pub_id scope',
      status: legacyRuntime.tone === 'bad' || legacyRuntime.tone === 'warn'
        ? legacyRuntime.tone
        : input.unmappedLegacyRows.length > 0 ? 'warn' : input.mappedOwnerRows.length > 0 ? 'ok' : 'neutral',
      statusLabel: legacyRuntime.tone === 'bad' || legacyRuntime.tone === 'warn'
        ? legacyRuntime.label
        : input.unmappedLegacyRows.length > 0 ? 'mapping review' : input.mappedOwnerRows.length > 0 ? 'mapped' : 'pending',
      proof: `${fmtNum(input.mappedOwnerRows.length)} mapped owner rows / ${fmtNum(input.unmappedLegacyRows.length)} unmapped pub_id rows`,
      detail: 'Legacy runtime facts become user-scoped only after an active WTC provider-account mapping; health still comes from the latest legacy-bot worker row.',
    },
    {
      layer: 'Admin boundary',
      status: 'neutral',
      statusLabel: 'inspect only',
      proof: 'no user-setting mutation',
      detail: 'Admins can inspect fleet evidence and open read-only user views; this page does not edit user profiles, provider mappings, credentials, or runtime state.',
    },
  ];
}

/**
 * Admin bot health page.
 *
 * Shows:
 * 1. Adapter mode + storage mode badges
 * 2. Safety states (DISABLED live control + Legacy read-only DB path)
 * 3. Tortila persistent P0/P1 warnings (non-dismissible — cleared only when journal reports resolution)
 * 4. Tortila journal health (last ok, last error, from integration_health_checks)
 * 5. Latest bot metric snapshot (walletEquityUsd, sourceAdapter, snapshotAt)
 * 6. Integration health checks table for bot.* targets
 * 7. Legacy live-read status card
 *
 * SECURITY: requireUser + assertAdmin. No exchange keys, no URLs, no stack traces rendered.
 * All data is read-only. No live-control buttons exist on this page (safety policy).
 */
export default async function AdminBotsPage() {
  const actor = await requireUser();
  assertAdmin(actor.roles);

  const snap = await loadAdminBotHealth();
  const journalPill = journalReadStatePill(snap);
  const workerPill = workerContinuityPill(snap);
  const legacyRuntimePill = healthCheckPill(snap.botHealthChecks.find((row) => row.target === 'legacy-bot') ?? null);
  const ownerRows = botOwnerDrilldownRows(snap);
  const mappedOwnerRows = ownerRows.filter((row) => row.owner !== null);
  const unmappedLegacyRows = snap.legacyProviderAccounts.filter((row) => row.mappedUser === null);
  const acceptanceRows = adminAcceptanceGateRows(snap, workerPill);
  const acceptanceBlocked = acceptanceRows.filter((row) => row.status === 'bad').length;
  const acceptanceReview = acceptanceRows.filter((row) => row.status === 'warn').length;

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="Admin · bots"
        title="Bot fleet"
        copy="Cross-user bot health diagnostics. Live control is permanently DISABLED by safety policy. Tortila and Legacy are read-only surfaces. No runtime action buttons exist on this page."
      />

      {/* Status badges row */}
      <div className="wtc-row" style={{ marginTop: -4, flexWrap: 'wrap', gap: 8 }}>
        {snap.mode === 'postgres' ? (
          <StatusPill tone="ok">storage: Postgres</StatusPill>
        ) : (
          <StatusPill tone="warn">storage: in-memory (demo)</StatusPill>
        )}
        <StatusPill tone={snap.adapterMode === 'mock' ? 'warn' : snap.adapterMode === 'read-only' ? 'neutral' : 'ok'}>
          adapter: {snap.adapterMode}
        </StatusPill>
        <StatusPill tone="bad">LIVE CONTROL: DISABLED</StatusPill>
        <StatusPill tone={snap.legacyDbLiveReadEnabled && snap.legacyDatabaseConfigured ? 'ok' : 'warn'}>
          LEGACY DB READ: {snap.legacyDbLiveReadEnabled && snap.legacyDatabaseConfigured ? 'enabled' : 'not configured'}
        </StatusPill>
        {snap.tortilaBaseUrlConfigured ? (
          <StatusPill tone="neutral">base URL: configured</StatusPill>
        ) : (
          <StatusPill tone="warn">base URL: not set</StatusPill>
        )}
        {/* PG2 read-state surfaced at the ops layer (derived from the last persisted health check). */}
        <StatusPill tone={journalPill.tone}>{journalPill.label}</StatusPill>
        <StatusPill tone={workerPill.tone}>{workerPill.label}</StatusPill>
      </div>

      {/* Demo mode hint */}
      {snap.mode === 'demo' && (
        <RiskWarningBanner
          severity="warning"
          title="Demo mode — no Postgres"
          detail="No DATABASE_URL configured. Health checks and metric snapshots are not persisted. Connect Postgres and run the worker to see real data."
        />
      )}

      {/* Runtime safety summary */}
      <Card title="Runtime safety summary">
        <div className="wtc-stack" style={{ gap: 10 }}>
          <div className="wtc-row" style={{ gap: 10 }}>
            <StatusPill tone="bad">DISABLED</StatusPill>
            <span className="wtc-dim" style={{ fontSize: 13 }}>
              <strong style={{ color: 'var(--text)' }}>Live bot control</strong>:
              start, stop, and live config apply are unavailable from WTC.
            </span>
          </div>
          <div className="wtc-row" style={{ gap: 10 }}>
            <StatusPill tone={snap.legacyDbLiveReadEnabled && snap.legacyDatabaseConfigured ? 'ok' : 'warn'}>
              {snap.legacyDbLiveReadEnabled && snap.legacyDatabaseConfigured ? 'READ-ONLY' : 'SETUP NEEDED'}
            </StatusPill>
            <span className="wtc-dim" style={{ fontSize: 13 }}>
              <strong style={{ color: 'var(--text)' }}>Legacy live-read</strong> —
              WTC reads the existing provider runtime by pub_id through worker DB snapshots. The direct HTTP/control
              path stays disabled; no exchange keys are collected or rendered by WTC.
            </span>
          </div>
          <div className="wtc-row" style={{ gap: 10 }}>
            <StatusPill tone="bad">DISABLED</StatusPill>
            <span className="wtc-dim" style={{ fontSize: 13 }}>
              <strong style={{ color: 'var(--text)' }}>TradingView automation</strong> —
              access grants are manual-only. No credential-stuffing or browser automation is active.
            </span>
          </div>
        </div>
      </Card>

      <Card title="Bot completion gate map">
        <RiskWarningBanner
          severity={acceptanceBlocked > 0 ? 'error' : acceptanceReview > 0 ? 'warning' : 'info'}
          title={acceptanceBlocked > 0 ? 'Live completion gates are still blocked' : acceptanceReview > 0 ? 'Operator proof still needs review' : 'Operator gates are quiet'}
          detail="This admin map shows gate state without reading secret values, mutating DB state, running worker ticks, probing providers, or exposing live-control actions."
        />
        <div className="wtc-grid wtc-grid-4" style={{ marginTop: 12, marginBottom: 14 }}>
          <MetricCard label="Blocked gates" value={fmtNum(acceptanceBlocked)} tone={acceptanceBlocked > 0 ? 'down' : undefined} />
          <MetricCard label="Review gates" value={fmtNum(acceptanceReview)} tone={acceptanceReview > 0 ? 'down' : undefined} />
          <MetricCard label="Managed envs" value={`${envPresence('WORKER_CONTINUITY_ADMIN_DATABASE_URL')}/${envPresence('ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL')}`} sub="values hidden" />
          <MetricCard label="Live control" value="disabled" tone="down" />
        </div>
        <div className="wtc-table-wrap">
          <table className="wtc-table">
            <thead>
              <tr><th>Gate</th><th>Status</th><th>State</th><th>Evidence</th><th>Next proof</th></tr>
            </thead>
            <tbody>
              {acceptanceRows.map((row) => (
                <tr key={row.gate}>
                  <td data-label="Gate">{row.gate}</td>
                  <td data-label="Status"><StatusPill tone={row.status}>{row.status}</StatusPill></td>
                  <td data-label="State">{row.state}</td>
                  <td data-label="Evidence" className="wtc-dim">{row.evidence}</td>
                  <td data-label="Next proof" className="wtc-dim">{row.next}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="wtc-dim" style={{ fontSize: 12, lineHeight: 1.6, margin: '12px 0 0' }}>
          Gate names and environment variable names are visible to admins; environment values, exchange secrets, provider
          URLs, raw payloads, and runtime controls are not rendered.
        </p>
      </Card>

      <Card title="Worker bot continuity">
        {snap.workerBotContinuity ? (
          <>
            <div className="wtc-row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
              <MetricCard label="Continuity" value={snap.workerBotContinuity.botContinuityStatus ?? snap.workerBotContinuity.status ?? '-'} tone={workerPill.tone === 'ok' ? 'up' : workerPill.tone === 'bad' ? 'down' : undefined} />
              <MetricCard label="Worker row" value={snap.workerBotContinuity.status ?? '-'} />
              <MetricCard label="Checked" value={fmtDateTime(snap.workerBotContinuity.checkedAt)} />
              <MetricCard
                label="Freshness"
                value={snap.workerBotContinuity.freshness}
                sub={`${ageLabel(snap.workerBotContinuity.ageSeconds)} / ${freshnessWindowLabel(snap.workerBotContinuity.staleAfterSeconds)}`}
                tone={snap.workerBotContinuity.freshness === 'fresh' && workerPill.tone === 'ok' ? 'up' : snap.workerBotContinuity.freshness === 'stale' ? 'down' : undefined}
              />
              <MetricCard label="Core worker" value={snap.workerBotContinuity.coreWorkerStatus ?? '-'} />
            </div>
            <div className="wtc-table-wrap">
              <table className="wtc-table">
                <thead><tr><th>Bot</th><th>Snapshot</th><th>Health</th><th>Read state</th></tr></thead>
                <tbody>
                  <tr>
                    <td data-label="Bot">Tortila</td>
                    <td data-label="Snapshot">{snap.workerBotContinuity.tortilaSnapshot ?? '-'}</td>
                    <td data-label="Health">{snap.workerBotContinuity.tortilaHealthStatus ?? '-'}</td>
                    <td data-label="Read state">{snap.workerBotContinuity.tortilaReadState ?? '-'}</td>
                  </tr>
                  <tr>
                    <td data-label="Bot">Legacy</td>
                    <td data-label="Snapshot">{snap.workerBotContinuity.legacySnapshot ?? '-'}</td>
                    <td data-label="Health">{snap.workerBotContinuity.legacyHealthStatus ?? '-'}</td>
                    <td data-label="Read state">{snap.workerBotContinuity.legacyReadState ?? '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="wtc-dim" style={{ fontSize: 12, marginTop: 8 }}>
              This is the latest persisted worker health detail. A stale target='worker' row is treated as attention even if its saved status is ok. The admin page does not run a worker tick, journal probe, Legacy DB read, or live bot control action during render.
            </p>
          </>
        ) : (
          <EmptyState
            title="No worker continuity row yet"
            hint="Run the worker with Postgres to persist target='worker' health detail for Tortila and Legacy continuity."
          />
        )}
      </Card>

      <AdminBotRuntimeEvidencePanel
        title="Admin fleet evidence ladder"
        copy="Fleet evidence separates persisted worker health, Tortila owner snapshots, Legacy pub_id mapping scope, and the admin read-only boundary. It is not live-control proof."
        metrics={fleetEvidenceMetrics({ snap, journalLabel: journalPill.label, ownerRows, mappedOwnerRows, unmappedLegacyRows })}
        rows={fleetEvidenceRows({ snap, journalPill, mappedOwnerRows, unmappedLegacyRows })}
      />

      <Card title={`Bot owner drilldown (${ownerRows.length})`}>
        <RiskWarningBanner
          severity="info"
          title="Read-only owner explorer"
          detail="Admins can open a selected user's bot details from mapped Tortila owners or mapped Legacy pub_id rows. Unmapped Legacy pub_id facts remain fleet diagnostics; this page does not edit user settings, provider mappings, exchange keys, or live bot state."
        />
        <div className="wtc-grid wtc-grid-4" style={{ marginTop: 12 }}>
          <MetricCard label="Mapped owner rows" value={fmtNum(mappedOwnerRows.length)} tone={mappedOwnerRows.length > 0 ? 'up' : undefined} />
          <MetricCard label="Legacy unmapped pub_id" value={fmtNum(unmappedLegacyRows.length)} tone={unmappedLegacyRows.length > 0 ? 'down' : undefined} />
          <MetricCard label="Tortila owner snapshots" value={fmtNum(snap.tortilaFleetSnapshots.length)} />
          <MetricCard label="Legacy pub_id rows" value={fmtNum(snap.legacyProviderAccounts.length)} />
        </div>
        {ownerRows.length === 0 ? (
          <EmptyState
            title="No bot owner rows yet"
            hint={
              snap.mode === 'demo'
                ? 'Demo mode - no Postgres. Connect Postgres and run the worker to populate owner drilldown rows.'
                : 'No Tortila owner snapshots or Legacy pub_id snapshots are persisted yet. The worker must populate bot snapshots first.'
            }
          />
        ) : (
          <div className="wtc-table-wrap" style={{ marginTop: 12 }}>
            <table className="wtc-table">
              <thead>
                <tr><th>Owner</th><th>Product</th><th>Runtime identity</th><th>Scope</th><th>Status</th><th>Latest</th><th>Metrics</th><th>Detail</th></tr>
              </thead>
              <tbody>
                {ownerRows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Owner">{ownerIdentitySummary(row.owner)}</td>
                    <td data-label="Product">{row.product}</td>
                    <td data-label="Runtime identity" className="wtc-mono" style={{ fontSize: 12 }}>{row.runtimeIdentity}</td>
                    <td data-label="Scope">{row.scope}</td>
                    <td data-label="Status"><StatusPill tone={row.status.tone}>{row.status.label}</StatusPill></td>
                    <td data-label="Latest" className="wtc-mono" style={{ fontSize: 12 }}>{fmtDateTime(row.latestAt)}</td>
                    <td data-label="Metrics">{row.metrics}</td>
                    <td className="wtc-td-action" data-label="Detail">{ownerDetailAction(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Canonical warning summary">
        {snap.botWarningSummaries.length === 0 ? (
          <EmptyState
            title="No evaluated bot warning snapshots"
            hint={
              snap.mode === 'demo'
                ? 'Demo mode - no Postgres. Connect Postgres and run the worker to populate canonical warning summaries.'
                : 'No Tortila or Legacy health rows have been recorded yet. This is not a runtime all-clear.'
            }
          />
        ) : (
          <div className="wtc-table-wrap">
            <table className="wtc-table">
              <thead>
                <tr><th>Target</th><th>Product</th><th>Status</th><th>Evaluated</th><th>Warnings</th></tr>
              </thead>
              <tbody>
                {snap.botWarningSummaries.map((summary) => (
                  <tr key={summary.target}>
                    <td className="wtc-mono" data-label="Target">{summary.target}</td>
                    <td data-label="Product">{warningProductLabel(summary.productCode)}</td>
                    <td data-label="Status">
                      <StatusPill tone={warningSummaryTone(summary)}>
                        {summary.count > 0 ? `${summary.count} notice${summary.count === 1 ? '' : 's'}` : 'none reported'}
                      </StatusPill>
                    </td>
                    <td className="wtc-mono" data-label="Evaluated" style={{ fontSize: 12 }}>
                      {fmtDateTime(summary.evaluatedAt)}
                    </td>
                    <td data-label="Warnings">
                      {summary.warnings.length === 0 ? (
                        <span className="wtc-dim" style={{ fontSize: 12 }}>
                          No canonical warning codes in the latest evaluated health detail.
                        </span>
                      ) : (
                        <div className="wtc-stack" style={{ gap: 8 }}>
                          {summary.warnings.map((warning) => (
                            <div key={warning.code}>
                              <div className="wtc-row" style={{ gap: 8 }}>
                                <StatusPill tone={warning.severity === 'error' ? 'bad' : warning.severity === 'warning' ? 'warn' : 'neutral'}>
                                  {warning.severity}
                                </StatusPill>
                                <strong>{warning.title}</strong>
                              </div>
                              <div className="wtc-dim" style={{ fontSize: 12, marginTop: 3 }}>
                                <code className="wtc-mono">{warning.code}</code> - {warning.detail}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="wtc-dim" style={{ fontSize: 12, marginTop: 8 }}>
          Canonical summaries are derived from sanitized integration health details and registry-owned warning copy.
          Unknown/provider-origin strings are dropped.
        </p>
      </Card>

      {/* Tortila P0/P1 warnings - non-dismissible, non-collapsible */}
      {TORTILA_PERSISTENT_WARNINGS.map((w) => (
        <RiskWarningBanner
          key={w.code}
          severity={w.severity === 'error' ? 'error' : 'warning'}
          title={`${w.severity === 'error' ? 'P0' : 'P1'}: ${w.title}`}
          detail={w.detail}
        />
      ))}

      {/* Tortila journal health */}
      <Card title="Tortila journal health (bot.tortila.journal / tortila-journal)">
        <div className="wtc-row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <MetricCard
            label="Adapter mode"
            value={snap.adapterMode}
            tone={snap.adapterMode === 'mock' ? undefined : 'up'}
          />
          <MetricCard
            label="Last successful check"
            value={snap.tortilaLastOkAt ? fmtDateTime(snap.tortilaLastOkAt) : '—'}
            tone={snap.tortilaLastOkAt ? 'up' : undefined}
          />
          <MetricCard
            label="Last issue"
            value={snap.tortilaLastError ?? snap.tortilaJournalReadStateDetail ?? snap.tortilaJournalStatus ?? '—'}
            tone={snap.tortilaLastError ? 'down' : undefined}
          />
          <MetricCard
            label="Base URL"
            value={snap.tortilaBaseUrlConfigured ? 'configured' : 'not set'}
            tone={snap.tortilaBaseUrlConfigured ? 'up' : undefined}
          />
        </div>
        {snap.mode === 'demo' ? (
          <p className="wtc-dim" style={{ fontSize: 12, marginTop: 4 }}>
            Demo mode — no DATABASE_URL. Run the worker with Postgres to populate health checks.
          </p>
        ) : snap.tortilaLastOkAt === null && snap.tortilaLastError === null ? (
          <p className="wtc-dim" style={{ fontSize: 12, marginTop: 4 }}>
            No health checks recorded for{' '}
            <code className="wtc-mono">tortila-journal</code> target yet. The worker must run and
            call the journal <code className="wtc-mono">/api/health</code> endpoint to populate this table.
          </p>
        ) : null}
      </Card>

      {/* Latest bot metric snapshot */}
      <Card title="Latest bot metric snapshot (bot_metric_snapshots)">
        {snap.latestSnapshot ? (
          <div className="wtc-row" style={{ gap: 12, flexWrap: 'wrap' }}>
            <MetricCard
              label="Snapshot at"
              value={fmtDateTime(snap.latestSnapshot.snapshotAt)}
            />
            <MetricCard
              label="Wallet equity USD"
              value={snap.latestSnapshot.walletEquityUsd ?? '—'}
            />
            <MetricCard
              label="Source adapter"
              value={snap.latestSnapshot.sourceAdapter}
              tone={snap.latestSnapshot.sourceAdapter.includes('mock') ? undefined : 'up'}
            />
          </div>
        ) : (
          <EmptyState
            title="No metric snapshots yet"
            hint={
              snap.mode === 'demo'
                ? 'Demo mode — snapshots are not persisted without DATABASE_URL.'
                : 'No snapshots recorded yet. The worker must run the snapshotTortilaJournal job to populate this table.'
            }
          />
        )}
        {snap.latestSnapshot?.sourceAdapter.includes('mock') && (
          <p className="wtc-dim" style={{ fontSize: 12, marginTop: 8 }}>
            Source is mock — these are synthetic values. Set{' '}
            <code className="wtc-mono">BOT_ADAPTER_MODE=read-only</code> and configure{' '}
            <code className="wtc-mono">TORTILA_JOURNAL_BASE_URL</code> to read live journal data.
          </p>
        )}
      </Card>

      <Card title="Tortila user-scoped snapshots">
        {snap.tortilaFleetSnapshots.length === 0 ? (
          <EmptyState
            title="No Tortila bot instance snapshot yet"
            hint={
              snap.mode === 'demo'
                ? 'Demo mode - no DATABASE_URL. Connect Postgres and run the worker to populate Tortila owner rows.'
                : 'No Tortila snapshots are joined to a WTC bot instance owner yet. The worker must write bot_metric_snapshots for tortila_bot instances.'
            }
          />
        ) : (
          <div className="wtc-table-wrap">
            <table className="wtc-table">
              <thead>
                <tr><th>Owner</th><th>Scope</th><th>Snapshot</th><th>Equity</th><th>Trades</th><th>Source</th></tr>
              </thead>
              <tbody>
                {snap.tortilaFleetSnapshots.map((row) => (
                  <tr key={row.botInstanceId}>
                    <td data-label="Owner">{mappedUserSummary(row.ownerUser)}</td>
                    <td data-label="Scope">
                      <StatusPill tone="ok">bot instance owner</StatusPill>
                    </td>
                    <td data-label="Snapshot" className="wtc-mono" style={{ fontSize: 12 }}>
                      {fmtDateTime(row.snapshotAt)}
                    </td>
                    <td data-label="Equity">{row.walletEquityUsd ? fmtMoney(Number(row.walletEquityUsd)) : '-'}</td>
                    <td data-label="Trades">{fmtNum(row.tradeCount)}</td>
                    <td data-label="Source">
                      <StatusPill tone={row.sourceAdapter.includes('mock') ? 'warn' : 'ok'}>
                        {row.sourceAdapter}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="wtc-dim" style={{ fontSize: 12, marginTop: 8 }}>
          Tortila does not expose a Legacy-style provider pub_id in WTC. Fleet ownership is derived from
          the WTC bot instance attached to each persisted snapshot; provider-account mapping remains a
          separate future decision if Tortila gets a stable audited provider id.
        </p>
      </Card>

      {/* Legacy live-read status */}
      <Card title="Legacy bot live-read status (legacy-bot)">
        <RiskWarningBanner
          severity={snap.legacyDbLiveReadEnabled && snap.legacyDatabaseConfigured ? 'info' : 'warning'}
          title={snap.legacyDbLiveReadEnabled && snap.legacyDatabaseConfigured ? 'Legacy DB live-read enabled' : 'Legacy DB live-read not configured'}
          detail={snap.legacyDbLiveReadEnabled && snap.legacyDatabaseConfigured ? 'Worker snapshots read provider-side pub_id, balance, running state, symbol settings, stage settings, active slots, and active orders through a whitelisted DB query. Live control remains disabled.' : 'Set LEGACY_LIVE_READS_ENABLED=true and a server-side LEGACY_DATABASE_URL to populate Legacy snapshots. The URL itself is never shown in admin UI.'}
        />
        <div className="wtc-row" style={{ gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <MetricCard label="DB read flag" value={snap.legacyDbLiveReadEnabled ? 'enabled' : 'disabled'} tone={snap.legacyDbLiveReadEnabled ? 'up' : undefined} />
          <MetricCard label="Provider DB connection" value={snap.legacyDatabaseConfigured ? 'configured' : 'not set'} tone={snap.legacyDatabaseConfigured ? 'up' : undefined} />
          <MetricCard label="Live control" value="DISABLED" />
        </div>
      </Card>

      <Card title="Legacy pub_id inspector">
        {snap.legacyProviderAccounts.length === 0 ? (
          <EmptyState
            title="No Legacy pub_id snapshot yet"
            hint={snap.legacyDbLiveReadEnabled && snap.legacyDatabaseConfigured ? 'Run the worker snapshot cycle to populate provider account rows.' : 'Configure the Legacy provider DB read path first.'}
          />
        ) : (
          <div className="wtc-table-wrap">
            <table className="wtc-table">
              <thead>
                <tr><th>pub_id</th><th>Mapped user</th><th>Market</th><th>Status</th><th>Balance</th><th>Symbols</th><th>Slots</th><th>Orders</th><th>Snapshot</th></tr>
              </thead>
              <tbody>
                {snap.legacyProviderAccounts.map((account) => (
                  <tr key={account.pubId}>
                    <td className="wtc-mono" data-label="pub_id">{account.pubId}</td>
                    <td data-label="Mapped user">{mappedUserSummary(account.mappedUser)}</td>
                    <td data-label="Market">{account.market}</td>
                    <td data-label="Status">
                      <StatusPill tone={legacyAccountStatusPill(account, legacyRuntimePill).tone}>
                        {legacyAccountStatusPill(account, legacyRuntimePill).label}
                      </StatusPill>
                    </td>
                    <td data-label="Balance">{fmtMoney(account.balance)}</td>
                    <td data-label="Symbols">{fmtNum(account.symbols)}</td>
                    <td data-label="Slots">{fmtNum(account.activeSlots)}</td>
                    <td data-label="Orders">{fmtNum(account.activeOrders)}</td>
                    <td data-label="Snapshot" className="wtc-mono" style={{ fontSize: 12 }}>{fmtDateTime(account.latestSnapshotAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {snap.legacyActiveSlots.length > 0 && (
        <Card title="Legacy active slots">
          <div className="wtc-table-wrap">
            <table className="wtc-table">
              <thead><tr><th>pub_id</th><th>Mapped user</th><th>Symbol</th><th>Signal</th><th>Stage</th><th>Averaging</th><th>Opened</th></tr></thead>
              <tbody>
                {snap.legacyActiveSlots.map((slot, i) => (
                  <tr key={`${slot.pubId}-${slot.symbol}-${i}`}>
                    <td className="wtc-mono" data-label="pub_id">{slot.pubId}</td>
                    <td data-label="Mapped user">{mappedUserSummary(slot.mappedUser)}</td>
                    <td data-label="Symbol">{slot.symbol}</td>
                    <td data-label="Signal">{slot.signal.toUpperCase()}</td>
                    <td data-label="Stage">{slot.stage ?? '-'}</td>
                    <td data-label="Averaging">{slot.averagingCount ?? 0}</td>
                    <td data-label="Opened" className="wtc-mono" style={{ fontSize: 12 }}>{fmtDateTime(slot.openedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {snap.legacyActiveOrders.length > 0 && (
        <Card title="Legacy active order coverage">
          <div className="wtc-table-wrap">
            <table className="wtc-table">
              <thead><tr><th>pub_id</th><th>Mapped user</th><th>Symbol</th><th>Type</th><th>Qty</th><th>Price</th></tr></thead>
              <tbody>
                {snap.legacyActiveOrders.slice(0, 30).map((order, i) => (
                  <tr key={`${order.pubId}-${order.symbol}-${order.note}-${i}`}>
                    <td className="wtc-mono" data-label="pub_id">{order.pubId}</td>
                    <td data-label="Mapped user">{mappedUserSummary(order.mappedUser)}</td>
                    <td data-label="Symbol">{order.symbol}</td>
                    <td data-label="Type">{order.note}</td>
                    <td data-label="Qty">{fmtNum(order.qty)}</td>
                    <td data-label="Price">{fmtNum(order.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Integration health checks table for bot.* targets */}
      <Card title="Integration health checks (bot.* targets)">
        {snap.botHealthChecks.length === 0 ? (
          <EmptyState
            title="No bot health checks recorded yet"
            hint={
              snap.mode === 'demo'
                ? 'Demo mode — no DATABASE_URL. Connect Postgres and run the worker to populate health checks.'
                : 'No health checks for bot.* targets. The worker writes integration_health_checks rows on each tick cycle (every 60 s by default).'
            }
          />
        ) : (
          <div className="wtc-table-wrap">
            <table className="wtc-table">
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Status</th>
                  <th>Checked at</th>
                  <th>Detail (truncated)</th>
                </tr>
              </thead>
              <tbody>
                {snap.botHealthChecks.map((hc) => (
                  <tr key={hc.id}>
                    <td className="wtc-mono" data-label="Target">{hc.target}</td>
                    <td data-label="Status">
                      <StatusPill tone={healthCheckPill(hc).tone}>
                        {healthCheckPill(hc).label}
                      </StatusPill>
                    </td>
                    <td className="wtc-mono" data-label="Checked at" style={{ fontSize: 12 }}>
                      {fmtDateTime(hc.checkedAt)}
                    </td>
                    <td className="wtc-dim" data-label="Detail" style={{ fontSize: 12 }}>
                      {hc.detail ? JSON.stringify(hc.detail).slice(0, 120) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
