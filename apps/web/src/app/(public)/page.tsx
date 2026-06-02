import Link from 'next/link';
import { PublicTopBar } from '@/components/PublicTopBar';
import { Sparkline } from '@/components/Sparkline';
import { buttonClasses, Card, SectionHeader, StatusPill, MetricCard } from '@wtc/ui';
import { PRODUCTS } from '@wtc/entitlements';

const MODULES = [
  { code: 'axioma_terminal', blurb: 'Premium desktop trading terminal with journal & analytics. Licensed via WTC, bridged to axi-o.ma — never an order-execution detour.' },
  { code: 'tortila_bot', blurb: 'Turtle-system bot with journal, risk dashboard, and a downloadable backtester. Read-only monitoring; controls gated until audited.' },
  { code: 'legacy_bot', blurb: 'The original RSI/CCI averaging bot, normalized into one analytics model so you can compare it side-by-side.' },
  { code: 'tradingview_indicators', blurb: 'Entitlement-gated indicator access through your TradingView username — a compliant, admin-reviewed grant queue.' },
  { code: 'education', blurb: 'Structured lessons, materials, and community links. Teachers publish; students see only what they are entitled to.' },
  { code: 'club', blurb: 'Private WTC club access for premium add-ons, sessions, and community.' },
] as const;

export default function LandingPage() {
  return (
    <>
      <PublicTopBar />
      <main>
        {/* Hero */}
        <section className="wtc-container" style={{ padding: '72px 22px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'center' }}>
          <div>
            <StatusPill tone="gold">World Trader Club</StatusPill>
            <h1 className="wtc-h1" style={{ marginTop: 18 }}>
              One account. <em>Every</em> WTC product.
            </h1>
            <p className="wtc-lead">
              WTC is the operating system for your trading stack — a single premium hub for the Axioma terminal,
              two trading bots, TradingView indicator access, and education. Independent entitlements, transparent
              access state, encrypted keys, and honest risk warnings.
            </p>
            <div className="wtc-row">
              <Link href="/register" className={buttonClasses('primary')}>Create your account</Link>
              <Link href="/products/terminal" className={buttonClasses('secondary')}>Explore Axioma</Link>
            </div>
          </div>
          {/* Terminal frame mock */}
          <Card className="wtc-stack" >
            <div className="wtc-spread">
              <div className="wtc-row" style={{ gap: 6 }}>
                <i style={{ width: 9, height: 9, borderRadius: 9, background: '#ff6b74', display: 'inline-block' }} />
                <i style={{ width: 9, height: 9, borderRadius: 9, background: '#f5c451', display: 'inline-block' }} />
                <i style={{ width: 9, height: 9, borderRadius: 9, background: '#54d6a1', display: 'inline-block' }} />
              </div>
              <span className="wtc-dim" style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase' }}>Axioma Terminal · Journal</span>
              <StatusPill tone="warn">sample UI</StatusPill>
            </div>
            <Sparkline values={[1000, 1042, 1090, 1075, 1180, 1120, 1244, 1210, 1298, 1281]} height={120} />
            <div className="wtc-grid wtc-grid-3">
              <MetricCard label="Wallet equity" value="$12,810" />
              <MetricCard label="Closed PnL" value="+$281" tone="up" />
              <MetricCard label="Max drawdown" value="25.0%" tone="down" />
            </div>
            <p className="wtc-dim" style={{ fontSize: 11, marginTop: 10 }}>Illustrative sample — not live account data.</p>
          </Card>
        </section>

        {/* Modules */}
        <section className="wtc-container" style={{ padding: '40px 22px' }}>
          <SectionHeader
            kicker="Product modules"
            title="The brand sells a system; access is granted per module."
            copy="No tangled mega-subscription. Buy only the terminal, only education, or assemble a bundle — each unlocks an independent entitlement."
          />
          <div className="wtc-grid wtc-grid-3">
            {MODULES.map((m, i) => {
              const p = PRODUCTS[m.code as keyof typeof PRODUCTS];
              return (
                <Card key={m.code}>
                  <div className="wtc-spread">
                    <span className="wtc-kicker">{String(i + 1).padStart(2, '0')}</span>
                    <span className="wtc-dim" style={{ fontSize: 11 }}>/{p.slug}</span>
                  </div>
                  <h3 style={{ margin: '14px 0 8px', fontSize: 19 }}>{p.name}</h3>
                  <p className="wtc-muted" style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>{m.blurb}</p>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Access flow */}
        <section className="wtc-container" style={{ padding: '40px 22px' }}>
          <SectionHeader kicker="Access logic" title="Entitlements are the single source of truth — and they fail closed." />
          <div className="wtc-grid wtc-grid-3">
            <Card title="Choose">
              <p className="wtc-muted" style={{ fontSize: 14, margin: 0 }}>Pick products à la carte or as a bundle. The catalog and plan registry are code-defined and versioned.</p>
            </Card>
            <Card title="Pay">
              <p className="wtc-muted" style={{ fontSize: 14, margin: 0 }}>One-time, monthly, yearly, or admin grant. Webhooks are signature-verified and idempotent.</p>
            </Card>
            <Card title="Access">
              <p className="wtc-muted" style={{ fontSize: 14, margin: 0 }}>A state machine (active · grace · expired · revoked · refunded · chargeback · manual_review) decides — never a client flag.</p>
            </Card>
          </div>
        </section>

        <footer className="wtc-container" style={{ padding: '30px 22px 60px', borderTop: '1px solid var(--stroke)', marginTop: 30 }}>
          <div className="wtc-spread">
            <span className="wtc-brand">WTC <span style={{ color: 'var(--gold2)' }}>ECOSYSTEM</span></span>
            <div className="wtc-row">
              <Link href="/legal/terms" className="wtc-dim" style={{ fontSize: 12 }}>Terms</Link>
              <Link href="/legal/privacy" className="wtc-dim" style={{ fontSize: 12 }}>Privacy</Link>
              <Link href="/legal/risk-disclosure" className="wtc-dim" style={{ fontSize: 12 }}>Risk disclosure</Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
