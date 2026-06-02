#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import {
  buildLmsExternalScannerRequest,
  readLmsExternalScannerConfig,
  scanLmsFileWithExternalScanner,
} from '../packages/lms/src/external-scanner.ts';
import { resolvePreflightLogRoot, writePreflightSummary } from './preflight-log-root.mjs';

const args = process.argv.slice(2);
const allowedArgs = new Set(['--dry-run', '--live', '--help']);
const unknownArg = args.find((arg) => !allowedArgs.has(arg));
const wantsHelp = args.includes('--help');
const live = args.includes('--live');
const dryRun = args.includes('--dry-run') || !live;
const logRootEnv = process.env.LMS_FILE_SCANNER_PREFLIGHT_LOG_ROOT;
let preflightLogRoot;

const cleanBytes = new TextEncoder().encode('wtc external scanner clean preflight\n');
const quarantineBytes = new TextEncoder().encode('EICAR-STANDARD-ANTIVIRUS-TEST-FILE');

function usage() {
  console.log([
    'Usage: node scripts/lms-external-scanner-live-preflight.mjs [--dry-run|--live]',
    '',
    'Dry-run builds scanner requests and writes a redacted summary without network I/O.',
    'Live mode requires LMS_FILE_SCANNER_LIVE_ACCEPTANCE=1 and LMS_FILE_SCANNER_LIVE_EICAR=1.',
  ].join('\n'));
}

function writeSummary(summary) {
  return writePreflightSummary(getPreflightLogRoot(), summary);
}

function exitRefused(reason) {
  console.error(`# LMS external scanner live preflight refused - ${reason}`);
  process.exit(2);
}

function getPreflightLogRoot() {
  if (preflightLogRoot) return preflightLogRoot;
  try {
    preflightLogRoot = resolvePreflightLogRoot(logRootEnv, 'logs/lms-external-scanner-preflight');
    return preflightLogRoot;
  } catch {
    exitRefused('preflight log root must be repo-local under logs/');
  }
}

function assertBaseConfig() {
  if (process.env.LMS_FILE_SCANNER_MODE !== 'external') {
    exitRefused('scanner mode must be external');
  }
  if (process.env.LMS_PUBLIC_UPLOADS_ENABLED === 'true') {
    exitRefused('public uploads must remain disabled');
  }
  try {
    return readLmsExternalScannerConfig(process.env);
  } catch {
    exitRefused('external scanner config required');
  }
}

function assertLiveConsent() {
  if (process.env.LMS_FILE_SCANNER_LIVE_ACCEPTANCE !== '1') {
    exitRefused('live acceptance flag missing');
  }
  if (process.env.LMS_FILE_SCANNER_LIVE_EICAR !== '1') {
    exitRefused('quarantine corpus confirmation missing');
  }
}

function redactedBaseSummary(runId, mode) {
  return {
    version: 1,
    runId,
    mode,
    provider: 'external-scanner',
    scannerEndpoint: 'redacted',
    evidence: 'redacted-counts-only',
    operations: [],
  };
}

function buildRequests(config) {
  const clean = buildLmsExternalScannerRequest({
    config,
    mimeType: 'text/plain',
    sizeBytes: cleanBytes.byteLength,
    bytes: cleanBytes,
  });
  const quarantine = buildLmsExternalScannerRequest({
    config,
    mimeType: 'text/plain',
    sizeBytes: quarantineBytes.byteLength,
    bytes: quarantineBytes,
  });
  return { clean, quarantine };
}

async function runDryRun(config) {
  const runId = randomBytes(8).toString('hex');
  const summary = redactedBaseSummary(runId, 'dry-run');
  buildRequests(config);
  summary.operations.push(
    { name: 'build-clean-request', result: 'not-run', elapsedMs: 0 },
    { name: 'build-quarantine-request', result: 'not-run', elapsedMs: 0 },
  );
  summary.samplesPlanned = 2;
  summary.network = 'not-run';
  summary.result = 'pass';
  const summaryPath = writeSummary(summary);
  console.log(`# LMS external scanner live preflight dry-run complete`);
  console.log(`mode=dry-run provider=external-scanner network=not-run request_builds=2 summary=${summaryPath}`);
}

async function scanSample(config, name, bytes, expectedStatus) {
  const start = Date.now();
  const result = await scanLmsFileWithExternalScanner({
    config,
    mimeType: 'text/plain',
    sizeBytes: bytes.byteLength,
    bytes,
  });
  if (result.status !== expectedStatus) throw new Error(`${name}_unexpected_result`);
  return {
    name,
    result: 'pass',
    elapsedMs: Date.now() - start,
    bytesScanned: bytes.byteLength,
    quarantineReasonObserved: result.reason ? true : undefined,
  };
}

async function runLive(config) {
  assertLiveConsent();
  const runId = randomBytes(8).toString('hex');
  const summary = redactedBaseSummary(runId, 'live');
  try {
    summary.operations.push(await scanSample(config, 'clean-sample', cleanBytes, 'clean'));
    summary.operations.push(await scanSample(config, 'quarantine-sample', quarantineBytes, 'quarantined'));
    summary.result = 'pass';
    const summaryPath = writeSummary(summary);
    console.log(`# LMS external scanner live preflight passed`);
    console.log(`mode=live provider=external-scanner clean=observed quarantine=observed summary=${summaryPath}`);
  } catch (error) {
    const reason = error instanceof Error && /^[a-z0-9_]+$/.test(error.message) ? error.message : 'preflight_failed';
    summary.result = 'fail';
    summary.failure = reason;
    const summaryPath = writeSummary(summary);
    console.error(`# LMS external scanner live preflight failed - ${reason}`);
    console.error(`summary=${summaryPath}`);
    process.exit(1);
  }
}

if (wantsHelp) {
  usage();
  process.exit(0);
}
if (unknownArg) exitRefused('unknown argument');
if (live && args.includes('--dry-run')) exitRefused('choose dry-run or live');
getPreflightLogRoot();

const config = assertBaseConfig();
if (dryRun) await runDryRun(config);
else await runLive(config);
