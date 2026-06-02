# bot-admin-surface-hardening handoff

## Scope
Bounded bot/admin product surface hardening only:
- Harden `/app/bots/[bot]/safety` so blocked/not-ready adapters render honest UI state instead of crashing.
- Replace `/admin/products` placeholder with a real admin overview over the code registry, product availability, DB catalog seed presence, plan coverage, and entitlement counts when available.

No billing, Axioma, DB seed/preview, live server, SSH, exchange, live bot control, worker, or live adapter action was touched.

Agent tooling note: separate background agent tooling was unavailable in this Codex session, so no multi-agent audit is claimed.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260531-1426-phase-3-4-stripe-test-checkout.md`
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/admin/products/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `packages/entitlements/src/registry.ts`
- `packages/entitlements/src/state-machine.ts`
- `apps/web/src/lib/product-status.ts`
- `packages/db/src/schema.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-responsive.test.ts`

## Files changed
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/products/page.tsx`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `docs/handoffs/20260531-1500-bot-admin-surface-hardening.md`

## Findings
1. High - `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx` called `getHealth()` and `getWarnings()` directly. In non-mock modes, an `AdapterNotReadyError` or `LegacyAdapterBlockedError` could crash the route even though the other bot read pages already used `loadBotReadModel`. Recommendation: route safety reads through the shared safe wrapper. Target: bot safety route.
2. Medium - `apps/web/src/app/admin/products/page.tsx` was still a literal placeholder. Recommendation: render a read-only admin overview using the existing registry, product availability map, DB product/plan seed rows, and entitlement status counts where Postgres is configured. Target: admin products page.

## Decisions
- Extended `loadBotReadModel` with a `warnings` safe read part so the safety page can reuse the existing adapter error handling pattern.
- Kept safety metrics honest: if warnings cannot be read, the page shows the read issue and renders zero visible warning rows instead of fabricating warning events.
- Added `loadAdminProducts()` in the existing admin loader module. It reads DB rows only through `getServerDb()` and falls back to registry-only demo state when no `DATABASE_URL` exists.
- `/admin/products` remains read-only. Catalog edits are still code-defined; entitlement mutation remains on `/admin/entitlements`.

## Risks
- `loadAdminProducts()` counts current entitlement rows by status; it does not run expiry reconciliation before reading.
- Demo mode has no DB catalog rows by design, so the page labels catalog seed presence as not connected/missing rather than pretending the seed exists.
- Full-repo lint is currently blocked by an unrelated Axioma terminal lint error outside this ownership scope.

## Verification/tests
- `npx vitest run tests/integration/bot-read-safety-static.test.ts tests/integration/admin-responsive.test.ts`: PASS - 50 passed.
- `npm run typecheck -w @wtc/web -- --pretty false`: PASS.
- `npm run typecheck -- --pretty false`: PASS.
- `npx eslint --quiet <changed files>`: PASS.
- `npm test`: PASS - 568 passed / 8 skipped (576), 53 files.
- `npm run check:core`: PASS.
- `npm run build -w @wtc/web`: PASS - 32 static pages, `/admin/products` and `/app/bots/[bot]/safety` included.
- `npm run lint -- --quiet`: NOT PASS - unrelated pre-existing/out-of-scope `apps/web/src/app/(app)/app/terminal/page.tsx:30:9 bridgeActionsEnabled is assigned a value but never used`.

## Next actions
- Fix the unrelated Axioma terminal lint issue in an Axioma-owned pass.
- Add an e2e smoke for `/admin/products` if the next browser-preview phase is running Playwright anyway.
- Continue real-PG acceptance separately; this pass did not run `db:migrate`, `db:seed`, or a real-PG harness.
