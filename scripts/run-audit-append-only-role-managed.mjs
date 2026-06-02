#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { redactProcessOutput, runRedactedChildProcess } from './redacted-child-process.mjs';

const args = process.argv.slice(2);
const allowedArgs = new Set(['--help', '-h']);
const unknownArg = args.find((arg) => !allowedArgs.has(arg));
const adminUrl = process.env.AUDIT_APPEND_ONLY_ADMIN_DATABASE_URL;

function usage() {
  console.log(
    [
      'Usage: AUDIT_APPEND_ONLY_ADMIN_DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<maintenance_db> npm run accept:audit:append-only-role:managed',
      '',
      'Creates a fresh wtc_test_audit_<suffix> database and temporary restricted role, applies migrations,',
      'grants SELECT/INSERT only on public.audit_logs, runs npm run accept:audit:append-only-role, then drops both.',
      'The admin URL must point at a non-throwaway maintenance DB such as postgres.',
      'Do not archive full URLs, passwords, cookies, raw environment dumps, or raw terminal buffers.',
    ].join('\n'),
  );
}

function parseAdminUrl(raw) {
  if (!raw) {
    throw new Error(
      'Set AUDIT_APPEND_ONLY_ADMIN_DATABASE_URL to a local/admin Postgres URL that can CREATE/DROP DATABASE and CREATE/DROP ROLE. ' +
        'This runner creates a fresh wtc_test_audit_* database and temporary restricted role for the append-only audit proof.',
    );
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Audit append-only managed runner refused: AUDIT_APPEND_ONLY_ADMIN_DATABASE_URL is not a valid URL.');
  }
  if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) {
    throw new Error('Audit append-only managed runner refused: admin URL must use postgres:// or postgresql://.');
  }
  const adminDb = parsed.pathname.replace(/^\//, '').toLowerCase();
  if (!adminDb || /^wtc_test(?:_|$)/.test(adminDb)) {
    throw new Error('Audit append-only managed runner refused: admin URL must point at a non-throwaway maintenance database.');
  }
  return parsed;
}

function safeMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return redactProcessOutput(message);
}

function buildDbName() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `wtc_test_audit_${stamp}_${randomBytes(3).toString('hex')}`;
}

function buildRoleName() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `wtc_app_role_${stamp}_${randomBytes(3).toString('hex')}`;
}

function buildTargetUrl(admin, dbName) {
  const target = new URL(admin.toString());
  target.pathname = `/${dbName}`;
  return target.toString();
}

function buildRestrictedUrl(targetUrl, roleName, password) {
  const restricted = new URL(targetUrl);
  restricted.username = roleName;
  restricted.password = password;
  return restricted.toString();
}

function quoteGeneratedIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(value)) {
    throw new Error('Generated SQL identifier failed safety validation.');
  }
  return `"${value.replace(/"/g, '""')}"`;
}

function quoteGeneratedLiteral(value) {
  if (!/^[a-f0-9]{48}$/.test(value)) {
    throw new Error('Generated SQL literal failed safety validation.');
  }
  return `'${value}'`;
}

async function applyMigrations(sql) {
  const migrationDir = join(process.cwd(), 'packages', 'db', 'migrations');
  const files = readdirSync(migrationDir).filter((file) => file.endsWith('.sql')).sort();
  if (files.length === 0) throw new Error('No database migrations found.');
  for (const file of files) {
    await sql.unsafe(readFileSync(join(migrationDir, file), 'utf8'));
  }
  return files.length;
}

function runExistingPreflight(restrictedUrl, roleName) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = runRedactedChildProcess(npm, ['run', 'accept:audit:append-only-role'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AUDIT_APPEND_ONLY_DATABASE_URL: restrictedUrl,
      AUDIT_APPEND_ONLY_EXPECTED_ROLE: roleName,
      AUDIT_APPEND_ONLY_PREFLIGHT_ACCEPT: '1',
    },
    windowsHide: true,
  });
  if (result.signal) {
    console.error(`Audit append-only preflight for ${roleName} stopped by signal ${result.signal}.`);
    return 1;
  }
  return typeof result.status === 'number' ? result.status : 1;
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  usage();
  process.exit(0);
}
if (unknownArg) {
  console.error('Audit append-only managed runner refused: unknown argument.');
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
const roleName = buildRoleName();
const rolePassword = randomBytes(24).toString('hex');
const targetUrl = buildTargetUrl(admin, dbName);
const restrictedUrl = buildRestrictedUrl(targetUrl, roleName, rolePassword);
const adminSql = postgres(admin.toString(), { max: 1 });
let targetSql;
let createdDb = false;
let createdRole = false;
let exitCode = 0;

try {
  await adminSql`CREATE DATABASE ${adminSql(dbName)}`;
  createdDb = true;
  console.log(`Created audit append-only throwaway database ${dbName}.`);

  targetSql = postgres(targetUrl, { max: 1 });
  const migrationCount = await applyMigrations(targetSql);
  console.log(`Applied ${migrationCount} migrations to ${dbName}.`);

  await adminSql.unsafe(
    `CREATE ROLE ${quoteGeneratedIdentifier(roleName)} LOGIN PASSWORD ${quoteGeneratedLiteral(rolePassword)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
  );
  createdRole = true;
  console.log(`Created temporary restricted audit role ${roleName}.`);

  await targetSql`GRANT CONNECT ON DATABASE ${targetSql(dbName)} TO ${targetSql(roleName)}`;
  await targetSql`GRANT USAGE ON SCHEMA public TO ${targetSql(roleName)}`;
  await targetSql`REVOKE ALL ON public.audit_logs FROM ${targetSql(roleName)}`;
  await targetSql`GRANT SELECT, INSERT ON public.audit_logs TO ${targetSql(roleName)}`;

  console.log('Running audit append-only role preflight with redacted connection details.');
  exitCode = runExistingPreflight(restrictedUrl, roleName);
} catch (error) {
  console.error(`Audit append-only managed runner failed: ${safeMessage(error)}`);
  if (exitCode === 0) exitCode = typeof error?.status === 'number' ? error.status : 1;
} finally {
  if (targetSql) await targetSql.end({ timeout: 5 }).catch(() => {});
  if (createdDb) {
    try {
      await adminSql`DROP DATABASE IF EXISTS ${adminSql(dbName)} WITH (FORCE)`;
      console.log(`Dropped audit append-only throwaway database ${dbName}.`);
    } catch (dropError) {
      console.error(`Audit append-only managed runner could not drop ${dbName}: ${safeMessage(dropError)}`);
      if (exitCode === 0) exitCode = 1;
    }
  }
  if (createdRole) {
    try {
      await adminSql`DROP ROLE IF EXISTS ${adminSql(roleName)}`;
      console.log(`Dropped temporary restricted audit role ${roleName}.`);
    } catch (dropRoleError) {
      console.error(`Audit append-only managed runner could not drop ${roleName}: ${safeMessage(dropRoleError)}`);
      if (exitCode === 0) exitCode = 1;
    }
  }
  await adminSql.end({ timeout: 5 }).catch(() => {});
}

if (exitCode !== 0) process.exit(exitCode);
