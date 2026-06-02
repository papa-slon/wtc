# phase 3.8 integration safety bridge honesty handoff
## Scope
New phase for the continuous full-platform build. This pass addressed the highest-risk local blockers left by phase 3.7: Stripe webhook retry/idempotency honesty, TradingView expiry task atomicity, Axioma handoff/readiness honesty, admin bot read-state rendering, and bot journal DB-first ordering. No live Stripe, TradingView, Axioma, bot, exchange, SSH, tmux, systemd, preview-worker, or production service operation was performed.

Participant handoffs:
- [ecosystem-security-auditor](20260601-1814-ecosystem-security-auditor.md)
- [ecosystem-tradingview-access-implementer](20260601-1814-ecosystem-tradingview-access-implementer.md)
- [ecosystem-axioma-bridge-auditor](20260601-1814-ecosystem-axioma-bridge-auditor.md)
- [ecosystem-bot-integration-auditor](20260601-1814-ecosystem-bot-integration-auditor.md)
- [ecosystem-tests-runner](20260601-1814-ecosystem-tests-runner.md)

## Files changed
- `docs/handoffs/20260601-1814-ecosystem-security-auditor.md`
- `docs/handoffs/20260601-1814-ecosystem-tradingview-access-implementer.md`
- `docs/handoffs/20260601-1814-ecosystem-axioma-bridge-auditor.md`
- `docs/handoffs/20260601-1814-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260601-1814-ecosystem-tests-runner.md`
- `docs/handoffs/20260601-1814-phase-3-8-integration-safety-bridge-honesty.md`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `tests/integration/billing-webhook-hardening.test.ts`
- `tests/integration/tv-access-hardening.test.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/bridge.ts`
- `packages/axioma-bridge/src/index.ts`
- `packages/axioma-bridge/src/handoff.test.ts`
- `packages/axioma-bridge/src/es256.test.ts`
- `packages/axioma-bridge/src/signer.test.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `tests/integration/axioma-skeleton-static.test.ts`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/bots/journal.ts`
- `tests/integration/bot-read-safety-static.test.ts`

## Findings
1. HIGH - Stripe webhook ledger rows were inserted as terminal `applied` before entitlement mutation. Fixed by introducing non-terminal `processing`, terminal-status duplicate handling, and regression coverage. Target: billing/webhook safety.
2. HIGH - TradingView expiry revoke and manual external task creation were split across transactions. Fixed by letting `atomicRevokeTv` queue the external revoke task in the same transaction. Target: TradingView access integrity.
3. HIGH - Axioma handoff helpers and token payload drifted from the POST/JWT contract. Fixed `createJournalHandoff` to return POST-body handoff data, removed package-level query-token normalization, changed token headers to `typ: JWT`, moved registered claims to Unix seconds, added `nbf`, `wtc_flow`, `wtc_entitlement`, `wtc_axioma_user_id`, and a 32-byte nonce. Target: Axioma bridge readiness.
4. HIGH - `/app/terminal` could enable inert CTAs when route skeleton envs passed. Fixed CTA enablement to require an explicit `bridgeActionsImplemented` gate, currently false. Target: terminal UI honesty.
5. MEDIUM - Terminal JWKS status could show configured with only a private key and no key id. Fixed loader readiness to require both `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID`. Target: JWKS readiness honesty.
6. MEDIUM - Admin bot page collapsed Tortila `not_configured` into generic error handling. Fixed admin DTO/query/page mapping to preserve latest `tortila-journal` status/readState/detail and render setup-needed. Target: admin ops.
7. MEDIUM - Bot journal claimed DB-first but called adapters before checking imports. Reordered Postgres mode to load durable imports/reviews first and only call adapter fallback when no imports exist. Target: bot product surface.
8. OPEN HIGH - Real Stripe CLI/dashboard replay remains unrun; this pass is local signed-body/PGlite/source coverage only.
9. OPEN HIGH - Real Axioma B4 activation remains incomplete: key provisioning, endpoint-shape confirmation, real download streaming, consume route, OTC account-link refactor, and enabled CTAs are still not complete.
10. OPEN MEDIUM - TradingView missing-task recovery for historical partial states remains deferred; this pass prevents the split for new sweeps but does not add a repair scanner.

## Decisions
- Kept all live/external systems untouched.
- Kept Axioma route/CTA activation fail-closed; the token shape is closer to spec, but production activation is still not claimed.
- Avoided a DB migration for webhook `processing` because `billing_webhook_events.status` is unconstrained text.
- Kept TradingView access manual-first; no browser automation or credential-stuffing path was added.
- Workspace is still not git-backed from this directory; no branch, commit, PR, or CI claim is made.

## Risks
- Stripe route behavior is still not covered by a direct Next route-handler harness; current coverage uses repository helpers plus static route guards.
- If a historical TradingView partial state already exists with request revoked and no task, this phase does not repair it automatically.
- Axioma docs/code now align on POST-body handoff, but live Axioma endpoint compatibility has not been confirmed.
- Real Postgres, real Stripe, live Axioma, live TradingView, and preview-worker acceptance are still outside this local pass unless the operator provides explicit scoped credentials/approval.

## Verification/tests
Targeted gates RUN:
- PASS - `npm test -- tests/integration/billing-webhook-hardening.test.ts tests/integration/billing-webhook-phase24.test.ts tests/integration/tv-access-hardening.test.ts tests/integration/db-tv-expiring.test.ts`; 4 files, 23 tests passed.
- PASS - `npm test -- packages/axioma-bridge/src/handoff.test.ts packages/axioma-bridge/src/es256.test.ts packages/axioma-bridge/src/signer.test.ts tests/integration/axioma-skeleton-static.test.ts tests/integration/db-axioma-jti.test.ts`; 5 files, 38 tests passed, 1 skipped.
- PASS - `npm test -- tests/integration/bot-read-safety-static.test.ts tests/integration/worker-health-mapping.test.ts tests/integration/bot-statistics-static.test.ts tests/integration/worker-tortila-snapshot.test.ts`; 4 files, 29 tests passed.
- PASS - combined targeted sweep for all touched areas; 13 files, 90 tests passed, 1 skipped.
- PASS - `npm run typecheck`.
- PASS - `npm run typecheck -w @wtc/web`.
- PASS - `npm run check:core`.

Final gates RUN:
- PASS - `node scripts/gates.mjs full`; 9 gates, 0 failing: governance, check:core, lint, typecheck, web typecheck, secret scan, test, db:generate, and web build. Governance reported 0 errors and 1 known historical warning for `20260529-1921-integration-risk-auditor.md`.
- PASS - `Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; Remove-Item Env:REAL_POSTGRES_DATABASE_URL -ErrorAction SilentlyContinue; npm run e2e`; Playwright reported 44 passed and 6 skipped.

Gates NOT RUN:
- NOT RUN - real Postgres worker/route acceptance; no throwaway DB was provided for this phase.
- NOT RUN - real Stripe dashboard/CLI replay; no `sk_test`, `whsec`, or test `price_` IDs were provided.
- NOT RUN - live Axioma, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or production operations; intentionally out of scope.

## Next actions
1. Add a direct webhook route-handler harness in a later phase to prove terminal duplicate/retry HTTP behavior.
2. Add TradingView missing-task historical repair if production data could contain pre-fix partial states.
3. Continue Axioma B4 only after endpoint shapes and key provisioning are explicitly scoped.
4. If operator provides scoped credentials, run real Stripe CLI/dashboard replay and real Postgres route/worker acceptance as separate live/throwaway-DB phases.
