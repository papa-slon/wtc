/**
 * Canonical bot risk-warning registry. The codes here MUST match docs/CANONICAL_ANALYTICS_MODEL.md
 * and docs/BOT_CONTROL_SAFETY_MODEL.md (single source of truth in code; a test asserts no mock/http
 * adapter emits an undocumented code).
 *
 * The Tortila P0/P1 warnings are UNRESOLVED issues that persist regardless of adapter mode
 * (mock | read-only | audited) until the journal reports resolution — they must never disappear
 * just because the adapter switched to real data.
 */
import type { RiskWarning } from './types.ts';

export const CANONICAL_WARNING_CODES = [
  // Tortila
  'tp_reconcile_p0',
  'margin_preflight_p1',
  'tp_rejection_101211',
  'rate_limit_100410',
  'exchange_flat_mismatch',
  'fill_lookup_109421',
  // Legacy
  'ws_fallback',
  'legacy_plaintext_keys',
  'no_trade_history',
  'legacy_quarantined',
] as const;

export type WarningCode = (typeof CANONICAL_WARNING_CODES)[number];

export function isCanonicalWarningCode(code: string): code is WarningCode {
  return (CANONICAL_WARNING_CODES as readonly string[]).includes(code);
}

/** Unresolved Tortila P0/P1 — surfaced by EVERY Tortila adapter (mock and real) until resolved. */
export const TORTILA_PERSISTENT_WARNINGS: RiskWarning[] = [
  {
    code: 'tp_reconcile_p0',
    severity: 'error',
    title: 'TP reconciliation / restore not implemented',
    detail: 'Known P0: take-profit orders can go missing and are re-placed reactively. Do not rely on TP protection until reconciliation/restore is shipped. Cleared only when the journal reports tp_reconcile_ok.',
  },
  {
    code: 'margin_preflight_p1',
    severity: 'warning',
    title: 'Margin pre-flight not implemented',
    detail: 'Known P1: position adds are not gated by a margin pre-flight (at least one LINK add was blocked downstream). Do not increase size / go live until pre-flight ships.',
  },
];

/** Live signal warnings observed in Tortila logs (mock surfaces these; real adapter derives from logs). */
export const TORTILA_SIGNAL_WARNINGS: RiskWarning[] = [
  { code: 'tp_rejection_101211', severity: 'warning', title: 'NEAR TP placement rejected', detail: 'Order price should be higher than mark — TP re-placement events observed (BingX 101211).' },
  { code: 'rate_limit_100410', severity: 'warning', title: 'Rate-limit / funding warnings', detail: 'Periodic BingX rate-limit and funding warnings (100410).' },
  { code: 'exchange_flat_mismatch', severity: 'warning', title: 'Exchange-flat mismatch reconciliations', detail: 'Local state vs exchange flat mismatches triggered reconciliation events.' },
  { code: 'fill_lookup_109421', severity: 'info', title: 'Fill-detail lookup misses', detail: 'Occasional "order not exist" on fill-detail lookup (BingX 109421).' },
];

export const TORTILA_WARNINGS: RiskWarning[] = [...TORTILA_PERSISTENT_WARNINGS, ...TORTILA_SIGNAL_WARNINGS];

export const LEGACY_WARNINGS: RiskWarning[] = [
  { code: 'ws_fallback', severity: 'warning', title: 'WebSocket reconnect / fallback', detail: 'Market data stream reconnects frequently; data may be stale even while the process is alive.' },
  {
    code: 'legacy_plaintext_keys',
    severity: 'warning',
    title: 'Provider credentials stay outside WTC',
    detail: 'Legacy stores exchange credential columns provider-side. WTC live-read uses pub_id and whitelisted non-secret DB columns only; no exchange keys are selected, logged, stored, or proxied by WTC.',
  },
  { code: 'no_trade_history', severity: 'info', title: 'No closed-trade history endpoint', detail: 'Legacy bot does not expose closed-trade history; win rate / profit factor are unavailable (shown as —, not 0).' },
];
