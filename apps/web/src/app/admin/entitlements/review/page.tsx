import { requireUser } from '@/lib/session';
import { assertAdmin } from '@wtc/auth';
import { Card, SectionHeader, StatusPill, EmptyState, buttonClasses } from '@wtc/ui';
import { CsrfField } from '@/lib/csrf';
import { loadManualReviewItems } from '@/features/admin/queries';
import {
  adminApproveReviewAction,
  adminRejectOrDismissReviewAction,
} from '@/features/admin/actions';
import { PRODUCT_CODES, PRODUCTS } from '@wtc/entitlements';
import { fmtDateTime } from '@/lib/format';

/**
 * Admin billing manual-review queue.
 * Lists pending billing_manual_review_items with Approve / Reject / Dismiss actions.
 *
 * Security: requireUser → assertAdmin — every action in this page also enforces
 * assertAdmin + assertCsrf + Zod + in-txn audit (see features/admin/actions.ts).
 *
 * eventSnapshot is shown only for non-secret, non-PII fields (id, type, planCode).
 * Raw Stripe body and signature are NEVER stored or rendered here.
 */
export default async function AdminManualReviewPage() {
  const actor = await requireUser();
  assertAdmin(actor.roles);

  const { mode, items } = await loadManualReviewItems({ status: 'pending' });

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="Admin · entitlements"
        title="Billing manual-review queue"
        copy="Webhook events that could not be automatically applied (missing user ID, unknown plan code, partial refund, etc.). Approve to grant access, Reject to record a rejection, or Dismiss to mark as a no-op. Every action is audited."
      />

      {/* Storage mode pill */}
      <div className="wtc-row" style={{ marginTop: -4 }}>
        {mode === 'postgres' ? (
          <StatusPill tone="ok">storage: Postgres</StatusPill>
        ) : (
          <>
            <StatusPill tone="warn">storage: in-memory (demo)</StatusPill>
            <span className="wtc-dim" style={{ fontSize: 12 }}>
              Connect DATABASE_URL to view and manage the billing review queue.
            </span>
          </>
        )}
      </div>

      {mode === 'demo' ? (
        <EmptyState
          title="Demo mode — no review items"
          hint="Connect DATABASE_URL to see real billing manual-review items."
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No pending items"
          hint="All billing events have been resolved. Pending items appear here when a webhook event cannot be automatically applied."
        />
      ) : (
        items.map((item) => (
          <Card
            key={item.id}
            title={`Review item — ${item.reason.replace(/_/g, ' ')}`}
            action={
              <StatusPill tone="warn">pending</StatusPill>
            }
          >
            {/* Item metadata */}
            <div className="wtc-stack" style={{ gap: 6, marginBottom: 14 }}>
              <div className="wtc-row" style={{ gap: 16, flexWrap: 'wrap' }}>
                <span className="wtc-dim" style={{ fontSize: 12 }}>
                  Provider: <span className="wtc-mono" style={{ color: 'var(--text)' }}>{item.provider}</span>
                </span>
                <span className="wtc-dim" style={{ fontSize: 12 }}>
                  Event ID: <span className="wtc-mono" style={{ color: 'var(--text)' }}>{item.eventId}</span>
                </span>
                <span className="wtc-dim" style={{ fontSize: 12 }}>
                  Event type: <span className="wtc-mono" style={{ color: 'var(--text)' }}>{item.eventType}</span>
                </span>
                <span className="wtc-dim" style={{ fontSize: 12 }}>
                  Created: <span className="wtc-mono" style={{ color: 'var(--text)' }}>{fmtDateTime(item.createdAt)}</span>
                </span>
                {item.userId && (
                  <span className="wtc-dim" style={{ fontSize: 12 }}>
                    User ID: <span className="wtc-mono" style={{ color: 'var(--text)' }}>{item.userId.slice(0, 16)}…</span>
                  </span>
                )}
              </div>

              {/* Event snapshot — non-secret fields only */}
              <details style={{ marginTop: 6 }}>
                <summary className="wtc-dim" style={{ fontSize: 12, cursor: 'pointer', userSelect: 'none' }}>
                  Event snapshot (non-secret fields only)
                </summary>
                {/* eventSnapshot is allowlisted to { id, type, planCode } in loadManualReviewItems
                    (features/admin/queries.ts, pickSafeSnapshot) — defence-in-depth so no PII or
                    raw-payload field can ever surface here even if a future writer stores one. */}
                <pre
                  className="wtc-mono"
                  style={{
                    fontSize: 11,
                    background: 'var(--bg)',
                    border: '1px solid var(--stroke)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    marginTop: 6,
                    overflowX: 'auto',
                    maxHeight: 200,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {JSON.stringify(item.eventSnapshot, null, 2)}
                </pre>
              </details>
            </div>

            {/* Action forms */}
            <div className="wtc-stack" style={{ gap: 10 }}>
              {/* Approve form */}
              <form
                action={adminApproveReviewAction}
                className="wtc-stack"
                style={{ gap: 8, background: 'var(--panel2)', borderRadius: 8, padding: 12 }}
              >
                <CsrfField />
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="resolution" value="approved" />
                <div className="wtc-dim" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  Approve — grant access
                </div>
                <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <div className="wtc-stack" style={{ gap: 2 }}>
                    <label className="wtc-dim" style={{ fontSize: 11 }}>User ID (for grant)</label>
                    <input
                      className="wtc-input"
                      name="approvalUserId"
                      defaultValue={item.userId ?? ''}
                      placeholder="UUID of user to grant (if known)"
                      style={{ fontSize: 12, padding: '3px 8px', minWidth: 280 }}
                    />
                  </div>
                  <div className="wtc-stack" style={{ gap: 2 }}>
                    <label className="wtc-dim" style={{ fontSize: 11 }}>Products (comma-separated)</label>
                    <select
                      className="wtc-input"
                      name="approvalProductCodes"
                      style={{ fontSize: 12, padding: '3px 8px', minWidth: 200 }}
                    >
                      <option value="">Select product</option>
                      {PRODUCT_CODES.map((c) => (
                        <option key={c} value={c}>
                          {PRODUCTS[c].name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <input
                    className="wtc-input"
                    name="resolutionNote"
                    placeholder="Resolution note (required, min 3 chars)"
                    required
                    minLength={3}
                    maxLength={1000}
                    style={{ fontSize: 12, padding: '4px 8px', flex: 1, minWidth: 200 }}
                  />
                  <button
                    className={buttonClasses('secondary')}
                    type="submit"
                    style={{ padding: '6px 14px' }}
                  >
                    Approve
                  </button>
                </div>
                <p className="wtc-dim" style={{ fontSize: 11 }}>
                  Approval is audited. If user ID and product are provided, access will be granted to the user.
                  Ambiguous events without a known user must be manually resolved — never auto-granted.
                </p>
              </form>

              {/* Reject form */}
              <form
                action={adminRejectOrDismissReviewAction}
                className="wtc-row"
                style={{ gap: 8, flexWrap: 'wrap', background: 'var(--panel2)', borderRadius: 8, padding: 12 }}
              >
                <CsrfField />
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="resolution" value="rejected" />
                <div className="wtc-dim" style={{ fontSize: 12, fontWeight: 700, minWidth: '100%', marginBottom: 2 }}>
                  Reject — record rejection, no access granted
                </div>
                <input
                  className="wtc-input"
                  name="resolutionNote"
                  placeholder="Reason for rejection (required)"
                  required
                  minLength={3}
                  maxLength={1000}
                  style={{ fontSize: 12, padding: '4px 8px', flex: 1, minWidth: 200 }}
                />
                <button
                  className={buttonClasses('ghost')}
                  type="submit"
                  style={{
                    padding: '6px 14px',
                    color: 'var(--red)',
                    borderColor: 'rgba(255,107,116,.3)',
                  }}
                >
                  Reject
                </button>
              </form>

              {/* Dismiss form */}
              <form
                action={adminRejectOrDismissReviewAction}
                className="wtc-row"
                style={{ gap: 8, flexWrap: 'wrap', background: 'var(--panel2)', borderRadius: 8, padding: 12 }}
              >
                <CsrfField />
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="resolution" value="dismissed" />
                <div className="wtc-dim" style={{ fontSize: 12, fontWeight: 700, minWidth: '100%', marginBottom: 2 }}>
                  Dismiss — no-op, mark as resolved without any access change
                </div>
                <input
                  className="wtc-input"
                  name="resolutionNote"
                  placeholder="Note for dismissal (required, e.g. 'test event')"
                  required
                  minLength={3}
                  maxLength={1000}
                  style={{ fontSize: 12, padding: '4px 8px', flex: 1, minWidth: 200 }}
                />
                <button
                  className={buttonClasses('ghost')}
                  type="submit"
                  style={{ padding: '6px 14px' }}
                >
                  Dismiss
                </button>
              </form>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
