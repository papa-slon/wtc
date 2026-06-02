import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * PG7 (20260530-2330) — static guarantees for the LMS server-action security pipeline.
 *
 * vitest excludes apps/web/** (vitest.config.ts), and these server actions need Next request context
 * (cookies/session) that cannot be executed in a node test. So — like csrf-coverage.test.ts — we assert
 * the two PG7 invariants by static analysis of the source:
 *   (1) CSRF-first: assertCsrf() precedes requireUser() in every exported action.
 *   (2) No silent authz return: every RBAC/ownership/entitlement denial goes through a guard helper
 *       that audits + throws — none of the old `if (!isTeacher) return` / `ownsCourse` patterns remain.
 *   (3) The guard helpers themselves both audit AND throw on every denial branch.
 */
const LMS_DIR = join(process.cwd(), 'apps', 'web', 'src', 'features', 'lms');
const ACTIONS = readFileSync(join(LMS_DIR, 'actions.ts'), 'utf8');
const GUARD = readFileSync(join(LMS_DIR, 'guard.ts'), 'utf8');

interface Fn {
  name: string;
  body: string;
}

/** Slice the file into exported `async function ...Action(...)` bodies. */
function exportedActions(src: string): Fn[] {
  const re = /export async function (\w+Action)\s*\(/g;
  const starts: { name: string; idx: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) starts.push({ name: m[1]!, idx: m.index });
  return starts.map((s, i) => ({
    name: s.name,
    body: src.slice(s.idx, i + 1 < starts.length ? starts[i + 1]!.idx : src.length),
  }));
}

describe('LMS pipeline — CSRF-first ordering (PG7)', () => {
  const fns = exportedActions(ACTIONS);

  it('finds all 14 LMS server actions', () => {
    expect(fns.map((f) => f.name).sort()).toEqual(
      [
        'adminEnrollAction',
        'createPinnedLinkAction',
        'createCourseAction',
        'createLessonAction',
        'createMaterialAction',
        'deletePinnedLinkAction',
        'deleteMaterialAction',
        'enrollAction',
        'markLessonCompleteAction',
        'saveTeacherProfileAction',
        'setCoursePublishedAction',
        'setLessonPublishedAction',
        'updateCourseAction',
        'updateLessonAction',
      ].sort(),
    );
  });

  it('calls assertCsrf() before requireUser() in every action', () => {
    for (const f of fns) {
      const csrf = f.body.indexOf('assertCsrf(');
      const auth = f.body.indexOf('requireUser(');
      expect(csrf, `${f.name}: missing assertCsrf`).toBeGreaterThanOrEqual(0);
      expect(auth, `${f.name}: missing requireUser`).toBeGreaterThanOrEqual(0);
      expect(csrf, `${f.name}: assertCsrf must precede requireUser`).toBeLessThan(auth);
    }
  });

  it('makes assertCsrf the first awaited statement in every action', () => {
    for (const f of fns) {
      const firstAwait = f.body.indexOf('await ');
      const csrfAwait = f.body.indexOf('await assertCsrf(');
      expect(csrfAwait, `${f.name}: assertCsrf is not the first await`).toBe(firstAwait);
    }
  });
});

describe('LMS pipeline — no silent authorization return (PG7)', () => {
  it('contains none of the pre-PG7 silent-return authz patterns', () => {
    expect(ACTIONS).not.toMatch(/if \(!isTeacher\) return/);
    expect(ACTIONS).not.toMatch(/if \(!isAdmin\) return/);
    expect(ACTIONS).not.toMatch(/ownsCourse/);
    expect(ACTIONS).not.toMatch(/if \(!access\.allowed\) return/);
  });

  it('routes every authz check through the audit+throw guard helpers', () => {
    expect(ACTIONS).toContain("from './guard'");
    for (const helper of ['requireTeacher', 'requireAdmin', 'requireCourseOwnership', 'requireEducationAccess']) {
      expect(ACTIONS, `actions.ts should use ${helper}`).toContain(helper);
    }
  });
});

describe('LMS guard helpers — audit then throw on every denial (PG7)', () => {
  const re = /export async function (require\w+)\s*\(/g;
  const names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(GUARD)) !== null) names.push(m[1]!);

  it('exposes the four guard helpers', () => {
    expect(names.sort()).toEqual(['requireAdmin', 'requireCourseOwnership', 'requireEducationAccess', 'requireTeacher']);
  });

  it('each guard both writes a denial audit and throws AppError', () => {
    // auditDenied() is the shared sink; every guard reaches it then throws.
    expect(GUARD).toContain('await auditDenied(');
    expect(GUARD).toContain("audit.write(");
    expect(GUARD).toContain("result: 'failure'");
    expect((GUARD.match(/throw new AppError\(/g) ?? []).length).toBeGreaterThanOrEqual(4);
    // both denial codes are used
    expect(GUARD).toContain("'education.rbac_denied'");
    expect(GUARD).toContain("'education.entitlement_denied'");
  });

  it('uses the fail-closed error codes (forbidden / entitlement_denied)', () => {
    expect(GUARD).toContain("'forbidden'");
    expect(GUARD).toContain("'entitlement_denied'");
  });
});
