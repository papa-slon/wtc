# PRODUCTION_BLOCKERS — WTC Ecosystem Platform

_The exact blockers between "Phase 2.4 / now" and "production-ready", each with an owner and the
**concrete evidence required to clear it**. Created 2026-05-30, epoch `20260530-1625`, from the planning
fan-out. The platform is **NOT production-ready** until every CRITICAL/HIGH blocker below is cleared.
Cross-ref: [`ROADMAP_MASTER.md`](ROADMAP_MASTER.md), [`RISK_REGISTER_MASTER.md`](RISK_REGISTER_MASTER.md)._

Owner key: **OP** = operator/infra decision · **EXT** = external team (Axioma / legacy bot) · **WTC** = in-repo work.

---

## B1 — Real Postgres acceptance never run  ·  HIGH  ·  OP+WTC  ·  PG1
**State:** the current local schema/proof harness is ready for a throwaway real-Postgres run, but the active run was not
executed in this session because no `REAL_POSTGRES_DATABASE_URL` was supplied. PGlite and skipped Vitest output are **not** a
substitute.
**Evidence to clear:**
1. Operator provides `REAL_POSTGRES_DATABASE_URL=postgres://<user>:<pass>@127.0.0.1:5432/wtc_test`
   (DB name **must** match `^wtc_test(_[a-z0-9]+)?$` — the harness guard refuses anything else).
2. Run only `npm test -- tests/integration/db-real-postgres.test.ts`; the harness applies committed migrations and seeds its
   own fresh throwaway database.
3. The focused run exits 0 with **all active real-PG tests PASS**: current schema table-set proof, concurrent grant,
   concurrent `insertWebhookEventOnce` dedup, failed-login lockout race, and duplicate admin unlock race.
**WTC-side readiness (Phase 3.46):** DB-name guard + current schema-derived table-set proof + cross-connection tests are
locally present and no-credential helper tests pass; active real-PG proof remains **NOT RUN** until creds exist.

## B2 — Stripe self-serve checkout / live charge path  ·  HIGH  ·  OP+WTC  ·  PG4
**State:** webhook **reception** is real (needs `STRIPE_WEBHOOK_SECRET`); test-mode checkout creation is implemented
behind `BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_MAP`. Local signed replay
preflight exists, but Stripe CLI/Dashboard replay, production key provisioning, and production endpoint registration remain
NOT RUN.
**Evidence to clear:**
1. Operator selects a billing provider; decision recorded in `ARCHITECTURE_DECISIONS.md`;
   `BILLING_PROVIDER_PLAN.md` updated (API version, webhook sig method, lifecycle events, refund/chargeback, idempotency).
2. `STRIPE_SECRET_KEY` (test) + `STRIPE_PRICE_MAP` provisioned; checkout built behind the test-mode flag.
3. Stripe test-mode checkout to `pending_payment` to `active` acceptance passes (**no live charge**).
4. For go-live: live keys in vault + staging test-clock lifecycle + chargeback flow pass.

## B3 — Legacy bot adapter (plaintext exchange keys)  ·  HIGH  ·  EXT+WTC  ·  PG3
**State:** legacy `/api_management/` returns plaintext exchange keys; the real adapter is **HARD-BLOCKED**
(deleted + factory-gated); 5 BOT_CONTROL_SAFETY_MODEL security gates **NOT STARTED**. The two WTC-side
items are **DONE (Phase 2.8 / PG3)**; the blocker remains open on the **EXT** upstream fix + the 5 gates.
**Evidence to clear:**
1. **EXT (open):** upstream legacy bot implements a service-account credential / key-rotation fix eliminating
   plaintext key exposure (or strips key fields from the API).
2. **WTC — DONE (Phase 2.8 / PG3):** the real legacy HTTP adapter (`createHttpLegacyAdapter`) was **deleted**;
   the factory routes the legacy bot to `createLegacyBlockedAdapter` in every non-mock mode (no network path,
   `LegacyAdapterBlockedError` with `blockerRef='B3'`); the **Zod exclusion schema** `LegacyApiSafeBodySchema`
   strips any SECRET_HINTS field from a `/api_management/` body, with 16 unit tests asserting no secret-hint
   field (api_key/secret_key/…) survives. The dashboards show an honest "live adapter unavailable — blocked
   (B3)" banner (data-driven via `BOT_CAPS.liveAdapterBlocked`).
3. **Open:** all 5 security gates reviewed + cleared by bot-integration + security auditors; operator approves
   enabling read-only — and only then is a NEW real read-only adapter (re-)introduced behind the cleared gates.

## B4 — Axioma terminal real CTAs (Download / Open-Journal / OTC link)  ·  HIGH  ·  EXT+OP+WTC  ·  PG6
**State:** all three CTAs remain disabled dev-placeholders. The **WTC unblocked half is DONE (Phase 2.9 / PG6)**:
`createEs256Signer` is wired into the bridge behind a **staging+prod fence** (`resolveHandoffSigner` +
`createAxiomaBridge`; `APP_ENV` + ES256-key superRefine in env.ts), and the `axioma_handoff_jti_revocations`
replay store landed (migration 0004) with `recordHandoffJti` / `consumeHandoffJti` (atomic, TOCTOU-free) /
`revokeHandoffJtisByUser` / `purgeExpiredHandoffJtis` (worker purge), all PGlite-tested. The blocker stays
OPEN on the **OP** key, the **EXT** endpoint shapes, and the WTC consumer routes those unblock.
**Evidence to clear:**
1. **EXT/OP (open):** written confirmation of `journal_server` endpoint shapes (health, entitlements, downloads,
   OTC link) from the axi-o.ma maintainer; **EXT:** raw-OTC→hash migration completed Axioma-side.
2. **OP (open):** provision an EC P-256 private key (`AXIOMA_HANDOFF_SIGNING_KEY` + `AXIOMA_HANDOFF_KEY_ID`).
   Until then `APP_ENV` stays development; ES256 *activation* is NOT RUN (the path is unit-tested with a generated key).
3. **WTC — DONE (Phase 2.9 / PG6):** `createEs256Signer` wired into `bridge.ts` behind the staging+prod fence;
   `axioma_handoff_jti_revocations` table (migration 0004, 40→41) + the four jti store repos; ES256 round-trip
   + jti-replay (PGlite) + fence (env + signer) tests pass. Hard boundary (no local execution gating) preserved;
   no CTA enabled.
4. **WTC (open, lands with the OP key + EXT shapes):** the web signer resolver (`getAxiomaSigner` → `loadEnv` →
   `resolveHandoffSigner`), the Open-Journal/consume/Download routes (with route-level in-txn jti audit using the
   pre-registered `axioma.handoff_jti_consume/_replay/_revoke` codes), `revokeHandoffJtisByUser` on entitlement
   revoke, the `axioma_account_links` OTC→`link_nonce_hash` migration (0005) — then enable the CTAs.

## B5 — Auth rate-limiting middleware absent  ·  ~~CRITICAL~~ **RESOLVED (Phase 2.6 / PG11, 20260530-1815)**  ·  WTC
**State:** **CLEARED.** `apps/web/src/middleware.ts` created (Edge): IP-keyed sliding-window rate-limit (10/60s, 429 +
`Retry-After`) on the **real** auth entry points — the server-action POSTs to `/login`+`/register` (there are no
`/api/auth/*` routes); SECURITY_MODEL §6 security headers (CSP/HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy/
Permissions-Policy/COOP/CORP) on document GET responses; `/api/billing/webhook` excluded (matcher + early return).
**Evidence delivered:** throttle covered by 14 unit tests (block-on-max+1, Retry-After, per-key isolation, window reset);
Phase 3.42 adds deterministic middleware integration coverage for matcher scope, `POST /login`, `POST /register`,
production no-IP fail-closed behavior, `429`, `Retry-After`, rate-limit headers, and generic body. Header builder by
21 unit tests; e2e asserts header presence on `GET /` and the billing-webhook tests stay green (they call repos directly
— middleware never runs in them); build (`ƒ Middleware 35.2 kB`) + lint green.
**Honest caveat:** the **429-on-breach path is verified by middleware integration, NOT normal-suite e2e** — per the
PG11/3.42 tests-runner handoffs, a rapid-POST e2e burst destabilises the single shared dev server and flakes adjacent
server-action tests.
**Deferred (not blockers):** CSP per-request nonce (prod ships `script-src 'self' 'unsafe-inline'` MVP — Phase 3);
F-03 structured logger (PG12); in-process limiter store → shared store for multi-instance (relies on nginx `limit_req` today).

## B6 — CI inert (not a git repo)  ·  MEDIUM  ·  OP  ·  PG12
**State:** `.github/workflows/ci.yml` exists but has never executed; no commit/branch/PR is possible.
**Evidence to clear:** `git init` + `git remote add origin <url>` + first push; a GitHub Actions `ci.yml`
run exits 0. Until then: `npm run ci:local` is the equivalent; **no CI/commit/PR claims are permitted**.

## B7 — Secrets not provisioned for production  ·  HIGH  ·  OP  ·  PG11/12
**State:** app fails closed without real KEK / SESSION_SECRET / Axioma signing secret (and rejects
low-entropy ones). KEK-under-env is a scale risk (Q-11).
**Evidence to clear:** real base64-32 `SECRET_VAULT_KEK`, `SESSION_SECRET`, Axioma signing key provisioned
in the vault at deploy time only; Q-11 KMS/Vault migration plan recorded for Phase 3; structured-logger
blocklist live; no `printenv`-style endpoints.
**New (Phase 2.7):** `JOURNAL_READ_TOKEN` must be provisioned (both WTC env + the live journal) before
`BOT_ADAPTER_MODE=read-only` is enabled in production — `env.ts superRefine` rejects a non-mock prod start without it,
and the adapter reports `readState='not_configured'` (reads nothing) until it is set. Never logged / in audit / in `rawJson`.

## B8 — Deployment runbook unvalidated  ·  MEDIUM  ·  OP+WTC  ·  PG12
**State:** DEPLOYMENT.md is structurally current but not validated against a real deploy; `db:seed` is not
idempotent (teacher course insert duplicates on re-seed); no systemd/nginx templates.
**Evidence to clear:** `db:seed` `onConflictDoNothing` fix; approval-gated systemd + nginx templates added;
env/migrate/seed/rollback steps verified against an approved deploy (no server touch without explicit approval).

---

## Operator decision checklist (unblocks the above)
- [ ] **B1** Run the real-Postgres harness against a fresh throwaway `wtc_test` / `wtc_test_*` database (server preview host currently exposes PG16 on localhost; do not use any live app DB).
- [ ] **B2** Choose billing provider (Q-2) + provision Stripe **test** keys.
- [ ] **B4** Confirm Axioma `journal_server` endpoint shapes + provision P-256 key (external dependency).
- [ ] **B3** Track legacy plaintext-key upstream fix (external dependency).
- [ ] **B6** `git init` + GitHub remote.
- [x] **PG10 / Phase 3.2** Backtester model — Tortila download-only local runner MVP shipped; Legacy remains permanently not available; server-side job/artifact/upload pipeline remains future work.
- [ ] **Q-6** Confirm club + education bundling rules.

## Standing safety invariants (never violated, independent of blockers)
Live bot control disabled · WTC never the order-execution path · entitlements fail closed and are the only
access source of truth · exchange keys only encrypted-at-rest, never logged/in-responses/in-fixtures ·
TradingView manual-first (no credential-stuffing) · Axioma bridge-only (never runtime copy) · discovery read-only.
