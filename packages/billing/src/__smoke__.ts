import assert from 'node:assert/strict';
import { signWebhook, verifyWebhookSignature, mapProviderEvent, dedupeKey, isDuplicate } from './webhook.ts';
import { createMockBillingProvider } from './provider.ts';

const SECRET = 'whsec_dev';
const NOW = 1_800_000_000_000;
const body = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' });

// 1. valid signature
const header = signWebhook(body, SECRET, Math.floor(NOW / 1000));
assert.equal(verifyWebhookSignature(body, header, SECRET, { now: NOW }).valid, true);

// 2. tampered body fails
assert.equal(verifyWebhookSignature(body + ' ', header, SECRET, { now: NOW }).valid, false);

// 3. timestamp out of tolerance fails
assert.equal(verifyWebhookSignature(body, header, SECRET, { now: NOW + 10 * 60_000 }).valid, false);

// 4. wrong secret fails
assert.equal(verifyWebhookSignature(body, header, 'nope', { now: NOW }).valid, false);

// 5. event mapping
assert.equal(mapProviderEvent('invoice.paid'), 'payment_succeeded');
assert.equal(mapProviderEvent('charge.refunded'), 'refunded');
assert.equal(mapProviderEvent('charge.dispute.created'), 'chargeback');
assert.equal(mapProviderEvent('unknown.event'), null);

// 6. idempotency
const seen = new Set<string>();
const key = dedupeKey('stripe', 'evt_1');
assert.equal(isDuplicate(seen, key), false);
seen.add(key);
assert.equal(isDuplicate(seen, key), true);

// 7. mock provider forge -> parse -> map round trip
const provider = createMockBillingProvider(SECRET);
const forged = provider.forgeWebhook('invoice.payment_failed', { id: 'evt_9', userId: 'u1', planCode: 'tortila_monthly' }, NOW);
const parsed = await provider.parseWebhook(forged.body, forged.header, NOW);
assert.ok(parsed && parsed.type === 'invoice.payment_failed');
assert.equal(mapProviderEvent(parsed.type), 'payment_failed');
// invalid signature => null
assert.equal(await provider.parseWebhook(forged.body, 't=1,v1=deadbeef', NOW), null);

console.log('OK  @wtc/billing: webhook verify + mapping + idempotency + mock round-trip verified');
