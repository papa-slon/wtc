export type {
  BotProductCode,
  AdapterMode,
  RiskWarning,
  WarningSeverity,
  HealthStatus,
  ReadState,
  BotHealth,
  BotConfigView,
  ValidationResult,
  BotAdapter,
} from './types.ts';
export { ADAPTER_STALE_THRESHOLD_MS } from './types.ts';
export { BotControlDisabledError, assertBotControlAllowed } from './control.ts';
export {
  CANONICAL_WARNING_CODES,
  isCanonicalWarningCode,
  TORTILA_WARNINGS,
  TORTILA_PERSISTENT_WARNINGS,
  TORTILA_SIGNAL_WARNINGS,
  LEGACY_WARNINGS,
  LEGACY_RUNTIME_WARNINGS,
  knownWarningsForProduct,
  runtimeWarningsForProduct,
  warningCodesFromDetail,
  warningCodesFromValue,
  warningSummaryFromCodes,
  warningSummaryFromWarnings,
  warningsFromCodes,
  warningsFromDetail,
} from './warnings.ts';
export type { WarningCode, WarningNormalizeOptions, WarningSummary } from './warnings.ts';
export { createMockTortilaAdapter } from './mock-tortila.ts';
export { createMockLegacyAdapter } from './mock-legacy.ts';
// createHttpLegacyAdapter intentionally NOT exported — the real legacy HTTP adapter was deleted (B3).
export { createHttpTortilaAdapter, AdapterNotReadyError } from './http.ts';
// PG3 legacy hard gate: the only non-mock legacy adapter, plus the plaintext-key exclusion schema.
export { createLegacyBlockedAdapter, LegacyAdapterBlockedError } from './legacy/legacy-blocked.ts';
export {
  LegacyApiSafeBodySchema,
  isLegacySecretField,
  LEGACY_SECRET_FIELD_NAMES,
} from './legacy/legacy-plaintext-exclusion.ts';
export {
  CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF,
  CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF_CANDIDATE,
  LEGACY_CLOSED_TRADE_FORBIDDEN_SUBSTITUTES,
  LEGACY_CLOSED_TRADE_SOURCE_PROOF_REQUIREMENTS,
  auditLegacyRuntimeClosedTradeSource,
  evaluateLegacyClosedTradeSourceProof,
  legacyClosedTradeSourceProofSummaryFromRaw,
  summarizeLegacyClosedTradeSourceProof,
} from './legacy/closed-trade-source-proof.ts';
export type {
  LegacyClosedTradeForbiddenSubstitute,
  LegacyClosedTradeSourceProofCandidate,
  LegacyClosedTradeSourceProofEvidence,
  LegacyClosedTradeSourceProofRequirement,
  LegacyClosedTradeSourceProofResult,
  LegacyClosedTradeSourceProofSafeSummary,
  LegacyClosedTradeSourceProofSummarySource,
  LegacyRuntimeClosedTradeSourceAuditInput,
  LegacyRuntimeClosedTradeSourceAuditResult,
  LegacyRuntimeSourceLifecycleSnapshot,
  LegacyRuntimeSourceTableSnapshot,
} from './legacy/closed-trade-source-proof.ts';
export { getBotAdapter } from './factory.ts';
export type { AdapterOptions, BotAdapterMode } from './factory.ts';
// Extended Tortila journal reader: 9 endpoints beyond the worker-canonical set, consumed by the
// premium WTC dashboard page only. Never imported by the worker pipeline (the worker stays on the
// existing `BotAdapter` interface). All methods are read-only GET; the JOURNAL_READ_TOKEN never
// leaves the server. See packages/bot-adapters/src/tortila/tortila-journal-reader.ts for the rules.
export {
  createTortilaJournalReader,
  isTortilaJournalError,
} from './tortila/tortila-journal-reader.ts';
export type {
  TortilaJournalReader,
  TortilaJournalReadError,
  TortilaJournalResult,
  TortilaTradeListQuery,
} from './tortila/tortila-journal-reader.ts';
export type {
  TortilaSummary,
  TortilaTradeList,
  TortilaTradeRow,
} from './tortila/tortila.schemas.ts';
export type {
  TortilaAdvancedMetrics,
  TortilaSymbolBreakdown,
  TortilaSymbolBreakdownRow,
  TortilaMonthly,
  TortilaMonthlyRow,
  TortilaCalendar,
  TortilaCalendarDay,
  TortilaDistribution,
  TortilaDrawdownSeries,
  TortilaMarks,
  TortilaMark,
  TortilaActivity,
  TortilaActivityItem,
} from './tortila/tortila.extended.schemas.ts';
