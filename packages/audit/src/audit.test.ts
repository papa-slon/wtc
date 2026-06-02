import { describe, it, expect } from 'vitest';
import { AUDIT_ACTIONS, buildEvent, createMemoryAuditWriter, type AuditAction } from './index.ts';

/**
 * PG7 (20260530-2330): the LMS server-action pipeline writes a denial audit row BEFORE throwing on an
 * authorization failure (replacing the prior silent return). These codes must exist and a denial event
 * must round-trip with result:'failure' and a non-secret reason payload.
 */
describe('LMS denial audit codes (PG7)', () => {
  it('registers auth.register for audited account creation', () => {
    expect(AUDIT_ACTIONS).toContain('auth.register');
  });

  it('registers education.rbac_denied and education.entitlement_denied', () => {
    expect(AUDIT_ACTIONS).toContain('education.rbac_denied');
    expect(AUDIT_ACTIONS).toContain('education.entitlement_denied');
  });

  it('builds a denial event with result:failure and preserves the non-secret reason payload', () => {
    const e = buildEvent({
      actorUserId: 'u-1',
      actorRole: 'teacher',
      action: 'education.rbac_denied',
      targetType: 'course',
      targetId: 'c-9',
      result: 'failure',
      after: { reason: 'ownership', attempted: 'course_update' },
    });
    expect(e.result).toBe('failure');
    expect(e.action).toBe('education.rbac_denied');
    expect(e.targetId).toBe('c-9');
    // reason/attempted are not secret hints, so redaction leaves them intact.
    expect(e.after).toEqual({ reason: 'ownership', attempted: 'course_update' });
  });

  it('captures the denial via the memory writer (the demo/test audit sink)', async () => {
    const { writer, events } = createMemoryAuditWriter();
    await writer.write({
      actorUserId: 'u-2',
      actorRole: 'user',
      action: 'education.entitlement_denied',
      targetType: 'course',
      targetId: 'c-3',
      result: 'failure',
      after: { reason: 'expired', attempted: 'enroll' },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.action).toBe('education.entitlement_denied');
    expect(events[0]!.result).toBe('failure');
  });

  it('keeps denial codes inside the AuditAction union (no stringly-typed drift)', () => {
    const codes: AuditAction[] = ['education.rbac_denied', 'education.entitlement_denied'];
    for (const c of codes) expect(AUDIT_ACTIONS).toContain(c);
  });
});
