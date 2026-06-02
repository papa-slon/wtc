# ecosystem-devops-implementer handoff
## Scope
Read-only Phase 3.39 devops/env/runbook audit for a local Stripe webhook replay/preflight slice.

Scope included `.env.example`, package scripts, local/CI gate docs, Stripe billing/runbook docs, current checkout/webhook code boundaries, and blocker/status docs. No product code or docs were edited except this required handoff.

## Files inspected
- `.env.example`
- `package.json`
- `README.md`
- `.github/workflows/ci.yml`
- `scripts/gates.mjs`
- `scripts/safe-preview.mjs`
- `packages/config/src/env.ts`
- `packages/billing/src/provider.ts`
- `packages/billing/src/stripe.ts`
- `apps/web/src/features/billing/checkout.ts`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `tests/integration/billing-webhook-route-handler.test.ts`
- `tests/integration/billing-webhook-phase24.test.ts`
- `docs/PRODUCTION_BLOCKERS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/BILLING_PROVIDER_PLAN.md`
- `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md`
- `docs/CONTRACTS/billing-webhooks.md`
- `docs/handoffs/20260531-1426-phase-3-4-stripe-test-checkout.md`

## Files changed
`docs/handoffs/20260602-0725-ecosystem-devops-implementer.md` only.

Read-only audit otherwise. No product code, existing docs, env files, scripts, tests, or CI files were modified.

## Findings
1. MEDIUM - No dedicated Stripe replay/preflight command exists, so the operator has no low-risk equivalent of the LMS live-preflight guardrails. Evidence: `package.json:11-34` lists general gates plus LMS object-store/scanner acceptance commands, but no `accept:stripe:*` or Stripe replay command; `scripts/` contains only gate, LMS preflight, safe preview, worker, and artifact-scan helpers. Recommendation: add a future `npm run accept:stripe:webhook-replay` command that defaults to dry-run/no-network, refuses live mode unless explicit consent envs are set, redacts all request/signature material, writes only summary evidence, and fails if `STRIPE_SECRET_KEY` is live-mode. Target part: operator runbook / preflight script.

2. HIGH - Real Stripe replay remains NOT RUN because this environment has no Stripe CLI/test webhook secret/test price IDs supplied for the session. Evidence: `.env.example:99-108` documents mock billing by default plus placeholder `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_MAP`; `docs/PRODUCTION_BLOCKERS_CURRENT.md:11` says Stripe CLI/test webhook replay and production key provisioning are NOT RUN; Phase 3.4 aggregate records real dashboard/CLI completion NOT RUN due to no real Stripe test price IDs or webhook secret at `docs/handoffs/20260531-1426-phase-3-4-stripe-test-checkout.md:77-80`. Recommendation: keep Phase 3.39 as a local preflight/runbook slice only unless the operator provides test-mode Stripe CLI access, `whsec_...`, `sk_test_...`, and test `price_...` IDs. Target part: Stripe replay acceptance.

3. MEDIUM - Checkout/webhook code has a useful test-mode safety fence, but env validation does not enforce Stripe-key completeness when `BILLING_PROVIDER=stripe`. Evidence: `packages/billing/src/provider.ts:97-121` requires provider `stripe`, secret key, webhook secret, `sk_test_` prefix, and price map before marking checkout available; `apps/web/src/features/billing/checkout.ts:108-118` repeats the provider/key/test-mode checks before checkout creation; `packages/config/src/env.ts:58-60` only declares `BILLING_PROVIDER`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` without a Stripe-specific `superRefine`. Recommendation: in a future implementation lane, fail config load when `BILLING_PROVIDER=stripe` and required Stripe values are missing or live-mode in a test-only deployment; for this runbook slice, make the preflight script perform the same checks before any network action. Target part: env guardrails.

4. LOW - `STRIPE_PRICE_MAP` is documented in `.env.example` but is not part of the typed config spine, so malformed price-map JSON is detected only by checkout helper code paths. Evidence: `.env.example:106-108` contains `STRIPE_PRICE_MAP`; `packages/config/src/env.ts:58-60` has Stripe provider/key fields but no `STRIPE_PRICE_MAP`; `apps/web/src/features/billing/checkout.ts:21-44` parses the price map directly from `process.env`. Recommendation: future runbook/preflight should validate JSON/comma formats, verify every selected plan has a `price_...` test ID, and fail before starting a local server or Stripe CLI listener. Target part: Stripe preflight validation.

5. MEDIUM - Current documentation is internally stale around checkout creation, which can mislead an operator writing the replay runbook. Evidence: current implementation creates Stripe Checkout Sessions by REST when configured at `packages/billing/src/stripe.ts:76-98` and Phase 3.4 records the implementation at `docs/handoffs/20260531-1426-phase-3-4-stripe-test-checkout.md:16-23`; however `docs/CONTRACTS/billing-webhooks.md:368-375` still states checkout creation is TARGET and no live charge path exists, and its activation checklist still says `createCheckout` is unimplemented at `docs/CONTRACTS/billing-webhooks.md:377-386`. Recommendation: do not use that contract section as the replay runbook source until reconciled; operator runbook should cite Phase 3.4/current code for checkout status and keep live charge disabled by requiring `sk_test_` only. Target part: billing docs truth.

6. INFO - Local route-level coverage exists and can be used as the no-credential preflight baseline before any Stripe CLI replay. Evidence: the route is a thin Node adapter at `apps/web/src/app/api/billing/webhook/route.ts:13-21`; `tests/integration/billing-webhook-route-handler.test.ts:91-97` injects a fake `STRIPE_WEBHOOK_SECRET` and PGlite DB; route tests cover missing/invalid signature, valid checkout event, terminal duplicate, in-flight duplicate, stale processing, missing user, and unknown plan at `tests/integration/billing-webhook-route-handler.test.ts:104-217`; Phase 2.4 tests cover concurrent duplicate idempotency and refund state transitions at `tests/integration/billing-webhook-phase24.test.ts:107-148` and `tests/integration/billing-webhook-phase24.test.ts:197-220`. Recommendation: local preflight should first run the focused billing suites plus `node scripts/gates.mjs full`; only after green local gates should the operator run Stripe CLI/dashboard replay. Target part: preflight sequence.

7. INFO - CI and general gate wiring are staged/local, not a live Stripe replay proof. Evidence: `.github/workflows/ci.yml:1` says CI is staged because the repo is not yet git-backed/remoted; CI generates generic app secrets at `.github/workflows/ci.yml:68-73` but does not configure Stripe keys; `scripts/gates.mjs:47-52` runs core/build/e2e plans and intentionally separates e2e, with no Stripe CLI step. Recommendation: final acceptance must list CI/local gates separately from Stripe replay, and must keep Stripe replay NOT RUN unless observed with test credentials this session. Target part: gate reporting.

8. INFO - Safe local preview does not force Stripe off, so a replay runbook must explicitly define a Stripe test-only env overlay. Evidence: `scripts/safe-preview.mjs:10-15` forces `APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, live bot control off, and TV automation off, but does not set or clear `BILLING_PROVIDER` or Stripe env values; checkout helper permits test-mode Stripe when `BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and price map are present at `apps/web/src/features/billing/checkout.ts:108-124`. Recommendation: runbook should start the server with an explicit temporary env block: `BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY=sk_test_...`, `STRIPE_WEBHOOK_SECRET=whsec_...`, `STRIPE_PRICE_MAP=...`, `APP_BASE_URL=http://localhost:3000`, and no live `sk_live_`/`whsec_live_` values. Target part: local runbook.

## Decisions
1. Treat this phase as read-only devops audit plus handoff only; no product code, existing docs, tests, or env templates were changed.
2. Do not claim real Stripe replay, live webhook delivery, test-clock lifecycle, chargeback, production key provisioning, CI proof, or real-Postgres proof in this lane.
3. Recommended local preflight order: focused billing webhook/checkout tests, `npm run secret:scan`, `node scripts/gates.mjs full`, optional `node scripts/gates.mjs e2e`, then Stripe CLI/dashboard replay only after operator provides test-only Stripe credentials.
4. A future Stripe replay script should copy the guardrail pattern used by LMS preflights: dry-run default, explicit live-acceptance env, no retained raw provider payloads/signatures, redacted summary artifact only, and generated-artifact scanning before evidence is archived.

## Risks
1. Without a scripted preflight, manual Stripe CLI replay can accidentally mix old `.env` values, wrong webhook secret, wrong price map, or a live-mode key.
2. Stale billing docs can cause an operator to build against outdated "checkout TARGET" assumptions even though current code has test-mode checkout wiring.
3. PGlite/local route tests prove the code path and idempotency behavior locally, but they do not prove Stripe Dashboard endpoint configuration, Stripe CLI forwarding, Stripe test-clock renewals, chargeback events, nginx/rate-limit behavior, or real-Postgres concurrency.
4. `.env.example` includes synthetic Stripe-looking placeholders; current secret scan has passed in prior gates, but a future runbook must never retain real `sk_*`, `whsec_*`, provider JSON payloads, or signed headers in logs/artifacts.

## Verification/tests
RUN this session:
- Read-only file inspection and line-cited audit only.
- `git status --short` attempted; result: `NOT_GIT_REPO`.

NOT RUN this session:
- `npm run check:core`, `npm run lint`, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm test`, `npm run build -w @wtc/web`, `node scripts/gates.mjs full`, and `node scripts/gates.mjs e2e` - out of scope for this read-only devops audit and recently covered by Phase 3.38 status.
- Stripe CLI `listen`, `trigger`, `events resend`, Dashboard webhook replay, Checkout Session creation against Stripe, test-clock renewal, refund, chargeback, and production webhook endpoint registration - no operator-provided Stripe CLI/test secrets/test price IDs in this session.
- Real Postgres `db:migrate`, `db:seed`, and real-PG harness - no throwaway Postgres URL supplied for this session.
- CI/GitHub Actions - repo is not git-backed/remoted in this workspace per local status and CI header.
- Live bot/server/exchange/Axioma/TradingView actions - outside scope and not touched.

## Next actions
1. Reconcile `docs/CONTRACTS/billing-webhooks.md` with current Phase 3.4 checkout reality before using it as a Stripe replay runbook source.
2. Add a guarded Stripe webhook replay/preflight script and npm command with dry-run default, explicit test-only consent envs, redacted summary output, and artifact scanning.
3. Add or document a Stripe env preflight that rejects missing `STRIPE_WEBHOOK_SECRET`, missing `STRIPE_PRICE_MAP`, malformed price IDs, and any `sk_live_` key in local acceptance.
4. When the operator provides test Stripe credentials, run a fresh scoped Stripe acceptance session: start local preview with explicit Stripe test env, run Stripe CLI forwarding to `POST /api/billing/webhook`, create a test checkout, replay `checkout.session.completed`, verify `pending_payment -> active`, verify duplicate replay is idempotent, then record exact gates RUN/NOT RUN.
5. Keep production Stripe readiness blocked until real staging proof covers Stripe CLI/Dashboard replay, test-clock lifecycle, refund/chargeback cases, endpoint registration, secret storage, and real-Postgres/CI evidence.
