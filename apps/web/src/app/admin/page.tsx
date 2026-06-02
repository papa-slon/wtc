import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { assertAdmin } from '@wtc/auth';
import { Card, SectionHeader, StatusPill, buttonClasses } from '@wtc/ui';
import { loadAdminOverview } from '@/features/admin/queries';

export default async function AdminOverview() {
  const actor = await requireUser();
  assertAdmin(actor.roles); // per-page RBAC (defence-in-depth beyond the layout gate)

  const { mode, userCount, pendingTvCount, auditCount } = await loadAdminOverview();

  return (
    <div className="wtc-stack">
      <SectionHeader kicker="Admin" title="System overview" />

      {/* Storage mode pill — canonical, consistent with every other admin page */}
      <div className="wtc-row" style={{ marginTop: -4 }}>
        {mode === 'postgres' ? (
          <StatusPill tone="ok">storage: Postgres</StatusPill>
        ) : (
          <>
            <StatusPill tone="warn">storage: in-memory (demo)</StatusPill>
            <span className="wtc-dim" style={{ fontSize: 12 }}>
              Dev fallback — counts are 0 without DATABASE_URL. Set it to see real platform metrics.
            </span>
          </>
        )}
      </div>

      <div className="wtc-grid wtc-grid-4">
        <Card className="wtc-card-tight"><div className="wtc-dim" style={{ fontSize: 11 }}>USERS</div><div style={{ fontSize: 26, marginTop: 6 }}>{userCount}</div></Card>
        <Card className="wtc-card-tight"><div className="wtc-dim" style={{ fontSize: 11 }}>PENDING TV REQUESTS</div><div style={{ fontSize: 26, marginTop: 6 }} className={pendingTvCount > 0 ? 'wtc-down' : undefined}>{pendingTvCount}</div></Card>
        <Card className="wtc-card-tight"><div className="wtc-dim" style={{ fontSize: 11 }}>AUDIT EVENTS</div><div style={{ fontSize: 26, marginTop: 6 }}>{auditCount}</div></Card>
        <Card className="wtc-card-tight"><div className="wtc-dim" style={{ fontSize: 11 }}>BACKEND</div><div style={{ fontSize: 14, marginTop: 10 }} className={mode === 'postgres' ? 'wtc-up' : 'wtc-down'}>{mode === 'postgres' ? 'Postgres' : 'In-memory (demo)'}</div></Card>
      </div>
      <div className="wtc-row">
        <Link href="/admin/entitlements" className={buttonClasses('secondary')}>Manage entitlements</Link>
        <Link href="/admin/tradingview-access" className={buttonClasses('secondary')}>TradingView queue</Link>
        <Link href="/admin/audit-log" className={buttonClasses('ghost')}>Audit log</Link>
      </div>
    </div>
  );
}
