import { describe, expect, it, beforeAll, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  schema,
  seedDatabase,
  findUserByEmail,
  ensureBotInstance,
  createCourse,
  createLesson,
  createMaterial,
  createPendingLmsObjectCleanupTask,
  acknowledgeLmsObjectCleanupDeadLetters,
  listBotMetricSnapshots,
  listBotPositionSnapshots,
  listBotTradeImports,
  recentAuditEvents,
  retryAcknowledgedLmsObjectCleanupDeadLetters,
  summarizeLmsObjectCleanupOperations,
  type Db,
} from '@wtc/db';
import { prepareLmsFileMaterial } from '@wtc/lms';
import { createMockTortilaAdapter } from '@wtc/bot-adapters';
import { snapshotTortilaJournal } from '../../apps/worker/src/jobs.ts';
import { runDbWorkerTick } from '../../apps/worker/src/index.ts';

let db: Db;
let botInstanceId: string;
let ownerId: string;

function objectStorageEnv(): Record<string, string> {
  return {
    LMS_OBJECT_STORAGE_ENDPOINT: 'https://objects.test.local/',
    LMS_OBJECT_STORAGE_BUCKET: 'wtc-lms-test',
    LMS_OBJECT_STORAGE_REGION: 'auto',
    LMS_OBJECT_STORAGE_ACCESS_KEY_ID: 'local-access-id',
    LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY: 'object-storage-test-secret-value',
  };
}

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((file) => file.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  const owner = (await findUserByEmail(db, 'user@wtc.local'))!;
  ownerId = owner.id;
  botInstanceId = (await ensureBotInstance(db, { userId: owner.id, productCode: 'tortila_bot' })).id;
}, 30_000);

describe('worker Tortila journal snapshot', () => {
  it('imports position snapshots and closed trades idempotently', async () => {
    const adapter = createMockTortilaAdapter(1_900_000_000_000);
    const first = await snapshotTortilaJournal(db, adapter, botInstanceId, 1_900_000_000_000);
    const second = await snapshotTortilaJournal(db, adapter, botInstanceId, 1_900_000_060_000);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    const positions = await listBotPositionSnapshots(db, botInstanceId, 20);
    expect(positions.length).toBeGreaterThanOrEqual(2);
    expect(positions.some((p) => p.symbol === 'NEAR-USDT')).toBe(true);

    const trades = await listBotTradeImports(db, botInstanceId, { limit: 20 });
    expect(trades.length).toBe(5);
    expect(trades.some((t) => t.externalTradeId === 'tortila-1' && t.exitReason === 'take_profit')).toBe(true);

    const audit = await recentAuditEvents(db, 1000);
    const tradeImports = audit.filter((e) => e.action === 'bot.trade_imported' && e.targetId === botInstanceId);
    expect(tradeImports.length).toBe(5);
  });

  it('runs the real DB worker tick path once with a configured mock system owner', async () => {
    const course = await createCourse(db, { ownerTeacherId: ownerId, title: 'Worker LMS cleanup', published: true });
    const lesson = await createLesson(db, { courseId: course.id, title: 'Worker cleanup lesson', contentType: 'article', published: true }, ownerId);
    const file = prepareLmsFileMaterial({ fileName: 'worker-cleanup.txt', mimeType: 'text/plain', bytes: new Uint8Array([87]), now: 1_900_000_000_000 });
    await createMaterial(db, {
      lessonId: lesson.id,
      label: 'Expired deleted worker payload',
      kind: 'file',
      ...file,
      retainedUntil: new Date(1_900_000_119_999),
      deletedAt: new Date(1_900_000_060_000),
    }, ownerId, 1_900_000_000_000, course.id);

    const result = await runDbWorkerTick(db, 1_900_000_120_000, {
      BOT_ADAPTER_MODE: 'mock',
      SYSTEM_BOT_OWNER_ID: ownerId,
    });

    expect(result.workerHealthStatus).toBe('ok');
    expect(result.tortilaSnapshot).toBe('ok');
    expect(result.tortilaLastError).toBeNull();
    expect(result.lmsMaterialsPurged).toBe(1);

    const metrics = await listBotMetricSnapshots(db, botInstanceId, 20);
    expect(metrics.some((m) => m.sourceAdapter === 'tortila-mock')).toBe(true);

    const positions = await listBotPositionSnapshots(db, botInstanceId, 20);
    expect(positions.some((p) => p.sourceAdapter === 'tortila-mock')).toBe(true);

    const trades = await listBotTradeImports(db, botInstanceId, { limit: 20 });
    expect(trades.length).toBe(5);

    const health = await db.select().from(schema.integrationHealthChecks);
    const workerHealth = health.find((h) => h.target === 'worker' && h.status === 'ok');
    expect(workerHealth).toBeTruthy();
    expect(workerHealth!.detail).toMatchObject({
      lmsMaterialsPurged: 1,
      lmsObjectMaterialsScanned: 0,
      lmsObjectDeleteAttempted: 0,
      lmsObjectDeleteConfirmed: 0,
      lmsObjectMetadataOnlyPurged: 0,
      lmsObjectMaterialsPurged: 0,
      lmsObjectCleanupFailed: 0,
      adapterMode: 'mock',
      liveControlDisabled: true,
      tvAutomationDisabled: true,
    });
    expect(health.some((h) => h.target === 'tortila-journal' && h.status === 'ok')).toBe(true);
  });

  it('read-only mode without JOURNAL_READ_TOKEN records health-only and makes no journal fetch', async () => {
    const metricsBefore = (await listBotMetricSnapshots(db, botInstanceId, 100)).length;
    const positionsBefore = (await listBotPositionSnapshots(db, botInstanceId, 100)).length;
    const tradesBefore = (await listBotTradeImports(db, botInstanceId, { limit: 100 })).length;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const result = await runDbWorkerTick(db, 1_900_000_180_000, {
        BOT_ADAPTER_MODE: 'read-only',
        SYSTEM_BOT_OWNER_ID: ownerId,
        TORTILA_JOURNAL_BASE_URL: 'http://journal.local',
      });

      expect(result.tortilaSnapshot).toBe('ok');
      expect(fetchSpy).not.toHaveBeenCalled();
      expect((await listBotMetricSnapshots(db, botInstanceId, 100)).length).toBe(metricsBefore);
      expect((await listBotPositionSnapshots(db, botInstanceId, 100)).length).toBe(positionsBefore);
      expect((await listBotTradeImports(db, botInstanceId, { limit: 100 })).length).toBe(tradesBefore);

      const health = await db.select().from(schema.integrationHealthChecks);
    expect(health.some((h) => h.target === 'tortila-journal' && h.status === 'not_configured')).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reconciles expired s3-r2 materials with object delete before hard-deleting rows', async () => {
    const course = await createCourse(db, { ownerTeacherId: ownerId, title: 'Worker object cleanup', published: true });
    const lesson = await createLesson(db, { courseId: course.id, title: 'Worker object cleanup lesson', contentType: 'article', published: true }, ownerId);
    const cleanupAt = 1_900_000_540_000;
    const expiredAt = new Date(cleanupAt - 1);
    const file = prepareLmsFileMaterial({ fileName: 'worker-object.txt', mimeType: 'text/plain', bytes: new Uint8Array([79]), now: cleanupAt });
    const { fileBytesBase64: _objectBytes, ...objectFile } = file;
    const base = { kind: 'file' as const, ...objectFile, storageProvider: 's3-r2', retainedUntil: expiredAt };
    const deletedOk = await createMaterial(db, {
      lessonId: lesson.id,
      label: 'Object deleted ok',
      ...base,
      storageKey: 'lms/materials/workerobjectdeletedok01',
      deletedAt: new Date(cleanupAt - 10_000),
    }, ownerId, cleanupAt, course.id);
    const missingOk = await createMaterial(db, {
      lessonId: lesson.id,
      label: 'Object already missing',
      ...base,
      storageKey: 'lms/materials/workerobjectmissingclean01',
      deletedAt: new Date(cleanupAt - 10_000),
    }, ownerId, cleanupAt, course.id);
    const metadataOnly = await createMaterial(db, {
      lessonId: lesson.id,
      label: 'Object metadata only',
      ...base,
      storageKey: 'lms/materials/workerobjectmissingok01',
      scanStatus: 'quarantined',
      quarantineReason: 'external_scan_quarantined',
    }, ownerId, cleanupAt, course.id);
    const deleteFailed = await createMaterial(db, {
      lessonId: lesson.id,
      label: 'Object delete failed',
      ...base,
      storageKey: 'lms/materials/workerobjectdeletefail01',
      deletedAt: new Date(cleanupAt - 10_000),
    }, ownerId, cleanupAt, course.id);

    const fetchCalls: Array<[string, RequestInit | undefined]> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
      fetchCalls.push([String(url), init]);
      const pathname = new URL(String(url)).pathname;
      if (pathname.includes('workerobjectdeletefail01')) return new Response(null, { status: 503 });
      if (pathname.includes('workerobjectmissingclean01')) return new Response(null, { status: 404 });
      return new Response(null, { status: 204 });
    }));
    try {
      const result = await runDbWorkerTick(db, cleanupAt, {
        BOT_ADAPTER_MODE: 'mock',
        SYSTEM_BOT_OWNER_ID: ownerId,
        ...objectStorageEnv(),
      });

      expect(result.workerHealthStatus).toBe('error');
      expect(result.tortilaSnapshot).toBe('ok');
      expect(result.lmsObjectMaterialsScanned).toBe(4);
      expect(result.lmsObjectDeleteAttempted).toBe(3);
      expect(result.lmsObjectDeleteConfirmed).toBe(2);
      expect(result.lmsObjectMetadataOnlyPurged).toBe(1);
      expect(result.lmsObjectMaterialsPurged).toBe(3);
      expect(result.lmsObjectCleanupFailed).toBe(1);
      expect(fetchCalls).toHaveLength(3);
      expect(fetchCalls.map(([url]) => url).join('\n')).not.toContain('workerobjectmissingok01');
      for (const [url, init] of fetchCalls) {
        expect(init?.method).toBe('DELETE');
        expect(url).toContain('https://objects.test.local/wtc-lms-test/lms/materials/');
        const headers = init?.headers as Record<string, string>;
        expect(headers.authorization).toContain('AWS4-HMAC-SHA256');
        expect(headers.authorization).not.toContain('object-storage-test-secret-value');
      }

      const remaining = new Set((await db.select().from(schema.materials)).map((row) => row.id));
      expect(remaining.has(deletedOk.id)).toBe(false);
      expect(remaining.has(missingOk.id)).toBe(false);
      expect(remaining.has(metadataOnly.id)).toBe(false);
      expect(remaining.has(deleteFailed.id)).toBe(true);

      const health = await db.select().from(schema.integrationHealthChecks);
      const workerHealth = health.reverse().find((h) => h.target === 'worker');
      expect(workerHealth?.status).toBe('error');
      expect(workerHealth?.detail).toMatchObject({
        lmsObjectMaterialsScanned: 4,
        lmsObjectDeleteAttempted: 3,
        lmsObjectDeleteConfirmed: 2,
        lmsObjectMetadataOnlyPurged: 1,
        lmsObjectMaterialsPurged: 3,
        lmsObjectCleanupFailed: 1,
      });
      const healthPayload = JSON.stringify(workerHealth?.detail);
      expect(healthPayload).not.toContain('workerobjectdeletedok01');
      expect(healthPayload).not.toContain('workerobjectmissingclean01');
      expect(healthPayload).not.toContain('workerobjectmissingok01');
      expect(healthPayload).not.toContain('workerobjectdeletefail01');
      expect(healthPayload).not.toContain('object-storage-test-secret-value');

      const cleanupAudit = (await db.select().from(schema.auditLogs))
        .reverse()
        .find((row) => row.action === 'education.material_cleanup' && (row.after as { storageProvider?: unknown } | null)?.storageProvider === 's3-r2');
      expect(cleanupAudit?.after).toMatchObject({
        purged: 3,
        storageProvider: 's3-r2',
        scope: 'expired_soft_deleted_or_unsafe_object_materials',
        objectDeleteConfirmed: true,
      });
      const auditPayload = JSON.stringify(cleanupAudit?.after);
      expect(auditPayload).not.toContain(deletedOk.id);
      expect(auditPayload).not.toContain(missingOk.id);
      expect(auditPayload).not.toContain(metadataOnly.id);
      expect(auditPayload).not.toContain('worker-object.txt');
      expect(auditPayload).not.toContain('workerobjectdeletedok01');
      expect(auditPayload).not.toContain('workerobjectmissingclean01');
      expect(auditPayload).not.toContain('workerobjectmissingok01');
      expect(auditPayload).not.toContain(file.contentSha256);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reconciles pending upload cleanup tasks without material rows', async () => {
    const cleanupAt = 1_900_000_660_000;
    const deleteOk = await createPendingLmsObjectCleanupTask(db, {
      storageProvider: 's3-r2',
      storageKey: 'lms/materials/pendinguploaddeleteok01',
      reason: 'material_create_pending',
    }, cleanupAt);
    const missingOk = await createPendingLmsObjectCleanupTask(db, {
      storageProvider: 's3-r2',
      storageKey: 'lms/materials/pendinguploadmissing01',
      reason: 'material_create_pending',
    }, cleanupAt);
    const deleteFailed = await createPendingLmsObjectCleanupTask(db, {
      storageProvider: 's3-r2',
      storageKey: 'lms/materials/pendinguploadfail01',
      reason: 'material_create_pending',
      maxAttempts: 1,
    }, cleanupAt);

    const fetchCalls: Array<[string, RequestInit | undefined]> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
      fetchCalls.push([String(url), init]);
      const pathname = new URL(String(url)).pathname;
      if (pathname.includes('pendinguploadfail01')) return new Response(null, { status: 503 });
      if (pathname.includes('pendinguploadmissing01')) return new Response(null, { status: 404 });
      return new Response(null, { status: 204 });
    }));
    try {
      const result = await runDbWorkerTick(db, cleanupAt, {
        BOT_ADAPTER_MODE: 'mock',
        SYSTEM_BOT_OWNER_ID: ownerId,
        ...objectStorageEnv(),
      });

      expect(result.workerHealthStatus).toBe('error');
      expect(result.lmsPendingObjectCleanupScanned).toBe(3);
      expect(result.lmsPendingObjectDeleteAttempted).toBe(3);
      expect(result.lmsPendingObjectDeleteConfirmed).toBe(2);
      expect(result.lmsPendingObjectCleanupCompleted).toBe(2);
      expect(result.lmsPendingObjectCleanupFailed).toBe(1);
      expect(result.lmsPendingObjectCleanupDeadLettered).toBe(1);

      const taskRows = await db.select().from(schema.lmsObjectCleanupTasks);
      expect(taskRows.find((row) => row.id === deleteOk.id)?.status).toBe('completed');
      expect(taskRows.find((row) => row.id === missingOk.id)?.status).toBe('completed');
      expect(taskRows.find((row) => row.id === deleteFailed.id)).toMatchObject({
        status: 'dead_letter',
        attempts: 1,
        lastErrorCode: 'delete_failed',
      });

      const health = await db.select().from(schema.integrationHealthChecks);
      const workerHealth = health.reverse().find((h) => h.target === 'worker');
      expect(workerHealth?.detail).toMatchObject({
        lmsPendingObjectCleanupScanned: 3,
        lmsPendingObjectDeleteAttempted: 3,
        lmsPendingObjectDeleteConfirmed: 2,
        lmsPendingObjectCleanupCompleted: 2,
        lmsPendingObjectCleanupFailed: 1,
        lmsPendingObjectCleanupDeadLettered: 1,
      });
      const healthPayload = JSON.stringify(workerHealth?.detail);
      expect(healthPayload).not.toContain(deleteOk.id);
      expect(healthPayload).not.toContain(missingOk.id);
      expect(healthPayload).not.toContain(deleteFailed.id);
      expect(healthPayload).not.toContain('pendinguploaddeleteok01');
      expect(healthPayload).not.toContain('pendinguploadmissing01');
      expect(healthPayload).not.toContain('pendinguploadfail01');
      expect(healthPayload).not.toContain('object-storage-test-secret-value');

      const cleanupAudit = (await db.select().from(schema.auditLogs))
        .reverse()
        .find((row) => row.action === 'education.material_cleanup' && (row.after as { scope?: unknown } | null)?.scope === 'pending_upload_object_cleanup');
      expect(cleanupAudit?.after).toMatchObject({
        cleanupTasksCompleted: 2,
        storageProvider: 's3-r2',
        scope: 'pending_upload_object_cleanup',
        objectDeleteConfirmed: true,
      });
      const auditPayload = JSON.stringify(cleanupAudit?.after);
      expect(auditPayload).not.toContain(deleteOk.id);
      expect(auditPayload).not.toContain(missingOk.id);
      expect(auditPayload).not.toContain('pendinguploaddeleteok01');
      expect(auditPayload).not.toContain('pendinguploadmissing01');
      expect(auditPayload).not.toContain('pendinguploadfail01');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('picks up acknowledged dead-letter cleanup after aggregate retry', async () => {
    const cleanupAt = 1_900_000_760_000;
    const task = await createPendingLmsObjectCleanupTask(db, {
      storageProvider: 's3-r2',
      storageKey: 'lms/materials/pendinguploadackretry01',
      reason: 'material_create_pending',
      maxAttempts: 1,
    }, cleanupAt);

    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 503 })));
    try {
      const failed = await runDbWorkerTick(db, cleanupAt, {
        BOT_ADAPTER_MODE: 'mock',
        SYSTEM_BOT_OWNER_ID: ownerId,
        ...objectStorageEnv(),
      });
      expect(failed.lmsPendingObjectCleanupDeadLettered).toBeGreaterThanOrEqual(1);
    } finally {
      vi.unstubAllGlobals();
    }

    const beforeAck = await summarizeLmsObjectCleanupOperations(db, cleanupAt + 1);
    const acknowledged = await acknowledgeLmsObjectCleanupDeadLetters(db, {
      actorUserId: ownerId,
      expectedCount: beforeAck.deadLetteredUnacknowledged,
      expectedLatestDeadLetteredAt: beforeAck.latestUnacknowledgedDeadLetteredAt?.getTime() ?? null,
      limit: 100,
    }, cleanupAt + 1);
    expect(acknowledged.acknowledged).toBeGreaterThanOrEqual(1);

    const beforeRetry = await summarizeLmsObjectCleanupOperations(db, cleanupAt + 2);
    const retried = await retryAcknowledgedLmsObjectCleanupDeadLetters(db, {
      actorUserId: ownerId,
      expectedCount: beforeRetry.deadLetteredAcknowledged,
      expectedLatestAcknowledgedAt: beforeRetry.latestAcknowledgedAt?.getTime() ?? null,
      limit: 100,
    }, cleanupAt + 2);
    expect(retried.retried).toBeGreaterThanOrEqual(1);

    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    try {
      const succeeded = await runDbWorkerTick(db, cleanupAt + 2, {
        BOT_ADAPTER_MODE: 'mock',
        SYSTEM_BOT_OWNER_ID: ownerId,
        ...objectStorageEnv(),
      });
      expect(succeeded.lmsPendingObjectCleanupCompleted).toBeGreaterThanOrEqual(1);
      const [storedTask] = await db.select().from(schema.lmsObjectCleanupTasks).where(eq(schema.lmsObjectCleanupTasks.id, task.id)).limit(1);
      expect(storedTask).toMatchObject({ status: 'completed', attempts: 1 });
      expect(storedTask?.completedAt).toBeInstanceOf(Date);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
