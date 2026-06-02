# ecosystem-security-auditor handoff
## Scope
Read-only security audit for the next phase after 3.60: determine whether `npm run accept:audit:append-only-role` can be run from the existing local bot Postgres admin source in `C:\Users\maxib\GTE BOT\bot\.env` without printing secrets and without touching live services.

No DB-mutating commands were run. No product code was edited. The bot `.env` was inspected only for key names and classified booleans; credential values were not printed.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/SECURITY_MODEL.md`
- `docs/DATA_MODEL.md`
- `.env.example`
- `package.json`
- `scripts/audit-append-only-role-preflight.mjs`
- `scripts/run-audit-append-only-role-managed.mjs`
- `scripts/redacted-child-process.mjs`
- `tests/integration/audit-append-only-role-preflight.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `C:\Users\maxib\GTE BOT\bot\.env` - key names/presence and shape classification only; no values printed.

## Files changed
None — read-only audit.

Handoff artifact written: `docs/handoffs/20260602-1830-ecosystem-security-auditor.md`.

## Findings
1. Severity: High. Evidence: `scripts/audit-append-only-role-preflight.mjs:10-18`, `scripts/audit-append-only-role-preflight.mjs:51-57`, `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:35-41`, `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:71`. The direct command requires `AUDIT_APPEND_ONLY_DATABASE_URL` for a restricted app role and refuses admin-looking users; current blocker docs still show the audit URL/accept vars absent. Values-hidden inspection of `C:\Users\maxib\GTE BOT\bot\.env` found Postgres source fields but no `AUDIT_APPEND_ONLY_*` variables, and classified the existing username as admin-looking, not `wtc_app_role`. Recommendation: do not run `npm run accept:audit:append-only-role` directly from the existing bot admin source. Target part: direct audit append-only role acceptance.

2. Severity: High. Evidence: `scripts/audit-append-only-role-preflight.mjs:44-49`, `scripts/audit-append-only-role-preflight.mjs:73-75`, `scripts/audit-append-only-role-preflight.mjs:136-154`, `docs/DEPLOYMENT.md:464-485`. The direct preflight is intentionally DB-mutating on success: it inserts one `system.health_check` row after privilege checks. It also defaults to `wtc_test*` targets and requires explicit non-throwaway approval for any other DB name. Values-hidden inspection classified the existing bot database name as non-throwaway. Recommendation: do not point the direct command at the existing bot database in this phase; use a throwaway DB or get explicit non-throwaway approval and accept the audit-row mutation. Target part: live-service / live-database safety boundary.

3. Severity: Medium. Evidence: `package.json:35-37`, `scripts/run-audit-append-only-role-managed.mjs:16-20`, `scripts/run-audit-append-only-role-managed.mjs:134-153`, `scripts/run-audit-append-only-role-managed.mjs:159-171`. A managed wrapper exists and is package-exposed as `npm run accept:audit:append-only-role:managed`. It is the correct path for an admin/maintenance URL because it creates a fresh `wtc_test_audit_*` DB, applies migrations, creates a temporary restricted role, grants only `SELECT`/`INSERT` on `public.audit_logs`, runs the direct preflight, then drops the DB and role. Recommendation: if the operator approves local DB create/drop and role create/drop, use the managed wrapper with an in-process `AUDIT_APPEND_ONLY_ADMIN_DATABASE_URL` built from the bot env source; do not paste or archive the URL. Target part: local throwaway audit-role acceptance.

4. Severity: Medium. Evidence: `scripts/run-audit-append-only-role-managed.mjs:123-128`, `scripts/run-audit-append-only-role-managed.mjs:135-145`, `scripts/run-audit-append-only-role-managed.mjs:147-153`, `scripts/run-audit-append-only-role-managed.mjs:159-171`. The managed wrapper is not read-only: it creates/drops a database and role, applies migrations, and runs the direct preflight that writes one audit row in the throwaway DB. Recommendation: this audit agent correctly did not run it; run it only in a mutation-approved acceptance phase, and report it as DB-mutating local throwaway acceptance. Target part: phase gating and honest RUN/NOT-RUN reporting.

5. Severity: Medium. Evidence: `scripts/audit-append-only-role-preflight.mjs:61-65`, `scripts/audit-append-only-role-preflight.mjs:162-167`, `scripts/redacted-child-process.mjs:6-24`, `scripts/redacted-child-process.mjs:44-62`, `scripts/run-audit-append-only-role-managed.mjs:49-52`, `scripts/run-audit-append-only-role-managed.mjs:87-98`. The direct script redacts Postgres URLs and `password=` parameters in failure messages and prints only role/privilege status on success; the managed wrapper sends child output through the shared redactor. Recommendation: keep URL construction in-process, avoid raw terminal buffers, and archive only the compact redacted command result. Target part: secret-output hygiene.

6. Severity: Medium. Evidence: `docs/AUDIT_LOG_SCHEMA.md:82-95`, `docs/DATA_MODEL.md:1018-1021`, `docs/DATA_MODEL.md:1358-1366`. The append-only proof is a PostgreSQL role/privilege property, not a Drizzle schema-only property. The restricted role must not own `audit_logs` and must lack elevated role attributes. Recommendation: the acceptance result is meaningful only if it connects as the restricted role that the app will actually use for the intended target. Target part: DB privilege model.

7. Severity: Low. Evidence: `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:71`, `docs/DEPLOYMENT.md:458-489`, `package.json:36-37`. Current operator docs emphasize the direct command and do not describe the package-exposed managed wrapper in the inspected audit-role deployment section. Recommendation: after the managed proof runs, update the operator blocker/status docs so the cleared evidence names the actual command used and the direct-vs-managed distinction. Target part: runbook clarity.

8. Severity: Low. Evidence: `docs/STATUS.md:3-17`, local `git status --short` result. Phase 3.60 cleared local active managed real-PG acceptance but still lists append-only audit DB-role proof as NOT RUN; this folder is still not git-backed. Recommendation: do not claim GitHub CI or production/preview append-only proof from this local audit. Target part: acceptance reporting.

## Decisions
- Direct `npm run accept:audit:append-only-role` using the existing bot `.env` admin source: NO-GO as-is.
- Local throwaway proof using the existing bot admin source through `npm run accept:audit:append-only-role:managed`: CONDITIONAL GO, only after operator approval for local Postgres DB create/drop and role create/drop, with the admin URL built in-process and never printed.
- Existing bot non-throwaway DB as the direct target: NO-GO for this read-only phase.
- No background agents were spawned by this per-agent audit; none are running.

## Risks
- If the direct command is pointed at the existing bot DB with non-throwaway approval, it will write a `system.health_check` row to that DB. That is acceptable only when the operator explicitly wants that target proved.
- If a raw admin URL is pasted into a terminal, shell history or retained buffers can contain secrets even if the scripts redact their own stdout/stderr.
- If the managed wrapper fails after DB/role creation, it attempts cleanup in `finally`, but the operator should verify cleanup from a redacted summary before calling the gate complete.
- The local managed proof would clear only local throwaway append-only role acceptance. It would not clear production/preview append-only proof unless run against the intended production/preview restricted role and approved target.

## Verification/tests
RUN in this read-only audit:
- `git status --short` - NOT GIT-BACKED (`fatal: not a git repository`).
- Values-hidden inspection of `C:\Users\maxib\GTE BOT\bot\.env` - PASS for no secret printing; observed key names only and classified host/local, DB throwaway shape, username category, and audit-env presence.
- `node --check scripts/audit-append-only-role-preflight.mjs` - PASS.
- `node --check scripts/run-audit-append-only-role-managed.mjs` - PASS.
- `npm run accept:audit:append-only-role -- --help` - PASS; help printed placeholders only.
- `npm run accept:audit:append-only-role:managed -- --help` - PASS; help printed placeholders only.

NOT RUN:
- `npm run accept:audit:append-only-role` - not run because it is DB-mutating on success and requires a restricted role URL.
- `npm run accept:audit:append-only-role:managed` - not run because it creates/drops a DB and role and applies migrations.
- Any `CREATE DATABASE`, `DROP DATABASE`, `CREATE ROLE`, `DROP ROLE`, migration, DB seed, live preview, provider call, SSH, nginx/systemd, bot service/control, deploy, GitHub CI, or production monitoring command.

## Next actions
1. For local throwaway proof, build `AUDIT_APPEND_ONLY_ADMIN_DATABASE_URL` in-process from `C:\Users\maxib\GTE BOT\bot\.env` without echoing values, then run `npm run accept:audit:append-only-role:managed` only after operator approval for local DB/role mutation.
2. Accept the gate only if the managed run exits 0, shows the generated `wtc_test_audit_*` DB was dropped, shows the temporary role was dropped, and the retained output is compact/redacted.
3. Keep direct `npm run accept:audit:append-only-role` reserved for a pre-existing restricted app-role URL, not the bot admin source.
4. After a successful acceptance run, update the aggregate phase handoff/status/blocker docs with exact gates RUN and NOT RUN, and state whether the proof was local throwaway or intended preview/production target.
