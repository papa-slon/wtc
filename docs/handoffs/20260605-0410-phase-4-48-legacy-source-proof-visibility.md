# Phase 4.48 Legacy source-proof visibility handoff

## Scope
Safe no-live user-facing visibility for the Phase 4.47 Legacy closed-trade source-proof state. This phase did not build a
Legacy closed-trade importer and did not change live-control behavior. It promoted only the worker's small safe
`closedTradeSourceProof` summary into the current-user bot read model and Legacy statistics panel so users can see why
realized Legacy analytics remain unavailable.

Read-only phase handoffs:
- [20260605-0410-legacy-source-proof-ux-auditor.md](20260605-0410-legacy-source-proof-ux-auditor.md)
- [20260605-0410-legacy-source-proof-safety-auditor.md](20260605-0410-legacy-source-proof-safety-auditor.md)
- [20260605-0410-legacy-source-proof-tests-auditor.md](20260605-0410-legacy-source-proof-tests-auditor.md)

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0333-phase-4-47-legacy-source-proof-preflight.md`
- [20260605-0410-legacy-source-proof-ux-auditor.md](20260605-0410-legacy-source-proof-ux-auditor.md)
- [20260605-0410-legacy-source-proof-safety-auditor.md](20260605-0410-legacy-source-proof-safety-auditor.md)
- [20260605-0410-legacy-source-proof-tests-auditor.md](20260605-0410-legacy-source-proof-tests-auditor.md)
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/legacy-closed-trade-source-proof.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-bot-health-loader.test.ts`
- `tests/e2e/bot-statistics.spec.ts`

## Files changed
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0410-legacy-source-proof-ux-auditor.md`
- `docs/handoffs/20260605-0410-legacy-source-proof-safety-auditor.md`
- `docs/handoffs/20260605-0410-legacy-source-proof-tests-auditor.md`
- `docs/handoffs/20260605-0410-phase-4-48-legacy-source-proof-visibility.md`

## Findings
1. Severity P1 - Legacy source proof was written by the worker but not visible on the user statistics path. Evidence:
   Phase 4.47 writes `rawJson.closedTradeSourceProof`; before this phase `apps/web/src/features/bots/data.tsx` extracted
   `liveConfig` only. Recommendation: keep a narrow projection helper for source-proof status. Target part: user bot read
   model.
2. Severity P1 - Generic `pending import` copy was not enough to explain the safety block. Evidence:
   `LegacyOperationsPanel` previously displayed closed-trade history as pending while Phase 4.47 recorded
   `blocked_no_source`. Recommendation: show a `Source-proof gate` metric/pill and blocked-source warning copy while
   keeping realized stats unavailable. Target part: user Legacy statistics.
3. Severity P1 - The safe payload is intentionally tiny. Evidence:
   `closedTradeSourceProofFromRaw()` accepts only `blocked_no_source` / `ready_for_mapper`, boolean importability, and
   sanitized missing-requirement keys; it does not pass `rawJson`, `liveConfig`, provider payloads, evidence refs, env
   names, or secret-shaped fields through React props. Recommendation: future admin hydration should reuse the same
   projection boundary, not raw metric JSON. Target part: safety boundary.
4. Severity P2 - The rendered proof needed to pin the new gate, not just old pending text. Evidence:
   `tests/e2e/bot-statistics.spec.ts` now requires `Source-proof gate` on the Legacy statistics page while still requiring
   no fabricated equity curve / net PnL / closed-trade analytics. Recommendation: keep this in the bot statistics e2e set.
   Target part: rendered acceptance.

## Decisions
1. Implemented the user Legacy statistics visibility slice only; no live bot control, no importer, no exchange ping, and no
   provider probe was added.
2. Did not read selected-user admin metric `rawJson` in this phase because existing admin-user static safety tests forbid
   raw metric/trade JSON in that loader path. Admin dynamic hydration should be a separate DTO-safe phase if needed.
3. Left mock/no-live rendered E2E honest: demo adapter pages show the `Source-proof gate`; DB-backed worker snapshots can
   show `blocked_no_source` when present.
4. Closed the three background agents for this phase after collecting their handoffs.

## Risks
1. Legacy closed-trade import remains blocked until a real source artifact proves stable trade/fill id, provider mapping,
   economic fields, close timestamps, replay semantics, and raw-payload allowlist.
2. Admin selected-user drilldown still needs a carefully designed safe projection if it should display dynamic
   `closedTradeSourceProof`; do not satisfy that by passing raw metric JSON into the page.
3. `ready_for_mapper` must not be treated as importer completion or live-control approval in a future phase.
4. Managed DB, live provider/exchange, deploy, and CI gates remain unproven for the current dirty tree.

## Verification/tests
RUN:
1. This phase's read-only agents created handoffs before implementation:
   [20260605-0410-legacy-source-proof-ux-auditor.md](20260605-0410-legacy-source-proof-ux-auditor.md),
   [20260605-0410-legacy-source-proof-safety-auditor.md](20260605-0410-legacy-source-proof-safety-auditor.md), and
   [20260605-0410-legacy-source-proof-tests-auditor.md](20260605-0410-legacy-source-proof-tests-auditor.md).
2. Environment preflight checked `WORKER_CONTINUITY_ADMIN_DATABASE_URL`, `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`,
   `LEGACY_DATABASE_URL`, `LEGACY_LIVE_READS_ENABLED`, and `DATABASE_URL`; none were set in this shell.
3. `npm run typecheck -w @wtc/web` -> PASS.
4. `npx vitest run tests/integration/bot-statistics-completion.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/legacy-closed-trade-source-proof-static.test.ts`
   -> PASS (`3` files, `38` tests) before the final rendered assertion update.
5. `npx vitest run tests/integration/bot-statistics-completion.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts`
   -> PASS (`3` files, `39` tests).
6. `npx vitest run tests/integration/admin-bot-health-loader.test.ts` -> PASS (`1` file, `9` tests).
7. `npx playwright test tests/e2e/bot-statistics.spec.ts --project=chromium` -> CONFIG ERROR before tests; this repo's
   Playwright projects are `desktop` and `mobile`.
8. `npx playwright test tests/e2e/bot-statistics.spec.ts --project=desktop` with default `E2E_PORT=3410` -> BLOCKED before
   tests because an existing Next process already used the port.
9. `$env:E2E_PORT='3511'; npx playwright test tests/e2e/bot-statistics.spec.ts --project=desktop` -> PASS (`2` tests).
   A follow-up port check showed no lingering `3511` listener, only `TIME_WAIT`.
10. `npm run secret:scan` -> PASS.
11. `npm run governance:check` -> PASS (`0` errors, one known historical warning).
12. `git diff --check` -> PASS.
13. Completed background agents were closed after collecting results:
    `019e95e6-b3a4-7e51-9495-602c44ab8960`, `019e95e7-1d07-7f73-a328-641ec2b34834`, and
    `019e95e7-690a-73f0-902a-ac5f1cdd89e7`.

NOT RUN:
1. Legacy closed-trade importer - still blocked by absent source proof.
2. Dynamic selected-user admin source-proof projection - deferred because the current selected-user loader safety boundary
   forbids raw metric JSON and needs a separate safe DTO design.
3. `npm run accept:worker:continuity:managed` - blocked by missing `WORKER_CONTINUITY_ADMIN_DATABASE_URL`.
4. `npm run e2e:admin-user-bots:db:managed:matrix` - blocked by missing `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`.
5. Playwright `mobile` for bot statistics - not run in this focused phase; desktop covered the changed Legacy statistics
   gate and existing responsive suites remain separate gates.
6. Full `npm run accept:bots:local` / `npm run accept:bots:rendered` - not rerun because this phase was a focused
   source-proof visibility slice.
7. Live Legacy DB/provider/exchange probes, live exchange key ping, live bot start/stop/apply-config - blocked by safety
   protocol and absent approved adapters.
8. Production deploy, canary switch, GitHub CI, and monitoring/burn-in - outside this focused local phase.

## Next actions
1. If a real Legacy closed-trade source artifact appears, validate it against the Phase 4.47 preflight before building a
   provider-scoped mapper/importer.
2. If admin selected-user dynamic source-proof visibility is needed next, design a DTO-safe loader projection first and keep
   `rawJson`, `liveConfig`, provider payloads, env names, secrets, and live-control affordances out of the page.
3. If throwaway DB env is supplied, run the managed worker continuity and admin selected-user DB matrix gates as separate
   phases.
