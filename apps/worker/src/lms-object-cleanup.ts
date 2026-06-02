import {
  completeLmsObjectCleanupTasks,
  finalizeLmsObjectMaterialCleanup,
  listExpiredLmsObjectMaterialFiles,
  listPendingLmsObjectCleanupTasks,
  recordLmsObjectCleanupTaskFailure,
  type Db,
} from '@wtc/db';
import { buildLmsObjectDeleteRequest, readLmsObjectStorageConfig } from '@wtc/lms';

type WorkerEnv = Record<string, string | undefined>;

export interface LmsObjectMaterialCleanupResult {
  scanned: number;
  objectDeleteAttempted: number;
  objectDeleteConfirmed: number;
  metadataOnlyPurged: number;
  purged: number;
  failed: number;
}

export interface LmsPendingObjectCleanupResult {
  scanned: number;
  objectDeleteAttempted: number;
  objectDeleteConfirmed: number;
  completed: number;
  failed: number;
  deadLettered: number;
}

export async function deleteLmsObjectStorageObject(input: {
  storageKey: string;
  now: number;
  env?: WorkerEnv;
}): Promise<void> {
  const config = readLmsObjectStorageConfig(input.env ?? process.env);
  const request = buildLmsObjectDeleteRequest({ config, storageKey: input.storageKey, now: input.now });
  let response: Response;
  try {
    response = await fetch(request.url, { method: 'DELETE', headers: request.headers });
  } catch {
    throw new Error('lms_object_storage_delete_failed');
  }
  if (!response.ok && response.status !== 404) throw new Error('lms_object_storage_delete_failed');
}

export async function reconcileExpiredLmsObjectMaterials(
  db: Db,
  now = Date.now(),
  env: WorkerEnv = process.env,
): Promise<LmsObjectMaterialCleanupResult> {
  const candidates = await listExpiredLmsObjectMaterialFiles(db, now);
  const confirmedMaterialIds: string[] = [];
  let objectDeleteAttempted = 0;
  let objectDeleteConfirmed = 0;
  let metadataOnlyPurged = 0;
  let failed = 0;
  for (const candidate of candidates) {
    if (candidate.scanStatus !== 'clean') {
      confirmedMaterialIds.push(candidate.materialId);
      metadataOnlyPurged += 1;
      continue;
    }
    objectDeleteAttempted += 1;
    try {
      await deleteLmsObjectStorageObject({ storageKey: candidate.storageKey, now, env });
      confirmedMaterialIds.push(candidate.materialId);
      objectDeleteConfirmed += 1;
    } catch {
      failed += 1;
    }
  }
  const finalized = await finalizeLmsObjectMaterialCleanup(db, confirmedMaterialIds, now);
  return {
    scanned: candidates.length,
    objectDeleteAttempted,
    objectDeleteConfirmed,
    metadataOnlyPurged,
    purged: finalized.purged,
    failed,
  };
}

export async function reconcilePendingLmsObjectCleanupTasks(
  db: Db,
  now = Date.now(),
  env: WorkerEnv = process.env,
): Promise<LmsPendingObjectCleanupResult> {
  const tasks = await listPendingLmsObjectCleanupTasks(db, now);
  const confirmedTaskIds: string[] = [];
  let objectDeleteAttempted = 0;
  let objectDeleteConfirmed = 0;
  let failed = 0;
  let deadLettered = 0;

  for (const task of tasks) {
    objectDeleteAttempted += 1;
    try {
      await deleteLmsObjectStorageObject({ storageKey: task.storageKey, now, env });
      confirmedTaskIds.push(task.cleanupTaskId);
      objectDeleteConfirmed += 1;
    } catch {
      failed += 1;
      const failure = await recordLmsObjectCleanupTaskFailure(db, task.cleanupTaskId, now, 'delete_failed');
      if (failure.status === 'dead_letter') deadLettered += 1;
    }
  }

  const completed = await completeLmsObjectCleanupTasks(db, confirmedTaskIds, now);
  return {
    scanned: tasks.length,
    objectDeleteAttempted,
    objectDeleteConfirmed,
    completed: completed.completed,
    failed,
    deadLettered,
  };
}
