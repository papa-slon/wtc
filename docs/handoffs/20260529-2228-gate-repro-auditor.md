# gate-repro-auditor handoff

## Scope
Phase 1.6.1 Task A — "Gate truth: clean sequential verification." READ-ONLY audit of the current
generated-artifact + port state of the monorepo at `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`, to
prescribe a safe clean-then-sequential procedure before the operator runs the canonical gate chain
STRICTLY SEQUENTIALLY:
`governance:check → check:core → lint → typecheck → typecheck -w @wtc/web → test → secret:scan → coverage → build -w @wtc/web → e2e`.
`next build`, `e2e`, and `coverage` must NOT run in parallel (they conflict via `.next` / generated
artifacts). No files mutated except this handoff; no npm scripts / builds / tests / coverage / e2e /
installs / git run; no servers started or stopped. Evidence gathered read-only via `netstat`,
`Get-NetTCPConnection`, `Get-CimInstance Win32_Process`, PowerShell directory listings, and file reads.

> Method note: an early Git-Bash `test -e`/`ls` pass on the space-containing path mis-reported several
> dirs as empty/absent. All artifact facts below are from PowerShell `Test-Path` + `Get-ChildItem -Force
> -Recurse`, which is authoritative on this host. They SUPERSEDE the earlier Git-Bash readings AND the
> stale `playwright.config.ts` description in the 2052 handoff (which no longer matches the file).

## Files inspected
- C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\AGENTS.md
- C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\docs\SESSION_PROTOCOL.md
- C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\docs\handoffs\0000-orchestrator-seed.md  (canonical seed; the prompt's `docs/handoffs/20260528-2236-orchestrator-seed.md` does NOT exist — see Finding 9)
- C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\docs\STATUS.md
- C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\docs\IMPLEMENTED_FILES.md
- C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\docs\NEXT_ACTIONS.md
- C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\docs\handoffs\20260529-2052-phase-1-6-enforcement-persistence-truth.md
- C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\playwright.config.ts
- C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\package.json
- C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\apps\web\package.json
- C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\.gitignore
- C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\tests\e2e\smoke.spec.ts
- C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\scripts\  (only file present: check-governance.mjs — see Finding 4)
- Port + process state: ports :3100 / :3000; all running `node.exe` command lines
- Directory state (PowerShell, recursive): apps\web\.next; apps\web (top level); test-results; playwright-report; coverage; tests\e2e\screenshots; apps\web\{test-results,playwright-report,coverage}; gate-ledger.json; root .next

## Files changed
None — read-only audit

## Findings

1. **No stale dev server on :3100 (or :3000). The running node/electron processes are unrelated apps, not a :3100 server. Severity: INFO (good), with a kill-safety caveat.**
   - Evidence (checked 3×: 2026-05-29 22:25, 22:26, 22:32 local): `netstat -ano | Select-String ':3100',':3000'` → `NO_LISTENER_ON_3100_OR_3000`; `Get-NetTCPConnection -LocalPort 3100/3000` → `NONE`. Four `node.exe`/electron processes exist, identified via `Get-CimInstance Win32_Process`:
     - PID 51072 & 59824 = `node mcp/tradingview-mcp/src/server.js` (a TradingView MCP server),
     - PID 51968 = `npm run start` (`node ... npm-cli.js run start`),
     - PID 28848 = `...\TV_GREENFIELD_TERMINAL\...electron-vite\bin\electron-vite.js preview` (the Greenfield/Axioma desktop terminal preview).
     None binds :3100 or :3000; a process search for `next|playwright|vitest|3100` returned nothing.
   - Implication: e2e can start its `next dev --port 3100` cleanly; there is NO stray Next/Playwright server to stop. (Standing hazard remains — Finding 5 — so RE-CONFIRM :3100 immediately before e2e.)
   - Recommendation (operator, NOT the auditor): before e2e run `netstat -ano | findstr :3100`. If a PID appears, confirm it with `Get-CimInstance Win32_Process -Filter "ProcessId=<PID>"`, and only if it is a stray `next dev` on :3100 stop it with `Stop-Process -Id <PID>`. Do NOT blanket-kill node — PIDs 51072/51968/59824/28848 are other apps (MCP server, `npm start`, the terminal) and must not be killed.

2. **`apps/web/.next` is a POPULATED, STALE build tree (dev + production webpack caches + a `trace`). Severity: HIGH — can poison `npm run build -w @wtc/web`.**
   - Evidence (`Test-Path` → True; recursive enumerate → **548 entries / 395 files**): top-level has `cache/` (dir mtime 2026-05-29 16:42), `diagnostics/` (22:07:39), `server/` (22:07:35), `static/` (22:07:39), `types/` (22:07:32), plus manifests (`build-manifest.json`, `app-build-manifest.json`, `prerender-manifest.json`, `routes-manifest.json`, …) and a **`trace`** file (318594 B, 22:08:32). `apps/web/.next/cache/webpack/` contains FOUR mode subdirs — `client-development`, `client-production`, `server-development`, `server-production` (+ `client-development-fallback`, `edge-server-production`) — with `.pack`/`.pack.gz` files spanning **16:40 → 22:08** (e.g. `server-production/4.pack` 24 MB @ 17:38; `client-development/3.pack.gz` 10 MB @ 22:07). Newest files are dev-server `page_client-reference-manifest.js` artifacts @ 22:08:32 (i.e. the last writer was the e2e `next dev`, not a clean `next build`). No `BUILD_ID` file at top level; no `*.lock` files.
   - Implication: this `.next` is a MIX of prior `next build` (production packs) and the e2e `next dev` (development packs), last touched 22:08 by the dev server. A stale/mixed `.next` is exactly what can make `npm run build -w @wtc/web` flaky (EBUSY/ENOENT, stale incremental output, or a "green" build that reused old artifacts). It MUST be deleted before the build gate to guarantee a from-scratch build. The `trace` and the populated `cache/webpack` confirm prior partial/parallel runs left residue.
   - Recommendation: delete `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\apps\web\.next` before the sequential run (REQUIRED — see Decisions).

3. **`test-results/` contains leftover FAILURE artifacts from the last e2e run, and `.last-run.json` says `"status":"failed"`. Severity: HIGH — would mislead a fresh run.**
   - Evidence: `test-results/.last-run.json` (96 B, 22:08:53) = `{"status":"failed","failedTests":["4219922fea2e2bd3c691-c90441813aa94b1f7fed"]}`. Folder `test-results/smoke-public-landing-renders-desktop/` (22:08:03) holds `error-context.md` (4054 B), `test-failed-1.png` (5851 B), `trace.zip` (12904 B) — the classic Playwright FAILED-test triple (config: `screenshot:'only-on-failure'`, `trace:'retain-on-failure'`). So the "public landing renders" smoke test FAILED on the most recent e2e run (desktop project).
   - Implication: stale RED state on disk. If not cleared, an operator/report glancing at `test-results` (or any reporter reading `.last-run.json`) could attribute this failure to the new run, or be confused about which run produced it. Playwright also keys `--last-failed` off `.last-run.json`. Delete so the fresh e2e run starts from a clean slate.
   - Recommendation: delete `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\test-results` before the run (REQUIRED). NOTE: this prior failure is itself a signal the operator should expect/triage — see Risks.

4. **There is NO `scripts/verify.mjs` and NO npm script that runs the prompt's exact 10-gate chain. The only sequential aggregate is `ci:local`, which OMITS coverage + e2e and uses a DIFFERENT order. Severity: HIGH (the canonical sequential runner does not exist yet).**
   - Evidence: `Read scripts/verify.mjs` → "File does not exist." `scripts/` contains only `check-governance.mjs` (6815 B). `package.json` scripts: `governance:check`=`node scripts/check-governance.mjs`; `check:core`= inline chain of 7 `node --experimental-strip-types packages/*/src/__smoke__.ts`; `lint`=`eslint . --max-warnings 0`; `typecheck`=`tsc --noEmit -p tsconfig.json`; `test`=`vitest run`; `coverage`=`vitest run --coverage`; `secret:scan`=`secretlint "**/*"`; `build`=`npm run build --workspaces --if-present`; `e2e`=`playwright test`; **`ci:local`** = `check:core && governance:check && lint && typecheck && (typecheck -w @wtc/web) && secret:scan && test && (build -w @wtc/web)`.
     - `ci:local` differs from the prompt's canonical chain: it puts `check:core` before `governance:check`, `secret:scan` before `test`, and **excludes `coverage` and `e2e` entirely**.
   - Implication: the operator must run the 10 gates in the prompt's exact order EITHER by hand (sequentially, each blocking) OR via a new runner. Do NOT assume `npm run verify` exists, and do NOT use `ci:local` as the canonical chain (it would skip coverage + e2e — the two artifact-conflicting gates this audit is about). Note `gate-ledger.json` does NOT exist (no ledgering runner present). (Note: STATUS/IMPLEMENTED_FILES do not mention verify.mjs; the prompt's reference to it appears aspirational.)

5. **`playwright.config.ts` makes parallel build/e2e unsafe and `reuseExistingServer` is effectively TRUE locally. Severity: HIGH (standing hazard). NOTE the config differs from the 2052 handoff's description.**
   - Evidence (full file, mtime 2026-05-29 18:23):
     - `testDir:'./tests/e2e'`; **`fullyParallel:false`, `workers:1`** (serial within e2e); `timeout:90_000` (per-test); `expect.timeout:15_000`.
     - `use:{ baseURL:'http://localhost:3100', screenshot:'only-on-failure', trace:'retain-on-failure' }` (NO `video`; NO top-level `outputDir` → defaults to `test-results/`; NO `reporter` override → default `list`, and the HTML report is NOT auto-generated unless invoked).
     - `projects`: `desktop` (Desktop Chrome, 1440×900) + `mobile` (Desktop Chrome, 390×844).
     - `webServer:{ command:'npm run dev:e2e -w @wtc/web', url:'http://localhost:3100', timeout:150_000, reuseExistingServer: !process.env.CI }`. `apps/web` `dev:e2e` = `next dev --port 3100`.
   - `reuseExistingServer: !process.env.CI` ⇒ in a local/non-CI shell this is **TRUE**: if anything is already on :3100, Playwright ATTACHES to it instead of starting a fresh `next dev`, masking app/build breakage (the FALSE-GREEN hazard noted in the 2052 handoff Risks; tracked as Phase 1.6.1 Task B). The inline comment even says "never reuse in CI so stale code can't pass silently" — but locally it DOES reuse.
   - Why parallel build/e2e/coverage is unsafe: the e2e webServer runs `next dev`, which writes `apps/web/.next` — the SAME tree `next build` writes (and the current `.next` shows both dev and prod packs coexisting). Running `build -w @wtc/web` concurrently with `e2e` collides on `apps/web/.next` (EBUSY/ENOENT or a partial-but-green build). `coverage` (vitest) instruments the same source tree and competes for CPU/FS. Hence build / e2e / coverage MUST be run strictly one-at-a-time.

6. **EXACT safe-clean list to delete BEFORE the sequential run (generated-only; absolute paths). Severity: actionable.**
   1. `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\apps\web\.next` — **DELETE (REQUIRED).**
      - Why: stale, mixed dev+prod build tree last written 22:08 by the e2e dev server (Finding 2); can poison `build -w @wtc/web` and be silently reused by the e2e `next dev`. Guarantees a from-scratch build.
      - Generated, not source: `.gitignore` line 7 (`.next/`); recreated by `next build` / `next dev`.
   2. `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\test-results` — **DELETE (REQUIRED).**
      - Why: leftover FAILED-run artifacts + `.last-run.json{status:failed}` (Finding 3); stale RED that would mislead the fresh run and `--last-failed`.
      - Generated, not source: `.gitignore` line 19 (`test-results/`); Playwright default `outputDir`.
   3. `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\coverage` — **DELETE (RECOMMENDED).**
      - Why: stale coverage output (278 entries, full HTML + `clover.xml` 306 KB + `coverage-final.json` 553 KB, mtime 22:07). vitest `--coverage` overwrites it, but a crash mid-coverage could leave old+new mixed; deleting guarantees the coverage gate reflects only this run.
      - Generated, not source: `.gitignore` line 18 (`coverage/`); produced by `vitest run --coverage`.
   - **`playwright-report/` — nothing to do:** it does NOT exist (the default config does not auto-emit an HTML report).
   - **`tests/e2e/screenshots` — DELETE ONLY IF you intend to refresh screenshots; see Finding 7 for the caveat that these PNGs are effectively tracked/source, not pure generated artifacts.** Default recommendation: DO NOT delete (leave them; the smoke run overwrites each on success).

7. **`tests/e2e/screenshots/*.png` are GENERATED by `page.screenshot()` but are effectively SOURCE/tracked (only `*.tmp.png` is gitignored), and they are NOT Playwright baselines. Severity: MEDIUM — handle deliberately, do not treat as throwaway.**
   - Evidence: `tests/e2e/smoke.spec.ts` writes 8 screenshots/project via explicit `page.screenshot({ path: 'tests/e2e/screenshots/<name>-<project>.png', fullPage:true })` (NO `toHaveScreenshot`/`toMatchSnapshot` anywhere — so these are NOT golden baselines; deleting destroys no comparison reference). The dir holds a committed `.gitkeep` plus **16 PNGs** (`landing/pricing/app-overview/bot-tortila/axioma-terminal/security/admin-entitlements/admin-tradingview` × desktop+mobile). 15 are dated 22:08 (last run); `landing-desktop.png` is OLDER (21:55:38) — consistent with the desktop "public landing renders" test FAILING before its screenshot line on the last run (Finding 3).
   - Critically, `.gitignore` line 21 only ignores `tests/e2e/screenshots/*.tmp.png` — the real `*.png` are NOT ignored, i.e. they are TRACKED/source-like (the `.gitkeep` confirms the dir is meant to be committed). So deleting them is NOT a clean of "generated artifacts" in the same sense as `.next`/`test-results`/`coverage`.
   - Implication: per the prompt, delete `tests/e2e/screenshots` ONLY IF screenshots need refreshing. Since the smoke suite REGENERATES all of them on a passing run, you do not need to pre-delete them to get fresh shots; a green run refreshes them in place (including `landing-desktop.png` once that test passes). RECOMMENDATION: do NOT delete them as part of the gate clean. If a fully pristine refresh is explicitly wanted, you may delete the 16 `*.png` (keep `.gitkeep`) — but treat that as a source change, not artifact hygiene.

8. **Explicit warning — do NOT delete anything else. Severity: HIGH (guardrail).**
   - Do NOT delete: `node_modules/` (would force a reinstall — out of scope; STATUS notes `npm ci` was not re-run, node_modules is present and required), `apps/`, `packages/`, `docs/`, `scripts/` (incl. `check-governance.mjs`), `tests/` source, `tests/e2e/*.spec.ts`, `tests/e2e/screenshots/.gitkeep`, `playwright.config.ts`, `vitest.config.ts`, any `package.json` / `package-lock.json`, `tsconfig*` (incl. `apps/web/tsconfig.tsbuildinfo` — it is a gitignored incremental cache, but leave it; deleting forces a slower full typecheck and is unnecessary), `apps/web/next-env.d.ts` (Next-generated but required for the typecheck:web gate — do NOT delete), `eslint.config.js`, `.gitignore`, `.env*`, `.github/`, `.secretlintrc.json`. Deleting only `.next` + `test-results` (required) and `coverage` (recommended) is sufficient and safe.

9. **e2e uses `next dev --port 3100` (NOT a built server) ⇒ no build→e2e runtime dependency; serialization still mandatory. Severity: INFO.**
   - Evidence: `playwright.config.ts` webServer = `npm run dev:e2e -w @wtc/web` → `apps/web` `dev:e2e` = `next dev --port 3100`. e2e does not consume `next start`/`BUILD_ID` output. Root `package.json` `e2e`=`playwright test`.
   - Implication: e2e compiles on-demand via the dev server, so it does NOT require `build -w @wtc/web` to have produced output. `build` precedes `e2e` in the chain purely for ORDERING/serialization (avoid concurrent `.next` writers) + fail-fast on build breakage — not a runtime dependency. Cleanest path: run `build` (creates a fresh prod `.next`), let it FULLY complete, then run `e2e` (its `next dev` overwrites the same `.next` with dev artifacts, sequentially — safe because build already passed and nothing else writes concurrently). If you want the cleanest possible e2e, you MAY delete `.next` again between build and e2e, but it is not required.
   - Side note: the prompt's seed path `docs/handoffs/20260528-2236-orchestrator-seed.md` does NOT exist; the canonical seed read for context is `docs/handoffs/0000-orchestrator-seed.md`.

## Decisions
- **Safe-clean set (generated-only):** REQUIRED — delete `apps\web\.next` and `test-results`. RECOMMENDED — delete `coverage`. LEAVE — `tests\e2e\screenshots` (tracked PNGs, not baselines; the smoke run refreshes them in place). `playwright-report` and `gate-ledger.json` and root `.next` do not exist → nothing to do. All required/recommended targets are `.gitignore`-listed generated dirs (`.next/`, `test-results/`, `coverage/`); no source touched.
- **No existing canonical runner:** run the 10 gates BY HAND in the prompt's exact order, each command fully completing before the next starts. Do NOT rely on a `verify.mjs` (absent) and do NOT substitute `ci:local` (it omits coverage + e2e and reorders).
- **Strict serialization of build / e2e / coverage** (never two concurrently) — they all touch `apps/web/.next` or the source tree.
- **e2e on `next dev`** ⇒ no build→e2e runtime dependency, but ordering/serialization remains mandatory (Finding 9).

## Risks
- **The last e2e run FAILED** ("public landing renders", desktop — `.last-run.json{status:failed}`, Finding 3). This is pre-existing RED, not caused by artifact staleness. After the clean, the operator should EXPECT to triage this (read the trace.zip before deleting if they want the diagnosis, or just re-run and see if it reproduces). Cleaning removes the old evidence — capture it first if needed.
- **`reuseExistingServer` effectively TRUE locally (Finding 5):** until Task B flips it to literal `false`, if ANY process is on :3100 when e2e starts, Playwright attaches to it → possible FALSE GREEN. Mitigation: confirm :3100 free immediately before e2e (currently free, Finding 1), or run e2e with `CI=1` to force a fresh owned server (note `CI=1` also flips `reuseExistingServer→false` AND, here, nothing else worker-wise since workers is already 1 and fullyParallel already false; main effect is server ownership + Playwright's own CI defaults like `forbidOnly`).
- **Concurrent `.next` writers:** `next build` and the e2e `next dev` both write `apps/web/.next` (the current tree literally shows prod+dev packs coexisting); vitest coverage competes on the same source tree. Any two of build/e2e/coverage in parallel risk EBUSY/ENOENT or a partial-but-green build. Mitigation: strict sequential order; never background them.
- **No auto-clean + no canonical runner (Finding 4):** the operator must clean manually AND sequence the 10 gates manually; there is no script that does either. Easy to accidentally skip coverage/e2e by reaching for `ci:local`.
- **Killing the wrong process:** the live node/electron PIDs are other apps (MCP server, `npm start`, the terminal preview) — a blanket `Stop-Process -Name node` would kill them. Only ever target a PID confirmed to be a :3100 listener.

## Verification/tests
- No gates executed (read-only scope). No builds / tests / coverage / e2e / installs / git run; no servers started or stopped.
- Ports verified read-only 3× (2026-05-29 ~22:25 / 22:26 / 22:32 local): `netstat | Select-String ':3100',':3000'` → none; `Get-NetTCPConnection 3100/3000` → NONE. All node/electron command lines inspected (tradingview-mcp ×2, `npm run start`, electron-vite preview) — none a Next/Playwright server.
- Artifact state verified via PowerShell `Test-Path` + recursive `Get-ChildItem -Force -Recurse`:
  - `apps/web/.next` = PRESENT, POPULATED (548 entries / 395 files; `cache/webpack` dev+prod packs 16:40→22:08; `trace` 318 KB @ 22:08:32).
  - `test-results` = PRESENT with FAILURE artifacts (`.last-run.json{status:failed}`; `smoke-public-landing-renders-desktop/{error-context.md,test-failed-1.png,trace.zip}` @ 22:08:03).
  - `coverage` = PRESENT, POPULATED (278 entries; `clover.xml` 306 KB, `coverage-final.json` 553 KB; mtime 22:07).
  - `tests/e2e/screenshots` = PRESENT (`.gitkeep` + 16 `*.png`; 15 @ 22:08, `landing-desktop.png` @ 21:55:38).
  - `playwright-report`, `apps/web/{test-results,playwright-report,coverage}`, `gate-ledger.json`, root `.next` = ABSENT.
- Config/spec/runner semantics verified by reading `playwright.config.ts`, `package.json`, `apps/web/package.json`, `.gitignore`, `tests/e2e/smoke.spec.ts`, and the `scripts/` listing (only `check-governance.mjs`; `verify.mjs` absent).

## Next actions
1. **Operator (Task C) — clean, then run the 10 gates STRICTLY SEQUENTIALLY (by hand):**
   a. (Optional) preserve the failing-test diagnosis first: open `test-results\smoke-public-landing-renders-desktop\trace.zip` / `error-context.md` if you want to know why "public landing renders" failed before deleting.
   b. Confirm :3100 free: `netstat -ano | findstr :3100` (currently free). If a PID shows, `Get-CimInstance Win32_Process -Filter "ProcessId=<PID>"` to confirm it is a stray `next dev` on :3100, then `Stop-Process -Id <PID>`. Never kill node blindly (live PIDs are MCP/terminal/npm-start).
   c. Safe-clean (generated-only):
      - REQUIRED: `Remove-Item -Recurse -Force "C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\apps\web\.next"`
      - REQUIRED: `Remove-Item -Recurse -Force "C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\test-results"`
      - RECOMMENDED: `Remove-Item -Recurse -Force "C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\coverage"`
      - LEAVE `tests\e2e\screenshots` (tracked PNGs; the smoke run refreshes them). Delete its `*.png` (keep `.gitkeep`) ONLY if you explicitly want a pristine screenshot refresh.
   d. Run, in EXACTLY this order, each command fully completing before the next (do NOT use `ci:local`; do NOT background any gate):
      1. `npm run governance:check`
      2. `npm run check:core`
      3. `npm run lint`
      4. `npm run typecheck`
      5. `npm run typecheck -w @wtc/web`
      6. `npm test`
      7. `npm run secret:scan`
      8. `npm run coverage`
      9. `npm run build -w @wtc/web`
      10. `npm run e2e`
   e. Sequencing / "wait for prior to fully exit" notes:
      - `coverage` (vitest) must FULLY exit before `build -w @wtc/web` starts (both touch the source / `.next` tree).
      - `build -w @wtc/web` must FULLY complete before `e2e` starts (avoid concurrent `.next` writers). e2e does NOT depend on the build's output at runtime (it uses `next dev --port 3100`), but serialization is mandatory. Optionally delete `apps\web\.next` again between build and e2e for the cleanest e2e (not required).
      - Before `e2e`, RE-CONFIRM no :3100 listener. For extra safety against the `reuseExistingServer` FALSE-GREEN hazard, run e2e with `CI=1` (PowerShell: `$env:CI='1'; npm run e2e; Remove-Item Env:CI`) so Playwright starts and OWNS its own :3100 server.
      - Expect the prior "public landing renders" failure to recur unless it was environmental — triage if it does.
   f. Record observed gate results in `docs/STATUS.md` (truth over green: a gate not observed passing this session is RED).
2. **Implementer (Task B):** set `reuseExistingServer: false` (literal) in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\playwright.config.ts` to remove the stale-server FALSE-GREEN hazard (Finding 5).
3. **Orchestrator / follow-ups:** (a) there is NO canonical sequential gate runner — consider adding `scripts/verify.mjs` (the prompt assumes it exists) that runs the 10 gates in order, halts on first failure, optionally auto-cleans `.next`/`test-results`/`coverage` first, and writes `gate-ledger.json` (Finding 4); (b) investigate WHY the last e2e "public landing renders" failed (Risks); (c) note `apps/web/tsconfig.tsbuildinfo` and `next-env.d.ts` are generated-but-needed — leave out of any clean.
