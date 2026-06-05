# ecosystem-security-auditor handoff
## Scope
Read-only security audit for the current `loadAdminUserBotDetail(userId)` loader/DTO and `/admin/users/[userId]/bots` route in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Questions answered:
- Whether the current query/DTO has security risks.
- What isolation test is needed before acceptance.
- Whether `listUsersWithCreatedAt()` is acceptable here.
- Which fields must be forbidden in tests.
- Which audit/read-only constraints still bind this slice.

No application/runtime code, tests, migrations, live services, worker state, bot controls, exchange probes, SSH, or real database state were changed.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-security-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-tests-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-ux-auditor.md`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/admin/layout.tsx`
- `packages/auth/src/rbac.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/db-pg5.test.ts`

## Files changed
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-security-auditor.md` only.

## Findings
1. Severity: PASS. The current `loadAdminUserBotDetail()` path no longer uses `listUsersWithCreatedAt()` for the target drilldown. Evidence: `queries.ts` imports `loadAdminUserBotDetailFromDb` at `apps/web/src/features/admin/queries.ts:21` and delegates to it at `apps/web/src/features/admin/queries.ts:171` to `apps/web/src/features/admin/queries.ts:177`; the new loader explicitly selects the target user by `schema.users.id` and omits `schema.users.passwordHash` at `apps/web/src/features/admin/user-bot-detail-loader.ts:111` to `apps/web/src/features/admin/user-bot-detail-loader.ts:125`; roles are selected separately for only the target `userId` at `apps/web/src/features/admin/user-bot-detail-loader.ts:131` to `apps/web/src/features/admin/user-bot-detail-loader.ts:137`. Recommendation: keep this explicit SELECT shape. `listUsersWithCreatedAt()` remains acceptable only for aggregate admin list/count loaders that immediately map through safe DTOs, not for this one-user drilldown. Target part: `apps/web/src/features/admin/user-bot-detail-loader.ts`.

2. Severity: PASS. The current loader/DTO is masked and target-scoped for the bounded read-only admin drilldown. Evidence: entitlements filter by target `userId` at `apps/web/src/features/admin/user-bot-detail-loader.ts:138` to `apps/web/src/features/admin/user-bot-detail-loader.ts:147`; bot instances filter by target `userId` at `apps/web/src/features/admin/user-bot-detail-loader.ts:148` to `apps/web/src/features/admin/user-bot-detail-loader.ts:155`; exchange metadata filters by target `userId` and selects only `id/exchange/label/mode/keyMask` at `apps/web/src/features/admin/user-bot-detail-loader.ts:156` to `apps/web/src/features/admin/user-bot-detail-loader.ts:165`; configs and metrics are read only for the target-owned `instanceIds` at `apps/web/src/features/admin/user-bot-detail-loader.ts:168` to `apps/web/src/features/admin/user-bot-detail-loader.ts:195`; result DTO fields are limited at `apps/web/src/features/admin/types.ts:31` to `apps/web/src/features/admin/types.ts:74`. Recommendation: preserve this target-owned query shape and do not reuse product-wide bot read models for this route. Target part: loader and DTO.

3. Severity: PASS WITH RESIDUAL RISK. The required PGlite two-user loader isolation test now exists and passed in this audit lane, but it should remain a required focused gate before acceptance. Evidence: `tests/integration/admin-user-bot-detail-loader.test.ts:43` to `tests/integration/admin-user-bot-detail-loader.test.ts:147` builds a disposable PGlite DB and seeds two users, entitlements, exchange accounts, bot instances, configs, and metric snapshots; `tests/integration/admin-user-bot-detail-loader.test.ts:150` to `tests/integration/admin-user-bot-detail-loader.test.ts:219` asserts user A output excludes user B ids/email/key mask/raw config/metric markers and sensitive strings. Verification run: `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts` passed, 2 files / 5 tests. Recommendation: keep this gate in focused acceptance, and consider adding a cross-user `exchangeAccountId` mismatch fixture plus broader row-count checks if bot positions/trades/reviews enter the route. Target part: loader integration test.

4. Severity: MEDIUM. The current static and loader tests forbid key high-risk fields, but the forbidden set should be broadened for durable regression coverage. Evidence: static coverage forbids `exchangeApiKeySecrets`, `passwordHash`, and `configJson` at `tests/integration/admin-user-bot-detail-static.test.ts:16` to `tests/integration/admin-user-bot-detail-static.test.ts:35`; loader coverage forbids password hashes, `sealed`, `apiSecret`, `apiKey`, and `token` in returned JSON at `tests/integration/admin-user-bot-detail-loader.test.ts:198` to `tests/integration/admin-user-bot-detail-loader.test.ts:219`; schema contains additional raw/sensitive fields such as `exchange_api_key_secrets.sealed`, `key_id`, `bot_metric_snapshots.raw_json`, `bot_config_versions.config_json`, and token hashes at `packages/db/src/schema.ts:128` to `packages/db/src/schema.ts:134`, `packages/db/src/schema.ts:403` to `packages/db/src/schema.ts:410`, `packages/db/src/schema.ts:421` to `packages/db/src/schema.ts:440`, and `packages/db/src/schema.ts:710` to `packages/db/src/schema.ts:726`. Recommendation: source and DTO JSON assertions should forbid `passwordHash`, `password_hash`, `exchangeApiKeySecrets`, `exchange_api_key_secrets`, `sealed`, `keyId`, `key_id`, `apiKey`, `apiSecret`, `secret`, `token`, `bearer`, `Authorization`, `LEGACY_DATABASE_URL`, `TORTILA_JOURNAL_BASE_URL`, raw provider/exchange URLs, stack traces, `rawJson`, `raw_json`, `liveConfig`, `configJson`, `config_json`, and raw config payloads. `configVersion` and `configUpdatedAt` remain allowed. Target part: static and loader integration tests.

5. Severity: MEDIUM. The route is correctly read-only today, but admin inspection audit is not implemented and should not be quietly added inside this read-only slice. Evidence: repo policy forbids live server mutation, plaintext exchange secrets, live bot control, and requires entitlements fail closed at `AGENTS.md:74` to `AGENTS.md:82`; the session protocol carries forward no live server/bot/secret mutation and no plaintext exchange secrets at `docs/SESSION_PROTOCOL.md:81` to `docs/SESSION_PROTOCOL.md:86`; the route repeats `requireUser()` and `assertAdmin()` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:20` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:25`; it displays `LIVE CONTROL: DISABLED` and `admin view: read-only` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:35` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:43`; prior security audit notes that sensitive inspect auditing would write audit rows and is not pure UI-only at `docs/handoffs/20260603-admin-user-bot-drilldown-security-auditor.md:80` to `docs/handoffs/20260603-admin-user-bot-drilldown-security-auditor.md:83`. Recommendation: keep this slice read-only with no audit writes; if the product needs `admin.user_view` or `admin.bot_account.inspect`, open a separate audit/action phase with minimal redacted payloads and explicit tests. Target part: audit policy, future admin inspect workflow.

## Decisions
1. Current loader security verdict: acceptable for this bounded masked read-only slice after the explicit target-user SELECT refactor and focused PGlite isolation pass.
2. `listUsersWithCreatedAt()` should not be used in `loadAdminUserBotDetail()`; the current replacement with explicit user SELECT is the right design.
3. The PGlite two-user loader test is now present and green in this audit lane; keep it as a required focused acceptance gate.
4. Legacy provider ownership remains unresolved; this route may show WTC-owned target-user rows and warning copy, not full provider-account ownership facts.
5. No admin inspect audit should be added in this bounded read-only audit slice.

## Risks
1. A future refactor could accidentally switch from target `bot_instances.user_id` scoping back to product-wide latest snapshot queries; the loader test must continue to catch that.
2. A future DTO expansion could expose raw `bot_configs.config`, `bot_config_versions.config_json`, or `bot_metric_snapshots.raw_json`; tests need the broader raw-field bans listed above.
3. If bot instance creation/update ever allows cross-user `exchangeAccountId`, DB integrity should be fixed; meanwhile this loader's map-from-target-exchange-rows behavior should be locked by a mismatch fixture.
4. The focused PGlite gate passed, but broader typecheck/lint/secret scan/build/e2e were not rerun in this audit lane.
5. Full e2e remained not green in the prior phase, so focused route proof is not equivalent to whole-suite acceptance.

## Verification/tests
RUN in this audit:
1. `git status --short --branch` - observed pre-existing dirty/untracked Phase 3.70 files and handoffs; left them untouched.
2. Read-only source inspection with `rg` and `Get-Content` over the files listed above.
3. Confirmed this target handoff path did not exist before writing.
4. `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts` - PASS, 2 files / 5 tests.
5. No background agents were launched by this assigned single-auditor task, and no N-agent claim is made here.

NOT RUN in this audit:
1. `npm run typecheck`, `npm run lint`, `npm run secret:scan`, `npm run build`, Playwright, `node scripts/gates.mjs full`, and `node scripts/gates.mjs e2e` - not run because the requested task was security audit plus one handoff file, not full implementation acceptance.
2. DB migrations/seeds/managed DB gates, worker ticks, live service probes, SSH, bot control, exchange ping, or secret-bearing commands - not run by policy.

Isolation test expectation before acceptance:
1. Keep `tests/integration/admin-user-bot-detail-loader.test.ts` in the focused gate set.
2. It must continue to use disposable PGlite only, not a live `DATABASE_URL`.
3. It must keep proving two-user separation across entitlements, bot instances, config metadata, exchange metadata, and metric snapshots.
4. It should be extended if the route later includes positions, trades, reviews, provider ids, or sensitive inspection flows.

## Next actions
1. Expand the forbidden-field assertions listed in Finding 4.
2. Add a cross-user exchange-account mismatch fixture if bot instance mutation paths do not already enforce same-user account ownership.
3. Run broader focused gates before final acceptance: `npm run typecheck`, `npm run lint`, `npm run secret:scan`, `npm run build -w @wtc/web`, and the relevant admin Playwright/mobile route proof.
