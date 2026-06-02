/**
 * Server-side RBAC. Role-level capability matrix + ownership refinements.
 * `import type` is erased at runtime, so this file runs under bare Node for smoke tests.
 * See docs/RBAC_MATRIX.md.
 */
import type { Role } from '@wtc/shared';

export type Action = 'read' | 'create' | 'update' | 'delete' | 'manage';
export type Resource =
  | 'user'
  | 'product'
  | 'entitlement'
  | 'bot_config'
  | 'bot_instance'
  | 'exchange_key'
  | 'exchange_account'
  | 'tradingview_access'
  | 'course'
  | 'lesson'
  | 'material'
  | 'enrollment'
  | 'terminal_account_link'
  | 'notification'
  | 'audit_log'
  | 'support_ticket'
  | 'support_ticket_reply'
  | 'system_health';

// Role-level capability. Ownership ("own course", "own keys") is enforced separately.
const MATRIX: Record<Resource, Partial<Record<Action, Role[]>>> = {
  user: { read: ['admin', 'support'], manage: ['admin'] },
  product: { read: ['user', 'teacher', 'admin', 'support'], manage: ['admin'] },
  entitlement: { read: ['user', 'admin', 'support'], manage: ['admin'] },
  bot_config: { read: ['user', 'admin'], create: ['user'], update: ['user'] },
  // bot instance lifecycle (WTC-side record only; live control is always disabled by policy)
  bot_instance: { read: ['user', 'admin'], create: ['user'], update: ['user'], manage: ['admin'] },
  // exchange secrets: owner may write/delete; NOBODY reads plaintext (read = masked metadata only)
  exchange_key: { read: ['user'], create: ['user'], update: ['user'], delete: ['user', 'admin'] },
  exchange_account: { read: ['user'], create: ['user'], update: ['user'], delete: ['user', 'admin'] },
  tradingview_access: { read: ['user', 'admin', 'support'], create: ['user'], manage: ['admin'] },
  course: { read: ['user', 'teacher', 'admin'], create: ['teacher', 'admin'], update: ['teacher', 'admin'], delete: ['teacher', 'admin'], manage: ['admin'] },
  lesson: { read: ['user', 'teacher', 'admin'], create: ['teacher', 'admin'], update: ['teacher', 'admin'], delete: ['teacher', 'admin'], manage: ['admin'] },
  material: { read: ['user', 'teacher', 'admin'], create: ['teacher', 'admin'], update: ['teacher', 'admin'], delete: ['teacher', 'admin'], manage: ['admin'] },
  // a student enrolls themselves (ownership-checked); admin manages all enrollments
  enrollment: { read: ['user', 'teacher', 'admin'], create: ['user', 'admin'], manage: ['admin'] },
  // Axioma device/account link: owner initiates/revokes; admin manages
  terminal_account_link: { read: ['user', 'admin'], create: ['user'], delete: ['user', 'admin'], manage: ['admin'] },
  // user reads + marks own notifications read; admin manages
  notification: { read: ['user', 'admin'], update: ['user'], manage: ['admin'] },
  audit_log: { read: ['admin', 'support'] },
  support_ticket: { read: ['user', 'support', 'admin'], create: ['user'], manage: ['support', 'admin'] },
  support_ticket_reply: { read: ['user', 'support', 'admin'], create: ['user', 'support', 'admin'], manage: ['support', 'admin'] },
  system_health: { read: ['admin', 'support'] },
};

/** Role-level permission check. `manage` implies all actions. */
export function can(roles: readonly Role[], resource: Resource, action: Action): boolean {
  const res = MATRIX[resource];
  if (!res) return false;
  const managers = res.manage ?? [];
  if (managers.some((r) => roles.includes(r))) return true;
  const allowed = res[action] ?? [];
  return allowed.some((r) => roles.includes(r));
}

/**
 * Ownership refinement: a non-admin may only act on their own object. Admins bypass ownership
 * (but still cannot READ exchange-key plaintext — enforced by the vault, not RBAC).
 */
export function canActOnOwned(
  roles: readonly Role[],
  resource: Resource,
  action: Action,
  actorUserId: string,
  ownerUserId: string,
): boolean {
  if (!can(roles, resource, action)) return false;
  if (roles.includes('admin')) return true;
  return actorUserId === ownerUserId;
}

export class AccessDeniedError extends Error {
  constructor(message = 'FORBIDDEN') {
    super(message);
    this.name = 'AccessDeniedError';
  }
}

/**
 * Throw unless the actor holds the admin role. MUST be the first statement of every admin-only
 * server action — a layout/render guard does NOT protect a directly-POSTed server action.
 */
export function assertAdmin(roles: readonly Role[]): void {
  if (!roles.includes('admin')) throw new AccessDeniedError('FORBIDDEN: admin role required');
}
