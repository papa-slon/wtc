import 'server-only';
/**
 * Billing timeline loader (server-only).
 *
 * Reads product_access_events for a user and returns two view types:
 *   - UserTimelineEntry  — safe for display to the account holder (actor info OMITTED)
 *   - AdminTimelineEntry — includes actor id + type for the /admin/entitlements surface
 *
 * Uses getServerDb() + listProductAccessEvents from @wtc/db, following the established
 * features/* pattern (no business logic in React pages). Returns [] honestly when the DB is
 * not available (demo / DATABASE_URL unset). In production, getServerDb() throws fail-closed
 * before reaching the null branch here.
 */

import { getServerDb } from '@/lib/backend';
import { listProductAccessEvents, type ProductAccessEventRow } from '@wtc/db';

// ---- View types ----

/** Safe for account-holder (/app/billing). Actor fields are intentionally omitted. */
export interface UserTimelineEntry {
  id: string;
  /** epoch-ms */
  createdAt: number;
  productCode: string;
  fromState: string;
  toState: string;
  reason: string | null;
}

/** For /admin/entitlements. Includes actor identity for audit traceability. */
export interface AdminTimelineEntry extends UserTimelineEntry {
  actorId: string | null;
  actorType: string;
}

export interface TimelineResult<T> {
  /** 'postgres' when backed by a real DB; 'demo' when DATABASE_URL is unset. */
  mode: 'postgres' | 'demo';
  entries: T[];
}

// ---- Mappers ----

function toUserEntry(row: ProductAccessEventRow): UserTimelineEntry {
  return {
    id: row.id,
    createdAt: row.createdAt.getTime(),
    productCode: row.productCode,
    fromState: row.fromState,
    toState: row.toState,
    reason: row.reason ?? null,
  };
}

function toAdminEntry(row: ProductAccessEventRow): AdminTimelineEntry {
  return {
    ...toUserEntry(row),
    actorId: row.actorId ?? null,
    actorType: row.actorType,
  };
}

// ---- Loaders ----

/**
 * Load the billing timeline for an account holder's own view.
 * Actor information is stripped — callers must ensure userId is the authenticated user's id.
 */
export async function loadUserTimeline(
  userId: string,
  opts?: { productCode?: string; limit?: number },
): Promise<TimelineResult<UserTimelineEntry>> {
  const db = getServerDb();
  if (!db) {
    // Demo / no DATABASE_URL — return empty list honestly.
    // In production getServerDb() throws fail-closed; this branch is unreachable there.
    return { mode: 'demo', entries: [] };
  }
  const rows = await listProductAccessEvents(db, userId, {
    productCode: opts?.productCode,
    limit: opts?.limit ?? 50,
  });
  return { mode: 'postgres', entries: rows.map(toUserEntry) };
}

/**
 * Load the billing timeline for an admin view.
 * Includes actorId + actorType. Callers must verify the caller has admin/support role before
 * invoking this function (RBAC is enforced at the route/action layer, not here).
 */
export async function loadAdminTimeline(
  userId: string,
  opts?: { productCode?: string; limit?: number },
): Promise<TimelineResult<AdminTimelineEntry>> {
  const db = getServerDb();
  if (!db) {
    // Demo / no DATABASE_URL — return empty list honestly.
    return { mode: 'demo', entries: [] };
  }
  const rows = await listProductAccessEvents(db, userId, {
    productCode: opts?.productCode,
    limit: opts?.limit ?? 100,
  });
  return { mode: 'postgres', entries: rows.map(toAdminEntry) };
}
