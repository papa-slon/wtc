import type {
  completeLmsObjectCleanupTask,
  createMaterial as createMaterialRepo,
  createMaterialAndCompleteLmsObjectCleanupTask,
  recordLmsObjectCleanupTaskFailure,
} from '@wtc/db';
import type { compensateLmsUploadedFile as compensateUpload } from './material-storage';

type CreateMaterialFn = typeof createMaterialRepo;
type CreateMaterialAndCompleteCleanupFn = typeof createMaterialAndCompleteLmsObjectCleanupTask;
type CompensateUploadFn = typeof compensateUpload;
type CompleteCleanupTaskFn = typeof completeLmsObjectCleanupTask;
type RecordCleanupTaskFailureFn = typeof recordLmsObjectCleanupTaskFailure;
type CreateMaterialInput = Parameters<CreateMaterialFn>[1];
type Db = Parameters<CreateMaterialFn>[0];

export async function createMaterialWithUploadCompensation(input: {
  db: Db;
  materialInput: CreateMaterialInput;
  cleanupTaskId?: string | null;
  actorUserId: string;
  now: number;
  courseId: string;
  createMaterialFn: CreateMaterialFn;
  createMaterialAndCompleteCleanupFn?: CreateMaterialAndCompleteCleanupFn;
  compensateFn: CompensateUploadFn;
  completeCleanupTaskFn?: CompleteCleanupTaskFn;
  recordCleanupTaskFailureFn?: RecordCleanupTaskFailureFn;
}): Promise<void> {
  try {
    if (input.cleanupTaskId && input.createMaterialAndCompleteCleanupFn) {
      await input.createMaterialAndCompleteCleanupFn(input.db, input.materialInput, input.cleanupTaskId, input.actorUserId, input.now, input.courseId);
    } else {
      await input.createMaterialFn(input.db, input.materialInput, input.actorUserId, input.now, input.courseId);
    }
  } catch (err) {
    if (input.materialInput.kind === 'file') {
      try {
        const compensated = await input.compensateFn({ material: input.materialInput, now: input.now });
        if (compensated && input.cleanupTaskId && input.completeCleanupTaskFn) {
          await input.completeCleanupTaskFn(input.db, input.cleanupTaskId, input.now).catch(() => undefined);
        }
      } catch {
        if (input.cleanupTaskId && input.recordCleanupTaskFailureFn) {
          await input.recordCleanupTaskFailureFn(input.db, input.cleanupTaskId, input.now, 'delete_failed').catch(() => undefined);
        }
      }
    }
    throw err;
  }
}
