# bot-operation-map-tests-auditor handoff
## Scope
Read-only tests/rendered audit for the next WTC bot operation-map panel. The audit inspected existing bot settings, statistics, readiness, warning, and admin selected-user bot-detail test coverage, then recommends exact focused Vitest/static/Playwright gates for a future implementation.

No product code, tests, package files, scripts, existing docs, live bot services, provider DB, exchange endpoints, env/vault/secret files, SSH, tmux, systemd, worker tick/restart, start/stop/apply/retest path, or rendered gate was run or changed in this audit.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/handoffs/20260604-0459-phase-3-96-bot-settings-row-error-feedback.md`
8. `docs/handoffs/20260604-0424-phase-3-95-bot-rendered-admin-user-gate.md`
9. `package.json`
10. `playwright.config.ts`
11. `playwright.admin-user-bots-db.config.ts`
12. `scripts/run-admin-user-bot-detail-e2e.mjs`
13. `apps/web/src/features/bots/readiness.ts`
14. `apps/web/src/features/bots/readiness-loader.ts`
15. `apps/web/src/features/bots/BotReadinessMap.tsx`
16. `apps/web/src/features/bots/config.ts`
17. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
18. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
19. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
20. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
21. `apps/web/src/features/bots/statistics-panels.tsx`
22. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
23. `apps/web/src/features/admin/user-bot-detail-loader.ts`
24. `tests/integration/bot-readiness-builder.test.ts`
25. `tests/integration/bot-readiness-server-dto-static.test.ts`
26. `tests/integration/bot-read-safety-static.test.ts`
27. `tests/integration/bot-statistics-static.test.ts`
28. `tests/integration/bot-config-review-static.test.ts`
29. `tests/integration/bot-config-action-handler.test.ts`
30. `tests/integration/admin-user-bot-detail-static.test.ts`
31. `tests/integration/admin-user-bot-detail-loader.test.ts`
32. `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
33. `tests/e2e/bot-readiness-map.spec.ts`
34. `tests/e2e/bot-settings.spec.ts`
35. `tests/e2e/smoke.spec.ts`
36. `tests/e2e/warning-summary-visual.spec.ts`
37. `tests/e2e/admin-user-bot-detail-db.spec.ts`

## Files changed
1. `docs/handoffs/20260604-0531-bot-operation-map-tests-auditor.md`

## Findings
1. Severity: High. The operation-map panel should reuse the existing safe readiness/read-model boundary instead of adding a new adapter, provider, or live-control path. Evidence: `docs/handoffs/0000-orchestrator-seed.md:117` forbids live bot control; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:193` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:200` already call `loadBotReadinessForUser(..., { includeOperationalRows: false })`; `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:118` wires dashboard readiness from the safe server DTO; `tests/integration/bot-read-safety-static.test.ts:84` through `tests/integration/bot-read-safety-static.test.ts:104` already statically fences readiness against adapter/fetch/vault/live-control semantics. Recommendation: build the operation-map input as a pure DTO derived from readiness, resolved config, warning summary, and safe statistics facts; add static guards that it does not import `getBotAdapter`, `fetch`, `vault.open`, `startBot`, `stopBot`, `applyConfig`, `retest`, secret fields, or provider raw payloads. Target part: operation-map data boundary.
2. Severity: High. The focused unit/static gate should be a small bot-operation-map lane, not a full-suite substitute. Evidence: `tests/integration/bot-readiness-builder.test.ts:33` through `tests/integration/bot-readiness-builder.test.ts:51` cover honest runtime/statistics status mapping; `tests/integration/bot-readiness-builder.test.ts:122` through `tests/integration/bot-readiness-builder.test.ts:151` cover surface-specific rows including `Live control` and `Live apply`; `tests/integration/bot-read-safety-static.test.ts:252` through `tests/integration/bot-read-safety-static.test.ts:296` already guards `operationMode` as `manual|auto` with manual-safe defaults and settings/setup rendering. Recommendation: add or extend a focused Vitest file, preferably `tests/integration/bot-operation-map-builder.test.ts`, to cover Tortila and Legacy operation steps, blocked/attention/ready statuses, manual-safe defaults, no false green state, and no live-control copy. Target part: pure operation-map semantics.
3. Severity: High. Settings and statistics rendered coverage should anchor assertions to panel headings, rows, and alert regions to avoid repeating the Phase 3.96 strict-locator problem. Evidence: Phase 3.96 recorded strict text-locator ambiguity and fixed it by scoping row alerts at `docs/handoffs/20260604-0459-phase-3-96-bot-settings-row-error-feedback.md:65`; the settings rendered spec already checks `Settings readiness map` and disabled `Live apply` at `tests/e2e/bot-settings.spec.ts:18` through `tests/e2e/bot-settings.spec.ts:19`; statistics uses safe read models at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:224`, renders `Trading bot performance` at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:262`, and includes Legacy operations at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:391`. Recommendation: if the operation map appears on settings/statistics, add locators scoped to a unique panel test id, heading, or table row; avoid unscoped `getByText()` for repeated status copy. Target part: rendered bot settings/statistics stability.
4. Severity: High. Admin selected-user bot detail needs separate static/DB-backed coverage because it must remain read-only and user-scoped. Evidence: `tests/integration/admin-user-bot-detail-static.test.ts:19` through `tests/integration/admin-user-bot-detail-static.test.ts:41` assert the loader uses safe tables and not `exchangeApiKeySecrets`; `tests/integration/admin-user-bot-detail-static.test.ts:69` through `tests/integration/admin-user-bot-detail-static.test.ts:89` assert `LIVE CONTROL: DISABLED`, read-only settings/mappings, `Stats scope`, and warning summary; the page renders the same boundaries at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:92` through `apps/web/src/app/admin/users/[userId]/bots/page.tsx:94` and selected-user stats scope at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:319` through `apps/web/src/app/admin/users/[userId]/bots/page.tsx:322`. Recommendation: if the operation map is shown in admin detail, extend both `admin-user-bot-detail-static.test.ts` and `admin-user-bot-detail-loader.test.ts`; if it needs populated browser proof, keep it behind the existing DB-backed opt-in gate. Target part: admin operation-map isolation.
5. Severity: Medium. The DB-backed admin rendered gate remains unavailable unless a throwaway admin Postgres URL is supplied. Evidence: Phase 3.95 records `npm run e2e:admin-user-bots:db:managed` as blocked by missing `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` at `docs/handoffs/20260604-0424-phase-3-95-bot-rendered-admin-user-gate.md:75`; Phase 3.96 carries the same blocker at `docs/handoffs/20260604-0459-phase-3-96-bot-settings-row-error-feedback.md:78`; the harness itself is opt-in and requires the prepared marker/HMAC at `playwright.admin-user-bots-db.config.ts:14` through `playwright.admin-user-bots-db.config.ts:30`. Recommendation: do not claim populated admin operation-map rendered acceptance unless `npm run e2e:admin-user-bots:db:managed` creates/drops `wtc_test_admin_user_bots_*` and passes. Target part: admin rendered acceptance.
6. Severity: Medium. Rendered gates are sensitive to stale Next output and should begin from a clean generated e2e dist directory. Evidence: default Playwright uses `NEXT_DIST_DIR: '.next-e2e'` at `playwright.config.ts:34`, refuses server reuse at `playwright.config.ts:31`, and Phase 3.95/3.96 both required `.next-e2e` cleanup before clean rendered evidence at `docs/handoffs/20260604-0424-phase-3-95-bot-rendered-admin-user-gate.md:71` and `docs/handoffs/20260604-0459-phase-3-96-bot-settings-row-error-feedback.md:92` through `docs/handoffs/20260604-0459-phase-3-96-bot-settings-row-error-feedback.md:95`. Recommendation: if rendered gates run, delete only `apps/web/.next-e2e` after verifying its resolved absolute path is inside this workspace; for DB admin rendered gates, also treat `apps/web/.next-e2e-admin-user-bots` as generated output and let the runner remove its marker. Target part: rendered gate hygiene.

## Decisions
1. Recommended a focused gate stack instead of full `npm test` or full `npm run e2e` for the first operation-map implementation.
2. Recommended adding one pure builder/static lane for operation-map semantics rather than overloading only rendered tests.
3. Recommended keeping admin selected-user operation-map proof split from user bot pages because the admin route has stronger user-isolation and no-mutation requirements.
4. Did not run Vitest, Playwright, build, lint, typecheck, secret scan, preview, worker, DB, provider, or live-service commands in this read-only audit.
5. Did not launch background agents because this was a single named read-only tests-auditor handoff, not a broad/major implementation phase.

## Risks
1. The operation-map panel does not exist yet, so exact assertions must be adjusted to the final component name, headings, and row labels.
2. If the panel is added to multiple surfaces at once, rendered assertions can become brittle unless the panel has unique scoping such as a stable heading, table caption, or `data-testid`.
3. The worktree is heavily dirty from prior phases; this audit did not attribute or revert those existing changes.
4. The admin DB-backed rendered path is still blocked without `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`.

## Verification/tests
RUN:
1. Required protocol/status docs and Phase 3.96 aggregate were read before this handoff.
2. Phase 3.95 aggregate was additionally read for admin-user rendered-gate context.
3. `git status --short --branch` was inspected; branch is `codex/bot-analytics-settings-canary-20260603` with broad pre-existing dirty and untracked state.
4. Existing test and Playwright harness files listed above were inspected with read-only shell/file-search commands.
5. Confirmed this handoff path did not exist before writing.

NOT RUN:
1. `npx vitest run ...` - skipped because this phase is an audit/recommendation only.
2. `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run lint`, `npm run secret:scan`, and `git diff --check` - skipped because no product/test/package code was changed.
3. Focused rendered Playwright gates - skipped to avoid generating `.next-e2e`, screenshots, traces, or server output during a read-only audit.
4. DB-backed admin rendered gate `npm run e2e:admin-user-bots:db:managed` - not run; still requires `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`.
5. Full `npm test`, full `npm run e2e`, full build, preview, worker tick/restart/smoke, provider DB, exchange calls, env/vault/secret inspection, SSH, tmux, systemd, live bot start/stop/apply/retest - forbidden or out of scope.

RECOMMENDED FOCUSED GATES FOR THE NEXT OPERATION-MAP IMPLEMENTATION:
1. Pure/static bot gate:
   `npx vitest run tests/integration/bot-readiness-builder.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-statistics-static.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-config-action-handler.test.ts`
2. Additive operation-map gate after implementation:
   `npx vitest run tests/integration/bot-operation-map-builder.test.ts`
   If no new builder file is added, put equivalent focused cases into `bot-readiness-builder.test.ts` or `bot-read-safety-static.test.ts` and include that file in gate 1.
3. Admin selected-user static/loader/harness gate if the panel renders in `/admin/users/[userId]/bots`:
   `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
4. Web correctness gates:
   `npm run typecheck`
   `npm run typecheck -w @wtc/web`
   `npm run lint`
5. User-facing rendered bot gate after cleaning `apps/web/.next-e2e`:
   `E2E_PORT=3427 npx playwright test tests/e2e/bot-settings.spec.ts tests/e2e/bot-readiness-map.spec.ts tests/e2e/warning-summary-visual.spec.ts --project=desktop --project=mobile --reporter=line`
6. Statistics rendered gate if the operation map appears on `/app/bots/statistics`:
   `E2E_PORT=3428 npx playwright test tests/e2e/smoke.spec.ts --grep "bot dashboard sub-tabs render with unified analytics" --project=desktop --project=mobile --reporter=line`
7. Populated admin rendered gate only when credentials are intentionally supplied:
   `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL=<maintenance-url-without-printing-value> npm run e2e:admin-user-bots:db:managed`
8. Final narrow hygiene after implementation:
   `git diff --check`
   `npm run secret:scan`
   `npm run governance:check`

RENDERED CLEANUP GUIDANCE:
1. Before each default rendered gate, remove only `apps/web/.next-e2e` after verifying the resolved absolute target remains under `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\apps\web`.
2. A safe PowerShell cleanup shape is:
   `$root = (Resolve-Path -LiteralPath .).Path; $target = Join-Path $root 'apps\web\.next-e2e'; if (Test-Path -LiteralPath $target) { $resolved = (Resolve-Path -LiteralPath $target).Path; if (-not $resolved.StartsWith((Join-Path $root 'apps\web'), [StringComparison]::OrdinalIgnoreCase)) { throw "Refusing unsafe .next-e2e cleanup: $resolved" }; Remove-Item -LiteralPath $resolved -Recurse -Force }`
3. After rendered gates, inspect `git status --short` for generated churn such as `apps/web/next-env.d.ts` or e2e artifacts. Keep only intentionally reviewed screenshots/evidence; do not let generated `.next-e2e` output become acceptance evidence.
4. For admin DB rendered gates, the generated directory is `apps/web/.next-e2e-admin-user-bots`; the runner cleans its marker, but retained screenshots/artifacts still need review and secret/leak scanning before archival.

## Next actions
1. Implement the operation-map panel in a new phase/session with the data boundary decided first.
2. Add or extend the focused Vitest/static tests before running rendered gates.
3. Run only the focused rendered commands relevant to the surfaces touched, with `.next-e2e` cleanup before reruns.
4. Defer populated admin rendered proof until `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is available.
