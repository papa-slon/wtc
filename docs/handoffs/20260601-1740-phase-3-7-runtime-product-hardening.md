# phase 3.7 runtime/product hardening handoff
## Scope
Bounded implementation pass for the June 1 runtime/product work package after dispatching the required background read-only agents. The session focused on safe local hardening for Workstreams A-D and left live preview, Stripe, TradingView, Axioma activation, exchange, and bot-control operations untouched.

Participant handoffs:
- [ecosystem-bot-integration-auditor](20260601-1740-ecosystem-bot-integration-auditor.md)
- [ecosystem-security-auditor](20260601-1740-ecosystem-security-auditor.md)
- [ecosystem-education-implementer](20260601-1740-ecosystem-education-implementer.md)
- [ecosystem-billing-access-auditor](20260601-1740-ecosystem-billing-access-auditor.md)
- [ecosystem-axioma-bridge-auditor](20260601-1740-ecosystem-axioma-bridge-auditor.md)
- [ecosystem-tests-runner](20260601-1740-ecosystem-tests-runner.md)

## Files changed
- `docs/handoffs/20260601-1740-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260601-1740-ecosystem-security-auditor.md`
- `docs/handoffs/20260601-1740-ecosystem-education-implementer.md`
- `docs/handoffs/20260601-1740-ecosystem-billing-access-auditor.md`
- `docs/handoffs/20260601-1740-ecosystem-axioma-bridge-auditor.md`
- `docs/handoffs/20260601-1740-ecosystem-tests-runner.md`
- `docs/handoffs/20260601-1740-phase-3-7-runtime-product-hardening.md`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/tick-once.ts`
- `apps/worker/package.json`
- `package-lock.json`
- `packages/db/src/client.ts`
- `packages/db/src/index.ts`
- `packages/bot-adapters/src/http.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/teacher/community/page.tsx`
- `packages/entitlements/src/state-machine.ts`
- `packages/entitlements/src/engine.test.ts`
- `packages/entitlements/src/__smoke__.ts`
- `packages/db/src/repositories.ts`
- `packages/bot-adapters/src/__tests__/getHealth-states.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/billing-webhook-phase24.test.ts`

## Findings
1. HIGH - Real Tortila reads could proceed without `JOURNAL_READ_TOKEN` even after health reported `not_configured`; fixed in the adapter, worker, and web read loader. Target: Workstreams A/B.
2. MEDIUM - Worker runtime had no safe one-shot real DB tick and did not share web's `TORTILA_JOURNAL_BASE_URL` fallback; added DB client ownership, import-safe worker helpers, and a real one-shot path that requires `DATABASE_URL`. Target: Workstream A.
3. MEDIUM - Teacher LMS render paths emitted DB-backed URLs directly and the teacher roster table missed responsive table conventions; fixed render-time safe-link guards and table labels. Target: Workstream C.
4. HIGH - Billing events could reactivate terminal/manual-review entitlement states; fixed the state-machine transition and added regression coverage. Target: Workstream D.
5. MEDIUM - Billing webhook audit attribution used the affected customer as the system actor; fixed actor attribution to `null` and stored the affected user in event metadata. Target: Workstream D.
6. OPEN HIGH - Stripe webhook idempotency still records `applied` before entitlement mutation completes; deferred to the next billing safety pass. Target: Workstream D.
7. OPEN HIGH - TradingView expiry revoke plus external task creation remains non-atomic; deferred to the next TV access pass. Target: Workstream D.
8. OPEN HIGH - Axioma route skeletons, handoff token shape, JWKS readiness, and terminal CTAs remain fail-closed/incomplete; no activation work was done. Target: Workstream E.
9. OPEN MEDIUM - Admin bot health still needs first-class `not_configured`/read-state rendering, and bot journal still needs DB-first load ordering. Target: Workstreams B/F.
10. OPEN MEDIUM - LMS literal CRUD, admin moderation, and DB-backed/mobile runtime coverage remain broader product work. Target: Workstream C.

## Decisions
- Treated the broad A-F package as too large for one safe completion session; implemented a bounded local hardening slice and left remaining scope as explicit open items.
- Did not start, stop, reconfigure, or call live bots, exchanges, TradingView accounts, Stripe live/test endpoints, Axioma live endpoints, SSH, tmux, systemd, or preview worker processes.
- Did not use `apps/worker/src/tick-once.ts` as fake acceptance. The script now requires `DATABASE_URL` for real one-shot acceptance and allows `--memory-demo` only as an explicit demo mode.
- Did not run real Postgres acceptance because neither `DATABASE_URL` nor `REAL_POSTGRES_DATABASE_URL` was provided for a throwaway DB in this session.
- Did not touch the existing listener on port 3000; Playwright, if run, must use its own port 3100 flow.
- Workspace is not git-backed from this directory; no branch, commit, PR, or CI claim is made.

## Risks
- The full requested package is not complete: preview worker deployment, live Stripe acceptance, route-level webhook harness, TV task atomicity, Axioma activation, admin observability, and broader LMS CRUD/moderation remain open.
- Without real Postgres credentials, worker DB acceptance is covered by local test harnesses only, not by an observed live DB command.
- Running E2E with an inherited `DATABASE_URL` would mutate that database; demo-only E2E must clear `DATABASE_URL` and `REAL_POSTGRES_DATABASE_URL` first.

## Verification/tests
Targeted gates RUN:
- PASS - `npm install --package-lock-only --ignore-scripts`
- PASS - `npm test -- tests/integration/worker-tortila-snapshot.test.ts`
- PASS - `npm test -- tests/integration/lms-ph3-1-static.test.ts`
- PASS - `npm test -- packages/entitlements/src/engine.test.ts tests/integration/billing-webhook-phase24.test.ts`
- PASS - `npm test -- packages/bot-adapters/src/__tests__/getHealth-states.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/worker-health-mapping.test.ts tests/integration/bot-read-safety-static.test.ts`
- PASS - `npm test -- tests/integration/billing-webhook-phase24.test.ts`

Final local gates RUN:
- PASS - `node scripts/gates.mjs full`; 9 gates, 0 failing: governance, check:core, lint, typecheck, web typecheck, secret scan, test, db:generate, and web build. Governance reported 0 errors and 1 known historical warning for `20260529-1921-integration-risk-auditor.md`.
- PASS - `Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; Remove-Item Env:REAL_POSTGRES_DATABASE_URL -ErrorAction SilentlyContinue; npm run e2e`; Playwright reported 44 passed and 6 skipped.

Gates NOT RUN:
- NOT RUN - real Postgres worker one-shot command; no throwaway `DATABASE_URL` was provided.
- NOT RUN - real Stripe dashboard/CLI acceptance; no `sk_test`, `whsec`, or test `price_` IDs were provided.
- NOT RUN - live TradingView, Axioma, bot, exchange, SSH, tmux, systemd, or preview-worker operations; intentionally out of scope for this safe local slice.

## Next actions
1. If the next session has a throwaway DB, run the real worker one-shot acceptance with `DATABASE_URL` and verify `integration_health_checks`, `bot_metric_snapshots`, `bot_position_snapshots`, and `bot_trade_imports`.
2. Fix Stripe webhook idempotency so duplicate acknowledgement depends on a terminal verified application state.
3. Make TradingView expiry revoke plus external task creation atomic or recoverable.
4. Fix Axioma handoff token contract, JWKS readiness, terminal CTA wiring, and disabled-state copy before any route activation claim.
5. Add admin bot read-state rendering, bot journal DB-first load ordering, LMS CRUD/moderation, and DB-backed/mobile coverage in separate bounded sessions.
