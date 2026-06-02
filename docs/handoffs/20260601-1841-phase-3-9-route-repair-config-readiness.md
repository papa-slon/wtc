# phase 3.9 route repair config readiness handoff
## Scope
New phase for the continuous full-platform build. This pass closed the next local production-readiness gaps left by phase 3.8: a real Stripe webhook handler harness, TradingView historical missing-task repair, Axioma production config/JWKS readiness cleanup, and Axioma handoff entitlement/link snapshot honesty. No live Stripe, TradingView, Axioma, bot, exchange, SSH, tmux, systemd, preview-worker, or production service operation was performed.

Participant handoffs:
- [ecosystem-security-auditor](20260601-1841-ecosystem-security-auditor.md)
- [ecosystem-tradingview-access-implementer](20260601-1841-ecosystem-tradingview-access-implementer.md)
- [ecosystem-axioma-bridge-auditor](20260601-1841-ecosystem-axioma-bridge-auditor.md)
- [ecosystem-tests-runner](20260601-1841-ecosystem-tests-runner.md)

## Files changed
- `docs/handoffs/20260601-1841-ecosystem-security-auditor.md`
- `docs/handoffs/20260601-1841-ecosystem-tradingview-access-implementer.md`
- `docs/handoffs/20260601-1841-ecosystem-axioma-bridge-auditor.md`
- `docs/handoffs/20260601-1841-ecosystem-tests-runner.md`
- `docs/handoffs/20260601-1841-phase-3-9-route-repair-config-readiness.md`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `apps/web/src/features/billing/webhook-handler.ts`
- `tests/integration/billing-webhook-route-handler.test.ts`
- `tests/integration/billing-webhook-hardening.test.ts`
- `packages/db/src/repositories.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `tests/integration/tv-access-hardening.test.ts`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `apps/web/src/features/terminal/axioma-jwks-readiness.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/axioma-jwks-readiness.test.ts`
- `tests/integration/axioma-handoff-snapshot.test.ts`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`

## Findings
1. HIGH - Stripe webhook HTTP behavior was only indirectly covered by package/repository tests and static source checks. Fixed by extracting `handleBillingWebhookRequest()` with explicit DB/env/clock injection and adding a signed Request harness for missing signature, invalid signature, valid apply, terminal duplicate, fresh processing duplicate, stale processing cleanup, missing user, and unknown plan. Target: billing webhook acceptance.
2. HIGH - Historical TradingView rows already revoked by the worker before phase 3.8 could remain without an external manual revoke task. Fixed by adding `repairMissingTvRevokeTasks()` for `expired_by_worker` revokes and wiring it into `runDbWorkerTick()`. Target: TradingView access repair.
3. HIGH - Production config still required the unused HS256 dev-stub secret while the real deployment signer is ES256. Fixed by removing the production requirement, keeping weak-secret rejection if the optional HS256 value is provided, and adding production ES256-only config coverage. Target: Axioma config.
4. HIGH - JWKS readiness was duplicated and presence-only. Fixed by adding `resolveAxiomaJwksReadiness()` and using it from both the terminal loader and the public JWKS route; tests cover missing key, missing kid, invalid key, valid key, 503 no-store, and 200 cacheable JWKS. Target: Axioma readiness honesty.
5. HIGH - Axioma handoff tokens defaulted to active/no-expiry/null-link even when route state had a real entitlement decision or linked account. Fixed route issuance to pass a real entitlement snapshot and linked `axiomaUserId` when present; package-level tests prove signed claims preserve explicit snapshots. Target: Axioma handoff payload.
6. OPEN HIGH - Real Stripe replay remains unrun; no Stripe credentials or price ids were provided.
7. OPEN HIGH - Axioma B4 activation remains incomplete: real endpoint-shape confirmation, download streaming, consume/replay route, OTC/account-link migration, OP key provisioning, and CTA enablement remain separate scoped work.
8. OPEN MEDIUM - TradingView repair is repository-level idempotent but still lacks a DB uniqueness constraint on `(request_id, kind)` for concurrent repair workers.

## Decisions
- Kept all live/external systems untouched.
- Kept Axioma CTAs fail-closed; `bridgeActionsImplemented` remains false.
- Kept TradingView manual-first; the repair only queues missing internal manual tasks and does not call TradingView.
- Kept the Stripe route as a thin Next adapter around a testable handler rather than importing `server-only` app plumbing into Vitest.
- Did not add a schema migration for TradingView task uniqueness in this slice; repository-level idempotency is sufficient for local single-worker repair and keeps the phase no-migration.
- Workspace is still not git-backed from this directory; no branch, commit, PR, or CI claim is made.

## Risks
- Concurrent repair workers could duplicate TradingView revoke tasks until a future unique index lands.
- The Stripe harness uses local HMAC-signed fake events, not Stripe CLI/dashboard replay.
- Axioma endpoint compatibility is still unverified without live endpoint-shape confirmation.
- The Axioma handoff route is more honest locally, but CTAs and real bridge calls remain intentionally disabled.

## Verification/tests
Targeted gates RUN:
- PASS - `npm test -- tests/integration/billing-webhook-route-handler.test.ts tests/integration/billing-webhook-hardening.test.ts tests/integration/billing-webhook-phase24.test.ts tests/integration/billing-webhook.test.ts`; 4 files, 22 tests passed.
- PASS - `npm test -- tests/integration/tv-access-hardening.test.ts tests/integration/db-tv-expiring.test.ts tests/integration/worker-tortila-snapshot.test.ts`; 3 files, 17 tests passed.
- PASS - `npm test -- packages/config/src/env.test.ts packages/axioma-bridge/src/handoff.test.ts packages/axioma-bridge/src/es256.test.ts packages/axioma-bridge/src/signer.test.ts tests/integration/axioma-skeleton-static.test.ts tests/integration/axioma-jwks-readiness.test.ts tests/integration/axioma-handoff-snapshot.test.ts tests/integration/db-axioma-jti.test.ts`; 8 files, 62 tests passed, 1 skipped.
- PASS - `npm run typecheck`.
- PASS - `npm run typecheck -w @wtc/web`.

Final gates RUN:
- PASS - `node scripts/gates.mjs full`; 9 gates, 0 failing: governance, check:core, lint, typecheck, web typecheck, secret scan, test, db:generate, and web build. Governance reported 0 errors and 1 known historical warning for `20260529-1921-integration-risk-auditor.md`.
- PASS - `Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; Remove-Item Env:REAL_POSTGRES_DATABASE_URL -ErrorAction SilentlyContinue; npm run e2e`; Playwright reported 44 passed and 6 skipped.

Gates NOT RUN:
- NOT RUN - real Postgres worker/route acceptance; no throwaway DB was provided for this phase.
- NOT RUN - real Stripe dashboard/CLI replay; no `sk_test`, `whsec`, or test `price_` IDs were provided.
- NOT RUN - live Axioma, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or production operations; intentionally out of scope.

## Next actions
1. Add a TradingView task uniqueness migration if concurrent repair workers become in-scope.
2. Continue Axioma B4 only after endpoint shapes and key provisioning are explicitly scoped.
3. If operator provides scoped credentials, run real Stripe CLI/dashboard replay and real Postgres route/worker acceptance as separate live/throwaway-DB phases.
