import type { CheckoutInput, CheckoutMode } from './provider.ts';

export interface StripeCheckoutRequest {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: URLSearchParams;
}

export interface StripeCheckoutConfigCheckInput {
  provider?: string;
  secretKey?: string;
  webhookSecret?: string;
  priceMap?: Record<string, string>;
  selectedPlanCodes?: string[];
}

export interface StripeCheckoutConfigCheck {
  ok: boolean;
  reasons: string[];
  configuredPlans: string[];
}

export function parseStripePriceMap(raw?: string): Record<string, string> {
  if (!raw) return {};
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, value]) => typeof value === 'string' && value.length > 0)
        .map(([key, value]) => [key, value as string]),
    );
  }
  return Object.fromEntries(
    trimmed
      .split(',')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const [planCode, priceId] = pair.split('=').map((part) => part.trim());
        return [planCode, priceId] as const;
      })
      .filter(([planCode, priceId]) => !!planCode && !!priceId),
  );
}

export function validateStripeCheckoutConfig(input: StripeCheckoutConfigCheckInput): StripeCheckoutConfigCheck {
  const reasons: string[] = [];
  const priceMap = input.priceMap ?? {};
  const configuredPlans = Object.keys(priceMap).filter((planCode) => Boolean(priceMap[planCode]));

  if (input.provider !== 'stripe') reasons.push('BILLING_PROVIDER must be stripe');
  if (!input.secretKey) reasons.push('STRIPE_SECRET_KEY is required');
  else if (!input.secretKey.startsWith('sk_test_')) reasons.push('STRIPE_SECRET_KEY must be test-mode');
  if (!input.webhookSecret) reasons.push('STRIPE_WEBHOOK_SECRET is required');
  else if (!input.webhookSecret.startsWith('whsec_')) reasons.push('STRIPE_WEBHOOK_SECRET must use Stripe webhook secret prefix');
  if (configuredPlans.length === 0) reasons.push('STRIPE_PRICE_MAP must contain at least one plan');

  for (const [planCode, priceId] of Object.entries(priceMap)) {
    if (!priceId.startsWith('price_')) reasons.push(`price id for ${planCode} must start with price_`);
  }
  for (const planCode of input.selectedPlanCodes ?? []) {
    if (!priceMap[planCode]) reasons.push(`missing price id for ${planCode}`);
  }

  return { ok: reasons.length === 0, reasons, configuredPlans };
}

function requireCheckoutField(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Stripe checkout requires ${name}`);
  return value;
}

export function stripeCheckoutMode(input: CheckoutInput): CheckoutMode {
  return input.mode ?? 'subscription';
}

export function buildStripeCheckoutBody(input: CheckoutInput): URLSearchParams {
  const priceId = requireCheckoutField(input.priceId, 'priceId');
  const successUrl = requireCheckoutField(input.successUrl, 'successUrl');
  const cancelUrl = requireCheckoutField(input.cancelUrl, 'cancelUrl');
  const mode = stripeCheckoutMode(input);
  const body = new URLSearchParams();
  body.set('mode', mode);
  body.set('line_items[0][price]', priceId);
  body.set('line_items[0][quantity]', '1');
  body.set('success_url', successUrl);
  body.set('cancel_url', cancelUrl);
  body.set('client_reference_id', input.userId);
  body.set('metadata[userId]', input.userId);
  body.set('metadata[planCode]', input.planCode);
  body.set('allow_promotion_codes', 'true');
  if (input.customerEmail) body.set('customer_email', input.customerEmail);
  if (mode === 'subscription') {
    body.set('subscription_data[metadata][userId]', input.userId);
    body.set('subscription_data[metadata][planCode]', input.planCode);
  } else {
    body.set('payment_intent_data[metadata][userId]', input.userId);
    body.set('payment_intent_data[metadata][planCode]', input.planCode);
  }
  return body;
}

export function buildStripeCheckoutRequest(input: CheckoutInput, opts: { secretKey: string }): StripeCheckoutRequest {
  const secretKey = requireCheckoutField(opts.secretKey, 'STRIPE_SECRET_KEY');
  return {
    url: 'https://api.stripe.com/v1/checkout/sessions',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2024-06-20',
    },
    body: buildStripeCheckoutBody(input),
  };
}

export function summarizeStripeCheckoutRequest(input: {
  planCode: string;
  mode: CheckoutMode;
  productCount: number;
  hasCustomerEmail: boolean;
}): Record<string, string | number | boolean> {
  return {
    planCode: input.planCode,
    mode: input.mode,
    productCount: input.productCount,
    hasCustomerEmail: input.hasCustomerEmail,
    endpoint: 'redacted',
    priceId: 'redacted',
    secretKey: 'redacted',
  };
}
