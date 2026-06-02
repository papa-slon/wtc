import Link from 'next/link';
import { PublicTopBar } from '@/components/PublicTopBar';
import { Card, SectionHeader, StatusPill, buttonClasses, RiskWarningBanner } from '@wtc/ui';
import { PRODUCTS, PRODUCT_CODES, type ProductCode } from '@wtc/entitlements';
import { cookies } from 'next/headers';
import { userForToken } from '@/lib/backend';
import { accessFor, reasonLabel, reasonTone } from '@/lib/access';
import { buildPricingCards, type PricingPlanCard } from '@/features/billing/plans';
import { checkoutCta } from '@/features/billing/checkout';

/**
 * Resolve the currently authenticated user from the session cookie (server side, public page).
 * Returns null when not logged in — pricing is accessible without auth.
 */
async function maybeCurrentUser(): Promise<{ id: string; email: string } | null> {
  try {
    const jar = await cookies();
    const token = jar.get('wtc_session')?.value;
    if (!token) return null;
    return await userForToken(token);
  } catch {
    return null;
  }
}

/** Feature rows shown in the plan comparison table. */
const FEATURE_ROWS: { label: string; codes: Set<ProductCode> }[] = [
  { label: 'Tortila Bot (BingX perps, turtle strategy)', codes: new Set(['tortila_bot']) },
  { label: 'Legacy Bot (RSI/CCI averaging)', codes: new Set(['legacy_bot']) },
  { label: 'Axioma Terminal (local desktop + journal)', codes: new Set(['axioma_terminal']) },
  { label: 'TradingView Indicators', codes: new Set(['tradingview_indicators']) },
  { label: 'Education / LMS', codes: new Set(['education', 'tortila_bot']) },
  { label: 'Private Club access', codes: new Set(['club']) },
];

/** Plan cards (shared view-model from features/billing — excludes admin_grant). */
const DISPLAY_CARDS: PricingPlanCard[] = buildPricingCards();

/** Whether a plan card includes a given product code. */
function cardHas(card: PricingPlanCard, code: ProductCode): boolean {
  return card.productCodes.includes(code);
}

export default async function PricingPage() {
  const user = await maybeCurrentUser();
  // Honest checkout state (server-side): self-serve checkout is not enabled in this build (Q-2 / B2).
  const cta = checkoutCta();

  // For logged-in users: fetch their current access state per product.
  const accessMap: Map<ProductCode, { allowed: boolean; reason: string; label: string }> = new Map();
  if (user) {
    await Promise.all(
      PRODUCT_CODES.map(async (code) => {
        const dec = await accessFor(user.id, code);
        accessMap.set(code, {
          allowed: dec.allowed,
          reason: dec.reason,
          label: reasonLabel(dec.reason),
        });
      }),
    );
  }

  return (
    <>
      <PublicTopBar />
      <main className="wtc-container" style={{ padding: '48px 22px 80px' }}>
        <SectionHeader
          kicker="Pricing"
          title="Plans & bundles"
          copy="One-time, monthly, yearly, or bundle. Access is granted only after account creation and a verified payment or admin approval. No instant checkout — you will create an account first."
        />

        {/* Honest CTA statement — no implied instant Stripe checkout */}
        <RiskWarningBanner
          severity="info"
          title="How access works"
          detail="Self-serve checkout is not enabled in this build — access is granted by a verified payment webhook or an admin grant, never by client-side state alone. Click a plan to create an account (or contact support if you already have one). All entitlement checks are server-side and fail closed."
        />

        {/* Plan cards grid */}
        <div className="wtc-grid wtc-grid-3" style={{ marginTop: 32 }}>
          {DISPLAY_CARDS.map((card) => {
            // For logged-in users show which products they already have
            const alreadyHave = user
              ? card.productCodes.filter((c) => accessMap.get(c)?.allowed)
              : [];

            return (
              <Card key={card.code}>
                <div className="wtc-spread">
                  <h3 style={{ margin: 0, fontSize: 17 }}>{card.name}</h3>
                  <StatusPill tone={card.isBundle ? 'gold' : 'neutral'}>{card.billing}</StatusPill>
                </div>

                {card.isBundle && (
                  <div style={{ fontSize: 11, color: 'var(--gold2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '6px 0 0' }}>
                    Bundle
                  </div>
                )}

                <p className="wtc-dim" style={{ fontSize: 12, margin: '8px 0 16px', lineHeight: 1.55 }}>
                  {card.productNames.join(' · ') || '—'}
                </p>

                {/* Show access state for logged-in users */}
                {user && alreadyHave.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <StatusPill tone="ok">
                      {alreadyHave.length === card.productCodes.length ? 'Already owned' : `${alreadyHave.length}/${card.productCodes.length} owned`}
                    </StatusPill>
                  </div>
                )}

                {/* Per-product access pills for logged-in users */}
                {user && card.productCodes.length > 0 && (
                  <div className="wtc-row" style={{ flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                    {card.productCodes.map((c) => {
                      const acc = accessMap.get(c);
                      return acc ? (
                        <StatusPill key={c} tone={reasonTone(acc.reason as Parameters<typeof reasonTone>[0])}>
                          {PRODUCTS[c]?.name ?? c}: {acc.label}
                        </StatusPill>
                      ) : null;
                    })}
                  </div>
                )}

                {/* Honest checkout state pill — never implies instant Stripe checkout */}
                <div style={{ marginBottom: 10 }}>
                  <StatusPill tone="neutral">{cta.pill}</StatusPill>
                </div>

                {/* Honest CTA: logged-in users go to the manual access path (support); logged-out users
                    must register first. There is NO fake purchase button (self-serve checkout is off). */}
                {user ? (
                  <Link href={cta.ctaHref} className={buttonClasses(card.isBundle ? 'primary' : 'secondary')}>
                    {cta.ctaLabel}
                  </Link>
                ) : (
                  <Link href="/register" className={buttonClasses(card.isBundle ? 'primary' : 'secondary')}>
                    Create account
                  </Link>
                )}
              </Card>
            );
          })}
        </div>

        {/* Feature comparison table */}
        <div style={{ marginTop: 56 }}>
          <h2 className="wtc-h2" style={{ marginBottom: 18 }}>Feature comparison</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="wtc-table" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', minWidth: 200 }}>Feature</th>
                  {DISPLAY_CARDS.map((card) => (
                    <th key={card.code} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {card.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_ROWS.map((row) => (
                  <tr key={row.label}>
                    <td className="wtc-dim" style={{ fontSize: 13 }}>{row.label}</td>
                    {DISPLAY_CARDS.map((card) => {
                      const included = [...row.codes].some((c) => cardHas(card, c));
                      return (
                        <td key={card.code} style={{ textAlign: 'center' }}>
                          {included ? (
                            <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓</span>
                          ) : (
                            <span className="wtc-dim">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer note — no surprise pricing claims */}
        <div style={{ marginTop: 40, padding: '16px 20px', background: 'var(--panel)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)' }}>
          <p className="wtc-dim" style={{ margin: 0, fontSize: 13, lineHeight: 1.65 }}>
            All prices and billing cadences are illustrative in this build. Access is controlled server-side via the WTC entitlement engine — no client flag, no role label, and no payment gateway call is trusted on its own.
            Contact support for enterprise pricing or bulk access.
          </p>
        </div>
      </main>
    </>
  );
}
