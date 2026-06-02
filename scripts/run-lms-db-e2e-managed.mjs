#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { redactProcessOutput, runRedactedChildProcess } from './redacted-child-process.mjs';

const args = process.argv.slice(2);
const allowedArgs = new Set(['--help', '-h']);
const unknownArg = args.find((arg) => !allowedArgs.has(arg));
const adminUrl = process.env.LMS_E2E_ADMIN_DATABASE_URL;

function usage() {
  console.log(
    [
      'Usage: LMS_E2E_ADMIN_DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<maintenance_db> npm run e2e:lms:db:managed',
      '',
      'Creates a fresh wtc_test_lms_* database, delegates to npm run e2e:lms:db, then drops it.',
      'The admin URL must point at a non-throwaway maintenance DB such as postgres.',
      'Do not archive full URLs, passwords, cookies, raw env dumps, Playwright traces, or unscanned artifacts.',
    ].join('\n'),
  );
}

function parseAdminUrl(raw) {
  if (!raw) {
    throw new Error(
      'Set LMS_E2E_ADMIN_DATABASE_URL to a local/admin Postgres URL that can CREATE/DROP DATABASE. ' +
        'This runner creates a fresh wtc_test_lms_* database and then runs npm run e2e:lms:db.',
    );
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('LMS DB managed runner refused: LMS_E2E_ADMIN_DATABASE_URL is not a valid URL.');
  }
  if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) {
    throw new Error('LMS DB managed runner refused: admin URL must use postgres:// or postgresql://.');
  }
  const adminDb = parsed.pathname.replace(/^\//, '').toLowerCase();
  if (!adminDb || /^wtc_test(?:_|$)/.test(adminDb)) {
    throw new Error('LMS DB managed runner refused: admin URL must point at a non-throwaway maintenance database.');
  }
  return parsed;
}

export function safeMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return redactProcessOutput(message);
}

function buildDbName() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `wtc_test_lms_${stamp}_${randomBytes(3).toString('hex')}`;
}

function buildTargetUrl(admin, dbName) {
  const target = new URL(admin.toString());
  target.pathname = `/${dbName}`;
  return target.toString();
}

function runExistingHarness(targetUrl) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = runRedactedChildProcess(npm, ['run', 'e2e:lms:db'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      LMS_E2E_DATABASE_URL: targetUrl,
    },
    windowsHide: true,
  });
  if (result.signal) {
    console.error(`npm run e2e:lms:db stopped by signal ${result.signal}.`);
    return 1;
  }
  return typeof result.status === 'number' ? result.status : 1;
}

async function main() {
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  usage();
  process.exit(0);
}
if (unknownArg) {
  console.error('LMS DB managed runner refused: unknown argument.');
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
    console.log(`Created LMS DB e2e throwaway database ${dbName}.`);
    exitCode = runExistingHarness(targetUrl);
  } catch (error) {
    console.error(`LMS DB managed runner failed: ${safeMessage(error)}`);
    if (exitCode === 0) exitCode = typeof error?.status === 'number' ? error.status : 1;
  } finally {
    if (created) {
      try {
        await adminSql`DROP DATABASE IF EXISTS ${adminSql(dbName)} WITH (FORCE)`;
        console.log(`Dropped LMS DB e2e throwaway database ${dbName}.`);
      } catch (dropError) {
        console.error(`LMS DB managed runner could not drop ${dbName}: ${safeMessage(dropError)}`);
        if (exitCode === 0) exitCode = 1;
      }
    }
    await adminSql.end({ timeout: 5 }).catch(() => {});
  }

  if (exitCode !== 0) process.exit(exitCode);
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('run-lms-db-e2e-managed.mjs')) {
  await main();
}
