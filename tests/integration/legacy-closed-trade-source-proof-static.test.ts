import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF,
  LEGACY_CLOSED_TRADE_FORBIDDEN_SUBSTITUTES,
  LEGACY_CLOSED_TRADE_SOURCE_PROOF_REQUIREMENTS,
  auditLegacyRuntimeClosedTradeSource,
  evaluateLegacyClosedTradeSourceProof,
  legacyClosedTradeSourceProofSummaryFromRaw,
  summarizeLegacyClosedTradeSourceProof,
  type LegacyClosedTradeSourceProofCandidate,
  type LegacyRuntimeClosedTradeSourceAuditInput,
} from '@wtc/bot-adapters';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const sourceProof = read('packages/bot-adapters/src/legacy/closed-trade-source-proof.ts');
const legacyLive = read('apps/worker/src/legacy-live.ts');
const rootPackageJson = read('package.json');
const auditScript = read('scripts/legacy-closed-trade-source-audit.mjs');

function readJson<T>(rel: string): T {
  return JSON.parse(read(rel)) as T;
}

function completeCandidate(overrides: Partial<LegacyClosedTradeSourceProofCandidate> = {}): LegacyClosedTradeSourceProofCandidate {
  return {
    artifactId: 'fixture-source-proof',
    evidence: LEGACY_CLOSED_TRADE_SOURCE_PROOF_REQUIREMENTS.map((requirement, idx) => ({
      requirement: requirement.key,
      sourceField: `legacy_closed_trades.${requirement.key}`,
      evidenceRef: `legacy/source.py:${idx + 10}`,
    })),
    rawPayloadAllowlist: [
      'trade_id',
      'provider_pub_id',
      'symbol',
      'side',
      'qty',
      'entry_price',
      'exit_price',
      'realized_pnl',
      'fees',
      'funding',
      'opened_at',
      'closed_at',
      'exit_reason',
    ],
    rejectedSubstitutes: LEGACY_CLOSED_TRADE_FORBIDDEN_SUBSTITUTES.map((substitute) => substitute.key),
    ...overrides,
  };
}

describe('Legacy closed-trade source-proof preflight', () => {
  it('keeps the current Legacy closed-trade import fail-closed', () => {
    expect(CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF.status).toBe('blocked_no_source');
    expect(CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF.canImportClosedTrades).toBe(false);
    expect(CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF.missingRequirements).toEqual(
      LEGACY_CLOSED_TRADE_SOURCE_PROOF_REQUIREMENTS.map((requirement) => requirement.key),
    );
    expect(CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF.missingRejectedSubstitutes).toEqual([]);
    expect(CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF.blockers).toContain('missing_raw_payload_allowlist');
  });

  it('requires every source, economic, replay, and raw-payload proof requirement', () => {
    const result = evaluateLegacyClosedTradeSourceProof({
      evidence: [
        {
          requirement: 'source_table_or_api',
          sourceField: 'orders',
          evidenceRef: 'legacy/models.py:109',
        },
      ],
      rawPayloadAllowlist: ['trade_id'],
      rejectedSubstitutes: LEGACY_CLOSED_TRADE_FORBIDDEN_SUBSTITUTES.map((substitute) => substitute.key),
    });

    expect(result.status).toBe('blocked_no_source');
    expect(result.canImportClosedTrades).toBe(false);
    expect(result.missingRequirements).toContain('realized_pnl');
    expect(result.missingRequirements).toContain('funding_sign_policy');
    expect(result.missingRequirements).toContain('replay_backfill_semantics');
    expect(result.missingRequirements).toContain('raw_payload_allowlist');
  });

  it('rejects inactive orders, slots, snapshots, and non-Legacy journals as substitutes', () => {
    const result = evaluateLegacyClosedTradeSourceProof(completeCandidate({ rejectedSubstitutes: [] }));

    expect(result.status).toBe('blocked_no_source');
    expect(result.canImportClosedTrades).toBe(false);
    expect(result.missingRejectedSubstitutes).toEqual(
      LEGACY_CLOSED_TRADE_FORBIDDEN_SUBSTITUTES.map((substitute) => substitute.key),
    );
    expect(result.blockers).toContain('substitute_not_rejected:inactive_orders');
    expect(result.blockers).toContain('substitute_not_rejected:inactive_slots');
    expect(result.blockers).toContain('substitute_not_rejected:tortila_turtle_journal');
  });

  it('rejects secret-shaped or unbounded raw payload fields', () => {
    const result = evaluateLegacyClosedTradeSourceProof(
      completeCandidate({
        rawPayloadAllowlist: ['trade_id', 'symbol', 'api_key', 'Authorization', 'too-wide-field-name'],
      }),
    );

    expect(result.status).toBe('blocked_no_source');
    expect(result.unsafeRawPayloadFields).toEqual(['api_key', 'Authorization', 'too-wide-field-name']);
    expect(result.blockers).toContain('unsafe_raw_payload_field:api_key');
  });

  it('allows a fully evidence-backed candidate only as mapper-ready, not as an importer implementation', () => {
    const result = evaluateLegacyClosedTradeSourceProof(completeCandidate());

    expect(result.status).toBe('ready_for_mapper');
    expect(result.canImportClosedTrades).toBe(true);
    expect(result.missingRequirements).toEqual([]);
    expect(result.missingRejectedSubstitutes).toEqual([]);
    expect(result.unsafeRawPayloadFields).toEqual([]);
  });

  it('projects only safe source-proof summary fields with provenance', () => {
    const globalSummary = summarizeLegacyClosedTradeSourceProof(
      CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF,
      'global_preflight',
    );
    const rawSummary = legacyClosedTradeSourceProofSummaryFromRaw({
      status: 'ready_for_mapper',
      canImportClosedTrades: true,
      missingRequirements: ['closed_at', 'api_key', 'too-wide-field-name', 'symbol'],
      rawPayloadAllowlist: ['trade_id'],
      unsafeRawPayloadFields: ['api_key'],
      blockers: ['unsafe_raw_payload_field:api_key'],
      evidenceRef: 'legacy/source.py:1',
    }, 'scoped_worker_metric');

    expect(globalSummary).toMatchObject({
      status: 'blocked_no_source',
      canImportClosedTrades: false,
      source: 'global_preflight',
      blockerCount: LEGACY_CLOSED_TRADE_SOURCE_PROOF_REQUIREMENTS.length,
    });
    expect(rawSummary).toEqual({
      status: 'ready_for_mapper',
      canImportClosedTrades: true,
      missingRequirements: ['closed_at', 'symbol'],
      blockerCount: 2,
      source: 'scoped_worker_metric',
    });
    expect(JSON.stringify(rawSummary)).not.toContain('rawPayloadAllowlist');
    expect(JSON.stringify(rawSummary)).not.toContain('unsafeRawPayloadFields');
    expect(JSON.stringify(rawSummary)).not.toContain('evidenceRef');
    expect(JSON.stringify(rawSummary)).not.toContain('api_key');
  });

  it('does not add live IO, provider calls, or bot-control surfaces', () => {
    expect(sourceProof).not.toMatch(/process\.env|fetch\(|postgres\(|sql`|LEGACY_DATABASE_URL|TORTILA_JOURNAL_URL/);
    expect(sourceProof).not.toMatch(/startBot|stopBot|applyConfig|closePosition|placeOrder|test connection|Connection verified/);
    expect(legacyLive).toMatch(/CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF/);
    expect(legacyLive).toMatch(/@wtc\/bot-adapters/);
    expect(legacyLive).toMatch(/closedTradeSourceProof/);
    expect(legacyLive).toMatch(/closedPnlUsd: undefined/);
    expect(legacyLive).toMatch(/tradeCount: 0/);
  });

  it('classifies the current safe Legacy runtime schema snapshot as no source', () => {
    const packet = readJson<LegacyRuntimeClosedTradeSourceAuditInput>('tests/fixtures/legacy-runtime-no-source-audit.json');
    const result = auditLegacyRuntimeClosedTradeSource(packet);

    expect(result.artifactId).toBe('phase-4.73-live-legacy-runtime-schema-no-source');
    expect(result.status).toBe('blocked_no_source');
    expect(result.canImportClosedTrades).toBe(false);
    expect(result.candidateSourceTables).toEqual([]);
    expect(result.observedTables).toEqual(['api_keys', 'orders', 'slots', 'stageconfigs', 'symbolsettingss', 'users']);
    expect(result.lifecycle).toMatchObject({
      inactiveOrders: 3421,
      inactiveSlots: 718,
      inactiveTakeProfitOrders: 684,
      filledHandlerObserved: true,
    });
    expect(result.missingRequirements).toContain('source_table_or_api');
    expect(result.missingRequirements).toContain('realized_pnl');
    expect(result.missingRequirements).toContain('closed_at');
    expect(result.blockers).toContain('missing_raw_payload_allowlist');
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('allows a metadata-only source packet to become mapper-ready only when every field is present', () => {
    const packet: LegacyRuntimeClosedTradeSourceAuditInput = {
      artifactId: 'fixture-legacy-closed-trades-source',
      evidenceRef: 'legacy/source.py:42',
      tables: [
        {
          name: 'legacy_closed_trades',
          columns: [
            'provider_pub_id',
            'trade_id',
            'symbol',
            'side',
            'qty',
            'entry_price',
            'exit_price',
            'realized_pnl',
            'fees',
            'funding_sign_policy',
            'opened_at',
            'closed_at',
            'exit_reason',
            'replay_cursor',
          ],
        },
      ],
      rawPayloadAllowlist: [
        'trade_id',
        'provider_pub_id',
        'symbol',
        'side',
        'qty',
        'entry_price',
        'exit_price',
        'realized_pnl',
        'fees',
        'funding',
        'opened_at',
        'closed_at',
        'exit_reason',
      ],
      rejectedSubstitutes: LEGACY_CLOSED_TRADE_FORBIDDEN_SUBSTITUTES.map((substitute) => substitute.key),
    };
    const result = auditLegacyRuntimeClosedTradeSource(packet);

    expect(result.status).toBe('ready_for_mapper');
    expect(result.canImportClosedTrades).toBe(true);
    expect(result.candidateSourceTables).toEqual(['legacy_closed_trades']);
    expect(result.missingRequirements).toEqual([]);
    expect(result.missingRejectedSubstitutes).toEqual([]);
    expect(result.unsafeRawPayloadFields).toEqual([]);
  });

  it('ships a repeatable CLI gate that prints a sanitized no-source summary', () => {
    expect(JSON.parse(rootPackageJson).scripts['verify:legacy:closed-trade-source']).toBe(
      'node --import tsx scripts/legacy-closed-trade-source-audit.mjs',
    );
    expect(auditScript).toContain('auditLegacyRuntimeClosedTradeSource');
    expect(auditScript).not.toMatch(/ssh|fetch\(|postgres\(|LEGACY_DATABASE_URL|startBot|stopBot|applyConfig|closePosition|placeOrder/);

    const output = execFileSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'scripts/legacy-closed-trade-source-audit.mjs',
        '--input',
        'tests/fixtures/legacy-runtime-no-source-audit.json',
        '--expect',
        'blocked_no_source',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const summary = JSON.parse(output) as { status: string; candidateSourceTables: string[]; observedTables: string[] };
    expect(summary.status).toBe('blocked_no_source');
    expect(summary.candidateSourceTables).toEqual([]);
    expect(summary.observedTables).toContain('orders');
    expect(output).not.toMatch(/secret_key|password|token|dsn|authorization|cookie|credential/i);
  });
});
