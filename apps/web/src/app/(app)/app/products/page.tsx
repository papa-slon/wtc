import { requireUser } from '@/lib/session';
import { CabinetProductCard } from '@/features/cabinet/CabinetProductCard';
import { loadCabinet } from '@/features/cabinet/loader';
import { MetricCard, SectionHeader, StatusPill } from '@wtc/ui';

export const dynamic = 'force-dynamic';

export default async function AppProductsPage() {
  const user = await requireUser();
  const { mode, cards, activeCount, noticeCount } = await loadCabinet(user.id);
  const actionableCount = cards.filter((card) => card.nextAction.href && !card.nextAction.disabled).length;
  const blockedCount = cards.filter((card) => card.blockers.some((b) => b.ref !== 'demo')).length;
  const previewCount = cards.filter((card) => card.isDemo).length;
  const orderedCards = [...cards].sort((a, b) => {
    if (a.allowed !== b.allowed) return a.allowed ? -1 : 1;
    if (a.availability !== b.availability) return a.availability === 'planned' ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="Products"
        title="Product directory"
        copy="One cabinet for bot rooms, indicators, terminal access, education, and club products. Every card is entitlement-aware and shows the next safe action."
      />

      <div className="wtc-row" style={{ marginTop: -6 }}>
        <StatusPill tone={mode === 'postgres' ? 'ok' : 'warn'}>{mode === 'postgres' ? 'storage: Postgres' : 'storage: in-memory (demo)'}</StatusPill>
        {mode !== 'postgres' && <span className="wtc-dim" style={{ fontSize: 12 }}>Preview changes are not persisted without DATABASE_URL.</span>}
      </div>

      <div className="wtc-grid wtc-grid-4">
        <MetricCard label="Active products" value={activeCount} sub="active or grace entitlements" tone={activeCount > 0 ? 'up' : undefined} />
        <MetricCard label="Available actions" value={actionableCount} sub="open setup, billing, or product rooms" />
        <MetricCard label="Operational notices" value={noticeCount} sub="owned-product warnings" tone={noticeCount > 0 ? 'down' : undefined} />
        <MetricCard label="Hard blockers" value={blockedCount} sub="explicit B3/B4 product boundaries" tone={blockedCount > 0 ? 'down' : undefined} />
      </div>

      {previewCount > 0 && (
        <div className="wtc-row" style={{ gap: 8 }}>
          <StatusPill tone="warn">{previewCount} preview surface{previewCount === 1 ? '' : 's'}</StatusPill>
          <span className="wtc-dim" style={{ fontSize: 13 }}>Preview labels stay visible until the real integrations and production secrets are wired.</span>
        </div>
      )}

      <div className="wtc-grid wtc-grid-3">
        {orderedCards.map((card) => (
          <CabinetProductCard key={card.productCode} card={card} />
        ))}
      </div>
    </div>
  );
}
