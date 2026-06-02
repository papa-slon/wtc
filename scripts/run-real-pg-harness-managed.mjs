#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { redactProcessOutput, runRedactedChildProcess } from './redacted-child-process.mjs';

const args = process.argv.slice(2);
const allowedArgs = new Set(['--help', '-h']);
const unknownArg = args.find((arg) => !allowedArgs.has(arg));
const adminUrl = process.env.REAL_POSTGRES_ADMIN_DATABASE_URL;

function usage() {
  console.log(
    [
      'Usage: REAL_POSTGRES_ADMIN_DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<maintenance_db> npm run accept:real-pg:managed',
      '',
      'Creates a fresh wtc_test_<suffix> database, runs tests/integration/db-real-postgres.test.ts, then drops it.',
      'The admin URL must point at a non-throwaway maintenance DB such as postgres.',
      'Do not archive full URLs, passwords, SESSION_SECRET, SECRET_VAULT_KEK, cookies, or raw env dumps.',
    ].join('\n'),
  );
}

function parseAdminUrl(raw) {
  if (!raw) {
    throw new Error(
      'Set REAL_POSTGRES_ADMIN_DATABASE_URL to a local/admin Postgres URL that can CREATE/DROP DATABASE. ' +
        'This runner creates a fresh wtc_test_<suffix> database and runs the focused real-PG harness.',
    );
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Real-PG managed runner refused: REAL_POSTGRES_ADMIN_DATABASE_URL is not a valid URL.');
  }
  if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) {
    throw new Error('Real-PG managed runner refused: admin URL must use postgres:// or postgresql://.');
  }
  const adminDb = parsed.pathname.replace(/^\//, '').toLowerCase();
  if (!adminDb || /^wtc_test(?:_|$)/.test(adminDb)) {
    throw new Error('Real-PG managed runner refused: admin URL must point at a non-throwaway maintenance database.');
  }
  return parsed;
}

function buildDbName() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `wtc_test_realpg${stamp}${randomBytes(3).toString('hex')}`;
}

function buildTargetUrl(admin, dbName) {
  const target = new URL(admin.toString());
  target.pathname = `/${dbName}`;
  return target.toString();
}

function generateBase64(bytes) {
  return randomBytes(bytes).toString('base64');
}

function runFocusedHarness(targetUrl, dbName) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = runRedactedChildProcess(npm, ['test', '--', 'tests/integration/db-real-postgres.test.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      REAL_POSTGRES_DATABASE_URL: targetUrl,
      DATABASE_URL: targetUrl,
      SESSION_SECRET: process.env.SESSION_SECRET ?? generateBase64(48),
      SECRET_VAULT_KEK: process.env.SECRET_VAULT_KEK ?? generateBase64(32),
    },
    windowsHide: true,
  });
  if (result.signal) {
    console.error(`Focused real-PG harness for ${dbName} stopped by signal ${result.signal}.`);
    return 1;
  }
  return typeof result.status === 'number' ? result.status : 1;
}

function safeMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return redactProcessOutput(message);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  usage();
  process.exit(0);
}
if (unknownArg) {
  console.error('Real-PG managed runner refused: unknown argument.');
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
let created = false;
let exitCode = 0;

try {
  await adminSql`CREATE DATABASE ${adminSql(dbName)}`;
  created = true;
  console.log(`Created real-PG harness throwaway database ${dbName}.`);
  console.log('Running focused real-PG harness with redacted connection details.');
  exitCode = runFocusedHarness(targetUrl, dbName);
} catch (error) {
  console.error(`Real-PG managed runner failed: ${safeMessage(error)}`);
  if (exitCode === 0) exitCode = typeof error?.status === 'number' ? error.status : 1;
} finally {
  if (created) {
    try {
      await adminSql`DROP DATABASE IF EXISTS ${adminSql(dbName)} WITH (FORCE)`;
      console.log(`Dropped real-PG harness throwaway database ${dbName}.`);
    } catch (dropError) {
      console.error(`Real-PG managed runner could not drop ${dbName}: ${safeMessage(dropError)}`);
      if (exitCode === 0) exitCode = 1;
    }
  }
  await adminSql.end({ timeout: 5 }).catch(() => {});
}

if (exitCode !== 0) process.exit(exitCode);
