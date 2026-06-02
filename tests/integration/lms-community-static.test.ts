import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const actions = read('apps/web/src/features/lms/actions.ts');
const queries = read('apps/web/src/features/lms/queries.ts');
const teacherLayout = read('apps/web/src/app/teacher/layout.tsx');
const teacherMaterials = read('apps/web/src/app/teacher/materials/page.tsx');
const teacherCourse = read('apps/web/src/app/teacher/courses/[id]/page.tsx');
const studentEducation = read('apps/web/src/app/(app)/app/education/page.tsx');
const studentCourse = read('apps/web/src/app/(app)/app/education/[courseId]/page.tsx');
const studentLesson = read('apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx');
const nav = read('apps/web/src/lib/nav.ts');

describe('Phase 3.3 — teacher community and materials surfaces', () => {
  it('adds a real teacher community route wired to profile and pinned-link actions', () => {
    const communityPath = resolve(ROOT, 'apps/web/src/app/teacher/community/page.tsx');
    expect(existsSync(communityPath)).toBe(true);
    const community = read('apps/web/src/app/teacher/community/page.tsx');
    expect(community).toMatch(/saveTeacherProfileAction/);
    expect(community).toMatch(/createPinnedLinkAction/);
    expect(community).toMatch(/deletePinnedLinkAction/);
    expect(community).toMatch(/ownerType" value="teacher_profile"/);
  });

  it('teacher navigation exposes materials and community as active routes', () => {
    expect(nav).toMatch(/href: '\/teacher\/materials', label: 'Materials'/);
    expect(nav).toMatch(/href: '\/teacher\/community', label: 'Community'/);
    expect(teacherLayout).toMatch(/TEACHER_NAV/);
    expect(teacherLayout).toMatch(/MobileNav/);
  });

  it('materials page is no longer a placeholder and supports delete through the guarded action', () => {
    expect(teacherMaterials).toMatch(/loadTeacherMaterials/);
    expect(teacherMaterials).toMatch(/deleteMaterialAction/);
    expect(teacherMaterials).not.toMatch(/<Placeholder/);
  });

  it('course editor renders course pinned links and per-lesson materials', () => {
    expect(teacherCourse).toMatch(/pinnedLinks/);
    expect(teacherCourse).toMatch(/createPinnedLinkAction/);
    expect(teacherCourse).toMatch(/deletePinnedLinkAction/);
    expect(teacherCourse).toMatch(/l\.materials/);
    expect(teacherCourse).toMatch(/deleteMaterialAction/);
  });
});

describe('Phase 3.3 — student education community uses DB-backed catalogue', () => {
  it('student education page uses loadStudentCatalogue for community links', () => {
    expect(studentEducation).toMatch(/loadStudentCatalogue/);
    expect(studentEducation).toMatch(/catalogue\.communityLinks/);
    expect(studentEducation).toMatch(/catalogue\.teacherProfiles/);
    expect(studentEducation).toMatch(/safeHttpsUrl/);
  });

  it('removes stale hardcoded soon links from the student education community card', () => {
    expect(studentEducation).not.toMatch(/Telegram channel \(soon\)/);
    expect(studentEducation).not.toMatch(/Instagram \(soon\)/);
    expect(studentEducation).not.toMatch(/Private club \(soon\)/);
    expect(studentEducation).toMatch(/Community links not configured yet/);
  });
});

describe('Phase 3.3 — LMS community actions keep the security pipeline', () => {
  it('new community actions exist and keep csrf before requireUser', () => {
    for (const action of ['saveTeacherProfileAction', 'createPinnedLinkAction', 'deletePinnedLinkAction']) {
      const start = actions.indexOf(`export async function ${action}`);
      expect(start, `${action} missing`).toBeGreaterThanOrEqual(0);
      const end = actions.indexOf('export async function', start + 1);
      const body = actions.slice(start, end === -1 ? actions.length : end);
      expect(body.indexOf('await assertCsrf('), `${action}: missing csrf`).toBeGreaterThanOrEqual(0);
      expect(body.indexOf('await assertCsrf('), `${action}: csrf before user`).toBeLessThan(body.indexOf('await requireUser('));
    }
    expect(actions).toMatch(/teacherProfileSchema[\s\S]*startsWith\('https:\/\/'\)/);
    expect(actions).toMatch(/pinnedLinkSchema[\s\S]*startsWith\('https:\/\/'\)/);
    expect(actions).toMatch(/listPinnedLinks/);
    expect(actions).toMatch(/requireCourseOwnership|denyLmsMutation/);
  });

  it('query layer loads teacher profile links, course links, material lists, and student community links', () => {
    expect(queries).toMatch(/listPinnedLinks\(db, 'teacher_profile'/);
    expect(queries).toMatch(/listPinnedLinks\(db, 'course'/);
    expect(queries).toMatch(/loadTeacherMaterials/);
    expect(queries).toMatch(/communityLinks/);
    expect(queries).toMatch(/teacherProfiles/);
  });

  it('student course and lesson pages render course pinned links with the https render guard', () => {
    expect(queries).toMatch(/pinnedLinks: PinnedLinkView\[\]/);
    expect(queries).toMatch(/listPinnedLinks\(db, 'course', courseId\)/);
    expect(studentCourse).toMatch(/pinnedLinks/);
    expect(studentCourse).toMatch(/Course links/);
    expect(studentCourse).toMatch(/safeHttpsUrl/);
    expect(studentLesson).toMatch(/pinnedLinks/);
    expect(studentLesson).toMatch(/Course links/);
    expect(studentLesson).toMatch(/safeHttpsUrl/);
  });
});
