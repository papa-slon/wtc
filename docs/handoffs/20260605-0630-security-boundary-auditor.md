# ecosystem-security-auditor handoff

## Scope
Read-only Phase 4.55 security boundary audit after Phase 4.54. Scope was to define what the next phase may run locally without secrets, DB, live bot, exchange, provider, or API risk; what must remain blocked; and what artifact scans are mandatory if managed DB env later appears.

No tests, servers, DB clients, live services, exchange calls, provider probes, `/api/marks` calls, deploys, or API calls were run. The only permitted write is this handoff.

## Files inspected
- `docs/handoffs/20260605-0610-phase-4-54-user-route-db-proof-lane.md`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `package.json`
- `scripts/redacted-child-process.mjs`
- `scripts/gates.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-worker-continuity-managed.mjs`
- `scripts/safe-worker-tick.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `scripts/check-retained-visual-artifacts.mjs`
- `playwright.admin-user-bots-db.config.ts`
- `playwright.config.ts`
- `tests/e2e/user-bot-routes-db.spec.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/child-output-redaction.test.ts`

## Files changed
- `docs/handoffs/20260605-0630-phase-4-55-security-boundary-auditor.md`

## Findings
1. Severity: High. The Phase 4.54 managed DB browser proof is still blocked by absent env, not by local code readiness. Evidence: `docs/handoffs/20260605-0610-phase-4-54-user-route-db-proof-lane.md:73` lists `npm run e2e:admin-user-bots:db:managed:user-routes` as NOT RUN, and lines 74-76 block the admin DB matrix and worker continuity managed run on missing `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` / `WORKER_CONTINUITY_ADMIN_DATABASE_URL`. Recommendation: target next phase gate selection; do not claim managed DB proof until the specific managed command runs with a throwaway admin URL and passes.
2. Severity: High. Local bot/admin acceptance can be run only as mock/no-live proof and only with managed/source env absent. Evidence: `scripts/gates.mjs:63-78` defines local bot/admin modes and refused managed DB env names; `scripts/gates.mjs:80-124` scrubs DB/source env and forces `APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`, and `LEGACY_LIVE_READS_ENABLED=false`. Recommendation: target local validation; safe local runs are acceptable only after an env-presence audit shows managed/source/live env unset.
3. Severity: Medium. The normal Playwright suite does not clear the Phase 4.54 managed proof. Evidence: `playwright.config.ts:9` excludes both `admin-user-bot-detail-db.spec.ts` and `user-bot-routes-db.spec.ts`; `package.json:36-40` exposes the dedicated DB and managed DB scripts. Recommendation: target reporting; do not cite `npm run e2e`, `npm run accept:bots:rendered`, or `npm run accept:bots:local` as evidence for managed user-route DB proof.
4. Severity: High. The admin user-bot managed runner is a DB-mutating create/drop harness and must use an isolated maintenance DB URL, never a production or app DB URL. Evidence: `scripts/run-admin-user-bot-detail-e2e-managed.mjs:23-28` documents creation of a fresh `wtc_test_admin_user_bots_*` DB and warns not to archive secrets/artifacts; `scripts/run-admin-user-bot-detail-e2e-managed.mjs:33-52` validates a Postgres admin URL pointing at a non-throwaway maintenance DB; `scripts/run-admin-user-bot-detail-e2e-managed.mjs:113-124` creates and drops the throwaway DB. Recommendation: target managed admin browser proof; prefer the managed wrapper, and require an operator-provided isolated admin URL with CREATE/DROP only for disposable test DBs.
5. Severity: High. The Phase 4.54 user-route fixture intentionally seeds hostile and secret-shaped values, so managed artifacts are security-sensitive by design. Evidence: `scripts/prepare-admin-user-bot-detail-e2e.ts:483-550` seeds `USER_ROUTE_*` raw markers plus hostile `markPrice=99999.99000000` and `unrealizedPnlUsd=8888.8800`; `tests/e2e/user-bot-routes-db.spec.ts:18-39` rejects those markers, secret-shaped strings, and hostile values from visible text; `tests/e2e/user-bot-routes-db.spec.ts:123-124` also rejects `/api/marks` requests and captures screenshots. Recommendation: target artifact retention; after any managed run, scan redacted stdout/stderr, `test-results`, `playwright-report`, and `tests/e2e/screenshots` before retaining anything.
6. Severity: Medium. Child stdout/stderr redaction is necessary but not enough for retained artifacts. Evidence: `scripts/redacted-child-process.mjs:44-62` redacts DB URLs, secret assignments, raw public IP URLs, auth headers, cookies, JWTs, Stripe secrets, and private keys; `scripts/run-admin-user-bot-detail-e2e.mjs:102-103` says to archive only redacted stdout and reviewed/scanner-clean artifacts; `scripts/check-retained-visual-artifacts.mjs:299-327` fails on blocked binary/container artifacts and requires a review manifest when images exist. Recommendation: target post-run cleanup; do not archive Playwright traces, screenshots, reports, or logs until a no-leak scan and visual review manifest have passed.
7. Severity: High. The worker continuity managed lane is also DB-mutating, but remains fixture-only and non-live if run as designed. Evidence: `scripts/run-worker-continuity-managed.mjs:23-29` states it creates `wtc_test_worker_continuity_*`, uses fixture-only Legacy rows, and does not touch live bots/exchanges/providers; `scripts/run-worker-continuity-managed.mjs:274-290` calls `safe-worker-tick` with `LEGACY_DATABASE_URL` set to the throwaway DB and Tortila journal env blank; `scripts/safe-worker-tick.mjs:107-112` forces `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`. Recommendation: target managed worker proof; run only with isolated `WORKER_CONTINUITY_ADMIN_DATABASE_URL`, then scan logs before retention.
8. Severity: High. Live source and live control remain blocked. Evidence: `docs/handoffs/20260605-0610-phase-4-54-user-route-db-proof-lane.md:13-16` keeps real Tortila journal proof, `/api/marks`, exchange/provider probes, live bot control, deploy, and CI out of scope; `docs/NEXT_ACTIONS.md:118-128` keeps live exchange ping and live start/stop/apply-config disabled until audits approve adapters and defines real Tortila journal reads as a separate env/auth/firewall gate; `docs/STATUS.md:234-238` lists managed worker, admin DB matrix, real Tortila journal, live exchange/provider probes, live control, deploy/monitoring, and CI as NOT GREEN / NOT RUN. Recommendation: target scope control; do not convert a local proof phase into live integration or deploy work.
9. Severity: Medium. There is no dedicated admin-user-bot artifact scanner equivalent to the LMS DB artifact scanner. Evidence: `scripts/check-retained-visual-artifacts.mjs:11` defaults to `tests/e2e/screenshots`; `scripts/check-retained-visual-artifacts.mjs:262-327` can scan explicit workspace artifact roots and enforce visual manifests, but it is not wired automatically into the admin-user-bot managed runner; `docs/NEXT_ACTIONS.md:90` separately instructs scanning stdout/stderr plus `test-results`, `playwright-report`, and `tests/e2e/screenshots`. Recommendation: target next phase artifact hygiene; either add a dedicated admin DB artifact scanner before retention, or perform an explicit documented manual scan before keeping managed artifacts.

## Decisions
1. Current Phase 4.55 auditor verdict: with env gates NOT_SET, no managed DB, worker continuity managed, real journal, live provider, exchange, `/api/marks`, deploy, or CI gate should run.
2. Safe local recommendations are limited to mock/no-live, no-managed-env checks and must not be reported as managed DB/source/live proof.
3. If managed DB env appears, `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` and `WORKER_CONTINUITY_ADMIN_DATABASE_URL` must be treated as privileged create/drop credentials. They may be used only against isolated maintenance DBs, never raw production or app databases.
4. Artifact scanning is a required acceptance gate for any managed admin DB browser run because hostile markers and screenshots are intentional parts of the proof.

## Risks
1. A maintenance DB URL can be syntactically valid and still point at the wrong cluster. The runner refuses throwaway admin DB names, but it cannot know whether the host is production. Operator confirmation of an isolated test cluster is required.
2. `npm run accept:bots:rendered` and `npm run accept:bots:local` are no-live local gates, but they start local browser/server work and create artifacts. They are not appropriate for a read-only audit session.
3. Playwright traces/reports may contain URLs, cookies, rendered hostile markers, or screenshots. They must be deleted or scanner-clean before handoff retention.
4. Redaction regexes reduce stdout/stderr risk but cannot prove every generated artifact is clean. Never archive raw env dumps or full DB URLs.
5. Repeating local UI/static phases without clearing a named env/source/deploy blocker risks violating the anti-loop rule in `docs/NEXT_ACTIONS.md:98-100`.

## Verification/tests
RUN this session:
1. Read-only inspection of the files listed above.
2. Env presence audit printed only `SET` / `NOT_SET` for the relevant env names, never values. Observed NOT_SET for `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, `WORKER_CONTINUITY_ADMIN_DATABASE_URL`, `ADMIN_USER_BOTS_E2E_DATABASE_URL`, `DATABASE_URL`, `REAL_POSTGRES_DATABASE_URL`, `TORTILA_JOURNAL_URL`, `TORTILA_JOURNAL_BASE_URL`, `JOURNAL_READ_TOKEN`, `LEGACY_DATABASE_URL`, `LEGACY_LIVE_READS_ENABLED`, `FEATURE_LIVE_BOT_CONTROL`, and `FEATURE_TV_AUTOMATION`.

NOT RUN this session:
1. No tests: no Vitest, Playwright, typecheck, lint, secret scan, governance check, `git diff --check`, or runner help commands were executed.
2. No servers: no Next dev server, Playwright web server, worker loop, or preview server was started.
3. No DB: no Postgres connection, migration, seed, create/drop, PGlite harness, managed runner, or real DB query was executed.
4. No live/external calls: no exchange, provider, Tortila journal, Legacy source, `/api/marks`, deployment, CI, production monitoring, or API call was executed.

## Next actions
RUN recommendations with current env NOT_SET:
1. Pure local/no-secret/no-DB checks may be run in the next appropriate validation phase: `npm run secret:scan`, `npm run governance:check`, `git diff --check`, `node scripts/gates.mjs quick`, and `node scripts/gates.mjs core`.
2. Local no-live bot/admin acceptance may be run only after confirming managed/source/live env is unset: `npm run accept:bots:continuity:contract`, `npm run accept:bots:rendered`, or `npm run accept:bots:local`. These are local proof only; they do not clear managed DB or live source gates.
3. Memory/no-DB worker smoke may be run through the local continuity gate only with `DATABASE_URL` unset; with DB env present, treat worker proof as a managed DB phase instead.

RUN recommendations if managed DB env later appears:
1. With isolated `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, run `npm run e2e:admin-user-bots:db:managed:user-routes` first to clear Phase 4.54 current-user Tortila route proof.
2. With the same isolated admin DB URL, run `npm run e2e:admin-user-bots:db:managed:matrix` only as a separate acceptance lane; do not combine matrix and user-routes.
3. With isolated `WORKER_CONTINUITY_ADMIN_DATABASE_URL`, run `npm run accept:worker:continuity:managed` and require the tuple `worker_status=ok`, `bot_continuity=ok`, `tortila=ok`, `legacy=ok`.
4. After every managed browser run, scan redacted stdout/stderr, `test-results`, `playwright-report`, and `tests/e2e/screenshots` for `USER_ROUTE_`, `SHOULD_NOT_RENDER`, `MUST_NOT_LEAK`, `99999`, `8888`, `apiKey`, `apiSecret`, `passwordHash`, `token=`, `Authorization`, `Cookie`, `postgres://`, `DATABASE_URL`, `SESSION_SECRET`, `SECRET_VAULT_KEK`, `JOURNAL_READ_TOKEN`, and raw public IP URLs before retaining artifacts.
5. Run `node scripts/check-retained-visual-artifacts.mjs --inventory tests/e2e/screenshots test-results playwright-report` after managed browser runs, then either delete unreviewed artifacts or produce a visual review manifest before retention. Treat trace/container artifacts as blocked unless a separate review process explicitly clears them.

NOT RUN recommendations:
1. Do not run `npm run e2e:admin-user-bots:db:managed:user-routes`, `npm run e2e:admin-user-bots:db:managed:matrix`, or `npm run accept:worker:continuity:managed` while their admin DB env vars are NOT_SET.
2. Do not run direct `npm run e2e:admin-user-bots:db:user-routes` unless `ADMIN_USER_BOTS_E2E_DATABASE_URL` already points to a fresh `wtc_test*` throwaway database and the operator owns cleanup. Prefer the managed wrapper.
3. Do not use production, preview, or live app DB URLs for any managed create/drop runner.
4. Do not run `/api/marks`, live exchange ping, provider probes, real Tortila journal reads, live bot start/stop/apply-config, or Legacy closed-trade import in this next safety-boundary phase.
5. Do not archive full URLs, passwords, cookies, raw env dumps, Playwright traces, screenshots, reports, or logs until artifact scans and visual review are complete.
6. Do not fold deploy, GitHub CI, production monitoring, or burn-in into the env/source acceptance phase.
