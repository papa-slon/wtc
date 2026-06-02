/**
 * POST /api/billing/webhook - Stripe (and compatible) webhook receiver.
 *
 * SECURITY NOTE: this route is intentionally CSRF-exempt. Its only authentication is the Stripe
 * HMAC-SHA256 signature, verified before JSON parsing or DB mutation. The raw body, signature,
 * webhook secret, and payment payload are never logged, stored, or returned.
 *
 * Idempotency is enforced by the billing_webhook_events ledger. Duplicate delivery only returns
 * 200 after the existing ledger row is terminal; duplicate in-flight rows return 500 so Stripe can
 * retry. Stale non-terminal rows are deleted before the retry response.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getServerDb } from '@/lib/backend';
import { handleBillingWebhookRequest } from '@/features/billing/webhook-handler';

export async function POST(req: Request): Promise<Response> {
  return handleBillingWebhookRequest(req, { db: getServerDb(), env: process.env });
}
