import { requireUser } from '@/lib/session';
import { assertAdmin } from '@wtc/auth';
import { Card, SectionHeader, StatusPill, EmptyState, MetricCard, RiskWarningBanner, buttonClasses, type Tone } from '@wtc/ui';
import { fmtDate } from '@/lib/format';
import { CsrfField } from '@/lib/csrf';
import { loadTvAdminData } from '@/features/tv/queries';
import { enhancedGrantAction, enhancedRevokeAction, markTvTaskDoneAction } from '@/features/tv/actions';

function tone(s: string): Tone {
  return s === 'granted' ? 'ok' : s === 'pending' || s === 'expiring_soon' ? 'warn' : 'bad';
}

export default async function AdminTvPage() {
  const actor = await requireUser();
  assertAdmin(actor.roles);

  const { mode, rows, counts, grants, tasks } = await loadTvAdminData();

  const canGrant = (status: string) => status === 'pending' || status === 'expiring_soon';
  const expiringSoonCount = rows.filter((r) => r.status === 'expiring_soon').length;

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="Admin"
        title="TradingView access queue"
        copy="Manual grant/revoke only. Access is granted by an admin; TradingView has no automation. The worker sweep marks expiring/expired grants and queues revoke tasks — tasks are informational and unconsumed (no automation adapter is active by default)."
      />

      {/* Storage mode pill */}
      <div className="wtc-row" style={{ marginTop: -4 }}>
        {mode === 'postgres' ? (
          <StatusPill tone="ok">storage: Postgres</StatusPill>
        ) : (
          <>
            <StatusPill tone="warn">storage: in-memory (demo)</StatusPill>
            <span className="wtc-dim" style={{ fontSize: 12 }}>
              Dev fallback — the queue resets on restart. Set DATABASE_URL to persist to Postgres.
            </span>
          </>
        )}
      </div>

      {/* Summary counts */}
      <div className="wtc-row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <MetricCard label="Pending" value={counts.pending} tone={counts.pending > 0 ? 'up' : undefined} />
        <MetricCard label="Active" value={counts.active} tone={counts.active > 0 ? 'up' : undefined} />
        <MetricCard label="Revoked" value={counts.revoked} />
        <MetricCard label="Expired" value={counts.expired} />
      </div>

      {/* PG5: expiring-soon grants (<7 days). The worker sweep auto-revokes at expiry; surface them
          so an admin can re-grant before access drops. Driven by existing data — no new query. */}
      {expiringSoonCount > 0 && (
        <RiskWarningBanner
          severity="warning"
          title={`${expiringSoonCount} grant${expiringSoonCount === 1 ? '' : 's'} expiring soon (under 7 days)`}
          detail="These grants are inside the 7-day expiry window. The worker marks WTC access revoked at expiry and queues a manual TradingView-side revoke task (reason: expired_by_worker). Re-grant from the queue below to extend access."
        />
      )}

      {/* Request queue */}
      <Card title="Access request queue">
        {rows.length === 0 ? (
          <EmptyState title="Queue is empty" hint="No TradingView access requests yet." />
        ) : (
          <div className="wtc-table-wrap">
          <table className="wtc-table">
            <thead>
              <tr>
                <th>User</th>
                <th>TV username</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Granted</th>
                <th>Granted by</th>
                <th>Expires</th>
                <th>Revoked</th>
                <th>Revoked by</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="wtc-mono" data-label="User" style={{ fontSize: 12 }}>{r.userEmail}</td>
                  <td className="wtc-mono" data-label="TV username">{r.tradingViewUsername}</td>
                  <td data-label="Status">
                    <StatusPill tone={tone(r.status)}>{r.status.replace('_', ' ')}</StatusPill>
                  </td>
                  <td className="wtc-mono" data-label="Submitted">{fmtDate(r.requestedAt)}</td>
                  <td className="wtc-mono" data-label="Granted">{fmtDate(r.grantedAt ?? null)}</td>
                  <td className="wtc-mono" data-label="Granted by" style={{ fontSize: 11 }}>{r.grantedBy ?? '—'}</td>
                  <td className="wtc-mono" data-label="Expires">{fmtDate(r.expiresAt ?? null)}</td>
                  <td className="wtc-mono" data-label="Revoked">{fmtDate(r.revokedAt ?? null)}</td>
                  <td className="wtc-mono" data-label="Revoked by" style={{ fontSize: 11 }}>{r.revokedBy ?? '—'}</td>
                  <td className="wtc-td-action">
                    <div className="wtc-stack" style={{ gap: 8 }}>
                      {/* Grant form: only shown for pending/expiring_soon */}
                      {canGrant(r.status) && (
                        <form action={enhancedGrantAction} className="wtc-stack" style={{ gap: 6 }}>
                          <CsrfField />
                          <input type="hidden" name="requestId" value={r.id} />
                          <input
                            className="wtc-input"
                            name="reason"
                            placeholder="Reason for grant"
                            required
                            minLength={3}
                            maxLength={200}
                            style={{ fontSize: 12, padding: '3px 8px' }}
                          />
                          <select
                            className="wtc-input"
                            name="durationDays"
                            defaultValue="90"
                            style={{ fontSize: 12, padding: '3px 8px' }}
                          >
                            <option value="30">30 days</option>
                            <option value="90">90 days</option>
                            <option value="180">180 days</option>
                            <option value="365">365 days</option>
                          </select>
                          <button
                            className={buttonClasses('secondary')}
                            type="submit"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                          >
                            Grant access
                          </button>
                        </form>
                      )}

                      {/* Revoke form: shown for granted/expiring_soon */}
                      {(r.status === 'granted' || r.status === 'expiring_soon') && (
                        <form action={enhancedRevokeAction} className="wtc-stack" style={{ gap: 6 }}>
                          <CsrfField />
                          <input type="hidden" name="requestId" value={r.id} />
                          <input
                            className="wtc-input"
                            name="reason"
                            placeholder="Reason for revoke"
                            required
                            minLength={3}
                            maxLength={200}
                            style={{ fontSize: 12, padding: '3px 8px' }}
                          />
                          <button
                            className={buttonClasses('ghost')}
                            type="submit"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                          >
                            Revoke
                          </button>
                        </form>
                      )}

                      {/* No actions available for expired/revoked states */}
                      {(r.status === 'expired' || r.status === 'revoked') && (
                        <span className="wtc-dim" style={{ fontSize: 11 }}>No actions</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      {/* Grant history */}
      <Card title="Grant history (tradingview_access_grants)">
        <p className="wtc-dim" style={{ fontSize: 12, marginBottom: 10 }}>
          Records from the grant table. Populated when a grant action writes both the request status
          and the grant row. Revoke tasks in tradingview_access_tasks are informational and unconsumed
          (no automation adapter active by default).
        </p>
        {grants.length === 0 ? (
          <EmptyState title="No grants recorded yet" hint="Grant history appears here after the first manual grant via this admin panel." />
        ) : (
          <div className="wtc-table-wrap">
            <table className="wtc-table">
              <thead>
                <tr>
                  <th>TV username</th>
                  <th>Granted at</th>
                  <th>Expires</th>
                  <th>Granted by type</th>
                  <th>Revoked at</th>
                  <th>Revoke reason</th>
                </tr>
              </thead>
              <tbody>
                {grants.map((g) => (
                  <tr key={g.id}>
                    <td className="wtc-mono" data-label="TV username">{g.tvUsername}</td>
                    <td className="wtc-mono" data-label="Granted at">{fmtDate(g.grantedAt.getTime())}</td>
                    <td className="wtc-mono" data-label="Expires">{fmtDate(g.expiresAt?.getTime() ?? null)}</td>
                    <td className="wtc-mono" data-label="Granted by type">{g.grantedByType}</td>
                    <td className="wtc-mono" data-label="Revoked at">{fmtDate(g.revokedAt?.getTime() ?? null)}</td>
                    {/* Admin-only: revoke reason (incl. 'expired_by_worker' for auto-expiry). Never shown to users. */}
                    <td className="wtc-mono" data-label="Revoke reason" style={{ fontSize: 11 }}>{g.revokeReason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Manual TradingView tasks (${tasks.filter((t) => !t.done).length} open)`}>
        <p className="wtc-dim" style={{ fontSize: 12, marginBottom: 10 }}>
          WTC updates entitlement/request state itself. These rows track the external TradingView-side
          human work, such as removing a user from a private indicator after expiry. No automation
          adapter is active here.
        </p>
        {tasks.length === 0 ? (
          <EmptyState title="No manual TV tasks" hint="Expiry/revoke tasks appear here when the worker queues them." />
        ) : (
          <div className="wtc-table-wrap">
            <table className="wtc-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>User</th>
                  <th>TV username</th>
                  <th>Request state</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td data-label="Task" className="wtc-mono">{task.kind}</td>
                    <td data-label="User" className="wtc-mono" style={{ fontSize: 12 }}>{task.userEmail}</td>
                    <td data-label="TV username" className="wtc-mono">{task.tradingViewUsername}</td>
                    <td data-label="Request state"><StatusPill tone={tone(task.requestStatus)}>{task.requestStatus.replace('_', ' ')}</StatusPill></td>
                    <td data-label="Created" className="wtc-mono">{fmtDate(task.createdAt.getTime())}</td>
                    <td data-label="Status"><StatusPill tone={task.done ? 'ok' : 'warn'}>{task.done ? 'done' : 'open'}</StatusPill></td>
                    <td data-label="Action" className="wtc-td-action">
                      {task.done ? (
                        <span className="wtc-dim" style={{ fontSize: 11 }}>Completed</span>
                      ) : (
                        <form action={markTvTaskDoneAction}>
                          <CsrfField />
                          <input type="hidden" name="taskId" value={task.id} />
                          <button className={buttonClasses('secondary')} type="submit">Mark done</button>
                        </form>
                      )}
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
