/**
 * @wtc/tradingview-access — manual-first access workflow. See docs/TRADINGVIEW_ACCESS_PLAN.md and
 * docs/CONTRACTS/tradingview-access.md. Default is an admin grant/revoke queue; any automation is
 * ToS-compliant only and behind a feature flag (never credential-stuffing / brittle browser bots).
 */
export type TvAccessStatus = 'pending' | 'granted' | 'expiring_soon' | 'expired' | 'revoked';

export interface TvAccessRequest {
  id: string;
  userId: string;
  tradingViewUsername: string;
  status: TvAccessStatus;
  requestedAt: number;
  grantedAt?: number;
  grantedBy?: string;
  expiresAt?: number;
  revokedAt?: number;
  revokedBy?: string;
}

/** Revoke task queued for the worker/admin to action against TradingView (manual or flagged-automation). */
export interface TvAccessTask {
  id: string;
  requestId: string;
  kind: 'revoke';
  createdAt: number;
  done: boolean;
}

export interface TvAccessStore {
  create(req: TvAccessRequest): void;
  get(id: string): TvAccessRequest | undefined;
  update(req: TvAccessRequest): void;
  list(filter?: { status?: TvAccessStatus }): TvAccessRequest[];
  addTask(task: TvAccessTask): void;
  listTasks(filter?: { done?: boolean }): TvAccessTask[];
}

export function createMemoryTvStore(): TvAccessStore {
  const reqs = new Map<string, TvAccessRequest>();
  const tasks = new Map<string, TvAccessTask>();
  return {
    create: (r) => void reqs.set(r.id, r),
    get: (id) => reqs.get(id),
    update: (r) => void reqs.set(r.id, r),
    list: (f) => [...reqs.values()].filter((r) => (f?.status ? r.status === f.status : true)),
    addTask: (t) => void tasks.set(t.id, t),
    listTasks: (f) => [...tasks.values()].filter((t) => (f?.done === undefined ? true : t.done === f.done)),
  };
}

const EXPIRING_WINDOW_MS = 7 * 86_400_000;

export class TvAccessService {
  private store: TvAccessStore;

  constructor(store: TvAccessStore) {
    this.store = store;
  }

  /** Fail-closed: a request can only be created if the user has an active indicators entitlement. */
  submitRequest(userId: string, username: string, hasIndicatorEntitlement: boolean, now: number): TvAccessRequest {
    if (!hasIndicatorEntitlement) throw new Error('No active tradingview_indicators entitlement');
    const req: TvAccessRequest = {
      id: globalThis.crypto.randomUUID(),
      userId,
      tradingViewUsername: username,
      status: 'pending',
      requestedAt: now,
    };
    this.store.create(req);
    return req;
  }

  grant(requestId: string, adminId: string, now: number, durationMs: number): TvAccessRequest {
    const req = this.store.get(requestId);
    if (!req) throw new Error('request not found');
    const updated: TvAccessRequest = { ...req, status: 'granted', grantedAt: now, grantedBy: adminId, expiresAt: now + durationMs };
    this.store.update(updated);
    return updated;
  }

  revoke(requestId: string, adminId: string, now: number): TvAccessRequest {
    const req = this.store.get(requestId);
    if (!req) throw new Error('request not found');
    const updated: TvAccessRequest = { ...req, status: 'revoked', revokedAt: now, revokedBy: adminId };
    this.store.update(updated);
    return updated;
  }

  /** Worker sweep: mark expiring/expired and queue revoke tasks. */
  sweep(now: number): { expiringSoon: number; expired: number; tasksQueued: number } {
    let expiringSoon = 0;
    let expired = 0;
    let tasksQueued = 0;
    for (const req of this.store.list({ status: 'granted' })) {
      if (req.expiresAt === undefined) continue;
      if (now >= req.expiresAt) {
        this.store.update({ ...req, status: 'expired' });
        this.store.addTask({ id: globalThis.crypto.randomUUID(), requestId: req.id, kind: 'revoke', createdAt: now, done: false });
        expired += 1;
        tasksQueued += 1;
      } else if (req.expiresAt - now <= EXPIRING_WINDOW_MS) {
        this.store.update({ ...req, status: 'expiring_soon' });
        expiringSoon += 1;
      }
    }
    return { expiringSoon, expired, tasksQueued };
  }
}
