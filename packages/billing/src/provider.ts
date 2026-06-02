/**
 * Billing provider abstraction. Billing state is translated into entitlement
 * transitions by webhook handlers; entitlements remain the only access source
 * of truth. See docs/BILLING_PROVIDER_PLAN.md.
 */
export type ProviderName = 'mock' | 'stripe' | 'crypto';

export interface CheckoutSession {
  id: string;
  url: string;
  planCode: string;
  provider: ProviderName;
}

export type CheckoutMode = 'payment' | 'subscription';

export interface CheckoutInput {
  userId: string;
  planCode: string;
  priceId?: string;
  mode?: CheckoutMode;
  successUrl?: string;
  cancelUrl?: string;
  customerEmail?: string;
}

export interface NormalizedEvent {
  id: string;
  type: string;
  userId?: string;
  planCode?: string;
  raw: unknown;
  providerRef?: string;
  currentPeriodEnd?: number;
  subscriptionStatus?: string;
}

export interface BillingProvider {
  name: ProviderName;
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  parseWebhook(rawBody: string, signatureHeader: string, now: number): Promise<NormalizedEvent | null>;
}

import { signWebhook, verifyWebhookSignature } from './webhook.ts';
import { createStripeProvider } from './stripe.ts';

/** Mock provider: no network. Forges/verifies signed webhooks for local dev and tests. */
export function createMockBillingProvider(secret: string): BillingProvider & {
  forgeWebhook(type: string, payload: { id: string; userId?: string; planCode?: string }, now: number): { body: string; header: string };
} {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('mock billing provider is disabled in production (set BILLING_PROVIDER=stripe|crypto)');
  }
  return {
    name: 'mock',
    async createCheckout({ userId, planCode }) {
      const id = `cs_mock_${globalThis.crypto.randomUUID()}`;
      return { id, url: `/billing/mock-checkout?session=${id}&plan=${planCode}&u=${userId}`, planCode, provider: 'mock' };
    },
    async parseWebhook(rawBody, signatureHeader, now) {
      const v = verifyWebhookSignature(rawBody, signatureHeader, secret, { now });
      if (!v.valid) return null;
      try {
        return JSON.parse(rawBody) as NormalizedEvent;
      } catch {
        return null;
      }
    },
    forgeWebhook(type, payload, now) {
      const body = JSON.stringify({ id: payload.id, type, userId: payload.userId, planCode: payload.planCode, raw: {} });
      return { body, header: signWebhook(body, secret, Math.floor(now / 1000)) };
    },
  };
}

/**
 * Select a billing provider by name. Mock is hard-disabled in production.
 * Stripe verifies real webhooks and can create test-mode Checkout Sessions when
 * both STRIPE_WEBHOOK_SECRET and STRIPE_SECRET_KEY are configured.
 */
export function createBillingProvider(name: ProviderName, secret: string): BillingProvider {
  if (name === 'mock') return createMockBillingProvider(secret);
  if (name === 'stripe') return createStripeProvider({ webhookSecret: secret, secretKey: process.env.STRIPE_SECRET_KEY });
  throw new Error(`billing provider "${name}" is not implemented yet`);
}

export interface CheckoutAvailability {
  available: boolean;
  reason: string;
}

/**
 * Pure diagnostic: can self-serve checkout be attempted right now?
 * This gates the CTA only; it never grants access. Access still comes only from
 * a verified webhook or admin grant.
 */
export function checkoutAvailability(opts: {
  provider?: string;
  secretKey?: string;
  webhookSecret?: string;
  priceMap?: Record<string, string>;
}): CheckoutAvailability {
  if (opts.provider !== 'stripe') {
    return {
      available: false,
      reason: 'self-serve checkout is not enabled - access is granted by an admin (BILLING_PROVIDER is not "stripe")',
    };
  }
  if (!opts.secretKey) {
    return { available: false, reason: 'STRIPE_SECRET_KEY is not configured' };
  }
  if (!opts.webhookSecret) {
    return { available: false, reason: 'STRIPE_WEBHOOK_SECRET is not configured' };
  }
  if (!opts.secretKey.startsWith('sk_test_')) {
    return { available: false, reason: 'Stripe checkout is test-mode only in this build (STRIPE_SECRET_KEY must start with sk_test_)' };
  }
  if (!opts.priceMap || Object.keys(opts.priceMap).length === 0) {
    return { available: false, reason: 'STRIPE_PRICE_MAP has no configured plan price ids' };
  }
  return { available: true, reason: 'Stripe test-mode checkout is configured' };
}
