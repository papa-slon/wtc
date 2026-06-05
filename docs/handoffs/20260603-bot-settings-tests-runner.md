# ecosystem-tests-runner handoff
## Scope
Read-only/probe tests-runner audit for the bot settings/statistics implementation in
`C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Scope was limited to safe local inspection, source-only tests, in-memory/PGlite tests, and non-live repo gates that do not
start/stop bots, apply live config, mutate live servers, print secrets, or call exchange/live bot control paths.

Primary question: what exact verification plan can prove the bot settings/statistics implementation does not stop bots and
passes repo gates?

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260603-1522-phase-3-69-legacy-premium-settings.md`
- `docs/handoffs/20260603-1459-ecosystem-ux-ui-designer.md`
- `docs/handoffs/20260603-1504-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260603-1504-ecosystem-db-architect.md`
- `package.json`
- `apps/web/package.json`
- `vitest.config.ts`
- `playwright.config.ts`
- `playwright.auth-db.config.ts`
- `playwright.lms-db.config.ts`
- `scripts/gates.mjs`
- `scripts/safe-worker-tick.mjs`
- `scripts/safe-preview.mjs`
- `apps/worker/package.json`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/legacy-live.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts`
- `tests/integration/legacy-live-worker-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/e2e/smoke.spec.ts`
- `logs/dev-wtc-bot-ui.err.log`
- `logs/dev-wtc-bot-ui.out.log`
- `logs/preview-safe.out.log`
- `logs/preview-safe.err.log`
- `logs/gates/summary.txt`

## Files changed
- `docs/handoffs/20260603-bot-settings-tests-runner.md` - this handoff only.

## Findings
1. Severity: High. The repo has a safe local gate spine, and the current probe observed the non-live subset green. Evidence:
   `package.json:13` to `package.json:18` define typecheck/test/secret/lint gates; `package.json:42` defines
   `check:core`; `package.json:44` defines `ci:local`; this probe ran governance, check:core, focused Vitest, root/web
   typecheck, lint, secret scan, and memory worker smoke successfully. Recommendation: use this local spine before any
   deploy/browser proof, then run artifact-producing gates only when retained outputs are allowed. Target part: repo gates.

2. Severity: Critical. `worker:smoke` is safe only when `DATABASE_URL` is absent or explicitly points to a throwaway/approved
   DB. Evidence: `scripts/safe-worker-tick.mjs:4` says a set `DATABASE_URL` exercises the real DB tick;
   `scripts/safe-worker-tick.mjs:11` to `scripts/safe-worker-tick.mjs:13` force mock/no-live-control flags;
   `scripts/safe-worker-tick.mjs:21` to `scripts/safe-worker-tick.mjs:22` add `--memory-demo` only when `DATABASE_URL` is
   unset; the DB worker writes health/snapshot rows via `apps/worker/src/index.ts:119`, `apps/worker/src/index.ts:128`, and
   `apps/worker/src/index.ts:207`. Recommendation: never run DB worker smoke from an inherited shell with an unknown/live
   `DATABASE_URL`; first print only SET/NOT_SET env presence, then use no-DB memory mode or an explicit throwaway DB. Target
   part: worker smoke.

3. Severity: Critical. Bot start/stop/apply remains hard-disabled at the adapter boundary and has focused regression
   coverage. Evidence: `packages/bot-adapters/src/control.ts:4` says stop must never imply close positions;
   `packages/bot-adapters/src/control.ts:16` to `packages/bot-adapters/src/control.ts:17` throws unless both the feature
   flag and audit approval are present; `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts:127` to
   `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts:133` assert start/stop/apply throw; `tests/e2e/smoke.spec.ts:236`
   to `tests/e2e/smoke.spec.ts:244` and `tests/e2e/smoke.spec.ts:302` to `tests/e2e/smoke.spec.ts:310` assert UI controls
   are disabled. Recommendation: keep these focused tests in the required bot settings/statistics proof set, and keep live
   start/stop/apply-config in NOT RUN. Target part: bot control boundary and UI.

4. Severity: High. Legacy DB reads are code-whitelisted, but column-restricted deployed DB role proof is still a required
   acceptance gate. Evidence: `apps/worker/src/legacy-live.ts:319` to `apps/worker/src/legacy-live.ts:326` select safe account
   columns only; `apps/worker/src/legacy-live.ts:331` and `apps/worker/src/legacy-live.ts:367` to
   `apps/worker/src/legacy-live.ts:370` assert no secret fields; `tests/integration/legacy-live-worker-static.test.ts:164`
   to `tests/integration/legacy-live-worker-static.test.ts:179` prove serialized snapshots and SQL do not include
   `api_key`/`secret_key`; the current aggregate leaves column-restricted Legacy DB role proof NOT RUN at
   `docs/handoffs/20260603-1522-phase-3-69-legacy-premium-settings.md:92` to
   `docs/handoffs/20260603-1522-phase-3-69-legacy-premium-settings.md:95`. Recommendation: add/run a role-proof preflight
   before calling deployed Legacy DB live-read production-safe; it must prove denied access to secret columns without
   printing provider values. Target part: Legacy worker/deploy acceptance.

5. Severity: Medium. Default Playwright is configured to be bot-safe, but it is not pure read-only because it starts a local
   dev server and can update screenshot/trace artifacts. Evidence: `playwright.config.ts:27` to `playwright.config.ts:38`
   starts local Next with `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`;
   `playwright.config.ts:9` excludes the opt-in DB e2e specs by default; `tests/e2e/smoke.spec.ts:113` to
   `tests/e2e/smoke.spec.ts:126` covers bot statistics pages. Recommendation: run `npm run e2e` during acceptance when local
   artifact writes are allowed; do not count it green from this probe. Target part: browser/visual acceptance.

6. Severity: Medium. `scripts/gates.mjs` is useful for acceptance evidence, but it writes retained logs and separates e2e
   into its own plan. Evidence: `scripts/gates.mjs:20` imports `writeFileSync`; `scripts/gates.mjs:26` writes under
   `logs/gates`; `scripts/gates.mjs:49` to `scripts/gates.mjs:53` define quick/core/full/build/e2e plans;
   `scripts/gates.mjs:107` and `scripts/gates.mjs:116` write per-gate logs and summary; `scripts/gates.mjs:44` to
   `scripts/gates.mjs:47` warn to run e2e alone. Recommendation: for a pure probe, run direct non-writing gates; for final
   acceptance, run `node scripts/gates.mjs full` and `node scripts/gates.mjs e2e` as separate evidence-producing commands.
   Target part: gate execution.

7. Severity: Medium. Current retained local dev logs are not sufficient browser proof. Evidence:
   `logs/dev-wtc-bot-ui.err.log:164` to `logs/dev-wtc-bot-ui.err.log:193` contain an earlier Next `server-only` import error
   involving `apps/web/src/features/bots/config.ts` and `LegacyAveragingConfigTable.tsx`; later local out log entries show
   `GET /app/bots/legacy/settings 200` and bot statistics `200` at `logs/dev-wtc-bot-ui.out.log:23` to
   `logs/dev-wtc-bot-ui.out.log:30`. Recommendation: do not accept stale log tails either way; require fresh build plus
   browser/Playwright checks for `/app/bots/legacy/settings`, `/app/bots/legacy`, `/app/bots/statistics?bot=legacy`, and
   `/admin/bots`. Target part: frontend/browser acceptance.

## Decisions
- Ran only gates that were safe in this probe lane: local source tests, PGlite/in-memory worker tests, memory worker smoke,
  governance, check:core, typecheck, web typecheck, lint, and secret scan.
- Did not run live bot start/stop/apply-config under any condition.
- Did not run default e2e or gate-runner full/e2e because they start a local web server and/or write retained artifacts; they
  are safe from live bot mutation but should be acceptance-phase commands, not pure read-only probe commands.
- Treat `npm run worker:smoke` as safe only after confirming `DATABASE_URL` is absent; if a DB URL is present, use an explicit
  throwaway DB or mark worker DB smoke NOT RUN.
- Treat deploy/no-stop proof as a before/after live-service status exercise by the deploy/operator lane, not as something this
  local probe observed.
- No background agents were launched by this tests-runner lane, so none were left open.
- Final git status showed additional modified/untracked files outside this handoff after the probe had earlier observed a
  clean tree. They were not authored by this tests-runner lane and were left untouched.

## Risks
- This probe proves local safety gates, not the deployed canary state. It did not observe live bot service status before/after
  a deploy.
- The latest status docs headline is Phase 3.67, while the latest aggregate inspected here is Phase 3.69; rely on the latest
  aggregate for current implementation scope and rerun browser/deploy gates before updating status docs.
- Legacy deployed DB role proof remains open; source whitelisting is good, but it is not a substitute for role grants that
  deny secret columns.
- If `DATABASE_URL` is inherited from a canary/prod shell, worker DB smoke can mutate WTC DB health/snapshot tables even
  though live bot control flags are forced off.
- Browser acceptance remains open in this session; retained dev logs are inconclusive and must be replaced by fresh checks.

## Verification/tests
RUN:
- `git status --short --branch` before probe and again before handoff write - clean on
  `codex/bot-analytics-settings-canary-20260603...origin/codex/bot-analytics-settings-canary-20260603`. Final status after
  writing this handoff showed additional dirty/untracked files not authored by this tests-runner lane:
  `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`,
  `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`,
  `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`,
  `apps/web/src/features/bots/config.ts`,
  `tests/integration/bot-read-safety-static.test.ts`,
  `docs/handoffs/20260603-bot-settings-platform-db.md`,
  `docs/handoffs/20260603-bot-settings-security-access.md`,
  `docs/handoffs/20260603-bot-settings-ux-product.md`, and
  `docs/handoffs/20260603-legacy-bot-integration-auditor.md`. A subsequent final status read also showed
  `docs/handoffs/20260603-tortila-bot-integration-auditor.md` appearing from concurrent work.
- Values-hidden env presence probe for `DATABASE_URL`, `REAL_POSTGRES_DATABASE_URL`, `LMS_E2E_ADMIN_DATABASE_URL`,
  `AUDIT_APPEND_ONLY_ADMIN_DATABASE_URL`, `LEGACY_DATABASE_URL`, `LEGACY_LIVE_READS_ENABLED`,
  `TORTILA_JOURNAL_URL`, `TORTILA_JOURNAL_BASE_URL`, `SYSTEM_BOT_OWNER_ID`, `SYSTEM_BOT_INSTANCE_ID`,
  `SYSTEM_LEGACY_BOT_OWNER_ID`, `SYSTEM_LEGACY_BOT_INSTANCE_ID`, `BOT_ADAPTER_MODE`, `FEATURE_LIVE_BOT_CONTROL`, and
  `FEATURE_TV_AUTOMATION` - no listed variables printed as SET in this shell.
- `npx vitest run tests/integration/legacy-live-worker-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-statistics-static.test.ts packages/bot-adapters/src/__tests__/legacy-blocked.test.ts tests/integration/worker-tortila-snapshot.test.ts`
  -> PASS, 5 files, 78 tests.
- `npm run worker:smoke` -> PASS in memory-demo mode: `[worker:tick] memory demo tick OK`.
- `npm run governance:check` -> PASS, 0 errors, 1 known historical warning.
- `npm run check:core` -> PASS, 7 strip-smoke packages.
- `npm run typecheck` -> PASS.
- `npm run typecheck -w @wtc/web` -> PASS.
- `npm run lint` -> PASS.
- `npm run secret:scan` -> PASS.
- Static inspection of scripts, Playwright configs, worker code, focused tests, current docs, and retained local logs.

NOT RUN:
- `npm test` - not run in this probe to keep scope bounded; should be run in acceptance because it is local/non-live.
- `npm run build -w @wtc/web` / root `npm run build` - not run in this probe because it writes build output; Phase 3.69
  claims build passed, but this tests-runner did not freshly observe it.
- `npm run e2e` / `node scripts/gates.mjs e2e` - not run because it starts local Next and can update screenshots/traces;
  safe from live bots by config, but still an acceptance artifact-producing gate.
- `node scripts/gates.mjs full` - not run because it writes `logs/gates/*` and includes build output; use it when retained
  evidence writes are acceptable.
- `npm run worker:smoke` with `DATABASE_URL` or `--require-db` - not run; DB worker smoke must use a throwaway/approved DB
  and would write WTC DB health/snapshot rows.
- `npm run db:migrate`, `npm run db:seed`, `npm run accept:real-pg:managed`,
  `npm run accept:audit:append-only-role:managed`, `npm run e2e:auth:db:managed`, and `npm run e2e:lms:db:managed` - not run;
  these create/mutate/drop databases or require explicit credentials/consent.
- Live server deploy/status checks, SSH, systemctl, tmux, nginx/firewall probes, provider DB role proof, and canary browser
  checks - not run in this local probe.
- Live bot start/stop/apply-config/retest/credential rotation/exchange calls - NOT RUN by policy.

## Next actions
Exact safe verification plan for the next acceptance lane:

1. Preflight environment and workspace, without printing values:
   - `git status --short --branch`
   - print SET/NOT_SET only for all DB/bot/control env vars listed in Verification/tests.
   - Stop if `FEATURE_LIVE_BOT_CONTROL` or `FEATURE_TV_AUTOMATION` is true.
   - Stop or isolate if `DATABASE_URL` points anywhere other than an explicit throwaway/approved WTC DB.

2. Run local non-live gates:
   - `npm run governance:check`
   - `npm run check:core`
   - `npm run typecheck`
   - `npm run typecheck -w @wtc/web`
   - `npm run lint`
   - `npm run secret:scan`
   - focused bot suite from this handoff
   - `npm test`
   - `npm run worker:smoke` only with `DATABASE_URL` absent for memory mode.

3. Run artifact-producing local acceptance when allowed:
   - `npm run build -w @wtc/web`
   - `npm run e2e`
   - Check specifically that Legacy settings/statistics render, start/stop buttons remain disabled, and no browser console
     errors appear on `/app/bots/legacy/settings`, `/app/bots/legacy`, `/app/bots/statistics?bot=legacy`, and `/admin/bots`.

4. If DB-backed worker proof is required, use only an explicit throwaway/approved DB:
   - Force `BOT_ADAPTER_MODE=mock` unless the lane is specifically read-only canary.
   - Force `FEATURE_LIVE_BOT_CONTROL=false` and `FEATURE_TV_AUTOMATION=false`.
   - For Legacy live-read, require column-restricted role proof that selected safe columns work and `api_key`/`secret_key`
     reads fail, with no provider values printed.

5. To prove "does not stop bots" on a canary/deploy lane, collect before/after read-only status evidence:
   - Before: live bot services/processes active, worker/canary status, server-local bot ports still open where expected,
     external bot ports still closed where expected.
   - Deploy/smoke only WTC canary components in scope; do not run bot start/stop/apply-config.
   - After: repeat the same read-only status probes and browser checks; acceptance requires no bot-service state regression.
