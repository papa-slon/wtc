import { signWebhook } from './webhook.ts';

export type StripeReplayEventType =
  | 'checkout.session.completed'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'invoice.payment_action_required'
  | 'customer.subscription.deleted'
  | 'charge.refunded'
  | 'charge.dispute.created'
  | 'charge.dispute.closed';

export interface StripeReplayEventInput {
  id: string;
  type: StripeReplayEventType;
  userId?: string;
  planCode?: string;
  subscription?: string;
  currentPeriodEnd?: number;
  status?: string;
}

export interface StripeReplaySignedRequestInput {
  rawBody: string;
  webhookSecret: string;
  nowMs: number;
  url?: string;
}

export interface StripeReplayCaseSummary {
  name: string;
  result: 'passed' | 'failed';
  httpStatus: number;
  ledgerStatus?: 'applied' | 'manual_review' | 'processing' | 'not_written';
  productsChanged?: number;
  manualReviewItems?: number;
}

export function assertStripeWebhookReplaySecret(value: string | undefined): string {
  const secret = value?.trim();
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is required for captured Stripe webhook replay');
  }
  if (!secret.startsWith('whsec_')) {
    throw new Error('STRIPE_WEBHOOK_SECRET must use the Stripe webhook secret prefix');
  }
  return secret;
}

export function buildStripeReplayEvent(input: StripeReplayEventInput): string {
  const object: Record<string, unknown> = {
    metadata: {},
  };
  const metadata = object.metadata as Record<string, string>;
  if (input.userId) {
    metadata.userId = input.userId;
    object.client_reference_id = input.userId;
  }
  if (input.planCode) metadata.planCode = input.planCode;
  if (input.subscription) object.subscription = input.subscription;
  if (input.currentPeriodEnd) object.current_period_end = input.currentPeriodEnd;
  if (input.status) object.status = input.status;

  return JSON.stringify({
    id: input.id,
    object: 'event',
    type: input.type,
    livemode: false,
    data: { object },
  });
}

export function buildStripeReplaySignedRequest(input: StripeReplaySignedRequestInput): Request {
  const signature = signWebhook(input.rawBody, input.webhookSecret, Math.floor(input.nowMs / 1000));
  return new Request(input.url ?? 'https://wtc.local/api/billing/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': signature },
    body: input.rawBody,
  });
}

export function summarizeStripeReplayCase(input: StripeReplayCaseSummary): StripeReplayCaseSummary {
  return {
    name: input.name,
    result: input.result,
    httpStatus: input.httpStatus,
    ledgerStatus: input.ledgerStatus,
    productsChanged: input.productsChanged,
    manualReviewItems: input.manualReviewItems,
  };
}
