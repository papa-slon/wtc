import { describe, it, expect } from 'vitest';
import { can, assertAdmin, AccessDeniedError } from './rbac.ts';

describe('RBAC assertAdmin (admin server-action guard)', () => {
  it('passes for an admin', () => {
    expect(() => assertAdmin(['admin'])).not.toThrow();
    expect(() => assertAdmin(['user', 'admin'])).not.toThrow();
  });
  it('throws AccessDeniedError for non-admins (incl. empty roles)', () => {
    expect(() => assertAdmin(['user'])).toThrow(AccessDeniedError);
    expect(() => assertAdmin(['teacher', 'user'])).toThrow(AccessDeniedError);
    expect(() => assertAdmin([])).toThrow(AccessDeniedError);
  });
  it('matrix: only admin manages entitlements', () => {
    expect(can(['admin'], 'entitlement', 'manage')).toBe(true);
    expect(can(['user'], 'entitlement', 'manage')).toBe(false);
    expect(can(['support'], 'entitlement', 'manage')).toBe(false);
  });
});
