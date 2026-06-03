import 'server-only';
import { explainAccess, type AccessReason, type AccessDecision, type ProductCode } from '@wtc/entitlements';
import { entitlementsOf } from '@/lib/backend';

export async function accessFor(userId: string, productCode: ProductCode): Promise<AccessDecision> {
  const ents = await entitlementsOf(userId);
  return explainAccess(ents, productCode, Date.now());
}

export async function botAccessForUser(user: { id: string; roles: readonly string[] }, productCode: ProductCode): Promise<AccessDecision> {
  if (user.roles.includes('admin')) {
    return { allowed: true, reason: 'allowed', status: 'active', productCode };
  }
  return accessFor(user.id, productCode);
}

const LABELS: Record<AccessReason, string> = {
  allowed: 'Active',
  grace: 'Grace period',
  blocked_no_entitlement: 'Not owned',
  pending_payment: 'Pending payment',
  expired: 'Expired',
  revoked: 'Revoked',
  refunded: 'Refunded',
  chargeback: 'Chargeback',
  manual_review: 'Manual review',
  blocked_unknown_state: 'Unknown',
};

export function reasonLabel(reason: AccessReason): string {
  return LABELS[reason] ?? 'Unknown';
}

export type AccessTone = 'ok' | 'warn' | 'bad' | 'neutral';
export function reasonTone(reason: AccessReason): AccessTone {
  if (reason === 'allowed') return 'ok';
  if (reason === 'grace' || reason === 'pending_payment' || reason === 'manual_review') return 'warn';
  if (reason === 'blocked_no_entitlement') return 'neutral';
  return 'bad';
}
