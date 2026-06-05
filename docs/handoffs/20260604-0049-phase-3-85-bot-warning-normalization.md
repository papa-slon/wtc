# phase-3-85-bot-warning-normalization handoff
## Scope
Phase 3.85 implemented a narrow warning-normalization slice for the bot ecosystem. The goal was to stop Legacy `warningCodes` and Tortila `warnings` from drifting across user safety/statistics and admin health surfaces, while preserving the live-control boundary.

Per-agent handoffs:
1. `docs/handoffs/20260604-0029-bot-warning-normalization-backend-auditor.md`
2. `docs/handoffs/20260604-0029-bot-warning-normalization-ux-tests-auditor.md`
3. `docs/handoffs/20260604-0029-bot-warning-normalization-platform-security-auditor.md`

All three background agents were launched before Phase 3.85 edits, their handoffs were collected, and all three agents were closed before this report.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/20260603-2356-phase-3-84-bot-readiness-server-dto.md`
4. `docs/handoffs/20260604-0029-bot-warning-normalization-backend-auditor.md`
5. `docs/handoffs/20260604-0029-bot-warning-normalization-ux-tests-auditor.md`
6. `docs/handoffs/20260604-0029-bot-warning-normalization-platform-security-auditor.md`
7. `packages/bot-adapters/src/warnings.ts`
8. `apps/web/src/features/admin/health-detail.ts`
9. `apps/web/src/features/admin/bot-health-loader.ts`
10. `apps/web/src/features/admin/types.ts`
11. `apps/web/src/features/bots/data.tsx`
12. `apps/worker/src/jobs.ts`
13. `apps/worker/src/legacy-live.ts`
14. `tests/integration/admin-health-detail.test.ts`
15. `tests/integration/admin-bot-health-loader.test.ts`
16. `tests/integration/bot-read-safety-static.test.ts`
17. `tests/integration/legacy-live-worker-static.test.ts`
18. `tests/integration/legacy-provider-worker.test.ts`
19. `tests/integration/bot-readiness-server-dto-static.test.ts`
20. `tests/e2e/admin-mobile-pg8.spec.ts`
21. `tests/e2e/helpers/auth.ts`
22. `package.json`
23. `apps/web/package.json`

## Files changed
1. `apps/web/src/features/admin/health-detail.ts`
2. `apps/web/src/features/bots/data.tsx`
3. `apps/worker/src/legacy-live.ts`
4. `tests/integration/admin-health-detail.test.ts`
5. `tests/integration/admin-bot-health-loader.test.ts`
6. `tests/integration/bot-read-safety-static.test.ts`
7. `tests/integration/legacy-live-worker-static.test.ts`
8. `docs/handoffs/20260604-0029-bot-warning-normalization-backend-auditor.md`
9. `docs/handoffs/20260604-0029-bot-warning-normalization-ux-tests-auditor.md`
10. `docs/handoffs/20260604-0029-bot-warning-normalization-platform-security-auditor.md`
11. `docs/handoffs/20260604-0049-phase-3-85-bot-warning-normalization.md`

## Findings
1. Medium, fixed - Admin health projection accepted Legacy `warningCodes` only if they arrived as `warnings`, which could hide Legacy runtime warnings in admin bot/system-health tables. Evidence: `apps/web/src/features/admin/health-detail.ts` now allowlists `warningCodes`, merges `warnings` plus `warningCodes`, filters values through `isCanonicalWarningCode`, and emits only canonical `warnings`.
2. Medium, fixed - User DB read warnings were missing Legacy `no_trade_history` and Tortila signal codes from persisted health detail. Evidence: `apps/web/src/features/bots/data.tsx` now normalizes both `detail.warnings` and `detail.warningCodes`, maps through `TORTILA_WARNINGS` and `LEGACY_WARNINGS`, adds canonical `legacy_quarantined`, and dedupes by code.
3. Medium, fixed - Legacy retained health detail stored provider-origin `quarantineReasons` free-text arrays. Evidence: `apps/worker/src/legacy-live.ts` no longer writes `quarantineReasons` in the `legacy-bot` health detail; retained health warning evidence stays code/count based with `quarantinedCount` and `warningCodes`.
4. Medium, remaining - Admin bot fleet still relies mostly on static Tortila warnings and health-check JSON snippets rather than a polished warning summary card. Recommendation: next phase should add a first-class admin warning summary DTO/render, still using canonical codes only.
5. Medium, remaining - Cabinet/admin user bot detail warning summaries are not yet fed by the same normalizer. Recommendation: add scoped warning summaries without reading metric `rawJson` into admin user drilldowns.

## Decisions
1. Treated `packages/bot-adapters/src/warnings.ts` as the canonical registry for warning code validity and user-facing title/detail/severity.
2. Kept normalization server-side; no client-side inference, no live exchange ping, no live bot control, no provider DB access.
3. Canonical admin projection emits `warnings` only; `warningCodes` is consumed as input and removed from projected detail.
4. Unknown warning strings are dropped from admin warnings instead of rendered in redacted form.
5. Worker retained health detail is code/count-only for Legacy quarantine state; provider-origin quarantine text is not stored in `integration_health_checks.detail`.

## Risks
1. The worktree was already heavily dirty before Phase 3.85; this handoff only claims the scoped files listed above.
2. `apps/web/src/features/bots/data.tsx` already contained earlier Phase 3.84/adjacent user-scoping changes in the same file; Phase 3.85 only adds warning normalization on top of that current state.
3. Browser in-app auth could not be completed because the runtime blocked `fill`, `fetch`, and XHR; admin page verification was completed through the repo Playwright admin smoke instead.
4. Full `npm test`, lint, and build were not run in this slice because the focused verification plus typecheck/secret/governance/e2e gates were selected to match the changed risk surface.

## Verification/tests
RUN:
1. `npm exec -- vitest run tests/integration/admin-health-detail.test.ts tests/integration/admin-bot-health-loader.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/legacy-live-worker-static.test.ts tests/integration/legacy-provider-worker.test.ts tests/integration/bot-readiness-server-dto-static.test.ts` - pass, 6 files, 39 tests.
2. `npm run typecheck -w @wtc/web` - pass.
3. `npm run typecheck -w @wtc/worker` - pass.
4. `npm run secret:scan` - pass.
5. `npm run governance:check` - pass with 0 errors and 1 known historical warning: `20260529-1921-integration-risk-auditor.md` missing `## Files inspected`.
6. Browser in-app unauthenticated smoke for `http://localhost:3000/admin/bots` - redirected to `/login`, no runtime error, no console errors.
7. `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` - pass, 1 test; includes `/admin/bots` mobile render/no-horizontal-scroll coverage.

NOT RUN:
1. Full `npm test` - skipped for time/scope; focused warning/readiness/worker suites were run.
2. `npm run lint` - skipped; not part of this focused acceptance slice.
3. `npm run build` or `npm run build -w @wtc/web` - skipped; typecheck plus Playwright smoke covered the changed TypeScript/UI surface.
4. DB migrations/generation/seed commands - skipped; no schema change.
5. Worker tick/smoke - skipped to avoid live/provider mutation; worker changes were static/typechecked.
6. Live exchange ping or exchange key retest - skipped by policy.
7. Live bot start/stop/apply-config/retest - skipped by policy.
8. `.env`, vault open/decrypt, provider DB, SSH, tmux, and systemd actions - not run.
9. Git stage/commit/push/PR - not requested.

## Next actions
1. Add a shared package-level `warningsFromCodes(productCode, codes)` helper so admin/user/cabinet projections do not duplicate warning registry logic.
2. Add first-class admin warning summary DTOs for `/admin/bots` and `/admin/users/[userId]/bots`; keep raw metric `rawJson` out of user drilldown loaders.
3. Feed cabinet product cards from normalized warnings for both Tortila and Legacy, not Tortila-only static warnings.
4. Improve empty-state copy to distinguish "no warning codes reported", "warning snapshot unavailable", and "read blocked/not configured".
5. Add e2e/static acceptance for Legacy safety/statistics warning copy and admin warning summaries after those UI summary DTOs are implemented.
