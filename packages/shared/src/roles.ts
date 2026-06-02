export const ROLES = ['user', 'teacher', 'admin', 'support'] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function hasRole(userRoles: readonly Role[], role: Role): boolean {
  return userRoles.includes(role);
}

export function hasAnyRole(userRoles: readonly Role[], roles: readonly Role[]): boolean {
  return roles.some((r) => userRoles.includes(r));
}
