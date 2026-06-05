#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { redactProcessOutput, runRedactedChildProcess } from './redacted-child-process.mjs';

const args = process.argv.slice(2);
const allowedArgs = new Set(['--help', '-h']);
const unknownArg = args.find((arg) => !allowedArgs.has(arg));
const adminUrl = process.env.WORKER_CONTINUITY_ADMIN_DATABASE_URL;

const expectedFull = {
  workerStatus: 'ok',
  botContinuity: 'ok',
  tortila: 'ok',
  legacy: 'ok',
};

function usage() {
  console.log(
    [
      'Usage: WORKER_CONTINUITY_ADMIN_DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<maintenance_db> npm run accept:worker:continuity:managed',
      '',
      'Creates a fresh wtc_test_worker_continuity_* database, applies migrations, seeds demo data,',
      'creates fixture-only Legacy source rows, runs the safe worker continuity DB tick, verifies the worker health row, then drops the database.',
      'The admin URL must point at a non-throwaway maintenance database such as postgres.',
      'This proves the disposable DB/worker path with Tortila mock and Legacy fixture DB snapshots; it does not touch live bots, exchanges, or provider systems.',
      'Do not archive full URLs, passwords, cookies, raw env dumps, or unreviewed logs.',
    ].join('\n'),
  );
}

function parseAdminUrl(raw) {
  if (!raw) {
    throw new Error(
      'Set WORKER_CONTINUITY_ADMIN_DATABASE_URL to a local/admin Postgres URL that can CREATE/DROP DATABASE. ' +
        'This runner creates a fresh wtc_test_worker_continuity_* database and drops it after verification.',
    );
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Worker continuity managed runner refused: WORKER_CONTINUITY_ADMIN_DATABASE_URL is not a valid URL.');
  }
  if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) {
    throw new Error('Worker continuity managed runner refused: admin URL must use postgres:// or postgresql://.');
  }
  const adminDb = parsed.pathname.replace(/^\//, '').toLowerCase();
  if (!adminDb || /^wtc_test(?:_|$)/.test(adminDb)) {
    throw new Error('Worker continuity managed runner refused: admin URL must point at a non-throwaway maintenance database.');
  }
  return parsed;
}

function buildDbName() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `wtc_test_worker_continuity_${stamp}_${randomBytes(3).toString('hex')}`;
}

function buildTargetUrl(admin, dbName) {
  const target = new URL(admin.toString());
  target.pathname = `/${dbName}`;
  return target.toString();
}

function safeMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return redactProcessOutput(message);
}

async function applyMigrations(sql) {
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  const files = readdirSync(migDir).filter((file) => file.endsWith('.sql')).sort();
  if (files.length === 0) throw new Error('Worker continuity managed runner refused: no migration SQL files found.');
  for (const file of files) {
    await sql.unsafe(readFileSync(join(migDir, file), 'utf8'));
  }
  return files.length;
}

function runSeed(targetUrl) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = runRedactedChildProcess(npm, ['run', 'db:seed', '-w', '@wtc/db'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: targetUrl },
    windowsHide: true,
  });
  if (result.signal) {
    console.error(`Worker continuity managed runner seed stopped by signal ${result.signal}.`);
    return 1;
  }
  return typeof result.status === 'number' ? result.status : 1;
}

async function prepareWorkerContinuityFixture(sql, ownerId, adminId) {
  const legacyPubId = 'WORKER_CONTINUITY_LEGACY_PUB_ID';

  const [legacyInstance] = await sql`
    INSERT INTO bot_instances (user_id, product_code)
    VALUES (${ownerId}, 'legacy_bot')
    RETURNING id
  `;
  if (!legacyInstance?.id) throw new Error('Worker continuity managed runner refused: legacy bot instance fixture insert failed.');

  await sql`
    INSERT INTO bot_provider_accounts (
      user_id,
      bot_instance_id,
      product_code,
      provider,
      provider_account_id,
      label,
      status,
      created_by
    )
    VALUES (
      ${ownerId},
      ${legacyInstance.id},
      'legacy_bot',
      'legacy-db',
      ${legacyPubId},
      'Worker continuity Legacy fixture',
      'active',
      ${adminId}
    )
  `;

  await sql`
    CREATE TABLE api_keys (
      id serial PRIMARY KEY,
      pub_id text NOT NULL,
      market text,
      running boolean NOT NULL DEFAULT true,
      balance numeric,
      quarantined boolean DEFAULT false,
      quarantine_reason text
    )
  `;
  await sql`
    CREATE TABLE symbolsettingss (
      id serial PRIMARY KEY,
      api_id text NOT NULL,
      symbol text NOT NULL,
      active boolean DEFAULT true,
      timeframe text,
      use_rsi boolean DEFAULT true,
      use_cci boolean DEFAULT false,
      rsi_length integer,
      rsi_threshold numeric,
      cci_length integer,
      cci_threshold numeric,
      take_profit_percent numeric,
      initial_entry_percent numeric,
      averaging_levels integer,
      averaging_percents text,
      averaging_volume_percents text,
      use_balance_percent numeric,
      leverage integer,
      stage integer,
      use_delay_filter boolean DEFAULT false,
      delay_bars integer,
      use_delta_filter boolean DEFAULT false,
      delta_filter numeric
    )
  `;
  await sql`
    CREATE TABLE stageconfigs (
      id serial PRIMARY KEY,
      api_id text NOT NULL,
      stage integer,
      rsi_slots integer,
      cci_slots integer
    )
  `;
  await sql`
    CREATE TABLE slots (
      id serial PRIMARY KEY,
      api_id text NOT NULL,
      position text NOT NULL,
      reason text,
      stage integer,
      averaging_count integer,
      active boolean DEFAULT true,
      created_at timestamp with time zone
    )
  `;
  await sql`
    CREATE TABLE orders (
      id serial PRIMARY KEY,
      api_id text NOT NULL,
      position text NOT NULL,
      position_side text,
      note text,
      price numeric,
      quantity numeric,
      active boolean DEFAULT true
    )
  `;

  await sql`
    INSERT INTO api_keys (pub_id, market, running, balance, quarantined, quarantine_reason)
    VALUES (${legacyPubId}, 'BINGX', true, 2500.55, false, null)
  `;
  await sql`
    INSERT INTO symbolsettingss (
      api_id,
      symbol,
      active,
      timeframe,
      use_rsi,
      use_cci,
      rsi_length,
      rsi_threshold,
      cci_length,
      cci_threshold,
      take_profit_percent,
      initial_entry_percent,
      averaging_levels,
      averaging_percents,
      averaging_volume_percents,
      use_balance_percent,
      leverage,
      stage,
      use_delay_filter,
      delay_bars,
      use_delta_filter,
      delta_filter
    )
    VALUES (
      ${legacyPubId},
      'BTC-USDT',
      true,
      '3m',
      true,
      false,
      14,
      22,
      20,
      -180,
      0.7,
      100,
      3,
      '3,9,21',
      '4,8,16',
      1.2,
      2,
      1,
      true,
      2,
      false,
      0
    )
  `;
  await sql`
    INSERT INTO stageconfigs (api_id, stage, rsi_slots, cci_slots)
    VALUES (${legacyPubId}, 1, 2, 1), (${legacyPubId}, 2, 1, 2)
  `;
  await sql`
    INSERT INTO slots (api_id, position, reason, stage, averaging_count, active, created_at)
    VALUES (${legacyPubId}, 'BTC-USDT', 'YELLOW', 1, 1, true, now())
  `;
  await sql`
    INSERT INTO orders (api_id, position, position_side, note, price, quantity, active)
    VALUES
      (${legacyPubId}, 'BTC-USDT', 'LONG', 'BUY', 100000, 0.01, true),
      (${legacyPubId}, 'BTC-USDT', 'LONG', 'TAKE_PROFIT', 101000, 0.01, true)
  `;

  console.log('Prepared worker continuity fixture rows for Tortila mock and Legacy fixture DB snapshots.');
}

function runSafeWorkerTick(targetUrl, ownerId) {
  const result = runRedactedChildProcess(
    process.execPath,
    ['scripts/safe-worker-tick.mjs', '--require-db', '--expect-continuity=full'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: targetUrl,
        SYSTEM_BOT_OWNER_ID: ownerId,
        SYSTEM_LEGACY_BOT_OWNER_ID: ownerId,
        LEGACY_LIVE_READS_ENABLED: 'true',
        LEGACY_DATABASE_URL: targetUrl,
        TORTILA_JOURNAL_URL: '',
        TORTILA_JOURNAL_BASE_URL: '',
        JOURNAL_READ_TOKEN: '',
      },
      windowsHide: true,
    },
  );
  if (result.signal) {
    console.error(`Worker continuity managed runner tick stopped by signal ${result.signal}.`);
    return 1;
  }
  return typeof result.status === 'number' ? result.status : 1;
}

function actualWorkerTuple(row) {
  const detail = row?.detail && typeof row.detail === 'object' ? row.detail : {};
  return {
    workerStatus: row?.status ?? null,
    botContinuity: typeof detail.botContinuityStatus === 'string' ? detail.botContinuityStatus : null,
    tortila: typeof detail.tortilaSnapshot === 'string' ? detail.tortilaSnapshot : null,
    legacy: typeof detail.legacySnapshot === 'string' ? detail.legacySnapshot : null,
  };
}

function assertFullTuple(row) {
  const actual = actualWorkerTuple(row);
  if (
    actual.workerStatus !== expectedFull.workerStatus
    || actual.botContinuity !== expectedFull.botContinuity
    || actual.tortila !== expectedFull.tortila
    || actual.legacy !== expectedFull.legacy
  ) {
    throw new Error(
      `Worker continuity managed runner refused: expected full worker row worker_status=${expectedFull.workerStatus} bot_continuity=${expectedFull.botContinuity} tortila=${expectedFull.tortila} legacy=${expectedFull.legacy}; observed worker_status=${actual.workerStatus ?? 'missing'} bot_continuity=${actual.botContinuity ?? 'missing'} tortila=${actual.tortila ?? 'missing'} legacy=${actual.legacy ?? 'missing'}`,
    );
  }
  const detail = row?.detail && typeof row.detail === 'object' ? row.detail : {};
  if (detail.tortilaReadState !== 'ok' || detail.legacyReadState !== 'ok') {
    throw new Error(
      `Worker continuity managed runner refused: expected detail read states tortila=ok legacy=ok; observed tortila=${detail.tortilaReadState ?? 'missing'} legacy=${detail.legacyReadState ?? 'missing'}`,
    );
  }
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  usage();
  process.exit(0);
}
if (unknownArg) {
  console.error('Worker continuity managed runner refused: unknown argument.');
  process.exit(2);
}

let admin;
try {
  admin = parseAdminUrl(adminUrl);
} catch (error) {
  console.error(safeMessage(error));
  process.exit(2);
}

const dbName = buildDbName();
const targetUrl = buildTargetUrl(admin, dbName);
const adminSql = postgres(admin.toString(), { max: 1 });
let targetSql = null;
let created = false;
let exitCode = 0;

try {
  await adminSql`CREATE DATABASE ${adminSql(dbName)}`;
  created = true;
  console.log(`Created worker continuity throwaway database ${dbName}.`);

  targetSql = postgres(targetUrl, { max: 1 });
  const migrationCount = await applyMigrations(targetSql);
  console.log(`Applied ${migrationCount} migration(s) to worker continuity throwaway database ${dbName}.`);

  exitCode = runSeed(targetUrl);
  if (exitCode !== 0) throw new Error('Worker continuity managed runner seed failed.');

  const [owner] = await targetSql`SELECT id FROM users WHERE email = 'user@wtc.local' LIMIT 1`;
  if (!owner?.id) throw new Error('Worker continuity managed runner refused: seeded user@wtc.local was not found.');
  const [adminUser] = await targetSql`SELECT id FROM users WHERE email = 'admin@wtc.local' LIMIT 1`;
  if (!adminUser?.id) throw new Error('Worker continuity managed runner refused: seeded admin@wtc.local was not found.');

  await prepareWorkerContinuityFixture(targetSql, owner.id, adminUser.id);

  exitCode = runSafeWorkerTick(targetUrl, owner.id);
  if (exitCode !== 0) throw new Error('Worker continuity managed runner tick failed.');

  const [workerRow] = await targetSql`
    SELECT status, detail
    FROM integration_health_checks
    WHERE target = 'worker'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  assertFullTuple(workerRow);
  const tuple = actualWorkerTuple(workerRow);
  console.log(
    `Verified worker continuity DB row for ${dbName}: target=worker worker_status=${tuple.workerStatus} bot_continuity=${tuple.botContinuity} tortila=${tuple.tortila} legacy=${tuple.legacy}.`,
  );
} catch (error) {
  console.error(`Worker continuity managed runner failed: ${safeMessage(error)}`);
  if (exitCode === 0) exitCode = typeof error?.status === 'number' ? error.status : 1;
} finally {
  if (targetSql) {
    await targetSql.end({ timeout: 5 }).catch(() => {});
  }
  if (created) {
    try {
      await adminSql`DROP DATABASE IF EXISTS ${adminSql(dbName)} WITH (FORCE)`;
      console.log(`Dropped worker continuity throwaway database ${dbName}.`);
    } catch (dropError) {
      console.error(`Worker continuity managed runner could not drop ${dbName}: ${safeMessage(dropError)}`);
      if (exitCode === 0) exitCode = 1;
    }
  }
  await adminSql.end({ timeout: 5 }).catch(() => {});
}

if (exitCode !== 0) process.exit(exitCode);
