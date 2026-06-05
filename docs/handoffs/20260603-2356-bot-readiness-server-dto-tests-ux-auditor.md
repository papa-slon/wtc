# bot-readiness-server-dto-tests-ux-auditor handoff
## Scope
Phase 3.84 read-only tests/UX acceptance audit for the WTC bot readiness server DTO. Scope: inspect the current dashboard/settings/setup/cabinet readiness UI and tests, then propose the focused acceptance suite that forces bot readiness surfaces to use a server-only `loadBotReadinessForUser` DTO instead of passing broad/raw objects into readiness rows.

This auditor did not edit product code or test code. It did not read or write `.env`, ping live exchanges, start/stop/apply/retest bots, tick/restart workers, touch SSH/tmux/systemd, or read/write provider DB state. This was a scoped per-agent audit; no background agents were spawned, and none were left running.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/handoffs/20260603-2346-phase-3-83-bot-readiness-dto.md`
5. `docs/handoffs/20260603-2312-bot-readiness-dto-tests-auditor.md`
6. `docs/handoffs/20260603-2312-bot-readiness-dto-ux-auditor.md`
7. `docs/handoffs/20260603-2312-bot-readiness-dto-platform-security-auditor.md`
8. `apps/web/src/features/bots/readiness.ts`
9. `apps/web/src/features/bots/BotReadinessMap.tsx`
10. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
11. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
12. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
13. `apps/web/src/features/cabinet/loader.ts`
14. `apps/web/src/features/cabinet/CabinetProductCard.tsx`
15. `packages/cabinet/src/derive.ts`
16. `apps/web/src/features/bots/data.tsx`
17. `apps/web/src/lib/backend.ts`
18. `packages/db/src/repositories.ts`
19. `tests/integration/bot-readiness-builder.test.ts`
20. `tests/integration/bot-read-safety-static.test.ts`
21. `tests/integration/cabinet-pg9.test.ts`
22. `tests/integration/user-resolved-bot-config-static.test.ts`
23. `tests/e2e/bot-readiness-map.spec.ts`
24. `tests/e2e/bot-settings.spec.ts`
25. `tests/e2e/cabinet-pg9-mobile.spec.ts`
26. `tests/integration/db-persistence.test.ts`
27. `package.json`

## Files changed
None - read-only audit. Required handoff only: `docs/handoffs/20260603-2356-bot-readiness-server-dto-tests-ux-auditor.md`.

## Findings
1. High - The server-only readiness DTO does not exist yet, and all four target surfaces still build readiness inputs locally from broader loaders or raw-shaped objects. Evidence: Phase 3.83 records `loadBotReadinessForUser` as still needed at `docs/handoffs/20260603-2346-phase-3-83-bot-readiness-dto.md:76` and next action at `docs/handoffs/20260603-2346-phase-3-83-bot-readiness-dto.md:115`; dashboard loads `loadBotReadModelForUser`, `loadBotConfig`, and `listExchangeKeys` at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:112-115`, then reads `config.raw` and derives readiness at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:124-143`; settings does the same through `legacyRead?.config.data?.raw` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:177-216`; setup does the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:194-239`; cabinet builds readiness rows inside `gatherSignals` at `apps/web/src/features/cabinet/loader.ts:84-103`. Recommendation: add static acceptance that dashboard, settings, setup, and cabinet call `loadBotReadinessForUser(...)` and do not import/call `buildBotReadinessItems` directly. Broad read models may still feed rich dashboard metrics, but readiness-map items must come only from the DTO. Target part: server DTO adoption.
2. High - The DTO needs behavior tests, not only source-string guards, because green states depend on provenance. Evidence: `listExchangeKeys` explicitly never joins the secret row at `packages/db/src/repositories.ts:404-407`, while `recordExchangeKeyMetadataCheck` proves owned account plus secret metadata but is a metadata-check mutation with `livePing: false` at `packages/db/src/repositories.ts:424-456`; Legacy DB snapshot loading already requires exactly one active user-scoped provider mapping at `apps/web/src/features/bots/data.tsx:314-344`. Recommendation: add a focused Vitest/PGlite `tests/integration/bot-readiness-server-dto.test.ts` that proves Tortila `metadata_saved` is not green, Tortila account-plus-secret metadata can become `vault_metadata_confirmed` without exposing secret fields, Legacy runtime snapshots alone stay `runtime_snapshot`, and exactly one active user-scoped DB provider mapping becomes `db_mapping_confirmed`. Target part: DTO provenance and data minimization.
3. High - The current static suite passes but would not fail if a page kept passing broad/raw data into readiness rows. Evidence: current static tests assert builder/callsite presence at `tests/integration/bot-read-safety-static.test.ts:79-99` and cabinet allowed-branch shape at `tests/integration/cabinet-pg9.test.ts:60-64`, but they still explicitly expect `buildBotReadinessItems` in page/cabinet sources rather than a server-only DTO. Recommendation: update `bot-read-safety-static.test.ts` and `cabinet-pg9.test.ts` so they fail on direct readiness construction in page/cabinet files, `config.raw` in readiness construction, `legacyRead?.config.data?.raw` as readiness proof, direct `listExchangeKeys` for readiness, or `providerAccounts` runtime snapshots being passed as green evidence. Target part: static acceptance guard.
4. Medium - Setup review wording still risks making dashboard-only evidence feel like a failed setup step. Evidence: the builder emits `Not checked here` for connection, runtime, and statistics gaps at `apps/web/src/features/bots/readiness.ts:91`, `apps/web/src/features/bots/readiness.ts:120`, `apps/web/src/features/bots/readiness.ts:147`, and `apps/web/src/features/bots/readiness.ts:160`; setup passes `runtime: null` and `statistics: null` for common setup-review cases at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:231-239`, then renders the review map at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:516-519`. Recommendation: for `surface: 'setup-review'`, either omit dashboard/statistics-only rows or copy them as `Dashboard-only read` / `Not loaded during setup`, with read-only status and non-blocking detail. Add mobile e2e to assert setup review does not show `Not checked here` as a visible current-state label. Target part: setup review UX acceptance.
5. Medium - User copy now separates some evidence states, but acceptance should require all five terms the operator named. Evidence: readiness states include `metadata_saved`, `vault_metadata_confirmed`, `runtime_snapshot`, and `db_mapping_confirmed` in `apps/web/src/features/bots/readiness.ts:36-38`; current builder copy distinguishes metadata and vault metadata at `apps/web/src/features/bots/readiness.ts:99-109`, runtime snapshot at `apps/web/src/features/bots/readiness.ts:145-149`, DB mapping in detail at `apps/web/src/features/bots/readiness.ts:130-135`, and live disabled at `apps/web/src/features/bots/readiness.ts:210-216`; builder tests cover some state behavior at `tests/integration/bot-readiness-builder.test.ts:75-112` but do not assert visible customer copy for all five terms. Recommendation: extend builder/static/e2e assertions so visible copy distinguishes `Exchange metadata saved`, `WTC vault metadata confirmed`, `Runtime snapshot`, `DB mapping confirmed`, and live-disabled policy copy. Target part: UX copy precision.
6. Medium - Mobile mechanics are sound at the component level, but the acceptance suite should prove the actual readiness surfaces. Evidence: `BotReadinessMap` uses `.wtc-table-wrap` and per-cell `data-label` attributes at `apps/web/src/features/bots/BotReadinessMap.tsx:31-49`; current e2e covers dashboard rows at `tests/e2e/bot-readiness-map.spec.ts:13-39`, settings at `tests/e2e/bot-settings.spec.ts:13-45`, and cabinet/setup navigation at `tests/e2e/cabinet-pg9-mobile.spec.ts:13-58`. Recommendation: keep those e2e files in the Phase 3.84 gate and add setup-review mobile assertions for visible wording and no horizontal scroll. Target part: browser acceptance.

## Decisions
1. Recommended implementation boundary: create `apps/web/src/features/bots/readiness-loader.ts` with `import 'server-only';` and `export async function loadBotReadinessForUser(userId, productCode, surface)`.
2. Keep `apps/web/src/features/bots/readiness.ts` pure and directly Vitest-tested. The server-only loader should gather authorized, sanitized scalar facts and call the pure builder internally or return builder-shaped rows.
3. Dashboard/settings/setup/cabinet should render `BotReadinessMap` from DTO rows, for example `items={readiness.items}`, and should not construct readiness rows from `config.raw`, `legacyRead?.config.data?.raw`, exchange-key arrays, runtime provider snapshots, or cabinet setup labels.
4. Cabinet must call the DTO only inside the existing `decision.allowed` branch; denied products must not gather readiness signals and must get no compact readiness rows.
5. `recordExchangeKeyMetadataCheck` should not run on passive page load because it writes audit/check metadata. The DTO needs a read-only account-plus-secret metadata summary or equivalent non-mutating repository projection.
6. Live exchange ping, live bot control, worker tick/restart, SSH/tmux/systemd, provider DB live access, and `.env` access remain out of scope for this suite.

## Risks
1. The worktree was heavily dirty before this audit. Observed branch: `codex/bot-analytics-settings-canary-20260603`; many product/test files and prior handoffs were already modified or untracked before this handoff was written.
2. Static tests can become brittle if they search whole page files for strings that are valid outside readiness construction. Prefer scoped import/callsite assertions plus small helper functions that slice around the readiness map block.
3. A loader test that imports a `server-only` file may need this repo's existing Vitest setup to tolerate the `server-only` package. If that blocks, export a pure projector from `readiness.ts` and keep DB/loader wiring covered by static tests plus a narrower integration test.
4. If the DTO reuses `loadBotReadModelForUser(['config'])` internally, it can reintroduce `config.raw` leakage. Acceptance should require explicit sanitized fields in the DTO serialization test.

## Verification/tests
RUN:
1. Read required files: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, and `docs/handoffs/20260603-2346-phase-3-83-bot-readiness-dto.md`.
2. Read prior Phase 3.83 auditor handoffs for tests, UX, and platform/security context.
3. Checked git branch/status. Observed pre-existing dirty worktree on `codex/bot-analytics-settings-canary-20260603`.
4. Source-inspected readiness builder, dashboard, settings, setup, cabinet loader/card, DB/provider mapping code, static tests, and e2e specs listed above.
5. `rg -n "loadBotReadinessForUser|BotReadinessForUser|server-only DTO|DTO" apps/web/src tests docs/handoffs/20260603-2346-phase-3-83-bot-readiness-dto.md` - observed no implementation in `apps/web/src` or `tests`; only Phase 3.83 documentation references.
6. `npm run test -- tests/integration/bot-readiness-builder.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/cabinet-pg9.test.ts` - PASS, 3 files, 48 tests.
7. `npm run governance:check` - PASS, 0 errors and 1 known historical warning for `20260529-1921-integration-risk-auditor.md`.

NOT RUN:
1. Playwright e2e - not run; this read-only audit did not start a local web server.
2. Typecheck/lint/build - not run; no product/test code was edited.
3. Full `npm test` - not run; focused baseline only.
4. `db:migrate`, `db:seed`, or migration generation - not run; audit only.
5. Live exchange ping/test - not run by policy.
6. Live bot start/stop/apply-config/retest - not run by policy.
7. Worker tick/restart - not run by policy.
8. SSH/tmux/systemd/provider DB live read/write - not run by policy.
9. `.env` read/write or vault open/decrypt - not run by policy.
10. Git stage/commit/push/PR - not requested.

## Next actions
1. Add `tests/integration/bot-readiness-server-dto-static.test.ts`:
   - Assert `apps/web/src/features/bots/readiness-loader.ts` exists, imports `server-only`, and exports `loadBotReadinessForUser`.
   - Assert dashboard, settings, setup, and cabinet loader import/call `loadBotReadinessForUser`.
   - Assert dashboard/settings/setup/cabinet loader do not import/call `buildBotReadinessItems` directly.
   - Assert readiness-map item props come from the DTO, not local `readinessItems = buildBotReadinessItems(...)`.
   - Forbid readiness construction from `config.raw`, `legacyRead?.config.data?.raw`, `providerAccounts`, `activeSlots`, `activeOrderSummary`, `rawJson`, `listExchangeKeys`, `getBotAdapter`, `fetch(`, `vault.open`, `recordExchangeKeyMetadataCheck`, `startBot`, `stopBot`, `applyConfig`, `retest`, `apiKey`, `apiSecret`, `sealed`, `LEGACY_DATABASE_URL`, and `TORTILA_JOURNAL_URL` in the page/cabinet readiness path.
2. Add `tests/integration/bot-readiness-server-dto.test.ts`:
   - Access denied returns only a blocked Access row and serializes no connection/runtime/statistics/config facts.
   - Tortila no account returns `missing`/attention and copy does not claim live connectivity.
   - Tortila account metadata without secret proof returns `metadata_saved`/attention.
   - Tortila owned account plus encrypted secret metadata proof returns `vault_metadata_confirmed`/ready while serialized DTO excludes `sealed`, `wrappedDek`, `payload`, `apiKey`, `apiSecret`, and plaintext secrets.
   - Legacy no active user-scoped provider mapping returns missing/attention.
   - Legacy runtime snapshot evidence alone returns `runtime_snapshot`/attention, never green.
   - Legacy exactly one active user-scoped DB provider mapping returns `db_mapping_confirmed`/ready.
   - Legacy zero or multiple active mappings do not become ready.
   - DTO JSON excludes `raw`, `rawJson`, `providerAccounts`, `activeSlots`, `activeOrderSummary`, provider DB URL/config fields, and adapter response bodies.
3. Update `tests/integration/bot-readiness-builder.test.ts`:
   - Keep the existing status matrix.
   - Add visible-copy assertions for `Exchange metadata saved`, `WTC vault metadata confirmed`, `Runtime snapshot`, `DB mapping confirmed`, and `Start/stop/apply disabled` / `Disabled`.
   - Add setup-review assertions that absent operational evidence renders `Dashboard-only read` or `Not loaded during setup`, not `Not checked here`.
4. Update `tests/integration/bot-read-safety-static.test.ts`:
   - Move page/cabinet assertions from "uses shared builder" to "uses server-only DTO loader".
   - Keep forbidden import/control/secret checks for `readiness.ts`, `readiness-loader.ts`, and `BotReadinessMap.tsx`.
   - Assert `BotReadinessMap.tsx` remains presentational and has no backend/db/vault/adapter/live-control imports.
5. Update `tests/integration/cabinet-pg9.test.ts`:
   - Keep the existing `decision.allowed ? await gatherSignals(...) : undefined` fail-closed guard.
   - Assert the allowed bot branch calls `loadBotReadinessForUser` for compact readiness rows.
   - Assert denied/unallowed branches cannot call the DTO, `listExchangeKeys`, `loadBotConfig`, or direct readiness builder code.
   - Assert denied cards have empty `readiness.items`.
6. Update e2e:
   - Keep `tests/e2e/bot-readiness-map.spec.ts` for dashboard desktop/mobile visibility and no `Connection verified`.
   - Extend it or add `tests/e2e/bot-readiness-server-dto.spec.ts` to visit `/app/bots/tortila/setup?step=review` and `/app/bots/legacy/setup?step=review` at 375px, assert no horizontal scroll, assert setup review does not show `Not checked here`, and assert live disabled copy is visible.
   - Keep `tests/e2e/bot-settings.spec.ts` and `tests/e2e/cabinet-pg9-mobile.spec.ts` in the focused acceptance gate.
7. Exact focused commands after implementation:
   - `npm run test -- tests/integration/bot-readiness-builder.test.ts tests/integration/bot-readiness-server-dto.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/cabinet-pg9.test.ts`
   - `npm run typecheck -w @wtc/web`
   - `npm run e2e -- tests/e2e/bot-readiness-map.spec.ts tests/e2e/bot-settings.spec.ts tests/e2e/cabinet-pg9-mobile.spec.ts`
   - `npm run secret:scan`
   - `npm run governance:check`
