#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import {
  buildLmsObjectDeleteRequest,
  buildLmsObjectPutRequest,
  buildLmsObjectReadUrl,
  readLmsObjectStorageConfig,
} from '../packages/lms/src/object-storage.ts';
import { resolvePreflightLogRoot, writePreflightSummary } from './preflight-log-root.mjs';

const args = process.argv.slice(2);
const allowedArgs = new Set(['--dry-run', '--live', '--help']);
const unknownArg = args.find((arg) => !allowedArgs.has(arg));
const wantsHelp = args.includes('--help');
const live = args.includes('--live');
const dryRun = args.includes('--dry-run') || !live;
const logRootEnv = process.env.LMS_OBJECT_STORAGE_PREFLIGHT_LOG_ROOT;
let preflightLogRoot;

function usage() {
  console.log([
    'Usage: node scripts/lms-s3-r2-live-preflight.mjs [--dry-run|--live]',
    '',
    'Dry-run builds signed requests and writes a redacted summary without network I/O.',
    'Live mode requires LMS_OBJECT_STORAGE_LIVE_ACCEPTANCE=1 and LMS_OBJECT_STORAGE_LIVE_THROWAWAY=1.',
  ].join('\n'));
}

function statusClass(status) {
  if (!Number.isInteger(status) || status < 100) return 'unknown';
  return `${Math.floor(status / 100)}xx`;
}

function writeSummary(summary) {
  return writePreflightSummary(getPreflightLogRoot(), summary);
}

function exitRefused(reason) {
  console.error(`# LMS S3/R2 live preflight refused - ${reason}`);
  process.exit(2);
}

function getPreflightLogRoot() {
  if (preflightLogRoot) return preflightLogRoot;
  try {
    preflightLogRoot = resolvePreflightLogRoot(logRootEnv, 'logs/lms-s3-r2-preflight');
    return preflightLogRoot;
  } catch {
    exitRefused('preflight log root must be repo-local under logs/');
  }
}

function assertBaseConfig() {
  if (process.env.LMS_FILE_STORAGE_PROVIDER !== 's3-r2') {
    exitRefused('storage provider must be s3-r2');
  }
  if (process.env.LMS_PUBLIC_UPLOADS_ENABLED === 'true') {
    exitRefused('public uploads must remain disabled');
  }
  try {
    return readLmsObjectStorageConfig(process.env);
  } catch {
    exitRefused('object storage config required');
  }
}

function assertLiveConsent() {
  if (process.env.LMS_OBJECT_STORAGE_LIVE_ACCEPTANCE !== '1') {
    exitRefused('live acceptance flag missing');
  }
  if (process.env.LMS_OBJECT_STORAGE_LIVE_THROWAWAY !== '1') {
    exitRefused('throwaway target confirmation missing');
  }
}

function makeRun() {
  const runId = randomBytes(8).toString('hex');
  return {
    runId,
    storageKey: `lms/materials/livepreflight${runId}`,
    bytes: new TextEncoder().encode('wtc object-store live preflight\n'),
  };
}

function redactedBaseSummary(runId, mode) {
  return {
    version: 1,
    runId,
    mode,
    provider: 's3-r2',
    objectLocator: 'redacted',
    publicUploadsEnabled: false,
    evidence: 'redacted-counts-only',
    operations: [],
  };
}

function buildRequests(config, run) {
  const now = Date.now();
  const put = buildLmsObjectPutRequest({
    config,
    storageKey: run.storageKey,
    mimeType: 'text/plain',
    bytes: run.bytes,
    now,
  });
  const readUrl = buildLmsObjectReadUrl({
    config,
    storageKey: run.storageKey,
    mimeType: 'text/plain',
    contentDisposition: 'attachment; filename="lesson-material.txt"',
    now: now + 1_000,
    expiresSeconds: 60,
  });
  const del = buildLmsObjectDeleteRequest({ config, storageKey: run.storageKey, now: now + 2_000 });
  return { put, readUrl, del };
}

async function fetchWithoutProviderBody(url, init) {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error('network_error');
  }
}

function recordOperation(summary, name, status, elapsedMs) {
  summary.operations.push({ name, statusClass: statusClass(status), elapsedMs });
}

async function runDryRun(config) {
  const run = makeRun();
  const summary = redactedBaseSummary(run.runId, 'dry-run');
  buildRequests(config, run);
  summary.operations.push(
    { name: 'build-put-request', statusClass: 'not-run', elapsedMs: 0 },
    { name: 'build-read-url', statusClass: 'not-run', elapsedMs: 0 },
    { name: 'build-delete-request', statusClass: 'not-run', elapsedMs: 0 },
  );
  summary.bytesPlanned = run.bytes.byteLength;
  summary.network = 'not-run';
  summary.result = 'pass';
  const summaryPath = writeSummary(summary);
  console.log(`# LMS S3/R2 live preflight dry-run complete`);
  console.log(`mode=dry-run provider=s3-r2 network=not-run request_builds=3 summary=${summaryPath}`);
}

async function runLive(config) {
  assertLiveConsent();
  const run = makeRun();
  const summary = redactedBaseSummary(run.runId, 'live');
  const requests = buildRequests(config, run);
  let created = false;
  let deleted = false;
  let cleanupConfirmed = false;
  let failureCode = null;

  try {
    let start = Date.now();
    const putResponse = await fetchWithoutProviderBody(requests.put.url, {
      method: 'PUT',
      headers: requests.put.headers,
      body: run.bytes,
    });
    recordOperation(summary, 'put', putResponse.status, Date.now() - start);
    if (!putResponse.ok) throw new Error('put_failed');
    created = true;

    start = Date.now();
    const readResponse = await fetchWithoutProviderBody(requests.readUrl, { method: 'GET' });
    recordOperation(summary, 'read', readResponse.status, Date.now() - start);
    if (!readResponse.ok) throw new Error('read_failed');
    const body = new Uint8Array(await readResponse.arrayBuffer());
    if (Buffer.compare(Buffer.from(body), Buffer.from(run.bytes)) !== 0) throw new Error('read_body_mismatch');

    start = Date.now();
    const deleteResponse = await fetchWithoutProviderBody(requests.del.url, {
      method: 'DELETE',
      headers: requests.del.headers,
    });
    recordOperation(summary, 'delete', deleteResponse.status, Date.now() - start);
    if (!deleteResponse.ok) throw new Error('delete_failed');
    deleted = true;
    cleanupConfirmed = true;

    start = Date.now();
    const postDeleteReadUrl = buildLmsObjectReadUrl({
      config,
      storageKey: run.storageKey,
      mimeType: 'text/plain',
      contentDisposition: 'attachment; filename="lesson-material.txt"',
      now: Date.now() + 3_000,
      expiresSeconds: 60,
    });
    const postDeleteResponse = await fetchWithoutProviderBody(postDeleteReadUrl, { method: 'GET' });
    recordOperation(summary, 'post-delete-read', postDeleteResponse.status, Date.now() - start);
    if (postDeleteResponse.ok) throw new Error('post_delete_readable');
  } catch (error) {
    failureCode = error instanceof Error && /^[a-z0-9_]+$/.test(error.message) ? error.message : 'preflight_failed';
  } finally {
    if (created && !deleted) {
      const cleanup = buildLmsObjectDeleteRequest({ config, storageKey: run.storageKey, now: Date.now() + 4_000 });
      const start = Date.now();
      const cleanupResponse = await fetchWithoutProviderBody(cleanup.url, {
        method: 'DELETE',
        headers: cleanup.headers,
      });
      recordOperation(summary, 'cleanup-delete', cleanupResponse.status, Date.now() - start);
      cleanupConfirmed = cleanupResponse.ok || cleanupResponse.status === 404;
    }
    summary.bytesWritten = run.bytes.byteLength;
    summary.bytesRead = run.bytes.byteLength;
    summary.objectsCreated = created ? 1 : 0;
    summary.objectsDeleted = deleted || cleanupConfirmed ? 1 : 0;
    summary.cleanupConfirmed = cleanupConfirmed;
    summary.result = !failureCode && cleanupConfirmed && deleted ? 'pass' : 'fail';
    const summaryPath = writeSummary(summary);
    if (failureCode || !summary.cleanupConfirmed) {
      console.error(`# LMS S3/R2 live preflight failed - ${failureCode ?? 'cleanup_not_confirmed'}`);
      console.error(`summary=${summaryPath}`);
      process.exit(1);
    }
    console.log(`# LMS S3/R2 live preflight passed`);
    console.log(`mode=live provider=s3-r2 put=2xx read=2xx delete=2xx cleanup=confirmed summary=${summaryPath}`);
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
try {
  if (dryRun) await runDryRun(config);
  else await runLive(config);
} catch (error) {
  const reason = error instanceof Error && /^[a-z0-9_]+$/.test(error.message) ? error.message : 'preflight_failed';
  console.error(`# LMS S3/R2 live preflight failed - ${reason}`);
  process.exit(1);
}
