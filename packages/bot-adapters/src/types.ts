/**
 * @wtc/bot-adapters — adapter interface over existing bots. See docs/BOT_INTEGRATION_PLAN.md
 * and docs/CONTRACTS/{tortila,legacy-bot}-adapter.md. Read-only/mock by default; control disabled.
 */
import type { CanonicalMetrics, CanonicalPosition, CanonicalTrade, EquityPoint } from '@wtc/analytics';

export type BotProductCode = 'tortila_bot' | 'legacy_bot';
export type AdapterMode = 'mock' | 'real';

export type WarningSeverity = 'info' | 'warning' | 'error';

export interface RiskWarning {
  code: string;
  severity: WarningSeverity;
  title: string;
  detail: string;
  since?: number;
}

export type HealthStatus = 'healthy' | 'degraded' | 'stale' | 'down';

/**
 * Read-only integration state for a REAL adapter, surfaced end-to-end (adapter → worker → dashboards).
 * Distinct from HealthStatus (which describes the bot itself): this describes WTC's ability to read the
 * journal honestly. Mock adapters are always 'ok' (synthetic data is always available).
 *  - not_configured: required URL/token absent in a real mode — setup needed, NOT an error.
 *  - unreachable:    network error / timeout / non-2xx from the journal.
 *  - malformed:      a 2xx body that fails schema validation (shape drift).
 *  - stale:          a valid body whose timestamp is older than ADAPTER_STALE_THRESHOLD_MS.
 *  - ok:             reachable, well-formed, and fresh.
 * It is always a RETURNED value — getHealth() never throws.
 */
export type ReadState = 'ok' | 'not_configured' | 'unreachable' | 'malformed' | 'stale';

/** Adapter-level staleness threshold (5 min): a journal /api/health `ts` older than this ⇒ 'stale'.
 *  Independent of the coarser UI-level staleness derived from integration_health_checks.checked_at. */
export const ADAPTER_STALE_THRESHOLD_MS = 5 * 60 * 1000;

export interface BotHealth {
  productCode: BotProductCode;
  /** the process/service is up (e.g. systemd active) */
  processAlive: boolean;
  /** distinct from processAlive: data may be stale even when the process is up */
  status: HealthStatus;
  /** Read-only integration state. Optional for backward-compat; mock adapters report 'ok'. */
  readState?: ReadState;
  /** Human-readable detail for a non-ok readState (never contains secrets). */
  readStateDetail?: string;
  lastSyncAt: number | null;
  staleDataSeconds: number | null;
  uptimeSeconds: number | null;
  warnings: RiskWarning[];
}

export interface BotConfigView {
  productCode: BotProductCode;
  instanceId: string;
  symbols: string[];
  riskPercent?: number;
  leverage?: number;
  maxUnits?: number;
  takeProfitPercent?: number;
  mode: 'demo' | 'live' | 'unknown';
  /** bot-specific raw fields, already redacted of any secrets */
  raw: Record<string, unknown>;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface BotAdapter {
  productCode: BotProductCode;
  mode: AdapterMode;
  getHealth(): Promise<BotHealth>;
  /** Known risk warnings (persistent P0/P1 + observed signals). First-class on the dashboards;
   *  getHealth().warnings delegates to this so the health card and the safety surface never drift. */
  getWarnings(): Promise<RiskWarning[]>;
  getConfig(instanceId: string): Promise<BotConfigView>;
  getMetrics(instanceId: string): Promise<CanonicalMetrics>;
  getPositions(instanceId: string): Promise<CanonicalPosition[]>;
  getTrades(instanceId: string): Promise<CanonicalTrade[]>;
  /** Optional: equity time-series for the equity sub-page. Adapters without a curve omit it
   *  (the real HTTP adapter does until the endpoint is confirmed). Always render via
   *  `filterZeroEquity` so artifact 0-rows never fabricate a drawdown. */
  getEquityCurve?(instanceId: string): Promise<EquityPoint[]>;
  validateConfig(input: unknown): Promise<ValidationResult>;
  // --- Control methods: DISABLED until a separate audited adapter is approved. ---
  startBot(instanceId: string): Promise<never>;
  stopBot(instanceId: string): Promise<never>;
  applyConfig(instanceId: string, input: unknown): Promise<never>;
}
