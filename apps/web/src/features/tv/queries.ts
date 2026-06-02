import 'server-only';
/**
 * TradingView access data layer (server-only). Uses getServerDb() + @wtc/db repos; maps rows to
 * UI-facing DTOs. Real Postgres when DATABASE_URL is set; honest labelled demo state otherwise
 * (null db -> empty lists, never fabricated data). No business logic in React pages.
 */
import { getServerDb } from '@/lib/backend';
import {
  listTvByUser,
  listAllTv,
  listTvGrantsForUser,
  listAllTvGrants,
  listTvAccessTasks,
  getTvProfile,
  listUsersWithEmailByIds,
  rowToTvDto,
  type TvRequestDTO,
  type TvProfileRow,
  type TvGrantRow,
  type TvAccessTaskRow,
} from '@wtc/db';

export type TvMode = 'postgres' | 'demo';

/** Storage mode for the TV surfaces. */
export function tvMode(): TvMode {
  return getServerDb() ? 'postgres' : 'demo';
}

// ---- User-facing view ----
export interface TvUserData {
  mode: TvMode;
  profile: TvProfileRow | null;
  requests: TvRequestDTO[];
  grants: TvGrantRow[];
}

export async function loadTvUserData(userId: string): Promise<TvUserData> {
  const db = getServerDb();
  if (!db) return { mode: 'demo', profile: null, requests: [], grants: [] };
  const [profile, requestRows, grants] = await Promise.all([
    getTvProfile(db, userId),
    listTvByUser(db, userId),
    listTvGrantsForUser(db, userId),
  ]);
  const requests = requestRows.map(rowToTvDto);
  return { mode: 'postgres', profile, requests, grants };
}

// ---- Admin-facing view ----
export interface TvAdminRow extends TvRequestDTO {
  userEmail: string;
}

export interface TvStatusCounts {
  pending: number;
  active: number; // granted + expiring_soon
  revoked: number;
  expired: number;
}

export interface TvAdminData {
  mode: TvMode;
  rows: TvAdminRow[];
  counts: TvStatusCounts;
  grants: TvGrantRow[];
  tasks: TvAdminTaskRow[];
}

export interface TvAdminTaskRow extends TvAccessTaskRow {
  userEmail: string;
  tradingViewUsername: string;
  requestStatus: string;
}

export async function loadTvAdminData(): Promise<TvAdminData> {
  const db = getServerDb();
  if (!db) {
    return {
      mode: 'demo',
      rows: [],
      counts: { pending: 0, active: 0, revoked: 0, expired: 0 },
      grants: [],
      tasks: [],
    };
  }

  const [requestRows, grants, taskRows] = await Promise.all([
    listAllTv(db),
    listAllTvGrants(db),
    listTvAccessTasks(db, { includeDone: true, limit: 100 }),
  ]);

  // Batched id→email lookup (one `WHERE id IN (...)` query) replaces a per-row getUserById N+1.
  const emailById = await listUsersWithEmailByIds(db, requestRows.map((r) => r.userId));
  const rows: TvAdminRow[] = requestRows.map((r) => {
    const dto = rowToTvDto(r);
    return { ...dto, userEmail: emailById.get(r.userId) ?? r.userId };
  });

  const counts: TvStatusCounts = {
    pending: rows.filter((r) => r.status === 'pending').length,
    active: rows.filter((r) => r.status === 'granted' || r.status === 'expiring_soon').length,
    revoked: rows.filter((r) => r.status === 'revoked').length,
    expired: rows.filter((r) => r.status === 'expired').length,
  };

  const requestById = new Map(requestRows.map((r) => [r.id, r]));
  const tasks: TvAdminTaskRow[] = taskRows.map((task) => {
    const request = requestById.get(task.requestId);
    return {
      ...task,
      userEmail: request ? emailById.get(request.userId) ?? request.userId : 'unknown',
      tradingViewUsername: request?.tradingViewUsername ?? 'unknown',
      requestStatus: request?.status ?? 'unknown',
    };
  });

  return { mode: 'postgres', rows, counts, grants, tasks };
}
