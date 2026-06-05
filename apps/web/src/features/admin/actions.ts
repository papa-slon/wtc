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
  disableLegacyProviderAccountSchema,
  flagReviewSchema,
  grantProductSchema,
  mapLegacyProviderAccountSchema,
  retryLmsCleanupSchema,
  revokeProductSchema,
  resolveReviewSchema,
  saveBotGlobalConfigSchema,
  ticketUpdateSchema,
  unlockAccountSchema,
} from './schemas';
import type { ProductCode } from '@wtc/entitlements';
import {
  botConfigFormInput,
  botConfigFormIssues,
  botConfigSchemaFor,
} from '@/features/bots/config';
import type { BotProductCode } from '@/features/bots/meta';

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

// ---- Bot provider accounts: Legacy pub_id mapping ----

export async function adminMapLegacyProviderAccountAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);

  const parsed = mapLegacyProviderAccountSchema.safeParse({
    userId: formData.get('userId'),
    botInstanceId: formData.get('botInstanceId') ?? undefined,
    providerAccountId: formData.get('providerAccountId'),
    label: formData.get('label'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
  }

  const db = getServerDb();
  if (!db) throw new Error('Database is required for Legacy provider account mapping');

  const { ensureBotInstance, upsertBotProviderAccountMapping } = await import('@wtc/db');
  const botInstanceId =
    parsed.data.botInstanceId ??
    (await ensureBotInstance(db, {
      userId: parsed.data.userId,
      productCode: 'legacy_bot',
    })).id;

  await upsertBotProviderAccountMapping(db, {
    userId: parsed.data.userId,
    botInstanceId,
    productCode: 'legacy_bot',
    provider: 'legacy-db',
    providerAccountId: parsed.data.providerAccountId,
    label: parsed.data.label,
    actorUserId: actor.id,
    reason: parsed.data.reason,
  });

  revalidatePath(`/admin/users/${parsed.data.userId}/bots`);
  revalidatePath('/admin/bots');
  revalidatePath('/admin/audit-log');
}

export async function adminDisableLegacyProviderAccountAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);

  const parsed = disableLegacyProviderAccountSchema.safeParse({
    userId: formData.get('userId'),
    mappingId: formData.get('mappingId'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
  }

  const db = getServerDb();
  if (!db) throw new Error('Database is required for Legacy provider account disable');

  const { disableBotProviderAccountMapping } = await import('@wtc/db');
  await disableBotProviderAccountMapping(db, {
    id: parsed.data.mappingId,
    actorUserId: actor.id,
    userId: parsed.data.userId,
    productCode: 'legacy_bot',
    provider: 'legacy-db',
    reason: parsed.data.reason,
  });

  revalidatePath(`/admin/users/${parsed.data.userId}/bots`);
  revalidatePath('/admin/bots');
  revalidatePath('/admin/audit-log');
}

// ---- Bot system defaults: admin-owned WTC reference profiles ----

const FORBIDDEN_GLOBAL_BOT_CONFIG_KEYS = new Set([
  'apikey',
  'apisecret',
  'secret',
  'password',
  'passwordhash',
  'token',
  'authorization',
  'cookie',
  'sealed',
  'keyid',
  'wrappeddek',
  'vaultrecord',
  'credentials',
  'providerpubid',
  'provideraccountid',
  'pubid',
  'provideraccounts',
  'liveconfig',
  'rawjson',
  'activeslots',
  'activeordersummary',
  'legacydatabaseurl',
  'tortilajournalbaseurl',
  'tortilajournalurl',
  'headers',
  'applyconfig',
  'startbot',
  'stopbot',
  'start',
  'stop',
  'restart',
  'retest',
  'testexchange',
  'exchangeapply',
  'exchangeorder',
  'livecontrol',
]);

function normalizedConfigKey(key: string): string {
  return key.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

function assertNoForbiddenGlobalBotConfigKeys(value: unknown, path = 'config'): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenGlobalBotConfigKeys(item, `${path}[${index}]`));
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_GLOBAL_BOT_CONFIG_KEYS.has(normalizedConfigKey(key))) {
      throw new Error(`Forbidden global bot config field: ${path}.${key}`);
    }
    assertNoForbiddenGlobalBotConfigKeys(nested, `${path}.${key}`);
  }
}

function assertNoForbiddenGlobalBotConfigFormKeys(formData: FormData): void {
  for (const key of formData.keys()) {
    if (FORBIDDEN_GLOBAL_BOT_CONFIG_KEYS.has(normalizedConfigKey(key))) {
      throw new Error(`Forbidden global bot config form field: ${key}`);
    }
  }
}

export async function adminSaveBotGlobalConfigAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);
  assertNoForbiddenGlobalBotConfigFormKeys(formData);

  const parsed = saveBotGlobalConfigSchema.safeParse({
    productCode: formData.get('productCode'),
    profileCode: formData.get('profileCode'),
    label: formData.get('label'),
    status: formData.get('status'),
    appliesToNewUsers: formData.get('appliesToNewUsers'),
    allowUserOverride: formData.get('allowUserOverride'),
    expectedVersion: formData.get('expectedVersion'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
  }

  const productCode = parsed.data.productCode as BotProductCode;
  const issues = botConfigFormIssues(productCode, formData);
  if (issues.length > 0) {
    throw new Error(`Validation failed: ${issues.join(', ')}`);
  }
  const configParsed = botConfigSchemaFor(productCode).safeParse(botConfigFormInput(productCode, formData));
  if (!configParsed.success) {
    throw new Error(`Validation failed: ${configParsed.error.issues.map((i) => i.message).join(', ')}`);
  }
  const config = configParsed.data as unknown as Record<string, unknown>;
  assertNoForbiddenGlobalBotConfigKeys(config);

  const db = getServerDb();
  if (!db) throw new Error('Database is required for admin bot system defaults');

  const { saveBotGlobalConfig } = await import('@wtc/db');
  await saveBotGlobalConfig(db, {
    productCode,
    profileCode: parsed.data.profileCode,
    label: parsed.data.label,
    status: parsed.data.status,
    appliesToNewUsers: parsed.data.appliesToNewUsers,
    allowUserOverride: parsed.data.allowUserOverride,
    config,
    changedBy: actor.id,
    reason: parsed.data.reason,
    expectedVersion: parsed.data.expectedVersion,
  });

  revalidatePath('/admin/bots');
  revalidatePath('/admin/bots/config');
  revalidatePath('/admin/audit-log');
}
