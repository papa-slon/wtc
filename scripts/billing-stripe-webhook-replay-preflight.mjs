#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import {
  createUser,
  entitlementsOf,
  getWebhookEventByProviderEvent,
  listManualReviewItems,
  listProductAccessEvents,
  schema,
  seedDatabase,
} from '@wtc/db';
import { hasAccess } from '@wtc/entitlements';
import {
  buildStripeReplayEvent,
  buildStripeReplaySignedRequest,
  summarizeStripeReplayCase,
} from '@wtc/billing';
import { handleBillingWebhookRequest } from '../apps/web/src/features/billing/webhook-handler.ts';
import { resolvePreflightLogRoot, writePreflightSummary } from './preflight-log-root.mjs';

const args = process.argv.slice(2);
const allowedArgs = new Set(['--dry-run', '--help']);
const unknownArg = args.find((arg) => !allowedArgs.has(arg));
const wantsHelp = args.includes('--help');
const logRootEnv = process.env.STRIPE_WEBHOOK_REPLAY_PREFLIGHT_LOG_ROOT;
let preflightLogRoot;
const NOW_MS = 1_900_000_000_000;
const NOW_SEC = Math.floor(NOW_MS / 1000);
const QUIET_LOG = { log() {}, error() {} };

function usage() {
  console.log([
    'Usage: node scripts/billing-stripe-webhook-replay-preflight.mjs [--dry-run]',
    '',
    'Dry-run replays signed fake Stripe webhook fixtures through the extracted route handler.',
    'It uses disposable PGlite, performs no Stripe network I/O, and writes redacted summary evidence.',
  ].join('\n'));
}

function exitRefused(reason) {
  console.error(`# Stripe webhook replay preflight refused - ${reason}`);
  process.exit(2);
}

function writeSummary(summary) {
  return writePreflightSummary(getPreflightLogRoot(), summary);
}

function getPreflightLogRoot() {
  if (preflightLogRoot) return preflightLogRoot;
  try {
    preflightLogRoot = resolvePreflightLogRoot(logRootEnv, 'logs/billing-stripe-webhook-preflight');
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

function signedRequest(rawBody, secret) {
  return buildStripeReplaySignedRequest({ rawBody, webhookSecret: secret, nowMs: NOW_MS });
}

async function handle(db, request, secret) {
  return handleBillingWebhookRequest(request, {
    db,
    env: { STRIPE_WEBHOOK_SECRET: secret, NODE_ENV: 'production' },
    now: NOW_MS,
    log: QUIET_LOG,
  });
}

function redactedBaseSummary(runId) {
  return {
    version: 1,
    runId,
    mode: 'dry-run',
    provider: 'stripe',
    database: 'pglite-disposable',
    network: 'not-run',
    evidence: 'redacted-counts-only',
    cases: [],
  };
}

async function ledgerStatus(db, eventId) {
  return (await getWebhookEventByProviderEvent(db, 'stripe', eventId))?.status ?? 'not_written';
}

async function validCheckoutCase(db, secret, userId) {
  const eventId = 'evt_preflight_valid_checkout';
  const raw = buildStripeReplayEvent({
    id: eventId,
    type: 'checkout.session.completed',
    userId,
    planCode: 'bundle_starter',
    subscription: 'sub_preflight_valid_checkout',
    currentPeriodEnd: NOW_SEC + 30 * 24 * 60 * 60,
    status: 'active',
  });
  const response = await handle(db, signedRequest(raw, secret), secret);
  const status = await ledgerStatus(db, eventId);
  const accessEvents = await listProductAccessEvents(db, userId);
  const ents = await entitlementsOf(db, userId);
  const passed =
    response.status === 200 &&
    status === 'applied' &&
    accessEvents.filter((event) => event.reason === 'payment_succeeded').length === 2 &&
    hasAccess(ents, 'education', NOW_MS) &&
    hasAccess(ents, 'tortila_bot', NOW_MS);

  return {
    case: summarizeStripeReplayCase({
      name: 'valid_checkout',
      result: passed ? 'passed' : 'failed',
      httpStatus: response.status,
      ledgerStatus: status,
      productsChanged: 2,
    }),
    raw,
    eventId,
    accessEventCount: accessEvents.length,
  };
}

async function duplicateTerminalCase(db, secret, userId, raw, eventId, beforeCount) {
  const response = await handle(db, signedRequest(raw, secret), secret);
  const status = await ledgerStatus(db, eventId);
  const afterCount = (await listProductAccessEvents(db, userId)).length;
  const passed = response.status === 200 && status === 'applied' && afterCount === beforeCount;
  return summarizeStripeReplayCase({
    name: 'duplicate_terminal_noop',
    result: passed ? 'passed' : 'failed',
    httpStatus: response.status,
    ledgerStatus: status,
    productsChanged: 0,
  });
}

async function badSignatureCase(db, secret, userId) {
  const eventId = 'evt_preflight_bad_signature';
  const raw = buildStripeReplayEvent({
    id: eventId,
    type: 'checkout.session.completed',
    userId,
    planCode: 'club_monthly',
  });
  const response = await handle(db, signedRequest(raw, 'whsec_wrong_preflight_secret'), secret);
  const status = await ledgerStatus(db, eventId);
  const passed = response.status === 400 && status === 'not_written';
  return summarizeStripeReplayCase({
    name: 'bad_signature_rejected',
    result: passed ? 'passed' : 'failed',
    httpStatus: response.status,
    ledgerStatus: status,
  });
}

async function missingUserManualReviewCase(db, secret) {
  const eventId = 'evt_preflight_missing_user';
  const before = await listManualReviewItems(db, { status: 'pending' });
  const raw = buildStripeReplayEvent({
    id: eventId,
    type: 'checkout.session.completed',
    planCode: 'club_monthly',
  });
  const response = await handle(db, signedRequest(raw, secret), secret);
  const status = await ledgerStatus(db, eventId);
  const after = await listManualReviewItems(db, { status: 'pending' });
  const created = after.length - before.length;
  const passed = response.status === 200 && status === 'manual_review' && created === 1;
  return summarizeStripeReplayCase({
    name: 'missing_user_manual_review',
    result: passed ? 'passed' : 'failed',
    httpStatus: response.status,
    ledgerStatus: status,
    manualReviewItems: created,
  });
}

async function runDryRun() {
  if (process.env.APP_ENV === 'production') exitRefused('APP_ENV=production is not allowed');
  const runId = randomBytes(8).toString('hex');
  const secret = `whsec_preflight_${randomBytes(16).toString('hex')}`;
  const summary = redactedBaseSummary(runId);
  let disposable;
  try {
    disposable = await createDisposableDb();
    const { db } = disposable;
    const user = await createUser(db, {
      email: `stripe-webhook-preflight-${runId}@wtc.local`,
      passwordHash: 'preflight',
      displayName: 'Stripe Webhook Preflight',
    });

    const valid = await validCheckoutCase(db, secret, user.id);
    summary.cases.push(valid.case);
    summary.cases.push(await duplicateTerminalCase(db, secret, user.id, valid.raw, valid.eventId, valid.accessEventCount));
    summary.cases.push(await badSignatureCase(db, secret, user.id));
    summary.cases.push(await missingUserManualReviewCase(db, secret));
    summary.result = summary.cases.every((item) => item.result === 'passed') ? 'pass' : 'fail';
  } catch {
    summary.result = 'fail';
    summary.failure = 'preflight_failed';
  } finally {
    await disposable?.close().catch(() => {});
  }

  const summaryPath = writeSummary(summary);
  if (summary.result !== 'pass') {
    console.error('# Stripe webhook replay preflight failed');
    console.error(`mode=dry-run provider=stripe network=not-run summary=${summaryPath}`);
    process.exit(1);
  }
  console.log('# Stripe webhook replay preflight dry-run complete');
  console.log(`mode=dry-run provider=stripe network=not-run cases=${summary.cases.length} summary=${summaryPath}`);
}

if (wantsHelp) {
  usage();
  process.exit(0);
}
if (unknownArg) exitRefused('unknown argument');
getPreflightLogRoot();

await runDryRun();
