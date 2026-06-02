/**
 * LegacyBlockedAdapter — the ONLY non-mock legacy adapter reachable from the factory (PG3 / B3).
 *
 * The legacy `/api_management/` API exposes plaintext exchange keys in its responses
 * (docs/CONTRACTS/legacy-bot-adapter.md §"Known Security Issue", docs/PRODUCTION_BLOCKERS.md B3).
 * Until the upstream fix lands AND all 5 BOT_CONTROL_SAFETY_MODEL gates are cleared, WTC MUST NOT
 * issue any real HTTP request to the legacy bot. This adapter is the compile-time hard gate:
 *   - every DATA method throws LegacyAdapterBlockedError (machine-readable blockerRef='B3');
 *   - every CONTROL method throws BotControlDisabledError (live control is independently disabled);
 *   - getHealth() NEVER makes a network call — it returns a deterministic blocked state;
 *   - getWarnings() still surfaces LEGACY_WARNINGS (the plaintext-keys risk is never hidden).
 *
 * The real legacy HTTP adapter (which probed /api_management/) was DELETED in PG3 — there is no
 * code path, in any BOT_ADAPTER_MODE, that can reach the legacy bot's plaintext-key endpoint.
 * In mock mode the factory returns createMockLegacyAdapter (synthetic demo data, labelled mock);
 * in read-only/audited mode the factory returns THIS adapter (never a live HTTP adapter).
 */
import type { CanonicalMetrics, CanonicalPosition, CanonicalTrade, EquityPoint } from '@wtc/analytics';
import type { BotAdapter, BotConfigView, BotHealth, RiskWarning, ValidationResult } from '../types.ts';
import { assertBotControlAllowed } from '../control.ts';
import { LEGACY_WARNINGS } from '../warnings.ts';

/**
 * Thrown by every data/health-reading method of the blocked legacy adapter. The blocker reference is
 * always 'B3' (machine-readable) so a consumer / test can route to docs/PRODUCTION_BLOCKERS.md.
 */
export class LegacyAdapterBlockedError extends Error {
  /** Production blocker reference — do not change until B3 is cleared by the operator. */
  readonly blockerRef = 'B3';
  constructor(method: string) {
    super(
      `Legacy bot adapter method "${method}" is blocked. The legacy /api_management/ API exposes ` +
        `plaintext exchange keys (B3). WTC must not issue any real request until the upstream ` +
        `plaintext-key fix is confirmed and the 5 BOT_CONTROL_SAFETY_MODEL security gates are cleared. ` +
        `See docs/PRODUCTION_BLOCKERS.md (B3) and docs/BOT_CONTROL_SAFETY_MODEL.md.`,
    );
    this.name = 'LegacyAdapterBlockedError';
  }
}

/**
 * The blocked legacy adapter. `mode` is 'real' so callers can tell a non-mock adapter was selected,
 * but every data method throws — there is no live data path. No constructor argument exists (no URL,
 * no token) so it cannot be pointed at the legacy bot.
 */
export function createLegacyBlockedAdapter(): BotAdapter {
  return {
    productCode: 'legacy_bot',
    mode: 'real',
    async getWarnings(): Promise<RiskWarning[]> {
      // Surface the known issues even when blocked — the plaintext-keys risk must never disappear.
      return LEGACY_WARNINGS;
    },
    async getHealth(): Promise<BotHealth> {
      // Deterministic blocked state — NEVER issues a network request (no /api_management/ probe).
      // readState='not_configured' (the adapter is intentionally inactive); the detail says "blocked"
      // so it is distinguishable from a merely-unconfigured Tortila adapter.
      return {
        productCode: 'legacy_bot',
        processAlive: false,
        status: 'down',
        readState: 'not_configured',
        readStateDetail:
          'Live adapter blocked — pending upstream plaintext-key fix (B3). See docs/PRODUCTION_BLOCKERS.md.',
        lastSyncAt: null,
        staleDataSeconds: null,
        uptimeSeconds: null,
        warnings: await this.getWarnings(),
      };
    },
    async getConfig(_instanceId: string): Promise<BotConfigView> {
      throw new LegacyAdapterBlockedError('getConfig');
    },
    async getMetrics(_instanceId: string): Promise<CanonicalMetrics> {
      throw new LegacyAdapterBlockedError('getMetrics');
    },
    async getPositions(_instanceId: string): Promise<CanonicalPosition[]> {
      throw new LegacyAdapterBlockedError('getPositions');
    },
    async getTrades(_instanceId: string): Promise<CanonicalTrade[]> {
      throw new LegacyAdapterBlockedError('getTrades');
    },
    async getEquityCurve(_instanceId: string): Promise<EquityPoint[]> {
      throw new LegacyAdapterBlockedError('getEquityCurve');
    },
    async validateConfig(_input: unknown): Promise<ValidationResult> {
      throw new LegacyAdapterBlockedError('validateConfig');
    },
    async startBot(): Promise<never> {
      assertBotControlAllowed('startBot', false, false);
      throw new Error('unreachable');
    },
    async stopBot(): Promise<never> {
      assertBotControlAllowed('stopBot', false, false);
      throw new Error('unreachable');
    },
    async applyConfig(): Promise<never> {
      assertBotControlAllowed('applyConfig', false, false);
      throw new Error('unreachable');
    },
  };
}
