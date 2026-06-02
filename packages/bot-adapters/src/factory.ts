import type { BotAdapter, BotProductCode } from './types.ts';
import { createMockTortilaAdapter } from './mock-tortila.ts';
import { createMockLegacyAdapter } from './mock-legacy.ts';
import { createHttpTortilaAdapter } from './http.ts';
import { createLegacyBlockedAdapter } from './legacy/legacy-blocked.ts';

/**
 * Single source of truth for adapter behaviour (see docs/ARCHITECTURE.md, CONTRACTS/*-adapter.md):
 *  - `mock`      (default): synthetic mock adapters, no network.
 *  - `read-only`: real HTTP GET-only adapters (data methods still throw until shapes are confirmed).
 *  - `audited`  : read-only PLUS the (future, separately-audited) control path. Control methods
 *                 nonetheless remain disabled in this codebase until that audited adapter ships.
 */
export type BotAdapterMode = 'mock' | 'read-only' | 'audited';

export interface AdapterOptions {
  /** governs which adapter is returned; defaults to mock at every call site */
  mode: BotAdapterMode;
  tortilaBaseUrl?: string;
  legacyBaseUrl?: string;
  /** JOURNAL_READ_TOKEN — bearer token for the Tortila journal. When absent in a real mode the
   *  adapter's getHealth() reports readState 'not_configured' (it never silently runs unauthenticated). */
  tortilaReadToken?: string;
}

/** Select the adapter for a bot. Real adapters require an explicit non-`mock` mode AND a base URL. */
export function getBotAdapter(productCode: BotProductCode, opts: AdapterOptions): BotAdapter {
  const useReal = opts.mode === 'read-only' || opts.mode === 'audited';
  if (productCode === 'tortila_bot') {
    return useReal && opts.tortilaBaseUrl ? createHttpTortilaAdapter(opts.tortilaBaseUrl, opts.tortilaReadToken) : createMockTortilaAdapter();
  }
  // Legacy bot HARD GATE (B3): the legacy /api_management/ API returns plaintext exchange keys, so the
  // real legacy HTTP adapter was deleted — there is NO live data path in any mode. In a non-mock mode we
  // return the explicit blocked adapter (data methods throw LegacyAdapterBlockedError; never a network
  // call). `legacyBaseUrl` is intentionally ignored — it cannot activate a real adapter. In mock mode the
  // synthetic demo adapter is returned (labelled mock). Un-blocking requires the upstream key fix + the 5
  // BOT_CONTROL_SAFETY_MODEL gates (see docs/PRODUCTION_BLOCKERS.md B3).
  return useReal ? createLegacyBlockedAdapter() : createMockLegacyAdapter();
}
