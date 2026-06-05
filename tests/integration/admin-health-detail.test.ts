import { describe, expect, it } from 'vitest';
import { projectHealthDetail } from '../../apps/web/src/features/admin/health-detail.ts';

describe('admin health detail projection', () => {
  it('allowlists and redacts integration health detail before admin rendering', () => {
    const detail = projectHealthDetail({
      adapterMode: 'mock',
      liveControlDisabled: true,
      tvAutomationDisabled: true,
      lmsPendingObjectCleanupScanned: 3,
      lmsPendingObjectCleanupCompleted: 1,
      lmsPendingObjectCleanupFailed: 1,
      lmsPendingObjectCleanupDeadLettered: 1,
      lmsPendingObjectDeleteAttempted: 2,
      lmsPendingObjectDeleteConfirmed: 1,
      token: 'Bearer abc.def.ghi',
      error: 'failed with token=abc123',
      storageKey: 'lms/materials/adminhealthleak01',
      cleanupTaskId: 'cleanup-task-private-id',
      nested: { secret: 'plain' },
      warnings: ['tp_reconcile_p0', 'margin'],
      warningCodes: ['legacy_quarantined', 'no_trade_history', 'apiKey=abc123'],
    });

    expect(detail).toMatchObject({
      adapterMode: 'mock',
      liveControlDisabled: true,
      tvAutomationDisabled: true,
      lmsPendingObjectCleanupScanned: 3,
      lmsPendingObjectCleanupCompleted: 1,
      lmsPendingObjectCleanupFailed: 1,
      lmsPendingObjectCleanupDeadLettered: 1,
      lmsPendingObjectDeleteAttempted: 2,
      lmsPendingObjectDeleteConfirmed: 1,
      warnings: ['tp_reconcile_p0', 'legacy_quarantined', 'no_trade_history'],
    });
    expect(JSON.stringify(detail)).not.toContain('abc.def.ghi');
    expect(JSON.stringify(detail)).not.toContain('abc123');
    expect(JSON.stringify(detail)).not.toContain('plain');
    expect(JSON.stringify(detail)).not.toContain('adminhealthleak01');
    expect(JSON.stringify(detail)).not.toContain('cleanup-task-private-id');
    expect(detail).not.toHaveProperty('nested');
    expect(detail).not.toHaveProperty('token');
    expect(detail).not.toHaveProperty('storageKey');
    expect(detail).not.toHaveProperty('cleanupTaskId');
    expect(detail).not.toHaveProperty('warningCodes');
  });

  it('projects worker bot continuity summary fields without exposing secret strings', () => {
    const detail = projectHealthDetail({
      coreWorkerStatus: 'ok',
      botContinuityStatus: 'attention',
      tortilaSnapshot: 'skipped',
      tortilaHealthStatus: 'not_configured',
      tortilaReadState: 'not_configured',
      tortilaReadStateDetail: 'set TORTILA_JOURNAL_BASE_URL',
      tortilaLastError: 'journal token=TORTILA_WORKER_SECRET',
      legacySnapshot: 'ok',
      legacyHealthStatus: 'ok',
      legacyReadState: 'ok',
      legacyAccountsSeen: 3,
      legacyLastError: 'legacy apiKey=LEGACY_WORKER_SECRET',
      token: 'Bearer worker.secret.token',
      rawUrl: 'postgres://secret@localhost/db',
    });

    expect(detail).toMatchObject({
      coreWorkerStatus: 'ok',
      botContinuityStatus: 'attention',
      tortilaSnapshot: 'skipped',
      tortilaHealthStatus: 'not_configured',
      tortilaReadState: 'not_configured',
      tortilaReadStateDetail: 'set TORTILA_JOURNAL_BASE_URL',
      tortilaLastError: 'journal token=[REDACTED]',
      legacySnapshot: 'ok',
      legacyHealthStatus: 'ok',
      legacyReadState: 'ok',
      legacyAccountsSeen: 3,
      legacyLastError: 'legacy apiKey=[REDACTED]',
    });
    expect(JSON.stringify(detail)).not.toContain('TORTILA_WORKER_SECRET');
    expect(JSON.stringify(detail)).not.toContain('LEGACY_WORKER_SECRET');
    expect(JSON.stringify(detail)).not.toContain('worker.secret.token');
    expect(JSON.stringify(detail)).not.toContain('postgres://');
    expect(detail).not.toHaveProperty('token');
    expect(detail).not.toHaveProperty('rawUrl');
  });
});
