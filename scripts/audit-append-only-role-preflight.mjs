#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';

const args = process.argv.slice(2);
const allowedArgs = new Set(['--help']);
const unknownArg = args.find((arg) => !allowedArgs.has(arg));
const wantsHelp = args.includes('--help');

const databaseUrl = process.env.AUDIT_APPEND_ONLY_DATABASE_URL;
const expectedRole = process.env.AUDIT_APPEND_ONLY_EXPECTED_ROLE?.trim() || 'wtc_app_role';
const accepted = process.env.AUDIT_APPEND_ONLY_PREFLIGHT_ACCEPT === '1';
const nonThrowawayApproved = process.env.AUDIT_APPEND_ONLY_PREFLIGHT_NON_THROWAWAY_APPROVED === '1';

function usage() {
  console.log(
    [
      'Usage: AUDIT_APPEND_ONLY_PREFLIGHT_ACCEPT=1 AUDIT_APPEND_ONLY_DATABASE_URL=postgres://<wtc_app_role>:<password>@<host>:<port>/<db> npm run accept:audit:append-only-role',
      '',
      'Connects as the restricted application role and verifies public.audit_logs is append-only at the PostgreSQL privilege layer.',
      'The check requires SELECT and INSERT, forbids UPDATE, DELETE, and TRUNCATE, then writes one system.health_check audit row.',
      'By default the database name must be wtc_test or start with wtc_test_. Set AUDIT_APPEND_ONLY_PREFLIGHT_NON_THROWAWAY_APPROVED=1 only after operator approval.',
      'Do not archive full URLs, passwords, cookies, raw environment dumps, or server secrets.',
    ].join('\n'),
  );
}

function exitRefused(reason) {
  console.error(`# Audit append-only role preflight refused - ${reason}`);
  process.exit(2);
}

function parseDatabaseUrl(raw) {
  if (!raw) exitRefused('set AUDIT_APPEND_ONLY_DATABASE_URL to the restricted application-role Postgres URL');
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    exitRefused('AUDIT_APPEND_ONLY_DATABASE_URL is not a valid URL');
  }
  if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) {
    exitRefused('AUDIT_APPEND_ONLY_DATABASE_URL must use postgres:// or postgresql://');
  }
  const dbName = parsed.pathname.replace(/^\//, '');
  if (!dbName) exitRefused('AUDIT_APPEND_ONLY_DATABASE_URL must include a database name');
  if (!/^wtc_test(?:_|$)/.test(dbName) && !nonThrowawayApproved) {
    exitRefused(
      'database is not a wtc_test throwaway target; set AUDIT_APPEND_ONLY_PREFLIGHT_NON_THROWAWAY_APPROVED=1 only after explicit approval',
    );
  }
  if (!parsed.username) {
    exitRefused('AUDIT_APPEND_ONLY_DATABASE_URL must use the restricted application role, not an implicit OS/admin role');
  }
  const urlUser = decodeURIComponent(parsed.username).toLowerCase();
  if (urlUser === 'postgres' || urlUser === 'root' || urlUser.includes('admin')) {
    exitRefused('AUDIT_APPEND_ONLY_DATABASE_URL appears to use an administrative role; use the restricted app role instead');
  }
  return parsed;
}

function safeMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgres://<redacted>')
    .replace(/(password=)[^&\s]+/gi, '$1<redacted>');
}

if (wantsHelp) {
  usage();
  process.exit(0);
}
if (unknownArg) exitRefused('unknown argument');
if (!accepted) {
  exitRefused('set AUDIT_APPEND_ONLY_PREFLIGHT_ACCEPT=1 to acknowledge this command writes one audit row');
}

const parsed = parseDatabaseUrl(databaseUrl);
const sql = postgres(parsed.toString(), { max: 1 });
const runId = randomBytes(8).toString('hex');
const targetId = `audit-append-only-preflight:${runId}`;
let exitCode = 0;

try {
  const [identity] = await sql`
    SELECT current_user AS "currentUser", current_database() AS "currentDatabase"
  `;
  if (identity.currentUser !== expectedRole) {
    throw new Error(`expected current_user ${expectedRole}, got ${identity.currentUser}`);
  }

  const [tableRef] = await sql`
    SELECT to_regclass('public.audit_logs')::text AS "tableName"
  `;
  if (tableRef.tableName !== 'audit_logs' && tableRef.tableName !== 'public.audit_logs') {
    throw new Error('public.audit_logs was not found; run migrations before this preflight');
  }

  const [roleAttrs] = await sql`
    SELECT
      r.rolsuper AS "isSuperuser",
      r.rolcreatedb AS "canCreateDb",
      r.rolcreaterole AS "canCreateRole",
      r.rolreplication AS "canReplicate",
      r.rolbypassrls AS "canBypassRls",
      pg_get_userbyid(c.relowner) AS "tableOwner"
    FROM pg_roles r
    JOIN pg_class c ON c.oid = 'public.audit_logs'::regclass
    WHERE r.rolname = current_user
  `;

  const [privileges] = await sql`
    SELECT
      has_table_privilege(current_user, 'public.audit_logs', 'SELECT') AS "canSelect",
      has_table_privilege(current_user, 'public.audit_logs', 'INSERT') AS "canInsert",
      has_table_privilege(current_user, 'public.audit_logs', 'UPDATE') AS "canUpdate",
      has_table_privilege(current_user, 'public.audit_logs', 'DELETE') AS "canDelete",
      has_table_privilege(current_user, 'public.audit_logs', 'TRUNCATE') AS "canTruncate"
  `;

  const failures = [];
  if (roleAttrs.isSuperuser) failures.push('role is superuser');
  if (roleAttrs.canCreateDb) failures.push('role has CREATEDB');
  if (roleAttrs.canCreateRole) failures.push('role has CREATEROLE');
  if (roleAttrs.canReplicate) failures.push('role has REPLICATION');
  if (roleAttrs.canBypassRls) failures.push('role has BYPASSRLS');
  if (roleAttrs.tableOwner === identity.currentUser) failures.push('role owns audit_logs');
  if (!privileges.canSelect) failures.push('missing SELECT');
  if (!privileges.canInsert) failures.push('missing INSERT');
  if (privileges.canUpdate) failures.push('UPDATE is granted');
  if (privileges.canDelete) failures.push('DELETE is granted');
  if (privileges.canTruncate) failures.push('TRUNCATE is granted');
  if (failures.length > 0) {
    throw new Error(`append-only privilege proof failed: ${failures.join(', ')}`);
  }

  await sql`SELECT "id" FROM public.audit_logs LIMIT 1`;
  await sql`
    INSERT INTO public.audit_logs (
      actor_role,
      action,
      target_type,
      target_id,
      after,
      result
    )
    VALUES (
      'system',
      'system.health_check',
      'audit_logs',
      ${targetId},
      ${JSON.stringify({ check: 'audit_append_only_role', version: 1, privilegeProof: 'select_insert_only' })}::jsonb,
      'success'
    )
  `;
  const [probe] = await sql`
    SELECT count(*)::int AS "count"
    FROM public.audit_logs
    WHERE action = 'system.health_check' AND target_id = ${targetId}
  `;
  if (probe.count !== 1) throw new Error('insert probe was not queryable after write');

  console.log('# Audit append-only role preflight complete');
  console.log(
    `role=${identity.currentUser} owner=false elevated=false table=public.audit_logs select=true insert=true update=false delete=false truncate=false probe=inserted`,
  );
} catch (error) {
  console.error(`# Audit append-only role preflight failed - ${safeMessage(error)}`);
  exitCode = 1;
} finally {
  await sql.end({ timeout: 5 }).catch(() => {});
}

if (exitCode !== 0) process.exit(exitCode);
