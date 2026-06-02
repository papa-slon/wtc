/**
 * Phase 2.3 LMS repo audit-correctness tests (PGlite — real Postgres engine, no Docker).
 * Exercises the F-02 / F-03 / F-04 repo fixes from the Phase 2.3 must-lands:
 *
 *   F-02  upsertEnrollment with actorUserId=admin -> audit row's actorUserId is the admin, NOT the student.
 *   F-03  markEnrollmentComplete -> audit row's targetType='enrollment', targetId=enrollment.id (NOT courseId).
 *   F-04  createCourse with teacherProfileId -> courses.teacher_profile_id is populated.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  schema,
  seedDatabase,
  createUser,
  recentAuditEvents,
  createCourse,
  getCourseById,
  createTeacherProfile,
  upsertEnrollment,
  listEnrollments,
  markEnrollmentComplete,
  type Db,
} from '@wtc/db';

let db: Db;
let adminId: string;
let teacherId: string;
let studentId: string;
let teacherProfileId: string;

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);

  adminId = (await createUser(db, { email: 'lmsfix-admin@wtc.local', passwordHash: 'h', displayName: 'Admin Fix', roles: ['admin'] })).id;
  teacherId = (await createUser(db, { email: 'lmsfix-teacher@wtc.local', passwordHash: 'h', displayName: 'Teacher Fix', roles: ['teacher'] })).id;
  studentId = (await createUser(db, { email: 'lmsfix-student@wtc.local', passwordHash: 'h', displayName: 'Student Fix' })).id;

  // Create a teacher profile for F-04.
  const profile = await createTeacherProfile(db, { userId: teacherId, displayName: 'Fix Teacher Profile' });
  teacherProfileId = profile.id;
});

describe('F-02 — upsertEnrollment with actorUserId=admin records admin as the audit actor', () => {
  it('audit row actorUserId is the admin, not the enrolled student', async () => {
    const courseId = (await createCourse(db, { ownerTeacherId: teacherId, title: 'F02 Course', published: true })).id;

    // Admin manually enrolls the student (actorUserId = adminId).
    const enrollment = await upsertEnrollment(db, { userId: studentId, courseId }, Date.now(), adminId);
    expect(enrollment.userId).toBe(studentId);
    expect(enrollment.courseId).toBe(courseId);

    // Audit row should carry the admin's id, not the student's.
    const events = await recentAuditEvents(db, 1000);
    const enrollAudit = events.find(
      (e) => e.action === 'education.enrolled' && e.targetId === enrollment.id,
    );
    expect(enrollAudit).toBeDefined();
    expect(enrollAudit!.actorUserId).toBe(adminId);
    expect(enrollAudit!.actorUserId).not.toBe(studentId);
  });

  it('self-enroll (no actorUserId) -> audit row actorUserId is the student', async () => {
    const courseId = (await createCourse(db, { ownerTeacherId: teacherId, title: 'F02 Self-Enroll Course', published: true })).id;

    // Student enrolls themselves (no actorUserId override).
    const enrollment = await upsertEnrollment(db, { userId: studentId, courseId });

    const events = await recentAuditEvents(db, 1000);
    const enrollAudit = events.find(
      (e) => e.action === 'education.enrolled' && e.targetId === enrollment.id,
    );
    expect(enrollAudit).toBeDefined();
    expect(enrollAudit!.actorUserId).toBe(studentId);
  });
});

describe('F-03 — markEnrollmentComplete audit row has targetType=enrollment, targetId=enrollment.id', () => {
  it('audit row targetType is enrollment and targetId is the enrollment row id (not courseId)', async () => {
    const courseId = (await createCourse(db, { ownerTeacherId: teacherId, title: 'F03 Course', published: true })).id;

    // Enroll the student first.
    const enrollment = await upsertEnrollment(db, { userId: studentId, courseId });
    const enrollmentId = enrollment.id;

    // Mark the enrollment complete.
    await markEnrollmentComplete(db, studentId, courseId);

    // Verify completedAt was set.
    const enrollments = await listEnrollments(db, studentId);
    const completed = enrollments.find((e) => e.courseId === courseId);
    expect(completed!.completedAt).not.toBeNull();

    // The audit row targetType must be 'enrollment' and targetId must be the enrollment row id.
    const events = await recentAuditEvents(db, 1000);
    const completeAudit = events.find(
      (e) => e.action === 'education.course_completed' && e.targetId === enrollmentId,
    );
    expect(completeAudit).toBeDefined();
    expect(completeAudit!.targetType).toBe('enrollment');
    expect(completeAudit!.targetId).toBe(enrollmentId);
    // Verify it is NOT the courseId (which was the pre-fix bug).
    expect(completeAudit!.targetId).not.toBe(courseId);
  });
});

describe('F-04 — createCourse with teacherProfileId populates courses.teacher_profile_id', () => {
  it('courses row has teacher_profile_id set when teacherProfileId is supplied', async () => {
    const dto = await createCourse(db, {
      ownerTeacherId: teacherId,
      title: 'F04 Course with Profile',
      published: false,
      teacherProfileId,
    });

    // getCourseById returns the raw CourseRow which has teacherProfileId.
    const raw = await getCourseById(db, dto.id);
    expect(raw).not.toBeNull();
    expect(raw!.teacherProfileId).toBe(teacherProfileId);
  });

  it('createCourse without teacherProfileId leaves teacher_profile_id null', async () => {
    const dto = await createCourse(db, {
      ownerTeacherId: teacherId,
      title: 'F04 Course no Profile',
      published: false,
    });
    const raw = await getCourseById(db, dto.id);
    expect(raw!.teacherProfileId).toBeNull();
  });
});
