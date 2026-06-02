/**
 * Pure LMS guards (no I/O — inject the looked-up values). Ownership is enforced server-side before
 * every teacher mutation; entitlement is fail-closed for student access. See
 * docs/handoffs/20260530-1042-ecosystem-security-auditor.md.
 */
import { OwnershipDenied, EntitlementDenied } from './errors.ts';

export interface OwnershipCheck {
  isAdmin: boolean;
  actorUserId: string;
  actorTeacherProfileId?: string | null;
  courseOwnerTeacherId: string;
  courseTeacherProfileId?: string | null;
}

/**
 * A teacher owns a course when the course's owner matches by teacher_profile_id (preferred) OR by the
 * legacy owner_teacher_id (= users.id). Admin bypasses ownership (but the caller still audits as admin).
 */
export function assertTeacherOwns(c: OwnershipCheck): void {
  if (c.isAdmin) return;
  const ownsByProfile =
    c.actorTeacherProfileId != null && c.courseTeacherProfileId != null && c.courseTeacherProfileId === c.actorTeacherProfileId;
  const ownsByUser = c.courseOwnerTeacherId === c.actorUserId;
  if (!ownsByProfile && !ownsByUser) throw new OwnershipDenied('FORBIDDEN: not your course');
}

/** Fail-closed: throws EntitlementDenied unless access is explicitly allowed (unknown = denied). */
export function assertEducationAccess(allowed: boolean): void {
  if (!allowed) throw new EntitlementDenied('FORBIDDEN: education entitlement required');
}
