# axioma-skeleton handoff

## Scope
Implement a narrow, fail-closed Axioma terminal bridge skeleton only:
- server-only route readiness and signer resolver
- `/api/axioma/download` skeleton
- `/api/axioma/journal-handoff` POST skeleton
- terminal UI action gating
- tests proving no-key/no-config, no-entitlement, and no GET token leakage boundaries

No billing, DB seed, bot admin products, live Axioma calls, live server, bot, exchange, or Stripe surfaces were touched.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260531-1426-phase-3-4-stripe-test-checkout.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/app/api/bots/[bot]/backtest/runner-download/route.ts`
- `packages/axioma-bridge/src/index.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/signer.ts`
- `packages/db/src/repositories.ts`
- `packages/audit/src/audit.ts`
- `.env.example`

## Files changed
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `tests/integration/axioma-skeleton-static.test.ts`
- `.env.example`
- `docs/handoffs/20260531-1500-axioma-skeleton.md`

## Findings
1. Severity: medium. Evidence: `apps/web/src/app/(app)/app/terminal/page.tsx` previously had disabled placeholder buttons tied mainly to `axiomaBridgeIsDev()`. Recommendation: make route-readiness a shared server-side decision so CTAs cannot enable from partial config. Target part: terminal UI/action gating.
2. Severity: medium. Evidence: `packages/db/src/repositories.ts` already exposes `recordHandoffJti`, but no web route was using it. Recommendation: journal handoff skeleton should record the JTI before returning a token when fully configured. Target part: Axioma handoff route.
3. Severity: high. Evidence: `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md` requires POST handoff behavior and no long-lived GET token leakage. Recommendation: expose POST-only issuance; GET returns 405 and never includes token material. Target part: `/api/axioma/journal-handoff`.

## Decisions
- Added `AXIOMA_ROUTE_SKELETON_ENABLED=false` as an explicit fail-closed route flag.
- Defined route readiness as: route flag enabled, DB available, `AXIOMA_BRIDGE_API_TOKEN` set, ES256 key + key id set, and valid Axioma base URL.
- The route signer resolver uses the existing `@wtc/axioma-bridge` `resolveHandoffSigner` but passes no HS256 secret, so the web route skeleton does not issue dev-stub HS256 handoff tokens.
- `/api/axioma/download` performs auth and entitlement checks, then returns `503 not_configured` until fully configured; if configured, it returns `501 bridge_not_implemented` and makes no live Axioma call.
- `/api/axioma/journal-handoff` is POST-only, CSRF-header gated, auth gated, entitlement gated, config gated, records the JTI via `@wtc/db`, writes an audit row, and returns a POST target plus token only in the POST response.
- Terminal CTAs stay disabled unless entitlement and route readiness both pass.

## Risks
- This is intentionally not live-ready: download proxying and Axioma POST handoff consumption are still not implemented.
- The POST route returns token material in a JSON POST response when fully configured; this satisfies the no-GET-leakage skeleton but still needs final Axioma endpoint confirmation before wiring a browser form/redirect UX.
- Full end-to-end route behavior with a real DB and provisioned P-256 key was not run in this environment.

## Verification/tests
- `npm test -- tests/integration/axioma-skeleton-static.test.ts`: PASS, 4 passed.
- `npm run typecheck -- --pretty false`: PASS.
- `npm run typecheck -w @wtc/web -- --pretty false`: PASS.
- `npm run lint -- --quiet`: PASS.
- `npm run build -w @wtc/web`: PASS, includes `/api/axioma/download` and `/api/axioma/journal-handoff`; 32 generated static pages, dynamic route list green.

Gates not run:
- Full `npm test`: NOT RUN; scoped route skeleton change was covered by targeted static test plus typecheck/lint/build.
- `npm run check:core`: NOT RUN; no package smoke surface changed.
- `npm run secret:scan`: NOT RUN; no real secrets added, `.env.example` placeholder only.
- `npm run db:generate -w @wtc/db`: NOT RUN; no schema change.
- Real Postgres `db:migrate`, `db:seed`, and real-PG harness: NOT RUN; no throwaway `REAL_POSTGRES_DATABASE_URL` provided.
- Playwright e2e: NOT RUN; CTAs remain disabled and no interactive browser flow was wired.
- Live Axioma bridge/download/journal calls: NOT RUN by design.
- Git/CI/commit: NOT RUN; workspace is not git-backed.

## Next actions
- Confirm the final Axioma `/wtc-handoff` POST shape and browser handoff UX with the Axioma side before enabling any user-facing submission.
- Implement the actual download proxy only after service-account credentials, endpoint behavior, and token lifecycle storage are confirmed.
- Run the real-PG harness and a provisioned ES256 route acceptance test in a throwaway environment before changing `AXIOMA_ROUTE_SKELETON_ENABLED`.
