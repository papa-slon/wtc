# admin-source-proof-rendered-safety-auditor handoff
## Scope
Phase 4.50 read-only safety/gates audit for proving rendered admin selected-user Legacy source-proof status in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Scope inspected `scripts/prepare-admin-user-bot-detail-e2e.ts`, `tests/e2e/admin-user-bot-detail-db.spec.ts`, the admin-user-bot-detail e2e runners/config, and the Phase 4.49 source-proof sanitizer/projection. This audit recommends safe hostile fixture markers and exact gates for a follow-up implementation lane to prove rendered admin selected-user source-proof without leaking `rawJson`, `liveConfig`, full provider IDs, secrets, or control affordances.

No env/secret files or env values were read. No live services, provider DBs, exchanges, workers, bot control, server mutation, deploy, or DB acceptance runs were invoked. This lane only inspected source/docs/tests and wrote this handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260605-0490-phase-4-49-admin-selected-user-source-proof.md`
- `docs/handoffs/20260605-0490-admin-selected-user-source-proof-safety-auditor.md`
- `docs/handoffs/20260605-0490-admin-selected-user-source-proof-tests-auditor.md`
- `docs/handoffs/20260605-0490-admin-selected-user-source-proof-ux-auditor.md`
- `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/legacy-closed-trade-source-proof-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `playwright.admin-user-bots-db.config.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `package.json`

## Files changed
None - read-only audit. Wrote this handoff only: `docs/handoffs/20260605-0500-admin-source-proof-rendered-safety-auditor.md`.

## Findings
1. Severity P1 - Phase 4.49 made the source-proof sanitizer safe enough for rendered proof, but the rendered DB e2e does not yet assert the source-proof row/status/provenance. Evidence: the shared safe DTO is limited to `status`, `canImportClosedTrades`, `missingRequirements`, `blockerCount`, and `source` in `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:57`; raw summaries are parsed by allowlisting status, boolean `true`, and safe requirement keys only in `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:156`; the admin page renders `source proof blocked`, `mapper-ready proof`, and provenance labels in `apps/web/src/app/admin/users/[userId]/bots/page.tsx:63` and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:91`; but the rendered DB spec visible markers stop at generic statistics/runtime/admin evidence text and do not include `Source-proof gate`, `scoped worker metric`, `global preflight`, `mapper-ready proof`, or source-proof missing-copy assertions in `tests/e2e/admin-user-bot-detail-db.spec.ts:109` and `tests/e2e/admin-user-bot-detail-db.spec.ts:256`. Recommendation: extend the Playwright spec to assert the Legacy-only `Source-proof gate` coverage row, the expected status label, the source label, the missing/mapper-ready summary, and that Tortila has no source-proof gate. Target part: rendered admin selected-user DB acceptance.

2. Severity P1 - The fixture already includes an unscoped hostile source-proof marker, but the scoped metric should carry the proof that the page is expected to render plus hostile sibling fields that must not render. Evidence: unscoped Legacy metric raw proof contains `UNSCOPED_SOURCE_PROOF_SHOULD_NOT_RENDER` in `scripts/prepare-admin-user-bot-detail-e2e.ts:360`; the scoped metric starts at `scripts/prepare-admin-user-bot-detail-e2e.ts:374` but the audited output did not show a scoped `rawJson.closedTradeSourceProof` payload in the inspected range; the loader prefers only scoped provider rows before source-proof parsing in `apps/web/src/features/admin/user-bot-detail-loader.ts:1203`; loader unit coverage already proves scoped proof wins and unsafe raw fields are dropped in `tests/integration/admin-user-bot-detail-loader.test.ts:655`. Recommendation: seed the scoped Legacy metric with a deliberate `closedTradeSourceProof` payload and hostile siblings. Safe visible fields should prove only `ready_for_mapper` or `blocked_no_source`, `canImportClosedTrades`, and safe requirement keys. Hidden hostile fields should include `SCOPED_SOURCE_PROOF_RAW_PAYLOAD_ALLOWLIST_SHOULD_NOT_RENDER`, `SCOPED_SOURCE_PROOF_UNSAFE_RAW_FIELDS_SHOULD_NOT_RENDER`, `SCOPED_SOURCE_PROOF_EVIDENCE_REF_SHOULD_NOT_RENDER`, `SCOPED_SOURCE_PROOF_BLOCKERS_SHOULD_NOT_RENDER`, `SCOPED_SOURCE_PROOF_LIVECONFIG_SHOULD_NOT_RENDER`, `SCOPED_SOURCE_PROOF_PROVIDER_ID_SHOULD_NOT_RENDER`, and `SCOPED_SOURCE_PROOF_API_KEY_SHOULD_NOT_RENDER`. Target part: `scripts/prepare-admin-user-bot-detail-e2e.ts`.

3. Severity P1 - Full provider IDs remain correctly masked, and the rendered source-proof gate must not loosen that boundary. Evidence: provider IDs are masked before DTO mapping in `apps/web/src/features/admin/user-bot-detail-loader.ts:824`; Legacy scope filtering requires exactly one active provider mapping and row provider match in `apps/web/src/features/admin/user-bot-detail-loader.ts:1173` and `apps/web/src/features/admin/user-bot-detail-loader.ts:1206`; the rendered spec expects only masked `USER_A...B_ID` and forbids full `USER_A_LEGACY_PUB_ID` plus user-B provider IDs in `tests/e2e/admin-user-bot-detail-db.spec.ts:167` and `tests/e2e/admin-user-bot-detail-db.spec.ts:271`. Recommendation: keep `USER_A...B_ID` visible, keep full `USER_A_LEGACY_PUB_ID` hidden, and add source-proof-specific hidden markers for `providerAccountId`, `providerPubId`, `providerAccounts`, `RAW_PROVIDER_ID_SHOULD_NOT_RENDER`, and any fixture full pub_id values inside `closedTradeSourceProof` or sibling `liveConfig`. Target part: e2e hidden marker matrix and screenshot retention scan.

4. Severity P1 - The browser runner is guarded for throwaway DB execution, but rendered source-proof evidence should be accepted only through the managed matrix and retained-artifact scan, not by a developer manually hitting a local page. Evidence: runner demands `ADMIN_USER_BOTS_E2E_DATABASE_URL` and delegates to prepared Playwright in `scripts/run-admin-user-bot-detail-e2e.mjs:7` and `scripts/run-admin-user-bot-detail-e2e.mjs:66`; config rejects non-prepared DBs and validates HMAC marker in `playwright.admin-user-bots-db.config.ts:13`; managed runner creates and drops `wtc_test_admin_user_bots_*` databases in `scripts/run-admin-user-bot-detail-e2e-managed.mjs:101`; Phase 4.49 did not run the managed DB matrix because the admin DB env was absent in `docs/handoffs/20260605-0490-phase-4-49-admin-selected-user-source-proof.md:122`. Recommendation: the proof gate for this rendered lane is `npm run e2e:admin-user-bots:db:managed:matrix` with `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` pointing only to a non-throwaway maintenance DB. Do not accept screenshots from an unguarded server. Target part: acceptance protocol.

5. Severity P2 - The static and loader gates are already close to sufficient, but the e2e harness static test should explicitly pin source-proof fixture markers and rendered assertions so future spec drift is caught before browser execution. Evidence: harness static coverage confirms scripts/config/spec registration, mock mode, live-control off, and existing hidden marker assertions in `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:25`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:60`, and `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:96`; static admin page coverage already forbids page-level `rawJson`, `CsrfField`, submit controls, and bot control strings in `tests/integration/admin-user-bot-detail-static.test.ts:269`; loader coverage already forbids unsafe proof fields in returned JSON in `tests/integration/admin-user-bot-detail-loader.test.ts:727`. Recommendation: add static harness assertions that the prepare script contains scoped source-proof hostile markers and the Playwright spec contains `Source-proof gate`, `mapper-ready proof` or `source proof blocked`, `scoped worker metric`, `global preflight`, and hidden source-proof internals. Target part: `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`.

6. Severity P2 - Retained Playwright traces/screenshots can become the leak path even if DOM assertions pass. Evidence: Playwright config retains traces on failure and screenshots on failure in `playwright.admin-user-bots-db.config.ts:47`; the spec also writes full-page screenshots explicitly in `tests/e2e/admin-user-bot-detail-db.spec.ts:278`; runner cleanup warns to archive only scanner-clean artifacts in `scripts/run-admin-user-bot-detail-e2e.mjs:73`. Recommendation: after the managed matrix, scan stdout plus `test-results`, `playwright-report`, and `tests/e2e/screenshots` for all hidden markers, source-proof internals, full provider IDs, URL/password patterns, and control affordances before retaining or attaching artifacts. Target part: artifact retention gate.

## Decisions
1. Treat Phase 4.50 as a rendered proof hardening slice only. It should not change source-proof business semantics, importer behavior, worker live reads, provider mapping workflows, or bot control.
2. Acceptable rendered proof fields are: `Source-proof gate`, `source proof blocked` or `mapper-ready proof`, `global preflight` or `scoped worker metric`, safe missing requirement keys/counts, and the existing masked provider pub_id format.
3. Forbidden rendered fields/markers include: `rawJson`, `liveConfig`, `providerAccounts`, `providerAccountId`, `providerPubId`, `rawPayloadAllowlist`, `unsafeRawPayloadFields`, `blockers`, `evidence`, `evidenceRef`, `sourceField`, `artifactId`, `apiKey`, `apiSecret`, `secret`, `token=`, `password`, `authorization`, `cookie`, full `USER_A_LEGACY_PUB_ID`, all `USER_B_*_MUST_NOT_LEAK` markers, `Map Legacy pub_id`, `Apply config`, `Start bot`, `Stop bot`, `Test connection`, `Connection verified`, forms, hidden CSRF inputs, and submit/control buttons.
4. Recommended hostile fixture markers:
   - Visible safe proof markers: `Source-proof gate`, `mapper-ready proof`, `scoped worker metric`, `Source contract is mapper-ready; importer replay still needs its own gate.`
   - Hidden unscoped proof marker: `UNSCOPED_SOURCE_PROOF_SHOULD_NOT_RENDER`.
   - Hidden scoped internals: `SCOPED_SOURCE_PROOF_RAW_PAYLOAD_ALLOWLIST_SHOULD_NOT_RENDER`, `SCOPED_SOURCE_PROOF_UNSAFE_RAW_FIELDS_SHOULD_NOT_RENDER`, `SCOPED_SOURCE_PROOF_EVIDENCE_REF_SHOULD_NOT_RENDER`, `SCOPED_SOURCE_PROOF_BLOCKERS_SHOULD_NOT_RENDER`.
   - Hidden config/provider/secrets: `SCOPED_SOURCE_PROOF_LIVECONFIG_SHOULD_NOT_RENDER`, `SCOPED_SOURCE_PROOF_PROVIDER_ID_SHOULD_NOT_RENDER`, `SCOPED_SOURCE_PROOF_API_KEY_SHOULD_NOT_RENDER`, `SCOPED_SOURCE_PROOF_TOKEN_SHOULD_NOT_RENDER`.
5. If the follow-up lane chooses `blocked_no_source` instead of `ready_for_mapper` for the scoped fixture, the visible assertions should prove `source proof blocked`, `scoped worker metric`, and a safe requirement count/key summary; never call this importer-ready.

## Risks
1. If rendered e2e asserts only generic statistics/runtime labels, a future regression can remove or mislabel the source-proof gate while loader tests remain green.
2. If hostile source-proof internals are seeded only in loader unit tests and not the DB/browser fixture, server-to-React or React-to-DOM leaks can escape rendered coverage.
3. If the managed matrix is run with real/admin DB values copied into logs or screenshots, the proof artifacts themselves can violate the no-secret/no-raw-URL rule.
4. If `ready_for_mapper` wording is not paired with importer-replay caveat copy, admins may misread source-contract readiness as closed-trade analytics/importer completion.
5. If provider scoping is changed after source-proof parsing, a newer unscoped/fleet metric could override the selected user's scoped proof.

## Verification/tests
RUN in this read-only auditor lane:
1. `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` and a large pre-existing dirty tree before this handoff.
2. Targeted read-only `rg` and `Get-Content` inspections of the files listed above.
3. Confirmed the requested handoff path did not already exist before writing.
4. `git diff --check -- docs/handoffs/20260605-0500-admin-source-proof-rendered-safety-auditor.md` - PASS after writing this handoff.

NOT RUN in this read-only auditor lane:
1. `npx vitest run tests/integration/legacy-closed-trade-source-proof-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` - not run because this lane was scoped to inspection/recommendation only.
2. `npm run e2e:admin-user-bots:db:managed:matrix` - not run; requires `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` and creates/drops throwaway DBs.
3. `npm run secret:scan`, `npm run governance:check`, and `npm run typecheck` - not run; recommended after any follow-up implementation edits.
4. Live Legacy DB/provider/exchange probes, live exchange-key ping, worker tick/restart, live bot start/stop/apply-config/test-connection, server deploy, CI, and production monitoring - not run; prohibited/out of scope.

Exact recommended gates for the follow-up implementation lane:
1. Static/source sanitizer pack:
   `npx vitest run tests/integration/legacy-closed-trade-source-proof-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
2. Rendered managed DB matrix:
   `npm run e2e:admin-user-bots:db:managed:matrix`
3. Retained artifact leak scan after the rendered matrix:
   scan runner stdout/stderr, `test-results`, `playwright-report`, and `tests/e2e/screenshots` for every hidden marker listed in `HIDDEN_MARKERS`, plus `rawJson`, `liveConfig`, `rawPayloadAllowlist`, `unsafeRawPayloadFields`, `evidenceRef`, `sourceField`, `artifactId`, `providerAccountId`, `providerPubId`, full `USER_A_LEGACY_PUB_ID`, `SCOPED_SOURCE_PROOF_*_SHOULD_NOT_RENDER`, `UNSCOPED_SOURCE_PROOF_SHOULD_NOT_RENDER`, URL password patterns, and live-control labels.
4. General hygiene after edits:
   `npm run typecheck -w @wtc/web`
   `npm run secret:scan`
   `npm run governance:check`
   `git diff --check`

Gate acceptance criteria:
1. Desktop and mobile admin selected-user pages show the Legacy `Source-proof gate` row and source-proof status/provenance.
2. Rendered text includes only safe proof summary fields and the existing masked pub_id, not raw provider/source-proof internals.
3. No forms, CSRF fields, submit controls, start/stop/apply/test-connection buttons, live-probe copy, or provider-mapping action affordances appear.
4. Cross-user markers, unscoped Legacy metric markers, raw config/trade/metric markers, health secret markers, and source-proof hostile markers are absent from DOM text and retained artifacts.
5. The managed runner creates and drops only `wtc_test_admin_user_bots_*` databases, with redacted output and no archived DB URLs/passwords.

## Next actions
1. Extend `scripts/prepare-admin-user-bot-detail-e2e.ts` scoped Legacy metric `rawJson.closedTradeSourceProof` with safe proof fields and hostile sibling internals.
2. Extend `tests/e2e/admin-user-bot-detail-db.spec.ts` visible and hidden marker matrices for source-proof status, provenance, safe missing/mapper copy, and forbidden internals.
3. Extend `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` so source-proof fixture/spec coverage is statically pinned.
4. Run the exact gates above in a separate implementation/verification lane with managed throwaway DB env supplied.
