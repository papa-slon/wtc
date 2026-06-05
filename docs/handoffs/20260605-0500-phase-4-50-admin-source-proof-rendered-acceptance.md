# Phase 4.50 admin source-proof rendered acceptance handoff

## Scope
Rendered-acceptance hardening for the admin selected-user Legacy `Source-proof gate`. This phase pinned the DB fixture/spec
contract so the selected-user admin browser test must render the scoped Legacy source-proof status/provenance and must not
render unscoped proof, raw proof internals, provider ids, API-key-shaped fields, or control affordances.

This phase did not add a Legacy closed-trade importer, live exchange ping, live provider probe, bot start/stop/apply-config,
user-setting mutation, production deploy, or CI release.

Read-only phase handoffs:
- [20260605-0500-admin-source-proof-rendered-ux-auditor.md](20260605-0500-admin-source-proof-rendered-ux-auditor.md)
- [20260605-0500-admin-source-proof-rendered-safety-auditor.md](20260605-0500-admin-source-proof-rendered-safety-auditor.md)
- [20260605-0500-admin-source-proof-rendered-tests-auditor.md](20260605-0500-admin-source-proof-rendered-tests-auditor.md)

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0490-phase-4-49-admin-selected-user-source-proof.md`
- [20260605-0500-admin-source-proof-rendered-ux-auditor.md](20260605-0500-admin-source-proof-rendered-ux-auditor.md)
- [20260605-0500-admin-source-proof-rendered-safety-auditor.md](20260605-0500-admin-source-proof-rendered-safety-auditor.md)
- [20260605-0500-admin-source-proof-rendered-tests-auditor.md](20260605-0500-admin-source-proof-rendered-tests-auditor.md)
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `playwright.admin-user-bots-db.config.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/legacy-closed-trade-source-proof-static.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts`

## Files changed
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0500-admin-source-proof-rendered-ux-auditor.md`
- `docs/handoffs/20260605-0500-admin-source-proof-rendered-safety-auditor.md`
- `docs/handoffs/20260605-0500-admin-source-proof-rendered-tests-auditor.md`
- `docs/handoffs/20260605-0500-phase-4-50-admin-source-proof-rendered-acceptance.md`

## Findings
1. Severity P1 - The DB selected-user fixture now carries the source-proof rendered acceptance payload. Evidence:
   `scripts/prepare-admin-user-bot-detail-e2e.ts` seeds a newer unscoped Legacy metric with
   `UNSCOPED_SOURCE_PROOF_SHOULD_NOT_RENDER` and a provider-scoped Legacy metric with `ready_for_mapper`,
   `canImportClosedTrades: true`, and hostile sibling/raw fields. Recommendation: keep the unscoped row newer than the
   scoped row so the test proves provider filtering happens before proof selection. Target part: DB fixture.
2. Severity P1 - Browser assertions must prove the row is in the Legacy statistics coverage matrix, not merely somewhere
   in body text. Evidence: `tests/e2e/admin-user-bot-detail-db.spec.ts` now asserts a single `Source-proof gate` row inside
   `Legacy Bot statistics coverage matrix`, expects `mapper-ready proof`, `scoped worker metric`, the importer-replay
   caveat, and `build audited mapper/importer`, and asserts Tortila has no source-proof gate. Recommendation: keep future
   source-proof rendered checks row-scoped. Target part: selected-user DB Playwright spec.
3. Severity P1 - Raw proof/provider/secret-shaped fields are now explicit negative markers. Evidence:
   `tests/e2e/admin-user-bot-detail-db.spec.ts` hides `UNSCOPED_SOURCE_PROOF_SHOULD_NOT_RENDER`,
   `SOURCE_PROOF_API_KEY_SHOULD_NOT_RENDER`, `SOURCE_PROOF_PAYLOAD_ALLOWLIST_SHOULD_NOT_RENDER`,
   `SOURCE_PROOF_BLOCKER_SHOULD_NOT_RENDER`, `SOURCE_PROOF_EVIDENCE_REF_SHOULD_NOT_RENDER`,
   `SOURCE_PROOF_RAW_PROVIDER_ID_SHOULD_NOT_RENDER`, and `SOURCE_PROOF_RAW_API_KEY_SHOULD_NOT_RENDER`. Recommendation:
   scan retained artifacts for the same markers after any managed DB browser run. Target part: leak proof.
4. Severity P1 - Static harness coverage now pins the source-proof fixture/spec contract before browser execution.
   Evidence: `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` asserts the fixture contains
   `closedTradeSourceProof`, `ready_for_mapper`, unscoped/raw hostile markers, and that the e2e spec contains visible,
   hidden, and row-scoped source-proof checks. Recommendation: keep this harness as the cheap first failure when the DB
   rendered test contract drifts. Target part: harness guard.
5. Severity P2 - Managed rendered DB proof is ready to run but remains environment-blocked in this shell. Evidence: the env
   preflight observed `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL=NOT_SET`; the managed runner requires that maintenance DB URL
   to create/drop guarded `wtc_test_admin_user_bots_*` databases. Recommendation: do not mark the DB browser matrix green
   until that env is supplied and the managed matrix plus artifact scan pass. Target part: acceptance protocol.

## Decisions
1. Treated Phase 4.50 as test/harness acceptance hardening only; no app source-proof semantics changed after Phase 4.49.
2. Accepted `ready_for_mapper` copy only with the explicit caveat that importer replay remains a separate gate.
3. Kept `Source-proof gate` Legacy-only and control-free: the row has no buttons or links, and the page-level no-form/no-live
   control assertions remain.
4. Kept `npm run accept:bots:local` and `npm run accept:bots:rendered` separate from selected-user DB acceptance; neither is
   a substitute for `npm run e2e:admin-user-bots:db:managed:matrix`.
5. Closed all three background agents after collecting their handoffs.

## Risks
1. The actual DB-backed browser matrix is still NOT RUN in this shell because the required admin maintenance Postgres env is
   absent.
2. Retained screenshots/traces from a future managed DB run can become a leak path unless scanned for the hidden markers and
   URL/password patterns.
3. `ready_for_mapper` is source-contract readiness only; Legacy realized PnL, win rate, profit factor, fees, funding, and
   attribution remain pending until a separately audited mapper/importer replay gate exists.
4. Future source-proof fixture edits must preserve the newer unscoped row plus older scoped row pattern, or the test will no
   longer prove provider-scope selection.

## Verification/tests
RUN:
1. This phase's read-only agents created handoffs before implementation:
   [20260605-0500-admin-source-proof-rendered-ux-auditor.md](20260605-0500-admin-source-proof-rendered-ux-auditor.md),
   [20260605-0500-admin-source-proof-rendered-safety-auditor.md](20260605-0500-admin-source-proof-rendered-safety-auditor.md), and
   [20260605-0500-admin-source-proof-rendered-tests-auditor.md](20260605-0500-admin-source-proof-rendered-tests-auditor.md).
2. Environment preflight checked `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, `WORKER_CONTINUITY_ADMIN_DATABASE_URL`,
   `LEGACY_DATABASE_URL`, `LEGACY_LIVE_READS_ENABLED`, `DATABASE_URL`, and `REAL_POSTGRES_DATABASE_URL`; all were `NOT_SET`
   in this shell. Values were not printed.
3. `npx vitest run tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/legacy-closed-trade-source-proof-static.test.ts tests/integration/bot-statistics-completion.test.ts`
   -> PASS (`5` files, `32` tests).
4. `npm run typecheck -w @wtc/web` -> PASS.
5. `npm run typecheck` -> PASS.
6. `npm run secret:scan` -> PASS.
7. `git diff --check` -> PASS.
8. `npm run governance:check` -> PASS (`current phase 20260605-0500`; `3 cited per-agent handoff(s), all present`; `0`
   errors, one known historical warning).
9. Completed background agents were closed after collecting results:
   `019e960f-2f33-7aa0-8646-aeaa0ff07feb`, `019e960f-4347-7562-9b6f-8a0cb6cb770b`, and
   `019e960f-5883-71b2-a938-76f815e6e0fb`.

NOT RUN:
1. `npm run e2e:admin-user-bots:db:managed:matrix` - blocked by missing `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`.
2. `npm run e2e:admin-user-bots:db` / direct `playwright.admin-user-bots-db.config.ts` - blocked by missing guarded
   throwaway DB URL and prepared HMAC marker; prefer the managed matrix when env is supplied.
3. `npm run accept:worker:continuity:managed` - blocked by missing `WORKER_CONTINUITY_ADMIN_DATABASE_URL`.
4. `npm run accept:bots:local` / `npm run accept:bots:rendered` - not run in this focused selected-user DB acceptance
   hardening phase; previous local mock/no-live results remain recorded in earlier aggregates.
5. Reviewed visual manifest for new DB screenshots - not run because no managed DB browser screenshots were generated.
6. Live Legacy DB/provider/exchange probes, live exchange key ping, live bot start/stop/apply-config - blocked by safety
   protocol and absent approved adapters.
7. Production deploy, canary switch, GitHub CI, and monitoring/burn-in - outside this focused local phase.

## Next actions
1. When `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is supplied, run `npm run e2e:admin-user-bots:db:managed:matrix`, then
   scan stdout, `test-results`, `playwright-report`, and `tests/e2e/screenshots` for every hidden marker and URL/password
   pattern before retaining artifacts.
2. Keep Legacy closed-trade importer blocked until a real source-proof artifact passes the shared contract and a separate
   mapper/importer replay gate is implemented.
3. Continue the next product slice toward Tortila final parity and the remaining end-to-end two-bot closure, with agents
   launched before edits as required by the session protocol.
