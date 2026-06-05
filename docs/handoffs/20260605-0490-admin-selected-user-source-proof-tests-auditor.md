# admin-selected-user-source-proof-tests-auditor handoff
## Scope
Phase 4.49 read-only tests/gates audit for adding dynamic Legacy closed-trade source-proof visibility to the admin selected-user bot drilldown in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Inspected tests and gate surfaces around:
- admin selected-user bot detail loader/static coverage
- bot statistics completion and read-safety coverage
- admin bot health loader/fleet diagnostics
- Playwright admin/user bot pages and managed admin-user DB matrix

This auditor did not read env/secret files, did not call live services/providers, did not mutate any live DB, did not start/stop/control bots or servers, and did not edit code/tests/docs other than this handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0410-phase-4-48-legacy-source-proof-visibility.md`
- `docs/handoffs/20260605-0410-legacy-source-proof-tests-auditor.md`
- `package.json`
- `scripts/gates.mjs`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `playwright.admin-user-bots-db.config.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/admin-bot-health-loader.test.ts`
- `tests/integration/admin-bot-completion-gate-map.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/legacy-closed-trade-source-proof-static.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/e2e/bot-statistics.spec.ts`

## Files changed
None - read-only audit, except this handoff.

## Findings
1. Severity P1 - The selected-user admin drilldown already has safe source-proof UI, but the data source is still a static fail-closed constant rather than the latest scoped Legacy worker metric proof. Evidence: `apps/web/src/features/admin/types.ts:51` defines the safe `AdminUserBotClosedTradeSourceProofSummary` DTO; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:63` through `apps/web/src/app/admin/users/[userId]/bots/page.tsx:96` renders status labels and missing-proof copy; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:221` through `apps/web/src/app/admin/users/[userId]/bots/page.tsx:225` adds a `Source-proof gate` row; `apps/web/src/features/admin/user-bot-detail-loader.ts:52` through `apps/web/src/features/admin/user-bot-detail-loader.ts:65` builds that DTO from `CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF`; `apps/web/src/features/admin/user-bot-detail-loader.ts:1246` assigns the constant for every Legacy selected-user bot. Recommendation: add a narrow dynamic projection that prefers the latest selected-user-scoped Legacy `bot_metric_snapshots.raw_json.closedTradeSourceProof` when present, then falls back to the static current-source-proof constant. Target part: `apps/web/src/features/admin/user-bot-detail-loader.ts` and `apps/web/src/features/admin/types.ts`.
2. Severity P1 - Current admin selected-user loader tests prove the static fail-closed summary, but they do not prove a dynamic worker snapshot can override it safely. Evidence: `tests/integration/admin-user-bot-detail-loader.test.ts:271` through `tests/integration/admin-user-bot-detail-loader.test.ts:278` seeds the scoped Legacy metric snapshot without `rawJson`; `tests/integration/admin-user-bot-detail-loader.test.ts:534` through `tests/integration/admin-user-bot-detail-loader.test.ts:540` asserts `blocked_no_source`, `blockerCount: 16`, and static missing requirement keys; `packages/db/src/repositories.ts:2204` through `packages/db/src/repositories.ts:2211` shows `insertBotMetricSnapshot()` already accepts `rawJson`, so the focused fixture can seed dynamic proof without schema changes. Recommendation: add one isolated loader test that seeds a scoped Legacy metric `rawJson.closedTradeSourceProof` with `ready_for_mapper`, `canImportClosedTrades: true`, and hostile extra fields, then asserts the DTO exposes only `status`, `canImportClosedTrades`, sanitized `missingRequirements`, and `blockerCount`. Add a companion ignored-source assertion using a newer unscoped Legacy metric and another user's provider-scoped metric. Target part: `tests/integration/admin-user-bot-detail-loader.test.ts`.
3. Severity P1 - Static source guards currently forbid `schema.botMetricSnapshots.rawJson` in the selected-user loader, which is correct for the current static implementation but will block a dynamic worker-proof projection unless the test is refined. Evidence: `tests/integration/admin-user-bot-detail-static.test.ts:44` through `tests/integration/admin-user-bot-detail-static.test.ts:49` forbids trade and metric raw JSON, then requires the static proof helper; `apps/web/src/features/bots/data.tsx:337` through `apps/web/src/features/bots/data.tsx:341` shows the current-user path already parses a tiny source-proof DTO from raw metric JSON; `apps/web/src/features/bots/data.tsx:666` through `apps/web/src/features/bots/data.tsx:704` returns only the safe summary, not the raw metric payload. Recommendation: if the admin loader must select raw metric JSON, update the static test to allow it only inside a named parser such as `closedTradeSourceProofFromMetricRaw()` and keep forbidding `rawJson`, `liveConfig`, provider payloads, env names, secrets, and mutation affordances in admin page output and returned DTO JSON. Target part: `tests/integration/admin-user-bot-detail-static.test.ts` and selected-user loader safety tests.
4. Severity P1 - The managed admin-user Playwright fixture and spec cover selected-user runtime/readiness states, but they do not seed or assert dynamic source-proof visibility. Evidence: `scripts/prepare-admin-user-bot-detail-e2e.ts:367` through `scripts/prepare-admin-user-bot-detail-e2e.ts:373` seeds the scoped Legacy metric without proof raw JSON; `tests/e2e/admin-user-bot-detail-db.spec.ts:22` through `tests/e2e/admin-user-bot-detail-db.spec.ts:31` defines scenario expectations without source-proof fields; `tests/e2e/admin-user-bot-detail-db.spec.ts:236` asserts only the scenario `statisticsLabel`; `tests/e2e/admin-user-bot-detail-db.spec.ts:257` through `tests/e2e/admin-user-bot-detail-db.spec.ts:270` builds visible markers without `Source-proof gate` or dynamic proof text. Recommendation: extend the throwaway DB fixture to seed the scoped Legacy metric's `rawJson.closedTradeSourceProof`; assert visible `Source-proof gate`, `source proof blocked` or `mapper-ready proof`, and sanitized missing-proof text; add hostile raw proof markers to the forbidden marker list. Target part: `scripts/prepare-admin-user-bot-detail-e2e.ts` and `tests/e2e/admin-user-bot-detail-db.spec.ts`.
5. Severity P2 - Admin bot health loader coverage should stay a regression gate, not the owner of selected-user dynamic source proof. Evidence: `apps/web/src/features/admin/bot-health-loader.ts:246` through `apps/web/src/features/admin/bot-health-loader.ts:260` intentionally reads `rawJson.liveConfig` for fleet Legacy runtime rows; `apps/web/src/features/admin/bot-health-loader.ts:418` through `apps/web/src/features/admin/bot-health-loader.ts:443` deduplicates latest fleet snapshots; `tests/integration/admin-bot-health-loader.test.ts:108` through `tests/integration/admin-bot-health-loader.test.ts:110` seeds fleet live-config raw JSON. Recommendation: keep dynamic selected-user source proof in `user-bot-detail-loader`; run admin health loader tests as a safety regression so the fleet raw-config reader stays sanitized and separate from selected-user attribution. Target part: admin health loader and selected-user loader boundary.
6. Severity P2 - Existing bot statistics and admin selected-user static tests already cover the rendered source-proof row/copy but should be kept in the focused gate list because shared helper refactors can regress both user and admin surfaces. Evidence: `tests/integration/bot-statistics-completion.test.ts:30` through `tests/integration/bot-statistics-completion.test.ts:41` pins user Legacy `Source-proof gate` and blocked copy; `tests/integration/bot-statistics-completion.test.ts:44` through `tests/integration/bot-statistics-completion.test.ts:54` pins selected-user statistics coverage and non-fabrication; `tests/integration/admin-user-bot-detail-static.test.ts:243` through `tests/integration/admin-user-bot-detail-static.test.ts:248` pins selected-user admin `Source-proof gate` copy. Recommendation: run these tests with the loader tests for the dynamic phase; update only the assertions needed to distinguish dynamic proof from static fallback. Target part: focused static/source-proof test pack.

## Decisions
1. No code, test, or product doc edits were made in this auditor lane.
2. Treated the requested next implementation as a dynamic hydration slice, not a new importer or live-provider probe.
3. Recommended `user-bot-detail-loader` as the correct selected-user owner; `bot-health-loader` remains fleet diagnostics.
4. Recommended fail-closed fallback to `CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF` when no scoped dynamic proof exists.
5. No background agents were launched from this auditor lane; this file is the requested per-agent handoff. No background agents remain open from this lane.

## Risks
1. A naive dynamic implementation could pass entire metric `rawJson` through the admin DTO/page, violating the selected-user raw-payload ban.
2. A dynamic implementation that ignores `botProviderAccountId` could show unscoped or another user's Legacy proof as selected-user evidence.
3. Treating `ready_for_mapper` as importer completion would overclaim; it should only mean the source contract can proceed to a separately audited mapper/importer.
4. Static guards must be refined carefully if raw metric JSON is selected for projection; deleting the guard outright would weaken the safety boundary.
5. Managed DB browser proof remains unavailable in this shell because the required admin maintenance DB env is not set.

## Verification/tests
RUN:
1. Protocol/docs/source inspection listed above.
2. `git status --short --branch` -> observed branch `codex/bot-analytics-settings-canary-20260603` with a pre-existing dirty tree and many untracked Phase 3/4 files. No attempt was made to revert or clean unrelated changes.
3. Env presence preflight for `WORKER_CONTINUITY_ADMIN_DATABASE_URL`, `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, `LEGACY_DATABASE_URL`, `LEGACY_LIVE_READS_ENABLED`, `DATABASE_URL`, and `REAL_POSTGRES_DATABASE_URL` -> all `NOT_SET`. Values were not printed.
4. `npx vitest run tests/integration/bot-statistics-completion.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-bot-completion-gate-map.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` -> PASS (`5` files, `49` tests).
5. `npx vitest run tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-bot-health-loader.test.ts` -> PASS (`2` files, `16` tests). These are normal isolated test DB suites, not live DB mutation.
6. `git diff --check -- docs/handoffs/20260605-0490-admin-selected-user-source-proof-tests-auditor.md` -> PASS.

NOT RUN:
1. Code/test/docs implementation edits - prohibited by this auditor scope; only this handoff was written.
2. `npm run e2e:admin-user-bots:db:managed:matrix` - NOT RUN because `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is not set; run only with a throwaway/admin maintenance Postgres URL, never a raw production DSN.
3. `npx playwright test -c playwright.admin-user-bots-db.config.ts` / `npm run e2e:admin-user-bots:db` - NOT RUN because the DB-backed fixture requires the managed runner/env path.
4. `npx playwright test tests/e2e/bot-statistics.spec.ts --project=desktop` - NOT RUN in this auditor lane; run after implementation only if shared source-proof helper/components or user statistics rendering change.
5. `npm run accept:bots:rendered` and `npm run accept:bots:local` - NOT RUN because this was a focused read-only tests/gates audit, not a rendered acceptance or full local acceptance phase.
6. `npm run typecheck -w @wtc/web`, root typecheck, lint, root `npm test`, web build, root `npm run secret:scan`, root governance, and full `git diff --check` - NOT RUN because no implementation code was changed in this lane. They are required after implementation.
7. Live Legacy DB/provider/exchange probes, live exchange-key ping, live bot start/stop/apply-config, worker live control, server deploy, CI, and production monitoring - NOT RUN; prohibited/out of scope for this read-only auditor lane.

Recommended focused implementation gates:
1. Loader/static source-proof pack:
   `npx vitest run tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-statistics-completion.test.ts tests/integration/bot-read-safety-static.test.ts`
2. Admin/fleet/harness regression pack:
   `npx vitest run tests/integration/admin-bot-health-loader.test.ts tests/integration/admin-bot-completion-gate-map.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
3. Web compile/safety pack:
   `npm run typecheck -w @wtc/web`
   `npm run secret:scan`
   `npm run governance:check`
   `git diff --check`
4. Managed rendered selected-user proof, only when `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is supplied:
   `npm run e2e:admin-user-bots:db:managed:matrix`
5. Optional broader rendered regression if shared user bot statistics components/helpers changed:
   `$env:E2E_PORT='<free-port>'; npx playwright test tests/e2e/bot-statistics.spec.ts --project=desktop`
   `npm run accept:bots:rendered`

## Next actions
1. Add a dynamic source-proof parser in `apps/web/src/features/admin/user-bot-detail-loader.ts` that accepts only `status`, `canImportClosedTrades`, sanitized `missingRequirements`, and `blockerCount` from the latest scoped Legacy metric proof.
2. Update `tests/integration/admin-user-bot-detail-loader.test.ts` to seed scoped, unscoped, and other-user metric raw proof payloads and assert only scoped safe DTO output.
3. Refine `tests/integration/admin-user-bot-detail-static.test.ts` so raw metric JSON is allowed only at the private parser boundary if needed, while page/DTO output remains raw-payload-free.
4. Extend `scripts/prepare-admin-user-bot-detail-e2e.ts` and `tests/e2e/admin-user-bot-detail-db.spec.ts` so the managed matrix proves visible dynamic source-proof status and absent hostile raw proof markers.
5. Keep Legacy importer/live-control/deploy work in separate audited phases; this phase should only prove admin selected-user dynamic source-proof visibility.
