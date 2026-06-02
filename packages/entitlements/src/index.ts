export {
  PRODUCT_CODES,
  PRODUCTS,
  PLANS,
  isProductCode,
  expandPlan,
} from './registry.ts';
export type { ProductCode, ProductDef, PlanDef, BillingCadence, PlanKind } from './registry.ts';

export { ENTITLEMENT_STATUSES, isGranting, nextStatus } from './state-machine.ts';
export type { EntitlementStatus, BillingEvent } from './state-machine.ts';

export {
  evaluateStatus,
  explainAccess,
  hasAccess,
  grantManual,
  entitlementsForPlan,
  applyBillingEvent,
  reconcileExpiry,
} from './engine.ts';
export type { Entitlement, EntitlementSource, AccessReason, AccessDecision } from './engine.ts';
