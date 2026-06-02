import {
  applyStripeEvent,
  insertWebhookEventOnce,
  getWebhookEventByProviderEvent,
  isBillingWebhookTerminalStatus,
  updateWebhookEventStatus,
  createManualReviewItem,
  upsertSubscription,
  listUsers,
  createNotification,
  schema,
  type Db,
} from '@wtc/db';
import { createStripeProvider, mapProviderEvent, type NormalizedEvent } from '@wtc/billing';
import { expandPlan, isProductCode, type ProductCode } from '@wtc/entitlements';
import type { BillingEvent } from '@wtc/entitlements';
import { and, eq } from 'drizzle-orm';

type ManualReviewReason = 'missing_user_id' | 'unknown_plan_code';
type BillingWebhookEnv = {
  STRIPE_WEBHOOK_SECRET?: string;
  NODE_ENV?: string;
};
type BillingWebhookLog = Pick<Console, 'log' | 'error'>;

export const WEBHOOK_PROCESSING_STALE_MS = 10 * 60 * 1000;

export interface BillingWebhookHandlerOptions {
  db: Db | null;
  env?: BillingWebhookEnv;
  now?: number;
  log?: BillingWebhookLog;
}

function isProduction(env: BillingWebhookEnv): boolean {
  return env.NODE_ENV === 'production';
}

async function notifyAdminsForManualReview(
  db: Db,
  event: NormalizedEvent,
  reason: ManualReviewReason,
  env: BillingWebhookEnv,
  log: BillingWebhookLog,
): Promise<void> {
  try {
    const allUsers = await listUsers(db);
    for (const adminUser of allUsers) {
      if (adminUser.roles.includes('admin')) {
        await createNotification(db, {
          userId: adminUser.id,
          type: 'billing_manual_review',
          title: 'Billing event requires manual review',
          body: `Webhook event ${event.id} (${event.type}) requires manual review (${reason}). Review at /admin/entitlements/review.`,
          linkUrl: '/admin/entitlements/review',
        });
      }
    }
  } catch (notifyErr) {
    if (!isProduction(env)) {
      const msg = notifyErr instanceof Error ? notifyErr.message : String(notifyErr);
      log.error('[billing/webhook] manual_review notification error', event.id, msg);
    }
  }
}

async function createBillingManualReview(
  db: Db,
  event: NormalizedEvent,
  reason: ManualReviewReason,
  env: BillingWebhookEnv,
  log: BillingWebhookLog,
  now: number,
): Promise<void> {
  await createManualReviewItem(
    db,
    {
      provider: 'stripe',
      eventId: event.id,
      eventType: event.type,
      userId: event.userId ?? null,
      reason,
      eventSnapshot: { id: event.id, type: event.type, planCode: event.planCode ?? null },
    },
    now,
  );
  await notifyAdminsForManualReview(db, event, reason, env, log);
}

async function deleteWebhookEventLedgerRow(db: Db, eventId: string): Promise<void> {
  await db
    .delete(schema.billingWebhookEvents)
    .where(
      and(
        eq(schema.billingWebhookEvents.provider, 'stripe'),
        eq(schema.billingWebhookEvents.eventId, eventId),
      ),
    );
}

function billingEventForProviderEvent(event: NormalizedEvent): BillingEvent | null {
  let billingEvent: BillingEvent | null = mapProviderEvent(event.type);

  if (event.type === 'charge.dispute.closed') {
    const disputeStatus = (event.raw as Record<string, unknown> & {
      data?: { object?: { status?: string } };
    })?.data?.object?.status;
    if (disputeStatus === 'won') {
      billingEvent = 'subscription_canceled';
    } else if (disputeStatus === 'lost') {
      billingEvent = 'refunded';
    } else {
      billingEvent = null;
    }
  }

  return billingEvent;
}

export async function handleBillingWebhookRequest(
  req: Request,
  opts: BillingWebhookHandlerOptions,
): Promise<Response> {
  const env = opts.env ?? process.env;
  const log = opts.log ?? console;
  const now = opts.now ?? Date.now();

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return Response.json({ error: 'bad_request', message: 'Failed to read request body' }, { status: 400 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return Response.json({ error: 'signature_invalid', message: 'Missing signature' }, { status: 400 });
  }

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return Response.json({ error: 'signature_invalid', message: 'Webhook not configured' }, { status: 400 });
  }

  let event: NormalizedEvent | null;
  try {
    const provider = createStripeProvider({ webhookSecret });
    event = await provider.parseWebhook(raw, sig, now);
  } catch {
    return Response.json({ error: 'signature_invalid', message: 'Signature verification failed' }, { status: 400 });
  }
  if (!event) {
    return Response.json({ error: 'signature_invalid', message: 'Signature verification failed' }, { status: 400 });
  }

  if (!isProduction(env)) {
    log.log('[billing/webhook] received event', event.id, event.type);
  }

  const db = opts.db;
  if (!db) {
    return Response.json({ received: true }, { status: 200 });
  }

  const billingEvent = billingEventForProviderEvent(event);
  if (!billingEvent) {
    return Response.json({ received: true }, { status: 200 });
  }

  const dedup = await insertWebhookEventOnce(db, {
    provider: 'stripe',
    eventId: event.id,
    eventType: event.type,
    userId: event.userId ?? null,
    planCode: event.planCode ?? null,
    billingEvent,
    status: 'processing',
    productsChanged: 0,
  });

  if (dedup.isDuplicate) {
    const existing = await getWebhookEventByProviderEvent(db, 'stripe', event.id);
    if (!existing || !isBillingWebhookTerminalStatus(existing.status)) {
      if (
        existing?.status === 'processing' &&
        now - existing.processedAt.getTime() > WEBHOOK_PROCESSING_STALE_MS
      ) {
        await deleteWebhookEventLedgerRow(db, event.id);
      }
      return Response.json(
        { error: 'webhook_processing', message: 'Webhook event has not reached a terminal processing state.' },
        { status: 500 },
      );
    }
    return Response.json({ received: true }, { status: 200 });
  }

  if (!event.userId) {
    try {
      await createBillingManualReview(db, event, 'missing_user_id', env, log, now);
    } catch (reviewErr) {
      try {
        await deleteWebhookEventLedgerRow(db, event.id);
      } catch {
        // Best-effort cleanup; the retry path still remains honest if deletion fails.
      }
      if (!isProduction(env)) {
        const msg = reviewErr instanceof Error ? reviewErr.message : String(reviewErr);
        log.error('[billing/webhook] manual_review creation error', event.id, msg);
      }
      return Response.json(
        { error: 'internal_error', message: 'Webhook processing failed. Event will be retried.' },
        { status: 500 },
      );
    }
    await updateWebhookEventStatus(db, 'stripe', event.id, 'manual_review', 0);
    return Response.json({ received: true }, { status: 200 });
  }

  const productCodes: ProductCode[] = event.planCode
    ? expandPlan(event.planCode).filter(isProductCode)
    : [];

  if (productCodes.length === 0) {
    try {
      await createBillingManualReview(db, event, 'unknown_plan_code', env, log, now);
    } catch (reviewErr) {
      try {
        await deleteWebhookEventLedgerRow(db, event.id);
      } catch {
        // Best-effort cleanup; the retry path still remains honest if deletion fails.
      }
      if (!isProduction(env)) {
        const msg = reviewErr instanceof Error ? reviewErr.message : String(reviewErr);
        log.error('[billing/webhook] manual_review creation error', event.id, msg);
      }
      return Response.json(
        { error: 'internal_error', message: 'Webhook processing failed. Event will be retried.' },
        { status: 500 },
      );
    }
    await updateWebhookEventStatus(db, 'stripe', event.id, 'manual_review', 0);
    return Response.json({ received: true }, { status: 200 });
  }

  if (event.planCode && event.providerRef) {
    const subStatus =
      billingEvent === 'refunded' || billingEvent === 'chargeback'
        ? 'canceled'
        : (event.subscriptionStatus ?? 'active');
    try {
      await upsertSubscription(db, {
        userId: event.userId,
        planCode: event.planCode,
        provider: 'stripe',
        providerRef: event.providerRef,
        status: subStatus,
        currentPeriodEnd: event.currentPeriodEnd ? new Date(event.currentPeriodEnd * 1000) : undefined,
      });
    } catch (subErr) {
      if (!isProduction(env)) {
        const msg = subErr instanceof Error ? subErr.message : String(subErr);
        log.error('[billing/webhook] upsertSubscription error', event.id, msg);
      }
    }
  }

  try {
    const result = await applyStripeEvent(
      db,
      {
        stripeEventId: event.id,
        billingEvent,
        userId: event.userId,
        productCodes,
        planCode: event.planCode,
      },
      now,
    );
    await updateWebhookEventStatus(db, 'stripe', event.id, 'applied', result.productsChanged);
    return Response.json({ received: true }, { status: 200 });
  } catch (err) {
    try {
      await deleteWebhookEventLedgerRow(db, event.id);
    } catch {
      // Best-effort cleanup; a failed delete leaves the durable ledger as the retry signal.
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (!isProduction(env)) {
      log.error('[billing/webhook] DB error processing event', event.id, msg);
    }
    return Response.json(
      { error: 'internal_error', message: 'Webhook processing failed. Event will be retried.' },
      { status: 500 },
    );
  }
}
