# bot-export-browser-gates-auditor handoff
## Scope
Phase 4.20 read-only tests/gates audit before edits.

Scope inspected current tests and gate wiring for:
- bot settings export/download browser evidence
- admin selected-user bot detail browser/DB evidence
- bot readiness and continuity evidence
- mobile no-horizontal-scroll coverage

Constraints followed:
- No code edits.
- No test/gate execution.
- No live bot start/stop/apply-config, exchange/provider calls, SSH, tmux, systemd, deploy, DB migrate/seed, raw env reads, or raw secret reads.
- No background agents were spawned from this auditor lane.
- Current branch observed: `codex/bot-analytics-settings-canary-20260603`.
- Current checkout was already heavily dirty before this handoff, with many modified and untracked files.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260604-1455-phase-4-19-bot-settings-export-copy.md`
- `docs/handoffs/20260604-1423-phase-4-18-bot-key-readiness-browser.md`
- `docs/handoffs/20260604-1349-phase-4-17-admin-runtimehealth-scenario-matrix.md`
- `docs/handoffs/20260604-1205-phase-4-13-worker-bot-continuity-proof.md`
- `docs/handoffs/20260604-1145-phase-4-12-bot-continuity-monitor.md`
- `package.json`
- `playwright.config.ts`
- `playwright.admin-user-bots-db.config.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/bot-readiness-map.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/e2e/cabinet-pg9-mobile.spec.ts`
- `tests/e2e/warning-summary-visual.spec.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-config-export-route-handler.test.ts`
- `tests/integration/bot-readiness-builder.test.ts`
- `tests/integration/bot-readiness-server-dto-static.test.ts`
- `tests/integration/bot-continuity-builder.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/integration/cabinet-pg9.test.ts`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `scripts/safe-worker-tick.mjs`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/config-export.ts`
- `apps/web/src/features/bots/config-export-handler.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `apps/worker/src/legacy-live.ts`

## Files changed
None -- read-only audit. Required handoff artifact written at `docs/handoffs/20260604-1505-bot-export-browser-gates-auditor.md`.

## Findings
1. Severity P2. Evidence: `tests/e2e/bot-settings.spec.ts:131`, `tests/e2e/bot-settings.spec.ts:135`, `tests/e2e/bot-settings.spec.ts:140`, `tests/e2e/bot-settings.spec.ts:144`, `tests/e2e/bot-settings.spec.ts:147`, `tests/e2e/bot-settings.spec.ts:197`, `tests/e2e/bot-settings.spec.ts:204`, `tests/e2e/bot-settings.spec.ts:212`, `tests/e2e/bot-settings.spec.ts:213`, `docs/handoffs/20260604-1455-phase-4-19-bot-settings-export-copy.md:81`. Recommendation: keep the existing `page.request.get()` response-body/header assertions, but add one true rendered-link download assertion for Tortila using Playwright download events: click `Download last saved reference export`, assert suggested filename `wtc-tortila-config.env`, assert body contains `# WTC Tortila Bot reference export` and `SYMBOL_CONFIGS=`, and run the same unsafe-marker guard on downloaded bytes. Keep Legacy as a disabled-link plus 403 API assertion. Target part: bot settings export/download browser evidence.

2. Severity P2. Evidence: `tests/integration/bot-config-export-route-handler.test.ts:186`, `tests/integration/bot-config-export-route-handler.test.ts:215`, `tests/integration/bot-config-export-route-handler.test.ts:219`, `tests/integration/bot-config-export-route-handler.test.ts:224`, `tests/integration/bot-config-export-route-handler.test.ts:258`, `tests/integration/bot-config-export-route-handler.test.ts:265`, `tests/integration/bot-config-export-static.test.ts:64`, `tests/integration/bot-config-export-static.test.ts:70`, `docs/handoffs/20260604-1455-phase-4-19-bot-settings-export-copy.md:66`, `docs/handoffs/20260604-1455-phase-4-19-bot-settings-export-copy.md:67`. Recommendation: keep the export route/static Vitest gate as the first high-signal phase gate because it already covers attachment headers, session/entitlement/provider-mapping gates, no-store security headers, stripped Legacy provider ids, and hostile secret/live-control markers without browser flake. Target part: export payload safety and route wiring.

3. Severity P1. Evidence: `playwright.config.ts:9`, `package.json:34`, `package.json:35`, `package.json:36`, `tests/e2e/admin-user-bot-detail-db.spec.ts:14`, `tests/e2e/admin-user-bot-detail-db.spec.ts:22`, `tests/e2e/admin-user-bot-detail-db.spec.ts:177`, `tests/e2e/admin-user-bot-detail-db.spec.ts:229`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:17`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:22`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:160`, `docs/handoffs/20260604-1349-phase-4-17-admin-runtimehealth-scenario-matrix.md:79`, `docs/handoffs/20260604-1349-phase-4-17-admin-runtimehealth-scenario-matrix.md:82`. Recommendation: do not count default Playwright as admin user bot detail proof, because the DB-backed spec is deliberately excluded from default e2e. When a disposable maintenance Postgres URL is explicitly available, run the managed matrix and record redacted DB names, four scenario outcomes, and cleanup. Target part: admin selected-user bot detail runtimeHealth browser acceptance.

4. Severity P1. Evidence: `tests/integration/bot-readiness-builder.test.ts:32`, `tests/integration/bot-readiness-builder.test.ts:36`, `tests/integration/bot-readiness-builder.test.ts:39`, `tests/integration/bot-continuity-builder.test.ts:31`, `tests/integration/bot-continuity-builder.test.ts:39`, `tests/integration/bot-continuity-builder.test.ts:72`, `tests/integration/worker-health-mapping.test.ts:79`, `tests/integration/worker-health-mapping.test.ts:84`, `tests/integration/worker-tortila-snapshot.test.ts:92`, `tests/integration/worker-tortila-snapshot.test.ts:127`, `package.json:23`, `docs/handoffs/20260604-1205-phase-4-13-worker-bot-continuity-proof.md:83`, `docs/handoffs/20260604-1205-phase-4-13-worker-bot-continuity-proof.md:84`, `tests/integration/legacy-provider-worker.test.ts:18`, `apps/worker/src/legacy-live.ts:490`. Recommendation: keep the focused readiness/continuity unit and backend tests in this phase's static gate, but do not claim DB-backed worker continuity unless `npm run accept:worker:continuity` is run with an explicit throwaway `DATABASE_URL`. Add direct `snapshotLegacyBotPostgres` disabled, missing-URL, scoped-provider, and error-health cases in a later implementation slice before strengthening Legacy continuity claims. Target part: readiness/continuity proof honesty.

5. Severity P2. Evidence: `tests/e2e/bot-settings.spec.ts:6`, `tests/e2e/bot-settings.spec.ts:150`, `tests/e2e/bot-settings.spec.ts:216`, `tests/e2e/bot-readiness-map.spec.ts:6`, `tests/e2e/bot-readiness-map.spec.ts:31`, `tests/e2e/bot-readiness-map.spec.ts:45`, `playwright.config.ts:25`, `tests/e2e/admin-user-bot-detail-db.spec.ts:165`, `tests/e2e/admin-user-bot-detail-db.spec.ts:229`, `playwright.admin-user-bots-db.config.ts:54`, `tests/e2e/admin-mobile-pg8.spec.ts:37`, `tests/e2e/admin-mobile-pg8.spec.ts:39`, `tests/e2e/cabinet-pg9-mobile.spec.ts:13`, `tests/e2e/cabinet-pg9-mobile.spec.ts:15`. Recommendation: current bot settings/readiness/admin-user-detail mobile checks prove no horizontal scroll at the configured mobile project width of 390px, while PG8/PG9 prove exact 375px elsewhere. For this phase, add exact 375px assertions to the export/settings browser path and the DB-backed admin-user bot detail spec before claiming iPhone-SE-width coverage for these new surfaces. Target part: mobile no-horizontal-scroll acceptance.

6. Severity P3. Evidence: `docs/handoffs/20260604-1455-phase-4-19-bot-settings-export-copy.md:74`, `docs/handoffs/20260604-1455-phase-4-19-bot-settings-export-copy.md:75`, `docs/handoffs/20260604-1455-phase-4-19-bot-settings-export-copy.md:80`, `docs/handoffs/20260604-1423-phase-4-18-bot-key-readiness-browser.md:68`, `docs/handoffs/20260604-1423-phase-4-18-bot-key-readiness-browser.md:70`. Recommendation: if Phase 4.20 retains screenshots as acceptance evidence, create a visual-review manifest and run `npm run evidence:visual -- --manifest <manifest> ...`; inventory plus chat/manual review is useful but should not be upgraded to manifest-backed visual acceptance. Target part: retained browser evidence chain.

## Decisions
- Treated this as a single read-only gates-auditor lane per the operator request.
- Did not spawn background agents.
- Did not run tests, Playwright, worker, DB, gates, or visual evidence commands.
- Recommended focused gates over `node scripts/gates.mjs full` because this phase is about export/browser/admin/readiness coverage and full gates include broader schema/build surfaces.
- Recommended split Playwright commands for `tests/e2e/bot-settings.spec.ts`, matching the stable pattern recorded in Phase 4.18/4.19 after the all-project command timed out once.

## Risks
- Line numbers and file state reflect the current dirty checkout only.
- Admin user bot detail matrix and worker continuity commands intentionally mutate throwaway DBs; they require explicit operator-provided disposable URLs and must not be run against live app databases.
- Adding real browser download assertions may create Playwright download artifacts; downloaded bytes and retained traces must be scanned/reviewed before being archived as evidence.
- Existing 390px mobile proofs are valuable, but not equivalent to the 375px acceptance style already used by PG8/PG9.
- Legacy continuity remains weaker than Tortila continuity until `snapshotLegacyBotPostgres` itself has focused branch coverage, not only row-to-WTC mapping coverage.

## Verification/tests
Read-only commands run:
- `git branch --show-current`
- `git status --short`
- `Test-Path docs/handoffs/20260604-1505-bot-export-browser-gates-auditor.md`
- Targeted `Get-Content` reads for protocol, status, latest handoffs, scripts, and tests.
- Targeted `rg` searches for export/download, admin-user bot detail, readiness/continuity, and horizontal-scroll evidence.

Commands not run in this read-only audit:
- `npx vitest run tests/integration/bot-config-export-static.test.ts tests/integration/bot-config-export-route-handler.test.ts tests/integration/bot-read-safety-static.test.ts`
- `npx vitest run tests/integration/bot-readiness-builder.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/bot-continuity-builder.test.ts tests/integration/worker-health-mapping.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/legacy-provider-worker.test.ts`
- `npx playwright test tests/e2e/bot-settings.spec.ts -g "bot settings workbench" --project=desktop`
- `npx playwright test tests/e2e/bot-settings.spec.ts -g "bot settings workbench" --project=mobile`
- `npx playwright test tests/e2e/bot-readiness-map.spec.ts --project=desktop`
- `npx playwright test tests/e2e/bot-readiness-map.spec.ts --project=mobile`
- `npm run e2e:admin-user-bots:db`
- `npm run e2e:admin-user-bots:db:managed`
- `npm run e2e:admin-user-bots:db:managed:matrix`
- `npm run accept:worker:continuity`
- `npm run evidence:visual -- --manifest <manifest> <reviewed-screenshot...>`
- `node scripts/gates.mjs quick`
- `node scripts/gates.mjs core`
- `node scripts/gates.mjs full`
- `npm run ci:local`
- `npm test`
- `npm run build -w @wtc/web`
- `npm run db:generate -w @wtc/db`
- `npm run db:migrate`
- `npm run db:seed`
- Any live bot start/stop/apply-config, exchange/provider call, deploy, SSH, tmux, systemd, raw env read, or raw secret read.

## Next actions
1. Preserve and run the focused export/static gate first after Phase 4.20 edits:
   `npx vitest run tests/integration/bot-config-export-static.test.ts tests/integration/bot-config-export-route-handler.test.ts tests/integration/bot-read-safety-static.test.ts`

2. Add the smallest browser export gap: one Tortila rendered-link download assertion in `tests/e2e/bot-settings.spec.ts`; keep the existing Legacy disabled/403 assertions. Then run:
   `npx playwright test tests/e2e/bot-settings.spec.ts -g "bot settings workbench" --project=desktop`
   `npx playwright test tests/e2e/bot-settings.spec.ts -g "bot settings workbench" --project=mobile`

3. If 375px mobile acceptance is part of Phase 4.20, add explicit `page.setViewportSize({ width: 375, height: 812 })` coverage to the export/settings path and the admin-user DB detail path before claiming no-horizontal-scroll at iPhone-SE width. Then run the same scoped browser commands above plus the DB matrix command below.

4. When a disposable maintenance Postgres URL is explicitly provided, run the selected-user admin matrix:
   `$env:ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL = '<redacted maintenance postgres url>'`
   `npm run e2e:admin-user-bots:db:managed:matrix`
   `Remove-Item Env:\ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`

5. Keep readiness/continuity semantic coverage in the focused static gate:
   `npx vitest run tests/integration/bot-readiness-builder.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/bot-continuity-builder.test.ts tests/integration/worker-health-mapping.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/legacy-provider-worker.test.ts`

6. Run DB-backed worker continuity only with an explicit throwaway WTC DB:
   `$env:DATABASE_URL = '<redacted throwaway wtc_test database url>'`
   `npm run accept:worker:continuity`
   `Remove-Item Env:\DATABASE_URL`

7. If screenshots are retained as acceptance evidence, write a review manifest under `logs/retained-visual-artifacts/20260604-1505-bot-export-browser/visual-review.json`, then run:
   `npm run evidence:visual -- --manifest logs/retained-visual-artifacts/20260604-1505-bot-export-browser/visual-review.json <reviewed screenshot paths>`
