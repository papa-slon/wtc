# ecosystem-tests-runner handoff
## Scope
Phase 4.38 read-only audit for a repeatable local bot/admin acceptance runner in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Scope inspected root package scripts, the low-noise gate wrapper, Playwright configs, focused bot/admin e2e tests, the retained visual evidence checker, and recent Phase 4.35-4.37 handoffs/status docs. No code, test, config, runtime, database, bot, provider, exchange, live-control, deploy, or env state was intentionally changed. This lane did not run acceptance gates because the requested scope was read-only and the current runner writes `logs/gates`, starts Playwright dev servers, and can overwrite screenshots.

Current checkout state observed before this handoff: branch `codex/bot-analytics-settings-canary-20260603...origin/codex/bot-analytics-settings-canary-20260603`, latest commit `e2d705f Upgrade Legacy bot settings and pub_id stats`, with a large pre-existing dirty/untracked worktree. This audit did not reconcile those unrelated changes.

## Files inspected
- `package.json:11-51` - root scripts, including `accept:bots:rendered`, `accept:bots:local`, managed worker/admin DB gates, `evidence:visual`, and `ci:local`.
- `scripts/gates.mjs:1-20` - low-noise sequential gate-runner purpose and supported modes.
- `scripts/gates.mjs:33-61` - gate command definitions, including focused bot/admin Playwright pack and visual inventory.
- `scripts/gates.mjs:63-75` - plans for `bot-admin-e2e` and `bot-admin-local`.
- `scripts/gates.mjs:82-138` - retained log behavior under `logs/gates`, metric extraction, summary writing, and exit-code semantics.
- `playwright.config.ts:3-40` - default e2e port `3410`, standard e2e exclusions, desktop/mobile projects, and mock/no-live-control webServer env.
- `playwright.admin-user-bots-db.config.ts:13-32` - guarded DB-backed admin detail config refusal conditions.
- `playwright.admin-user-bots-db.config.ts:36-73` - admin DB e2e port `3414`, desktop/mobile projects, screenshots/traces on failure, and mock/no-live-control env.
- `tests/e2e/smoke.spec.ts:25-60`, `tests/e2e/smoke.spec.ts:100-165`, `tests/e2e/smoke.spec.ts:179-205` - broad bot/admin rendered smoke coverage and screenshots.
- `tests/e2e/bot-settings.spec.ts:80-162`, `tests/e2e/bot-settings.spec.ts:491-503` - bot settings/admin defaults rendered checks and screenshots.
- `tests/e2e/bot-readiness-map.spec.ts:21-60` - Tortila/Legacy readiness maps, live-start disabled checks, and screenshots.
- `tests/e2e/bot-statistics.spec.ts:29-81` - dedicated Tortila/Legacy statistics shell, no-live-control checks, and screenshots.
- `tests/e2e/warning-summary-visual.spec.ts:58-99` - warning summary screenshot coverage for user/admin bot surfaces.
- `tests/e2e/admin-mobile-pg8.spec.ts:20-66` - admin mobile 375px page matrix and screenshots.
- `tests/e2e/admin-user-bot-detail-db.spec.ts:5-8`, `tests/e2e/admin-user-bot-detail-db.spec.ts:14-19`, `tests/e2e/admin-user-bot-detail-db.spec.ts:213-278` - opt-in selected-user DB matrix expectations and screenshots.
- `scripts/check-retained-visual-artifacts.mjs:16-25`, `scripts/check-retained-visual-artifacts.mjs:185-243`, `scripts/check-retained-visual-artifacts.mjs:306-348` - required review labels, manifest validation, inventory mode, no-manifest fail-closed behavior, and pass output.
- `scripts/safe-worker-tick.mjs:9-15`, `scripts/safe-worker-tick.mjs:107-155` - full continuity tuple and forced mock/no-live-control worker acceptance behavior.
- `scripts/run-worker-continuity-managed.mjs:20-29`, `scripts/run-worker-continuity-managed.mjs:274-299`, `scripts/run-worker-continuity-managed.mjs:311-399` - managed worker continuity throwaway DB, safe worker tick, tuple verification, create/drop behavior.
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs:14-24`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:29-49`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:83-119`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:130-171` - managed admin-user bot DB matrix behavior and refusal/cleanup conditions.
- `scripts/run-admin-user-bot-detail-e2e.mjs:6-13`, `scripts/run-admin-user-bot-detail-e2e.mjs:21-40`, `scripts/run-admin-user-bot-detail-e2e.mjs:64-77` - direct lower-level DB harness env, marker, no-live-control env, Playwright delegation, and cleanup note.
- `tests/integration/worker-continuity-acceptance-runner.test.ts:35-75` - worker managed runner remains opt-in and outside default gates.
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:25-34`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:96-120` - admin DB matrix remains opt-in/default-excluded and validates selected-user runtime expectations.
- `docs/handoffs/20260604-2010-phase-4-35-bot-statistics-rendered-proof.md:34-63` - focused six-file rendered pack PASS, visual inventory-only PASS, formal manifest not run at that time.
- `docs/handoffs/20260604-2035-phase-4-36-root-vitest-timeout-hardening.md:42-55` - `npm test` and local static gates PASS, managed gates not run.
- `docs/handoffs/20260604-2055-phase-4-37-managed-env-visual-evidence.md:45-76` - formal visual manifest PASS, `ci:local` PASS, managed worker/admin DB gates still not run.
- `docs/handoffs/20260604-2055-managed-env-gates-auditor.md:34-82` - managed worker/admin DB gate blockers, safety classification, and exact NOT RUN gates.
- `docs/handoffs/20260604-2055-visual-evidence-manifest-auditor.md:43-62` - visual inventory vs formal manifest distinction and freshness/retention risks.
- `docs/STATUS.md:10-27` - current green local proof and still-not-green gates.
- `docs/NEXT_ACTIONS.md:10-28` - required order for blocked env/source/safety gates and known green local proof.
- `logs/retained-visual-artifacts/20260604-2055-bot-admin-local/visual-review.json` - metadata only; file exists locally with `107` artifact entries and is ignored under `logs/`.
- `tests/e2e/screenshots/` - metadata only; current image count observed as `107`, latest image mtime earlier than the visual manifest mtime.

## Files changed
- `docs/handoffs/20260604-2145-local-bot-admin-acceptance-runner-auditor.md` - this handoff only. No code, config, test, script, env, app doc, runtime, database, or visual artifact file was changed.

## Findings
1. Severity P1 - A package-level local bot/admin runner already exists, so the next implementation should not add a second parallel command unless it is only a clearer alias. Evidence: `package.json:43-44` registers `accept:bots:rendered` as `node scripts/gates.mjs bot-admin-e2e` and `accept:bots:local` as `node scripts/gates.mjs bot-admin-local`; `scripts/gates.mjs:13-20` documents those modes; `scripts/gates.mjs:73-74` maps `bot-admin-e2e` to the focused rendered pack plus visual inventory and `bot-admin-local` to `ci:local` plus that pack. Recommendation: make `npm run accept:bots:local` the canonical repeatable local bot/admin command, or add only a thin alias such as `accept:bot-admin:local` -> `npm run accept:bots:local` if the singular name is preferred. Target part: package command surface.

2. Severity P1 - The existing `accept:bots:local` contents match the current green local proof bundle except formal reviewed visual manifest validation. Evidence: `scripts/gates.mjs:34` defines `ci:local`; `scripts/gates.mjs:45-59` runs the six focused bot/admin e2e files from Phase 4.35 and then visual inventory; Phase 4.35 recorded the same six-file Playwright pack as PASS with `65 passed`, `1 skipped` at `docs/handoffs/20260604-2010-phase-4-35-bot-statistics-rendered-proof.md:34` and `:55`; Phase 4.37 recorded `ci:local` PASS and formal visual manifest PASS separately at `docs/handoffs/20260604-2055-phase-4-37-managed-env-visual-evidence.md:68-71`. Recommendation: keep command contents as:
   - `npm run ci:local`
   - `npx playwright test tests/e2e/smoke.spec.ts tests/e2e/bot-settings.spec.ts tests/e2e/bot-readiness-map.spec.ts tests/e2e/bot-statistics.spec.ts tests/e2e/warning-summary-visual.spec.ts tests/e2e/admin-mobile-pg8.spec.ts`
   - `npm run evidence:visual -- --inventory tests/e2e/screenshots`
   Then document that formal reviewed visual acceptance is a follow-up command after screenshot review. Target part: local automated acceptance.

3. Severity P1 - The local bot/admin wrapper must continue to exclude managed worker continuity and managed selected-user admin DB matrix gates. Evidence: `package.json:23-24` defines direct/managed worker continuity separately; `package.json:35-37` defines direct/managed admin-user bot DB e2e separately; `tests/integration/worker-continuity-acceptance-runner.test.ts:42-47` asserts worker continuity managed gates stay outside default gates; `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:28-33` asserts the admin DB harness stays outside default `e2e` and `ci:local`; Phase 4.37 marked both managed gates NOT RUN due missing admin DB env at `docs/handoffs/20260604-2055-phase-4-37-managed-env-visual-evidence.md:73-75`. Recommendation: do not include `npm run accept:worker:continuity:managed`, `npm run accept:worker:continuity`, `npm run e2e:admin-user-bots:db:managed:matrix`, `npm run e2e:admin-user-bots:db:managed`, or `npm run e2e:admin-user-bots:db` in the repeatable no-live local runner. Target part: managed/live boundary.

4. Severity P1 - Formal visual manifest acceptance is the main semantic gap in the existing wrapper: `accept:bots:local` validates inventory only, not reviewed screenshot content. Evidence: `scripts/gates.mjs:57-59` runs only `npm run evidence:visual -- --inventory tests/e2e/screenshots`; `scripts/check-retained-visual-artifacts.mjs:306-327` makes inventory count images but requires a manifest for acceptance; `scripts/check-retained-visual-artifacts.mjs:337-348` is the manifest validation pass path; Phase 4.37 has a current reviewed manifest PASS with `107` reviewed artifacts at `docs/handoffs/20260604-2055-phase-4-37-managed-env-visual-evidence.md:68`. Recommendation: keep `accept:bots:local` as automated rendered/local acceptance and add a documented second command for formal visual acceptance:
   - `npm run evidence:visual -- --manifest logs/retained-visual-artifacts/<run-id>/visual-review.json tests/e2e/screenshots`
   Do not bake a dated manifest path into the package script unless the runner also proves manifest freshness. Target part: visual evidence.

5. Severity P2 - Visual manifest freshness can drift even when the checker passes, because the manifest validates paths/review metadata, not screenshot hashes. Evidence: `scripts/check-retained-visual-artifacts.mjs:185-243` validates manifest entries against scanned image paths and labels but does not compare file hashes or mtimes; current local metadata shows `logs/retained-visual-artifacts/20260604-2055-bot-admin-local/visual-review.json` has `107` entries and a later mtime than the current latest screenshot, but future e2e runs can overwrite the same paths. Recommendation: after running `accept:bots:local`, require fresh manual/OCR review before a new formal visual claim, or enhance the manifest format later with screenshot hashes and have the wrapper reject stale manifests. Target part: evidence freshness.

6. Severity P2 - Runtime and port risks are real but already partly mitigated by the low-noise wrapper. Evidence: `playwright.config.ts:4-5` defaults to port `3410` and `playwright.config.ts:27-31` starts a non-reused dev server; the DB-backed admin config uses default port `3414` at `playwright.admin-user-bots-db.config.ts:36-37`; `scripts/gates.mjs:5-11` explains the wrapper exists to avoid Windows output buffering by running gates sequentially and quietly; `scripts/gates.mjs:119-138` writes compact retained logs and summary. Recommendation: use `npm run accept:bots:rendered` for faster browser-only proof and `npm run accept:bots:local` for the longer full local bundle; if port conflicts recur, run from PowerShell with an explicit unused `E2E_PORT` before the command rather than changing the runner to reuse stale servers. Target part: local runner ergonomics.

7. Severity P2 - The wrapper writes local evidence logs, so it is not a read-only command even though it avoids product/runtime mutation. Evidence: `scripts/gates.mjs:27-28` targets `logs/gates`; `scripts/gates.mjs:82-88` creates/uses that workspace log root; `scripts/gates.mjs:128` writes per-gate logs; `scripts/gates.mjs:137` writes `logs/gates/summary.txt`; `.gitignore` ignores `logs/` as shown by `git check-ignore -v logs/retained-visual-artifacts/20260604-2055-bot-admin-local/visual-review.json`. Recommendation: classify `accept:bots:local` as safe-local/product-read-only but filesystem-artifact-writing, not a read-only audit command. Target part: evidence/log classification.

## Decisions
- Recommended canonical automated runner: use existing `npm run accept:bots:local`.
- Recommended faster rendered-only runner: use existing `npm run accept:bots:rendered`.
- Recommended command contents for `accept:bots:local`: `ci:local` plus the six-file focused bot/admin Playwright pack plus visual inventory, exactly as implemented by `scripts/gates.mjs:73-74`.
- Recommended formal visual command remains separate after fresh review: `npm run evidence:visual -- --manifest logs/retained-visual-artifacts/<run-id>/visual-review.json tests/e2e/screenshots`.
- Do not add managed DB gates, live exchange pings, live bot start/stop/apply-config, provider probes, deploy, SSH/tmux/systemd, GitHub CI, raw env dumps, or raw secret reads to this local wrapper.
- If a clearer npm alias is desired, add only an alias to the existing wrapper, not a new duplicated command chain:

```json
"accept:bot-admin:local": "npm run accept:bots:local",
"accept:bot-admin:rendered": "npm run accept:bots:rendered"
```

## Risks
- `npm run accept:bots:local` is long-running because it includes the full `ci:local` chain, root Vitest, web build, then Playwright. Use `npm run accept:bots:rendered` for focused browser proof.
- Default Playwright port `3410` can conflict with another local dev server; the admin DB harness uses `3414` when run separately. Prefer explicit `E2E_PORT` override for rendered runs if needed.
- The visual inventory step is not formal reviewed visual acceptance. A fresh `--manifest` run is required after manual/OCR review.
- A stale manifest can pass if screenshots are overwritten at the same paths; freshness needs operator discipline today or a later hash/mtime enhancement.
- Managed worker continuity and admin-user DB matrix are safe-local only with approved maintenance Postgres URLs, but they create/drop throwaway DBs and can produce browser artifacts. They remain excluded from this runner.
- `logs/gates` and retained visual logs are ignored generated evidence. Preserve summaries/manifests explicitly when they are part of an operator evidence package.

## Verification/tests
RUN in this read-only audit:
- `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603...origin/codex/bot-analytics-settings-canary-20260603` with large pre-existing dirty/untracked tree.
- `git log -1 --oneline` - observed `e2d705f Upgrade Legacy bot settings and pub_id stats`.
- `rg --files` and `rg -n` searches over `package.json`, `playwright*.ts`, `scripts`, `tests/e2e`, `tests/integration`, and `docs/handoffs` to locate bot/admin local gates.
- Read-only line inspection with `Get-Content` over the files listed in `## Files inspected`.
- Visual metadata check only: current `tests/e2e/screenshots` image count is `107`; current `logs/retained-visual-artifacts/20260604-2055-bot-admin-local/visual-review.json` exists locally with `107` artifact entries; current manifest mtime is later than the latest screenshot mtime.
- `git check-ignore -v logs/retained-visual-artifacts/20260604-2055-bot-admin-local/visual-review.json` - confirmed generated visual evidence is ignored by `logs/`.

NOT RUN in this audit:
- `npm run accept:bots:local` - not run; writes `logs/gates`, starts Playwright dev server, and can overwrite screenshot evidence.
- `npm run accept:bots:rendered` - not run; starts Playwright dev server, writes gate logs, and can overwrite screenshot evidence.
- `npm run ci:local`, `npm test`, lint, typecheck, build, secret scan, governance, and root e2e - not rerun; Phase 4.36-4.37 already recorded green local results and this lane was read-only.
- `npm run evidence:visual -- --inventory tests/e2e/screenshots` and `npm run evidence:visual -- --manifest ... tests/e2e/screenshots` - not rerun; this lane inspected current script/manifest metadata only.
- `npm run accept:worker:continuity:managed`, `npm run accept:worker:continuity`, `npm run e2e:admin-user-bots:db:managed:matrix`, `npm run e2e:admin-user-bots:db:managed`, and `npm run e2e:admin-user-bots:db` - not run; these are managed/throwaway DB gates and remain blocked or opt-in.
- Live exchange ping, live bot start/stop/apply-config, live provider/exchange probes, deploy, SSH/tmux/systemd, GitHub CI, production monitoring, raw env dumps, and raw secret reads - not run.

## Next actions
1. Treat the existing runner as canonical automated local proof:

```powershell
cd "C:\Users\maxib\GTE BOT\wtc_ecosystem_platform"
npm run accept:bots:local
```

2. For a faster browser-only loop, run:

```powershell
npm run accept:bots:rendered
```

3. After screenshot-producing runs, perform fresh manual/OCR review before formal visual acceptance, then run:

```powershell
npm run evidence:visual -- --manifest logs/retained-visual-artifacts/<run-id>/visual-review.json tests/e2e/screenshots
```

4. If the team wants a clearer name, add only alias scripts to `package.json` pointing at the existing wrapper. Do not duplicate the long command string.

5. Keep managed worker continuity and selected-user admin DB matrix as separate operator-approved gates:

```powershell
$env:WORKER_CONTINUITY_ADMIN_DATABASE_URL = '<operator-provided-maintenance-postgres-url>'
npm run accept:worker:continuity:managed
Remove-Item Env:WORKER_CONTINUITY_ADMIN_DATABASE_URL -ErrorAction SilentlyContinue

$env:ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL = '<operator-provided-maintenance-postgres-url>'
npm run e2e:admin-user-bots:db:managed:matrix
Remove-Item Env:ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL -ErrorAction SilentlyContinue
```

Accept those managed gates only with created/dropped throwaway DB names, expected worker tuple or scenario assertions, redacted output, and reviewed/scanner-clean retained artifacts.
