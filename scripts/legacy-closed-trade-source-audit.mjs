#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { auditLegacyRuntimeClosedTradeSource } from '@wtc/bot-adapters';

function usage() {
  return [
    'Usage: node --import tsx scripts/legacy-closed-trade-source-audit.mjs --input <safe-json> [--expect blocked_no_source|ready_for_mapper]',
    '',
    'The input must be a metadata-only Legacy source packet: table/API names, safe column names,',
    'lifecycle counts, rejected substitutes, and an optional raw payload allowlist. Do not include',
    'raw provider rows, env values, DSNs, API keys, headers, cookies, or exchange secrets.',
  ].join('\n');
}

function parseArgs(argv) {
  const out = { input: null, expect: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { help: true };
    if (arg === '--input') {
      out.input = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === '--expect') {
      out.expect = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

function safeSummary(result) {
  return {
    artifactId: result.artifactId,
    status: result.status,
    canImportClosedTrades: result.canImportClosedTrades,
    missingRequirements: result.missingRequirements,
    missingRejectedSubstitutes: result.missingRejectedSubstitutes,
    unsafeRawPayloadFields: result.unsafeRawPayloadFields,
    blockerCount: result.blockers.length,
    candidateSourceTables: result.candidateSourceTables,
    candidateSourceApis: result.candidateSourceApis,
    observedTables: result.observedTables,
    lifecycle: result.lifecycle,
  };
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }
  if (!args.input) {
    console.error(usage());
    process.exit(2);
  }
  if (args.expect && !['blocked_no_source', 'ready_for_mapper'].includes(args.expect)) {
    throw new Error(`Invalid --expect value: ${args.expect}`);
  }

  const inputPath = resolve(process.cwd(), args.input);
  const packet = JSON.parse(readFileSync(inputPath, 'utf8'));
  const result = auditLegacyRuntimeClosedTradeSource(packet);
  console.log(JSON.stringify(safeSummary(result), null, 2));

  if (args.expect && result.status !== args.expect) {
    console.error(`[legacy-source-audit] expected ${args.expect}, observed ${result.status}`);
    process.exit(1);
  }
} catch (error) {
  console.error(`[legacy-source-audit] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
