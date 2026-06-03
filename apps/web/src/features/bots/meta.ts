/**
 * Bot metadata + capability matrix (pure data; type-only imports, safe anywhere).
 * Source: docs/handoffs/20260530-0126-ecosystem-bot-integration-auditor.md (Tortila vs Legacy
 * capability matrix). Capabilities drive honest "supported / not available" UI — never a fake panel.
 */
import type { BotHealth } from '@wtc/bot-adapters';
import type { Tone } from '@wtc/ui';

export type BotSlug = 'tortila' | 'legacy';
export type BotProductCode = 'tortila_bot' | 'legacy_bot';
export type CapabilityState = 'supported' | 'not_supported' | 'future';

export interface BotMeta {
  slug: BotSlug;
  code: BotProductCode;
  name: string;
  tagline: string;
}

export const BOT_LIST: readonly BotMeta[] = [
  { slug: 'tortila', code: 'tortila_bot', name: 'Tortila Bot', tagline: 'Turtle-system trend engine on BingX perps' },
  { slug: 'legacy', code: 'legacy_bot', name: 'Legacy Bot', tagline: 'RSI/CCI averaging bot (original engine)' },
];

export function botMeta(slug: string): BotMeta | undefined {
  return BOT_LIST.find((b) => b.slug === slug);
}

export interface BotCapabilities {
  /** local backtester runner exists (Tortila only) */
  hasBacktester: boolean;
  /** closed-trade history endpoint available */
  hasTradeHistory: boolean;
  /** equity time-series available */
  hasEquityCurve: boolean;
  takeProfit: CapabilityState;
  stopLoss: CapabilityState;
  trailingStop: CapabilityState;
  /** persistent product-level caveats surfaced on the dashboard */
  notes: string[];
  /**
   * When true, the live read-only adapter is BLOCKED by an upstream dependency — not merely
   * unconfigured. The dashboard shows a distinct "live adapter unavailable" banner explaining the
   * blocker (rather than the generic "configure the adapter" message). This is a STATIC product fact,
   * independent of BOT_ADAPTER_MODE: even in mock mode the banner is shown so the honest message is
   * "you are seeing simulated data; the real adapter is permanently blocked until the blocker clears".
   *   legacy_bot: false - live-read uses WTC worker DB snapshots from provider pub_id / safe columns.
   *   tortila_bot: false - the live adapter becomes available once JOURNAL_READ_TOKEN is configured.
   */
  liveAdapterBlocked: boolean;
  /** Human-readable explanation shown only when liveAdapterBlocked is true. */
  liveAdapterBlockedReason?: string;
}

export const BOT_CAPS: Record<BotProductCode, BotCapabilities> = {
  tortila_bot: {
    hasBacktester: true,
    hasTradeHistory: true,
    hasEquityCurve: true,
    takeProfit: 'supported',
    stopLoss: 'supported',
    trailingStop: 'supported',
    liveAdapterBlocked: false,
    notes: [
      'TP reconciliation after a restart is a known P0 gap — dashboards show a persistent warning until resolved.',
      'Margin pre-flight before entry is a known P1 gap.',
    ],
  },
  legacy_bot: {
    hasBacktester: false,
    hasTradeHistory: false,
    hasEquityCurve: false,
    takeProfit: 'supported',
    stopLoss: 'supported',
    trailingStop: 'supported',
    liveAdapterBlocked: false,
    notes: [
      'Live-read uses the existing legacy runtime by pub_id and WTC worker snapshots; WTC does not collect or store exchange keys for this bot.',
      'Closed-trade analytics are not connected yet, so win rate and profit factor stay unavailable instead of being fabricated.',
      'No exchange equity-curve endpoint — WTC shows wallet balance snapshots only.',
      'No backtester for this bot.',
    ],
  },
};

export function capLabel(state: CapabilityState): string {
  return state === 'supported' ? 'Supported' : state === 'future' ? 'Planned' : 'Not supported';
}

/**
 * Map a BotHealth to a status pill (tone + label) that surfaces the read state HONESTLY end-to-end.
 * not_configured is "Setup needed" (neutral) — never a warn/bad alarm. Prefers the precise readState;
 * falls back to the coarse HealthStatus for adapters that don't report one (back-compat).
 */
export function botHealthPill(health: BotHealth): { tone: Tone; label: string } {
  switch (health.readState) {
    case 'not_configured':
      return { tone: 'neutral', label: 'Setup needed' };
    case 'unreachable':
      return { tone: 'bad', label: 'Journal unreachable' };
    case 'malformed':
      return { tone: 'bad', label: 'Response malformed' };
    case 'stale':
      return { tone: 'warn', label: 'Data stale' };
    case 'ok':
      return health.status === 'healthy'
        ? { tone: 'ok', label: 'Healthy' }
        : { tone: 'warn', label: 'Running (warnings)' };
    default:
      // No readState (e.g. older adapter): derive from the coarse status.
      if (health.status === 'healthy') return { tone: 'ok', label: 'Healthy' };
      if (health.status === 'down') return { tone: 'bad', label: 'Down' };
      if (health.status === 'stale') return { tone: 'warn', label: 'Data stale' };
      return { tone: 'warn', label: 'Running (warnings)' };
  }
}
