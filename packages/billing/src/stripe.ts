/**
 * Stripe billing provider. Webhook verification is local HMAC validation; checkout
 * creation is a real Stripe REST call and is never faked.
 */
import { verifyWebhookSignature } from './webhook.ts';
import type { BillingProvider, CheckoutInput, CheckoutSession, NormalizedEvent } from './provider.ts';
import { buildStripeCheckoutRequest } from './stripe-checkout.ts';

export class BillingProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BillingProviderNotConfiguredError';
  }
}

interface StripeEventLike {
  id?: string;
  type?: string;
  data?: {
    object?: {
      metadata?: Record<string, string>;
      client_reference_id?: string;
      subscription?: string;
      current_period_end?: number;
      status?: string;
    };
  };
}

interface StripeCheckoutResponse {
  id?: string;
  url?: string | null;
  error?: { message?: string; type?: string };
}

export function createStripeProvider(opts: { webhookSecret: string; secretKey?: string }): BillingProvider {
  if (!opts.webhookSecret) {
    throw new BillingProviderNotConfiguredError('Stripe provider requires STRIPE_WEBHOOK_SECRET');
  }
  return {
    name: 'stripe',
    async createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
      if (!opts.secretKey) {
        throw new BillingProviderNotConfiguredError('Stripe checkout requires STRIPE_SECRET_KEY');
      }
      const request = buildStripeCheckoutRequest(input, { secretKey: opts.secretKey });
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      const parsed = (await response.json().catch(() => ({}))) as StripeCheckoutResponse;
      if (!response.ok) {
        const message = parsed.error?.message ?? `Stripe checkout failed with HTTP ${response.status}`;
        throw new Error(message);
      }
      if (!parsed.id || !parsed.url) {
        throw new Error('Stripe checkout response did not include id and url');
      }
      return { id: parsed.id, url: parsed.url, planCode: input.planCode, provider: 'stripe' };
    },
    async parseWebhook(rawBody, signatureHeader, now): Promise<NormalizedEvent | null> {
      const v = verifyWebhookSignature(rawBody, signatureHeader, opts.webhookSecret, { now });
      if (!v.valid) return null;
      let ev: StripeEventLike;
      try {
        ev = JSON.parse(rawBody) as StripeEventLike;
      } catch {
        return null;
      }
      if (!ev.id || !ev.type) return null;
      const obj = ev.data?.object ?? {};
      const meta = obj.metadata ?? {};
      const userId = meta.userId ?? meta.user_id ?? obj.client_reference_id;
      const planCode = meta.planCode ?? meta.plan_code;
      const out: NormalizedEvent = { id: ev.id, type: ev.type, raw: ev };
      if (userId) out.userId = userId;
      if (planCode) out.planCode = planCode;
      if (obj.subscription) out.providerRef = obj.subscription;
      if (obj.current_period_end) out.currentPeriodEnd = obj.current_period_end;
      if (obj.status) out.subscriptionStatus = obj.status;
      return out;
    },
  };
}
