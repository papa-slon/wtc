import { afterEach, describe, expect, it, vi } from 'vitest';
import { BillingProviderNotConfiguredError, createStripeProvider } from './stripe.ts';
import { mapProviderEvent, signWebhook } from './webhook.ts';

const SECRET = 'whsec_test_secret_value_1234567890';
const NOW = 1_900_000_000_000;
const ORIGINAL_FETCH = globalThis.fetch;

function stripeEvent(id: string, type: string, meta: Record<string, string>): string {
  return JSON.stringify({ id, type, data: { object: { metadata: meta } } });
}

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('Stripe provider - webhook verification + parsing', () => {
  const provider = createStripeProvider({ webhookSecret: SECRET });

  it('rejects a tampered body', async () => {
    const body = stripeEvent('evt_1', 'invoice.paid', { userId: 'u1', planCode: 'axioma_monthly' });
    const header = signWebhook(body, SECRET, Math.floor(NOW / 1000));
    const tampered = body.replace('u1', 'u2');
    expect(await provider.parseWebhook(tampered, header, NOW)).toBeNull();
  });

  it('rejects a wrong-secret signature', async () => {
    const body = stripeEvent('evt_2', 'invoice.paid', { userId: 'u1' });
    const header = signWebhook(body, 'whsec_WRONG', Math.floor(NOW / 1000));
    expect(await provider.parseWebhook(body, header, NOW)).toBeNull();
  });

  it('rejects an out-of-tolerance timestamp', async () => {
    const body = stripeEvent('evt_2b', 'invoice.paid', { userId: 'u1' });
    const oldTs = Math.floor(NOW / 1000) - 10_000;
    const header = signWebhook(body, SECRET, oldTs);
    expect(await provider.parseWebhook(body, header, NOW)).toBeNull();
  });

  it('accepts a valid signature and extracts userId/planCode from metadata', async () => {
    const body = stripeEvent('evt_3', 'checkout.session.completed', { userId: 'user-123', planCode: 'bundle_pro' });
    const header = signWebhook(body, SECRET, Math.floor(NOW / 1000));
    const ev = await provider.parseWebhook(body, header, NOW);
    expect(ev).not.toBeNull();
    expect(ev!.id).toBe('evt_3');
    expect(ev!.type).toBe('checkout.session.completed');
    expect(ev!.userId).toBe('user-123');
    expect(ev!.planCode).toBe('bundle_pro');
  });

  it('falls back to client_reference_id when metadata.userId is absent', async () => {
    const body = JSON.stringify({ id: 'evt_4', type: 'checkout.session.completed', data: { object: { client_reference_id: 'user-ref-9' } } });
    const header = signWebhook(body, SECRET, Math.floor(NOW / 1000));
    const ev = await provider.parseWebhook(body, header, NOW);
    expect(ev!.userId).toBe('user-ref-9');
  });

  it('maps provider event types to entitlement BillingEvents', () => {
    expect(mapProviderEvent('checkout.session.completed')).toBe('payment_succeeded');
    expect(mapProviderEvent('invoice.payment_failed')).toBe('payment_failed');
    expect(mapProviderEvent('customer.subscription.deleted')).toBe('subscription_canceled');
    expect(mapProviderEvent('charge.refunded')).toBe('refunded');
    expect(mapProviderEvent('charge.dispute.created')).toBe('chargeback');
    expect(mapProviderEvent('unknown.event')).toBeNull();
  });

  it('createCheckout throws without STRIPE_SECRET_KEY - never fakes a session', async () => {
    await expect(provider.createCheckout({ userId: 'u1', planCode: 'axioma_monthly' })).rejects.toBeInstanceOf(BillingProviderNotConfiguredError);
  });

  it('requires a webhook secret', () => {
    expect(() => createStripeProvider({ webhookSecret: '' })).toThrow();
  });
});

describe('Stripe provider - checkout creation', () => {
  it('creates a Checkout Session with WTC metadata and subscription metadata', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = init?.body as URLSearchParams;
      expect(body.get('mode')).toBe('subscription');
      expect(body.get('line_items[0][price]')).toBe('price_tortila_monthly');
      expect(body.get('client_reference_id')).toBe('user-123');
      expect(body.get('metadata[userId]')).toBe('user-123');
      expect(body.get('metadata[planCode]')).toBe('tortila_monthly');
      expect(body.get('subscription_data[metadata][userId]')).toBe('user-123');
      expect(body.get('success_url')).toBe('https://wtc.test/success');
      return new Response(JSON.stringify({ id: 'cs_test_123', url: 'https://checkout.stripe.test/cs_test_123' }), { status: 200 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const provider = createStripeProvider({ webhookSecret: SECRET, secretKey: 'sk_test_123' });
    const session = await provider.createCheckout({
      userId: 'user-123',
      planCode: 'tortila_monthly',
      priceId: 'price_tortila_monthly',
      mode: 'subscription',
      successUrl: 'https://wtc.test/success',
      cancelUrl: 'https://wtc.test/cancel',
      customerEmail: 'user@wtc.test',
    });

    expect(session).toEqual({ id: 'cs_test_123', url: 'https://checkout.stripe.test/cs_test_123', planCode: 'tortila_monthly', provider: 'stripe' });
    expect(fetchMock).toHaveBeenCalledWith('https://api.stripe.com/v1/checkout/sessions', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer sk_test_123' }),
    }));
  });

  it('creates payment-mode metadata for one-time plans', async () => {
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = init?.body as URLSearchParams;
      expect(body.get('mode')).toBe('payment');
      expect(body.get('payment_intent_data[metadata][planCode]')).toBe('education_lifetime');
      return new Response(JSON.stringify({ id: 'cs_test_payment', url: 'https://checkout.stripe.test/payment' }), { status: 200 });
    }) as typeof fetch;

    const provider = createStripeProvider({ webhookSecret: SECRET, secretKey: 'sk_test_123' });
    await expect(provider.createCheckout({
      userId: 'user-123',
      planCode: 'education_lifetime',
      priceId: 'price_education',
      mode: 'payment',
      successUrl: 'https://wtc.test/success',
      cancelUrl: 'https://wtc.test/cancel',
    })).resolves.toMatchObject({ id: 'cs_test_payment' });
  });
});
