import 'server-only';

import { checkoutAvailability, createStripeProvider, parseStripePriceMap, type CheckoutSession } from '@wtc/billing';
import { expandPlan, PLANS, type ProductCode } from '@wtc/entitlements';

export interface CheckoutCta {
  available: boolean;
  reason: string;
  pill: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface StripeCheckoutConfig {
  planCode: string;
  priceId: string;
  productCodes: ProductCode[];
  mode: 'payment' | 'subscription';
}

export function checkoutModeForPlan(planCode: string): 'payment' | 'subscription' {
  return PLANS[planCode]?.billing === 'one_time' ? 'payment' : 'subscription';
}

export function entitlementSourceForPlan(planCode: string): 'subscription' | 'one_time' | 'bundle' {
  const plan = PLANS[planCode];
  if (!plan) return 'subscription';
  if (plan.kind === 'bundle') return 'bundle';
  return plan.billing === 'one_time' ? 'one_time' : 'subscription';
}

export function stripeCheckoutConfig(planCode: string): StripeCheckoutConfig | null {
  const plan = PLANS[planCode];
  if (!plan || plan.code === 'admin_grant') return null;
  const priceId = parseStripePriceMap(process.env.STRIPE_PRICE_MAP)[planCode];
  const productCodes = expandPlan(planCode).filter((code): code is ProductCode => plan.products.includes(code as ProductCode));
  if (!priceId || productCodes.length === 0) return null;
  return { planCode, priceId, productCodes, mode: checkoutModeForPlan(planCode) };
}

export function checkoutCta(planCode?: string): CheckoutCta {
  const priceMap = parseStripePriceMap(process.env.STRIPE_PRICE_MAP);
  const availability = checkoutAvailability({
    provider: process.env.BILLING_PROVIDER,
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    priceMap,
  });
  if (!availability.available) {
    return {
      available: false,
      reason: availability.reason,
      pill: 'Self-serve checkout unavailable',
      ctaLabel: 'Contact support for access',
      ctaHref: '/app/support',
    };
  }
  if (planCode && !priceMap[planCode]) {
    return {
      available: false,
      reason: `No Stripe price id configured for ${planCode}`,
      pill: 'Price id missing',
      ctaLabel: 'Contact support for access',
      ctaHref: '/app/support',
    };
  }
  return {
    available: true,
    reason: availability.reason,
    pill: 'Stripe test checkout',
    ctaLabel: 'Checkout (test mode)',
    ctaHref: '/app/billing',
  };
}

export async function createStripeCheckout(input: {
  userId: string;
  email?: string;
  planCode: string;
  successPath?: string;
  cancelPath?: string;
}): Promise<{ session: CheckoutSession; config: StripeCheckoutConfig }> {
  if (process.env.BILLING_PROVIDER !== 'stripe') {
    throw new Error('stripe checkout is not enabled');
  }
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    throw new Error('stripe checkout is not configured');
  }
  if (!secretKey.startsWith('sk_test_')) {
    throw new Error('stripe checkout is test-mode only in this build');
  }
  const config = stripeCheckoutConfig(input.planCode);
  if (!config) {
    throw new Error('stripe price id is not configured for this plan');
  }
  const baseUrl = (process.env.APP_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const provider = createStripeProvider({ webhookSecret, secretKey });
  const session = await provider.createCheckout({
    userId: input.userId,
    planCode: input.planCode,
    priceId: config.priceId,
    mode: config.mode,
    successUrl: `${baseUrl}${input.successPath ?? '/app/billing?checkout=success'}`,
    cancelUrl: `${baseUrl}${input.cancelPath ?? '/app/billing?checkout=cancelled'}`,
    customerEmail: input.email,
  });
  return { session, config };
}
