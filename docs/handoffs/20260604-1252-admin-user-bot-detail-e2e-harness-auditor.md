# admin-user-bot-detail-e2e-harness-auditor handoff
## Scope
Read-only Phase 4.15 audit of the admin selected-user bot detail DB/E2E harness after Phase 4.14 added `runtimeHealth`. Focus: whether a managed/disposable DB path already exists, which commands are safe without an explicit throwaway DB authority, what runtimeHealth assertions are missing from the E2E/harness layer, and the minimal next acceptance slice. No live bot start/stop/apply-config, no DB mutation, no app code edits, and no secrets were used.

## Files inspected
- `package.json`
- `playwright.config.ts`
- `playwright.admin-user-bots-db.config.ts`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `docs/handoffs/20260604-1243-phase-4-14-admin-health-consumption.md`

## Files changed
- `docs/handoffs/20260604-1252-admin-user-bot-detail-e2e-harness-auditor.md` - this handoff only; application code: None - read-only audit.

## Findings
1. Severity P1 - evidence `package.json:34`, `package.json:35`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:14`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:16`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:23`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:27`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:104`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:107`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:114` - recommendation: treat `npm run e2e:admin-user-bots:db:managed` as the preferred disposable DB path only after the operator provides an explicit local/admin Postgres maintenance URL in `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`; target part: admin user bot detail DB E2E acceptance. The managed path exists and creates/drops a fresh `wtc_test_admin_user_bots_*` database, but it is not a zero-config/no-DB-authority path.
2. Severity P1 - evidence `scripts/run-admin-user-bot-detail-e2e.mjs:7`, `scripts/run-admin-user-bot-detail-e2e.mjs:10`, `scripts/run-admin-user-bot-detail-e2e.mjs:27`, `scripts/run-admin-user-bot-detail-e2e.mjs:65`, `scripts/run-admin-user-bot-detail-e2e.mjs:68`, `scripts/prepare-admin-user-bot-detail-e2e.ts:32`, `scripts/prepare-admin-user-bot-detail-e2e.ts:39`, `scripts/prepare-admin-user-bot-detail-e2e.ts:52`, `scripts/prepare-admin-user-bot-detail-e2e.ts:57`, `playwright.admin-user-bots-db.config.ts:14`, `playwright.admin-user-bots-db.config.ts:18`, `playwright.admin-user-bots-db.config.ts:20`, `playwright.admin-user-bots-db.config.ts:23`, `playwright.admin-user-bots-db.config.ts:29` - recommendation: keep `npm run e2e:admin-user-bots:db` and direct `npx playwright test -c playwright.admin-user-bots-db.config.ts` NOT RUN unless an explicit fresh throwaway `ADMIN_USER_BOTS_E2E_DATABASE_URL` and prepared marker are created by the runner; target part: DB mutation safety.
3. Severity P2 - evidence `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:17`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:22`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:88`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:101` - recommendation: for the no-secret/no-DB portion of this phase, the safe commands are `npm test -- tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` and `npm run e2e:admin-user-bots:db:managed -- --help`; target part: read-only/dry harness verification. The integration test only reads source and spawns managed-runner help/refusal paths with an empty admin URL.
4. Severity P1 - evidence `scripts/prepare-admin-user-bot-detail-e2e.ts:389`, `scripts/prepare-admin-user-bot-detail-e2e.ts:395`, `scripts/prepare-admin-user-bot-detail-e2e.ts:396`, `scripts/prepare-admin-user-bot-detail-e2e.ts:405`, `apps/web/src/features/admin/user-bot-detail-loader.ts:265`, `apps/web/src/features/admin/user-bot-detail-loader.ts:268`, `apps/web/src/features/admin/user-bot-detail-loader.ts:275`, `apps/web/src/features/admin/user-bot-detail-loader.ts:290`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:141`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:144`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:178`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:182`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:316`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:318`, `tests/e2e/admin-user-bot-detail-db.spec.ts:13`, `tests/e2e/admin-user-bot-detail-db.spec.ts:43`, `tests/e2e/admin-user-bot-detail-db.spec.ts:114`, `tests/e2e/admin-user-bot-detail-db.spec.ts:139` - recommendation: add rendered browser assertions for the new runtimeHealth output that is already seeded and rendered; target part: DB-backed admin selected-user E2E. The fixture already records `tortila-journal` and `legacy-bot` health rows, but the Playwright spec still only asserts selected-user facts, redaction, read-only controls, and layout.
5. Severity P2 - evidence `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:49`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:65`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:67`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:86` - recommendation: extend the static harness test to lock the runtimeHealth acceptance contract (`recordHealthCheck` fixture rows plus spec strings such as runtime target labels and degraded-status notes); target part: DB E2E harness regression guard.

## Decisions
- A managed/disposable DB path is present, but the full browser acceptance still requires explicit Postgres authority. There is no fully self-contained local no-secret DB path for this E2E harness.
- Do not run full DB-backed admin user bot detail E2E in this read-only lane without an operator-confirmed throwaway database/admin URL.
- The safest next acceptance slice is assertion-only: strengthen the existing DB E2E and static harness tests around Phase 4.14 `runtimeHealth`; no app code appears necessary from this audit.

## Risks
- Until the DB-backed browser E2E is run with a disposable Postgres target, Phase 4.14 runtimeHealth is only proved by unit/static coverage and code inspection, not by real Postgres render acceptance.
- The managed runner can create and drop databases; an accidental production/admin URL would be high impact even though the script refuses `wtc_test*` maintenance DB names and creates a throwaway target.
- The browser spec writes screenshots under `tests/e2e/screenshots` on success; retained traces/screenshots should be reviewed and secret-scanned before archiving.

## Verification/tests
RUN:
- Read-only source inspection with `rg` and line-numbered `Get-Content`.

NOT RUN:
- `npm test -- tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` - not run in this audit lane to avoid changing anything beyond the single allowed handoff, but safe as the first no-DB command for the main agent.
- `npm run e2e:admin-user-bots:db:managed` - NOT RUN because no explicit local/admin Postgres maintenance URL was provided.
- `npm run e2e:admin-user-bots:db` - NOT RUN because no explicit fresh throwaway `ADMIN_USER_BOTS_E2E_DATABASE_URL` was provided.
- `npx playwright test -c playwright.admin-user-bots-db.config.ts` - NOT RUN because the guarded config requires the runner-created env and prepared marker.
- Live bot start/stop/apply-config, exchange/provider calls, raw env/secret reads - NOT RUN by safety policy.

## Next actions
1. In `tests/e2e/admin-user-bot-detail-db.spec.ts`, add minimal runtimeHealth assertions using the existing fixture: `Runtime health` count, `runtime: tortila-journal: ok`, `runtime: legacy-bot: ok`, `tortila-journal latest persisted health status is degraded.`, `legacy-bot latest persisted health status is degraded.`, and `evidence stale or gated` for the degraded-but-readable seeded health rows.
2. In `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`, add static expectations that the prepare script seeds `recordHealthCheck(db, 'tortila-journal', 'degraded', ...)` and `recordHealthCheck(db, 'legacy-bot', 'degraded', ...)`, and that the Playwright spec contains the runtimeHealth target/status/note assertions.
3. Run `npm test -- tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`.
4. If an explicit disposable/admin DB authority is confirmed, run the full managed gate with `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL=<local maintenance postgres url> npm run e2e:admin-user-bots:db:managed`. If only a pre-created empty throwaway DB is provided, use `ADMIN_USER_BOTS_E2E_DATABASE_URL=<fresh wtc_test... url> npm run e2e:admin-user-bots:db`. Keep both NOT RUN otherwise.
