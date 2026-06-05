# admin-bot-drilldown-tests-auditor handoff
## Scope
Phase 3.74 tests-runner audit for admin user bot drilldown coverage and gates.

Audited current coverage for static tests, PGlite loader tests, Playwright/mobile coverage, RBAC/read-only assertions, absence of user settings mutation forms, raw secret/provider-id exposure, and admin route typecheck/build risk. No product code, tests, migrations, runtime config, live services, worker ticks, provider systems, secrets, environment files, or live bot controls were edited or probed. This was the single assigned `ecosystem-tests-runner` lane; no background agents were launched by this lane and no N-agent claim is made.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260603-1758-phase-3-71-legacy-provider-account-scope.md`
- `docs/handoffs/20260603-1830-phase-3-72-legacy-provider-ingestion-admin-mapping.md`
- `docs/handoffs/20260603-1910-phase-3-73-bot-settings-source-truth.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-tests-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-tests-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-security-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-platform-auditor.md`
- `docs/handoffs/20260603-1918-admin-bot-drilldown-ux-auditor.md`
- `docs/handoffs/20260603-1921-admin-bot-drilldown-security-auditor.md`
- `docs/handoffs/20260603-1922-admin-bot-drilldown-platform-auditor.md`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/data.tsx`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `package.json`

## Files changed
None - read-only audit, excluding this required handoff artifact:
- `docs/handoffs/20260603-1926-admin-bot-drilldown-tests-auditor.md`

No product code, tests, migrations, runtime config, live services, or secrets were edited.

## Findings
1. Severity: PASS. Focused static and loader gates are currently green for the admin drilldown and adjacent bot read/export safety. Evidence: final focused command `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-responsive.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/bot-read-safety-static.test.ts` passed 5 files / 76 tests; the static drilldown guard now forbids `adminMapLegacyProviderAccountAction`, `adminDisableLegacyProviderAccountAction`, `Map Legacy pub_id`, `CsrfField`, `type="submit"`, `saveBotConfigAction`, `startBot`, `stopBot`, and `applyConfig` at `tests/integration/admin-user-bot-detail-static.test.ts:54` to `tests/integration/admin-user-bot-detail-static.test.ts:68`. Recommendation: keep the drilldown guard inverted this way; put any future mapping mutation coverage in a separate explicit workflow spec. Target part: focused admin drilldown tests.

2. Severity: PASS. The route is server-side RBAC gated and currently read-only for user settings/provider mappings. Evidence: `/admin/users/[userId]/bots` calls `requireUser()` and `assertAdmin(actor.roles)` before `loadAdminUserBotDetail(userId)` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:31` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:36`; it labels `LIVE CONTROL: DISABLED`, `user settings: read-only`, and `provider mappings: read-only` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:46` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:55`; the provider mapping card says it does not create, disable, or edit mappings/settings/live state at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:220` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:223`. Recommendation: preserve route-level RBAC and keep mutation actions out of this page. Target part: admin drilldown route and static guard.

3. Severity: PASS. Raw exchange secrets are covered by both source shape and PGlite fixture evidence. Evidence: the loader selects target-user exchange metadata only (`id`, `exchange`, `label`, `mode`, `keyMask`) at `apps/web/src/features/admin/user-bot-detail-loader.ts:290` to `apps/web/src/features/admin/user-bot-detail-loader.ts:299` and does not select `exchange_api_key_secrets`; the loader test seeds secret rows for both users at `tests/integration/admin-user-bot-detail-loader.test.ts:115` to `tests/integration/admin-user-bot-detail-loader.test.ts:124`; the same test asserts sealed markers, key ids, `passwordHash`, `apiSecret`, `apiKey`, and `token` are absent at `tests/integration/admin-user-bot-detail-loader.test.ts:359` to `tests/integration/admin-user-bot-detail-loader.test.ts:373`. Recommendation: keep exchange-key handling metadata-only and keep seeded secret rows in the fixture. Target part: loader and PGlite test.

4. Severity: HIGH/GAP. Full Legacy provider `pub_id` / `providerAccountId` is still allowed by current DTO, UI, and tests, so the "no raw provider ids leaking" gate is not fully satisfied unless the product explicitly allows full admin display. Evidence: `AdminUserProviderAccountSummary` exposes `providerAccountId` at `apps/web/src/features/admin/types.ts:65` to `apps/web/src/features/admin/types.ts:72`; the loader maps and returns it at `apps/web/src/features/admin/user-bot-detail-loader.ts:220` to `apps/web/src/features/admin/user-bot-detail-loader.ts:234` and selects it at `apps/web/src/features/admin/user-bot-detail-loader.ts:300` to `apps/web/src/features/admin/user-bot-detail-loader.ts:314`; the page renders the full value in prose and in the mapping table at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:110` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:118` and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:234` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:240`; the loader test asserts the target user's full provider id is present at `tests/integration/admin-user-bot-detail-loader.test.ts:329` to `tests/integration/admin-user-bot-detail-loader.test.ts:337` while only proving user B's id does not leak at `tests/integration/admin-user-bot-detail-loader.test.ts:341` to `tests/integration/admin-user-bot-detail-loader.test.ts:348`. Recommendation: either document an explicit admin-only full-provider-id exception, or change DTO/UI/tests to use a masked provider id plus stable internal id, with full reveal reserved for a separately audited inspect action. Target part: admin DTO, page, loader test, provider-id policy.

5. Severity: PASS WITH RESIDUAL RISK. Saved settings summaries are now tested as allowlisted projections, but the loader still reads raw current config internally. Evidence: the loader selects `schema.botConfigs.config` at `apps/web/src/features/admin/user-bot-detail-loader.ts:318` to `apps/web/src/features/admin/user-bot-detail-loader.ts:329`; `mapConfigSummary()` returns version/source/mode/symbol count/stage/risk notes rather than raw config at `apps/web/src/features/admin/user-bot-detail-loader.ts:169` to `apps/web/src/features/admin/user-bot-detail-loader.ts:217`; the page renders read-only summary fields at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:143` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:180`; tests assert current-user symbol summaries are present but raw markers and config history JSON markers are absent at `tests/integration/admin-user-bot-detail-loader.test.ts:286` to `tests/integration/admin-user-bot-detail-loader.test.ts:323` and `tests/integration/admin-user-bot-detail-loader.test.ts:354` to `tests/integration/admin-user-bot-detail-loader.test.ts:365`. Recommendation: add a saved-config fixture containing `providerPubId`, secret-shaped fields, and a live-apply credential marker, then assert none are returned in `configSummary`. Target part: config summary projection and PGlite fixture.

6. Severity: MEDIUM/GAP. Mobile/Playwright coverage exists for the route but was not run in this lane and remains demo-mode coverage, not DB-mapped-state coverage. Evidence: `tests/e2e/admin-mobile-pg8.spec.ts` includes `/admin/users/demo-user/bots` in the 375px admin page set at `tests/e2e/admin-mobile-pg8.spec.ts:20` to `tests/e2e/admin-mobile-pg8.spec.ts:34`, checks visible heading/nav/storage/no horizontal scroll at `tests/e2e/admin-mobile-pg8.spec.ts:36` to `tests/e2e/admin-mobile-pg8.spec.ts:56`, and writes screenshots at `tests/e2e/admin-mobile-pg8.spec.ts:58`; the cheap static responsive guard includes `users/[userId]/bots/page.tsx` and table/status-pill checks at `tests/integration/admin-responsive.test.ts:18` to `tests/integration/admin-responsive.test.ts:33` and `tests/integration/admin-responsive.test.ts:69` to `tests/integration/admin-responsive.test.ts:90`. Recommendation: run scoped admin mobile Playwright after implementation acceptance with a deliberate artifact policy, and add a DB-backed or fixture-backed browser path if mapped/pending provider states must be visually accepted. Target part: Playwright/mobile acceptance.

7. Severity: PASS WITH BUILD GAP. Current web typecheck is green for the admin route, but a fresh Next build was not run. Evidence: `npm run typecheck -w @wtc/web` passed after the final focused test run; root scripts expose `build`, `typecheck`, `secret:scan`, and `e2e` at `package.json:12` to `package.json:28`. Recommendation: before aggregate acceptance, run `npm run build -w @wtc/web` once artifact writes are allowed, because Next App Router build/static analysis can catch issues that `tsc --noEmit` does not. Target part: acceptance gate stack.

8. Severity: MEDIUM/GAP. Provider state taxonomy is still too collapsed for disabled/needs-review acceptance. Evidence: `AdminUserProviderAccountSummary.status` can be `active`, `disabled`, or `needs_review`, but `AdminUserBotSummary.providerScope` only has `user_scoped | provider_account_mapped | provider_account_pending` at `apps/web/src/features/admin/types.ts:65` to `apps/web/src/features/admin/types.ts:90`; the loader promotes only the first active row at `apps/web/src/features/admin/user-bot-detail-loader.ts:373` to `apps/web/src/features/admin/user-bot-detail-loader.ts:383` and collapses non-active/no mapping Legacy state to `provider_account_pending` at `apps/web/src/features/admin/user-bot-detail-loader.ts:418` to `apps/web/src/features/admin/user-bot-detail-loader.ts:424`. Recommendation: add PGlite fixtures and UI states for active mapped, unmapped, disabled, needs_review, and ambiguous/duplicate active mappings before richer runtime facts are accepted. Target part: DTO, page copy, loader tests, mobile selectors.

## Decisions
1. Treat this lane as tests/gates audit, not product implementation.
2. Current final focused Vitest evidence is green after concurrent Phase 3.74 source/test edits settled.
3. Do not call Playwright/mobile or web build green in this lane; neither was run here.
4. Do not call provider-id masking green: current tests prove target-user isolation, not masked provider-id presentation.
5. Exchange secret non-leakage is green for this scoped loader.

## Risks
1. If full `providerAccountId` must be masked by policy, the current green loader/static tests are too permissive and should be updated before acceptance.
2. The current Playwright spec proves the demo route shell only; it does not prove DB-backed mapped/disabled/needs-review states.
3. A future config-summary expansion could accidentally return raw config fields unless the fixture adds secret/provider-id markers.
4. Without a fresh web build, there is residual Next App Router build risk.
5. The worktree changed during this audit from parallel Phase 3.74 activity; final conclusions are based on the last re-read and final green focused test run.

## Verification/tests
RUN in this audit:
1. Read binding docs: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, and `docs/handoffs/0000-orchestrator-seed.md`.
2. Read current status/implementation docs and latest relevant Phase 3.71-3.74/admin drilldown/provider-account handoffs listed above.
3. `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with pre-existing modified/untracked Phase 3 files and handoffs; no reverts performed.
4. `Test-Path docs/handoffs/20260603-1926-admin-bot-drilldown-tests-auditor.md` - returned `False` before writing this handoff.
5. Read-only source inspection with `rg`, `Get-ChildItem`, and line-numbered `Get-Content` over scoped admin route/loader/tests and bot export/read-safety guards.
6. `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts` - final run PASS, 2 files / 6 tests.
7. `npx vitest run tests/integration/admin-responsive.test.ts` - PASS, 1 file / 46 tests.
8. `npx vitest run tests/integration/bot-config-export-static.test.ts tests/integration/bot-read-safety-static.test.ts` - PASS, 2 files / 24 tests.
9. Final combined focused sweep: `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-responsive.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/bot-read-safety-static.test.ts` - PASS, 5 files / 76 tests.
10. `npm run typecheck -w @wtc/web` - PASS after final focused tests.
11. `npm run secret:scan` - PASS.
12. No background agents were launched by this single assigned tests-runner lane; none are running from this lane.

NOT RUN in this audit:
1. Product code/test edits - forbidden by user scope.
2. `npm run build -w @wtc/web` - not run because this audit was constrained to one handoff write and build writes generated Next artifacts.
3. Playwright/e2e - not run because `tests/e2e/admin-mobile-pg8.spec.ts` writes screenshots and usually starts/uses an app server; no artifact mutation/browser run was requested for this read-only handoff lane.
4. Root `npm test`, `npm run lint`, `npm run check:core`, `npm run governance:check`, `npm run coverage`, `npm run ci:local` - not run; focused admin/read-safety tests plus web typecheck and secret scan were the bounded gates.
5. DB migrations/seeds/managed Postgres gates - not run.
6. Worker tick/smoke, live bot continuity, live provider DB reads, exchange ping/test, SSH, Docker, tmux/systemd/process control, live start/stop/retest/apply-config, `.env` reads/mutations, and live/prod probes - forbidden by scope and not run.

## Next actions
1. Decide whether full Legacy provider `pub_id` is allowed in normal admin drilldown. If not, add `providerAccountMask`/stable id, remove full `providerAccountId` from normal DTO/render output, and update loader/static tests to forbid full provider ids.
2. Add saved-config fixtures containing `providerPubId`, secret-shaped keys, and live-apply credential markers; assert `configSummary` never returns them.
3. Split provider mapping state fixtures into active mapped, unmapped, disabled, needs_review, and ambiguous/duplicate active cases.
4. Run `npm run build -w @wtc/web` before aggregate acceptance once generated artifact writes are acceptable.
5. Run scoped admin Playwright/mobile proof, or add DB-backed browser coverage, after the provider-id/state policy is settled.
