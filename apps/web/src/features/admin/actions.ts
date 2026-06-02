'use server';
/**
 * Admin server actions. Security protocol (F-12/F-13):
 *   requireUser() → assertAdmin(roles) → assertCsrf(formData) → Zod → repo (in-txn audit) → revalidatePath
 *
 * Every action is audited: grant/revoke mutations write their audit row inside the same DB
 * transaction as the entitlement change (via the @wtc/db repos). Support ticket updates also
 * write in-txn audit rows via updateSupportTicket.
 */

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { assertAdmin } from '@wtc/auth';
import { assertCsrf } from '@/lib/csrf';
import { grantProduct as backendGrantProduct, revokeProduct as backendRevokeProduct } from '@/lib/backend';
import { getServerDb } from '@/lib/backend';
import { updateSupportTicket } from '@wtc/db';
import {
  acknowledgeLmsCleanupSchema,
  flagReviewSchema,
  grantProductSchema,
  retryLmsCleanupSchema,
  revokeProductSchema,
  resolveReviewSchema,
  ticketUpdateSchema,
  unlockAccountSchema,
} from './schemas';
import type { ProductCode } from '@wtc/entitlements';

// ---- Entitlement: grant with reason + validUntil ----

/**
 * Grant a product to a user. Requires reason (audit trail). Optional validUntil (date string).
 * Security: requireUser → assertAdmin → assertCsrf → Zod → grantProduct (in-txn audit) → revalidate.
 */
export async function adminGrantProductAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);

  const raw = {
    userId: formData.get('userId'),
    product: formData.get('product'),
    reason: formData.get('reason'),
    validUntil: formData.get('validUntil') ?? undefined,
  };

  const parsed = grantProductSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
  }

  const { userId, product, reason, validUntil } = parsed.data;

  // Call the DB repo directly with the new optional params (reason, validUntil, actorUserId).
  // getServerDb() returns null in demo mode — we fall back to the basic backend wrapper.
  const db = getServerDb();
  if (db) {
    const { grantProduct: repoGrantProduct } = await import('@wtc/db');
    await repoGrantProduct(db, userId, product as ProductCode, Date.now(), actor.id, reason, validUntil);
  } else {
    // Demo/memory mode — no reason/validUntil support; fall back gracefully.
    await backendGrantProduct(userId, product as ProductCode);
  }

  revalidatePath('/admin/entitlements');
}

// ---- Entitlement: revoke with reason ----

/**
 * Revoke a product from a user. Requires reason (audit trail).
 * Security: requireUser → assertAdmin → assertCsrf → Zod → revokeProduct (in-txn audit) → revalidate.
 */
export async function adminRevokeProductAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);

  const raw = {
    userId: formData.get('userId'),
    product: formData.get('product'),
    reason: formData.get('reason'),
  };

  const parsed = revokeProductSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
  }

  const { userId, product, reason } = parsed.data;

  const db = getServerDb();
  if (db) {
    const { revokeProduct: repoRevokeProduct } = await import('@wtc/db');
    await repoRevokeProduct(db, userId, product as ProductCode, Date.now(), actor.id, reason);
  } else {
    await backendRevokeProduct(userId, product as ProductCode);
  }

  revalidatePath('/admin/entitlements');
}

// ---- Support: status update ----

/**
 * Update support ticket status (admin triage).
 * Security: requireUser → assertAdmin → assertCsrf → Zod → updateSupportTicket (in-txn audit) → revalidate.
 */
export async function adminUpdateTicketAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);

  const raw = {
    ticketId: formData.get('ticketId'),
    status: formData.get('status'),
  };

  const parsed = ticketUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
  }

  const { ticketId, status } = parsed.data;

  const db = getServerDb();
  if (!db) {
    // Demo mode: no DB available. In production getServerDb() throws fail-closed.
    return;
  }

  await updateSupportTicket(db, ticketId, { status }, actor.id);
  revalidatePath('/admin/support');
}

// ---- Users: account login lockout unlock ----

export async function adminUnlockAccountAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);

  const parsed = unlockAccountSchema.safeParse({
    userId: formData.get('userId'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
  }

  const db = getServerDb();
  if (!db) throw new Error('Database is required for account unlock');

  const { unlockUserLoginLockout } = await import('@wtc/db');
  await unlockUserLoginLockout(db, {
    targetUserId: parsed.data.userId,
    actorUserId: actor.id,
    reason: parsed.data.reason,
  });

  revalidatePath('/admin/users');
  revalidatePath('/admin/audit-log');
}

// ---- Billing manual review: flag for review ----

/**
 * Flag an existing entitlement for manual review.
 * Transitions the entitlement to 'manual_review' state so admin can inspect and resolve.
 * Security: requireUser → assertAdmin → assertCsrf → Zod → flagProductForReview (in-txn audit) → revalidate.
 */
export async function adminFlagReviewAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);

  const raw = {
    userId: formData.get('userId'),
    product: formData.get('product'),
    reason: formData.get('reason'),
  };

  const parsed = flagReviewSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
  }

  const { userId, product, reason } = parsed.data;

  const db = getServerDb();
  if (!db) return; // demo mode: no-op

  const { flagProductForReview } = await import('@wtc/db');
  await flagProductForReview(db, userId, product as ProductCode, Date.now(), actor.id, reason);
  revalidatePath('/admin/entitlements');
}

// ---- Billing manual review: approve (→ active) ----

/**
 * Approve a pending billing_manual_review_items entry, optionally granting the entitlement.
 * Requires: itemId, resolutionNote (min 3 chars), optional approvalUserId + approvalProductCodes.
 * Security: requireUser → assertAdmin → assertCsrf → Zod → resolveManualReviewItem + optional grantProduct → revalidate.
 */
export async function adminApproveReviewAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);

  const raw = {
    itemId: formData.get('itemId'),
    resolution: 'approved',
    resolutionNote: formData.get('resolutionNote'),
    approvalUserId: formData.get('approvalUserId') ?? undefined,
    approvalProductCodes: formData.get('approvalProductCodes') ?? undefined,
  };

  const parsed = resolveReviewSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
  }

  const db = getServerDb();
  if (!db) return;

  const { resolveManualReviewItem: repoResolve } = await import('@wtc/db');
  const { isProductCode } = await import('@wtc/entitlements');

  const productCodes = parsed.data.approvalProductCodes
    ? (parsed.data.approvalProductCodes
        .split(',')
        .map((s) => s.trim())
        .filter((s) => isProductCode(s)) as ProductCode[])
    : [];

  await repoResolve(db, {
    itemId: parsed.data.itemId,
    resolution: 'approved',
    resolvedByAdminId: actor.id,
    resolutionNote: parsed.data.resolutionNote,
    approvalTarget:
      parsed.data.approvalUserId && productCodes.length > 0
        ? { userId: parsed.data.approvalUserId, productCodes }
        : undefined,
  });

  revalidatePath('/admin/entitlements');
  revalidatePath('/admin/entitlements/review');
}

// ---- Billing manual review: reject or dismiss ----

/**
 * Reject (→ no grant, records rejection) or dismiss (audit-only, no entitlement change)
 * a pending billing_manual_review_items entry.
 * Security: requireUser → assertAdmin → assertCsrf → Zod → resolveManualReviewItem (in-txn audit) → revalidate.
 */
export async function adminRejectOrDismissReviewAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);

  const raw = {
    itemId: formData.get('itemId'),
    resolution: formData.get('resolution'), // 'rejected' | 'dismissed'
    resolutionNote: formData.get('resolutionNote'),
  };

  const parsed = resolveReviewSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
  }
  if (parsed.data.resolution !== 'rejected' && parsed.data.resolution !== 'dismissed') {
    throw new Error('Invalid resolution for this action — use approve action for approvals');
  }

  const db = getServerDb();
  if (!db) return;

  const { resolveManualReviewItem: repoResolve } = await import('@wtc/db');
  await repoResolve(db, {
    itemId: parsed.data.itemId,
    resolution: parsed.data.resolution,
    resolvedByAdminId: actor.id,
    resolutionNote: parsed.data.resolutionNote,
  });

  revalidatePath('/admin/entitlements');
  revalidatePath('/admin/entitlements/review');
}

// ---- LMS pending upload cleanup: aggregate dead-letter operations ----

export async function adminAcknowledgeLmsCleanupDeadLettersAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);

  const parsed = acknowledgeLmsCleanupSchema.safeParse({
    operation: formData.get('operation'),
    expectedCount: formData.get('expectedCount'),
    expectedLatestDeadLetteredAt: formData.get('expectedLatestDeadLetteredAt'),
  });
  if (!parsed.success) throw new Error('Invalid LMS cleanup acknowledgement request');

  const db = getServerDb();
  if (!db) throw new Error('Database is required for LMS cleanup acknowledgement');

  const { acknowledgeLmsObjectCleanupDeadLetters } = await import('@wtc/db');
  await acknowledgeLmsObjectCleanupDeadLetters(db, {
    actorUserId: actor.id,
    expectedCount: parsed.data.expectedCount,
    expectedLatestDeadLetteredAt: parsed.data.expectedLatestDeadLetteredAt,
  });
  revalidatePath('/admin/system-health');
}

export async function adminRetryAcknowledgedLmsCleanupDeadLettersAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);

  const parsed = retryLmsCleanupSchema.safeParse({
    operation: formData.get('operation'),
    expectedCount: formData.get('expectedCount'),
    expectedLatestAcknowledgedAt: formData.get('expectedLatestAcknowledgedAt'),
  });
  if (!parsed.success) throw new Error('Invalid LMS cleanup retry request');

  const db = getServerDb();
  if (!db) throw new Error('Database is required for LMS cleanup retry');

  const { retryAcknowledgedLmsObjectCleanupDeadLetters } = await import('@wtc/db');
  await retryAcknowledgedLmsObjectCleanupDeadLetters(db, {
    actorUserId: actor.id,
    expectedCount: parsed.data.expectedCount,
    expectedLatestAcknowledgedAt: parsed.data.expectedLatestAcknowledgedAt,
  });
  revalidatePath('/admin/system-health');
}
