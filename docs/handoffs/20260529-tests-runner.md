# ecosystem-tests-runner handoff

> **SUPERSEDED.** The counts below (16/16 tests, 23 routes, 8/8 e2e) reflect the initial MVP build and
> are stale. Current verified gates are in `docs/STATUS.md` and `docs/handoffs/20260529-phase1-persistence-hardening.md`
> (55 Vitest tests, 38 routes, 10 e2e, + lint/secret-scan/coverage/DB-integration). Kept for history.

## Scope
Quality gates for the WTC Ecosystem Platform MVP build (run on Windows, Node 24.15, npm 11).

## Files inspected / changed
Test files: `packages/{crypto,entitlements}/src/*.test.ts`, `packages/*/src/__smoke__.ts`,
`tests/e2e/smoke.spec.ts`, `playwright.config.ts`, root `vitest.config.ts`.

## Findings (all observed, not assumed)
- **`npm run check:core`** — PASS. Zero-dependency Node type-strip smokes:
  - `@wtc/entitlements` 8 checks (fail-closed, time transitions active→grace→expired, bundle expansion, manual-grant precedence, refund/chargeback, explainAccess priority, lifetime).
  - `@wtc/crypto` 7 checks (round-trip, AAD context-binding, tamper detection, unknown keyId, KEK rotation, KEK length, masking).
  - `@wtc/analytics` 14 checks (closed vs unrealized PnL, win rate, profit factor incl. ∞/null, ROI on margin, max/current drawdown, null-not-zero).
  - `@wtc/audit` redaction + buildEvent + memory writer (no secret leaks).
  - `@wtc/auth` RBAC + ownership + session tokens (constant-time) + CSRF double-submit.
  - `@wtc/axioma-bridge` handoff token 7 checks (sign/verify, expiry, audience, tamper, wrong-secret, replay, no-keys).
  - `@wtc/billing` webhook verify + event mapping + idempotency + mock round-trip.
- **`npm test` (Vitest)** — PASS, 16/16 (crypto vault 5, entitlements engine 11).
- **`npx tsc --noEmit -p tsconfig.json` (packages)** — PASS, exit 0 (after fixing Argon2 const-enum import, two `noUncheckedIndexedAccess` spots, and adding `jsx` to the packages tsconfig).
- **`npm run build -w @wtc/web` (Next 15 production build)** — PASS. 23 routes compiled, types valid, 21 static pages generated.
- **`npm run e2e` (Playwright)** — PASS, 8/8 (desktop 1440×900 + mobile 390×844): public landing, pricing, user dashboard (asserts Tortila TP-reconciliation warning is visible), Axioma terminal, security, admin entitlements, admin TradingView queue. 16 screenshots in `tests/e2e/screenshots/`.
- **`npx tsx apps/worker/src/tick-once.ts`** — PASS. Reconciled an expired entitlement (active→expired) and emitted a redacted audit event.

## Decisions
- Security core is verified two ways: bare-Node smokes (no install) + Vitest. Adapter/bridge/billing logic verified via smokes; UI verified via Next build + Playwright.

## Risks
- Real bot adapters are intentionally stubbed (`AdapterNotReadyError`) until endpoint shapes are confirmed (see CONTRACTS). Legacy bot plaintext-key issue must be fixed upstream before any real adapter use.
- Playwright e2e runs against `next dev` (so http cookies aren't Secure-only); prod uses the `__Host-` cookie over TLS.

## Tests / verification
Commands above are reproducible from the repo root. No live server was contacted.

## Next actions
- Add integration tests against Postgres (`@wtc/db`) once a CI Postgres is available.
- Add webhook idempotency integration test with the real provider once selected.
