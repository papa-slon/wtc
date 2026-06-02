import { PLANS, PRODUCTS, type PlanDef, type ProductCode } from '@wtc/entitlements';

export interface PricingPlanCard {
  code: string;
  name: string;
  billing: string;
  isBundle: boolean;
  productCodes: ProductCode[];
  productNames: string[];
  /** Display label only. Never expose raw Stripe price IDs here. */
  priceDisplay: string;
}

export function buildPricingCards(opts: { priceLabels?: Record<string, string> } = {}): PricingPlanCard[] {
  return Object.values(PLANS)
    .filter((p: PlanDef) => p.code !== 'admin_grant')
    .map((p: PlanDef) => ({
      code: p.code,
      name: p.name,
      billing: p.billing,
      isBundle: p.kind === 'bundle',
      productCodes: p.products,
      productNames: p.products.map((c) => PRODUCTS[c]?.name ?? c),
      priceDisplay: opts.priceLabels?.[p.code] ?? '—',
    }));
}
