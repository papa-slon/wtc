# Phase 4.38 local bot/admin acceptance runner handoff
## Scope
Close a repeatable local, mock/no-live acceptance command for the WTC-side Legacy/Tortila bot/admin workbench without
running managed DB gates, live provider probes, exchange pings, live bot start/stop/apply-config, deploy, SSH/systemd/tmux,
or production monitoring.

Two read-only agents were launched before edits and then closed:
- [ecosystem-tests-runner](20260604-2145-local-bot-admin-acceptance-runner-auditor.md)
- [ecosystem-security-auditor](20260604-2145-local-bot-admin-acceptance-safety-auditor.md)

This phase intentionally kept the managed worker continuity gate and selected-user admin DB matrix separate because they
require operator-supplied maintenance Postgres URLs and create/drop throwaway databases.

## Files inspected
- `AGENTS.md`
- `package.json`
- `scripts/gates.mjs`
- `scripts/redacted-child-process.mjs`
- `playwright.config.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/bot-readiness-map.spec.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `tests/e2e/warning-summary-visual.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `scripts/check-retained-visual-artifacts.mjs`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260604-2055-phase-4-37-managed-env-visual-evidence.md`
- `docs/handoffs/20260604-2145-local-bot-admin-acceptance-runner-auditor.md`
- `docs/handoffs/20260604-2145-local-bot-admin-acceptance-safety-auditor.md`
- `logs/gates/summary.txt`

## Files changed
- `package.json` - added canonical npm aliases:
  - `accept:bots:rendered` -> `node scripts/gates.mjs bot-admin-e2e`
  - `accept:bots:local` -> `node scripts/gates.mjs bot-admin-local`
- `scripts/gates.mjs` - added `bot-admin-e2e` and `bot-admin-local` plans, automatic free local E2E port selection, local
  mock/no-live child env for the bot/admin rendered gate, managed DB env refusal, DB/provider/live env scrubbing, and
  retained gate metrics.
- `docs/handoffs/20260604-2145-phase-4-38-local-bot-admin-acceptance-runner.md` - this aggregate handoff.
- `docs/STATUS.md` - updated current local proof and remaining blockers.
- `docs/NEXT_ACTIONS.md` - updated next actions around the canonical local runner and still-blocked managed/live gates.
- `docs/IMPLEMENTED_FILES.md` - added the runner/script evidence to the implemented-file inventory.

## Findings
1. Severity P1 - The local bot/admin workbench now has a repeatable canonical local acceptance command. Evidence:
   `npm run accept:bots:local` passed after the final runner changes with `ci:local` PASS, bot/admin rendered E2E `65
   passed`, and visual inventory `107` images. Recommendation: use this command as the local mock/no-live proof before
   handing the workbench to deploy/managed/live phases. Target part: local acceptance.

2. Severity P1 - The rendered bot/admin gate no longer relies on inherited live/provider DB env for its child process.
   Evidence: `scripts/gates.mjs` now refuses `WORKER_CONTINUITY_ADMIN_DATABASE_URL` and
   `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` for local acceptance, scrubs DB/provider/live env names, and forces
   `APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`,
   `FEATURE_TV_AUTOMATION=false`, and `LEGACY_LIVE_READS_ENABLED=false`. Recommendation: keep managed DB and live proof
   in separate commands with explicit operator approval. Target part: security boundary.

3. Severity P1 - The full local runner is not production/live proof and should not be reported as such. Evidence: it does
   not run managed worker continuity, selected-user admin DB matrix, Legacy closed-trade importer, exchange ping, live bot
   controls, provider probes, deploy, GitHub CI, or production monitoring. Recommendation: keep final reports split into
   RUN and NOT RUN gates. Target part: status wording.

4. Severity P2 - Formal reviewed visual acceptance remains separate from automated visual inventory. Evidence: the runner
   runs `npm run evidence:visual -- --inventory tests/e2e/screenshots`; Phase 4.37 separately passed the reviewed manifest
   `logs/retained-visual-artifacts/20260604-2055-bot-admin-local/visual-review.json`. Recommendation: after any new
   screenshot-producing run, create/review a fresh manifest before making a formal visual-review claim. Target part:
   evidence freshness.

5. Severity P2 - Several old Next dev listeners from earlier sessions remain on local ports `3410`, `3411`, `3412`, and
   `3420`; they were not killed in this phase. Evidence: post-run port inspection showed those listeners while the fresh
   `3470` runner server was torn down. Recommendation: the new runner already avoids the conflict by selecting a free port;
   clean stale dev servers only in a dedicated local cleanup step, never as live bot control. Target part: local ergonomics.

## Decisions
- `npm run accept:bots:local` is the canonical local full acceptance command for the bot/admin workbench.
- `npm run accept:bots:rendered` is the faster rendered-only loop for bot/admin UI proof.
- Local runner scope is strictly mock/no-live; managed DB and live/provider gates remain separate.
- Formal visual review remains a separate manifest-backed command after fresh review.
- No live bot control, exchange ping, provider mutation, SSH/systemd/tmux, deploy, or production monitoring was added or run.

## Risks
- The local full runner is long-running: about 15 minutes in this environment.
- The rendered E2E pack writes screenshots and `logs/gates`; it is product/runtime read-only but not filesystem read-only.
- Old local Next dev listeners can occupy default ports; the runner mitigates this by choosing a free port from `3470`.
- If an operator needs managed DB proof, local runner success is insufficient; the managed commands must be run with
  approved throwaway DB URLs and redacted output.
- Legacy closed-trade performance history remains source-blocked; local UI proof does not create source evidence.

## Verification/tests
RUN:
- `node --check scripts/gates.mjs` - PASS.
- `npm run accept:bots:rendered` after local env scrub - PASS:
  - `bot-admin-e2e` PASS, `65 passed (11.5m)`, `E2E_PORT=3470`
  - `visual-inventory` PASS, `107` image files
- `npm run accept:bots:local` after local env scrub - PASS:
  - `ci:local` PASS, `194.5s`, metric `Generating static pages (36/36)`
  - `bot-admin-e2e` PASS, `65 passed (11.4m)`, `E2E_PORT=3470`
  - `visual-inventory` PASS, `107` image files
- Post-run process/port inspection - no fresh acceptance process remained; old local Next dev listeners still existed on
  `3410`, `3411`, `3412`, and `3420`.

NOT RUN:
- `npm run accept:worker:continuity:managed` - not run; `WORKER_CONTINUITY_ADMIN_DATABASE_URL` not supplied this phase.
- `npm run e2e:admin-user-bots:db:managed:matrix` - not run; `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` not supplied this phase.
- Legacy closed-trade importer - not implemented/run; blocked by missing source proof for durable closed-trade/fill data.
- Live exchange ping, live bot start/stop/apply-config, live provider/exchange probes, SSH/systemd/tmux, deploy, GitHub CI,
  and production monitoring - not run by safety boundary.
- Fresh formal visual manifest review after the new screenshot run - not run; current formal reviewed manifest proof remains
  the Phase 4.37 manifest.

## Next actions
1. Keep using `npm run accept:bots:local` as the local mock/no-live bot/admin acceptance proof.
2. Run managed worker continuity only when `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is supplied and only through
   `npm run accept:worker:continuity:managed`.
3. Run the selected-user admin DB matrix only when `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is supplied and only through
   `npm run e2e:admin-user-bots:db:managed:matrix`.
4. Do not implement Legacy closed-trade import until a source-proof artifact names the table/API and replay contract.
5. Treat deploy/GitHub CI/production monitoring as a separate phase after this dirty local tree is intentionally staged.
