import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { entitlementsOf, getServerDb, grantProduct } from '@/lib/backend';
import { PRODUCT_CODES, PLANS, PRODUCTS, evaluateStatus, expandPlan, type ProductCode } from '@wtc/entitlements';
import { assertNotProduction } from '@wtc/shared';
import { Card, EmptyState, RiskWarningBanner, SectionHeader, StatusPill, buttonClasses, type Tone } from '@wtc/ui';
import { fmtDate } from '@/lib/format';
import { CsrfField, assertCsrf } from '@/lib/csrf';
import { loadUserTimeline } from '@/features/billing/timeline';
import { buildPricingCards } from '@/features/billing/plans';
import { checkoutCta, createStripeCheckout, entitlementSourceForPlan } from '@/features/billing/checkout';
import { createPendingPaymentForPlan, listSubscriptionsForUser } from '@wtc/db';
import { accessFor, reasonLabel, reasonTone } from '@/lib/access';

async function mockPurchase(formData: FormData): Promise<void> {
  'use server';
  assertNotProduction('Mock checkout');
  await assertCsrf(formData);
  const user = await requireUser();
  const planCode = String(formData.get('plan'));
  for (const product of expandPlan(planCode)) await grantProduct(user.id, product);
  revalidatePath('/app/billing');
  revalidatePath('/app');
}

async function startStripeCheckout(formData: FormData): Promise<void> {
  'use server';
  await assertCsrf(formData);
  const user = await requireUser();
  const db = getServerDb();
  if (!db) throw new Error('DATABASE_URL is required before Stripe checkout can be used');
  const planCode = String(formData.get('plan') ?? '');
  const { session, config } = await createStripeCheckout({ userId: user.id, email: user.email, planCode });
  await createPendingPaymentForPlan(db, {
    userId: user.id,
    planCode,
    productCodes: config.productCodes,
    source: entitlementSourceForPlan(planCode),
    provider: 'stripe',
    checkoutSessionId: session.id,
  });
  revalidatePath('/app/billing');
  redirect(session.url);
}

function statusTone(s: string): Tone {
  return s === 'active' ? 'ok' : s === 'grace' ? 'warn' : 'bad';
}

export default async function BillingPage() {
  const user = await requireUser();
  const [ents, timeline, db] = await Promise.all([
    entitlementsOf(user.id),
    loadUserTimeline(user.id, { limit: 30 }),
    Promise.resolve(getServerDb()),
  ]);
  const subs = db ? await listSubscriptionsForUser(db, user.id) : [];
  const now = Date.now();

  const accessRows = await Promise.all(
    PRODUCT_CODES.map(async (code) => {
      const dec = await accessFor(user.id, code);
      return { code, product: PRODUCTS[code], dec };
    }),
  );

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="Billing"
        title="Subscriptions & entitlements"
        copy="Stripe test checkout can create payment sessions when configured. Access still changes only after a verified webhook or admin grant."
      />

      <div className="wtc-row">
        {timeline.mode === 'postgres' ? (
          <StatusPill tone="ok">storage: Postgres</StatusPill>
        ) : (
          <>
            <StatusPill tone="warn">storage: in-memory (demo)</StatusPill>
            <span className="wtc-dim" style={{ fontSize: 12 }}>
              Demo mode - timeline and subscription history are not persisted. Set DATABASE_URL to enable Postgres.
            </span>
          </>
        )}
      </div>

      <SectionHeader
        title="Start checkout"
        copy="Checkout is test-mode only in this build. Creating a session marks products as pending_payment; access is activated only by the signed Stripe webhook."
      />
      <div className="wtc-grid wtc-grid-3">
        {buildPricingCards().map((card) => {
          const cta = checkoutCta(card.code);
          return (
            <Card key={card.code}>
              <div className="wtc-spread">
                <h3 style={{ margin: 0, fontSize: 17 }}>{card.name}</h3>
                <StatusPill tone={cta.available ? 'ok' : 'neutral'}>{cta.pill}</StatusPill>
              </div>
              <p className="wtc-dim" style={{ fontSize: 12, margin: '8px 0 12px' }}>
                Grants: {card.productNames.join(', ') || '-'}
              </p>
              <p className="wtc-dim" style={{ fontSize: 12, margin: '0 0 14px' }}>
                {cta.reason}
              </p>
              {cta.available ? (
                <form action={startStripeCheckout}>
                  <CsrfField />
                  <input type="hidden" name="plan" value={card.code} />
                  <button className={buttonClasses(card.isBundle ? 'primary' : 'secondary')} type="submit">
                    {cta.ctaLabel}
                  </button>
                </form>
              ) : (
                <a className={buttonClasses('secondary')} href={cta.ctaHref}>
                  {cta.ctaLabel}
                </a>
              )}
            </Card>
          );
        })}
      </div>

      {process.env.NODE_ENV !== 'production' && (
        <RiskWarningBanner
          severity="warning"
          title="Mock checkout вЂ” hard disabled in production"
          detail="Activate (mock) self-grants entitlements with no payment and is hard-disabled in production via assertNotProduction(). Real access comes from a verified payment webhook or an admin grant."
        />
      )}

      <Card title="Access state by product">
        <table className="wtc-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Access</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {accessRows.map(({ code, product, dec }) => (
              <tr key={code}>
                <td>{product?.name ?? code}</td>
                <td>
                  <StatusPill tone={reasonTone(dec.reason)}>{dec.allowed ? 'Allowed' : 'Denied'}</StatusPill>
                </td>
                <td className="wtc-dim">{reasonLabel(dec.reason)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Your entitlements">
        {ents.length === 0 ? (
          <EmptyState title="No products yet" hint="Start checkout above or contact support for an admin grant." />
        ) : (
          <table className="wtc-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Renews / expires</th>
              </tr>
            </thead>
            <tbody>
              {ents.map((e, i) => {
                const eff = evaluateStatus(e, now);
                return (
                  <tr key={i}>
                    <td>{PRODUCTS[e.productCode as ProductCode]?.name ?? e.productCode}</td>
                    <td className="wtc-dim">{e.planCode ?? '-'}</td>
                    <td>
                      <StatusPill tone={statusTone(eff)}>{eff}</StatusPill>
                    </td>
                    <td className="wtc-mono">{fmtDate(e.currentPeriodEnd ?? e.expiresAt ?? null)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Subscriptions">
        {subs.length === 0 ? (
          <EmptyState
            title="No subscriptions"
            hint={timeline.mode === 'postgres' ? 'No active or historical subscription records found.' : 'Storage is in-memory - subscription data requires Postgres.'}
          />
        ) : (
          <table className="wtc-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Period end</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <td>{PLANS[s.planCode]?.name ?? s.planCode}</td>
                  <td className="wtc-dim">{s.provider}</td>
                  <td>
                    <StatusPill tone={s.status === 'active' ? 'ok' : s.status === 'trialing' ? 'warn' : 'bad'}>
                      {s.status}
                    </StatusPill>
                  </td>
                  <td className="wtc-mono">{s.currentPeriodEnd ? fmtDate(s.currentPeriodEnd.getTime()) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Access event timeline">
        {timeline.entries.length === 0 ? (
          <EmptyState
            title="No access events"
            hint={timeline.mode === 'postgres' ? 'No product access transitions recorded yet.' : 'Storage is in-memory - timeline requires Postgres.'}
          />
        ) : (
          <table className="wtc-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>From</th>
                <th>To</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {timeline.entries.map((e) => (
                <tr key={e.id}>
                  <td className="wtc-mono">{fmtDate(e.createdAt)}</td>
                  <td>{PRODUCTS[e.productCode as ProductCode]?.name ?? e.productCode}</td>
                  <td className="wtc-dim">{e.fromState}</td>
                  <td>
                    <StatusPill tone={statusTone(e.toState)}>{e.toState}</StatusPill>
                  </td>
                  <td className="wtc-dim">{e.reason ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {process.env.NODE_ENV !== 'production' && (
        <>
          <SectionHeader title="Activate a plan (dev only)" />
          <div className="wtc-grid wtc-grid-3">
            {buildPricingCards().map((card) => (
              <Card key={card.code}>
                <div className="wtc-spread">
                  <h3 style={{ margin: 0, fontSize: 17 }}>{card.name}</h3>
                  <StatusPill tone="gold">{card.billing}</StatusPill>
                </div>
                <p className="wtc-dim" style={{ fontSize: 12, margin: '8px 0 14px' }}>
                  Grants: {card.productNames.join(', ') || '-'}
                </p>
                <form action={mockPurchase}>
                  <CsrfField />
                  <input type="hidden" name="plan" value={card.code} />
                  <button className={buttonClasses('primary')} type="submit">
                    Activate (mock - dev)
                  </button>
                </form>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
