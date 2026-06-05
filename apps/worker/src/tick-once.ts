/** Run one real DB worker tick and exit. Use --memory-demo only for local demo smoke checks. */
import { dbTick, memoryTick, workerRequiresDatabase } from './index.ts';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (process.argv.includes('--memory-demo')) {
      if (workerRequiresDatabase(process.env)) {
        console.error('[worker:tick] DATABASE_URL is required for worker in staging/production; memory demo is local-only.');
        process.exitCode = 2;
        return;
      }
      await memoryTick();
      console.log('[worker:tick] memory demo tick OK');
      return;
    }
    console.error('[worker:tick] DATABASE_URL is required for real one-shot worker acceptance. Pass --memory-demo only for local demo checks.');
    process.exitCode = 2;
    return;
  }

  const result = await dbTick(url);
  console.log(`[worker:tick] DB tick OK; worker_status=${result.workerHealthStatus}; bot_continuity=${result.botContinuityStatus}; entitlements=${result.entitlementsChanged}; tv_expiring=${result.tvExpiringSoon}; tv_expired=${result.tvExpired}; tv_tasks=${result.tvTasksQueued}; tv_tasks_repaired=${result.tvTasksRepaired}; jtis_purged=${result.handoffJtisPurged}; lms_materials_purged=${result.lmsMaterialsPurged}; lms_object_materials_scanned=${result.lmsObjectMaterialsScanned}; lms_object_delete_attempted=${result.lmsObjectDeleteAttempted}; lms_object_delete_confirmed=${result.lmsObjectDeleteConfirmed}; lms_object_metadata_only_purged=${result.lmsObjectMetadataOnlyPurged}; lms_object_materials_purged=${result.lmsObjectMaterialsPurged}; lms_object_cleanup_failed=${result.lmsObjectCleanupFailed}; lms_pending_object_cleanup_scanned=${result.lmsPendingObjectCleanupScanned}; lms_pending_object_delete_attempted=${result.lmsPendingObjectDeleteAttempted}; lms_pending_object_delete_confirmed=${result.lmsPendingObjectDeleteConfirmed}; lms_pending_object_cleanup_completed=${result.lmsPendingObjectCleanupCompleted}; lms_pending_object_cleanup_failed=${result.lmsPendingObjectCleanupFailed}; lms_pending_object_cleanup_dead_lettered=${result.lmsPendingObjectCleanupDeadLettered}; tortila=${result.tortilaSnapshot}${result.tortilaLastError ? ` (${result.tortilaLastError})` : ''}; legacy=${result.legacySnapshot}${result.legacyLastError ? ` (${result.legacyLastError})` : ''}`);
}

void main().catch((err) => {
  console.error(`[worker:tick] failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
