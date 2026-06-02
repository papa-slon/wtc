/**
 * Zero-dependency smoke test runnable with `node --experimental-strip-types`.
 * Verifies the fail-closed entitlement state machine without npm install / vitest.
 */
import assert from 'node:assert/strict';
import { expandPlan } from './registry.ts';
import { isGranting, nextStatus } from './state-machine.ts';
import {
  hasAccess,
  explainAccess,
  evaluateStatus,
  grantManual,
  entitlementsForPlan,
  applyBillingEvent,
  type Entitlement,
} from './engine.ts';

const NOW = 1_800_000_000_000; // fixed epoch ms
const DAY = 86_400_000;
const U = 'user-1';

// 1. fail-closed: no entitlements => deny, with reason
assert.equal(hasAccess([], 'tortila_bot', NOW), false);
assert.equal(explainAccess([], 'tortila_bot', NOW).reason, 'blocked_no_entitlement');

// 2. fail-closed: only active/grace grant; every other/unknown denies
for (const s of ['none', 'pending_payment', 'expired', 'revoked', 'refunded', 'chargeback', 'manual_review', 'bogus']) {
  assert.equal(isGranting(s), false, `status ${s} must NOT grant`);
}
assert.equal(isGranting('active'), true);
assert.equal(isGranting('grace'), true);

// 3. active subscription grants until period end, then grace, then expired
const sub: Entitlement = {
  userId: U, productCode: 'tortila_bot', status: 'active', source: 'subscription',
  currentPeriodEnd: NOW + 10 * DAY, graceUntil: NOW + 13 * DAY, updatedAt: NOW,
};
assert.equal(evaluateStatus(sub, NOW), 'active');
assert.equal(evaluateStatus(sub, NOW + 11 * DAY), 'grace');
assert.equal(evaluateStatus(sub, NOW + 14 * DAY), 'expired');
assert.equal(hasAccess([sub], 'tortila_bot', NOW + 11 * DAY), true, 'grace still grants');
assert.equal(hasAccess([sub], 'tortila_bot', NOW + 14 * DAY), false, 'expired denies');

// 4. bundle expansion: bundle_pro grants 4 products
const ents = entitlementsForPlan(U, 'bundle_pro', NOW, { currentPeriodEnd: NOW + 365 * DAY });
assert.deepEqual(expandPlan('bundle_pro').sort(), ['axioma_terminal', 'education', 'tortila_bot', 'tradingview_indicators']);
assert.equal(hasAccess(ents, 'axioma_terminal', NOW), true);
assert.equal(hasAccess(ents, 'club', NOW), false, 'product not in bundle stays denied');

// 5. manual grant precedence: billing events do not downgrade a manual grant
const manual = grantManual(U, 'axioma_terminal', NOW);
const afterCancel = applyBillingEvent(manual, 'subscription_canceled', NOW);
assert.equal(afterCancel.status, 'active', 'manual grant survives subscription_canceled');
const afterRevoke = applyBillingEvent(manual, 'manual_revoke', NOW);
assert.equal(afterRevoke.status, 'revoked', 'manual_revoke still revokes a manual grant');

// 6. refund/chargeback revoke from any state
assert.equal(nextStatus('active', 'refunded'), 'refunded');
assert.equal(nextStatus('grace', 'chargeback'), 'chargeback');
assert.equal(hasAccess([{ ...sub, status: 'refunded' }], 'tortila_bot', NOW), false);
assert.equal(nextStatus('refunded', 'payment_succeeded'), 'refunded', 'billing success does not resurrect refunded');
assert.equal(nextStatus('manual_review', 'payment_succeeded'), 'manual_review', 'billing success does not clear manual review');

// 7. explainAccess picks the most actionable blocking reason
const mixed: Entitlement[] = [
  { userId: U, productCode: 'education', status: 'expired', source: 'subscription', updatedAt: NOW },
  { userId: U, productCode: 'education', status: 'manual_review', source: 'subscription', updatedAt: NOW },
];
assert.equal(explainAccess(mixed, 'education', NOW).reason, 'manual_review');

// 8. lifetime (no end) stays active
const lifetime: Entitlement = { userId: U, productCode: 'education', status: 'active', source: 'one_time', updatedAt: NOW };
assert.equal(hasAccess([lifetime], 'education', NOW + 9999 * DAY), true);

console.log('OK  @wtc/entitlements: 8 checks passed (fail-closed, time transitions, bundles, manual precedence, refund, explain, lifetime)');
