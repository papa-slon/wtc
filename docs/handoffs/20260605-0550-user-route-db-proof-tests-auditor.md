# ecosystem-tests-runner handoff
## Scope
Read-only Phase 4.54 user-route Tortila DB proof tests/rendered audit. Scope was to design the smallest focused test/spec/harness that proves ordinary user routes `/app/bots/tortila`, `/app/bots/tortila/positions`, and `/app/bots/statistics?bot=tortila` render hostile real-source Tortila Mark/uPnL placeholders as `N/A`, use no up/down styling for those unavailable values, and do not show `/api/marks`, exchange, or live-control proof.

This audit did not edit code, run live servers, touch env/secrets, call `/api/marks`, call exchanges/providers, or inspect bot controls beyond static safety/test evidence.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0535-phase-4-53-tortila-mark-unavailable-user-admin.md`
- `package.json`
- `playwright.config.ts`
- `playwright.admin-user-bots-db.config.ts`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`

## Files changed
None - read-only audit

## Findings
1. Severity P1 - The missing proof is a user-route managed DB rendered lane, not another app-rendering change. Evidence: `docs/STATUS.md:14-23` says Phase 4.53 already made user dashboard, positions, and statistics render Tortila Mark/uPnL as neutral `N/A`, but user-route managed DB browser proof remains NOT RUN; `docs/NEXT_ACTIONS.md:113-116` names the exact required future gate: seed hostile Tortila Mark/uPnL values under a real source adapter and prove the three user routes render `N/A` without up/down styling or `/api/marks` calls. Recommendation: add the smallest opt-in user-route DB Playwright lane rather than modifying production UI logic. Target part: new user-route DB proof harness/spec.
2. Severity P1 - Existing user read-model and pages already expose the branch that the new DB fixture must exercise. Evidence: `apps/web/src/features/bots/data.tsx:539-546` derives `markUnavailable` for Tortila from real metric/position/source adapters; `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:239-243` and `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:38-42` show source-boundary copy that WTC does not call `/api/marks` or a live exchange to fill Mark/uPnL; `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:259,289-290`, `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:64-65`, and `apps/web/src/app/(app)/app/bots/statistics/page.tsx:202-204,295,491,519` render `N/A` and suppress up/down classes when `markUnavailable` is true. Recommendation: seed persisted Tortila rows with real-like `sourceAdapter` plus hostile numeric Mark/uPnL and assert the current user routes render the unavailable path. Target part: DB fixture plus rendered assertions.
3. Severity P1 - The closest reusable pattern is the selected-user admin DB harness, but it should not be expanded into admin proof for this scope. Evidence: `package.json:36-38` registers opt-in DB scripts; `playwright.admin-user-bots-db.config.ts:13-23` refuses unprepared DB runs and validates a prep marker; `scripts/run-admin-user-bot-detail-e2e.mjs:21-40` creates a prep token and scrubbed no-live env; `scripts/run-admin-user-bot-detail-e2e-managed.mjs:29-49,101-124` validates a maintenance URL, creates a throwaway `wtc_test_admin_user_bots_*` DB, delegates to the harness, and drops the DB. Recommendation: mirror this architecture with new user-route names, e.g. `scripts/prepare-user-tortila-mark-unavailable-e2e.ts`, `scripts/run-user-tortila-mark-unavailable-e2e.mjs`, `scripts/run-user-tortila-mark-unavailable-e2e-managed.mjs`, and `playwright.user-tortila-mark-unavailable-db.config.ts`. Target part: new opt-in managed runner.
4. Severity P1 - The fixture must be hostile enough to fail if the UI accidentally trusts persisted mark/uPnL values. Evidence: the admin fixture already seeds Tortila metric `unrealizedPnlUsd: '3.0000'` at `scripts/prepare-admin-user-bot-detail-e2e.ts:340-350` and a Tortila position with `markPrice: '105.00000000'` plus `unrealizedPnlUsd: '12.5000'` at `scripts/prepare-admin-user-bot-detail-e2e.ts:398-415`; the admin rendered spec asserts that same seeded position displays `Mark` and `uPnL` as `N/A` at `tests/e2e/admin-user-bot-detail-db.spec.ts:303-306`. Recommendation: the new user-route fixture should seed a normal entitled user with one Tortila bot instance, one latest metric, and one latest position using unmistakable hostile numeric values and source markers, then assert those values and markers do not appear as Mark/uPnL proof on `/app/bots/tortila`, `/app/bots/tortila/positions`, and `/app/bots/statistics?bot=tortila`. Target part: user-route DB fixture.
5. Severity P2 - Default/local rendered tests are useful regression gates but cannot prove this DB branch. Evidence: `playwright.config.ts:7-10` ignores only dedicated opt-in DB specs and runs the default e2e pack separately; `tests/e2e/smoke.spec.ts:126-132` covers `/app/bots/tortila/positions` and `/app/bots/statistics?bot=tortila` in mock mode; `tests/e2e/bot-statistics.spec.ts:44-64` covers Tortila statistics source-boundary copy in ordinary mock/no-env mode. Recommendation: keep `accept:bots:rendered`/`accept:bots:local` as regression proof, but do not claim user-route hostile DB proof until the new managed lane runs against a throwaway DB. Target part: gate reporting.
6. Severity P2 - Add a cheap static harness test so fixture/spec drift fails before browser startup. Evidence: `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:25-34` pins opt-in script registration/exclusion from defaults; `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:36-45` pins throwaway marker requirements; `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:60-99` pins seeded marker/no-live boundaries; `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:130-175` pins the rendered spec's row-scoped assertions; `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:188-204` pins missing-URL/unknown-arg redaction behavior. Recommendation: add `tests/integration/user-tortila-mark-unavailable-db-e2e-harness.test.ts` with the same categories: script registration, throwaway DB guard, prep marker HMAC, no-live env, hostile Mark/uPnL fixture strings, three route URLs, `N/A` assertions, no `wtc-up`/`wtc-down` on unavailable cells, and hidden `/api/marks`/exchange/live-control proof text. Target part: static preflight.
7. Severity P2 - Recommended command list should separate implementation proof, managed proof, and safety scans. Evidence: `package.json:13-15` exposes typecheck/test/Vitest basics; `package.json:44-46` exposes current local bot rendered/continuity gates; `docs/NEXT_ACTIONS.md:100-103` requires artifact scanning after DB matrix runs; `scripts/run-admin-user-bot-detail-e2e-managed.mjs:14-24` documents the managed DB URL usage and artifact retention warning. Recommendation: after adding the new lane, run:
   - `npx vitest run tests/integration/user-tortila-mark-unavailable-db-e2e-harness.test.ts tests/integration/bot-read-safety-static.test.ts`
   - `npm run typecheck -w @wtc/web`
   - `npm run typecheck`
   - `npm run secret:scan`
   - `npm run governance:check`
   - `git diff --check`
   - when `USER_TORTILA_MARK_E2E_ADMIN_DATABASE_URL` is supplied: `npm run e2e:user-tortila-mark-unavailable:db:managed`
   - optional full local regression: `npm run accept:bots:rendered`
   - after managed browser proof: scan redacted stdout/stderr, `test-results`, `playwright-report`, and `tests/e2e/screenshots` for hostile marker leakage before retaining artifacts.
   Target part: verification plan and phase final report.

## Decisions
1. Recommended a new dedicated user-route DB proof lane instead of modifying the existing selected-user admin DB harness, because the requested acceptance target is ordinary `/app/...` user routes.
2. Recommended reusing the admin DB harness architecture: guarded preparer, HMAC marker, throwaway DB-name refusal, scrubbed no-live env, opt-in Playwright config, and managed create/drop runner.
3. Recommended one hostile fixture scenario first, not a runtime-health matrix, because the proof target is deterministic Mark/uPnL unavailability across three user routes.
4. Did not recommend production-only test hooks or forced runtime flags; the fixture should drive the real DB snapshot branch.

## Risks
1. Until the new managed lane exists and runs, the user-route hostile DB proof remains NOT RUN.
2. A static-only test could miss a route-specific rendering regression; the browser spec must visit all three requested routes.
3. Reusing visible text assertions without cell/class scoping could miss accidental `wtc-up`/`wtc-down` styling on the unavailable uPnL cells.
4. Artifact retention can leak hostile marker strings if stdout, traces, screenshots, or reports are archived before review/scanning.
5. Live journal/auth/firewall, `/api/marks`, exchange pings, and live bot control remain separate blocked gates and must not be folded into this proof.

## Verification/tests
RUN:
1. Read required protocol/status docs and Phase 4.53 aggregate handoff.
2. Static file inspection only of existing user routes, read model, Playwright configs, scripts, DB preparer, e2e specs, and integration harness patterns.
3. `git status --short --branch` observed a dirty branch with many pre-existing modified/untracked files; this audit did not revert or normalize them.
4. Confirmed target handoff path did not exist before writing.

NOT RUN:
1. No Vitest, Playwright, typecheck, secret scan, governance, or diff gates were run in this read-only design audit.
2. No live server was started or touched.
3. No managed DB browser proof was run; no throwaway DB env was supplied.
4. No Tortila journal, `/api/marks`, exchange, provider, or live-control endpoint was called.

Recommended smallest future gate set after adding the lane:
1. `npx vitest run tests/integration/user-tortila-mark-unavailable-db-e2e-harness.test.ts tests/integration/bot-read-safety-static.test.ts`
2. `npm run typecheck -w @wtc/web`
3. `npm run typecheck`
4. `npm run secret:scan`
5. `npm run governance:check`
6. `git diff --check`
7. `USER_TORTILA_MARK_E2E_ADMIN_DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<maintenance_db> npm run e2e:user-tortila-mark-unavailable:db:managed`
8. Optional regression after focused proof: `npm run accept:bots:rendered`

## Next actions
1. Add the dedicated user-route DB proof files named in Findings 3 and 6, plus package scripts `e2e:user-tortila-mark-unavailable:db`, `e2e:user-tortila-mark-unavailable:db:managed`, and optionally `e2e:user-tortila-mark-unavailable:db:managed:matrix` only if multiple deterministic fixture scenarios become necessary.
2. In the new Playwright spec, login as the ordinary seeded user and visit `/app/bots/tortila`, `/app/bots/tortila/positions`, and `/app/bots/statistics?bot=tortila`; assert hostile mark/uPnL source values are not visible as proof, Mark/uPnL cells/cards show `N/A`, unavailable uPnL cells have no up/down class, `/api/marks` appears only in source-boundary exclusion copy if expected, and no exchange/live-control proof appears.
3. Keep this lane opt-in and blocked until a throwaway maintenance DB URL is supplied; do not run it against production or a raw app DB.
4. Keep real Tortila journal continuity, source-config provenance, safety-signal ingestion, identity scope, `/api/marks` exclusion, exchange ping, and live bot controls outside this user-route proof.
