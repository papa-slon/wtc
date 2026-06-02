import { describe, it, expect } from 'vitest';
import {
  assertTeacherOwns,
  assertEducationAccess,
  OwnershipDenied,
  EntitlementDenied,
  courseProgressPct,
  isCourseComplete,
  deriveLessonState,
  enrollmentSource,
  levelTone,
  isHttpsUrl,
  safeHttpsUrl,
} from './index.ts';

describe('@wtc/lms guards (pure)', () => {
  it('assertTeacherOwns: owner-by-userId passes; non-owner throws; admin bypasses', () => {
    expect(() => assertTeacherOwns({ isAdmin: false, actorUserId: 'u1', courseOwnerTeacherId: 'u1' })).not.toThrow();
    expect(() => assertTeacherOwns({ isAdmin: false, actorUserId: 'u2', courseOwnerTeacherId: 'u1' })).toThrow(OwnershipDenied);
    expect(() => assertTeacherOwns({ isAdmin: true, actorUserId: 'u2', courseOwnerTeacherId: 'u1' })).not.toThrow();
  });
  it('assertTeacherOwns: owner-by-teacherProfileId passes even when userId differs', () => {
    expect(() => assertTeacherOwns({ isAdmin: false, actorUserId: 'x', actorTeacherProfileId: 'p1', courseOwnerTeacherId: 'other', courseTeacherProfileId: 'p1' })).not.toThrow();
    expect(() => assertTeacherOwns({ isAdmin: false, actorUserId: 'x', actorTeacherProfileId: 'p1', courseOwnerTeacherId: 'other', courseTeacherProfileId: 'p2' })).toThrow(OwnershipDenied);
  });
  it('assertEducationAccess: fail-closed', () => {
    expect(() => assertEducationAccess(true)).not.toThrow();
    expect(() => assertEducationAccess(false)).toThrow(EntitlementDenied);
  });
});

describe('@wtc/lms completion math (pure)', () => {
  it('courseProgressPct clamps + rounds', () => {
    expect(courseProgressPct(0, 0)).toBe(0);
    expect(courseProgressPct(4, 1)).toBe(25);
    expect(courseProgressPct(4, 4)).toBe(100);
    expect(courseProgressPct(4, 9)).toBe(100); // clamped to total
    expect(courseProgressPct(3, 1)).toBe(33);
  });
  it('isCourseComplete needs ≥1 lesson and all done', () => {
    expect(isCourseComplete(0, 0)).toBe(false);
    expect(isCourseComplete(3, 2)).toBe(false);
    expect(isCourseComplete(3, 3)).toBe(true);
  });
  it('deriveLessonState from the lean progress row', () => {
    expect(deriveLessonState(null)).toEqual({ state: 'not_started', progressPct: 0 });
    expect(deriveLessonState({ completed: true, percentComplete: '0' })).toEqual({ state: 'completed', progressPct: 100 });
    expect(deriveLessonState({ completed: false, percentComplete: '40' })).toEqual({ state: 'started', progressPct: 40 });
    expect(deriveLessonState({ completed: false, percentComplete: '0' })).toEqual({ state: 'not_started', progressPct: 0 });
  });
  it('enrollmentSource', () => {
    expect(enrollmentSource(null)).toBe('manual_admin');
    expect(enrollmentSource('e1')).toBe('entitlement');
  });
  it('levelTone maps course level → pill tone', () => {
    expect(levelTone('beginner')).toBe('neutral');
    expect(levelTone('intermediate')).toBe('warn');
    expect(levelTone('advanced')).toBe('gold');
    expect(levelTone('unknown')).toBe('neutral'); // fail-safe default
  });
});

describe('@wtc/lms url safety (pure, Phase 3.1)', () => {
  it('isHttpsUrl accepts only absolute https URLs', () => {
    expect(isHttpsUrl('https://example.com/x')).toBe(true);
    expect(isHttpsUrl('http://example.com')).toBe(false); // not https
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false); // XSS scheme
    expect(isHttpsUrl('data:text/html,<script>1</script>')).toBe(false);
    expect(isHttpsUrl('/relative/path')).toBe(false);
    expect(isHttpsUrl('https://')).toBe(false); // malformed
    expect(isHttpsUrl('')).toBe(false);
    expect(isHttpsUrl(null)).toBe(false);
    expect(isHttpsUrl(undefined)).toBe(false);
  });
  it('safeHttpsUrl returns the url only when safe, else null', () => {
    expect(safeHttpsUrl('https://example.com')).toBe('https://example.com');
    expect(safeHttpsUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpsUrl('http://example.com')).toBeNull();
    expect(safeHttpsUrl(undefined)).toBeNull();
  });
});
