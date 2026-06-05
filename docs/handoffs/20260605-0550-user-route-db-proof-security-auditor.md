# ecosystem-security-auditor handoff
## Scope
Read-only security/readiness audit for a future user-route managed DB Playwright proof for Tortila Mark/uPnL unavailability. Focus: how the new proof should avoid secrets, raw provider payloads, production DBs, `/api/marks`, exchange probes, live bot controls, and auth-bypass leaks while proving `/app/bots/tortila`, `/app/bots/tortila/positions`, and `/app/bots/statistics?bot=tortila` render `N/A` safely from a throwaway DB fixture.

No live servers, env values, secrets, `/api/marks`, exchanges, provider probes, or bot controls were touched.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0535-phase-4-53-tortila-mark-unavailable-user-admin.md`
- `package.json`
- `scripts/gates.mjs`
- `scripts/redacted-child-process.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `playwright.config.ts`
- `playwright.admin-user-bots-db.config.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/bot-admin-acceptance-runner.test.ts`
- `tests/integration/child-output-redaction.test.ts`
- `apps/web/src/app/api/e2e/login/route.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`

## Files changed
None - read-only audit

## Findings
1. Severity P1 - The new user-route DB proof must be its own opt-in managed runner, not part of `e2e`, `ci:local`, or local bot/admin gates. Evidence: `package.json:36-38` registers only the selected-user admin DB runner today; `playwright.config.ts:9` excludes the admin DB spec from default Playwright; `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:26-33` asserts DB harnesses stay opt-in and out of default gates. Recommendation: add a separate `e2e:user-bots:db` plus `e2e:user-bots:db:managed`/`:matrix` pattern, and add static coverage that default `e2e`, `ci:local`, and `scripts/gates.mjs` do not invoke it. Target part: new user-route managed DB runner registration.
2. Severity P1 - The new managed runner must refuse production/non-throwaway DBs before any child process starts and must not echo DSNs. Evidence: `scripts/run-admin-user-bot-detail-e2e-managed.mjs:29-49` validates postgres protocol and rejects missing or throwaway maintenance DBs; `scripts/run-admin-user-bot-detail-e2e-managed.mjs:101-119` creates and drops a fresh `wtc_test_admin_user_bots_*` DB; `scripts/prepare-admin-user-bot-detail-e2e.ts:36-49` accepts only `wtc_test`/`wtc_test_*`; `scripts/prepare-admin-user-bot-detail-e2e.ts:168-177` refuses non-empty DBs. Recommendation: copy this guard shape for the user-route fixture with a distinct env name such as `USER_BOTS_E2E_ADMIN_DATABASE_URL`, create/drop only `wtc_test_user_bots_*`, reject non-empty DBs, and redact all URL-bearing errors. Target part: managed DB lifecycle and preflight.
3. Severity P1 - The new runner must scrub inherited DB/provider/live env and force local no-live flags. Evidence: local gates refuse managed DB env and scrub DB/provider/journal env at `scripts/gates.mjs:67-105`; they then force development/mock/no-live flags at `scripts/gates.mjs:107-117`; the admin DB runner starts its child with `APP_ENV: 'development'`, `BOT_ADAPTER_MODE: 'mock'`, and `FEATURE_LIVE_BOT_CONTROL: 'false'` at `scripts/run-admin-user-bot-detail-e2e.mjs:25-36`; the Playwright server repeats those flags at `playwright.admin-user-bots-db.config.ts:61-71`. Recommendation: make the user-route runner delete unrelated admin/auth/LMS/real-PG/Legacy/Tortila journal env, set `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`, and avoid `BOT_ADAPTER_MODE=read-only` unless the fixture is DB-only and no network adapter can be constructed. Target part: child env isolation.
4. Severity P1 - The proof must use DB snapshots and user ownership/entitlements, not global adapter fallback or production-only test hooks. Evidence: `apps/web/src/features/bots/data.tsx:733-749` requires user-owned DB snapshots in non-mock/user-scoped modes and refuses global fallback; `scripts/prepare-admin-user-bot-detail-e2e.ts:186-203` seeds demo catalog/users and grants products; `apps/web/src/features/bots/data.tsx:480-502` scopes snapshot queries to a bot instance and, for Legacy, provider mapping. Recommendation: seed a normal user with `tortila_bot` entitlement, a user-owned Tortila bot instance, hostile Tortila metric/position/trade snapshots, and no admin-only selected-user route dependency. Target part: user DB fixture and read-model acceptance.
5. Severity P1 - The fixture should deliberately seed hostile Mark/uPnL and secret/raw markers, then assert only safe rendered text. Evidence: existing admin fixture seeds exchange secret markers at `scripts/prepare-admin-user-bot-detail-e2e.ts:238-247`, hostile scoped/unscoped raw source-proof payloads at `scripts/prepare-admin-user-bot-detail-e2e.ts:360-384`, and the admin DB spec forbids those markers in rendered text at `tests/e2e/admin-user-bot-detail-db.spec.ts:158-211` and `tests/e2e/admin-user-bot-detail-db.spec.ts:273-289`. Recommendation: seed Tortila position rows with nonzero hostile `markPrice`/`unrealizedPnlUsd`, raw provider/API-key markers, sealed exchange markers, and cross-user rows; assert body text and screenshots contain no raw markers, no base64 marker encodings, no `apiKey`/`apiSecret`/`sealed`/`token=`, and no cross-user symbols. Target part: fixture data and Playwright leak assertions.
6. Severity P1 - The acceptance target is exact user-route rendered behavior: `N/A`, neutral styling, no `/api/marks`, no live controls. Evidence: Phase 4.53 UI renders the user dashboard Mark/uPnL as `N/A` and removes up/down classes when `markUnavailable` is true at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:239-244` and `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:285-290`; the positions route does the same at `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:38-43` and `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:60-65`; statistics does the same at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:195-205`; `docs/NEXT_ACTIONS.md:113-116` names the required user-route proof. Recommendation: user Playwright should visit all three routes, locate the hostile Tortila position row, require `Mark` and `uPnL` cells to be `N/A`, require no `wtc-up`/`wtc-down` on unavailable cells, require no `/api/marks` request via request interception, and require no start/stop/apply/test-connection controls. Target part: user-route Playwright spec.
7. Severity P1 - `/api/e2e/login` is acceptable only inside the local guarded harness and must not become a general auth bypass. Evidence: the helper posts to `/api/e2e/login` at `tests/e2e/helpers/auth.ts:5-12`; the route returns 404 unless not production, `E2E_AUTH_BYPASS === '1'`, and host is localhost/127/::1 at `apps/web/src/app/api/e2e/login/route.ts:5-10`; the auth DB harness separately proves real forms without the bypass at `tests/integration/auth-db-e2e-harness.test.ts:61-70`. Recommendation: if the user-route DB proof uses `loginUser`, keep `E2E_AUTH_BYPASS=1` only in the dedicated local Playwright webServer env, keep localhost-only checks, and add a static test that the user-route config cannot run without marker/HMAC and does not expose bypass on production hosts. Target part: Playwright auth helper and config.
8. Severity P2 - Retained stdout/stderr and artifacts need an explicit redaction/scanner lane before screenshots are trusted. Evidence: child output redacts DB URLs, secrets, auth headers, cookies, JWTs, Stripe keys, and private keys at `scripts/redacted-child-process.mjs:6-24` and applies replacements at `scripts/redacted-child-process.mjs:44-62`; child execution captures/redacts stdout/stderr at `scripts/redacted-child-process.mjs:65-82`; `tests/integration/child-output-redaction.test.ts:47-73` pins the leak corpus. Recommendation: wire the user-route runner through `runRedactedChildProcess`, discard or redact pass logs, scan `test-results`, `playwright-report`, and `tests/e2e/screenshots` for fixture markers before retaining. Target part: runner output and artifact retention.
9. Severity P2 - `scripts/gates.mjs` currently scrubs admin DB env but not any future user-route DB env because no such env exists yet. Evidence: scrub/refuse lists include `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` and `ADMIN_USER_BOTS_E2E_DATABASE_URL` at `scripts/gates.mjs:67-85`, but the repo has no user-route DB env or script per `package.json:36-38` and search results only find admin-user DB runner names. Recommendation: when introducing `USER_BOTS_E2E_*`, add it to local refused/scrubbed env lists and to static runner tests so local mock/no-live gates cannot accidentally consume managed DB state. Target part: gates boundary.

## Decisions
1. Treat the user-route managed DB proof as NOT READY TO RUN until a dedicated throwaway DB runner, fixture prep, Playwright config, and static harness tests exist.
2. Reuse the selected-user admin DB harness security pattern, but do not reuse admin-only route semantics; the new proof must authenticate as the normal seeded user and verify current-user routes.
3. Do not use `/api/marks`, exchange pings, provider probes, real journal env, or live bot control to force the branch.
4. Keep auth bypass local-only and marker/HMAC-bound; do not add production-only or global test hooks.

## Risks
1. Without adding the new env names to `scripts/gates.mjs`, a future local bot/admin acceptance run could inherit user-route DB env accidentally.
2. If the fixture uses `BOT_ADAPTER_MODE=read-only` without ensuring DB-only reads, it may create unintended adapter/network construction risk.
3. If screenshots or traces are retained before marker scans, seeded secret/raw markers could leak through Playwright artifacts even if stdout is redacted.
4. If the proof only checks text and not network requests, a hidden `/api/marks` call could escape detection.

## Verification/tests
RUN:
1. Read-only file inspection only.
2. `git status --short --branch` - observed a pre-existing dirty tree; no cleanup or revert performed.

Required static/preflight tests for the new runner:
1. A new integration/static harness test, e.g. `tests/integration/user-bot-route-db-e2e-harness.test.ts`, must assert package scripts are opt-in, default `e2e`/`ci:local`/`scripts/gates.mjs` do not invoke the user DB runner, and `playwright.config.ts` excludes the new DB spec.
2. Static test must require `assertThrowawayDbName`, `information_schema.tables` emptiness refusal, marker file creation, prep-token HMAC over the DB URL, and Playwright config refusal when marker/HMAC/env do not match.
3. Static test must require fixture seeding of a normal user, `tortila_bot` entitlement, user-owned Tortila bot instance, hostile Mark/uPnL values, cross-user markers, sealed secret markers, raw provider/API-key markers, and no live-control/provider-probe imports.
4. Static test must require runner env scrub/refusal coverage for `USER_BOTS_E2E_ADMIN_DATABASE_URL`, `USER_BOTS_E2E_DATABASE_URL`, prep token/HMAC env, `DATABASE_URL`, real-PG/admin DB envs, Legacy DB/API env, Tortila journal env, live-control flags, and exchange/provider env.
5. Static test must require redacted child process usage and assert no DSN, password, cookie, auth header, JWT, HMAC, API key, or private-key material is printed.
6. Playwright preflight must intercept requests and fail on any URL containing `/api/marks`, exchange/provider probe endpoints, live-control/start/stop/apply/test-connection routes, or non-local hosts.
7. Playwright spec must assert `/app/bots/tortila`, `/app/bots/tortila/positions`, and `/app/bots/statistics?bot=tortila` render hostile Mark/uPnL as `N/A`, do not apply `wtc-up`/`wtc-down` to unavailable cells, render no raw/secret/cross-user markers, and expose no forms or live-control buttons.

NOT RUN:
1. User-route managed DB Playwright proof - no dedicated runner/fixture/config exists yet.
2. `npm run e2e:admin-user-bots:db:managed:matrix` - not part of this read-only user-route audit and still requires `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`.
3. `npm run accept:worker:continuity:managed` - not part of this audit and requires `WORKER_CONTINUITY_ADMIN_DATABASE_URL`.
4. Real Tortila journal read-only fetches - blocked by absent journal env/auth/firewall proof.
5. Tortila `/api/marks` - not run; must remain excluded.
6. Exchange pings/provider probes - not run.
7. Live bot start/stop/apply-config - not run; still blocked by safety protocol.
8. `db:migrate`/`db:seed` against real or production Postgres - not run.
9. Production deploy, canary switch, GitHub CI, monitoring, and burn-in - not run.

## Next actions
1. Implement the dedicated user-route managed DB runner only in a separate implementation phase.
2. Add the static/preflight harness before running Playwright.
3. Run the new managed user-route proof only with a fresh throwaway DB and reviewed/redacted artifacts.
4. Keep `/api/marks`, exchange probes, provider probes, and live bot controls out of scope.
