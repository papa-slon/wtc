#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import {
  createUser,
  schema,
  seedDatabase,
} from '@wtc/db';
import { createMemoryAuditWriter } from '@wtc/audit';
import {
  createAxiomaHandoffPreflightFixture,
  runAxiomaHandoffPreflight,
  verifyEs256HandoffToken,
} from '@wtc/axioma-bridge';
import { handleAxiomaJournalHandoffRequest } from '../apps/web/src/features/terminal/axioma-journal-handoff.ts';
import { handleAxiomaJtiConsumeRequest } from '../apps/web/src/features/terminal/axioma-jti-consume.ts';
import { resolvePreflightLogRoot, writePreflightSummary } from './preflight-log-root.mjs';

const args = process.argv.slice(2);
const allowedArgs = new Set(['--dry-run', '--help']);
const unknownArg = args.find((arg) => !allowedArgs.has(arg));
const wantsHelp = args.includes('--help');
const logRootEnv = process.env.AXIOMA_HANDOFF_PREFLIGHT_LOG_ROOT;
let preflightLogRoot;
const NOW_MS = 1_900_000_000_000;
const CSRF = 'axioma-preflight-csrf';
const SERVICE_TOKEN = 'axioma-preflight-service-token';

function usage() {
  console.log([
    'Usage: node --import tsx scripts/axioma-handoff-preflight.mjs [--dry-run]',
    '',
    'Dry-run generates ephemeral P-256 key material, exercises Axioma ES256/JWKS and local handoff/JTI handlers,',
    'performs no Axioma network I/O, and writes only redacted summary evidence.',
  ].join('\n'));
}

function exitRefused(reason) {
  console.error(`# Axioma handoff preflight refused - ${reason}`);
  process.exit(2);
}

function writeSummary(summary) {
  return writePreflightSummary(getPreflightLogRoot(), summary);
}

function getPreflightLogRoot() {
  if (preflightLogRoot) return preflightLogRoot;
  try {
    preflightLogRoot = resolvePreflightLogRoot(logRootEnv, 'logs/axioma-handoff-preflight');
    return preflightLogRoot;
  } catch {
    exitRefused('preflight log root must be repo-local under logs/');
  }
}

async function createDisposableDb() {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const file of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, file), 'utf8'));
  }
  const db = drizzle(pg, { schema });
  await seedDatabase(db);
  return { db, close: () => pg.close() };
}

function redactedBaseSummary(runId) {
  return {
    version: 1,
    runId,
    mode: 'dry-run',
    provider: 'axioma',
    database: 'pglite-disposable',
    network: 'not-run',
    evidence: 'redacted-counts-only',
    result: 'fail',
  };
}

function accessFor(userId) {
  return {
    allowed: true,
    reason: 'allowed',
    status: 'active',
    productCode: 'axioma_terminal',
    entitlement: {
      userId,
      productCode: 'axioma_terminal',
      status: 'active',
      source: 'manual_grant',
      currentPeriodEnd: NOW_MS + 600_000,
      updatedAt: NOW_MS,
    },
  };
}

function handoffRequest() {
  return new Request('https://wtc.local/api/axioma/journal-handoff', {
    method: 'POST',
    headers: { 'x-csrf-token': CSRF },
  });
}

function consumeRequest(marker) {
  return new Request('https://wtc.local/api/axioma/jti/consume', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${SERVICE_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ jti: marker }),
  });
}

async function runDryRun() {
  if (process.env.APP_ENV === 'production') exitRefused('APP_ENV=production is not allowed');
  if (process.env.AXIOMA_HANDOFF_SIGNING_KEY?.trim()) exitRefused('configured Axioma signing key present');
  if (process.env.AXIOMA_BRIDGE_API_TOKEN?.trim()) exitRefused('configured Axioma bridge API token present');

  const runId = randomBytes(8).toString('hex');
  const fixture = createAxiomaHandoffPreflightFixture({
    keyId: 'wtc-axioma-preflight-generated',
    audience: 'axioma-preflight-audience',
    nowMs: NOW_MS,
  });
  const summary = redactedBaseSummary(runId);
  let disposable;
  try {
    summary.packagePreflight = runAxiomaHandoffPreflight({ fixture });
    disposable = await createDisposableDb();
    const { db } = disposable;
    const user = await createUser(db, {
      email: `axioma-preflight-${runId}@wtc.local`,
      passwordHash: 'preflight',
      displayName: 'Axioma Preflight',
    });
    await db.insert(schema.axiomaAccountLinks).values({
      userId: user.id,
      state: 'linked',
      axiomaUserId: 'axioma-preflight-linked-account',
      linkedAt: new Date(NOW_MS),
    });
    const env = {
      APP_ENV: 'test',
      AXIOMA_ROUTE_SKELETON_ENABLED: 'true',
      AXIOMA_BRIDGE_API_TOKEN: SERVICE_TOKEN,
      AXIOMA_HANDOFF_SIGNING_KEY: fixture.privateKeyPem,
      AXIOMA_HANDOFF_KEY_ID: fixture.keyId,
      AXIOMA_HANDOFF_AUDIENCE: fixture.audience,
      AXIOMA_JOURNAL_BASE_URL: 'https://axi-o.ma',
    };
    const handoff = await handleAxiomaJournalHandoffRequest(handoffRequest(), {
      db,
      env,
      now: NOW_MS,
      getCsrfToken: async () => CSRF,
      requireUser: async () => ({ id: user.id, roles: ['user'] }),
      accessFor: async () => accessFor(user.id),
      reasonLabel: (reason) => reason,
    });
    const handoffBody = await handoff.json();
    const verified = handoff.status === 200
      ? verifyEs256HandoffToken(handoffBody.token, fixture.publicKeyPem, {
        audience: fixture.audience,
        now: NOW_MS + 1000,
      })
      : { valid: false };
    if (!verified.valid) throw new Error('handoff token verification failed');
    const { writer, events } = createMemoryAuditWriter();
    const consume = await handleAxiomaJtiConsumeRequest(consumeRequest(verified.claims.jti), {
      db,
      audit: writer,
      env,
      now: NOW_MS + 1000,
    });
    const replay = await handleAxiomaJtiConsumeRequest(consumeRequest(verified.claims.jti), {
      db,
      audit: writer,
      env,
      now: NOW_MS + 2000,
    });
    if (handoff.status !== 200 || consume.status !== 200 || replay.status !== 409) {
      throw new Error('route handler preflight failed');
    }
    summary.routeHandlers = {
      journal: {
        status: handoff.status,
        method: handoffBody.method,
        tokenSegmentCount: handoffBody.token.split('.').length,
        postBodyOnly: !String(handoffBody.postUrl).includes('?'),
        signerAlg: 'ES256',
      },
      consume: {
        firstStatus: consume.status,
        replayStatus: replay.status,
        auditEventCount: events.length,
      },
      accountLink: {
        linkedRowsSeeded: 1,
      },
    };
    summary.result = 'pass';
  } catch {
    summary.result = 'fail';
    summary.failure = 'preflight_failed';
  } finally {
    await disposable?.close().catch(() => {});
  }

  const summaryPath = writeSummary(summary);
  if (summary.result !== 'pass') {
    console.error('# Axioma handoff preflight failed');
    console.error(`mode=dry-run provider=axioma network=not-run summary=${summaryPath}`);
    process.exit(1);
  }
  console.log('# Axioma handoff preflight dry-run complete');
  console.log(`mode=dry-run provider=axioma network=not-run summary=${summaryPath}`);
}

if (wantsHelp) {
  usage();
  process.exit(0);
}
if (unknownArg) exitRefused('unknown argument');
getPreflightLogRoot();

await runDryRun();
