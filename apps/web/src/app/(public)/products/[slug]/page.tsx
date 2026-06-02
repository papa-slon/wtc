import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicTopBar } from '@/components/PublicTopBar';
import { Card, SectionHeader, StatusPill, buttonClasses } from '@wtc/ui';
import { PRODUCTS, type ProductCode } from '@wtc/entitlements';
import { productAvailability, AVAILABILITY_TONE, AVAILABILITY_LABEL } from '@/lib/product-status';

const COPY: Record<ProductCode, { tagline: string; bullets: string[] }> = {
  axioma_terminal: { tagline: 'A premium desktop trading terminal, licensed and supported through WTC.', bullets: ['Lightweight-charts execution view', 'Local encrypted keys (OS safeStorage)', 'Cloud journal & analytics bridge', 'Signed download + release notes'] },
  tortila_bot: { tagline: 'Turtle-system automation with an honest risk dashboard.', bullets: ['Journal-shaped analytics', 'Downloadable backtester', 'Read-only monitoring (controls gated)', 'Surfaced risk/audit warnings'] },
  legacy_bot: { tagline: 'The original RSI/CCI averaging bot, normalized.', bullets: ['Stages/slots config', 'Averaging levels & TP %', 'Unified analytics model'] },
  tradingview_indicators: { tagline: 'Indicator access via your TradingView username.', bullets: ['Compliant admin grant queue', 'Expiry-driven revoke', 'No credential stuffing'] },
  education: { tagline: 'Structured lessons and community.', bullets: ['Courses & lessons', 'Entitlement-gated content', 'Teacher-published materials'] },
  club: { tagline: 'Private WTC club access.', bullets: ['Premium add-ons', 'Sessions & community'] },
};

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = Object.values(PRODUCTS).find((p) => p.slug === slug);
  if (!product) notFound();
  const copy = COPY[product.code];
  const av = productAvailability(product.code);

  return (
    <>
      <PublicTopBar />
      <main className="wtc-container" style={{ padding: '48px 22px' }}>
        <div className="wtc-row" style={{ gap: 10 }}>
          <StatusPill tone="gold">{product.code === 'axioma_terminal' ? 'Flagship product' : 'WTC product'}</StatusPill>
          <StatusPill tone={AVAILABILITY_TONE[av.status]}>{AVAILABILITY_LABEL[av.status]}</StatusPill>
        </div>
        <SectionHeader title={product.name} copy={copy.tagline} />
        <p className="wtc-dim" style={{ fontSize: 13, marginTop: -6 }}>{av.note}</p>
        <div className="wtc-grid wtc-grid-2">
          <Card title="What you get">
            <ul className="wtc-muted" style={{ fontSize: 14, lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
              {copy.bullets.map((b) => <li key={b}>{b}</li>)}
            </ul>
          </Card>
          <Card title="Get access">
            <p className="wtc-muted" style={{ fontSize: 14, marginTop: 0 }}>Create a WTC account, then activate this product. Access is governed by entitlements and fails closed.</p>
            <div className="wtc-row">
              <Link href="/register" className={buttonClasses('primary')}>Create account</Link>
              <Link href="/pricing" className={buttonClasses('ghost')}>See pricing</Link>
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
