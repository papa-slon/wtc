import type { CSSProperties } from 'react';
import { requireUser } from '@/lib/session';
import { assertAdmin } from '@wtc/auth';
import { Card, SectionHeader, StatusPill, EmptyState, buttonClasses } from '@wtc/ui';
import { CsrfField } from '@/lib/csrf';
import { loadAdminSupport } from '@/features/admin/queries';
import { adminUpdateTicketAction } from '@/features/admin/actions';
import { fmtDate } from '@/lib/format';

/** Ticket status values (mirrors support_tickets.status in schema). */
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;

function ticketStatusTone(status: string): 'ok' | 'warn' | 'bad' | 'neutral' {
  switch (status) {
    case 'resolved':
    case 'closed':
      return 'ok';
    case 'in_progress':
      return 'warn';
    case 'open':
      return 'bad';
    default:
      return 'neutral';
  }
}

function priorityTone(priority: string): 'ok' | 'warn' | 'bad' | 'neutral' {
  switch (priority) {
    case 'urgent':
      return 'bad';
    case 'high':
      return 'warn';
    case 'normal':
    case 'low':
    default:
      return 'neutral';
  }
}

/** Status-filter chip styling — a real 44px tap target on mobile (PG8 / §F-10), not a bare text link. */
function filterChipStyle(active: boolean): CSSProperties {
  return {
    fontSize: 12,
    padding: '8px 12px',
    minHeight: 44,
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    border: `1px solid ${active ? 'var(--stroke-gold)' : 'var(--stroke)'}`,
    color: active ? 'var(--gold2)' : 'var(--muted)',
    background: active ? 'rgba(213,169,79,0.08)' : 'transparent',
  };
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireUser();
  assertAdmin(actor.roles);

  // Status filter from query string (optional)
  const sp = searchParams ? await searchParams : {};
  const rawStatus = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const statusFilter = rawStatus && STATUSES.includes(rawStatus as (typeof STATUSES)[number])
    ? rawStatus
    : undefined;

  const { mode, tickets } = await loadAdminSupport({ status: statusFilter });

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="Admin · support"
        title="Support ticket triage"
        copy="Admin view of all support tickets. Update ticket status to route and resolve issues. Every status change is audited."
      />

      {/* Storage mode pill */}
      <div className="wtc-row" style={{ marginTop: -4 }}>
        {mode === 'postgres' ? (
          <StatusPill tone="ok">storage: Postgres</StatusPill>
        ) : (
          <>
            <StatusPill tone="warn">storage: in-memory (demo)</StatusPill>
            <span className="wtc-dim" style={{ fontSize: 12 }}>
              Dev fallback — data resets on restart. Set DATABASE_URL to persist to Postgres.
            </span>
          </>
        )}
      </div>

      {/* Status filter chips (44px tap targets on mobile) */}
      <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span className="wtc-dim" style={{ fontSize: 12 }}>Filter by status:</span>
        <a href="/admin/support" className="wtc-mono" style={filterChipStyle(!statusFilter)}>
          all
        </a>
        {STATUSES.map((s) => (
          <a
            key={s}
            href={`/admin/support?status=${s}`}
            className="wtc-mono"
            style={filterChipStyle(statusFilter === s)}
          >
            {s.replace('_', ' ')}
          </a>
        ))}
      </div>

      {/* Ticket list */}
      <Card
        title={`Tickets${statusFilter ? ` — ${statusFilter.replace('_', ' ')}` : ''} (${tickets.length})`}
      >
        {tickets.length === 0 ? (
          <EmptyState
            title="No tickets"
            hint={
              mode === 'demo'
                ? 'Demo mode — no DATABASE_URL configured. Tickets created by users appear here when Postgres is connected.'
                : statusFilter
                ? `No ${statusFilter.replace('_', ' ')} tickets.`
                : 'No support tickets submitted yet.'
            }
          />
        ) : (
          <div className="wtc-stack" style={{ gap: 16 }}>
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="wtc-card"
                style={{ background: 'var(--panel2)', borderColor: 'var(--stroke)', padding: 16 }}
              >
                <div className="wtc-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <div className="wtc-row" style={{ gap: 8 }}>
                    <StatusPill tone={ticketStatusTone(ticket.status)}>
                      {ticket.status.replace('_', ' ')}
                    </StatusPill>
                    <StatusPill tone={priorityTone(ticket.priority)}>
                      {ticket.priority}
                    </StatusPill>
                    {ticket.productCode && (
                      <StatusPill tone="neutral">{ticket.productCode}</StatusPill>
                    )}
                  </div>
                  <span className="wtc-mono wtc-dim" style={{ fontSize: 11 }}>
                    {fmtDate(ticket.createdAt)}
                    {ticket.resolvedAt ? ` → resolved ${fmtDate(ticket.resolvedAt)}` : ''}
                  </span>
                </div>

                <h4 style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--text)' }}>
                  {ticket.subject}
                </h4>
                <p
                  className="wtc-dim"
                  style={{ fontSize: 13, margin: '0 0 12px', whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'hidden' }}
                >
                  {ticket.body}
                </p>

                <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                  <span className="wtc-dim">
                    User: <span className="wtc-mono">{ticket.userId.slice(0, 18)}&hellip;</span>
                  </span>
                  {ticket.assignedTo && (
                    <span className="wtc-dim">
                      Assigned: <span className="wtc-mono">{ticket.assignedTo.slice(0, 18)}&hellip;</span>
                    </span>
                  )}
                </div>

                {/* Status update form — admin triage */}
                {ticket.status !== 'closed' && (
                  <form
                    action={adminUpdateTicketAction}
                    className="wtc-row"
                    style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}
                  >
                    <CsrfField />
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <select
                      className="wtc-input"
                      name="status"
                      defaultValue={ticket.status}
                      style={{ fontSize: 12, padding: '3px 8px', minWidth: 140 }}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                    <button
                      className={buttonClasses('secondary')}
                      type="submit"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                    >
                      Update status
                    </button>
                  </form>
                )}

                {ticket.status === 'closed' && (
                  <p className="wtc-dim" style={{ fontSize: 11, marginTop: 8 }}>
                    Ticket is closed — no further actions available.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
