## Scope
Phase 3.2: execute a broad product-surface slice instead of another narrow planning prompt. Four read-only agents audited backtester distribution, bot product surfaces, deploy/IP readiness, and cabinet demo readiness before edits.

Agent handoffs:
- [backtester-download-auditor](20260531-1220-backtester-download-auditor.md)
- [bot-product-surfaces-auditor](20260531-1220-bot-product-surfaces-auditor.md)
- [deploy-ip-readiness-auditor](20260531-1220-deploy-ip-readiness-auditor.md)
- [cabinet-demo-readiness-auditor](20260531-1220-cabinet-demo-readiness-auditor.md)

## Files changed
- packages/backtester/src/derive.ts
- packages/backtester/src/derive.test.ts
- packages/backtester/src/runner-release.test.ts
- packages/backtester/runner-src/wtc-backtester-0.1.0/*
- packages/backtester/runners/wtc-backtester-0.1.0.zip
- apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx
- apps/web/src/app/api/bots/[bot]/backtest/runner-download/route.ts
- apps/web/src/features/bots/config.ts
- apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx
- apps/web/src/app/(app)/app/products/page.tsx
- tests/integration/backtester-pg10.test.ts
- tests/integration/bot-read-safety-static.test.ts
- tests/integration/product-directory-static.test.ts
- docs/CONTRACTS/backtester-runner.md

## Findings
- The entitled Tortila backtester can now ship as an honest local-runner download; server jobs and artifact upload remain out of scope.
- Tortila and legacy bot settings needed product-specific forms and manual defaults.
- Missing mark/uPnL from the real Tortila read-only adapter must be N/A, not 0.
- /app/products needed to become a real product directory, not a placeholder.

## Decisions
- Ship the download-only runner MVP with checksum-verified ZIP metadata.
- Keep legacy bot live setup blocked while B3 remains.
- Keep all live bot control disabled.
- Keep preview/demo labels visible.

## Risks
- Real Postgres migration/seed is still not run without DATABASE_URL.
- The backtester runner is a local MVP, not the final distributed research product.
- Real live adapters, Stripe checkout, Axioma bridge, and CI remain production blockers.

## Verification/tests
- `npm run governance:check` PASS (4 cited per-agent handoffs; one allowlisted historical warning).
- `npm run check:core` PASS.
- `npm run lint` PASS.
- `npm run typecheck` PASS.
- `npm run typecheck -w @wtc/web` PASS.
- `npm test` PASS: 539 passed / 8 skipped (547), 49 files.
- `npm run secret:scan` PASS.
- `npm run coverage` PASS: 25.93% statements / 76.00% branches.
- `npm run db:generate -w @wtc/db` PASS: 41 tables, no schema changes.
- `npm run build -w @wtc/web` PASS: 46 routes.
- `npx playwright test --reporter=line` PASS: 42 passed / 2 flaky-green / 6 skipped / 0 failed. The two flaky retries are the known dev-only login/Server-Action race in `tests/e2e/smoke.spec.ts`.
- NOT RUN: real Postgres migrate/seed/harness (no DATABASE_URL/REAL_POSTGRES_DATABASE_URL).

## Next actions
- Start a safe browser preview on `0.0.0.0` if visual inspection is needed; do not run worker for the preview.
- Continue with real-Postgres acceptance and larger integration work: B1 real-PG migrate/seed/harness, B2 Stripe test checkout, B4 Axioma production bridge, then server-side backtester artifact pipeline if selected.
