/**
 * Phase 2.2 LMS service/repo integration tests (PGlite — real Postgres engine, no Docker).
 * Exercises the Phase-2.2 LMS-UI repos on the LEAN schema + the @wtc/lms ownership guard, and the
 * course-completion flow (mark all published lessons complete → enrollment complete + audit).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  schema, seedDatabase, createUser, findUserByEmail, recentAuditEvents,
  createCourse, getCourseById, updateCourse, setCoursePublished,
  createLesson, updateLesson, listLessonsForCourse, createMaterial, listMaterials, deleteMaterial,
  getCourseStudentList, upsertEnrollment, upsertLessonProgress, markEnrollmentComplete, listEnrollments, listCourseProgress,
  type Db,
} from '@wtc/db';
import { assertTeacherOwns, OwnershipDenied } from '@wtc/lms';

let db: Db;
let teacherA: string, teacherB: string, student: string;
let courseId: string;

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  teacherA = (await createUser(db, { email: 'lms-ta@wtc.local', passwordHash: 'h', displayName: 'Teacher A', roles: ['teacher'] })).id;
  teacherB = (await createUser(db, { email: 'lms-tb@wtc.local', passwordHash: 'h', displayName: 'Teacher B', roles: ['teacher'] })).id;
  student = (await findUserByEmail(db, 'user@wtc.local'))!.id;
  courseId = (await createCourse(db, { ownerTeacherId: teacherA, title: 'LMS 101', published: false })).id;
});

describe('LMS ownership (guard + repo)', () => {
  it('teacher A owns the course; teacher B does not; admin bypasses', async () => {
    const c = await getCourseById(db, courseId);
    expect(c).not.toBeNull();
    expect(() => assertTeacherOwns({ isAdmin: false, actorUserId: teacherA, courseOwnerTeacherId: c!.ownerTeacherId })).not.toThrow();
    expect(() => assertTeacherOwns({ isAdmin: false, actorUserId: teacherB, courseOwnerTeacherId: c!.ownerTeacherId })).toThrow(OwnershipDenied);
    expect(() => assertTeacherOwns({ isAdmin: true, actorUserId: teacherB, courseOwnerTeacherId: c!.ownerTeacherId })).not.toThrow();
  });
});

describe('LMS course/lesson/material mutations audit in-txn', () => {
  it('updateCourse + setCoursePublished write education.course_update / education.course_publish', async () => {
    await updateCourse(db, courseId, { title: 'LMS 101 (rev)' }, teacherA);
    await setCoursePublished(db, courseId, true, teacherA);
    const c = await getCourseById(db, courseId);
    expect(c!.title).toBe('LMS 101 (rev)');
    expect(c!.published).toBe(true);
    const events = await recentAuditEvents(db, 1000);
    expect(events.some((e) => e.action === 'education.course_update' && e.targetId === courseId)).toBe(true);
    expect(events.some((e) => e.action === 'education.course_publish' && e.targetId === courseId)).toBe(true);
  });

  it('createLesson auto-orders + audits; listLessonsForCourse returns all incl unpublished', async () => {
    const l1 = await createLesson(db, { courseId, title: 'Lesson 1', body: 'intro' }, teacherA);
    const l2 = await createLesson(db, { courseId, title: 'Lesson 2', videoUrl: 'https://v/2' }, teacherA);
    expect(l1.order).toBe(1);
    expect(l2.order).toBe(2);
    const all = await listLessonsForCourse(db, courseId);
    expect(all.length).toBe(2);
    expect(all.every((l) => !l.published)).toBe(true); // both created as drafts
    const events = await recentAuditEvents(db, 1000);
    expect(events.filter((e) => e.action === 'education.lesson_create').length).toBeGreaterThanOrEqual(2);
  });

  it('createMaterial + listMaterials + deleteMaterial audit', async () => {
    const [lesson] = await listLessonsForCourse(db, courseId);
    const m = await createMaterial(db, { lessonId: lesson!.id, label: 'Slides', url: 'https://s/1', kind: 'link' }, teacherA);
    expect((await listMaterials(db, lesson!.id)).some((x) => x.id === m.id)).toBe(true);
    await deleteMaterial(db, m.id, teacherA);
    expect((await listMaterials(db, lesson!.id)).some((x) => x.id === m.id)).toBe(false);
    const events = await recentAuditEvents(db, 1000);
    expect(events.some((e) => e.action === 'education.material_upload')).toBe(true);
    expect(events.some((e) => e.action === 'education.material_delete')).toBe(true);
  });
});

describe('LMS student roster is data-minimal', () => {
  it('getCourseStudentList returns displayName + counts only (no email / no userId)', async () => {
    await upsertEnrollment(db, { userId: student, courseId });
    const roster = await getCourseStudentList(db, courseId);
    expect(roster.length).toBeGreaterThan(0);
    const row = roster[0]!;
    expect(typeof row.displayName).toBe('string');
    expect(Object.keys(row).sort()).toEqual(['completedLessons', 'displayName', 'enrolledAt', 'totalLessons']);
    expect(JSON.stringify(roster)).not.toContain('@wtc.local'); // never leaks email
  });
});

describe('LMS completion flow', () => {
  it('completing every published lesson marks the enrollment complete + writes education.course_completed', async () => {
    // publish both lessons
    const lessons = await listLessonsForCourse(db, courseId);
    for (const l of lessons) await updateLesson(db, l.id, { published: true }, teacherA);
    const published = (await listLessonsForCourse(db, courseId)).filter((l) => l.published);
    expect(published.length).toBe(2);

    await upsertEnrollment(db, { userId: student, courseId });
    for (const l of published) await upsertLessonProgress(db, { userId: student, lessonId: l.id, percentComplete: '100', completed: true });
    // all complete → mark course complete (mirrors the action's logic)
    const prog = await listCourseProgress(db, student, courseId);
    const done = new Set(prog.filter((p) => p.completed).map((p) => p.lessonId));
    expect(published.every((l) => done.has(l.id))).toBe(true);
    await markEnrollmentComplete(db, student, courseId);

    const enr = (await listEnrollments(db, student)).find((e) => e.courseId === courseId);
    expect(enr!.completedAt).not.toBeNull();
    const events = await recentAuditEvents(db, 1000);
    expect(events.some((e) => e.action === 'education.course_completed')).toBe(true);
  });

  it('per-user progress isolation: student progress invisible to another user', async () => {
    const other = await createUser(db, { email: 'lms-other@wtc.local', passwordHash: 'h', displayName: 'O' });
    const prog = await listCourseProgress(db, other.id, courseId);
    expect(prog.length).toBe(0);
  });
});
