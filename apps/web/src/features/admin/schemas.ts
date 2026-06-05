/**
 * Zod schemas for admin server actions. All mutations validate input through
 * these schemas before touching the database.
 */
import { z } from 'zod';

const boundedCleanupCount = z.preprocess((value) => Number(value), z.number().int().min(0).max(100));
const nullableEpochMs = z.preprocess((value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return Number(value);
}, z.number().int().min(0).nullable());
const booleanLike = z.preprocess((value) => {
  if (value === true || value === 'true' || value === 'on' || value === '1') return true;
  if (value === false || value === 'false' || value === 'off' || value === '0' || value === null || value === undefined || value === '') return false;
  return value;
}, z.boolean());
const optionalVersion = z.preprocess((value) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return Number(value);
}, z.number().int().min(0).optional());
const optionalUuid = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}, z.string().uuid('Invalid ID').optional());

const providerAccountId = z
  .string()
  .trim()
  .min(3, 'Provider account ID must be at least 3 characters')
  .max(160, 'Provider account ID is too long')
  .regex(/^[A-Za-z0-9_.:@-]+$/, 'Provider account ID contains unsupported characters');

const adminMutationReason = z.string().trim().min(10, 'Reason must be at least 10 characters').max(500);

/** Schema for the support ticket status-update action. */
export const ticketUpdateSchema = z.object({
  ticketId: z.string().uuid('Invalid ticket ID'),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed'], {
    errorMap: () => ({ message: 'Invalid status value' }),
  }),
});

/** Schema for the product grant action (now includes reason + validUntil). */
export const grantProductSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  product: z.string().min(1, 'Product code is required'),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500),
  validUntil: z
    .string()
    .optional()
    .transform((v) => {
      if (!v || v.trim() === '') return undefined;
      const ms = new Date(v).getTime();
      return Number.isFinite(ms) && ms > Date.now() ? ms : undefined;
    }),
});

/** Schema for the product revoke action (now includes reason). */
export const revokeProductSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  product: z.string().min(1, 'Product code is required'),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500),
});

/** Schema for resolving a billing_manual_review_items entry (approve / reject / dismiss). */
export const resolveReviewSchema = z.object({
  itemId: z.string().uuid('Invalid review item ID'),
  resolution: z.enum(['approved', 'rejected', 'dismissed']),
  resolutionNote: z
    .string()
    .trim()
    .min(3, 'Resolution note must be at least 3 characters')
    .max(1000),
  /** For approved: the userId to grant to (from the item.userId or entered manually). */
  approvalUserId: z.string().uuid().optional(),
  /** For approved: comma-separated ProductCode values. */
  approvalProductCodes: z.string().optional(),
});

/** Schema for flagging an existing entitlement for manual review. */
export const flagReviewSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  product: z.string().min(1, 'Product code is required'),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500),
});

export const unlockAccountSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  reason: z.string().trim().min(10, 'Reason must be at least 10 characters').max(500),
});

export const acknowledgeLmsCleanupSchema = z.object({
  operation: z.literal('acknowledge_dead_letters'),
  expectedCount: boundedCleanupCount,
  expectedLatestDeadLetteredAt: nullableEpochMs,
});

export const retryLmsCleanupSchema = z.object({
  operation: z.literal('retry_acknowledged_dead_letters'),
  expectedCount: boundedCleanupCount,
  expectedLatestAcknowledgedAt: nullableEpochMs,
});

export const mapLegacyProviderAccountSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  botInstanceId: optionalUuid,
  providerAccountId,
  label: z.preprocess((value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, z.string().max(80).nullable()),
  reason: adminMutationReason,
});

export const disableLegacyProviderAccountSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  mappingId: z.string().uuid('Invalid mapping ID'),
  reason: adminMutationReason,
});

export const saveBotGlobalConfigSchema = z.object({
  productCode: z.enum(['tortila_bot', 'legacy_bot']),
  profileCode: z
    .string()
    .trim()
    .min(1, 'Profile code is required')
    .max(80, 'Profile code is too long')
    .regex(/^[a-z0-9_-]+$/, 'Profile code may contain lowercase letters, numbers, underscores, and dashes only'),
  label: z.string().trim().min(3, 'Profile name must be at least 3 characters').max(80, 'Profile name is too long'),
  status: z.enum(['draft', 'published', 'archived']),
  appliesToNewUsers: booleanLike,
  allowUserOverride: booleanLike,
  expectedVersion: optionalVersion,
  reason: adminMutationReason,
}).strict();
