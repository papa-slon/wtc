# admin-source-proof-rendered-tests-auditor handoff
## Scope
Phase 4.50 read-only tests audit for admin selected-user bot detail source-proof rendered acceptance in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Inspected existing integration, e2e, harness, gate, and visual-evidence tests for the admin selected-user bot detail page, with a narrow goal: recommend the minimal code/test changes and exact commands needed to prove the Phase 4.49 Legacy closed-trade source-proof row is rendered from source-backed fixture data and does not leak raw proof/provider/secret fields.

This auditor did not read secret values, did not call live services/providers, did not mutate a live DB, did not start/stop/control bots or servers, and did not edit code/tests/docs other than this handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260605-0490-admin-selected-user-source-proof-tests-auditor.md`
- `docs/handoffs/20260605-0490-phase-4-49-admin-selected-user-source-proof.md`
- `package.json`
- `scripts/gates.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `playwright.config.ts`
- `playwright.admin-user-bots-db.config.ts`
- `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/legacy-closed-trade-source-proof-static.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/bot-admin-acceptance-runner.test.ts`
- `tests/integration/retained-visual-artifacts.test.ts`

## Files changed
None - read-only audit, except this handoff.

## Findings
1. Severity P1 - The DB-backed Playwright fixture now seeds scoped and unscoped Legacy `closedTradeSourceProof`, but the rendered spec does not assert the source-proof row/status/provenance. Evidence: `scripts/prepare-admin-user-bot-detail-e2e.ts:360` through `scripts/prepare-admin-user-bot-detail-e2e.ts:396` seeds an unscoped blocked proof and a scoped `ready_for_mapper` proof with hostile raw fields; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:63` through `apps/web/src/app/admin/users/[userId]/bots/page.tsx:95` defines rendered labels including `mapper-ready proof`, `scoped worker metric`, and the mapper replay warning; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:217` through `apps/web/src/app/admin/users/[userId]/bots/page.tsx:225` renders the Legacy-only `Source-proof gate`; `tests/e2e/admin-user-bot-detail-db.spec.ts:109` through `tests/e2e/admin-user-bot-detail-db.spec.ts:146` lists common visible markers without source-proof markers, and `tests/e2e/admin-user-bot-detail-db.spec.ts:213` through `tests/e2e/admin-user-bot-detail-db.spec.ts:278` never asserts `Source-proof gate`, `mapper-ready proof`, `scoped worker metric`, or `Source contract is mapper-ready`. Recommendation: add source-proof visible markers/assertions to `COMMON_VISIBLE_MARKERS` or a small `SOURCE_PROOF_VISIBLE_MARKERS` list, and assert the Legacy card renders `Source-proof gate`, `mapper-ready proof`, `scoped worker metric`, `Source contract is mapper-ready; importer replay still needs its own gate.`, and `build audited mapper/importer`. Target part: `tests/e2e/admin-user-bot-detail-db.spec.ts`.
2. Severity P1 - The rendered leak checks do not include the hostile source-proof payload markers that the fixture intentionally seeds. Evidence: `scripts/prepare-admin-user-bot-detail-e2e.ts:385` through `scripts/prepare-admin-user-bot-detail-e2e.ts:394` seeds `SOURCE_PROOF_API_KEY_SHOULD_NOT_RENDER`, `SOURCE_PROOF_PAYLOAD_ALLOWLIST_SHOULD_NOT_RENDER`, `SOURCE_PROOF_BLOCKER_SHOULD_NOT_RENDER`, `SOURCE_PROOF_EVIDENCE_REF_SHOULD_NOT_RENDER`, `SOURCE_PROOF_RAW_PROVIDER_ID_SHOULD_NOT_RENDER`, and `SOURCE_PROOF_RAW_API_KEY_SHOULD_NOT_RENDER`; `tests/e2e/admin-user-bot-detail-db.spec.ts:148` through `tests/e2e/admin-user-bot-detail-db.spec.ts:199` has `HIDDEN_MARKERS` for user/provider/trade/health secrets but no `SOURCE_PROOF_*` markers or raw proof property names. Recommendation: extend `HIDDEN_MARKERS` with the exact `SOURCE_PROOF_*` markers plus `UNSCOPED_SOURCE_PROOF_SHOULD_NOT_RENDER`, and consider exact raw proof property names such as `rawPayloadAllowlist`, `unsafeRawPayloadFields`, and `evidenceRef` if they do not create false positives. Target part: `tests/e2e/admin-user-bot-detail-db.spec.ts`.
3. Severity P1 - The integration harness validates the opt-in DB browser runner but does not pin the source-proof fixture/spec contract, so future edits could remove rendered source-proof proof while the local harness stays green. Evidence: `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:60` through `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:94` checks selected-user runtime fixture setup but not `closedTradeSourceProof`; `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:96` through `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:157` checks rendered DB spec strings but not `Source-proof gate`, `mapper-ready proof`, `scoped worker metric`, or source-proof leak markers. Recommendation: add static harness assertions that `prepare` contains `closedTradeSourceProof`, `ready_for_mapper`, `UNSCOPED_SOURCE_PROOF_SHOULD_NOT_RENDER`, and `SOURCE_PROOF_RAW_API_KEY_SHOULD_NOT_RENDER`, and that `spec` contains the visible source-proof assertions and hidden source-proof markers. Target part: `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`.
4. Severity P1 - `npm run accept:bots:rendered` is useful local rendered coverage but cannot be used as admin selected-user DB/source-proof rendered acceptance. Evidence: `playwright.config.ts:9` ignores `admin-user-bot-detail-db.spec.ts` in default e2e; `scripts/gates.mjs:145` through `scripts/gates.mjs:154` runs the local bot/admin pack without the DB admin-user spec; `tests/integration/bot-admin-acceptance-runner.test.ts:28` through `tests/integration/bot-admin-acceptance-runner.test.ts:52` explicitly asserts the local pack excludes `e2e:admin-user-bots:db` and managed DB runners. Recommendation: keep source-proof rendered acceptance as a separate managed DB matrix gate and do not mark it green from `accept:bots:rendered` or `accept:bots:local`. Target part: release/aggregate gate reporting.
5. Severity P2 - The source-proof app/loader code has strong local integration coverage, so the minimal next implementation appears test-only unless rendered copy changes. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:887` parses only `rawMetric.closedTradeSourceProof` through the shared sanitizer, `apps/web/src/features/admin/user-bot-detail-loader.ts:1228` through `apps/web/src/features/admin/user-bot-detail-loader.ts:1230` prefers scoped proof and falls back to global preflight; `tests/integration/admin-user-bot-detail-loader.test.ts:655` through `tests/integration/admin-user-bot-detail-loader.test.ts:735` proves scoped proof wins, unscoped proof is ignored, and unsafe raw proof fields are dropped. Recommendation: avoid app-code churn; add rendered DB assertions and harness pinning first, then only touch app code if the new Playwright assertions reveal a real render mismatch. Target part: e2e/harness tests first.
6. Severity P2 - Visual evidence can be produced by the DB browser spec, but inventory alone is not acceptance. Evidence: `tests/e2e/admin-user-bot-detail-db.spec.ts:278` writes full-page screenshots for each runtime scenario/project; `tests/integration/retained-visual-artifacts.test.ts:94` through `tests/integration/retained-visual-artifacts.test.ts:100` says inventory mode only inventories; `tests/integration/retained-visual-artifacts.test.ts:102` through `tests/integration/retained-visual-artifacts.test.ts:109` requires a passing manifest for reviewed visual acceptance, and `tests/integration/retained-visual-artifacts.test.ts:261` through `tests/integration/retained-visual-artifacts.test.ts:269` keeps CI uploads limited to validated manifests. Recommendation: after the managed matrix runs, inventory screenshots immediately; if retained as acceptance artifacts, add a reviewed visual manifest and run the manifest check. Target part: rendered proof artifact procedure.
7. Severity P2 - Managed rendered source-proof proof is blocked in this shell by absent DB env, not by a missing runner. Evidence: env preflight observed `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL=NOT_SET` and `ADMIN_USER_BOTS_E2E_DATABASE_URL=NOT_SET`; `scripts/run-admin-user-bot-detail-e2e-managed.mjs:29` through `scripts/run-admin-user-bot-detail-e2e-managed.mjs:49` requires a non-throwaway admin Postgres maintenance URL; `scripts/run-admin-user-bot-detail-e2e-managed.mjs:101` through `scripts/run-admin-user-bot-detail-e2e-managed.mjs:119` creates and drops throwaway scenario DBs; `playwright.admin-user-bots-db.config.ts:13` through `playwright.admin-user-bots-db.config.ts:32` refuses missing prep marker or nonmatching throwaway DB. Recommendation: run the managed matrix only with a local/admin maintenance Postgres URL that can create/drop `wtc_test_admin_user_bots_*`; never use a raw production DSN or archive full URLs. Target part: operator environment and command runbook.

## Decisions
1. No code or test edits were made in this auditor lane.
2. Treated Phase 4.50 as a rendered acceptance gap audit, not a new source-proof importer, live provider probe, or app refactor.
3. Classified the next minimal change as e2e/harness test coverage: the fixture already seeds source-proof data and the app already renders source-proof labels.
4. Kept local mock/no-live `accept:bots:*` gates separate from the managed selected-user DB matrix.
5. No background agents were opened by this per-agent auditor lane; none remain open from this lane. This file is the requested single agent handoff.

## Risks
1. Calling `accept:bots:rendered` green would overclaim source-proof rendered acceptance because the DB admin selected-user spec is ignored by the default/local pack.
2. Without explicit `SOURCE_PROOF_*` hidden markers in Playwright, a future regression could render raw proof payload details while integration DTO tests remain green.
3. Without harness pinning, later fixture/spec edits can silently drop the source-proof rendered assertions.
4. Retained screenshots without a review manifest are useful evidence inventory but not reviewed visual acceptance.
5. A managed DB matrix run must use throwaway/local databases only; full DSNs, cookies, raw env dumps, traces, and unreviewed screenshots must not be archived.

## Verification/tests
RUN:
1. Protocol and source inspection listed above.
2. `git status --short --branch` -> observed branch `codex/bot-analytics-settings-canary-20260603` with a pre-existing dirty tree and many modified/untracked Phase 3/4 files. No attempt was made to revert or clean unrelated changes.
3. Env presence preflight for `WORKER_CONTINUITY_ADMIN_DATABASE_URL`, `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, `ADMIN_USER_BOTS_E2E_DATABASE_URL`, `LEGACY_DATABASE_URL`, `LEGACY_LIVE_READS_ENABLED`, `DATABASE_URL`, and `REAL_POSTGRES_DATABASE_URL` -> all `NOT_SET`. Values were not printed.
4. `npx vitest run tests/integration/legacy-closed-trade-source-proof-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts tests/integration/bot-statistics-completion.test.ts tests/integration/bot-admin-acceptance-runner.test.ts tests/integration/retained-visual-artifacts.test.ts` -> PASS (`7` files, `50` tests).
5. `git diff --check -- docs/handoffs/20260605-0500-admin-source-proof-rendered-tests-auditor.md` -> PASS.

Can run without managed env:
1. Focused local source-proof/test harness pack:
   `npx vitest run tests/integration/legacy-closed-trade-source-proof-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts tests/integration/bot-statistics-completion.test.ts tests/integration/bot-admin-acceptance-runner.test.ts tests/integration/retained-visual-artifacts.test.ts`
2. After the recommended test edits, re-run the focused harness/spec guard:
   `npx vitest run tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/legacy-closed-trade-source-proof-static.test.ts tests/integration/bot-statistics-completion.test.ts`
3. Local rendered regression pack, useful but not sufficient for DB source-proof rendered acceptance:
   `npm run accept:bots:rendered`
4. Full local mock/no-live bot/admin pack, useful but not sufficient for DB source-proof rendered acceptance:
   `npm run accept:bots:local`
5. Static safety/quality commands after test edits:
   `npm run typecheck -w @wtc/web`
   `npm run secret:scan`
   `npm run governance:check`
   `git diff --check`
6. Visual inventory only, not reviewed acceptance:
   `npm run evidence:visual -- --inventory tests/e2e/screenshots`

Blocked or not run:
1. `npm run e2e:admin-user-bots:db:managed:matrix` - NOT RUN because `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is not set; this is the correct rendered DB source-proof acceptance command after the spec/harness assertions are added.
2. `npm run e2e:admin-user-bots:db` - NOT RUN because it requires a pre-created empty throwaway `ADMIN_USER_BOTS_E2E_DATABASE_URL`; prefer the managed matrix when admin maintenance DB env is available.
3. `npx playwright test -c playwright.admin-user-bots-db.config.ts` - NOT RUN because it is guarded by `ADMIN_USER_BOTS_E2E=1`, a throwaway DB URL, and a prep marker written by `scripts/prepare-admin-user-bot-detail-e2e.ts`.
4. Reviewed visual manifest gate - NOT RUN because no new managed DB screenshots were generated in this auditor lane; run only after the managed matrix and human/OCR review manifest exists:
   `npm run evidence:visual -- --manifest logs/retained-visual-artifacts/<run>/visual-review.json tests/e2e/screenshots`
5. `npm run accept:worker:continuity:managed` - NOT RUN because `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is not set and it is separate from selected-user rendered source-proof acceptance.
6. Root lint/typecheck/full test/build, full `npm run accept:bots:rendered`, full `npm run accept:bots:local`, and root `git diff --check` - NOT RUN because this lane made no code/test implementation edits.
7. Live Legacy DB/provider/exchange probes, live exchange-key ping, live bot start/stop/apply-config, worker live control, server deploy, CI, and production monitoring - NOT RUN; prohibited/out of scope for this read-only tests auditor lane.

Recommended minimal source-proof rendered acceptance commands after test edits:
1. `npx vitest run tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/legacy-closed-trade-source-proof-static.test.ts tests/integration/bot-statistics-completion.test.ts`
2. `npm run typecheck -w @wtc/web`
3. `npm run secret:scan`
4. `npm run governance:check`
5. `git diff --check`
6. With local/admin maintenance Postgres env only:
   `npm run e2e:admin-user-bots:db:managed:matrix`
7. After the matrix, for screenshot inventory:
   `npm run evidence:visual -- --inventory tests/e2e/screenshots`
8. If screenshots are retained as acceptance artifacts, add a reviewed manifest and run:
   `npm run evidence:visual -- --manifest logs/retained-visual-artifacts/<run>/visual-review.json tests/e2e/screenshots`

## Next actions
1. Add source-proof visible assertions to `tests/e2e/admin-user-bot-detail-db.spec.ts`: `Source-proof gate`, `mapper-ready proof`, `scoped worker metric`, `Source contract is mapper-ready; importer replay still needs its own gate.`, and `build audited mapper/importer`.
2. Add source-proof hidden markers to the same spec: `UNSCOPED_SOURCE_PROOF_SHOULD_NOT_RENDER`, `SOURCE_PROOF_API_KEY_SHOULD_NOT_RENDER`, `SOURCE_PROOF_PAYLOAD_ALLOWLIST_SHOULD_NOT_RENDER`, `SOURCE_PROOF_BLOCKER_SHOULD_NOT_RENDER`, `SOURCE_PROOF_EVIDENCE_REF_SHOULD_NOT_RENDER`, `SOURCE_PROOF_RAW_PROVIDER_ID_SHOULD_NOT_RENDER`, and `SOURCE_PROOF_RAW_API_KEY_SHOULD_NOT_RENDER`.
3. Update `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` to pin both the fixture source-proof seed and the rendered spec source-proof assertions/leak markers.
4. Run the focused no-managed-env Vitest pack after the test edits.
5. When `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is supplied, run `npm run e2e:admin-user-bots:db:managed:matrix`, inventory/review screenshots, and record exact RUN/NOT RUN gates in the aggregate phase handoff.
