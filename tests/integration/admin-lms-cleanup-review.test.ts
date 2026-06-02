import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('admin LMS cleanup review surface', () => {
  it('uses the count-only DB summary and renders no object locator fields', () => {
    const queries = read('apps/web/src/features/admin/queries.ts');
    const page = read('apps/web/src/app/admin/system-health/page.tsx');

    expect(queries).toContain('summarizeLmsObjectCleanupOperations');
    expect(queries).toContain('lmsObjectCleanup');
    expect(page).toContain('LMS upload cleanup review');
    expect(page).toContain('Dead-lettered');
    expect(page).toContain('Due retry');
    expect(page).toContain('Acknowledge reviewed');
    expect(page).toContain('Retry acknowledged');
    expect(page).toContain('hides cleanup task IDs, object keys, filenames, hashes, signed URLs, scanner details, and provider response bodies');

    for (const forbidden of ['storageKey', 'storage_key', 'cleanupTaskId', 'cleanup_task_id', 'fileName', 'contentSha256', 'X-Amz', 'Authorization']) {
      expect(queries).not.toContain(forbidden);
      expect(page).not.toContain(forbidden);
    }
  });

  it('keeps the repository operational summary free of storage key and task id projections', () => {
    const repositories = read('packages/db/src/repositories.ts');
    const start = repositories.indexOf('export async function summarizeLmsObjectCleanupOperations');
    const end = repositories.indexOf('function boundedLmsCleanupOperationLimit', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const summarySource = repositories.slice(start, end);

    expect(summarySource).toContain('lastErrorCode');
    expect(summarySource).toContain('deadLettered');
    expect(summarySource).not.toContain('storageKey');
    expect(summarySource).not.toContain('storage_key');
    expect(summarySource).not.toContain('cleanupTaskId');
    expect(summarySource).not.toContain('id:');
  });

  it('keeps admin cleanup operations aggregate-only', () => {
    const actions = read('apps/web/src/features/admin/actions.ts');
    const schemas = read('apps/web/src/features/admin/schemas.ts');
    const page = read('apps/web/src/app/admin/system-health/page.tsx');

    expect(actions).toContain('adminAcknowledgeLmsCleanupDeadLettersAction');
    expect(actions).toContain('adminRetryAcknowledgedLmsCleanupDeadLettersAction');
    expect(actions).toContain('assertAdmin(actor.roles)');
    expect(actions).toContain('assertCsrf(formData)');
    expect(schemas).toContain('acknowledge_dead_letters');
    expect(schemas).toContain('retry_acknowledged_dead_letters');
    expect(schemas).toContain('expectedCount');
    expect(schemas).toContain('expectedLatestDeadLetteredAt');
    expect(schemas).toContain('expectedLatestAcknowledgedAt');
    expect(page).toContain('operation" value="acknowledge_dead_letters"');
    expect(page).toContain('operation" value="retry_acknowledged_dead_letters"');
    expect(page).toContain('name="expectedCount"');
    expect(page).toContain('name="expectedLatestDeadLetteredAt"');
    expect(page).toContain('name="expectedLatestAcknowledgedAt"');

    const cleanupActionSource = actions.slice(actions.indexOf('// ---- LMS pending upload cleanup'));
    for (const forbidden of ['storageKey', 'storage_key', 'cleanupTaskId', 'cleanup_task_id', 'X-Amz', 'Authorization']) {
      expect(cleanupActionSource).not.toContain(forbidden);
      expect(schemas).not.toContain(forbidden);
      expect(page).not.toContain(forbidden);
    }
  });
});
