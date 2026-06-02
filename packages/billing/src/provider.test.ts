import { afterEach, describe, expect, it } from 'vitest';
import { checkoutAvailability, createBillingProvider, createMockBillingProvider } from './provider.ts';

const ORIGINAL = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL;
});

describe('mock billing provider is impossible in production', () => {
  it('works outside production', () => {
    process.env.NODE_ENV = 'development';
    expect(createMockBillingProvider('whsec').name).toBe('mock');
    expect(createBillingProvider('mock', 'whsec').name).toBe('mock');
  });

  it('throws in production at the provider-selection level', () => {
    process.env.NODE_ENV = 'production';
    expect(() => createMockBillingProvider('whsec')).toThrow(/disabled in production/);
    expect(() => createBillingProvider('mock', 'whsec')).toThrow(/disabled in production/);
  });

  it('stripe is implemented; crypto is an honest not-implemented stub', () => {
    process.env.NODE_ENV = 'development';
    expect(createBillingProvider('stripe', 'whsec_x').name).toBe('stripe');
    expect(() => createBillingProvider('crypto', 'x')).toThrow(/not implemented/);
  });
});

describe('checkoutAvailability', () => {
  it('provider unset returns unavailable', () => {
    const r = checkoutAvailability({});
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/admin|not enabled|not "stripe"/i);
  });

  it('provider=mock returns unavailable', () => {
    const r = checkoutAvailability({ provider: 'mock', secretKey: 'sk_test_anything' });
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/not "stripe"|admin/i);
  });

  it('provider=stripe but missing secret key returns unavailable', () => {
    const r = checkoutAvailability({ provider: 'stripe' });
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/STRIPE_SECRET_KEY/);
  });

  it('provider=stripe but missing webhook secret returns unavailable', () => {
    const r = checkoutAvailability({ provider: 'stripe', secretKey: 'sk_test_123' });
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/STRIPE_WEBHOOK_SECRET/);
  });

  it('provider=stripe rejects live keys in this test-mode build', () => {
    const r = checkoutAvailability({ provider: 'stripe', secretKey: 'sk_live_123', webhookSecret: 'whsec_123', priceMap: { tortila_monthly: 'price_123' } });
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/test-mode only/);
  });

  it('provider=stripe requires a price map', () => {
    const r = checkoutAvailability({ provider: 'stripe', secretKey: 'sk_test_123', webhookSecret: 'whsec_123' });
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/STRIPE_PRICE_MAP/);
  });

  it('provider=stripe with test key, webhook secret, and price map is available', () => {
    const r = checkoutAvailability({ provider: 'stripe', secretKey: 'sk_test_123', webhookSecret: 'whsec_123', priceMap: { tortila_monthly: 'price_123' } });
    expect(r.available).toBe(true);
  });
});
