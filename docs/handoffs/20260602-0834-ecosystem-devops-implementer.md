# ecosystem-devops-implementer handoff
## Scope
Phase 3.42 read-only devops audit for auth rate limiting. Scope covered `.env.example`, `docs/DEPLOYMENT.md`, security/runbook docs, middleware/runtime config, preview and production implications, and no-live-mutation boundaries. No product code, existing docs, env files, preview server, production server, nginx, systemd, database, bot service, Stripe, Axioma, LMS object store, or scanner was mutated.

## Files inspected
- `.env.example`
- `package.json`
- `docker-compose.yml`
- `scripts/safe-preview.mjs`
- `docs/DEPLOYMENT.md`
- `docs/SECURITY_MODEL.md`
- `docs/PRODUCTION_BLOCKERS.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/STATUS.md`
- `docs/ARCHITECTURE_DECISIONS.md`
- `apps/web/src/middleware.ts`
- `apps/web/src/lib/server-config.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `packages/auth/src/rate-limit.ts`
- `packages/auth/src/rate-limit.test.ts`
- `packages/auth/src/__smoke__.ts`
- `packages/auth/package.json`
- `packages/config/src/env.ts`
- `packages/shared/src/env-guards.ts`
- `tests/e2e/security-headers.spec.ts`
- `tests/integration/csrf-coverage.test.ts`
- `tsconfig.base.json`

## Files changed
None - read-only audit. Handoff written: `docs/handoffs/20260602-0834-ecosystem-devops-implementer.md`.

## Findings
1. Severity: High. The production/shared auth throttling layer is documented but not runbook-validated. Evidence: `apps/web/src/middleware.ts:28-29` says the in-process Map is per Edge instance and multi-instance deployments rely on nginx `limit_req` and/or a future shared store; `docs/SECURITY_MODEL.md:138-147` defines production nginx `limit_req` at 10 requests/minute with burst 5; `docs/DEPLOYMENT.md:398-401` says the raw-IP preview is behind nginx but still not production; `docs/DEPLOYMENT.md:417-418` says production deployment and production nginx/domain/TLS cutover are NOT RUN. Recommendation: add a future docs/devops lane that records an explicit auth `limit_req` nginx template or checklist, validates `X-Forwarded-For`/`X-Real-IP` forwarding, and lists preview/prod nginx auth-rate-limit verification as RUN or NOT RUN separately from the app middleware. Target part: production/preview reverse-proxy runbook.

2. Severity: Medium. Auth rate limiting has safe fixed defaults but no typed env knobs or deployment-facing knobs. Evidence: `apps/web/src/middleware.ts:39-40` hardcodes `60_000` ms and `max: 10` for `/login` and `/register`; `.env.example:53-63` documents sessions/CSRF and safe feature defaults but no auth-rate settings; `packages/config/src/env.ts:19-37` defines core envs and feature flags without auth throttle fields; `packages/config/src/env.ts:82-100` contains production validation for billing, Axioma, and bot adapter secrets but no auth throttle validation. Recommendation: either document the hardcoded 10/min policy as intentionally non-configurable for MVP, or add bounded typed knobs such as `AUTH_RATE_LIMIT_WINDOW_MS` and `AUTH_RATE_LIMIT_MAX` with production-safe minimums and no disable switch. Target part: env template and typed config spine.

3. Severity: Medium. Deployment docs are honest about production NOT RUN, but the security model still mixes current routes with target-era `/api/auth/*` claims. Evidence: `apps/web/src/middleware.ts:5-7` says the real auth entry points are Next.js server actions posting to `/login` and `/register` and that the old endpoint names are aspirational; `apps/web/src/app/(auth)/actions.ts:22-31` implements `loginAction`; `apps/web/src/app/(auth)/actions.ts:35-51` implements `registerAction`; `docs/SECURITY_MODEL.md:166-174` still lists `/api/auth/login`, `/api/auth/register`, `/api/auth/reset-password`, `/api/auth/change-password`, and `/api/auth/verify-email` as covered endpoints. Recommendation: update `SECURITY_MODEL.md` in a docs-owned lane to split CURRENT `/login` + `/register` middleware coverage from TARGET account-lockout/reset/change/verify-email coverage. Target part: runbook honesty and security source-of-truth docs.

4. Severity: Medium. Preview behavior can differ from production throttling unless proxy headers and `NODE_ENV` are verified. Evidence: `apps/web/src/middleware.ts:82-86` skips enforcement for a non-production direct-localhost request with no client IP, but production falls back to an `unknown` bucket; `packages/auth/src/rate-limit.ts:41-50` extracts client IP only from `x-forwarded-for` first hop or `x-real-ip`; `scripts/safe-preview.mjs:11-14` forces a developer-only preview profile with `APP_ENV=development`, mock adapters, and unsafe features off; `docs/DEPLOYMENT.md:398-401` says the raw-IP preview is behind nginx and backed by preview Postgres, but still not production. Recommendation: for any preview used to assess auth throttling, explicitly record `NODE_ENV`, expected proxy headers, and whether a stripped-header request is throttled or intentionally skipped; do not treat local `preview:safe` as proof of production auth throttling. Target part: preview runbook and acceptance language.

5. Severity: Medium. The 429 breach path is unit-covered but not currently e2e-covered, while the acceptance matrix still asks for e2e 429. Evidence: `packages/auth/src/rate-limit.test.ts:24-31` covers blocking the `max+1` call; `packages/auth/src/rate-limit.test.ts:33-40` covers positive `Retry-After`; `tests/e2e/security-headers.spec.ts:28-34` explicitly says the 429 breach path is not exercised over e2e because rapid POST bursts destabilize the shared dev server; `docs/ACCEPTANCE_MATRIX_MASTER.md:206-209` still lists "middleware throttle unit test + e2e 429" as the PG11 gate. Recommendation: either add a stable isolated middleware/Next harness for the 429 route path, or revise the acceptance matrix to say the current accepted proof is unit limiter coverage plus middleware-active header e2e, with production proxy testing as a separate NOT RUN gate. Target part: tests-runner gate definition.

6. Severity: Low. No-live-mutation boundaries are clear in the deployment runbook and were respected in this audit. Evidence: `docs/DEPLOYMENT.md:3-4` forbids live server touch without explicit approval and forbids copying server secrets or editing live nginx/systemd/.env; `docs/DEPLOYMENT.md:426-427` says discovery is read-only and forbids `.env` copying, SSH/tmux/systemd/process control, and server `.env` mutation; `docker-compose.yml:1` labels compose as local development services only; `package.json:26` exposes `preview:safe` as a local script. Recommendation: keep this boundary in every future auth-rate-limit acceptance phase; any live nginx validation needs explicit operator approval and a separate handoff. Target part: devops operating procedure.

## Decisions
- Treated this as a single read-only `ecosystem-devops-implementer` lane, not a broad multi-agent phase and not an N-agent audit claim.
- Wrote only the requested handoff file; did not edit product code, env templates, deployment docs, tests, middleware, or package config.
- Classified the app-layer limiter as locally implemented for `/login` and `/register`, with fixed 10 requests/60s per client-IP key.
- Classified production/shared nginx auth-rate-limit verification as NOT RUN because no live nginx config was inspected or changed and production cutover is documented as NOT RUN.
- Treated local `preview:safe` as a developer safety profile, not production auth-throttling acceptance.
- Treated the workspace as not git-backed from this path after `git status --short` returned "not a git repository"; no git operations were attempted.

## Risks
- In a multi-instance or Edge-scaled deployment, the per-instance Map can under-throttle unless nginx `limit_req` or a shared store is active and verified.
- If preview nginx does not forward `x-forwarded-for` or `x-real-ip`, non-production preview traffic can skip in-app throttling for direct/no-IP requests and give a false sense of coverage.
- If docs continue to mix `/api/auth/*` target endpoints with current server-action paths, operators may believe reset/change/verify-email routes are protected when those endpoints are not current product routes.
- Adding env knobs later could accidentally weaken production behavior unless the config schema bounds values and forbids disabling auth throttling in production.

## Verification/tests
- Ran read-only grep/file inspection only.
- Confirmed the requested handoff path did not exist before writing.
- Did not run `npm run ci:local`, `npm test`, Playwright, `node scripts/gates.mjs full`, preview servers, database commands, SSH, nginx/systemd commands, or live acceptance commands because the requested lane was read-only and no-live-mutation.
- RUN: local source inspection of auth middleware, pure limiter, env template, typed config, safe-preview script, deployment runbook, security model, production blockers, acceptance matrix, and relevant tests.
- NOT RUN: live nginx `limit_req` inspection, raw-IP preview auth burst, production auth burst, stripped-proxy-header production check, shared-store rate-limit validation, production deployment, production nginx/domain/TLS cutover, CI via GitHub Actions, real Postgres migration/seed, live bot/exchange controls, Stripe/Axioma/LMS live preflights.

## Next actions
1. In a docs-only devops lane, update `docs/DEPLOYMENT.md` with an explicit auth rate-limit section: current app constants, nginx `limit_req` requirement, required proxy headers, preview/prod test commands, and RUN/NOT RUN criteria.
2. Update `docs/SECURITY_MODEL.md` to separate CURRENT `/login` and `/register` server-action middleware coverage from TARGET `/api/auth/*` account-lockout/reset/change/verify-email coverage.
3. Decide whether auth throttling remains fixed-code for MVP or becomes typed config; if config is added, enforce bounded production-safe values and do not add a production disable flag.
4. Add a stable isolated test or acceptance script for the middleware 429 path, or adjust `ACCEPTANCE_MATRIX_MASTER.md` so it no longer requires an e2e 429 proof that the current e2e suite intentionally avoids.
5. For any future preview/prod validation, require explicit operator approval before touching nginx, systemd, server env, or live hosts, and retain redacted evidence only.
