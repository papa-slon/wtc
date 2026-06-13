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
  /** Old BLOCKED legacy control endpoint base (NOT used to activate a real adapter — see getBotAdapter). */
  legacyBaseUrl?: string;
  /** JOURNAL_READ_TOKEN — bearer token for the Tortila journal. When absent in a real mode the
   *  adapter's getHealth() reports readState 'not_configured' (it never silently runs unauthenticated). */
  tortilaReadToken?: string;
  /** LEGACY_JOURNAL_URL — base URL of the SAFE read-only legacy journal shim (bot/journal_shim/).
   *  This is the read-only stats path consumed ONLY by the premium dashboard via
   *  createLegacyJournalReader; it is NOT the blocked /api_management control path and never
   *  activates a real control adapter in getBotAdapter. */
  legacyJournalUrl?: string;
  /** LEGACY_JOURNAL_TOKEN — bearer token for the legacy journal shim. Distinct from JOURNAL_READ_TOKEN. */
  legacyReadToken?: string;
}

/** Select the adapter for a bot. Real adapters require an explicit non-`mock` mode AND a base URL. */
export function getBotAdapter(productCode: BotProductCode, opts: AdapterOptions): BotAdapter {
  const useReal = opts.mode === 'read-only' || opts.mode === 'audited';
  if (productCode === 'tortila_bot') {
    return useReal && opts.tortilaBaseUrl ? createHttpTortilaAdapter(opts.tortilaBaseUrl, opts.tortilaReadToken) : createMockTortilaAdapter();
  }
  // Legacy bot HTTP HARD GATE (B3): the direct legacy /api_management/ control path is not exposed
  // through WTC. Production live-read is handled separately by worker DB snapshots keyed by provider
  // pub_id. The real legacy HTTP adapter was deleted. In a non-mock mode we
  // return the explicit blocked adapter (data methods throw LegacyAdapterBlockedError; never a network
  // call). `legacyBaseUrl` is intentionally ignored — it cannot activate a real adapter. In mock mode the
  // synthetic demo adapter is returned (labelled mock). Un-blocking live control requires a separate
  // audited control adapter and BOT_CONTROL_SAFETY_MODEL gates.
  return useReal ? createLegacyBlockedAdapter() : createMockLegacyAdapter();
}
