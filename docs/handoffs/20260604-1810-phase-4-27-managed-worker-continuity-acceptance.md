# phase-4-27-managed-worker-continuity-acceptance handoff
## Scope
Close the next worker-continuity proof gap after Phase 4.26. This phase adds a managed throwaway-Postgres acceptance runner for the Legacy/Tortila aggregate worker heartbeat, strengthens the strict `accept:worker:continuity` tuple check, and updates the selected-user admin DB matrix fixture/spec so it can assert `integration_health_checks.target='worker'` continuity states.

Linked read-only auditor handoffs:
- [docs/handoffs/20260604-1756-worker-continuity-acceptance-auditor.md](20260604-1756-worker-continuity-acceptance-auditor.md)
- [docs/handoffs/20260604-1754-admin-user-bot-db-matrix-auditor.md](20260604-1754-admin-user-bot-db-matrix-auditor.md)
- [docs/handoffs/20260604-1758-bot-product-ux-completion-auditor.md](20260604-1758-bot-product-ux-completion-auditor.md)

All three background agents were closed before this aggregate handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260604-1748-phase-4-26-aggregate-worker-continuity-launch-gate.md`
- `docs/handoffs/20260604-1756-worker-continuity-acceptance-auditor.md`
- `docs/handoffs/20260604-1754-admin-user-bot-db-matrix-auditor.md`
- `docs/handoffs/20260604-1758-bot-product-ux-completion-auditor.md`
- `package.json`
- `scripts/safe-worker-tick.mjs`
- `scripts/run-worker-continuity-managed.mjs`
- `scripts/run-real-pg-harness-managed.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/worker-continuity-acceptance-runner.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/db-seed-preview-hardening.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`

## Files changed
- `apps/worker/src/index.ts` - returns `botContinuityStatus` from the one-shot DB worker tick result.
- `apps/worker/src/tick-once.ts` - adds `bot_continuity=...` to the final parseable one-shot worker output.
- `scripts/safe-worker-tick.mjs` - adds argument validation plus `--expect-continuity=full|setup-needed` tuple assertions; `--require-db` defaults to the strict full profile.
- `scripts/run-worker-continuity-managed.mjs` - new opt-in managed runner that creates/drops `wtc_test_worker_continuity_*`, applies migrations, seeds demo data, creates fixture-only Legacy source tables plus an active WTC provider mapping, runs the safe worker tick, and verifies the latest `target='worker'` DB row.
- `package.json` - makes `accept:worker:continuity` strict full tuple acceptance and adds `accept:worker:continuity:managed`.
- `scripts/prepare-admin-user-bot-detail-e2e.ts` - seeds aggregate `target='worker'` rows for selected-user DB browser scenarios, including fresh, stale-by-checkedAt, missing, and attention cases.
- `tests/e2e/admin-user-bot-detail-db.spec.ts` - asserts worker attention, aggregate freshness/missing values, worker notes, scenario-specific screenshots, and no worker-secret marker leakage.
- `tests/integration/worker-continuity-acceptance-runner.test.ts` - locks runner safety, opt-in behavior, redaction, tuple profiles, and full managed fixture requirements.
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` - locks selected-user DB matrix worker-row fixture and worker expectations.
- `tests/integration/db-seed-preview-hardening.test.ts` - updates safe worker smoke/acceptance script invariants.
- `docs/handoffs/20260604-1756-worker-continuity-acceptance-auditor.md` - read-only agent handoff.
- `docs/handoffs/20260604-1754-admin-user-bot-db-matrix-auditor.md` - read-only agent handoff.
- `docs/handoffs/20260604-1758-bot-product-ux-completion-auditor.md` - read-only agent handoff.
- `docs/handoffs/20260604-1810-phase-4-27-managed-worker-continuity-acceptance.md` - this aggregate handoff.

## Findings
1. Severity P1 - The worker one-shot acceptance is now a tuple gate, not an exit-code-only gate. Evidence: `apps/worker/src/tick-once.ts` emits `worker_status`, `bot_continuity`, `tortila`, and `legacy`; `scripts/safe-worker-tick.mjs` fails closed unless the selected tuple profile matches. Recommendation: keep `worker:smoke` separate from strict acceptance. Target part: worker continuity proof.
2. Severity P1 - The new managed worker runner can prove the full disposable DB path without live provider mutation. Evidence: `scripts/run-worker-continuity-managed.mjs` creates a fresh `wtc_test_worker_continuity_*` DB, applies migrations, seeds WTC demo data, creates fixture-only Legacy source tables, maps a Legacy provider account, runs `--expect-continuity=full`, verifies the latest `target='worker'` row, and drops the DB. Recommendation: use this as the local safe acceptance gate when a local/admin Postgres URL is provided. Target part: managed acceptance.
3. Severity P1 - Selected-user DB matrix fixtures now include aggregate worker continuity. Evidence: `scripts/prepare-admin-user-bot-detail-e2e.ts` writes `target='worker'` rows with `botContinuityStatus`, `tortilaSnapshot/readState`, and `legacySnapshot/readState`; `tests/e2e/admin-user-bot-detail-db.spec.ts` asserts worker attention states, aggregate freshness/missing values, and worker notes. Recommendation: do not claim selected-user worker readiness from product runtime rows alone. Target part: admin selected-user proof.
4. Severity P2 - Product/UX completion still has a separate gap. Evidence: `docs/handoffs/20260604-1758-bot-product-ux-completion-auditor.md` recommends Phase 4.28 bot statistics completion and heartbeat polish. Recommendation: do that after DB continuity proof, without mixing it into worker acceptance. Target part: bot settings/statistics UX.

## Decisions
- No schema migration was added; the proof uses existing WTC tables plus fixture-only Legacy source tables inside the disposable acceptance DB.
- `accept:worker:continuity` is now strict full acceptance: `worker_status=ok`, `bot_continuity=ok`, `tortila=ok`, `legacy=ok`.
- `accept:worker:continuity:managed` is opt-in and outside default/quick gates because it creates and drops a Postgres database.
- The managed runner forces safe local behavior: `BOT_ADAPTER_MODE=mock`, live control off, TV automation off via `safe-worker-tick`, Tortila URLs/tokens cleared, Legacy pointed at the disposable fixture DB.
- Admin selected-user DB matrix still remains opt-in; this phase strengthens its fixture/spec but did not run the browser matrix because no admin Postgres URL was present.

## Risks
- `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is not set in this environment, so the managed runner was not executed end-to-end against real Postgres in this phase.
- `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is not set, so the strengthened selected-user DB browser matrix was not executed in this phase.
- This is local disposable acceptance, not production/live continuity: no live exchange ping, provider reachability probe, live bot control, SSH, tmux, systemd, deploy, or production monitoring was run.
- The worktree remains heavily dirty with many pre-existing modified and untracked files. This handoff certifies only the files listed in this phase.

## Verification/tests
RUN:
- `node --check scripts\safe-worker-tick.mjs` - PASS.
- `node --check scripts\run-worker-continuity-managed.mjs` - PASS.
- `npx vitest run tests/integration/worker-continuity-acceptance-runner.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts tests/integration/db-seed-preview-hardening.test.ts tests/integration/worker-health-mapping.test.ts tests/integration/worker-tortila-snapshot.test.ts` - PASS, 5 files / 34 tests.
- `npm run typecheck -w @wtc/worker` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `git diff --check` - PASS.
- `npm run secret:scan` - PASS.
- `node scripts\gates.mjs quick` - PASS, 4 gates, 0 failing.

NOT RUN / NOT GREEN:
- `npm run accept:worker:continuity:managed` - NOT RUN; requires `WORKER_CONTINUITY_ADMIN_DATABASE_URL` pointing at an operator-approved non-throwaway maintenance Postgres DB. This is the next hard proof gate.
- `npm run accept:worker:continuity` - NOT RUN; requires an explicit throwaway/full DB and approved read-only provider fixture/env. The script now rejects non-full tuples.
- `npm run e2e:admin-user-bots:db:managed:matrix` - NOT RUN; requires `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` and browser artifact review.
- `npm run worker:smoke` - NOT RUN and not accepted as continuity proof because it can memory-demo without `DATABASE_URL`.
- `npm run worker:tick`, `npm run dev:worker`, `npm run dev -w @wtc/worker` - NOT RUN.
- `node scripts\gates.mjs full`, `node scripts\gates.mjs e2e`, full Playwright, production build - NOT RUN.
- Live bot start/stop/apply-config, live exchange ping, provider reachability probe, raw env dump, raw secret read, SSH, tmux, systemd, deploy, production monitoring, Stripe/Axioma/LMS live gates - NOT RUN.

Failed/corrected invocations:
- The first focused Vitest run failed because a static test expected a differently quoted help string in `scripts/safe-worker-tick.mjs`. The implementation was kept; the brittle static expectation was corrected and the suite reran green.

## Next actions
1. With `WORKER_CONTINUITY_ADMIN_DATABASE_URL`, run `npm run accept:worker:continuity:managed` and record the created/dropped DB name plus the observed `worker_status=ok; bot_continuity=ok; tortila=ok; legacy=ok` tuple.
2. With `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, run `npm run e2e:admin-user-bots:db:managed:matrix`, review scenario-specific screenshots, and run `npm run evidence:visual -- --inventory tests/e2e/screenshots`.
3. Then start a new phase for the product/UX gap named by the auditor: bot statistics completion and heartbeat polish.
