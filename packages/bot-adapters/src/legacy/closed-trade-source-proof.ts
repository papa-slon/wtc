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

const EVIDENCE_REF_PATTERN = /.+:\d+/;
const RAW_PAYLOAD_FIELD_PATTERN = /^[a-z][a-z0-9_]{1,63}$/i;
const SECRET_SHAPED_FIELD_PATTERN = /(secret|token|password|authorization|cookie|api_?key|private|credential|dsn|headers?)/i;
const SUMMARY_REQUIREMENT_KEY_PATTERN = /^[a-z0-9_]{2,80}$/i;

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

export const CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF_CANDIDATE: LegacyClosedTradeSourceProofCandidate = {
  artifactId: 'phase-4.47-no-local-legacy-closed-trade-source',
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
