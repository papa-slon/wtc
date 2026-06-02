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
      warnings: ['margin', 'take-profit'],
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
      warnings: ['margin', 'take-profit'],
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
  });
});
