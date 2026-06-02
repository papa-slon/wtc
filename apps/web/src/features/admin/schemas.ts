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
