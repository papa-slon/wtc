import { describe, expect, it, vi } from 'vitest';
import { createMaterialWithUploadCompensation } from '../../apps/web/src/features/lms/material-create-compensation.ts';

const now = 1_900_000_000_000;

const cleanObjectFile = {
  lessonId: '00000000-0000-4000-8000-000000000001',
  label: 'Plan',
  kind: 'file' as const,
  fileName: 'plan.txt',
  mimeType: 'text/plain',
  sizeBytes: 4,
  contentSha256: 'a'.repeat(64),
  storageProvider: 's3-r2',
  storageKey: 'lms/materials/objectcompensation01',
  scanStatus: 'clean' as const,
  scanCheckedAt: new Date(now),
  quarantineReason: null,
  retainedUntil: new Date(now + 86_400_000),
};

const linkMaterial = {
  lessonId: '00000000-0000-4000-8000-000000000001',
  label: 'Link',
  kind: 'link' as const,
  url: 'https://example.test/lesson',
};

describe('LMS material upload compensation orchestration', () => {
  it('compensates file uploads when material creation fails and preserves the DB error', async () => {
    const originalError = new Error('db insert failed');
    const createMaterialFn = vi.fn(async () => {
      throw originalError;
    });
    const compensateFn = vi.fn(async () => true);

    await expect(createMaterialWithUploadCompensation({
      db: {} as never,
      materialInput: cleanObjectFile,
      actorUserId: '00000000-0000-4000-8000-0000000000aa',
      now,
      courseId: '00000000-0000-4000-8000-000000000002',
      createMaterialFn: createMaterialFn as never,
      compensateFn: compensateFn as never,
    })).rejects.toBe(originalError);

    expect(compensateFn).toHaveBeenCalledTimes(1);
    expect(compensateFn).toHaveBeenCalledWith({ material: cleanObjectFile, now });
  });

  it('uses the atomic material-create path when a cleanup task exists', async () => {
    const createMaterialFn = vi.fn(async () => {
      throw new Error('fallback should not be called');
    });
    const createMaterialAndCompleteCleanupFn = vi.fn(async () => undefined);
    const compensateFn = vi.fn(async () => true);

    await expect(createMaterialWithUploadCompensation({
      db: {} as never,
      materialInput: cleanObjectFile,
      cleanupTaskId: '00000000-0000-4000-8000-0000000000cc',
      actorUserId: '00000000-0000-4000-8000-0000000000aa',
      now,
      courseId: '00000000-0000-4000-8000-000000000002',
      createMaterialFn: createMaterialFn as never,
      createMaterialAndCompleteCleanupFn: createMaterialAndCompleteCleanupFn as never,
      compensateFn: compensateFn as never,
    })).resolves.toBeUndefined();

    expect(createMaterialFn).not.toHaveBeenCalled();
    expect(createMaterialAndCompleteCleanupFn).toHaveBeenCalledWith(
      {},
      cleanObjectFile,
      '00000000-0000-4000-8000-0000000000cc',
      '00000000-0000-4000-8000-0000000000aa',
      now,
      '00000000-0000-4000-8000-000000000002',
    );
    expect(compensateFn).not.toHaveBeenCalled();
  });

  it('does not compensate non-file material failures', async () => {
    const originalError = new Error('db insert failed');
    const createMaterialFn = vi.fn(async () => {
      throw originalError;
    });
    const compensateFn = vi.fn(async () => true);

    await expect(createMaterialWithUploadCompensation({
      db: {} as never,
      materialInput: linkMaterial,
      actorUserId: '00000000-0000-4000-8000-0000000000aa',
      now,
      courseId: '00000000-0000-4000-8000-000000000002',
      createMaterialFn: createMaterialFn as never,
      compensateFn: compensateFn as never,
    })).rejects.toBe(originalError);

    expect(compensateFn).not.toHaveBeenCalled();
  });

  it('swallows compensation delete failures and still rethrows the original DB error', async () => {
    const originalError = new Error('db insert failed');
    const deleteError = new Error('delete failed');
    const createMaterialFn = vi.fn(async () => {
      throw originalError;
    });
    const compensateFn = vi.fn(async () => {
      throw deleteError;
    });

    await expect(createMaterialWithUploadCompensation({
      db: {} as never,
      materialInput: cleanObjectFile,
      actorUserId: '00000000-0000-4000-8000-0000000000aa',
      now,
      courseId: '00000000-0000-4000-8000-000000000002',
      createMaterialFn: createMaterialFn as never,
      compensateFn: compensateFn as never,
    })).rejects.toBe(originalError);

    expect(compensateFn).toHaveBeenCalledTimes(1);
  });

  it('marks the cleanup task complete when compensation delete succeeds after DB failure', async () => {
    const originalError = new Error('db insert failed');
    const createMaterialFn = vi.fn(async () => {
      throw originalError;
    });
    const compensateFn = vi.fn(async () => true);
    const completeCleanupTaskFn = vi.fn(async () => ({ completed: true }));
    const recordCleanupTaskFailureFn = vi.fn(async () => ({ status: 'pending' as const, attempts: 1 }));

    await expect(createMaterialWithUploadCompensation({
      db: {} as never,
      materialInput: cleanObjectFile,
      cleanupTaskId: '00000000-0000-4000-8000-0000000000cc',
      actorUserId: '00000000-0000-4000-8000-0000000000aa',
      now,
      courseId: '00000000-0000-4000-8000-000000000002',
      createMaterialFn: createMaterialFn as never,
      compensateFn: compensateFn as never,
      completeCleanupTaskFn: completeCleanupTaskFn as never,
      recordCleanupTaskFailureFn: recordCleanupTaskFailureFn as never,
    })).rejects.toBe(originalError);

    expect(completeCleanupTaskFn).toHaveBeenCalledWith({}, '00000000-0000-4000-8000-0000000000cc', now);
    expect(recordCleanupTaskFailureFn).not.toHaveBeenCalled();
  });

  it('records a retry failure when compensation delete fails after DB failure', async () => {
    const originalError = new Error('db insert failed');
    const createMaterialFn = vi.fn(async () => {
      throw originalError;
    });
    const compensateFn = vi.fn(async () => {
      throw new Error('delete failed');
    });
    const completeCleanupTaskFn = vi.fn(async () => ({ completed: true }));
    const recordCleanupTaskFailureFn = vi.fn(async () => ({ status: 'pending' as const, attempts: 1 }));

    await expect(createMaterialWithUploadCompensation({
      db: {} as never,
      materialInput: cleanObjectFile,
      cleanupTaskId: '00000000-0000-4000-8000-0000000000cc',
      actorUserId: '00000000-0000-4000-8000-0000000000aa',
      now,
      courseId: '00000000-0000-4000-8000-000000000002',
      createMaterialFn: createMaterialFn as never,
      compensateFn: compensateFn as never,
      completeCleanupTaskFn: completeCleanupTaskFn as never,
      recordCleanupTaskFailureFn: recordCleanupTaskFailureFn as never,
    })).rejects.toBe(originalError);

    expect(completeCleanupTaskFn).not.toHaveBeenCalled();
    expect(recordCleanupTaskFailureFn).toHaveBeenCalledWith({}, '00000000-0000-4000-8000-0000000000cc', now, 'delete_failed');
  });

  it('returns normally without compensating after successful material creation', async () => {
    const createMaterialFn = vi.fn(async () => undefined);
    const compensateFn = vi.fn(async () => true);

    await expect(createMaterialWithUploadCompensation({
      db: {} as never,
      materialInput: cleanObjectFile,
      actorUserId: '00000000-0000-4000-8000-0000000000aa',
      now,
      courseId: '00000000-0000-4000-8000-000000000002',
      createMaterialFn: createMaterialFn as never,
      compensateFn: compensateFn as never,
    })).resolves.toBeUndefined();

    expect(compensateFn).not.toHaveBeenCalled();
  });
});
