import 'server-only';
/**
 * TradingView access server actions (admin grant/revoke). Uses getServerDb() + @wtc/db repos
 * directly. Every mutation: assertCsrf + assertAdmin + Zod + entitlement re-check (fail-closed) +
 * state guard + repo (in-txn audit) + revalidatePath. Manual-first by default; no automation.
 *
 * Grant path: atomicGrantTv — ONE transaction: request status update + grant row insert +
 * profile pointer upsert + audit row. Replaces the former two-transaction grantTv + createTvGrant
 * pattern (auditor finding F-02: diverged state eliminated).
 *
 * Revoke path: atomicRevokeTv — ONE transaction: request status stamp + active grant lookup +
 * grant revokedAt/revokedBy/revokeReason stamp + profile pointer null + audit row. Replaces
 * the former revokeTv-only call which discarded the validated reason (auditor finding F-03).
 */
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { assertAdmin } from '@wtc/auth';
import { getServerDb } from '@/lib/backend';
import { requireUser } from '@/lib/session';
import { assertCsrf } from '@/lib/csrf';
import { accessFor } from '@/lib/access';
import {
  atomicGrantTv,
  atomicRevokeTv,
  listAllTv,
  markTvAccessTaskDone,
  rowToTvDto,
} from '@wtc/db';

const DAY = 86_400_000;

const DURATION_OPTIONS: Record<string, number> = {
  '30': 30 * DAY,
  '90': 90 * DAY,
  '180': 180 * DAY,
  '365': 365 * DAY,
};

const grantSchema = z.object({
  requestId: z.string().uuid(),
  reason: z.string().min(3).max(200),
  durationDays: z.enum(['30', '90', '180', '365']),
});

const revokeSchema = z.object({
  requestId: z.string().uuid(),
  reason: z.string().min(3).max(200),
});

const taskDoneSchema = z.object({
  taskId: z.string().uuid(),
});

/** ALLOWED states for a grant action. Only pending or expiring_soon may be granted. */
const GRANTABLE_STATES = new Set(['pending', 'expiring_soon']);

/**
 * Enhanced admin grant: validates reason + duration, re-checks user entitlement (fail-closed),
 * enforces state guard (only pending/expiring_soon), then calls atomicGrantTv — a single
 * transaction that updates the request status, inserts the grant row, upserts the profile
 * pointer, and writes one audit row. If DATABASE_URL is not set, throws fail-closed.
 */
export async function enhancedGrantAction(formData: FormData): Promise<void> {
  'use server';
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);

  const parsed = grantSchema.safeParse({
    requestId: formData.get('requestId'),
    reason: formData.get('reason'),
    durationDays: formData.get('durationDays'),
  });
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
  }

  const { requestId, reason, durationDays } = parsed.data;
  const durationMs = DURATION_OPTIONS[durationDays]!;
  const now = Date.now();

  const db = getServerDb();
  if (!db) throw new Error('[tv/actions] DATABASE_URL required to grant TV access');

  // Derive user + TradingView username from the request row. Hidden form values are not trusted.
  const req = (await listAllTv(db)).map(rowToTvDto).find((r) => r.id === requestId);
  if (!req) throw new Error(`Request ${requestId} not found`);

  // Fail-closed entitlement re-check at grant time. Entitlements are the only access source.
  const access = await accessFor(req.userId, 'tradingview_indicators');
  if (!access.allowed) {
    throw new Error(
      `Cannot grant: user lacks an active tradingview_indicators entitlement (${access.reason}). Entitlements are the only access source.`,
    );
  }

  // Application-level state guard (early-return UX guard before hitting the DB).
  // The authoritative guard is inside atomicGrantTv at the DB level (WHERE status IN (...)).
  if (!GRANTABLE_STATES.has(req.status)) {
    throw new Error(
      `Cannot grant request in state '${req.status}'. Only pending or expiring_soon requests may be granted.`,
    );
  }

  // Single atomic call: request status update + grant row insert + profile pointer upsert +
  // audit row — all in ONE transaction (replaces former sequential grantTv + createTvGrant).
  await atomicGrantTv(
    db,
    {
      requestId,
      adminId: actor.id,
      durationMs,
      reason,
    },
    now,
  );

  revalidatePath('/admin/tradingview-access');
}

/**
 * Enhanced admin revoke: validates reason, then calls atomicRevokeTv — a single transaction
 * that stamps the request row, resolves the active grant by requestId, stamps the grant row
 * (revokedAt/revokedBy/revokeReason), nulls the profile pointer, and writes one audit row.
 * The reason is persisted end-to-end (request row + grant row + audit payload).
 * If DATABASE_URL is not set, throws fail-closed.
 */
export async function enhancedRevokeAction(formData: FormData): Promise<void> {
  'use server';
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);

  const parsed = revokeSchema.safeParse({
    requestId: formData.get('requestId'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
  }

  const { requestId, reason } = parsed.data;
  const db = getServerDb();
  if (!db) throw new Error('[tv/actions] DATABASE_URL required to revoke TV access');

  // Single atomic call: request status stamp + active grant lookup + grant revokedAt/revokedBy/
  // revokeReason + profile pointer null + audit row — all in ONE transaction (replaces former
  // revokeTv-only call which discarded the validated reason; auditor finding F-03 resolved).
  // Admin actor descriptor; the worker sweep uses { id: null, role: 'system' } (see sweepTvExpiry).
  await atomicRevokeTv(db, requestId, { id: actor.id, role: 'admin' }, reason, Date.now());

  revalidatePath('/admin/tradingview-access');
}

/** Mark the external TradingView-side task as completed by the admin. This does not call TradingView;
 * it records that the human/operator finished the manual invite/revoke work outside WTC. */
export async function markTvTaskDoneAction(formData: FormData): Promise<void> {
  'use server';
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);
  const parsed = taskDoneSchema.safeParse({ taskId: formData.get('taskId') });
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
  }
  const db = getServerDb();
  if (!db) throw new Error('[tv/actions] DATABASE_URL required to mark TV tasks');
  await markTvAccessTaskDone(db, parsed.data.taskId, actor.id, Date.now());
  revalidatePath('/admin/tradingview-access');
}
