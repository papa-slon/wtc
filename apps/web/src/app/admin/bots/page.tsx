import { requireUser } from '@/lib/session';
import { assertAdmin } from '@wtc/auth';
import { Card, SectionHeader, StatusPill, MetricCard, EmptyState, RiskWarningBanner, type Tone } from '@wtc/ui';
import { loadAdminBotHealth } from '@/features/admin/queries';
import { TORTILA_PERSISTENT_WARNINGS } from '@wtc/bot-adapters';
import { fmtDateTime } from '@/lib/format';
import type { AdminBotHealthResult } from '@/features/admin/types';

/**
 * Derive an honest journal read-state pill (PG8 — surfaces the PG2 readState taxonomy at the admin
 * ops layer) from the DB-backed health-check signals already in AdminBotHealthResult. No live probe:
 * an ops page reflects the LAST worker cycle, not a synchronous network call during render
 * (DESIGN_SYSTEM.md §14.6). Demo mode reads nothing, so it is labelled as such.
 */
function journalReadStatePill(snap: AdminBotHealthResult): { tone: Tone; label: string } {
  if (snap.mode === 'demo') return { tone: 'warn', label: 'journal: demo mode' };
  if (snap.tortilaJournalStatus === 'not_configured') return { tone: 'warn', label: 'journal: setup needed' };
  if (snap.tortilaJournalReadState === 'not_configured') return { tone: 'warn', label: 'journal: setup needed' };
  if (snap.tortilaJournalStatus === 'unreachable') return { tone: 'bad', label: 'journal: unreachable' };
  if (snap.tortilaJournalStatus === 'malformed' || snap.tortilaJournalStatus === 'error') {
    return { tone: 'bad', label: 'journal: last check error' };
  }
  if (snap.tortilaJournalStatus === 'stale') return { tone: 'warn', label: 'journal: stale' };
  if (snap.tortilaLastError !== null) return { tone: 'bad', label: 'journal: last check error' };
  if (snap.tortilaLastOkAt !== null) return { tone: 'ok', label: 'journal: last check ok' };
  return { tone: 'neutral', label: 'journal: no checks (worker not run)' };
}

/**
 * Admin bot health page.
 *
 * Shows:
 * 1. Adapter mode + storage mode badges
 * 2. Safety-disabled states (DISABLED live control + BLOCKED legacy — hardcoded, non-dismissible)
 * 3. Tortila persistent P0/P1 warnings (non-dismissible — cleared only when journal reports resolution)
 * 4. Tortila journal health (last ok, last error, from integration_health_checks)
 * 5. Latest bot metric snapshot (walletEquityUsd, sourceAdapter, snapshotAt)
 * 6. Integration health checks table for bot.* targets
 * 7. Legacy adapter blocked card
 *
 * SECURITY: requireUser + assertAdmin. No exchange keys, no URLs, no stack traces rendered.
 * All data is read-only. No live-control buttons exist on this page (safety policy).
 */
export default async function AdminBotsPage() {
  const actor = await requireUser();
  assertAdmin(actor.roles);

  const snap = await loadAdminBotHealth();
  const journalPill = journalReadStatePill(snap);

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="Admin · bots"
        title="Bot fleet"
        copy="Cross-user bot health diagnostics. Live control is permanently DISABLED by safety policy. Legacy adapter is BLOCKED (plaintext-key issue unresolved). Tortila journal is read-only. No start/stop/applyConfig buttons exist on this page."
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
        <StatusPill tone="bad">LEGACY: BLOCKED</StatusPill>
        {snap.tortilaBaseUrlConfigured ? (
          <StatusPill tone="neutral">base URL: configured</StatusPill>
        ) : (
          <StatusPill tone="warn">base URL: not set</StatusPill>
        )}
        {/* PG2 read-state surfaced at the ops layer (derived from the last persisted health check). */}
        <StatusPill tone={journalPill.tone}>{journalPill.label}</StatusPill>
      </div>

      {/* Demo mode hint */}
      {snap.mode === 'demo' && (
        <RiskWarningBanner
          severity="warning"
          title="Demo mode — no Postgres"
          detail="No DATABASE_URL configured. Health checks and metric snapshots are not persisted. Connect Postgres and run the worker to see real data."
        />
      )}

      {/* Safety-disabled states — hardcoded, non-collapsible */}
      <Card title="Safety-disabled states (hardcoded policy)">
        <div className="wtc-stack" style={{ gap: 10 }}>
          <div className="wtc-row" style={{ gap: 10 }}>
            <StatusPill tone="bad">DISABLED</StatusPill>
            <span className="wtc-dim" style={{ fontSize: 13 }}>
              <strong style={{ color: 'var(--text)' }}>Live bot control</strong> —
              startBot / stopBot / applyConfig are hard-disabled. FEATURE_LIVE_BOT_CONTROL is not set.
              See <code className="wtc-mono" style={{ fontSize: 11 }}>docs/BOT_CONTROL_SAFETY_MODEL.md</code>.
            </span>
          </div>
          <div className="wtc-row" style={{ gap: 10 }}>
            <StatusPill tone="bad">BLOCKED</StatusPill>
            <span className="wtc-dim" style={{ fontSize: 13 }}>
              <strong style={{ color: 'var(--text)' }}>Legacy bot adapter</strong> —
              plaintext-key/service-account issue unresolved; adapter stays BLOCKED until service-account +
              vault gates are audited and approved. See{' '}
              <code className="wtc-mono" style={{ fontSize: 11 }}>docs/CONTRACTS/legacy-bot-adapter.md</code>.
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

      {/* Tortila P0/P1 warnings — non-dismissible, non-collapsible */}
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

      {/* Legacy adapter blocked card */}
      <Card title="Legacy bot status (bot.legacy)">
        <RiskWarningBanner
          severity="error"
          title="Legacy adapter BLOCKED — plaintext-key issue unresolved"
          detail="The legacy bot API (:8000) returns plaintext exchange keys in responses. This adapter must NOT be proxied through WTC until a service-account or encrypted-key solution is audited and approved. See docs/CONTRACTS/legacy-bot-adapter.md. All five security gates (service account, vault, firewall, key redaction, written security acceptance) remain NOT STARTED."
        />
        <div className="wtc-row" style={{ gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <MetricCard label="Adapter status" value="BLOCKED" tone="down" />
          <MetricCard label="Plaintext keys gate" value="NOT STARTED" tone="down" />
          <MetricCard label="Vault gate" value="NOT STARTED" />
        </div>
      </Card>

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
                      <StatusPill tone={hc.status === 'ok' || hc.status === 'healthy' ? 'ok' : 'bad'}>
                        {hc.status}
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
