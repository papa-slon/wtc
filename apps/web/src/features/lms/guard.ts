import 'server-only';
/**
 * LMS authorization gates for the server-action mutation pipeline (PG7 / 20260530-2330).
 *
 * Each gate FAILS LOUD: on an authorization denial it writes ONE audit row (result:'failure',
 * action education.rbac_denied | education.entitlement_denied) and THEN throws AppError — replacing
 * the prior silent `return` that let a denied attempt look like a no-op with no trace. The pure
 * decision logic lives in @wtc/lms (assertTeacherOwns / fail-closed entitlement); these wrappers add
 * the app-layer audit + throw. Business logic stays out of the React pages.
 *
 * Demo-mode note: requireTeacher / requireAdmin / requireEducationAccess run BEFORE the db-null demo
 * guard, so a denied attempt is rejected (and audited to the in-memory writer) regardless of storage.
 * requireCourseOwnership needs a loaded course, so callers run it only AFTER `if (!db) return`.
 */
import { AppError } from '@wtc/shared';
import { assertTeacherOwns } from '@wtc/lms';
import { audit } from '@/lib/backend';
import { accessFor } from '@/lib/access';
import { loadOwnershipContext } from './queries';

export interface LmsActor {
  id: string;
  roles?: string[];
}

/** Denial-audit context: what resource was targeted and what was attempted (no secrets). */
export interface DenialCtx {
  targetType: string;
  targetId?: string;
  attempted: string;
}

type DenialAction = 'education.rbac_denied' | 'education.entitlement_denied';

export function lmsRoles(user: LmsActor): { isAdmin: boolean; isTeacher: boolean } {
  const r = user.roles ?? [];
  const isAdmin = r.includes('admin');
  return { isAdmin, isTeacher: isAdmin || r.includes('teacher') };
}

async function auditDenied(user: LmsActor, action: DenialAction, ctx: DenialCtx, reason: string): Promise<void> {
  await audit.write({
    actorUserId: user.id,
    actorRole: user.roles?.[0] ?? 'user',
    action,
    targetType: ctx.targetType,
    targetId: ctx.targetId ?? null,
    result: 'failure',
    after: { reason, attempted: ctx.attempted },
  });
}

/** Explicit denial helper for parent/resource mismatches discovered after loading a target row. */
export async function denyLmsMutation(user: LmsActor, ctx: DenialCtx, reason = 'ownership'): Promise<never> {
  await auditDenied(user, 'education.rbac_denied', ctx, reason);
  throw new AppError('forbidden', 'Not your course');
}

/** Teacher-or-admin gate. Audits (rbac_denied / role) + throws 403 on denial. */
export async function requireTeacher(user: LmsActor, ctx: DenialCtx): Promise<void> {
  if (lmsRoles(user).isTeacher) return;
  await auditDenied(user, 'education.rbac_denied', ctx, 'role');
  throw new AppError('forbidden', 'Teacher role required');
}

/** Admin-only gate. Audits (rbac_denied / admin_required) + throws 403 on denial. */
export async function requireAdmin(user: LmsActor, ctx: DenialCtx): Promise<void> {
  if (lmsRoles(user).isAdmin) return;
  await auditDenied(user, 'education.rbac_denied', ctx, 'admin_required');
  throw new AppError('forbidden', 'Admin role required');
}

/**
 * Course-ownership gate (admin bypasses). Run ONLY after the db-null demo guard, since it loads the
 * course owner. A missing course is treated as a denial (no existence leak), audited (ownership).
 */
export async function requireCourseOwnership(user: LmsActor, isAdmin: boolean, courseId: string, ctx: DenialCtx): Promise<void> {
  if (isAdmin) return;
  const c = await loadOwnershipContext(user.id, courseId);
  if (c) {
    try {
      assertTeacherOwns({
        isAdmin: false,
        actorUserId: user.id,
        actorTeacherProfileId: c.actorTeacherProfileId,
        courseOwnerTeacherId: c.courseOwnerTeacherId,
        courseTeacherProfileId: c.courseTeacherProfileId,
      });
      return;
    } catch {
      /* fall through to the denial audit + throw */
    }
  }
  await auditDenied(user, 'education.rbac_denied', ctx, 'ownership');
  throw new AppError('forbidden', 'Not your course');
}

/** Student education-entitlement gate (fail-closed). Audits (entitlement_denied / <reason>) + throws 402. */
export async function requireEducationAccess(user: LmsActor, ctx: DenialCtx): Promise<void> {
  const access = await accessFor(user.id, 'education');
  if (access.allowed) return;
  await auditDenied(user, 'education.entitlement_denied', ctx, access.reason);
  throw new AppError('entitlement_denied', 'Education access required');
}
