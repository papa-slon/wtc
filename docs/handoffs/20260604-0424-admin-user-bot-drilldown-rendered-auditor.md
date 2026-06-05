# admin-user-bot-drilldown-rendered-auditor handoff
## Scope
Read-only Phase 3.95 audit of the admin selected-user bot drilldown route:
`/admin/users/[userId]/bots`.

Scope checked whether the route is user-specific, read-only, admin-gated, and whether current rendered e2e coverage is only demo-empty state. The audit also identified the minimal safe path for populated rendered acceptance without live control, worker tick/restart, provider DB calls, exchange calls, env/vault/secret inspection, SSH, tmux, systemd, or bot start/stop/apply/retest.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/handoffs/20260604-0410-phase-3-94-bot-settings-rendered-ux-slots.md`
8. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
9. `apps/web/src/features/admin/user-bot-detail-loader.ts`
10. `apps/web/src/features/admin/queries.ts`
11. `apps/web/src/features/admin/types.ts`
12. `apps/web/src/features/admin/actions.ts`
13. `apps/web/src/app/admin/users/page.tsx`
14. `apps/web/src/app/admin/bots/page.tsx`
15. `apps/web/src/app/admin/bots/config/page.tsx`
16. `apps/web/src/lib/nav.ts`
17. `packages/db/src/repositories.ts`
18. `tests/integration/admin-user-bot-detail-loader.test.ts`
19. `tests/integration/admin-user-bot-detail-static.test.ts`
20. `tests/e2e/admin-mobile-pg8.spec.ts`
21. `tests/integration/admin-global-bot-config-static.test.ts`
22. `tests/integration/bot-read-safety-static.test.ts`

## Files changed
None - read-only audit.

Handoff written: `docs/handoffs/20260604-0424-admin-user-bot-drilldown-rendered-auditor.md`.

## Findings
1. Severity: High. The selected-user bot detail route is admin-gated and passes the route user id into the dedicated loader. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:71` defines the route handler, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:72` calls `requireUser`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:73` calls `assertAdmin`, and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:75`-`76` awaits `params.userId` and calls `loadAdminUserBotDetail(userId)`. Recommendation: keep the route as an admin-only server page; do not move user id trust to client-side code. Target part: route/RBAC boundary.
2. Severity: High. The loader is user-specific and does not use the generic user bot read model. Evidence: `apps/web/src/features/admin/queries.ts:172`-`177` calls `loadAdminUserBotDetailFromDb(db, userId)` only when DB exists; `apps/web/src/features/admin/user-bot-detail-loader.ts:789`-`803` loads the user row with `where(eq(schema.users.id, userId))`; `apps/web/src/features/admin/user-bot-detail-loader.ts:809`-`863` filters roles, entitlements, bot instances, exchange accounts, and provider accounts by that same `userId`; `apps/web/src/features/admin/user-bot-detail-loader.ts:880`-`954` then loads config/snapshots/trades only for the selected user's `instanceIds`. Recommendation: keep all selected-user drilldown state derived from selected-user instance ids, not product-global or fleet loaders. Target part: user isolation/data loader.
3. Severity: High. Legacy runtime stats are scoped to the active provider-account mapping before being attributed to the user. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:706`-`713` returns false for Legacy rows unless `rowProviderAccountId` matches the active provider account; `apps/web/src/features/admin/user-bot-detail-loader.ts:715`-`723` filters rows by both bot instance and provider scope; `apps/web/src/features/admin/user-bot-detail-loader.ts:998`-`1003` excludes Legacy latest metrics without an active matching provider account. Recommendation: preserve this Legacy provider mapping gate when adding rendered acceptance. Target part: Legacy user attribution.
4. Severity: High. The route is read-only and intentionally avoids user-setting, provider-mapping, exchange-key, live-config, and live-control mutations. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:92`-`95` renders `LIVE CONTROL: DISABLED`, `user settings: read-only`, and `provider mappings: read-only`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:421`-`426` says the page does not create, disable, or edit mappings, settings, keys, live bot config, start/stop state, or positions; `tests/integration/admin-user-bot-detail-static.test.ts:95`-`107` asserts the page has no provider mapping actions, no CSRF field, no submit, no `saveBotConfigAction`, no system-default save action, and no start/stop/apply/test-connection text. Recommendation: keep all selected-user drilldown controls as links or read-only facts. Target part: admin selected-user UI.
5. Severity: High. Admin cannot edit a user's saved bot settings from this drilldown, and no admin action currently writes `bot_configs` for a user. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:478`-`480` states admins can inspect a user-owned WTC reference profile but cannot edit user settings from the drilldown; `apps/web/src/app/admin/bots/config/page.tsx:101`-`110` and `apps/web/src/app/admin/bots/config/page.tsx:280`-`294` scope admin edits to system defaults and say user settings are unaffected; `apps/web/src/features/admin/actions.ts:354`-`390` maps Legacy provider accounts, `apps/web/src/features/admin/actions.ts:397`-`422` disables provider mappings, and `apps/web/src/features/admin/actions.ts:496`-`543` saves `bot_global_config`; a source search found admin actions import `saveBotGlobalConfig`, `upsertBotProviderAccountMapping`, and `disableBotProviderAccountMapping`, but not `saveBotConfig`. The DB `saveBotConfig` path itself is a WTC DB-only user config save with `actorRole: 'user'` and is never forwarded live (`packages/db/src/repositories.ts:2178`-`2192`). Recommendation: if future admin user-setting edits are desired, require a separate audited admin action, explicit RBAC/CSRF/Zod/entitlement/audit design, and rendered proof; do not smuggle it into this drilldown. Target part: mutation boundary.
6. Severity: High. Existing loader integration coverage is populated and strong, but it is not rendered browser proof. Evidence: `tests/integration/admin-user-bot-detail-loader.test.ts:427`-`624` seeds two users plus Tortila and Legacy config, exchange key metadata, metrics, positions, trades, provider mapping, health warnings, and asserts the result has selected-user data while excluding user B, raw config, sealed secrets, raw trade JSON, password hashes, api keys, and tokens. It also verifies no table counts change across the loader call at `tests/integration/admin-user-bot-detail-loader.test.ts:429`-`433`. Recommendation: reuse this fixture shape for browser acceptance instead of inventing a weaker demo fixture. Target part: test fixture/evidence.
7. Severity: Medium. Current e2e coverage for `/admin/users/[userId]/bots` only proves the demo-empty/mobile shell, not a populated selected-user drilldown. Evidence: `tests/e2e/admin-mobile-pg8.spec.ts:12`-`15` explicitly says e2e runs in demo mode, tables render `EmptyState`, and real rows are guarded statically; `tests/e2e/admin-mobile-pg8.spec.ts:20`-`35` includes `/admin/users/demo-user/bots`; `tests/e2e/admin-mobile-pg8.spec.ts:42`-`60` checks heading, mobile nav, storage pill, no horizontal scroll, and screenshots. Repository search found the populated markers `A_ONLY_SYMBOL`, `USER_A_LEGACY_SYMBOL`, and `Drilldown User A` only in the loader integration test, not in e2e. Recommendation: do not claim populated rendered acceptance until a DB-backed Playwright route renders selected-user rows. Target part: rendered acceptance.
8. Severity: Medium. Minimal safe populated rendered path: create a managed/throwaway DB e2e that seeds the existing loader fixture shape, starts Next with `DATABASE_URL` pointed only at that throwaway DB and live-control flags disabled, logs in as admin, opens `/admin/users/<seeded-user-id>/bots`, and asserts visible safe facts plus absent secrets/mutations. Evidence: the route already reads the DB via `getServerDb` and falls back to demo only when absent (`apps/web/src/features/admin/queries.ts:172`-`177`); the loader fixture already has the desired populated facts and no-leak assertions (`tests/integration/admin-user-bot-detail-loader.test.ts:427`-`624`); current demo e2e explicitly lacks real rows (`tests/e2e/admin-mobile-pg8.spec.ts:12`-`15`). Recommendation: factor the existing loader seed into a shared test fixture or small managed prepare script, then add a focused e2e asserting `Drilldown User A`, `A_ONLY_SYMBOL`, `USER_A_LEGACY_SYMBOL`, `A_ONLY_POSITION_SYMBOL`, `USER_A_LEGACY_TRADE_SYMBOL`, `LIVE CONTROL: DISABLED`, `user settings: read-only`, absence of `type="submit"`, and absence of all raw/secret/user-B markers. Target part: next rendered acceptance slice.

## Decisions
1. The route is user-specific, admin-gated, and read-only by current source evidence.
2. Admins can map or disable Legacy provider-account mappings and can edit system bot defaults; those are not user saved settings.
3. Admins do not currently have a selected-user bot settings edit action in the inspected admin route/actions.
4. Current e2e coverage is demo-empty for this route. Loader/static tests are useful but are not populated rendered acceptance.
5. No test, build, e2e, preview, worker, provider, exchange, env, vault, SSH, tmux, systemd, or live-service command was run in this read-only audit.

## Risks
1. This audit is source and test inspection only; it did not execute the app or render the page.
2. The worktree was heavily dirty before inspection; this audit preserves those changes and does not classify their authorship.
3. The recommended populated e2e will need careful generated-artifact handling because Playwright screenshots and `.next-e2e` outputs are generated files.
4. If a future admin action is added for user settings, the current "admin cannot edit user settings" verdict will need re-audit.

## Verification/tests
RUN:
1. Read required protocol/status files first: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, and `docs/handoffs/20260604-0410-phase-3-94-bot-settings-rendered-ux-slots.md`.
2. Inspected route, loader, relevant admin queries/actions/types/nav/pages, DB repositories, integration tests, static tests, and current e2e source.
3. Confirmed the requested handoff path did not already exist before writing it.

NOT RUN:
1. `npm test`, focused Vitest, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run e2e`, Playwright screenshots, preview/server startup, and browser rendering - skipped because this was a read-only audit and the user allowed only this handoff write.
2. Real Postgres migration/seed, provider DB checks, worker tick/restart/smoke, live bot start/stop/apply-config/retest, exchange ping, env/vault/secret inspection, SSH, tmux, systemd, and live server checks - forbidden by scope.

## Next actions
1. Add a populated rendered Playwright acceptance for `/admin/users/<seeded-user-id>/bots` using a throwaway DB seeded from the existing loader fixture shape.
2. Keep the acceptance command serialized and local-only, with `BOT_ADAPTER_MODE=mock`, live control disabled, no worker tick/restart, and no provider/exchange calls.
3. Assert visible selected-user facts: display name, safe config source, resolved symbols, provider mapping status, warnings, latest metric, positions, trades, equity counts, `LIVE CONTROL: DISABLED`, and `user settings: read-only`.
4. Assert absent unsafe facts: user B markers, raw config/trade JSON markers, sealed secret markers, password hashes, api key/secret/token strings, submit forms, provider mapping actions, user-setting save actions, and live control/action text.
5. Treat the existing demo mobile e2e as layout-shell coverage only until this populated rendered path passes.
