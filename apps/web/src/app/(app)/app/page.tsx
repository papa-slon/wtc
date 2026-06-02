import { requireUser } from '@/lib/session';
import { SectionHeader, Card, StatusPill } from '@wtc/ui';
import { loadCabinet } from '@/features/cabinet/loader';
import { CabinetProductCard } from '@/features/cabinet/CabinetProductCard';

// Auth-gated, per-request (entitlement state + setup signals are resolved live, never cached).
export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const user = await requireUser();
  const { mode, cards, activeCount, noticeCount } = await loadCabinet(user.id);

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker={`Welcome, ${user.displayName}`}
        title="Account overview"
        copy="Your products, access state, setup progress, and operational notices. Access is decided by the entitlement engine — never by a role label or client flag."
      />

      <div className="wtc-row" style={{ marginTop: -6 }}>
        <StatusPill tone={mode === 'postgres' ? 'ok' : 'warn'}>{mode === 'postgres' ? 'storage: Postgres' : 'storage: in-memory (demo)'}</StatusPill>
        {mode !== 'postgres' && <span className="wtc-dim" style={{ fontSize: 12 }}>Demo mode — setup changes are not persisted.</span>}
      </div>

      <div className="wtc-grid wtc-grid-4">
        <Card className="wtc-card-tight"><div className="wtc-dim" style={{ fontSize: 11 }}>ACTIVE PRODUCTS</div><div style={{ fontSize: 26, marginTop: 6 }}>{activeCount}</div></Card>
        <Card className="wtc-card-tight"><div className="wtc-dim" style={{ fontSize: 11 }}>ROLES</div><div style={{ marginTop: 10 }} className="wtc-row">{user.roles.map((r) => <StatusPill key={r} tone="neutral">{r}</StatusPill>)}</div></Card>
        <Card className="wtc-card-tight"><div className="wtc-dim" style={{ fontSize: 11 }}>OPEN NOTICES</div><div style={{ fontSize: 26, marginTop: 6 }} className={noticeCount > 0 ? 'wtc-down' : undefined}>{noticeCount}</div></Card>
        <Card className="wtc-card-tight"><div className="wtc-dim" style={{ fontSize: 11 }}>KEYS VAULT</div><div style={{ fontSize: 14, marginTop: 10 }} className="wtc-up">Encrypted ✓</div></Card>
      </div>

      <SectionHeader title="Your products" />
      <div className="wtc-grid wtc-grid-3">
        {cards.map((card) => (
          <CabinetProductCard key={card.productCode} card={card} />
        ))}
      </div>
    </div>
  );
}
