import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { assertAdmin } from '@wtc/auth';
import { listUsers, entitlementsOf } from '@/lib/backend';
import { PRODUCT_CODES, PRODUCTS, evaluateStatus, type ProductCode } from '@wtc/entitlements';
import { Card, SectionHeader, StatusPill, EmptyState, buttonClasses, type Tone } from '@wtc/ui';
import { CsrfField } from '@/lib/csrf';
import { loadAdminTimeline } from '@/features/billing/timeline';
import { adminGrantProductAction, adminRevokeProductAction, adminFlagReviewAction } from '@/features/admin/actions';
import { loadManualReviewItems } from '@/features/admin/queries';
import { fmtDate } from '@/lib/format';
import { getServerDb } from '@/lib/backend';

function tone(s: string): Tone {
  return s === 'active' ? 'ok' : s === 'grace' ? 'warn' : 'bad';
}

export default async function AdminEntitlementsPage() {
  const actor = await requireUser();
  assertAdmin(actor.roles);

  const db = getServerDb();
  const mode = db ? 'postgres' : 'demo';

  const users = await listUsers();
  const now = Date.now();
  const rows = await Promise.all(users.map(async (u) => ({ u, ents: await entitlementsOf(u.id) })));

  // Load admin product-access timeline entries for all users (capped at 100 per user in loadAdminTimeline)
  const timelines = await Promise.all(
    rows.map(async ({ u }) => {
      const result = await loadAdminTimeline(u.id, { limit: 20 });
      return { userId: u.id, ...result };
    }),
  );
  const timelineByUser = Object.fromEntries(timelines.map((t) => [t.userId, t.entries]));

  // Load pending manual-review items (F-07)
  const { items: reviewItems, mode: reviewMode } = await loadManualReviewItems({ status: 'pending' });

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="Admin"
        title="Entitlements"
        copy="Manual grant/revoke takes precedence over billing and is always audited. Entitlements are the single source of access truth. Every grant requires a reason; validUntil is optional (sets a hard expiry on the entitlement)."
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

      {/* Billing manual-review queue (F-07) — shown above per-user cards */}
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
        {reviewMode === 'demo' ? (
          <p className="wtc-dim" style={{ fontSize: 12 }}>
            Demo mode — connect DATABASE_URL to view the billing manual-review queue.{' '}
            <Link href="/admin/entitlements/review" className="wtc-link">Open review queue</Link>
          </p>
        ) : reviewItems.length === 0 ? (
          <p className="wtc-dim" style={{ fontSize: 12 }}>
            No pending items. Unresolvable billing events (missing user ID, unknown plan code, etc.)
            appear here for admin triage.{' '}
            <Link href="/admin/entitlements/review" className="wtc-link">Open review queue</Link>
          </p>
        ) : (
          <div className="wtc-stack" style={{ gap: 8 }}>
            <p className="wtc-dim" style={{ fontSize: 12, marginBottom: 4 }}>
              {reviewItems.length} billing event{reviewItems.length !== 1 ? 's' : ''} require manual
              resolution. Open the full review queue to approve, reject, or dismiss each item.
            </p>
            <div className="wtc-table-wrap">
              <table className="wtc-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Event type</th>
                    <th>Reason</th>
                    <th>Created</th>
                    <th>User ID</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {reviewItems.slice(0, 5).map((item) => (
                    <tr key={item.id}>
                      <td className="wtc-mono" data-label="Provider">{item.provider}</td>
                      <td className="wtc-mono" data-label="Event type">{item.eventType}</td>
                      <td className="wtc-dim" data-label="Reason">{item.reason.replace(/_/g, ' ')}</td>
                      <td className="wtc-mono" data-label="Created">{new Date(item.createdAt).toISOString().replace('T', ' ').slice(0, 16)}</td>
                      <td className="wtc-mono" data-label="User ID">{item.userId ? `${item.userId.slice(0, 12)}…` : '—'}</td>
                      <td data-label="Action">
                        <Link href="/admin/entitlements/review" className="wtc-link" style={{ fontSize: 11 }}>
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {reviewItems.length > 5 && (
              <p className="wtc-dim" style={{ fontSize: 11, marginTop: 4 }}>
                Showing 5 of {reviewItems.length}.{' '}
                <Link href="/admin/entitlements/review" className="wtc-link">View all</Link>
              </p>
            )}
            <div style={{ marginTop: 8 }}>
              <Link href="/admin/entitlements/review" className={buttonClasses('secondary')}>
                Open review queue
              </Link>
            </div>
          </div>
        )}
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="No users" hint="No registered users found." />
      ) : (
        rows.map(({ u, ents }) => {
          const userTimeline = timelineByUser[u.id] ?? [];
          return (
            <Card key={u.id} title={`${u.displayName} · ${u.email}`}>
              {/* Current entitlements */}
              <div className="wtc-row" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
                {ents.length === 0 ? (
                  <span className="wtc-dim">No entitlements</span>
                ) : (
                  ents.map((e, i) => {
                    const eff = evaluateStatus(e, now);
                    const isManualReview = eff === 'manual_review';
                    return (
                      <div key={i} className="wtc-stack" style={{ gap: 4, background: 'var(--panel2)', borderRadius: 8, padding: '8px 10px' }}>
                        <div className="wtc-row" style={{ gap: 6 }}>
                          <StatusPill tone={tone(eff)}>
                            {PRODUCTS[e.productCode as ProductCode]?.name ?? e.productCode}: {eff}
                          </StatusPill>
                        </div>
                        {isManualReview ? (
                          /* manual_review state: show Approve + Reject links to review queue */
                          <div className="wtc-row" style={{ gap: 6 }}>
                            <span className="wtc-dim" style={{ fontSize: 11 }}>
                              This entitlement is in manual review.{' '}
                              <Link href="/admin/entitlements/review" className="wtc-link">Approve or Reject</Link>
                            </span>
                          </div>
                        ) : (
                          /* Normal state: show Revoke + Flag for review */
                          <div className="wtc-stack" style={{ gap: 4 }}>
                            <form action={adminRevokeProductAction} className="wtc-row" style={{ gap: 4 }}>
                              <CsrfField />
                              <input type="hidden" name="userId" value={u.id} />
                              <input type="hidden" name="product" value={e.productCode} />
                              <input
                                className="wtc-input"
                                name="reason"
                                placeholder="Reason for revoke (required)"
                                required
                                minLength={3}
                                maxLength={500}
                                style={{ fontSize: 12, padding: '3px 8px', minWidth: 200 }}
                              />
                              <button
                                className={buttonClasses('ghost')}
                                style={{ padding: '4px 10px', fontSize: 12 }}
                                type="submit"
                              >
                                Revoke
                              </button>
                            </form>
                            <form action={adminFlagReviewAction} className="wtc-row" style={{ gap: 4 }}>
                              <CsrfField />
                              <input type="hidden" name="userId" value={u.id} />
                              <input type="hidden" name="product" value={e.productCode} />
                              <input
                                className="wtc-input"
                                name="reason"
                                placeholder="Reason to flag for review"
                                required
                                minLength={3}
                                maxLength={500}
                                style={{ fontSize: 11, padding: '2px 6px', minWidth: 180 }}
                              />
                              <button
                                className={buttonClasses('ghost')}
                                style={{ padding: '3px 8px', fontSize: 11, opacity: 0.7 }}
                                type="submit"
                              >
                                Flag review
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Grant form — now includes reason (required) + validUntil (optional) */}
              <form action={adminGrantProductAction} className="wtc-stack" style={{ gap: 8, background: 'var(--panel2)', borderRadius: 8, padding: 12 }}>
                <CsrfField />
                <input type="hidden" name="userId" value={u.id} />
                <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <select className="wtc-input" name="product" style={{ maxWidth: 220, fontSize: 13 }}>
                    {PRODUCT_CODES.map((c) => (
                      <option key={c} value={c}>
                        {PRODUCTS[c].name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="wtc-input"
                    name="reason"
                    placeholder="Reason for grant (required)"
                    required
                    minLength={3}
                    maxLength={500}
                    style={{ fontSize: 12, padding: '4px 8px', minWidth: 200, flex: 1 }}
                  />
                  <div className="wtc-stack" style={{ gap: 2 }}>
                    <label className="wtc-dim" style={{ fontSize: 11 }}>Valid until (optional)</label>
                    <input
                      className="wtc-input"
                      type="date"
                      name="validUntil"
                      min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
                      style={{ fontSize: 12, padding: '3px 8px' }}
                    />
                  </div>
                  <button className={buttonClasses('secondary')} type="submit">
                    Grant
                  </button>
                </div>
                <p className="wtc-dim" style={{ fontSize: 11 }}>
                  Reason is stored in the audit log. Valid until sets a hard entitlement expiry
                  (leave blank for indefinite access — still subject to billing state machine).
                </p>
              </form>

              {/* Product-access timeline */}
              {userTimeline.length > 0 && (
                <details style={{ marginTop: 14 }}>
                  <summary
                    className="wtc-dim"
                    style={{ fontSize: 12, cursor: 'pointer', userSelect: 'none', marginBottom: 6 }}
                  >
                    Product-access timeline ({userTimeline.length} event{userTimeline.length !== 1 ? 's' : ''})
                  </summary>
                  <div className="wtc-table-wrap">
                    <table className="wtc-table" style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Product</th>
                          <th>From</th>
                          <th>To</th>
                          <th>Reason</th>
                          <th>Actor</th>
                          <th>Actor type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userTimeline.map((entry) => (
                          <tr key={entry.id}>
                            <td className="wtc-mono" data-label="Date">{fmtDate(entry.createdAt)}</td>
                            <td className="wtc-mono" data-label="Product" style={{ fontSize: 11 }}>{entry.productCode}</td>
                            <td data-label="From">
                              <StatusPill tone={tone(entry.fromState)}>{entry.fromState}</StatusPill>
                            </td>
                            <td data-label="To">
                              <StatusPill tone={tone(entry.toState)}>{entry.toState}</StatusPill>
                            </td>
                            <td className="wtc-dim" data-label="Reason" style={{ fontSize: 11 }}>{entry.reason ?? '—'}</td>
                            <td className="wtc-mono" data-label="Actor" style={{ fontSize: 11 }}>
                              {entry.actorId ? `${entry.actorId.slice(0, 12)}…` : '—'}
                            </td>
                            <td className="wtc-dim" data-label="Actor type" style={{ fontSize: 11 }}>{entry.actorType}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
