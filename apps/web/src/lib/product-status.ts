import type { ProductCode } from '@wtc/entitlements';
import type { Tone } from '@wtc/ui';

export type Availability = 'available' | 'demo' | 'planned' | 'disabled';

/**
 * Honest per-product availability for the current (pre-production) build.
 * - `demo`    → works as a dev/preview placeholder (mock adapter / dev bridge / in-memory), NOT production-wired.
 * - `planned` → not built yet.
 * - `available`/`disabled` → reserved for once integrations are real.
 * Single source of truth so the catalog and the product detail page never drift.
 */
export const PRODUCT_AVAILABILITY: Record<ProductCode, { status: Availability; note: string }> = {
  axioma_terminal: { status: 'demo', note: 'Dev bridge — production handoff/SSO pending' },
  tortila_bot: { status: 'demo', note: 'Mock adapter — live read-only data pending' },
  legacy_bot: { status: 'demo', note: 'Mock adapter — live read-only data pending' },
  tradingview_indicators: { status: 'demo', note: 'Manual admin queue, demo data' },
  education: { status: 'demo', note: 'Full LMS teacher/student/admin vertical landed Phase 2.2 (DB-backed; demo in this env)' },
  club: { status: 'planned', note: 'Not yet available' },
};

export function productAvailability(code: ProductCode): { status: Availability; note: string } {
  if (code === 'tortila_bot' && process.env.BOT_ADAPTER_MODE !== undefined && process.env.BOT_ADAPTER_MODE !== 'mock') {
    return {
      status: 'available',
      note: 'Live read-only monitoring canary - WTC DB snapshots only; live controls remain disabled until audited.',
    };
  }
  return PRODUCT_AVAILABILITY[code];
}

export const AVAILABILITY_TONE: Record<Availability, Tone> = {
  available: 'ok',
  demo: 'warn',
  planned: 'neutral',
  disabled: 'bad',
};

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  available: 'Available',
  demo: 'Demo / preview',
  planned: 'Planned',
  disabled: 'Disabled',
};
