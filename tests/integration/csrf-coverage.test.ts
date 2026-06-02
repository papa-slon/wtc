import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Static guarantee: EVERY authenticated mutating server action calls assertCsrf().
 * loginAction + registerAction are the only exemptions (pre-session — no session cookie exists yet).
 * This runs in CI and fails if a new `'use server'` action ships without CSRF.
 */
const APP_DIR = join(process.cwd(), 'apps', 'web', 'src', 'app');

function listActionFiles(): string[] {
  const all = readdirSync(APP_DIR, { recursive: true }) as string[];
  return all
    .filter((f) => typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.tsx')))
    .map((f) => join(APP_DIR, f))
    .filter((p) => readFileSync(p, 'utf8').includes("'use server'"));
}

describe('CSRF coverage of authenticated mutating server actions', () => {
  const files = listActionFiles();

  it('finds the known server-action files', () => {
    expect(files.length).toBeGreaterThanOrEqual(7);
  });

  it('every server action calls assertCsrf, except pre-session login/register', () => {
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const actionCount = (src.match(/'use server'/g) ?? []).length;
      const csrfCount = (src.match(/assertCsrf\(/g) ?? []).length;
      const norm = file.replace(/\\/g, '/');
      const isAuthActions = norm.endsWith('(auth)/actions.ts');
      const exempt = isAuthActions ? 2 : 0; // loginAction + registerAction
      expect(csrfCount, `${norm}: ${csrfCount} assertCsrf for ${actionCount} actions (exempt=${exempt})`).toBeGreaterThanOrEqual(actionCount - exempt);
    }
  });

  it('the auth actions file protects logout but exempts login/register', () => {
    const auth = files.find((f) => f.replace(/\\/g, '/').endsWith('(auth)/actions.ts'))!;
    const src = readFileSync(auth, 'utf8');
    expect(src).toContain('logoutAction(formData: FormData)');
    expect(src.match(/assertCsrf\(/g)?.length).toBe(1); // exactly logout
  });
});
