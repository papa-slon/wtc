export const LEGACY_CLOSED_TRADE_SOURCE_PROOF_REQUIREMENTS = [
  { key: 'source_table_or_api', label: 'source table/API' },
  { key: 'mapped_provider_filter', label: 'mapped provider/account filter' },
  { key: 'stable_trade_or_fill_id', label: 'stable trade/fill id' },
  { key: 'symbol', label: 'symbol' },
  { key: 'side', label: 'side' },
  { key: 'size', label: 'qty/size' },
  { key: 'entry_price', label: 'entry price' },
  { key: 'exit_price', label: 'exit price' },
  { key: 'realized_pnl', label: 'realized PnL' },
  { key: 'fees', label: 'fees' },
  { key: 'funding_sign_policy', label: 'funding sign policy' },
  { key: 'opened_at', label: 'opened timestamp' },
  { key: 'closed_at', label: 'closed timestamp' },
  { key: 'exit_reason', label: 'exit reason' },
  { key: 'replay_backfill_semantics', label: 'replay/backfill semantics' },
  { key: 'raw_payload_allowlist', label: 'raw payload allowlist' },
] as const;

export type LegacyClosedTradeSourceProofRequirement =
  (typeof LEGACY_CLOSED_TRADE_SOURCE_PROOF_REQUIREMENTS)[number]['key'];

export const LEGACY_CLOSED_TRADE_FORBIDDEN_SUBSTITUTES = [
  { key: 'inactive_orders', label: 'inactive Legacy orders' },
  { key: 'inactive_slots', label: 'inactive Legacy slots' },
  { key: 'open_order_reconciliation', label: 'open-order reconciliation state' },
  { key: 'position_snapshots', label: 'position snapshots' },
  { key: 'tortila_turtle_journal', label: 'Tortila/Turtle journal rows' },
  { key: 'gte_manual_journal', label: 'GTE manual/terminal journal rows' },
] as const;

export type LegacyClosedTradeForbiddenSubstitute =
  (typeof LEGACY_CLOSED_TRADE_FORBIDDEN_SUBSTITUTES)[number]['key'];

export interface LegacyClosedTradeSourceProofEvidence {
  requirement: LegacyClosedTradeSourceProofRequirement;
  sourceField: string;
  evidenceRef: string;
}

export interface LegacyClosedTradeSourceProofCandidate {
  artifactId?: string;
  evidence?: readonly LegacyClosedTradeSourceProofEvidence[];
  rawPayloadAllowlist?: readonly string[];
  rejectedSubstitutes?: readonly LegacyClosedTradeForbiddenSubstitute[];
}

export interface LegacyRuntimeSourceTableSnapshot {
  name: string;
  columns?: readonly string[];
  rowCount?: number;
}

export interface LegacyRuntimeSourceLifecycleSnapshot {
  inactiveOrders?: number;
  inactiveSlots?: number;
  activeOrders?: number;
  activeSlots?: number;
  inactiveTakeProfitOrders?: number;
  filledHandlerObserved?: boolean;
}

export interface LegacyRuntimeClosedTradeSourceAuditInput {
  artifactId?: string;
  tables?: readonly LegacyRuntimeSourceTableSnapshot[];
  apiEndpoints?: readonly string[];
  rawPayloadAllowlist?: readonly string[];
  rejectedSubstitutes?: readonly LegacyClosedTradeForbiddenSubstitute[];
  evidenceRef?: string;
  lifecycle?: LegacyRuntimeSourceLifecycleSnapshot;
}

export interface LegacyClosedTradeSourceProofResult {
  status: 'blocked_no_source' | 'ready_for_mapper';
  canImportClosedTrades: boolean;
  missingRequirements: LegacyClosedTradeSourceProofRequirement[];
  missingRejectedSubstitutes: LegacyClosedTradeForbiddenSubstitute[];
  unsafeRawPayloadFields: string[];
  blockers: string[];
}

export type LegacyClosedTradeSourceProofSummarySource = 'global_preflight' | 'scoped_worker_metric';

export interface LegacyClosedTradeSourceProofSafeSummary {
  status: 'blocked_no_source' | 'ready_for_mapper' | 'unknown';
  canImportClosedTrades: boolean;
  missingRequirements: string[];
  blockerCount: number;
  source: LegacyClosedTradeSourceProofSummarySource;
}

export interface LegacyRuntimeClosedTradeSourceAuditResult extends LegacyClosedTradeSourceProofResult {
  artifactId: string;
  candidateSourceTables: string[];
  candidateSourceApis: string[];
  observedTables: string[];
  lifecycle: LegacyRuntimeSourceLifecycleSnapshot;
}

const EVIDENCE_REF_PATTERN = /.+:\d+/;
const RAW_PAYLOAD_FIELD_PATTERN = /^[a-z][a-z0-9_]{1,63}$/i;
const SECRET_SHAPED_FIELD_PATTERN = /(secret|token|password|authorization|cookie|api_?key|private|credential|dsn|headers?)/i;
const SUMMARY_REQUIREMENT_KEY_PATTERN = /^[a-z0-9_]{2,80}$/i;
const LEGACY_RUNTIME_SOURCE_TABLE_PATTERN = /(closed.*trade|trade|fill|history|pnl|profit|fee|funding|commission|execution|deal|realized|realised)/i;
const LEGACY_OPERATIONAL_TABLES = new Set(['api_keys', 'orders', 'slots', 'stageconfigs', 'symbolsettingss', 'users']);
const LEGACY_REQUIREMENT_COLUMN_CANDIDATES: Record<Exclude<LegacyClosedTradeSourceProofRequirement, 'source_table_or_api' | 'raw_payload_allowlist'>, readonly string[]> = {
  mapped_provider_filter: ['provider_pub_id', 'pub_id', 'api_id', 'provider_account_id', 'account_id'],
  stable_trade_or_fill_id: ['trade_id', 'fill_id', 'external_trade_id', 'closed_trade_id', 'deal_id', 'execution_id'],
  symbol: ['symbol', 'position', 'instrument'],
  side: ['side', 'position_side', 'direction'],
  size: ['size', 'qty', 'quantity', 'filled_qty', 'executed_qty'],
  entry_price: ['entry_price', 'avg_entry', 'avg_entry_price', 'open_price'],
  exit_price: ['exit_price', 'close_price', 'closed_price'],
  realized_pnl: ['realized_pnl', 'realised_pnl', 'pnl', 'profit'],
  fees: ['fees', 'fee', 'commission', 'fees_pnl'],
  funding_sign_policy: ['funding_sign_policy', 'funding_pnl_sign_policy'],
  opened_at: ['opened_at', 'open_time', 'entry_time'],
  closed_at: ['closed_at', 'close_time', 'exit_time'],
  exit_reason: ['exit_reason', 'close_reason', 'reason'],
  replay_backfill_semantics: ['replay_cursor', 'source_cursor', 'backfill_cursor', 'event_seq', 'sequence_id'],
};

function nonBlank(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function requirementHasEvidence(
  candidate: LegacyClosedTradeSourceProofCandidate,
  requirement: LegacyClosedTradeSourceProofRequirement,
): boolean {
  return (candidate.evidence ?? []).some(
    (entry) =>
      entry.requirement === requirement &&
      nonBlank(entry.sourceField) &&
      nonBlank(entry.evidenceRef) &&
      EVIDENCE_REF_PATTERN.test(entry.evidenceRef),
  );
}

function unsafeRawPayloadFields(candidate: LegacyClosedTradeSourceProofCandidate): string[] {
  return (candidate.rawPayloadAllowlist ?? []).filter(
    (field) => !RAW_PAYLOAD_FIELD_PATTERN.test(field) || SECRET_SHAPED_FIELD_PATTERN.test(field),
  );
}

function isSafeSummaryRequirementKey(value: string): boolean {
  return SUMMARY_REQUIREMENT_KEY_PATTERN.test(value) && !SECRET_SHAPED_FIELD_PATTERN.test(value);
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function safeEvidenceRef(value: string | undefined): string {
  return value && EVIDENCE_REF_PATTERN.test(value) ? value : 'legacy-runtime-audit:1';
}

function tableLooksLikeClosedTradeSource(table: LegacyRuntimeSourceTableSnapshot): boolean {
  const name = normalizeIdentifier(table.name);
  return !LEGACY_OPERATIONAL_TABLES.has(name) && LEGACY_RUNTIME_SOURCE_TABLE_PATTERN.test(name);
}

function apiLooksLikeClosedTradeSource(endpoint: string): boolean {
  return LEGACY_RUNTIME_SOURCE_TABLE_PATTERN.test(endpoint);
}

function columnEvidence(
  table: LegacyRuntimeSourceTableSnapshot,
  requirement: Exclude<LegacyClosedTradeSourceProofRequirement, 'source_table_or_api' | 'raw_payload_allowlist'>,
): string | null {
  const columns = new Set((table.columns ?? []).map(normalizeIdentifier));
  const match = LEGACY_REQUIREMENT_COLUMN_CANDIDATES[requirement].find((column) => columns.has(column));
  return match ? `${table.name}.${match}` : null;
}

export function evaluateLegacyClosedTradeSourceProof(
  candidate: LegacyClosedTradeSourceProofCandidate,
): LegacyClosedTradeSourceProofResult {
  const missingRequirements = LEGACY_CLOSED_TRADE_SOURCE_PROOF_REQUIREMENTS
    .map((requirement) => requirement.key)
    .filter((requirement) => !requirementHasEvidence(candidate, requirement));
  const rejected = new Set(candidate.rejectedSubstitutes ?? []);
  const missingRejectedSubstitutes = LEGACY_CLOSED_TRADE_FORBIDDEN_SUBSTITUTES
    .map((substitute) => substitute.key)
    .filter((substitute) => !rejected.has(substitute));
  const unsafeFields = unsafeRawPayloadFields(candidate);
  const rawAllowlistMissing = (candidate.rawPayloadAllowlist ?? []).length === 0;
  const blockers = [
    ...missingRequirements.map((requirement) => `missing_requirement:${requirement}`),
    ...missingRejectedSubstitutes.map((substitute) => `substitute_not_rejected:${substitute}`),
    ...unsafeFields.map((field) => `unsafe_raw_payload_field:${field}`),
    ...(rawAllowlistMissing ? ['missing_raw_payload_allowlist'] : []),
  ];

  return {
    status: blockers.length === 0 ? 'ready_for_mapper' : 'blocked_no_source',
    canImportClosedTrades: blockers.length === 0,
    missingRequirements,
    missingRejectedSubstitutes,
    unsafeRawPayloadFields: unsafeFields,
    blockers,
  };
}

export function auditLegacyRuntimeClosedTradeSource(
  input: LegacyRuntimeClosedTradeSourceAuditInput,
): LegacyRuntimeClosedTradeSourceAuditResult {
  const candidateTables = (input.tables ?? []).filter(tableLooksLikeClosedTradeSource);
  const candidateApis = (input.apiEndpoints ?? []).filter(apiLooksLikeClosedTradeSource);
  const sourceTable = candidateTables[0];
  const evidenceRef = safeEvidenceRef(input.evidenceRef);
  const evidence: LegacyClosedTradeSourceProofEvidence[] = [];

  if (sourceTable || candidateApis.length > 0) {
    evidence.push({
      requirement: 'source_table_or_api',
      sourceField: sourceTable ? sourceTable.name : candidateApis[0]!,
      evidenceRef,
    });
  }

  if (sourceTable) {
    for (const requirement of Object.keys(LEGACY_REQUIREMENT_COLUMN_CANDIDATES) as Exclude<
      LegacyClosedTradeSourceProofRequirement,
      'source_table_or_api' | 'raw_payload_allowlist'
    >[]) {
      const sourceField = columnEvidence(sourceTable, requirement);
      if (sourceField) evidence.push({ requirement, sourceField, evidenceRef });
    }
  }

  if ((input.rawPayloadAllowlist ?? []).length > 0) {
    evidence.push({
      requirement: 'raw_payload_allowlist',
      sourceField: 'legacy_source_packet.raw_payload_allowlist',
      evidenceRef,
    });
  }

  const result = evaluateLegacyClosedTradeSourceProof({
    artifactId: input.artifactId,
    evidence,
    rawPayloadAllowlist: input.rawPayloadAllowlist ?? [],
    rejectedSubstitutes: input.rejectedSubstitutes ?? [],
  });

  return {
    ...result,
    artifactId: input.artifactId ?? 'legacy-runtime-source-audit',
    candidateSourceTables: candidateTables.map((table) => table.name),
    candidateSourceApis: candidateApis,
    observedTables: (input.tables ?? []).map((table) => table.name),
    lifecycle: input.lifecycle ?? {},
  };
}

export const CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF_CANDIDATE: LegacyClosedTradeSourceProofCandidate = {
  artifactId: 'phase-4.73-live-legacy-runtime-no-closed-trade-source',
  evidence: [],
  rawPayloadAllowlist: [],
  rejectedSubstitutes: LEGACY_CLOSED_TRADE_FORBIDDEN_SUBSTITUTES.map((substitute) => substitute.key),
};

export const CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF = evaluateLegacyClosedTradeSourceProof(
  CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF_CANDIDATE,
);

export function summarizeLegacyClosedTradeSourceProof(
  result: Pick<LegacyClosedTradeSourceProofResult, 'status' | 'canImportClosedTrades' | 'missingRequirements'>,
  source: LegacyClosedTradeSourceProofSummarySource,
): LegacyClosedTradeSourceProofSafeSummary {
  const status = result.status === 'blocked_no_source' || result.status === 'ready_for_mapper' ? result.status : 'unknown';
  const missingRequirements = result.missingRequirements
    .filter(isSafeSummaryRequirementKey)
    .slice(0, 32);
  return {
    status,
    canImportClosedTrades: status === 'ready_for_mapper' && result.canImportClosedTrades,
    missingRequirements,
    blockerCount: missingRequirements.length,
    source,
  };
}

export function legacyClosedTradeSourceProofSummaryFromRaw(
  value: unknown,
  source: LegacyClosedTradeSourceProofSummarySource,
): LegacyClosedTradeSourceProofSafeSummary | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const status =
    record.status === 'blocked_no_source' || record.status === 'ready_for_mapper'
      ? record.status
      : 'unknown';
  const missingRequirements = Array.isArray(record.missingRequirements)
    ? record.missingRequirements
      .filter((item): item is string => typeof item === 'string' && isSafeSummaryRequirementKey(item))
      .slice(0, 32)
    : [];
  return {
    status,
    canImportClosedTrades: status === 'ready_for_mapper' && record.canImportClosedTrades === true,
    missingRequirements,
    blockerCount: missingRequirements.length,
    source,
  };
}
