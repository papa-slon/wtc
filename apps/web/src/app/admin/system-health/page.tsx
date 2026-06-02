import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { assertAdmin } from '@wtc/auth';
import { Card, SectionHeader, StatusPill, EmptyState, MetricCard, buttonClasses } from '@wtc/ui';
import { loadSystemHealth, loadManualReviewItems } from '@/features/admin/queries';
import {
  adminAcknowledgeLmsCleanupDeadLettersAction,
  adminRetryAcknowledgedLmsCleanupDeadLettersAction,
} from '@/features/admin/actions';
import { fmtDateTime } from '@/lib/format';
import { CsrfField } from '@/lib/csrf';

export default async function AdminSystemHealthPage() {
  const actor = await requireUser();
  assertAdmin(actor.roles);

  const snap = await loadSystemHealth();
  const { items: reviewItems, mode: reviewMode } = await loadManualReviewItems({ status: 'pending' });
  const workerFlagsUnsafe =
    snap.workerHealth.detail?.liveControlDisabled === false ||
    snap.workerHealth.detail?.tvAutomationDisabled === false;
  const workerHealthTone =
    snap.workerHealth.status === 'ok' && !snap.workerHealth.stale ? 'ok' : snap.workerHealth.status === 'error' ? 'bad' : 'warn';
  const lmsCleanupNeedsReview = snap.lmsObjectCleanup.deadLettered > 0;
  const lmsCleanupNeedsRetry = snap.lmsObjectCleanup.totalPending > 0;
  const lmsCleanupCanAcknowledge = snap.mode === 'postgres' && snap.lmsObjectCleanup.deadLetteredUnacknowledged > 0;
  const lmsCleanupCanRetry = snap.mode === 'postgres' && snap.lmsObjectCleanup.deadLetteredAcknowledged > 0;

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="Admin · system health"
        title="System health"
        copy="Backend mode, safety state, integration health checks, webhook reception log, and TradingView queue status. Worker writes integration_health_checks rows; they appear here when present."
      />

      {/* Backend mode */}
      <div className="wtc-row" style={{ marginTop: -4, flexWrap: 'wrap', gap: 8 }}>
        {snap.dbStatus === 'postgres' ? (
          <StatusPill tone="ok">storage: Postgres</StatusPill>
        ) : (
          <>
            <StatusPill tone="warn">storage: in-memory (demo)</StatusPill>
            <span className="wtc-dim" style={{ fontSize: 12 }}>
              No DATABASE_URL — demo mode. Real-PG status: NOT RUN / missing DATABASE_URL.
            </span>
          </>
        )}
      </div>

      <Card
        title="Worker heartbeat"
        action={
          snap.workerHealth.status ? (
            <StatusPill tone={workerHealthTone}>
              {snap.workerHealth.stale ? 'stale' : snap.workerHealth.status}
            </StatusPill>
          ) : (
            <StatusPill tone="warn">not recorded</StatusPill>
          )
        }
      >
        <div className="wtc-row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <MetricCard
            label="Latest tick"
            value={snap.workerHealth.latestAt ? fmtDateTime(snap.workerHealth.latestAt) : '—'}
            tone={snap.workerHealth.status === 'ok' && !snap.workerHealth.stale ? 'up' : undefined}
          />
          <MetricCard
            label="Safety state"
            value={workerFlagsUnsafe ? 'check flags' : 'disabled'}
            tone={workerFlagsUnsafe ? 'down' : 'up'}
          />
        </div>
        <p className="wtc-dim" style={{ fontSize: 12 }}>
          Latest <code className="wtc-mono">worker</code> row from <code className="wtc-mono">integration_health_checks</code>.
          Safe worker smoke: <code className="wtc-mono">npm run worker:smoke</code>.
        </p>
      </Card>

      <Card
        title="LMS upload cleanup review"
        action={
          lmsCleanupNeedsReview ? (
            <StatusPill tone="bad">{snap.lmsObjectCleanup.deadLettered} dead-lettered</StatusPill>
          ) : lmsCleanupNeedsRetry ? (
            <StatusPill tone="warn">{snap.lmsObjectCleanup.totalPending} pending</StatusPill>
          ) : (
            <StatusPill tone="ok">clear</StatusPill>
          )
        }
      >
        <div className="wtc-row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <MetricCard
            label="Dead-lettered"
            value={snap.lmsObjectCleanup.deadLettered}
            tone={snap.lmsObjectCleanup.deadLettered > 0 ? 'down' : 'up'}
          />
          <MetricCard
            label="Due retry"
            value={snap.lmsObjectCleanup.pendingDue}
            tone={snap.lmsObjectCleanup.pendingDue > 0 ? 'down' : undefined}
          />
          <MetricCard label="Scheduled retry" value={snap.lmsObjectCleanup.pendingScheduled} />
          <MetricCard
            label="Latest dead-letter"
            value={snap.lmsObjectCleanup.latestDeadLetteredAt ? fmtDateTime(snap.lmsObjectCleanup.latestDeadLetteredAt) : '—'}
          />
          <MetricCard
            label="Acknowledged"
            value={snap.lmsObjectCleanup.deadLetteredAcknowledged}
            tone={snap.lmsObjectCleanup.deadLetteredAcknowledged > 0 ? 'down' : undefined}
          />
        </div>
        <p className="wtc-dim" style={{ fontSize: 12 }}>
          Count-only review for private <code className="wtc-mono">lms_object_cleanup_tasks</code>. The admin surface
          hides cleanup task IDs, object keys, filenames, hashes, signed URLs, scanner details, and provider response bodies.
        </p>
        <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <form action={adminAcknowledgeLmsCleanupDeadLettersAction}>
            <CsrfField />
            <input type="hidden" name="operation" value="acknowledge_dead_letters" />
            <input type="hidden" name="expectedCount" value={snap.lmsObjectCleanup.deadLetteredUnacknowledged} />
            <input
              type="hidden"
              name="expectedLatestDeadLetteredAt"
              value={snap.lmsObjectCleanup.latestUnacknowledgedDeadLetteredAt ?? ''}
            />
            <button
              className={buttonClasses(lmsCleanupCanAcknowledge ? 'secondary' : 'ghost')}
              type="submit"
              disabled={!lmsCleanupCanAcknowledge}
              style={{ padding: '7px 12px' }}
            >
              Acknowledge reviewed
            </button>
          </form>
          <form action={adminRetryAcknowledgedLmsCleanupDeadLettersAction}>
            <CsrfField />
            <input type="hidden" name="operation" value="retry_acknowledged_dead_letters" />
            <input type="hidden" name="expectedCount" value={snap.lmsObjectCleanup.deadLetteredAcknowledged} />
            <input type="hidden" name="expectedLatestAcknowledgedAt" value={snap.lmsObjectCleanup.latestAcknowledgedAt ?? ''} />
            <button
              className={buttonClasses(lmsCleanupCanRetry ? 'secondary' : 'ghost')}
              type="submit"
              disabled={!lmsCleanupCanRetry}
              style={{ padding: '7px 12px' }}
            >
              Retry acknowledged
            </button>
          </form>
        </div>
        {snap.lmsObjectCleanup.latestAcknowledgedAt && (
          <p className="wtc-dim" style={{ fontSize: 12, marginTop: 8 }}>
            Latest acknowledgement: {fmtDateTime(snap.lmsObjectCleanup.latestAcknowledgedAt)}.
          </p>
        )}
        {snap.lmsObjectCleanup.latestDeadLetterErrorCode && (
          <p className="wtc-dim" style={{ fontSize: 12, marginTop: 8 }}>
            Latest generic error code: <code className="wtc-mono">{snap.lmsObjectCleanup.latestDeadLetterErrorCode}</code>.
            Dead-lettered rows require operator review before public upload rollout.
          </p>
        )}
        {snap.mode === 'demo' && (
          <p className="wtc-dim" style={{ fontSize: 12, marginTop: 8 }}>
            Demo mode - connect DATABASE_URL to review real cleanup state.
          </p>
        )}
      </Card>

      {/* Safety-disabled states — explicit truth, always visible */}
      <Card title="Safety-disabled states (policy)">
        <div className="wtc-stack" style={{ gap: 8 }}>
          <div className="wtc-row" style={{ gap: 10 }}>
            <StatusPill tone={snap.liveControlDisabled ? 'bad' : 'ok'}>
              {snap.liveControlDisabled ? 'DISABLED' : 'ENABLED'}
            </StatusPill>
            <span className="wtc-dim" style={{ fontSize: 13 }}>
              <strong style={{ color: 'var(--text)' }}>Live bot control</strong> — start/stop/applyConfig are
              policy-disabled until the adapter safety audit is approved. WTC never gates local terminal
              order execution.
            </span>
          </div>
          <div className="wtc-row" style={{ gap: 10 }}>
            <StatusPill tone={snap.tvAutomationDisabled ? 'bad' : 'ok'}>
              {snap.tvAutomationDisabled ? 'DISABLED' : 'ENABLED'}
            </StatusPill>
            <span className="wtc-dim" style={{ fontSize: 13 }}>
              <strong style={{ color: 'var(--text)' }}>TradingView automation</strong> — access grants are
              manual-only. No credential-stuffing or browser automation is active. Admins approve requests
              in the TradingView Queue.
            </span>
          </div>
        </div>
      </Card>

      {/* Webhook health */}
      <Card title="Billing webhook health (audit_logs)">
        <div className="wtc-row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <MetricCard
            label="Webhooks received"
            value={snap.webhookHealth.totalReceived}
            tone={snap.webhookHealth.totalReceived > 0 ? 'up' : undefined}
          />
          <MetricCard
            label="Latest received"
            value={snap.webhookHealth.latestAt ? fmtDateTime(snap.webhookHealth.latestAt) : '—'}
          />
        </div>
        <p className="wtc-dim" style={{ fontSize: 12 }}>
          Count and latest timestamp of{' '}
          <code className="wtc-mono">billing.webhook_received</code> entries in the audit log
          (last 200 events scanned). The audit row is written atomically with every entitlement
          transition; it is the idempotency ledger for Stripe events.
        </p>
      </Card>

      {/* Billing manual-review queue summary */}
      <Card
        title="Billing manual-review queue"
        action={
          reviewItems.length > 0 ? (
            <StatusPill tone="bad">{reviewItems.length} pending</StatusPill>
          ) : (
            <StatusPill tone="ok">0 pending</StatusPill>
          )
        }
      >
        <div className="wtc-row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <MetricCard
            label="Pending review items"
            value={reviewItems.length}
            tone={reviewItems.length > 0 ? 'down' : undefined}
          />
        </div>
        {reviewMode === 'demo' ? (
          <p className="wtc-dim" style={{ fontSize: 12 }}>
            Demo mode — connect DATABASE_URL to see billing manual-review items.
          </p>
        ) : reviewItems.length === 0 ? (
          <p className="wtc-dim" style={{ fontSize: 12 }}>
            No pending billing events require manual triage.
          </p>
        ) : (
          <p className="wtc-dim" style={{ fontSize: 12 }}>
            {reviewItems.length} billing event{reviewItems.length !== 1 ? 's require' : ' requires'} admin
            resolution (missing user ID, unknown plan, partial refund, etc.).{' '}
            <Link href="/admin/entitlements/review" className="wtc-link">Open review queue →</Link>
          </p>
        )}
      </Card>

      {/* TradingView queue health */}
      <Card title="TradingView queue health (tradingview_access_requests)">
        <div className="wtc-row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <MetricCard
            label="Pending"
            value={snap.tvQueueCounts.pending}
            tone={snap.tvQueueCounts.pending > 0 ? 'up' : undefined}
          />
          <MetricCard
            label="Active grants"
            value={snap.tvQueueCounts.granted}
            tone={snap.tvQueueCounts.granted > 0 ? 'up' : undefined}
          />
          <MetricCard label="Expired" value={snap.tvQueueCounts.expired} />
          <MetricCard label="Revoked" value={snap.tvQueueCounts.revoked} />
        </div>
        {snap.mode === 'demo' && (
          <p className="wtc-dim" style={{ fontSize: 12, marginTop: 8 }}>
            Demo mode — counts are always 0 without DATABASE_URL.
          </p>
        )}
      </Card>

      {/* Integration health checks */}
      <Card title="Integration health checks (integration_health_checks)">
        {snap.healthChecks.length === 0 ? (
          <EmptyState
            title="No health checks recorded yet"
            hint={
              snap.mode === 'demo'
                ? 'Demo mode — no DATABASE_URL configured. Connect Postgres and run the worker to see real checks.'
                : 'No checks recorded yet. The worker writes integration_health_checks rows on each sweep cycle. Run the worker to populate this table.'
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
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {snap.healthChecks.map((hc) => (
                  <tr key={hc.id}>
                    <td className="wtc-mono" data-label="Target">{hc.target}</td>
                    <td data-label="Status">
                      <StatusPill tone={hc.status === 'ok' || hc.status === 'healthy' ? 'ok' : hc.status === 'not_configured' ? 'warn' : 'bad'}>
                        {hc.status}
                      </StatusPill>
                    </td>
                    <td className="wtc-mono" data-label="Checked at" style={{ fontSize: 12 }}>
                      {new Date(hc.checkedAt).toISOString().replace('T', ' ').slice(0, 19)}
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
