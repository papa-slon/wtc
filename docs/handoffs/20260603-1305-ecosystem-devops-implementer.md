# ecosystem-devops-implementer handoff
## Scope
Phase 3.68 Legacy Live production-slice devops audit in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Task: inspect deployment docs, scripts, env examples, current Legacy adapter wiring, and read-only server inventory to identify the canary/production steps needed to enable Legacy live-read on the existing server without stopping or restarting `turtle-bot.service` or `turtle-journal.service`.

Constraints observed: read-only for product/runtime code and live server; no service stop/restart; no bot endpoint mutation; no secret values printed; only allowed repository write is this handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `.env.example`
- `package.json`
- `docs/DEPLOYMENT.md`
- `docs/STATUS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md`
- `docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md`
- `docs/handoffs/20260603-1147-phase-3-66-bot-analytics-settings-richness.md`
- `docs/handoffs/20260603-1147-ecosystem-legacy-settings-auditor.md`
- `docs/handoffs/20260603-1147-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260603-1225-ecosystem-devops-implementer.md`
- `docs/handoffs/20260603-1225-phase-3-67-bot-analytics-settings-canary-deploy.md`
- `scripts/safe-preview.mjs`
- `scripts/safe-worker-tick.mjs`
- `apps/worker/package.json`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/tick-once.ts`
- `apps/worker/src/legacy-live.ts` (unowned worktree file present during final verification)
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/journal.ts`
- `docs/handoffs/20260603-1305-ecosystem-bot-integration-auditor.md` (unowned handoff present during final verification)
- `docs/handoffs/20260603-1305-ecosystem-security-auditor.md` (unowned handoff present during final verification)
- Read-only SSH inventory on the operator-provided server: service active states, WTC Docker containers, WTC release mounts, listener shape, and selected non-secret canary flags. No secrets were printed.

## Files changed
None - read-only audit. This file is the required per-agent handoff artifact.

## Findings
1. Severity: Critical. The deployed canary cannot enable Legacy live-read by env/deploy steps alone; the base adapter remains intentionally blocked. Evidence: `packages/bot-adapters/src/factory.ts:32-38` routes every non-mock Legacy request to `createLegacyBlockedAdapter()`, explicitly ignores `legacyBaseUrl`, and states there is no live data path in any mode; `docs/CONTRACTS/legacy-bot-adapter.md:391-397` says staging/production `read-only` still use the blocked adapter and there is no configuration path to reach the Legacy bot. During final verification, unowned worktree changes added `apps/worker/src/legacy-live.ts` and wired `snapshotLegacyBotPostgres()` into `apps/worker/src/index.ts`; that is a draft WTC worker DB-read path, not a deployed release and not an adapter/web activation. Recommendation: do not flip or rely on `LEGACY_BOT_BASE_URL` as an activation mechanism; treat any enablement as a new WTC worker release gated by bot-integration/security/tests. Target part: adapter and worker activation.
2. Severity: Critical. The upstream Legacy API is still blocked by plaintext exchange-key exposure. Evidence: `docs/CONTRACTS/legacy-bot-adapter.md:49` says no service account exists; `docs/CONTRACTS/legacy-bot-adapter.md:352-382` documents plaintext `api_key` / `secret_key` exposure and says it must be resolved before production `BOT_ADAPTER_MODE=read-only`; `docs/PRODUCTION_BLOCKERS_CURRENT.md:12-13` and `docs/PRODUCTION_BLOCKERS_CURRENT.md:100` keep Legacy live adapter blocked. Recommendation: production live-read requires an upstream key-safe read endpoint or confirmed key removal, a dedicated read-only service account, WTC vault storage, redaction tests, and written security acceptance. Target part: Legacy provider boundary.
3. Severity: High. The current server canary already runs non-mock WTC mode, but that does not activate Legacy. Evidence: read-only server inventory observed selected canary flags `NODE_ENV=production`, `APP_ENV=staging`, `BOT_ADAPTER_MODE=read-only`, `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`, and `AXIOMA_ROUTE_SKELETON_ENABLED=false`; Phase 3.67 also records `BOT_ADAPTER_MODE=read-only` with Legacy still reference/export-only at `docs/handoffs/20260603-1225-phase-3-67-bot-analytics-settings-canary-deploy.md:59-60`. Recommendation: treat current `BOT_ADAPTER_MODE=read-only` as Tortila canary mode only until Legacy code/security blockers are cleared. Target part: environment truth.
4. Severity: High. The existing server boundary can support a WTC-only canary without taking down the two bot services. Evidence: read-only SSH inventory observed `nginx`, `postgresql`, `turtle-bot.service`, `turtle-journal.service`, and `wtc-bot-api-firewall.service` active; WTC containers `wtc-ecosystem-canary`, `wtc-ecosystem-worker`, and `wtc-ecosystem-preview` running; canary mount `/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260603-1246-8075523-bot-analytics:/app`; worker mount `/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260602-1816-4487b3d:/app`; preview mount `/home/ubuntu/apps/wtc_ecosystem_platform:/app`. Prior evidence at `docs/handoffs/20260603-1225-phase-3-67-bot-analytics-settings-canary-deploy.md:51-53` says the same services stayed active after a WTC-only deploy. Recommendation: future Legacy live-read canary should replace only WTC canary/worker containers, never bot systemd services. Target part: deployment boundary.
5. Severity: High. Bot API public exposure remains firewall-dependent. Evidence: read-only SSH listener inventory observed Legacy on `0.0.0.0:8000`, Tortila journal on `0.0.0.0:8080`, Axioma/journal server on `127.0.0.1:8123`, WTC canary/preview on `127.0.0.1:8301/8300`, and public web on `80/443`; Phase 3.64 added `wtc-bot-api-firewall.service` to drop non-loopback inbound `8000/8080` at `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:41`. Recommendation: every canary/prod step must verify firewall active state and external denial for `8000/8080`; do not open bot ports to make WTC reads work. Target part: network boundary.
6. Severity: High. The unowned draft worker path changes the likely deployment shape from HTTP `LEGACY_BOT_BASE_URL` to direct restricted Legacy Postgres reads, but it is not accepted or deployed. Evidence: `apps/worker/src/legacy-live.ts:299-337` gates on `LEGACY_LIVE_READS_ENABLED`, `LEGACY_DATABASE_URL`, `SYSTEM_LEGACY_BOT_INSTANCE_ID` or `SYSTEM_LEGACY_BOT_OWNER_ID` / `SYSTEM_BOT_OWNER_ID`, and optional `LEGACY_API_ID`; `apps/worker/src/legacy-live.ts:243-289` selects only named non-secret columns from `api_keys`, `symbolsettings`, `stageconfigs`, `slots`, and `orders`; `apps/worker/src/legacy-live.ts:120-127` rejects selected secret-hint field names. Recommendation: if main operator accepts this path, provision a restricted read-only DB role with column/table grants limited to those selected safe fields, keep `LEGACY_DATABASE_URL` secret, and deploy only the WTC worker/canary release after tests pass. Target part: Legacy DB-read canary.
7. Severity: Medium. The repo has no live deploy script for this switch; current deploy mechanics are documented/manual. Evidence: `scripts/safe-preview.mjs:3-12` and `scripts/safe-worker-tick.mjs:3-15` force local developer `BOT_ADAPTER_MODE=mock`; prior phases used timestamped server releases and Docker containers (`docs/handoffs/20260603-1225-phase-3-67-bot-analytics-settings-canary-deploy.md:35-40`, `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:34-44`). Recommendation: main operator should use the existing timestamped-release Docker canary procedure, not local safe-preview scripts, for any approved server activation. Target part: deploy tooling.
8. Severity: Medium. The unowned worker diff is not yet deploy-ready evidence. Evidence: `apps/worker/package.json` now declares `postgres`, but this audit did not verify lockfile/package-install consistency; `apps/worker/src/tick-once.ts` changed the worker tick log call and should be reviewed/tested before deploy. Recommendation: run focused worker tests, full local gates, `secret:scan`, and package/install checks on the reconciled worktree before building a server release. Target part: release readiness.

## Decisions
- Do not recommend any immediate Legacy live-read activation on the current server. The correct current operational step is to keep Legacy blocked/reference-only.
- Treat the unowned `legacy-live.ts` worker implementation as draft local evidence only. It may define the future canary path, but it is not deployed, tested, or accepted by this devops lane.
- Treat Phase 3.64/3.67 as the deployment pattern: timestamped WTC release, canary on `127.0.0.1:8301`, rollback preview on `127.0.0.1:8300`, WTC nginx route preserved or switched only by explicit operator approval.
- Treat Phase 3.65 as the data-path pattern: real bot reads should flow through WTC worker -> WTC Postgres snapshots/imports -> WTC web/admin UI, not direct user-page calls.
- Keep `FEATURE_LIVE_BOT_CONTROL=false` for both canary and production. Legacy live-read must not imply start/stop/apply-config.
- Keep `FEATURE_TV_AUTOMATION=false` and `AXIOMA_ROUTE_SKELETON_ENABLED=false` unless a separate approved phase changes those scopes.
- Do not store Legacy service account credentials, JWTs, or DB passwords in durable docs. If the direct Legacy DB-read path is accepted, `LEGACY_DATABASE_URL` is a secret and must use a restricted read-only role, not an admin or broad app role.
- Do not use `BOT_ADAPTER_MODE=mock` as the preferred rollback for Legacy-only trouble, because it would also degrade the accepted Tortila read-only canary. Prefer prior WTC release rollback unless the operator accepts disabling all real bot read mode.

## Risks
- Enabling a real Legacy adapter before the upstream plaintext-key issue is fixed can expose exchange credentials through WTC logs, DB, screenshots, or responses.
- Current `LEGACY_BOT_BASE_URL=http://127.0.0.1:8000` is a non-secret URL, but in current code it is intentionally ignored for Legacy non-mock modes; treating it as an activation switch is a false positive.
- The draft direct-DB worker path can reduce HTTP plaintext-response risk, but it creates a new credential boundary: `LEGACY_DATABASE_URL` can expose provider DB data if the role is over-privileged or logs leak the URL.
- Any direct web-render Legacy fetch would repeat the early Tortila canary risk rejected in Phase 3.65: user pages could hit live bot APIs directly instead of reading durable WTC snapshots.
- Because Legacy and Tortila share the single `BOT_ADAPTER_MODE`, a broad env rollback to `mock` would disable Tortila real read-only visibility too.
- Bot ports bind broadly on the host; `wtc-bot-api-firewall.service` is therefore a production safety dependency.
- If a future Legacy worker path requires schema changes, rollback may require prior WTC build plus DB backup/restore planning, not just container replacement.

## Verification/tests
RUN in this read-only audit:
- `git status --short --branch` - initial branch state showed `codex/bot-analytics-settings-canary-20260603` with no dirty entries; final verification showed unowned Phase 3.68 worker/code handoffs and this handoff present. Unowned changes were inspected where relevant and were not reverted.
- Repo searches over deployment docs, env example, scripts, Legacy contracts, adapter code, worker code, recent phase handoffs, status, blockers, and acceptance matrix.
- Read-only SSH inventory:
  - active-state checks for `nginx`, `postgresql`, `turtle-bot.service`, `turtle-journal.service`, and `wtc-bot-api-firewall.service`;
  - WTC container inventory for `wtc-ecosystem-canary`, `wtc-ecosystem-worker`, and `wtc-ecosystem-preview`;
  - Docker mount inspection for WTC release paths;
  - listener inventory for `80`, `443`, `8000`, `8080`, `8123`, `8300`, and `8301`;
  - selected non-secret canary flags only.
- No secret values were printed or retained.

NOT RUN in this read-only audit:
- Local tests, build, lint, typecheck, Playwright, `secret:scan`, or GitHub CI.
- DB queries, migrations, seeds, backups, restores, or schema inspection on the live server.
- Legacy `/api_management/*`, Tortila journal, Axioma, Stripe, LMS provider, or exchange endpoint calls.
- Docker container replacement, nginx reload/edit, `.env` edit, systemd control, tmux control, process restart, or deployment.
- Any live bot start/stop/apply-config path.

Verification commands for the main operator after a code/security-approved Legacy live-read implementation exists:

```bash
# Preflight: read-only service/container/network inventory. Do not restart anything.
ssh -i "<operator-key>" ubuntu@<server> 'for s in nginx postgresql turtle-bot.service turtle-journal.service wtc-bot-api-firewall.service; do printf "%s=" "$s"; systemctl is-active "$s"; done'
ssh -i "<operator-key>" ubuntu@<server> 'docker ps --filter name=wtc-ecosystem --format "{{.Names}}|{{.Status}}|{{.Ports}}"'
ssh -i "<operator-key>" ubuntu@<server> 'ss -ltnp | grep -E "(^State|:(80|443|8000|8080|8123|8300|8301)\>)"'

# Local/repo gates on the exact activation commit.
git status --short --branch
npm run ci:local
npm test -- tests/integration/bot-read-safety-static.test.ts tests/integration/bot-statistics-static.test.ts
npm run secret:scan

# Canary env truth: print only selected non-secret values and set/unset for secrets.
ssh -i "<operator-key>" ubuntu@<server> 'docker exec wtc-ecosystem-canary sh -lc '"'"'for k in NODE_ENV APP_ENV BOT_ADAPTER_MODE FEATURE_LIVE_BOT_CONTROL FEATURE_TV_AUTOMATION AXIOMA_ROUTE_SKELETON_ENABLED; do printenv "$k"; done'"'"''
```

Exact non-secret env/URL shape likely needed after prerequisites clear:

```text
NODE_ENV=production
APP_ENV=staging                  # canary; production only after canary/burn-in acceptance
BOT_ADAPTER_MODE=read-only
FEATURE_LIVE_BOT_CONTROL=false
FEATURE_TV_AUTOMATION=false
AXIOMA_ROUTE_SKELETON_ENABLED=false
LEGACY_BOT_BASE_URL=http://127.0.0.1:8000
TORTILA_JOURNAL_URL=http://127.0.0.1:8080
TORTILA_JOURNAL_BASE_URL=http://127.0.0.1:8080
APP_BASE_URL=https://<approved-wtc-canary-or-prod-host>
LEGACY_LIVE_READS_ENABLED=true    # only after the worker DB-read path is accepted
```

Secrets that must be present but never printed:

```text
DATABASE_URL
SESSION_SECRET
SECRET_VAULT_KEK
SECRET_VAULT_KEY_ID
JOURNAL_READ_TOKEN               # existing Tortila read-only canary dependency
LEGACY_DATABASE_URL               # restricted read-only Legacy DB role; never admin/broad grants
SYSTEM_LEGACY_BOT_OWNER_ID        # or SYSTEM_BOT_OWNER_ID; UUID value is not a public artifact
SYSTEM_LEGACY_BOT_INSTANCE_ID     # optional if pre-provisioned; UUID value is not a public artifact
LEGACY_API_ID                     # optional scope limiter; UUID value is not a public artifact
legacy_bot_service_account       # only if HTTP adapter path is later used; vault secret type per contract
```

Canary steps needed after prerequisites clear:
1. Choose and document the accepted read path. Current local draft points to direct Legacy Postgres reads via `LEGACY_DATABASE_URL`; HTTP `LEGACY_BOT_BASE_URL` remains blocked unless a separate key-safe HTTP adapter is implemented.
2. For the direct DB path, create or verify a restricted read-only Legacy DB role that can select only the required safe columns and cannot select exchange-key columns, mutate data, create/drop objects, or bypass row/column restrictions.
3. Confirm upstream active runtime/source drift is resolved: direct DB snapshots must not copy secret columns, and any retained proof must not include DB URLs, account secrets, JWTs, or exchange key values.
4. Confirm WTC worker has the accepted Legacy DB snapshot/import path, no live control path, redacted operational errors, focused tests, and no direct web-render Legacy live reads.
5. Build a timestamped WTC release under `/home/ubuntu/apps/wtc_ecosystem_platform_releases/<timestamp>-<commit>-legacy-live-read`.
6. Preserve server secrets and `.env` values without printing them; update only approved non-secret flags/URLs plus secret presence for `LEGACY_DATABASE_URL` and system Legacy owner/instance identifiers through the operator's secure server process.
7. Run a one-shot WTC build/smoke container on an unused localhost port; smoke public Legacy pages and auth redirects without touching bot services.
8. Replace only `wtc-ecosystem-canary` on `127.0.0.1:8301`. If worker code changed, replace only `wtc-ecosystem-worker` in a separate WTC container step. Do not stop/restart `turtle-bot.service` or `turtle-journal.service`.
9. Verify canary pages, WTC DB snapshot freshness/counts, firewall active state, external denial for `8000/8080`, and absence of live control UI.
10. Keep the previous WTC release and `wtc-ecosystem-preview` as rollback until operator signs off.

Production steps needed after canary acceptance:
1. Require canary burn-in and monitoring acceptance for Legacy snapshot freshness, worker health, firewall state, and no secret leakage in retained artifacts.
2. If schema changed, take a `pg_dump` backup before production migration as required by `docs/DEPLOYMENT.md:502-505`; prefer additive/backward-compatible migrations.
3. Promote the accepted WTC release and set `APP_ENV=production` plus the approved production `APP_BASE_URL`.
4. Keep `FEATURE_LIVE_BOT_CONTROL=false`; production live-read is still read-only.
5. Repeat service/container/listener/firewall verification and browser/DB acceptance after promotion.

Rollback plan:
1. Preferred rollback: redeploy the previous WTC canary release or route back to `wtc-ecosystem-preview` on `127.0.0.1:8300`; leave bot services running.
2. If worker was updated, roll back only `wtc-ecosystem-worker` to the previous release after preserving count-only health evidence.
3. If a migration was applied and the prior release cannot run against the new schema, restore from the pre-migration `pg_dump` under explicit operator approval.
4. Do not roll back by restarting `turtle-bot.service`, `turtle-journal.service`, tmux bot sessions, or changing bot configs.
5. Keep `wtc-bot-api-firewall.service` active throughout rollback; never open `8000/8080` publicly.
6. Avoid `BOT_ADAPTER_MODE=mock` as the first rollback lever unless the operator accepts disabling Tortila real read-only data too.

## Next actions
1. Main operator should treat Phase 3.68 Legacy live-read activation as blocked for deployment until the unowned worker implementation and the bot-integration/security gates are reconciled and tested.
2. Decide whether the accepted Legacy path is the current direct DB-read worker draft or a future key-safe HTTP adapter; do not mix both in one deploy.
3. After the accepted implementation exists, run the canary steps above as a WTC-only deploy, replacing only WTC containers and preserving `turtle-bot.service` / `turtle-journal.service`.
4. Write the aggregate Phase 3.68 handoff with exact gates RUN and NOT RUN; do not claim Legacy live-read green from this devops audit alone.
