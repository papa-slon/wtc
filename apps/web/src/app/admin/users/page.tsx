import { requireUser } from '@/lib/session';
import { assertAdmin } from '@wtc/auth';
import { Card, SectionHeader, StatusPill, EmptyState, buttonClasses } from '@wtc/ui';
import { loadAdminUsers } from '@/features/admin/queries';
import { fmtDate } from '@/lib/format';
import { CsrfField } from '@/lib/csrf';
import { adminUnlockAccountAction } from '@/features/admin/actions';

type AdminUserRow = Awaited<ReturnType<typeof loadAdminUsers>>['users'][number];

function accountStateLabel(user: AdminUserRow): string {
  if (user.lockout.isLocked && user.lockout.accountLockedUntil !== null) return `Locked until ${fmtDate(user.lockout.accountLockedUntil)}`;
  if (user.lockout.requiresReview) return 'Review required';
  if (user.lockout.failedLoginTotalCount > 0) return 'Recent failures';
  return 'No lockout';
}

export default async function AdminUsersPage() {
  const actor = await requireUser();
  assertAdmin(actor.roles);

  const { mode, users } = await loadAdminUsers();

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="Admin"
        title="User directory"
        copy="Registered users and account-security state. Role mutation is not available in this MVP."
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

      {/* Read-only notice */}
      <div
        className="wtc-warning info"
        role="status"
        style={{ marginBottom: 4 }}
      >
        <span aria-hidden style={{ fontWeight: 800 }}>i</span>
        <div>
          <div className="w-title">Limited admin controls</div>
          <div className="w-detail">
            Role assignment and account suspension are not available here. Admins can clear login lockout state with an
            audited reason; public login copy remains generic.
          </div>
        </div>
      </div>

      <Card title={`Users (${users.length})`}>
        {users.length === 0 ? (
          <EmptyState
            title="No users yet"
            hint={
              mode === 'demo'
                ? 'No DATABASE_URL configured — demo mode shows no users. Connect Postgres to see the real user list.'
                : 'No registered users found.'
            }
          />
        ) : (
          <div className="wtc-table-wrap">
            <table className="wtc-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Display name</th>
                  <th>Roles</th>
                  <th>Account state</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="wtc-mono" data-label="Email" style={{ fontSize: 13 }}>{u.email}</td>
                    <td data-label="Display name">{u.displayName}</td>
                    <td data-label="Roles">
                      <div className="wtc-row" style={{ gap: 4, flexWrap: 'wrap' }}>
                        {u.roles.map((r) => (
                          <StatusPill key={r} tone={r === 'admin' ? 'bad' : r === 'teacher' ? 'warn' : 'neutral'}>
                            {r}
                          </StatusPill>
                        ))}
                      </div>
                    </td>
                    <td data-label="Account state">
                      <div className="wtc-stack" style={{ gap: 4 }}>
                        <StatusPill tone={u.lockout.isLocked ? 'bad' : u.lockout.requiresReview ? 'warn' : 'neutral'}>
                          {accountStateLabel(u)}
                        </StatusPill>
                        {u.lockout.lastFailedLoginAt !== null ? (
                          <span className="wtc-dim" style={{ fontSize: 11 }}>
                            Total failures: {u.lockout.failedLoginTotalCount}; last failed {fmtDate(u.lockout.lastFailedLoginAt)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="wtc-mono" data-label="Registered" style={{ fontSize: 12 }}>
                      {u.createdAt ? fmtDate(u.createdAt) : '—'}
                    </td>
                    <td className="wtc-td-action" data-label="Actions">
                      {u.lockout.unlockable ? (
                        <form action={adminUnlockAccountAction} className="wtc-stack" style={{ gap: 6 }}>
                          <CsrfField />
                          <input type="hidden" name="userId" value={u.id} />
                          <input
                            className="wtc-input"
                            name="reason"
                            placeholder="Unlock reason"
                            required
                            minLength={10}
                            maxLength={500}
                            style={{ fontSize: 12, padding: '4px 8px', minWidth: 180, maxWidth: 260 }}
                          />
                          <button className={buttonClasses('secondary')} type="submit" style={{ padding: '5px 10px', fontSize: 12 }}>
                            Clear lockout
                          </button>
                        </form>
                      ) : (
                        <span className="wtc-dim" style={{ fontSize: 12 }}>No unlock action</span>
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
