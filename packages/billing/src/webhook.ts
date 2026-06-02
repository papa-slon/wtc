/**
 * Payment webhook verification + event mapping. See docs/PAYMENT_WEBHOOK_STATE_MACHINE.md and
 * docs/CONTRACTS/billing-webhooks.md. Stripe-style HMAC signature (t=...,v1=...), constant-time,
 * timestamp tolerance, idempotency, and mapping to the entitlement BillingEvent. Node-crypto only.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { BillingEvent } from '@wtc/entitlements';

export type VerifyResult = { valid: true } | { valid: false; reason: string };

/** Sign a raw body Stripe-style (used by the mock provider and tests). */
export function signWebhook(rawBody: string, secret: string, timestampSec: number): string {
  const sig = createHmac('sha256', secret).update(`${timestampSec}.${rawBody}`).digest('hex');
  return `t=${timestampSec},v1=${sig}`;
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  opts: { now: number; toleranceSec?: number },
): VerifyResult {
  const tolerance = opts.toleranceSec ?? 300;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const idx = kv.indexOf('=');
      return [kv.slice(0, idx).trim(), kv.slice(idx + 1).trim()];
    }),
  ) as { t?: string; v1?: string };

  if (!parts.t || !parts.v1) return { valid: false, reason: 'malformed_header' };
  const ts = Number(parts.t);
  if (!Number.isFinite(ts)) return { valid: false, reason: 'bad_timestamp' };
  if (Math.abs(Math.floor(opts.now / 1000) - ts) > tolerance) return { valid: false, reason: 'timestamp_out_of_tolerance' };

  const expected = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest();
  let got: Buffer;
  try {
    got = Buffer.from(parts.v1, 'hex');
  } catch {
    return { valid: false, reason: 'bad_signature_encoding' };
  }
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return { valid: false, reason: 'bad_signature' };
  return { valid: true };
}

/** Normalized provider event types we handle. */
const EVENT_MAP: Record<string, BillingEvent> = {
  'checkout.session.completed': 'payment_succeeded',
  'invoice.paid': 'payment_succeeded',
  'invoice.payment_failed': 'payment_failed',
  // Phase 2.4: invoice.payment_action_required (e.g. 3DS challenge) is also a payment failure path.
  // The subscription moves to incomplete/past_due; treat as payment_failed to trigger grace state.
  'invoice.payment_action_required': 'payment_failed',
  'customer.subscription.deleted': 'subscription_canceled',
  'charge.refunded': 'refunded',
  'charge.dispute.created': 'chargeback',
  // Phase 2.4: charge.dispute.closed outcome is handled specially in the route handler.
  // 'won' → subscription_canceled (chargeback lost, access restored? No: won means dispute resolved in our favour)
  // Route handler maps: won → subscription_canceled (Stripe closed it, merchant won, subscription may be cancelled),
  // lost → refunded (chargeback upheld, must revoke). We expose the raw event here with 'chargeback' fallback;
  // the route overrides the billingEvent based on the dispute status field.
  'charge.dispute.closed': 'chargeback',
};

/** Map a provider event type to an entitlement BillingEvent, or null if unhandled. */
export function mapProviderEvent(providerEventType: string): BillingEvent | null {
  return EVENT_MAP[providerEventType] ?? null;
}

/** Idempotency: stable dedupe key for a provider event. Handlers persist processed keys. */
export function dedupeKey(provider: string, eventId: string): string {
  return `${provider}:${eventId}`;
}

export function isDuplicate(seen: Set<string>, key: string): boolean {
  return seen.has(key);
}
