/**
 * Async TradingView access service — the app-layer interface the indicators/admin pages call.
 * Both the DB-backed adapter (lib/db-store.ts) and the in-memory dev adapter (lib/demo.ts) implement
 * it, and lib/backend.ts selects between them (fail-closed in production without DATABASE_URL).
 * The async shape means a missing `await` at a call site is a typecheck error, not silent data loss.
 */
import type { TvRequestDTO } from '@wtc/db';

/** UI-facing TradingView request: epoch-ms timestamps (no raw Date leaks to the client). */
export type TvRequestView = TvRequestDTO;

export interface TvService {
  /** Fail-closed: throws if the user lacks an active tradingview_indicators entitlement. */
  submitRequest(userId: string, username: string, hasEntitlement: boolean, now: number): Promise<TvRequestView>;
  listByUser(userId: string): Promise<TvRequestView[]>;
  listAll(): Promise<TvRequestView[]>;
  grant(requestId: string, adminId: string, now: number, durationMs: number): Promise<void>;
  revoke(requestId: string, adminId: string, now: number): Promise<void>;
}
