import { describe, expect, it } from 'vitest';
import { createStripeProvider } from './stripe.ts';
import {
  assertStripeWebhookReplaySecret,
  buildStripeReplayEvent,
  buildStripeReplaySignedRequest,
  summarizeStripeReplayCase,
} from './stripe-replay.ts';

const NOW = 1_900_000_000_000;
const SECRET = 'whsec_replay_test_secret';

describe('Stripe replay helpers', () => {
  it('builds a Stripe-like checkout event and signed request that the provider accepts', async () => {
    const raw = buildStripeReplayEvent({
      id: 'evt_replay_valid',
      type: 'checkout.session.completed',
      userId: '11111111-1111-4111-8111-111111111111',
      planCode: 'bundle_starter',
      subscription: 'sub_replay_valid',
      currentPeriodEnd: Math.floor((NOW + 30 * 24 * 60 * 60 * 1000) / 1000),
      status: 'active',
    });
    const req = buildStripeReplaySignedRequest({ rawBody: raw, webhookSecret: SECRET, nowMs: NOW });
    const parsed = await createStripeProvider({ webhookSecret: SECRET }).parseWebhook(
      raw,
      req.headers.get('stripe-signature') ?? '',
      NOW,
    );

    expect(parsed).toMatchObject({
      id: 'evt_replay_valid',
      type: 'checkout.session.completed',
      userId: '11111111-1111-4111-8111-111111111111',
      planCode: 'bundle_starter',
      providerRef: 'sub_replay_valid',
      subscriptionStatus: 'active',
    });
  });

  it('refuses missing or non-Stripe-shaped webhook secrets for captured replay', () => {
    expect(() => assertStripeWebhookReplaySecret(undefined)).toThrow(/required/);
    expect(() => assertStripeWebhookReplaySecret('not-a-webhook-secret')).toThrow(/prefix/);
    expect(assertStripeWebhookReplaySecret(SECRET)).toBe(SECRET);
  });

  it('summarizes a replay case without retaining request bodies or signatures', () => {
    const summary = summarizeStripeReplayCase({
      name: 'valid_checkout',
      result: 'passed',
      httpStatus: 200,
      ledgerStatus: 'applied',
      productsChanged: 2,
    });

    expect(summary).toEqual({
      name: 'valid_checkout',
      result: 'passed',
      httpStatus: 200,
      ledgerStatus: 'applied',
      productsChanged: 2,
      manualReviewItems: undefined,
    });
    expect(JSON.stringify(summary)).not.toContain('stripe-signature');
    expect(JSON.stringify(summary)).not.toContain('whsec_');
    expect(JSON.stringify(summary)).not.toContain('data');
  });
});
