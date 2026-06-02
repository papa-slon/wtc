import { describe, expect, it } from 'vitest';
import {
  buildStripeCheckoutRequest,
  parseStripePriceMap,
  summarizeStripeCheckoutRequest,
  validateStripeCheckoutConfig,
} from './stripe-checkout.ts';

describe('Stripe checkout helpers', () => {
  it('parses JSON and comma-separated Stripe price maps', () => {
    expect(parseStripePriceMap('{"tortila_monthly":"price_tortila","bundle_starter":"price_bundle"}')).toEqual({
      tortila_monthly: 'price_tortila',
      bundle_starter: 'price_bundle',
    });
    expect(parseStripePriceMap('tortila_monthly=price_tortila, education_lifetime=price_education')).toEqual({
      tortila_monthly: 'price_tortila',
      education_lifetime: 'price_education',
    });
  });

  it('validates test-mode checkout config without accepting live keys or malformed price IDs', () => {
    expect(validateStripeCheckoutConfig({
      provider: 'stripe',
      secretKey: 'sk_test_local',
      webhookSecret: 'whsec_local',
      priceMap: { tortila_monthly: 'price_tortila' },
      selectedPlanCodes: ['tortila_monthly'],
    })).toMatchObject({ ok: true, configuredPlans: ['tortila_monthly'] });

    const invalid = validateStripeCheckoutConfig({
      provider: 'stripe',
      secretKey: 'sk_live_never',
      webhookSecret: 'not_whsec',
      priceMap: { tortila_monthly: 'not_price' },
      selectedPlanCodes: ['bundle_starter'],
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.reasons).toContain('STRIPE_SECRET_KEY must be test-mode');
    expect(invalid.reasons).toContain('STRIPE_WEBHOOK_SECRET must use Stripe webhook secret prefix');
    expect(invalid.reasons).toContain('price id for tortila_monthly must start with price_');
    expect(invalid.reasons).toContain('missing price id for bundle_starter');
  });

  it('builds the Stripe Checkout REST request body used by the provider', () => {
    const request = buildStripeCheckoutRequest({
      userId: 'user-123',
      planCode: 'education_lifetime',
      priceId: 'price_education',
      mode: 'payment',
      successUrl: 'https://wtc.test/success',
      cancelUrl: 'https://wtc.test/cancel',
      customerEmail: 'student@wtc.test',
    }, { secretKey: 'sk_test_local' });

    expect(request.url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(request.headers.Authorization).toBe('Bearer sk_test_local');
    expect(request.body.get('mode')).toBe('payment');
    expect(request.body.get('line_items[0][price]')).toBe('price_education');
    expect(request.body.get('payment_intent_data[metadata][planCode]')).toBe('education_lifetime');
    expect(request.body.get('subscription_data[metadata][planCode]')).toBeNull();
  });

  it('summarizes checkout requests without retaining keys, prices, or URLs', () => {
    const summary = summarizeStripeCheckoutRequest({
      planCode: 'bundle_starter',
      mode: 'subscription',
      productCount: 2,
      hasCustomerEmail: true,
    });

    expect(summary).toEqual({
      planCode: 'bundle_starter',
      mode: 'subscription',
      productCount: 2,
      hasCustomerEmail: true,
      endpoint: 'redacted',
      priceId: 'redacted',
      secretKey: 'redacted',
    });
    expect(JSON.stringify(summary)).not.toContain('sk_test_');
    expect(JSON.stringify(summary)).not.toContain('price_');
    expect(JSON.stringify(summary)).not.toContain('checkout/sessions');
  });
});
