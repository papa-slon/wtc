/**
 * Product + plan registry. Canonical source of product codes, plan codes, and bundle expansion.
 * Zero dependencies (smoke-testable with `node`). See docs/handoffs/0000-orchestrator-seed.md.
 */

export const PRODUCT_CODES = [
  'tortila_bot',
  'legacy_bot',
  'axioma_terminal',
  'tradingview_indicators',
  'education',
  'club',
] as const;

export type ProductCode = (typeof PRODUCT_CODES)[number];

export interface ProductDef {
  code: ProductCode;
  /** public/app route slug — NOTE axioma_terminal uses slug `terminal` */
  slug: string;
  name: string;
}

export const PRODUCTS: Record<ProductCode, ProductDef> = {
  tortila_bot: { code: 'tortila_bot', slug: 'tortila', name: 'Tortila Bot' },
  legacy_bot: { code: 'legacy_bot', slug: 'legacy-bot', name: 'Legacy Bot' },
  axioma_terminal: { code: 'axioma_terminal', slug: 'terminal', name: 'Axioma Terminal' },
  tradingview_indicators: { code: 'tradingview_indicators', slug: 'indicators', name: 'TradingView Indicators' },
  education: { code: 'education', slug: 'education', name: 'Education' },
  club: { code: 'club', slug: 'club', name: 'Private Club' },
};

export type BillingCadence = 'one_time' | 'monthly' | 'yearly' | 'manual';
export type PlanKind = 'single' | 'bundle';

export interface PlanDef {
  code: string;
  products: ProductCode[];
  billing: BillingCadence;
  kind: PlanKind;
  name: string;
}

export const PLANS: Record<string, PlanDef> = {
  tortila_monthly: { code: 'tortila_monthly', products: ['tortila_bot'], billing: 'monthly', kind: 'single', name: 'Tortila — Monthly' },
  tortila_yearly: { code: 'tortila_yearly', products: ['tortila_bot'], billing: 'yearly', kind: 'single', name: 'Tortila — Yearly' },
  legacy_monthly: { code: 'legacy_monthly', products: ['legacy_bot'], billing: 'monthly', kind: 'single', name: 'Legacy Bot — Monthly' },
  axioma_monthly: { code: 'axioma_monthly', products: ['axioma_terminal'], billing: 'monthly', kind: 'single', name: 'Axioma Terminal — Monthly' },
  axioma_yearly: { code: 'axioma_yearly', products: ['axioma_terminal'], billing: 'yearly', kind: 'single', name: 'Axioma Terminal — Yearly' },
  indicators_quarterly: { code: 'indicators_quarterly', products: ['tradingview_indicators'], billing: 'one_time', kind: 'single', name: 'TradingView Indicators — Quarterly' },
  indicators_yearly: { code: 'indicators_yearly', products: ['tradingview_indicators'], billing: 'yearly', kind: 'single', name: 'TradingView Indicators — Yearly' },
  education_lifetime: { code: 'education_lifetime', products: ['education'], billing: 'one_time', kind: 'single', name: 'Education — Lifetime' },
  club_monthly: { code: 'club_monthly', products: ['club'], billing: 'monthly', kind: 'single', name: 'Private Club — Monthly' },
  bundle_pro: {
    code: 'bundle_pro',
    products: ['tortila_bot', 'axioma_terminal', 'tradingview_indicators', 'education'],
    billing: 'yearly',
    kind: 'bundle',
    name: 'WTC Pro Bundle',
  },
  bundle_starter: { code: 'bundle_starter', products: ['tortila_bot', 'education'], billing: 'monthly', kind: 'bundle', name: 'WTC Starter Bundle' },
  admin_grant: { code: 'admin_grant', products: [], billing: 'manual', kind: 'single', name: 'Manual Admin Grant' },
};

export function isProductCode(value: string): value is ProductCode {
  return (PRODUCT_CODES as readonly string[]).includes(value);
}

/** Expand a plan into the product codes it grants. Unknown plan → [] (fail closed). */
export function expandPlan(planCode: string): ProductCode[] {
  const plan = PLANS[planCode];
  return plan ? [...plan.products] : [];
}
