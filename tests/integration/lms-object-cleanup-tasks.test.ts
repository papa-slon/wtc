import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  completeLmsObjectCleanupTasks,
  createCourse,
  createLesson,
  createMaterialAndCompleteLmsObjectCleanupTask,
  createPendingLmsObjectCleanupTask,
  createUser,
  acknowledgeLmsObjectCleanupDeadLetters,
  listPendingLmsObjectCleanupTasks,
  recordLmsObjectCleanupTaskFailure,
  retryAcknowledgedLmsObjectCleanupDeadLetters,
  schema,
  seedDatabase,
  summarizeLmsObjectCleanupOperations,
  type Db,
} from '@wtc/db';
import { prepareLmsFileMaterial } from '@wtc/lms';
import { eq } from 'drizzle-orm';

let pg: PGlite;
let db: Db;
let teacher: string;

beforeAll(async () => {
  pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((file) => file.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  teacher = (await createUser(db, { email: 'lms-cleanup-task-teacher@wtc.local', passwordHash: 'h', displayName: 'Cleanup Teacher', roles: ['teacher'] })).id;
}, 30_000);

afterAll(async () => {
  await pg.close();
});

describe('LMS object cleanup tasks', () => {
  it('migration adds only private retry fields and no file/user payload columns', async () => {
    const columns = await pg.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'lms_object_cleanup_tasks'
    `);
    const names = columns.rows.map((row) => row.column_name).sort();
    expect(names).toEqual([
      'acknowledged_at',
      'acknowledged_by',
      'attempts',
      'completed_at',
      'created_at',
      'id',
      'last_error_code',
      'max_attempts',
      'reason',
      'run_after',
      'status',
      'storage_key',
      'storage_provider',
      'updated_at',
    ]);
    for (const forbidden of ['file_name', 'mime_type', 'content_sha256', 'file_bytes_base64', 'label', 'lesson_id', 'course_id', 'user_id', 'scanner_token', 'scanner_reason']) {
      expect(names).not.toContain(forbidden);
    }
  });

  it('registers pending cleanup and atomically completes it with material creation', async () => {
    const course = await createCourse(db, { ownerTeacherId: teacher, title: 'Cleanup task course', published: true });
    const lesson = await createLesson(db, { courseId: course.id, title: 'Cleanup task lesson', contentType: 'article', published: true }, teacher);
    const now = 1_900_001_000_000;
    const file = prepareLmsFileMaterial({ fileName: 'object-task.txt', mimeType: 'text/plain', bytes: new Uint8Array([84]), now });
    const { fileBytesBase64: _bytes, ...objectFile } = file;
    const storageKey = 'lms/materials/cleanup-task-success-01';
    const task = await createPendingLmsObjectCleanupTask(db, {
      storageProvider: 's3-r2',
      storageKey,
      reason: 'material_create_pending',
    }, now);

    expect((await listPendingLmsObjectCleanupTasks(db, now)).some((row) => row.cleanupTaskId === task.id)).toBe(true);

    const material = await createMaterialAndCompleteLmsObjectCleanupTask(db, {
      lessonId: lesson.id,
      label: 'Object task',
      kind: 'file',
      ...objectFile,
      storageProvider: 's3-r2',
      storageKey,
    }, task.id, teacher, now, course.id);

    expect(material.storageProvider).toBe('s3-r2');
    const [storedTask] = await db.select().from(schema.lmsObjectCleanupTasks).where(eq(schema.lmsObjectCleanupTasks.id, task.id)).limit(1);
    expect(storedTask).toMatchObject({ status: 'completed', storageProvider: 's3-r2', reason: 'material_create_pending' });
    expect(storedTask?.completedAt).toBeInstanceOf(Date);
    expect((await listPendingLmsObjectCleanupTasks(db, now + 1)).some((row) => row.cleanupTaskId === task.id)).toBe(false);

    const uploadAudit = (await db.select().from(schema.auditLogs)).find((row) => row.action === 'education.material_upload' && row.targetId === material.id);
    const payload = JSON.stringify(uploadAudit?.after);
    expect(payload).not.toContain(storageKey);
    expect(payload).not.toContain('object-task.txt');
    expect(payload).not.toContain(file.contentSha256);
  });

  it('records bounded retry failures and dead-letters without raw provider errors', async () => {
    const now = 1_900_001_200_000;
    const task = await createPendingLmsObjectCleanupTask(db, {
      storageProvider: 's3-r2',
      storageKey: 'lms/materials/cleanup-task-failure-01',
      reason: 'material_create_pending',
      maxAttempts: 2,
    }, now);

    const first = await recordLmsObjectCleanupTaskFailure(db, task.id, now, 'delete_failed:503');
    expect(first).toEqual({ status: 'pending', attempts: 1 });
    expect((await listPendingLmsObjectCleanupTasks(db, now)).some((row) => row.cleanupTaskId === task.id)).toBe(false);
    expect((await listPendingLmsObjectCleanupTasks(db, now + 60_001)).some((row) => row.cleanupTaskId === task.id)).toBe(true);

    const second = await recordLmsObjectCleanupTaskFailure(db, task.id, now + 60_001, 'Authorization: secret response body');
    expect(second).toEqual({ status: 'dead_letter', attempts: 2 });
    const [storedTask] = await db.select().from(schema.lmsObjectCleanupTasks).where(eq(schema.lmsObjectCleanupTasks.id, task.id)).limit(1);
    expect(storedTask).toMatchObject({ status: 'dead_letter', attempts: 2, lastErrorCode: 'delete_failed' });
    expect((await listPendingLmsObjectCleanupTasks(db, now + 10_000_000)).some((row) => row.cleanupTaskId === task.id)).toBe(false);

    const deadLetterAudit = (await db.select().from(schema.auditLogs))
      .reverse()
      .find((row) => row.action === 'education.material_cleanup' && (row.after as { cleanupTasksDeadLettered?: unknown } | null)?.cleanupTasksDeadLettered === 1);
    expect(deadLetterAudit?.after).toMatchObject({
      cleanupTasksDeadLettered: 1,
      storageProvider: 's3-r2',
      scope: 'pending_upload_object_cleanup',
      lastErrorCode: 'delete_failed',
    });
    const auditPayload = JSON.stringify(deadLetterAudit?.after);
    expect(auditPayload).not.toContain(task.id);
    expect(auditPayload).not.toContain('cleanup-task-failure-01');
    expect(auditPayload).not.toContain('Authorization');
    expect(auditPayload).not.toContain('secret response body');
  });

  it('completes confirmed cleanup with summary-only audit', async () => {
    const now = 1_900_001_400_000;
    const storageKey = 'lms/materials/cleanup-task-audit-01';
    const task = await createPendingLmsObjectCleanupTask(db, {
      storageProvider: 's3-r2',
      storageKey,
      reason: 'material_create_pending',
    }, now);

    await expect(completeLmsObjectCleanupTasks(db, [task.id], now)).resolves.toEqual({ completed: 1 });
    const cleanupAudit = (await db.select().from(schema.auditLogs))
      .reverse()
      .find((row) => row.action === 'education.material_cleanup' && (row.after as { scope?: unknown } | null)?.scope === 'pending_upload_object_cleanup');
    expect(cleanupAudit?.actorRole).toBe('system');
    expect(cleanupAudit?.targetId).toBeNull();
    expect(cleanupAudit?.after).toMatchObject({
      cleanupTasksCompleted: 1,
      storageProvider: 's3-r2',
      scope: 'pending_upload_object_cleanup',
      objectDeleteConfirmed: true,
    });
    const payload = JSON.stringify(cleanupAudit?.after);
    expect(payload).not.toContain(task.id);
    expect(payload).not.toContain(storageKey);
    expect(payload).not.toContain('Authorization');
    expect(payload).not.toContain('X-Amz');
  });

  it('summarizes pending and dead-letter cleanup operations without object locators', async () => {
    const now = 1_900_002_000_000;
    const before = await summarizeLmsObjectCleanupOperations(db, now);
    await createPendingLmsObjectCleanupTask(db, {
      storageProvider: 's3-r2',
      storageKey: 'lms/materials/cleanup-review-due-01',
      reason: 'material_create_pending',
    }, now - 1_000);
    const scheduled = await createPendingLmsObjectCleanupTask(db, {
      storageProvider: 's3-r2',
      storageKey: 'lms/materials/cleanup-review-scheduled-01',
      reason: 'material_create_pending',
      maxAttempts: 3,
    }, now);
    await recordLmsObjectCleanupTaskFailure(db, scheduled.id, now, 'delete_failed:503');
    const dead = await createPendingLmsObjectCleanupTask(db, {
      storageProvider: 's3-r2',
      storageKey: 'lms/materials/cleanup-review-dead-01',
      reason: 'material_create_pending',
      maxAttempts: 1,
    }, now);
    await recordLmsObjectCleanupTaskFailure(db, dead.id, now + 1, 'provider body with Authorization header');

    const summary = await summarizeLmsObjectCleanupOperations(db, now + 30_000);
    expect(summary).toMatchObject({
      storageProvider: 's3-r2',
      reason: 'material_create_pending',
      pendingDue: before.pendingDue + 1,
      pendingScheduled: before.pendingScheduled + 1,
      deadLettered: before.deadLettered + 1,
      maxAttemptsReached: before.maxAttemptsReached + 1,
      deadLetteredUnacknowledged: before.deadLetteredUnacknowledged + 1,
      latestDeadLetterErrorCode: 'delete_failed',
    });
    expect(summary.latestDeadLetteredAt).toBeInstanceOf(Date);
    const payload = JSON.stringify(summary);
    expect(payload).not.toContain(dead.id);
    expect(payload).not.toContain(scheduled.id);
    expect(payload).not.toContain('cleanup-review-due-01');
    expect(payload).not.toContain('cleanup-review-scheduled-01');
    expect(payload).not.toContain('cleanup-review-dead-01');
    expect(payload).not.toContain('Authorization');
  });

  it('acknowledges and retries dead-letter cleanup as aggregate admin operations', async () => {
    const now = 1_900_002_500_000;
    const admin = (await createUser(db, {
      email: 'lms-cleanup-task-admin@wtc.local',
      passwordHash: 'h',
      displayName: 'Cleanup Admin',
      roles: ['admin'],
    })).id;
    const task = await createPendingLmsObjectCleanupTask(db, {
      storageProvider: 's3-r2',
      storageKey: 'lms/materials/cleanup-ack-retry-01',
      reason: 'material_create_pending',
      maxAttempts: 1,
    }, now);
    await recordLmsObjectCleanupTaskFailure(db, task.id, now + 1, 'delete_failed:503');

    await expect(retryAcknowledgedLmsObjectCleanupDeadLetters(db, {
      actorUserId: admin,
      expectedCount: 0,
      expectedLatestAcknowledgedAt: null,
    }, now + 2))
      .resolves.toEqual({ retried: 0 });

    await expect(acknowledgeLmsObjectCleanupDeadLetters(db, {
      actorUserId: admin,
      expectedCount: 0,
      expectedLatestDeadLetteredAt: null,
    }, now + 3)).rejects.toThrow(/lms_object_cleanup_cohort_stale/);

    const beforeAck = await summarizeLmsObjectCleanupOperations(db, now + 3);
    const acknowledged = await acknowledgeLmsObjectCleanupDeadLetters(db, {
      actorUserId: admin,
      expectedCount: beforeAck.deadLetteredUnacknowledged,
      expectedLatestDeadLetteredAt: beforeAck.latestUnacknowledgedDeadLetteredAt?.getTime() ?? null,
      limit: 100,
    }, now + 3);
    expect(acknowledged.acknowledged).toBeGreaterThanOrEqual(1);
    const acknowledgedSummary = await summarizeLmsObjectCleanupOperations(db, now + 4);
    expect(acknowledgedSummary.deadLetteredAcknowledged).toBeGreaterThanOrEqual(1);
    expect(acknowledgedSummary.latestAcknowledgedAt).toBeInstanceOf(Date);

    const retried = await retryAcknowledgedLmsObjectCleanupDeadLetters(db, {
      actorUserId: admin,
      expectedCount: acknowledgedSummary.deadLetteredAcknowledged,
      expectedLatestAcknowledgedAt: acknowledgedSummary.latestAcknowledgedAt?.getTime() ?? null,
      limit: 100,
    }, now + 5);
    expect(retried.retried).toBeGreaterThanOrEqual(1);
    const [storedTask] = await db.select().from(schema.lmsObjectCleanupTasks).where(eq(schema.lmsObjectCleanupTasks.id, task.id)).limit(1);
    expect(storedTask).toMatchObject({
      status: 'pending',
      attempts: 1,
      lastErrorCode: null,
      acknowledgedAt: null,
      acknowledgedBy: null,
    });
    expect(storedTask?.runAfter?.getTime()).toBe(now + 5);

    const auditRows = await db.select().from(schema.auditLogs);
    const ackAudit = auditRows.find((row) => row.action === 'education.material_cleanup_ack');
    const retryAudit = auditRows.find((row) => row.action === 'education.material_cleanup_retry');
    expect(ackAudit?.actorUserId).toBe(admin);
    expect(ackAudit?.after).toMatchObject({
      cleanupTasksAcknowledged: acknowledged.acknowledged,
      storageProvider: 's3-r2',
      scope: 'pending_upload_object_cleanup',
    });
    expect(retryAudit?.actorUserId).toBe(admin);
    expect(retryAudit?.after).toMatchObject({
      cleanupTasksRetried: retried.retried,
      storageProvider: 's3-r2',
      scope: 'pending_upload_object_cleanup',
    });
    const payload = JSON.stringify([ackAudit?.after, retryAudit?.after]);
    expect(payload).not.toContain(task.id);
    expect(payload).not.toContain('cleanup-ack-retry-01');
    expect(payload).not.toContain('delete_failed:503');
    expect(payload).not.toContain('Authorization');
  });
});
