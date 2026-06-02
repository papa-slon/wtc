import { describe, it, expect } from 'vitest';
import { expandPlan } from './registry.ts';
import { isGranting, nextStatus } from './state-machine.ts';
import {
  hasAccess,
  explainAccess,
  evaluateStatus,
  grantManual,
  entitlementsForPlan,
  applyBillingEvent,
  reconcileExpiry,
  type Entitlement,
} from './engine.ts';

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;
const U = 'u1';

const active = (over: Partial<Entitlement> = {}): Entitlement => ({
  userId: U, productCode: 'tortila_bot', status: 'active', source: 'subscription', updatedAt: NOW, ...over,
});

describe('fail-closed access', () => {
  it('denies when there are no entitlements', () => {
    expect(hasAccess([], 'tortila_bot', NOW)).toBe(false);
    expect(explainAccess([], 'tortila_bot', NOW).reason).toBe('blocked_no_entitlement');
  });

  it('only active and grace grant access; unknown denies', () => {
    for (const s of ['none', 'pending_payment', 'expired', 'revoked', 'refunded', 'chargeback', 'manual_review', 'weird']) {
      expect(isGranting(s)).toBe(false);
    }
    expect(isGranting('active')).toBe(true);
    expect(isGranting('grace')).toBe(true);
  });
});

describe('time transitions', () => {
  it('active → grace → expired across the period and grace window', () => {
    const e = active({ currentPeriodEnd: NOW + 10 * DAY, graceUntil: NOW + 13 * DAY });
    expect(evaluateStatus(e, NOW)).toBe('active');
    expect(evaluateStatus(e, NOW + 11 * DAY)).toBe('grace');
    expect(evaluateStatus(e, NOW + 20 * DAY)).toBe('expired');
  });

  it('lifetime entitlement (no end) stays active', () => {
    const e = active({ productCode: 'education', source: 'one_time' });
    expect(hasAccess([e], 'education', NOW + 99999 * DAY)).toBe(true);
  });

  it('reconcileExpiry persists drift', () => {
    const e = active({ currentPeriodEnd: NOW - DAY, graceUntil: NOW - 1 });
    expect(reconcileExpiry(e, NOW).status).toBe('expired');
  });
});

describe('bundles', () => {
  it('expands bundle_pro to its member products only', () => {
    expect(expandPlan('bundle_pro').sort()).toEqual(['axioma_terminal', 'education', 'tortila_bot', 'tradingview_indicators']);
    const ents = entitlementsForPlan(U, 'bundle_pro', NOW, { currentPeriodEnd: NOW + 365 * DAY });
    expect(hasAccess(ents, 'tradingview_indicators', NOW)).toBe(true);
    expect(hasAccess(ents, 'club', NOW)).toBe(false);
  });

  it('unknown plan expands to nothing (fail closed)', () => {
    expect(expandPlan('does_not_exist')).toEqual([]);
  });
});

describe('manual grant precedence + billing events', () => {
  it('manual grant survives billing downgrades but not manual_revoke/refund', () => {
    const m = grantManual(U, 'axioma_terminal', NOW);
    expect(applyBillingEvent(m, 'subscription_canceled', NOW).status).toBe('active');
    expect(applyBillingEvent(m, 'period_elapsed', NOW).status).toBe('active');
    expect(applyBillingEvent(m, 'manual_revoke', NOW).status).toBe('revoked');
    expect(applyBillingEvent(m, 'refunded', NOW).status).toBe('refunded');
  });

  it('refund/chargeback apply from any state', () => {
    expect(nextStatus('active', 'refunded')).toBe('refunded');
    expect(nextStatus('grace', 'chargeback')).toBe('chargeback');
    expect(nextStatus('pending_payment', 'payment_succeeded')).toBe('active');
  });

  it('payment_succeeded does not clear terminal or manual-review states', () => {
    for (const status of ['revoked', 'refunded', 'chargeback', 'manual_review'] as const) {
      expect(nextStatus(status, 'payment_succeeded')).toBe(status);
      expect(applyBillingEvent(active({ status }), 'payment_succeeded', NOW + 1).status).toBe(status);
    }
  });
});

describe('explainAccess', () => {
  it('prefers active over grace', () => {
    const ents = [active({ status: 'grace', graceUntil: NOW + DAY }), active({ currentPeriodEnd: NOW + DAY })];
    expect(explainAccess(ents, 'tortila_bot', NOW).reason).toBe('allowed');
  });
  it('reports the most actionable blocking reason', () => {
    const ents: Entitlement[] = [
      active({ productCode: 'education', status: 'expired' }),
      active({ productCode: 'education', status: 'manual_review' }),
    ];
    expect(explainAccess(ents, 'education', NOW).reason).toBe('manual_review');
  });
});
