import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

function sourceForFunction(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = src.indexOf('\n// ----', start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

describe('admin account unlock static guardrails', () => {
  it('keeps the unlock action on the admin RBAC, CSRF, Zod, repo, revalidate pipeline', () => {
    const actions = read('apps/web/src/features/admin/actions.ts');
    const unlock = sourceForFunction(actions, 'adminUnlockAccountAction');

    expect(unlock).toContain('const actor = await requireUser()');
    expect(unlock).toContain('assertAdmin(actor.roles)');
    expect(unlock).toContain('await assertCsrf(formData)');
    expect(unlock).toContain('unlockAccountSchema.safeParse');
    expect(unlock).toContain('unlockUserLoginLockout');
    expect(unlock).toContain("revalidatePath('/admin/users')");
    expect(unlock).toContain("revalidatePath('/admin/audit-log')");
    expect(unlock).not.toContain('auth.account_unlock');
    expect(unlock).not.toMatch(/password|tokenHash|SESSION_COOKIE/);

    expect(unlock.indexOf('assertAdmin(actor.roles)')).toBeLessThan(unlock.indexOf('await assertCsrf(formData)'));
    expect(unlock.indexOf('await assertCsrf(formData)')).toBeLessThan(unlock.indexOf('unlockAccountSchema.safeParse'));
    expect(unlock.indexOf('unlockAccountSchema.safeParse')).toBeLessThan(unlock.indexOf('unlockUserLoginLockout'));
  });

  it('requires a bounded admin unlock reason and a target user id', () => {
    const schemas = read('apps/web/src/features/admin/schemas.ts');
    expect(schemas).toContain('unlockAccountSchema');
    expect(schemas).toContain("userId: z.string().uuid('Invalid user ID')");
    expect(schemas).toContain("reason: z.string().trim().min(10, 'Reason must be at least 10 characters').max(500)");
  });

  it('renders the unlock form only inside the admin users table with CSRF and no bulk unlock', () => {
    const page = read('apps/web/src/app/admin/users/page.tsx');
    expect(page).toContain('adminUnlockAccountAction');
    expect(page).toContain('<CsrfField />');
    expect(page).toContain('name="userId"');
    expect(page).toContain('name="reason"');
    expect(page).toContain('minLength={10}');
    expect(page).toContain('maxLength={500}');
    expect(page).toContain('wtc-td-action');
    expect(page).toContain('u.lockout.unlockable');
    expect(page).not.toMatch(/unlock all/i);
  });

  it('keeps admin lockout DTOs explicit and password hashes out of the page/type boundary', () => {
    const types = read('apps/web/src/features/admin/types.ts');
    const queries = read('apps/web/src/features/admin/queries.ts');
    const page = read('apps/web/src/app/admin/users/page.tsx');

    expect(types).toContain('lockout:');
    expect(types).toContain('failedLoginTotalCount');
    expect(types).toContain('accountLockedUntil');
    expect(types).toContain('accountLockoutReviewRequiredAt');
    expect(queries).toContain('The passwordHash field is intentionally excluded');
    expect(queries).toContain('mapToAdminUserView');
    expect(page).not.toContain('passwordHash');
  });

  it('does not introduce public auth copy for locked or unlocked account state', () => {
    const authCopy = read('apps/web/src/features/auth/error-copy.ts');
    const loginAction = read('apps/web/src/app/(auth)/actions.ts');
    expect(authCopy).not.toMatch(/locked|unlock|remaining attempts|review required/i);
    expect(loginAction).toContain("redirect('/login?error=invalid_credentials')");
    expect(loginAction).not.toMatch(/locked|unlock|remaining attempts|review required/i);
  });
});
