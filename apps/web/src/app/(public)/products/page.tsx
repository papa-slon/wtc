import Link from 'next/link';
import { PublicTopBar } from '@/components/PublicTopBar';
import { Card, SectionHeader, StatusPill, buttonClasses } from '@wtc/ui';
import { PRODUCTS } from '@wtc/entitlements';
import { productAvailability, AVAILABILITY_TONE, AVAILABILITY_LABEL } from '@/lib/product-status';

export default function ProductsPage() {
  return (
    <>
      <PublicTopBar />
      <main className="wtc-container" style={{ padding: '48px 22px' }}>
        <SectionHeader kicker="Catalog" title="WTC products" copy="Each product is an independent, entitlement-gated module." />
        <div className="wtc-grid wtc-grid-3">
          {Object.values(PRODUCTS).map((p) => {
            const av = productAvailability(p.code);
            return (
            <Card key={p.code}>
              <div className="wtc-spread" style={{ alignItems: 'flex-start', gap: 8 }}>
                <h3 style={{ marginTop: 0 }}>{p.name}</h3>
                <StatusPill tone={AVAILABILITY_TONE[av.status]}>{AVAILABILITY_LABEL[av.status]}</StatusPill>
              </div>
              <p className="wtc-dim" style={{ fontSize: 12 }}>/products/{p.slug}</p>
              <Link href={`/products/${p.slug}`} className={buttonClasses('secondary')}>Learn more</Link>
            </Card>
            );
          })}
        </div>
      </main>
    </>
  );
}
