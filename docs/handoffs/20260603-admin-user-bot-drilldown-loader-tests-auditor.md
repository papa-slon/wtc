# ecosystem-tests-runner handoff
## Scope
Read-only tests-runner audit for the current `/admin/users/[userId]/bots` loader and the PGlite two-user isolation proof requested after Phase 3.70.

This audit inspected existing DB/PGlite patterns, admin/bot integration tests, schema/repository helpers, the current `loadAdminUserBotDetail()` wrapper, and the concurrent pure helper/test files that appeared in the worktree during this audit. I did not author those concurrent application/test files. No application/runtime code was edited by this audit. No live services, live migrations, worker ticks, SSH probes, bot controls, or exchange tests were run.

This is a bounded agent lane, not a broad/major phase. No multi-agent claim is made from this handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-tests-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-security-auditor.md`
- `package.json`
- `vitest.config.ts`
- `tsconfig.json`
- `tsconfig.base.json`
- `apps/web/tsconfig.json`
- `apps/web/package.json`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `packages/db/src/index.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/integration/admin-account-unlock-db.test.ts`
- `tests/integration/db-persistence.test.ts`
- `tests/integration/db-0002.test.ts`
- `tests/integration/db-real-postgres.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`

## Files changed
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-tests-auditor.md`

## Findings
1. Severity: Medium/PASS. A focused PGlite loader isolation test now exists in the worktree and passes. It uses disposable PGlite, replays sorted migrations, seeds the DB, creates user A and user B, grants different bot entitlements, creates distinct exchange metadata, creates distinct bot instances/configs/metric snapshots, and asserts user A output excludes user B ids, exchange metadata, raw config sentinels, and newer metric snapshot values. Evidence: `tests/integration/admin-user-bot-detail-loader.test.ts:43-147`, `tests/integration/admin-user-bot-detail-loader.test.ts:150-219`; observed command `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts` passed 2 files and 5 tests. Recommendation: keep this test as the baseline row-level isolation gate. Target part: loader acceptance.

2. Severity: High/GAP. The current green PGlite test proves current config-row isolation (`bot_configs.version`) but does not prove safe `bot_config_versions` history exposure. The helper still does not query `schema.botConfigVersions`, the static test still forbids it, and the PGlite table-count read-only check does not include `bot_config_versions`. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:169-177`, `tests/integration/admin-user-bot-detail-static.test.ts:29-32`, `tests/integration/admin-user-bot-detail-loader.test.ts:26-40`. Recommendation: if the acceptance wording means actual version-history rows, add a safe DTO summary from `bot_config_versions` and extend the PGlite test to seed/assert A-only history while forbidding `configJson`. If the product only needs current config version, record the gate as "current config row isolation", not "config version history isolation". Target part: loader DTO, static test, PGlite test.

3. Severity: Medium/PASS. The current helper shape avoids the main `server-only`/`getServerDb()` harness trap by moving DB logic into `loadAdminUserBotDetailFromDb(db, userId)` and leaving `loadAdminUserBotDetail()` as a thin server-only wrapper. Evidence: `apps/web/src/features/admin/queries.ts:1-21`, `apps/web/src/features/admin/queries.ts:171-176`, `apps/web/src/features/admin/user-bot-detail-loader.ts:111-244`, `tests/integration/admin-user-bot-detail-loader.test.ts:17`. Recommendation: keep DB query logic in the pure helper and test that helper directly; do not set `DATABASE_URL` in Vitest just to reach the wrapper. Target part: test harness.

4. Severity: Medium/PASS. The helper now performs an explicit target-user SELECT and roles SELECT, omitting `passwordHash`, instead of using `listUsersWithCreatedAt()` to load all users/password hashes for a single drilldown target. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:111-137`, `apps/web/src/features/admin/user-bot-detail-loader.ts:197-200`, `tests/integration/admin-user-bot-detail-static.test.ts:27-32`. Recommendation: keep this selected-column target-user lookup; leave `listUsersWithCreatedAt()` to the broader user directory loader only. Target part: admin user bot helper.

5. Severity: Medium/GAP. The current PGlite fixture proves safe exchange account metadata scoping but does not seed `exchange_api_key_secrets` rows. Static coverage forbids joining `exchangeApiKeySecrets`, and JSON assertions forbid `sealed`, `apiSecret`, and `apiKey`, but a stronger fixture would create secret rows for both users and assert row counts remain unchanged. Evidence: `tests/integration/admin-user-bot-detail-loader.test.ts:72-93`, `tests/integration/admin-user-bot-detail-loader.test.ts:198-218`, `tests/integration/admin-user-bot-detail-static.test.ts:29`. Recommendation: add seeded `exchange_api_key_secrets` rows for both exchanges and include that table in `tableCounts()`. Target part: loader PGlite test hardening.

6. Severity: Medium/PASS. The metric leak test is shaped correctly: user B has a newer snapshot than user A, so a mistaken product/global latest query would leak B data and fail. Evidence: `tests/integration/admin-user-bot-detail-loader.test.ts:119-146`, `tests/integration/admin-user-bot-detail-loader.test.ts:181-185`, `tests/integration/admin-user-bot-detail-loader.test.ts:205-206`. Recommendation: keep B's snapshot newer than A's latest in future refactors. Target part: loader metric scoping.

7. Severity: Low/GAP. The read-only proof compares row counts for audits, current configs, metric snapshots, bot instances, and exchange accounts, but not config history or exchange secret tables. Evidence: `tests/integration/admin-user-bot-detail-loader.test.ts:26-40`, `tests/integration/admin-user-bot-detail-loader.test.ts:151-155`. Recommendation: add `bot_config_versions` and `exchange_api_key_secrets` to `tableCounts()` if those tables are seeded for the stronger acceptance gate. Target part: loader PGlite test.

## Decisions
1. The safest exact shape is now the implemented pure-helper pattern: test `loadAdminUserBotDetailFromDb(db, userId)` with disposable PGlite, while `loadAdminUserBotDetail()` remains a thin `getServerDb()` wrapper for Next server components.

2. The current green PGlite test is acceptable for these current DTO facts:
   - user A cannot see user B entitlement state through the two bot rows;
   - user A cannot see user B exchange account metadata;
   - user A cannot see user B current config/raw config sentinel;
   - user A cannot see user B metric snapshot, even when B's snapshot is newer;
   - unknown target user fails closed with no bot rows;
   - the helper is read-only for the currently counted tables.

3. The current green PGlite test is not a complete proof for these stricter facts:
   - actual `bot_config_versions` history isolation;
   - absence of mutation/reads against seeded exchange secret rows;
   - read-only row counts for `bot_config_versions` and `exchange_api_key_secrets`.

4. If config history is intentionally out of scope, keep the static assertion `not.toContain('schema.botConfigVersions')` and phrase acceptance as "current config version isolation". If config history is in scope, update DTO/tests to allow only safe version summary fields and forbid `configJson`.

5. Do not set `DATABASE_URL` for this PGlite test. Do not run repo `db:migrate`/`db:seed`; replay migrations only inside the disposable PGlite instance.

## Risks
1. Calling the server-only wrapper directly remains brittle in root Vitest because `queries.ts` imports `server-only` and `@/lib/backend`; the pure helper avoids that.

2. If a future refactor moves logic back into `queries.ts` behind `getServerDb()`, the PGlite test may need aliases/mocks or will stop importing cleanly.

3. The phrase "bot config versions" is easy to overclaim. Current code returns one current `configVersion`; it does not expose version history.

4. The current fixture does not create sealed exchange secret rows, so it proves non-leakage by source/static guard and output JSON, not by seeded secret-table presence.

5. Numeric columns from PGlite/Drizzle return strings; keep metric assertions as strings.

6. `saveBotConfig()` writes `bot_configs` and `bot_config_versions`, but the current result only exposes `bot_configs.version`; do not infer tested history exposure from that mutation helper alone.

## Verification/tests
RUN in this audit:
1. `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with pre-existing dirty admin/bot/settings/test/handoff files. Later concurrent untracked files appeared, including `apps/web/src/features/admin/user-bot-detail-loader.ts` and `tests/integration/admin-user-bot-detail-loader.test.ts`; I did not author them.
2. `Test-Path docs/handoffs/20260603-admin-user-bot-drilldown-loader-tests-auditor.md` - returned `False` before writing this handoff.
3. `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts` - initially passed, 1 file and 3 tests.
4. `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts` - passed, 2 files and 5 tests.
5. `npx secretlint "docs/handoffs/20260603-admin-user-bot-drilldown-loader-tests-auditor.md"` - passed.
6. Read-only source inspection of the files listed above.

NOT RUN in this audit:
1. Full config-version-history PGlite proof - not run because current DTO/static test intentionally do not expose `schema.botConfigVersions`.
2. Exchange-secret seeded PGlite proof - not run because current fixture does not seed `exchange_api_key_secrets`.
3. `npm run db:migrate`, `npm run db:seed`, managed DB e2e, real Postgres acceptance, or migration against `DATABASE_URL` - not run by scope.
4. Worker commands, worker smoke, live bot control, live exchange key test, SSH/systemd/live canary probes - not run by policy.
5. Playwright e2e - not run because this handoff targets the DB loader proof, and default e2e mode cannot prove PGlite row isolation.
6. Full gates such as `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, or `npm run ci:local` - not run because this was a bounded read-only audit/handoff lane.

Safe focused commands:
1. Already green here: `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts`
2. Next focused test sweep: `npx vitest run tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/db-0002.test.ts`
3. Admin safety sweep: `npx vitest run tests/integration/admin-responsive.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-health-detail.test.ts`
4. After any code/test edits: `npm run typecheck`
5. After any code/test edits: `npm run typecheck -w @wtc/web`
6. After any code/test edits: `npm run lint`
7. After any code/test edits: `npm run secret:scan`
8. After any code/test edits: `npm run build -w @wtc/web`

Commands that should remain out of this bounded loader lane:
1. `npm run db:migrate`
2. `npm run db:seed`
3. `npm run worker:smoke`
4. `npm run worker:tick`
5. `npm run dev:worker`
6. `npm run accept:real-pg:managed`
7. Any SSH/systemd/live service probe
8. Any live bot start/stop/restart/apply-config/retest or live exchange ping

## Next actions
1. Decide and document whether "bot config versions" means current `bot_configs.version` only or actual `bot_config_versions` history.
2. If actual history is required, add a safe history summary DTO, update the static guard, and extend the PGlite test to seed/assert A-only version history while forbidding `configJson`.
3. Add seeded `exchange_api_key_secrets` rows and include both `exchange_api_key_secrets` and `bot_config_versions` in the loader test's read-only row-count check.
4. Run the focused commands listed above and record exact green/not-run gates in the next aggregate handoff.
