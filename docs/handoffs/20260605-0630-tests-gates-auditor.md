# ecosystem-tests-runner handoff
## Scope
Read-only Phase 4.55 tests/gates audit. Scope was to inspect current package scripts, `docs/NEXT_ACTIONS.md`, `docs/STATUS.md`, the latest Phase 4.54 aggregate, and the relevant runner/gate scripts, then recommend the smallest non-looping verification plan for the next operator.

Rules followed:
- No code edits.
- No tests run.
- No dev server, preview server, Playwright server, DB runner, env probe, provider probe, exchange probe, deploy, CI, or live bot control run.
- One file changed: this handoff.

## Files inspected
- `package.json`
- `apps/web/package.json`
- `apps/worker/package.json`
- `packages/*/package.json` script surface
- `scripts/gates.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/run-worker-continuity-managed.mjs`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260605-0610-phase-4-54-user-route-db-proof-lane.md`
- `docs/handoffs/20260605-0610-loop-regression-auditor.md`
- `git status --short` output, names only, to confirm the tree is broad/dirty before writing this file

## Files changed
- `docs/handoffs/20260605-0630-phase-4-55-tests-gates-auditor.md`

## Findings
1. Severity P1 - Phase 4.54 is locally implemented but its real browser DB proof is still env-blocked, not implementation-blocked. Evidence: `docs/STATUS.md:14-26` says the opt-in current-user Tortila lane exists and local static/type/security proof passed, while the actual managed DB browser run remains NOT RUN because `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is absent; the Phase 4.54 aggregate repeats the same blocker and exact command at `docs/handoffs/20260605-0610-phase-4-54-user-route-db-proof-lane.md:47-49` and `:73-76`. Recommendation: Phase 4.55 must not add more UI/static polish to claim this gate; either run the managed env gate when the env is supplied or stop honestly blocked. Target part: user-route DB browser proof.
2. Severity P1 - The package scripts already expose the correct user-route managed command, so a new DB lifecycle would be loop risk. Evidence: root scripts define `e2e:admin-user-bots:db:managed:user-routes` at `package.json:40`; the managed runner documents `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` usage and fresh `wtc_test_admin_user_bots_*` create/drop behavior at `scripts/run-admin-user-bot-detail-e2e-managed.mjs:18-27`; it also refuses `--matrix` plus `--user-routes` as one combined lane at `scripts/run-admin-user-bot-detail-e2e-managed.mjs:144-145`. Recommendation: use the existing managed runner and keep user-routes and matrix as separate acceptance lanes. Target part: managed admin-user-bots DB gates.
3. Severity P1 - The smallest useful local regression pack now is focused/no-server/static plus type/security/governance/diff, not the full local browser runner. Evidence: Phase 4.54 already proved the focused static/type/security set at `docs/handoffs/20260605-0610-phase-4-54-user-route-db-proof-lane.md:58-71`; root scripts expose focused typecheck, secret scan, governance, and test commands at `package.json:13-17` and `package.json:54-55`. Recommendation: run the focused command pack listed in `Next actions` once; if green and env remains NOT_SET, stop instead of creating a new local-only slice. Target part: no-env local regression.
4. Severity P1 - Managed worker continuity is a separate env gate and should not be substituted with local worker smoke. Evidence: `docs/NEXT_ACTIONS.md:102-108` requires `WORKER_CONTINUITY_ADMIN_DATABASE_URL` and the tuple `worker_status=ok`, `bot_continuity=ok`, `tortila=ok`, `legacy=ok`; the managed runner hardcodes that expected tuple at `scripts/run-worker-continuity-managed.mjs:13-17` and documents fresh throwaway DB create/drop at `scripts/run-worker-continuity-managed.mjs:23-27`. Recommendation: keep `npm run accept:worker:continuity:managed` NOT RUN until a suitable admin maintenance Postgres URL is supplied. Target part: managed worker continuity.
5. Severity P1 - The anti-loop rule is now the controlling gate policy. Evidence: `docs/NEXT_ACTIONS.md:98-100` says not to add another local Legacy source-proof UI/static-test/dashboard slice and to stop if phases do not remove, pass, or reclassify a named NOT RUN blocker; the Phase 4.54 loop auditor says real blockers are env/source/safety/deploy blockers, not more local UI polishing, at `docs/handoffs/20260605-0610-loop-regression-auditor.md:23` and says to stop local bot polishing after Phase 4.54 at `docs/handoffs/20260605-0610-loop-regression-auditor.md:53`. Recommendation: Phase 4.55 should be a verification/blocked-classification phase unless a real env/source/deploy blocker can be consumed. Target part: phase control.
6. Severity P2 - Broad local browser gates are useful only for publishing or rendered UI regression, not for clearing the current managed/env blockers. Evidence: `scripts/gates.mjs:18-20` defines `bot-admin-e2e`, `bot-admin-local`, and `bot-continuity-local`; `scripts/gates.mjs:163-175` keeps e2e separate and shows `bot-admin-local` includes `ci:local`, worker smoke, continuity fixture, rendered Playwright, and visual inventory. Recommendation: do not run `npm run accept:bots:local` or `npm run accept:bots:rendered` as the default Phase 4.55 answer; reserve them for exact-tree publish proof or a fresh rendered UI change. Target part: local website acceptance.

## Decisions
1. Recommend a no-code Phase 4.55 verification plan unless `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` or `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is supplied.
2. Recommend one focused local regression pass only, then stop if env gates remain NOT_SET.
3. Treat `npm run e2e:admin-user-bots:db:managed:user-routes` as the first managed/env gate to clear when the admin DB env arrives, because it is the Phase 4.54 blocker.
4. Treat `npm run e2e:admin-user-bots:db:managed:matrix` and `npm run accept:worker:continuity:managed` as separate managed lanes, not substitutes for user-route proof.
5. Do not accept local mock/demo rendered screenshots, `accept:bots:local`, or worker smoke as proof of managed DB browser readiness, real Tortila journal readiness, Legacy source readiness, live-control readiness, deploy readiness, or CI readiness.

## Risks
1. The tree is very broad/dirty; even the focused local pack can fail on unrelated in-progress changes. If it fails, fix only the failing gate's direct cause and do not widen into a new feature slice.
2. Running broad local browser gates by habit can create false confidence because they scrub/refuse managed DB and source env by design.
3. Managed DB runs deliberately seed hostile markers; stdout/stderr and artifacts must be scanned before retention.
4. `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md` is older than Phase 4.54, so use it only as standing credential-blocker background. Re-check env presence in the execution shell by names only before a real managed run, never by printing values.

## Verification/tests
RUN by this auditor:
1. Read-only inspection of scripts, docs, handoffs, and gate runners.
2. `git status --short` names-only inspection.

NOT RUN by this auditor:
1. `npx vitest run ...` - not run by scope.
2. `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run typecheck -w @wtc/worker` - not run by scope.
3. `npm run secret:scan`, `npm run governance:check`, `git diff --check` - not run by scope.
4. `npm run accept:bots:continuity:contract`, `npm run accept:bots:rendered`, `npm run accept:bots:local`, `npm run ci:local`, `npm run e2e`, `npm run preview:safe` - not run by scope; rendered/browser/preview runners can start local servers.
5. `npm run e2e:admin-user-bots:db:managed:user-routes`, `npm run e2e:admin-user-bots:db:managed:matrix`, `npm run accept:worker:continuity:managed` - not run because managed env is not supplied in the task context.
6. DB/env/live/provider/exchange/deploy/CI controls - not run.

Recommended local no-env regression pack now:

```powershell
npx vitest run tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/two-bot-continuity-contract-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts
npm run typecheck -w @wtc/web
npm run typecheck
npm run typecheck -w @wtc/worker
npm run secret:scan
npm run governance:check
git diff --check
```

Optional local no-env bot continuity freshness, only if the operator wants one compact bot-specific smoke without DB or browser:

```powershell
npm run accept:bots:continuity:contract
```

Local but not the smallest default:

```powershell
npm run accept:bots:rendered
npm run accept:bots:local
npm run ci:local
npm run e2e
```

Use these only for a rendered UI regression, full local release proof, or exact-tree publish/canary proof. They do not clear the managed/env blockers.

## Next actions
1. Run the recommended local no-env regression pack above once. If green and `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` plus `WORKER_CONTINUITY_ADMIN_DATABASE_URL` are still NOT_SET, write the Phase 4.55 aggregate as blocked-on-env and stop.
2. When `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is supplied for an approved non-throwaway maintenance Postgres database, run the Phase 4.54 blocker-clearing lane:

```powershell
$env:ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL = "postgres://<user>:<password>@<host>:<port>/<maintenance_db>"
npm run e2e:admin-user-bots:db:managed:user-routes
```

Then scan redacted stdout/stderr plus `test-results`, `playwright-report`, and `tests/e2e/screenshots` for hostile/raw/source/secret markers before retaining artifacts.

3. With the same approved admin DB env, run the selected-user admin matrix as a separate lane, not combined with user-routes:

```powershell
$env:ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL = "postgres://<user>:<password>@<host>:<port>/<maintenance_db>"
npm run e2e:admin-user-bots:db:managed:matrix
```

4. When `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is supplied for an approved non-throwaway maintenance Postgres database, run the managed worker continuity gate:

```powershell
$env:WORKER_CONTINUITY_ADMIN_DATABASE_URL = "postgres://<user>:<password>@<host>:<port>/<maintenance_db>"
npm run accept:worker:continuity:managed
```

Expected tuple: `worker_status=ok`, `bot_continuity=ok`, `tortila=ok`, `legacy=ok`.

5. Keep these existing managed/env/live commands NOT RUN in Phase 4.55 unless their exact env, source artifact, and operator approval are supplied:

```powershell
npm run e2e:admin-user-bots:db
npm run e2e:admin-user-bots:db:user-routes
npm run accept:worker:continuity
npm run accept:real-pg:managed
npm run accept:audit:append-only-role
npm run accept:audit:append-only-role:managed
npm run accept:billing:stripe-webhook
npm run accept:billing:stripe-checkout
npm run accept:axioma:handoff-preflight
npm run accept:lms:object-storage -- --live
npm run accept:lms:external-scanner -- --live
```

6. Do not run or invent any live Tortila journal, Legacy closed-trade import, `/api/marks`, exchange ping, provider probe, live bot start/stop/apply-config, deploy, or GitHub CI command in this phase. Those remain separate source/safety/deploy phases.
