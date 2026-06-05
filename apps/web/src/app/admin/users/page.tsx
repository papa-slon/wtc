import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { assertAdmin } from '@wtc/auth';
import { Card, SectionHeader, StatusPill, EmptyState, buttonClasses, type Tone } from '@wtc/ui';
import { loadAdminBotHealth, loadAdminUsers } from '@/features/admin/queries';
import { fmtDate, fmtDateTime, fmtMoney, fmtNum } from '@/lib/format';
import { CsrfField } from '@/lib/csrf';
import { adminUnlockAccountAction } from '@/features/admin/actions';

type AdminUserRow = Awaited<ReturnType<typeof loadAdminUsers>>['users'][number];
type AdminBotHealth = Awaited<ReturnType<typeof loadAdminBotHealth>>;

type BotOwnerSelectorRow = {
  id: string;
  userId: string | null;
  userLabel: string;
  email: string;
  product: string;
  identity: string;
  runtime: string;
  statistics: string;
  latestAt: number | null;
  href: string;
  action: string;
  tone: Tone;
  searchText: string;
};

function accountStateLabel(user: AdminUserRow): string {
  if (user.lockout.isLocked && user.lockout.accountLockedUntil !== null) return `Locked until ${fmtDate(user.lockout.accountLockedUntil)}`;
  if (user.lockout.requiresReview) return 'Review required';
  if (user.lockout.failedLoginTotalCount > 0) return 'Recent failures';
  return 'No lockout';
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function normalizedQuery(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 120);
}

function searchable(...values: Array<string | number | null | undefined>): string {
  return values.filter((value) => value !== null && value !== undefined).join(' ').toLowerCase();
}

function rowMatches(row: BotOwnerSelectorRow, query: string): boolean {
  if (!query) return true;
  const tokens = query.toLowerCase().split(' ').filter(Boolean);
  return tokens.every((token) => row.searchText.includes(token));
}

function buildBotOwnerSelectorRows(users: AdminUserRow[], health: AdminBotHealth): BotOwnerSelectorRow[] {
  const userRows: BotOwnerSelectorRow[] = users.map((user) => ({
    id: `user:${user.id}`,
    userId: user.id,
    userLabel: user.displayName,
    email: user.email,
    product: 'All bots',
    identity: `User ID ${user.id}`,
    runtime: accountStateLabel(user),
    statistics: 'open selected-user bot view',
    latestAt: user.createdAt,
    href: `/admin/users/${user.id}/bots`,
    action: 'Open read-only bot view',
    tone: user.lockout.isLocked || user.lockout.requiresReview ? 'warn' : 'neutral',
    searchText: searchable(user.displayName, user.email, user.id, 'all bots', 'user directory'),
  }));

  const tortilaRows: BotOwnerSelectorRow[] = health.tortilaFleetSnapshots.map((snapshot) => ({
    id: `tortila:${snapshot.botInstanceId}`,
    userId: snapshot.ownerUser.userId,
    userLabel: snapshot.ownerUser.displayName,
    email: snapshot.ownerUser.email,
    product: 'Tortila Bot',
    identity: 'WTC bot instance owner',
    runtime: snapshot.sourceAdapter.includes('mock') ? 'mock snapshot' : 'snapshot persisted',
    statistics: `${snapshot.walletEquityUsd ? fmtMoney(Number(snapshot.walletEquityUsd)) : '-'} equity / ${fmtNum(snapshot.tradeCount)} trades`,
    latestAt: snapshot.snapshotAt,
    href: `/admin/users/${snapshot.ownerUser.userId}/bots#bot-tortila_bot`,
    action: 'Open read-only Tortila view',
    tone: snapshot.sourceAdapter.includes('mock') ? 'warn' : 'ok',
    searchText: searchable(snapshot.ownerUser.displayName, snapshot.ownerUser.email, snapshot.ownerUser.userId, snapshot.botInstanceId, 'tortila', snapshot.sourceAdapter),
  }));

  const legacyRows: BotOwnerSelectorRow[] = health.legacyProviderAccounts.map((account) => {
    const mapped = account.mappedUser;
    const mappedLabel = mapped?.displayName ?? 'Unmapped provider row';
    const mappedEmail = mapped?.email ?? 'fleet diagnostics only';
    const runtime = account.quarantined ? 'quarantined' : account.running ? 'running' : 'not running';
    return {
      id: `legacy:${account.pubId}:${mapped?.userId ?? 'unmapped'}`,
      userId: mapped?.userId ?? null,
      userLabel: mappedLabel,
      email: mappedEmail,
      product: 'Legacy Bot',
      identity: `masked pub_id ${account.pubId}`,
      runtime,
      statistics: `${fmtNum(account.symbols)} symbols / ${fmtNum(account.activeSlots)} slots / ${fmtNum(account.activeOrders)} orders`,
      latestAt: account.latestSnapshotAt,
      href: mapped ? `/admin/users/${mapped.userId}/bots#bot-legacy_bot` : '/admin/bots',
      action: mapped ? 'Open read-only Legacy view' : 'Open fleet diagnostics',
      tone: !mapped || account.quarantined ? 'warn' : account.running ? 'ok' : 'neutral',
      searchText: searchable(mapped?.displayName, mapped?.email, mapped?.userId, account.pubId, account.market, 'legacy', 'pub_id', runtime),
    };
  });

  return [...userRows, ...tortilaRows, ...legacyRows].sort((a, b) =>
    a.userLabel.localeCompare(b.userLabel) || a.product.localeCompare(b.product) || a.identity.localeCompare(b.identity),
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireUser();
  assertAdmin(actor.roles);

  const sp = searchParams ? await searchParams : {};
  const q = normalizedQuery(firstParam(sp.q));
  const [{ mode, users }, botHealth] = await Promise.all([loadAdminUsers(), loadAdminBotHealth()]);
  const selectorRows = buildBotOwnerSelectorRows(users, botHealth);
  const matchedSelectorRows = selectorRows.filter((row) => rowMatches(row, q)).slice(0, 32);
  const mappedLegacyRows = botHealth.legacyProviderAccounts.filter((account) => account.mappedUser);
  const unmappedLegacyRows = botHealth.legacyProviderAccounts.length - mappedLegacyRows.length;

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
            audited reason; bot details are read-only and do not expose exchange secrets.
          </div>
        </div>
      </div>

      <Card title="Bot owner selector">
        <div className="wtc-grid wtc-grid-4">
          <StatusPill tone={q ? 'ok' : 'neutral'}>{q ? 'filtered' : 'all users'}</StatusPill>
          <StatusPill tone={botHealth.tortilaFleetSnapshots.length > 0 ? 'ok' : 'neutral'}>
            Tortila owners: {fmtNum(botHealth.tortilaFleetSnapshots.length)}
          </StatusPill>
          <StatusPill tone={mappedLegacyRows.length > 0 ? 'ok' : 'warn'}>
            Legacy mapped: {fmtNum(mappedLegacyRows.length)}
          </StatusPill>
          <StatusPill tone={unmappedLegacyRows > 0 ? 'warn' : 'neutral'}>
            Unmapped pub_id: {fmtNum(unmappedLegacyRows)}
          </StatusPill>
        </div>
        <div className="wtc-row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Link href="/admin/bots/config" className={buttonClasses('secondary')}>Global defaults</Link>
          <Link href="/admin/bots" className={buttonClasses('ghost')}>Fleet diagnostics</Link>
        </div>
        <form action="/admin/users" method="get" className="wtc-row" style={{ gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <input
            className="wtc-input"
            name="q"
            defaultValue={q}
            placeholder="email, name, user id, masked pub_id"
            maxLength={120}
            style={{ minWidth: 240, maxWidth: 420 }}
          />
          <button type="submit" className={buttonClasses('secondary')}>Search</button>
          {q && <Link href="/admin/users" className={buttonClasses('ghost')}>Clear</Link>}
        </form>
        <div className="wtc-warning info" role="status" style={{ marginTop: 12 }}>
          <span aria-hidden style={{ fontWeight: 800 }}>i</span>
          <div>
            <div className="w-title">Selected-user inspection only</div>
            <div className="w-detail">
              Results open read-only user settings and statistics. System defaults live on Global defaults; unmapped Legacy pub_id rows stay fleet diagnostics.
            </div>
          </div>
        </div>
        {matchedSelectorRows.length === 0 ? (
          <EmptyState
            title="No bot owner rows matched"
            hint={q ? 'Try an email, display name, user id, or the visible masked pub_id segment.' : 'Bot owner snapshots appear after users, mappings, or worker snapshots exist.'}
          />
        ) : (
          <div className="wtc-table-wrap" style={{ marginTop: 12 }}>
            <table className="wtc-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Product</th>
                  <th>Identity</th>
                  <th>Runtime</th>
                  <th>Statistics</th>
                  <th>Latest</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {matchedSelectorRows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="User">
                      <strong>{row.userLabel}</strong>
                      <br />
                      <span className="wtc-dim" style={{ fontSize: 12 }}>{row.email}</span>
                    </td>
                    <td data-label="Product">{row.product}</td>
                    <td className="wtc-mono" data-label="Identity" style={{ fontSize: 12 }}>{row.identity}</td>
                    <td data-label="Runtime"><StatusPill tone={row.tone}>{row.runtime}</StatusPill></td>
                    <td data-label="Statistics">{row.statistics}</td>
                    <td className="wtc-mono" data-label="Latest" style={{ fontSize: 12 }}>{row.latestAt ? fmtDateTime(row.latestAt) : '-'}</td>
                    <td className="wtc-td-action" data-label="Action">
                      <Link href={row.href} className={buttonClasses('secondary')} style={{ padding: '5px 10px', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {row.action}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
                      <div className="wtc-stack" style={{ gap: 8, alignItems: 'flex-start' }}>
                        <Link href={`/admin/users/${u.id}/bots`} className={buttonClasses('secondary')} style={{ padding: '5px 10px', fontSize: 12 }}>
                          Read-only bot view
                        </Link>
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
                      </div>
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
