import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { authErrorCopy } from '../../apps/web/src/features/auth/error-copy.ts';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('auth error copy', () => {
  it('maps known auth error codes to neutral browser copy', () => {
    expect(authErrorCopy('invalid_form')).toEqual({
      code: 'invalid_form',
      detail: 'Check the form and try again.',
    });
    expect(authErrorCopy('invalid_credentials')).toEqual({
      code: 'invalid_credentials',
      detail: 'Invalid email or password.',
    });
    expect(authErrorCopy('rate_limited')).toEqual({
      code: 'rate_limited',
      detail: 'Too many attempts. Wait a minute and try again.',
    });
  });

  it('does not render hostile or account-specific query-string text', () => {
    expect(authErrorCopy('That email is already registered')).toEqual({
      code: 'temporary',
      detail: 'We could not complete that request. Check the form or try again shortly.',
    });
    expect(authErrorCopy('<script>alert(1)</script>')).toEqual({
      code: 'temporary',
      detail: 'We could not complete that request. Check the form or try again shortly.',
    });
    expect(authErrorCopy(undefined)).toBeNull();
  });

  it('keeps auth pages and actions on stable error codes', () => {
    const login = read('apps/web/src/app/(auth)/login/page.tsx');
    const register = read('apps/web/src/app/(auth)/register/page.tsx');
    const actions = read('apps/web/src/app/(auth)/actions.ts');

    expect(login).toContain('authErrorCopy(error)');
    expect(login).not.toContain('detail={error}');
    expect(register).toContain('authErrorCopy(error)');
    expect(register).not.toContain('detail={error}');
    expect(register).not.toMatch(/Argon2id/i);
    expect(actions).not.toContain('That email is already registered');
    expect(actions).toContain('attemptLogin(parsed.data.email, parsed.data.password)');
    expect(actions).not.toContain('auth.login_failed');
    expect(actions).not.toContain('auth.register');
    expect(actions).toContain("redirect('/login?error=invalid_form')");
    expect(actions).toContain("redirect('/login?error=invalid_credentials')");
    expect(actions).toContain("redirect('/register?error=invalid_form')");
    expect(actions).toContain("redirect('/register?error=temporary')");
  });
});
