# ecosystem-devops-implementer handoff
## Scope
Read-only DB/devops audit after Phase 3.60 for the append-only `audit_logs` DB-role proof. Scope included confirming the direct preflight, managed throwaway DB/temporary restricted-role path, deployment docs, package scripts, schema/migrations, and current blocker truth. The adjacent bot Postgres source at `C:\Users\maxib\GTE BOT\bot\.env` was inspected by key name and with one SELECT-only connection probe; credential values were not printed, persisted, or copied.

Out of scope and not run: DB mutation, service start/stop, preview/e2e, provider calls, SSH/nginx/systemd, bot service control, deploy, GitHub CI, and product-code edits.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_60_20260602.md`
- `docs/handoffs/20260602-1802-phase-3-60-existing-bot-real-pg-managed-acceptance.md`
- `docs/handoffs/20260602-1225-phase-3-49-audit-append-only-role-preflight.md`
- `docs/DEPLOYMENT.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `.env.example`
- `package.json`
- `packages/db/package.json`
- `packages/db/drizzle.config.ts`
- `packages/db/src/schema.ts`
- `packages/db/migrations/0000_broken_jack_murdock.sql`
- `packages/db/migrations/0003_fresh_blockbuster.sql`
- `scripts/audit-append-only-role-preflight.mjs`
- `scripts/run-audit-append-only-role-managed.mjs`
- `scripts/run-real-pg-harness-managed.mjs`
- `tests/integration/audit-append-only-role-preflight.test.ts`
- `C:\Users\maxib\GTE BOT\bot\.env` key names/status only; values not printed

## Files changed
None - read-only audit. Required handoff written: `docs/handoffs/20260602-1831-ecosystem-devops-implementer.md`.

## Findings
1. Severity: High. Evidence: `package.json:36`, `package.json:37`, `scripts/run-audit-append-only-role-managed.mjs:16`, `scripts/run-audit-append-only-role-managed.mjs:18`, `scripts/run-audit-append-only-role-managed.mjs:19`, `scripts/run-audit-append-only-role-managed.mjs:135`, `scripts/run-audit-append-only-role-managed.mjs:143`, `scripts/run-audit-append-only-role-managed.mjs:147`, `scripts/run-audit-append-only-role-managed.mjs:150`, `scripts/run-audit-append-only-role-managed.mjs:153`. The repo now has a managed local acceptance path that creates a fresh `wtc_test_audit_*` DB, applies migrations, creates a temporary restricted role, grants only `SELECT`/`INSERT` on `public.audit_logs`, and runs the existing direct preflight. Recommendation: use this managed command only with explicit operator approval because it mutates Postgres; retain redacted summary output only. Target part: local throwaway audit-role acceptance.
2. Severity: High. Evidence: `scripts/audit-append-only-role-preflight.mjs:10`, `scripts/audit-append-only-role-preflight.mjs:12`, `scripts/audit-append-only-role-preflight.mjs:18`, `scripts/audit-append-only-role-preflight.mjs:21`, `scripts/audit-append-only-role-preflight.mjs:73`, `scripts/audit-append-only-role-preflight.mjs:74`, `scripts/audit-append-only-role-preflight.mjs:136`, `scripts/audit-append-only-role-preflight.mjs:138`, `scripts/audit-append-only-role-preflight.mjs:162`, `docs/DEPLOYMENT.md:488`, `docs/DEPLOYMENT.md:489`. The direct preflight is not read-only: it requires explicit accept and writes one `system.health_check` row after privilege checks. Recommendation: keep `npm run accept:audit:append-only-role` as NOT RUN until the intended restricted URL and consent are supplied and the command passes in the current session. Target part: production/preview append-only DB-role proof.
3. Severity: High. Evidence: `scripts/run-audit-append-only-role-managed.mjs:26`, `scripts/run-audit-append-only-role-managed.mjs:29`, `scripts/run-audit-append-only-role-managed.mjs:30`, `scripts/run-audit-append-only-role-managed.mjs:42`, `scripts/run-audit-append-only-role-managed.mjs:44`, `scripts/run-audit-append-only-role-managed.mjs:159`, `scripts/run-audit-append-only-role-managed.mjs:161`, `scripts/run-audit-append-only-role-managed.mjs:168`, `scripts/run-audit-append-only-role-managed.mjs:170`. The managed path requires an admin URL that can create/drop both databases and roles, and cleanup is best-effort in `finally`. The value-hidden SELECT-only bot Postgres probe succeeded and showed the bot source role is powerful enough, but no create/drop command was run. Recommendation: run only against a generated `wtc_test_audit_*` target, with an orphan cleanup check if the process is interrupted. Target part: operational safety.
4. Severity: Medium. Evidence: `scripts/run-audit-append-only-role-managed.mjs:59`, `scripts/run-audit-append-only-role-managed.mjs:61`, `scripts/run-audit-append-only-role-managed.mjs:87`, `scripts/run-audit-append-only-role-managed.mjs:94`, `docs/DEPLOYMENT.md:481`, `docs/DEPLOYMENT.md:488`, `docs/DEPLOYMENT.md:489`. The managed helper proves a generated temporary restricted role, not the real production/preview `wtc_app_role`, because it generates a suffixed role name and passes that expected role to the direct preflight. Recommendation: treat the managed proof as local throwaway permission acceptance; still require the direct proof against the intended production/preview app role before calling production append-only role acceptance green. Target part: evidence semantics.
5. Severity: Medium. Evidence: `packages/db/src/schema.ts:339`, `packages/db/src/schema.ts:340`, `packages/db/src/schema.ts:356`, `packages/db/src/schema.ts:360`, `packages/db/migrations/0000_broken_jack_murdock.sql:1`, `packages/db/migrations/0000_broken_jack_murdock.sql:15`, `packages/db/migrations/0000_broken_jack_murdock.sql:208`, `packages/db/migrations/0000_broken_jack_murdock.sql:209`, `docs/AUDIT_LOG_SCHEMA.md:84`, `docs/AUDIT_LOG_SCHEMA.md:87`. Drizzle schema/migrations create and index `audit_logs`, but role revoke/grant enforcement is an operator/runbook layer, not a committed migration. Recommendation: do not assume migrations alone enforce append-only behavior; acceptance must exercise role privileges. Target part: DB role setup.
6. Severity: Medium. Evidence: `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:71`, `docs/DEPLOYMENT.md:467`, `docs/DEPLOYMENT.md:471`, `package.json:37`. Current blocker/deployment docs still center the direct restricted-role command and do not document the newly exposed managed throwaway command. Recommendation: after the next approved run, update blocker/runbook docs to distinguish `accept:audit:append-only-role:managed` local throwaway proof from direct intended-role proof. Target part: docs truth.

## Decisions
- Did not run `npm run accept:audit:append-only-role` because it writes an audit row.
- Did not run `npm run accept:audit:append-only-role:managed` because it creates/drops a database and role, applies migrations, and writes an audit row.
- Did run syntax/help checks for the managed helper because they do not connect to or mutate a database.
- Did run one SELECT-only connection probe using the adjacent bot Postgres source, with values hidden, to confirm operational feasibility.
- No background agents were spawned in this narrow single-agent audit; none were left running.
- No product code was edited; only this required handoff was written.

## Risks
- The adjacent bot Postgres source is high-blast-radius: the read-only probe reported superuser, CREATEDB, CREATEROLE, REPLICATION, and BYPASSRLS capability. It must be used only in-process and never printed or archived.
- The managed helper mutates the Postgres cluster even though the target DB and role are temporary. A hard kill could leave an orphan `wtc_test_audit_*` database or `wtc_app_role_*` role requiring manual cleanup.
- The managed helper applies all migration SQL through `sql.unsafe()` in a fresh generated DB. That is acceptable for repo-owned migration files in a disposable target, not for arbitrary SQL or a live DB.
- A passing managed throwaway proof does not prove the actual production/preview app role unless the direct intended-role preflight is also run against that target.

## Verification/tests
| Gate | Command/check | Result |
|---|---|---|
| Required protocol/docs read | Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, seed, current status/blockers, Phase 3.60 handoff, deployment docs | PASS |
| Git root truth | `git rev-parse --show-toplevel` | NOT GIT-BACKED |
| Current audit env presence | Checked `AUDIT_APPEND_ONLY_*`, `REAL_POSTGRES_*` variable names only | all checked vars NOT_SET |
| Adjacent bot env key inspection | Parsed `C:\Users\maxib\GTE BOT\bot\.env` key names only | PRESENT; Postgres construction keys include `DATABASE`, `HOST`, `USERNAME_PG`, `PASSWORD`; values not printed |
| Bot Postgres SELECT-only feasibility probe | Connected with bot source and queried role attributes only | PASS; role is powerful enough for managed DB/role proof; canonical `wtc_app_role` not present in that cluster query |
| Managed helper syntax | `node --check scripts/run-audit-append-only-role-managed.mjs` | PASS |
| Managed helper help | `npm run accept:audit:append-only-role:managed -- --help` | PASS; no DB connection |
| Direct audit-role acceptance | `npm run accept:audit:append-only-role` | NOT RUN; mutates DB by writing one audit row |
| Managed audit-role acceptance | `npm run accept:audit:append-only-role:managed` | NOT RUN; creates/drops DB and role, applies migrations, writes one audit row |
| Other gates | preview/e2e/provider/SSH/deploy/CI/bot control | NOT RUN; out of scope |

## Next actions
1. If the operator approves a local throwaway proof, build `AUDIT_APPEND_ONLY_ADMIN_DATABASE_URL` in-process from `C:\Users\maxib\GTE BOT\bot\.env` using `HOST`, `DATABASE`, `USERNAME_PG`, and `PASSWORD` with default port `5432` unless the host value includes a port. Do not print, persist, screenshot, or archive the URL.
2. Run from `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`:

```powershell
npm run accept:audit:append-only-role:managed
```

Expected behavior: create `wtc_test_audit_<timestamp>_<hex>`, apply repo migrations, create temporary `wtc_app_role_<timestamp>_<hex>`, grant only `CONNECT`/schema usage plus `SELECT, INSERT` on `public.audit_logs`, run the direct preflight, then drop the database and temporary role.

3. After any managed run, perform a value-hidden orphan check for `wtc_test_audit_%` databases and `wtc_app_role_%` roles if the process errors or is interrupted.
4. For production/preview acceptance, run the direct command only against the intended restricted app role/database:

```powershell
$env:AUDIT_APPEND_ONLY_DATABASE_URL = "postgres://wtc_app_role:<password>@<host>:<port>/<intended-db>"
$env:AUDIT_APPEND_ONLY_EXPECTED_ROLE = "wtc_app_role"
$env:AUDIT_APPEND_ONLY_PREFLIGHT_ACCEPT = "1"
# set AUDIT_APPEND_ONLY_PREFLIGHT_NON_THROWAWAY_APPROVED=1 only for an explicitly approved non-throwaway target
npm run accept:audit:append-only-role
```

Do not report production/preview append-only role acceptance as RUN until that direct command passes against the intended target in the current session.
