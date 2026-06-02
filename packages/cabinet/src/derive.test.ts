import { describe, it, expect } from 'vitest';
import {
  deriveProductCard,
  reasonTone,
  reasonLabel,
  ACCESS_REASON_COPY,
  type CabinetCardInput,
} from './derive.ts';

const NOW = 1_700_000_000_000;

function base(over: Partial<CabinetCardInput> = {}): CabinetCardInput {
  return {
    productCode: 'tortila_bot',
    name: 'Tortila Bot',
    description: 'Turtle-system bot.',
    href: '/app/bots/tortila',
    reason: 'allowed',
    allowed: true,
    availability: 'demo',
    isDemo: false,
    checkoutEnabled: false,
    now: NOW,
    ...over,
  };
}

describe('@wtc/cabinet canonical reason copy', () => {
  it('covers every AccessReason with a label + tone + detail', () => {
    const reasons = Object.keys(ACCESS_REASON_COPY);
    expect(reasons).toHaveLength(10);
    for (const r of reasons) {
      const c = ACCESS_REASON_COPY[r as keyof typeof ACCESS_REASON_COPY];
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.detail.length).toBeGreaterThan(0);
      expect(['ok', 'warn', 'bad', 'neutral', 'gold']).toContain(c.tone);
    }
  });

  it('reasonTone / reasonLabel delegate to the canonical map', () => {
    expect(reasonTone('allowed')).toBe('ok');
    expect(reasonTone('grace')).toBe('warn');
    expect(reasonTone('expired')).toBe('bad');
    expect(reasonTone('blocked_no_entitlement')).toBe('neutral');
    expect(reasonLabel('manual_review')).toBe('Manual review');
  });
});

describe('@wtc/cabinet deriveProductCard — entitlement zone', () => {
  it('maps reason → label/tone from the canonical map', () => {
    const v = deriveProductCard(base({ reason: 'grace', allowed: true }));
    expect(v.entitlement.label).toBe('Grace period');
    expect(v.entitlement.tone).toBe('warn');
  });

  it('computes expiresInDays from periodEnd (ceil)', () => {
    const v = deriveProductCard(base({ periodEnd: NOW + 10 * 86_400_000 }));
    expect(v.entitlement.expiresInDays).toBe(10);
  });

  it('expiresInDays is null when no periodEnd', () => {
    expect(deriveProductCard(base({ periodEnd: null })).entitlement.expiresInDays).toBeNull();
  });

  it('expiresInDays goes negative for a past periodEnd', () => {
    const v = deriveProductCard(base({ reason: 'expired', allowed: false, periodEnd: NOW - 5 * 86_400_000 }));
    expect(v.entitlement.expiresInDays).toBeLessThan(0);
  });
});

describe('@wtc/cabinet deriveProductCard — next action (fail-closed CTA routing)', () => {
  it('not owned + checkout disabled → Contact support (never a config route)', () => {
    const v = deriveProductCard(base({ reason: 'blocked_no_entitlement', allowed: false, checkoutEnabled: false }));
    expect(v.nextAction.label).toBe('Contact support');
    expect(v.nextAction.href).toBe('/app/support');
    expect(v.nextAction.href).not.toContain('/setup');
  });

  it('not owned + checkout enabled → Get access → billing', () => {
    const v = deriveProductCard(base({ reason: 'blocked_no_entitlement', allowed: false, checkoutEnabled: true }));
    expect(v.nextAction.label).toBe('Get access');
    expect(v.nextAction.href).toBe('/app/billing');
  });

  it('expired + checkout disabled → Contact support; enabled → Renew', () => {
    expect(deriveProductCard(base({ reason: 'expired', allowed: false })).nextAction.label).toBe('Contact support');
    expect(deriveProductCard(base({ reason: 'expired', allowed: false, checkoutEnabled: true })).nextAction.label).toBe('Renew');
  });

  it('pending_payment → View status → billing', () => {
    const v = deriveProductCard(base({ reason: 'pending_payment', allowed: false }));
    expect(v.nextAction.label).toBe('View status');
    expect(v.nextAction.href).toBe('/app/billing');
  });

  it('revoked / chargeback → View status → support', () => {
    for (const reason of ['revoked', 'chargeback', 'refunded', 'manual_review'] as const) {
      const v = deriveProductCard(base({ reason, allowed: false }));
      expect(v.nextAction.label).toBe('View status');
      expect(v.nextAction.href).toBe('/app/support');
    }
  });

  it('planned product (club) → Coming soon, non-navigating, disabled', () => {
    const v = deriveProductCard(base({ productCode: 'club', allowed: false, reason: 'blocked_no_entitlement', availability: 'planned' }));
    expect(v.nextAction.label).toBe('Coming soon');
    expect(v.nextAction.href).toBeNull();
    expect(v.nextAction.disabled).toBe(true);
  });

  it('owned tortila with incomplete setup → Finish setup → wizard route', () => {
    const v = deriveProductCard(base({ allowed: true, reason: 'allowed', signals: { setupItems: [{ label: 'Add key', done: false }, { label: 'Configure', done: true }] } }));
    expect(v.nextAction.label).toBe('Finish setup');
    expect(v.nextAction.href).toBe('/app/bots/tortila/setup');
  });

  it('owned tortila with all setup done → Open', () => {
    const v = deriveProductCard(base({ allowed: true, reason: 'allowed', signals: { setupItems: [{ label: 'Add key', done: true }] } }));
    expect(v.nextAction.label).toBe('Open');
    expect(v.nextAction.href).toBe('/app/bots/tortila');
  });

  it('owned TradingView with no username yet → Submit username', () => {
    const v = deriveProductCard(base({ productCode: 'tradingview_indicators', href: '/app/indicators', allowed: true, reason: 'allowed', signals: { setupItems: [{ label: 'Submit TradingView username', done: false }] } }));
    expect(v.nextAction.label).toBe('Submit username');
    expect(v.nextAction.href).toBe('/app/indicators');
  });

  it('owned but B3-blocked (legacy) → View status (ghost), never implies live data', () => {
    const v = deriveProductCard(base({ productCode: 'legacy_bot', href: '/app/bots/legacy', allowed: true, reason: 'allowed', blockerRef: 'B3', signals: { setupItems: [{ label: 'Add key', done: false }] } }));
    expect(v.nextAction.label).toBe('View status');
    expect(v.nextAction.variant).toBe('ghost');
    expect(v.nextAction.label).not.toBe('Finish setup');
  });

  it('owned but B4-blocked (axioma) → View details (ghost)', () => {
    const v = deriveProductCard(base({ productCode: 'axioma_terminal', href: '/app/terminal', allowed: true, reason: 'allowed', blockerRef: 'B4' }));
    expect(v.nextAction.label).toBe('View details');
    expect(v.nextAction.variant).toBe('ghost');
  });
});

describe('@wtc/cabinet deriveProductCard — blockers + warnings', () => {
  it('surfaces the static blocker ref honestly', () => {
    const v = deriveProductCard(base({ productCode: 'legacy_bot', allowed: false, reason: 'blocked_no_entitlement', blockerRef: 'B3' }));
    expect(v.blockers.find((b) => b.ref === 'B3')).toBeTruthy();
  });

  it('adds a demo persistence note when isDemo', () => {
    const v = deriveProductCard(base({ isDemo: true }));
    expect(v.blockers.find((b) => b.ref === 'demo')).toBeTruthy();
  });

  it('no blockers when not demo and not blocked', () => {
    const v = deriveProductCard(base({ isDemo: false, blockerRef: null }));
    expect(v.blockers).toHaveLength(0);
  });

  it('surfaces persistent warnings only when allowed', () => {
    const withWarn = { setupItems: [], warnings: { count: 2, maxSeverity: 'error' as const } };
    expect(deriveProductCard(base({ allowed: true, reason: 'allowed', signals: withWarn })).warnings.count).toBe(2);
  });
});

describe('@wtc/cabinet deriveProductCard — FAIL-CLOSED invariants', () => {
  // U-FC-01: a non-allowed product never exposes setup items, even if signals are (wrongly) passed.
  it('U-FC-01: not-allowed ignores any passed setup signals', () => {
    const v = deriveProductCard(base({
      allowed: false,
      reason: 'blocked_no_entitlement',
      signals: { setupItems: [{ label: 'leak', done: true }], activityLine: 'secret activity', warnings: { count: 9, maxSeverity: 'error' } },
    }));
    expect(v.setup.items).toHaveLength(0);
    expect(v.setup.state).toBe('not_applicable');
    expect(v.activity.line).toBeNull();
    expect(v.warnings.count).toBe(0);
  });

  // U-FC-02: not-allowed activity is always null.
  it('U-FC-02: not-allowed activity line is null', () => {
    const v = deriveProductCard(base({ allowed: false, reason: 'expired', signals: { activityLine: 'last login 5m ago' } }));
    expect(v.activity.line).toBeNull();
    expect(v.activity.at).toBeNull();
  });

  // U-FC-03: a non-allowed product CTA never routes to a /setup (config) surface.
  it('U-FC-03: no denied reason routes to a /setup config surface', () => {
    for (const reason of ['blocked_no_entitlement', 'expired', 'revoked', 'pending_payment', 'manual_review', 'chargeback', 'refunded'] as const) {
      const v = deriveProductCard(base({ allowed: false, reason }));
      expect(v.nextAction.href === null || !v.nextAction.href.includes('/setup')).toBe(true);
    }
  });

  // U-FC-04: an owned-but-blocked product never gets a "Finish setup"/"Open" CTA implying live data.
  it('U-FC-04: B3/B4 owned products never imply live data via the CTA', () => {
    const b3 = deriveProductCard(base({ productCode: 'legacy_bot', allowed: true, reason: 'allowed', blockerRef: 'B3', signals: { setupItems: [{ label: 'k', done: false }] } }));
    const b4 = deriveProductCard(base({ productCode: 'axioma_terminal', allowed: true, reason: 'allowed', blockerRef: 'B4' }));
    expect(['View status', 'View details']).toContain(b3.nextAction.label);
    expect(['View status', 'View details']).toContain(b4.nextAction.label);
  });

  // U-FC-05: determinism — same input twice yields a deeply equal view.
  it('U-FC-05: deterministic for identical input', () => {
    const input = base({ reason: 'grace', allowed: true, periodEnd: NOW + 3 * 86_400_000, signals: { setupItems: [{ label: 'k', done: true }] } });
    expect(deriveProductCard(input)).toEqual(deriveProductCard(input));
  });
});
