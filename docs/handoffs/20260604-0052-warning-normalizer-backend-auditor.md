# warning-normalizer-backend-auditor handoff
## Scope
Read-only backend/platform audit for Phase 3.86. The goal was to identify the best shared package-level warning normalizer API for bot warning codes after Phase 3.85, using the current `@wtc/bot-adapters` warning registry and current consumers in user bot read models, admin health projection, cabinet cards, and admin user bot detail loaders.

No product code, test code, live bot controls, worker ticks, `.env`, secrets, provider DBs, SSH, tmux, or systemd paths were read or mutated. The worktree was already heavily dirty before this audit; this handoff is the only file changed by this auditor.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0049-phase-3-85-bot-warning-normalization.md`
8. `packages/bot-adapters/src/warnings.ts`
9. `packages/bot-adapters/src/index.ts`
10. `packages/bot-adapters/src/types.ts`
11. `packages/bot-adapters/package.json`
12. `tsconfig.base.json`
13. `apps/web/src/features/bots/data.tsx`
14. `apps/web/src/features/admin/health-detail.ts`
15. `apps/web/src/features/admin/bot-health-loader.ts`
16. `apps/web/src/features/admin/user-bot-detail-loader.ts`
17. `apps/web/src/features/admin/types.ts`
18. `apps/web/src/features/cabinet/loader.ts`
19. `packages/cabinet/src/derive.ts`
20. `packages/cabinet/src/derive.test.ts`
21. `apps/web/src/app/admin/bots/page.tsx`
22. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
23. `apps/worker/src/jobs.ts`
24. `apps/worker/src/legacy-live.ts`
25. `packages/bot-adapters/src/adapters.test.ts`
26. `tests/integration/admin-health-detail.test.ts`
27. `tests/integration/admin-bot-health-loader.test.ts`
28. `tests/integration/bot-read-safety-static.test.ts`
29. `tests/integration/cabinet-pg9.test.ts`
30. `tests/integration/admin-user-bot-detail-loader.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. The shared API should live in `packages/bot-adapters/src/warnings.ts`, not in `apps/web`, `@wtc/shared`, or `@wtc/cabinet`. Evidence: `packages/bot-adapters/src/warnings.ts:12` to `packages/bot-adapters/src/warnings.ts:31` owns canonical codes and code validation, while `packages/bot-adapters/src/types.ts:7` and `packages/bot-adapters/src/types.ts:12` define the product and warning DTO types. Current consumers duplicate parser/projection logic in `apps/web/src/features/bots/data.tsx:185` to `apps/web/src/features/bots/data.tsx:249` and `apps/web/src/features/admin/health-detail.ts:65` to `apps/web/src/features/admin/health-detail.ts:98`. Recommendation: add pure exports in `packages/bot-adapters/src/warnings.ts`, then re-export them from `packages/bot-adapters/src/index.ts:15` to `packages/bot-adapters/src/index.ts:23`. Target part: shared warning DTO/projection.
2. Severity: High. `legacy_quarantined` has a canonical code but no package-owned `RiskWarning` definition, forcing app-local copy and risking drift. Evidence: the code is canonical at `packages/bot-adapters/src/warnings.ts:20` to `packages/bot-adapters/src/warnings.ts:24`, but `LEGACY_WARNINGS` stops at `no_trade_history` at `packages/bot-adapters/src/warnings.ts:59` to `packages/bot-adapters/src/warnings.ts:68`; the user DB loader defines the missing copy locally at `apps/web/src/features/bots/data.tsx:189` to `apps/web/src/features/bots/data.tsx:197`. Recommendation: add a package-owned warning definition map for every canonical code, including conditional runtime codes, but do not simply append `legacy_quarantined` to `LEGACY_WARNINGS` because mock/blocked Legacy adapters currently return `LEGACY_WARNINGS` as their always-on baseline. Target part: `packages/bot-adapters/src/warnings.ts`.
3. Severity: High. The best API shape is product-aware code extraction plus product-aware warning materialization. Evidence: worker inputs arrive as Tortila `warnings` code arrays at `apps/worker/src/jobs.ts:123` and `apps/worker/src/jobs.ts:240`, Legacy `warningCodes` at `apps/worker/src/legacy-live.ts:581` and `apps/worker/src/legacy-live.ts:631`, and adapter calls return `RiskWarning[]` objects per `packages/bot-adapters/src/types.ts:52` and `packages/bot-adapters/src/types.ts:77` to `packages/bot-adapters/src/types.ts:79`. Recommendation: add helpers such as `warningCodesFromUnknown(...values: unknown[]): WarningCode[]`, `warningsFromCodes(productCode: BotProductCode, values: unknown, options?: { includeStatic?: boolean }): RiskWarning[]`, and `warningSummaryFromWarnings(warnings: readonly RiskWarning[]): { count: number; maxSeverity: WarningSeverity | null }`. The extractor should accept strings and `{ code: string }` objects, trim, canonical-filter, product-filter, de-dupe in input order, and stay TypeScript strip-friendly with `as const` objects, no enums, no zod, and no web imports. Target part: package-level normalizer API.
4. Severity: Medium. `apps/web/src/features/bots/data.tsx` is the highest-value first consumer because it currently owns the largest duplicated normalizer. Evidence: `dbWarnings`, `LEGACY_RUNTIME_WARNINGS`, product code sets, `DB_WARNING_BY_CODE`, `warningCodeStrings`, `warningCodesFromDetail`, `uniqueWarnings`, and `dbWarningsFromDetail` span `apps/web/src/features/bots/data.tsx:185` to `apps/web/src/features/bots/data.tsx:249`, then feed `healthFromDb` at `apps/web/src/features/bots/data.tsx:292` to `apps/web/src/features/bots/data.tsx:302` and user warnings at `apps/web/src/features/bots/data.tsx:342` to `apps/web/src/features/bots/data.tsx:343`. Recommendation: replace those local helpers with `warningsFromCodes(productCode, [detail.warnings, detail.warningCodes], { includeStatic: productCode === 'tortila_bot' })`, preserving Tortila persistent P0/P1 defaults and Legacy runtime-only `legacy_quarantined`. Target part: user dashboard, safety, statistics, and bot list read model.
5. Severity: Medium. Admin health projection is already code-only and redacted, but it should delegate code parsing to the same package helper. Evidence: `projectHealthDetail` allowlists `warningCodes` and `warnings` at `apps/web/src/features/admin/health-detail.ts:37` to `apps/web/src/features/admin/health-detail.ts:38`, parses them locally at `apps/web/src/features/admin/health-detail.ts:65` to `apps/web/src/features/admin/health-detail.ts:83`, and removes `warningCodes` after projection at `apps/web/src/features/admin/health-detail.ts:96` to `apps/web/src/features/admin/health-detail.ts:98`. Recommendation: replace local `warningStrings`/`mergeWarnings` with the shared extractor. If product-specific filtering is required, change `projectHealthDetail(detail)` to accept an optional target/product hint and update callers in `apps/web/src/features/admin/bot-health-loader.ts:177`, `apps/web/src/features/admin/bot-health-loader.ts:188`, and `apps/web/src/features/admin/bot-health-loader.ts:292`. Target part: admin system health and admin bot health tables.
6. Severity: Medium. Cabinet warnings are still Tortila-only static summaries, so the shared helper should also provide summary derivation. Evidence: cabinet imports `TORTILA_WARNINGS` at `apps/web/src/features/cabinet/loader.ts:23`, computes only `tortilaWarningsSummary` at `apps/web/src/features/cabinet/loader.ts:67` to `apps/web/src/features/cabinet/loader.ts:72`, and assigns warnings only for `tortila_bot` at `apps/web/src/features/cabinet/loader.ts:115`; `@wtc/cabinet` already accepts a generic warning summary at `packages/cabinet/src/derive.ts:31` to `packages/cabinet/src/derive.ts:34` and gates it fail-closed at `packages/cabinet/src/derive.ts:227` to `packages/cabinet/src/derive.ts:228`. Recommendation: change `apps/web/src/features/cabinet/loader.ts` to derive owned-product warning summaries for both bot products from `warningsFromCodes`/`warningSummaryFromWarnings`, while keeping the existing `decision.allowed` gate at `apps/web/src/features/cabinet/loader.ts:162` to `apps/web/src/features/cabinet/loader.ts:163`. Target part: user cabinet notice counts.
7. Severity: Medium. Admin user bot detail has no per-bot warning DTO, so the normalizer cannot be consumed there without a type change. Evidence: `AdminUserBotSummary` has metrics, positions, trades, equity, stats source, and provider scope but no warning field at `apps/web/src/features/admin/types.ts:135` to `apps/web/src/features/admin/types.ts:155`; `loadAdminUserBotDetailFromDb` selects metric/position/trade rows at `apps/web/src/features/admin/user-bot-detail-loader.ts:779` to `apps/web/src/features/admin/user-bot-detail-loader.ts:853` and returns bot summaries at `apps/web/src/features/admin/user-bot-detail-loader.ts:899` to `apps/web/src/features/admin/user-bot-detail-loader.ts:933`; the admin page renders metrics and stats scope at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:245` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:268` but no warning/status summary. Recommendation: add a secret-free `warningSummary` or `warnings: RiskWarning[]` DTO field in `apps/web/src/features/admin/types.ts`, populate it in `loadAdminUserBotDetailFromDb` without selecting metric `rawJson`, and render canonical labels/counts on `apps/web/src/app/admin/users/[userId]/bots/page.tsx`. Target part: admin user bot drilldown.

## Decisions
1. Recommended package owner: `@wtc/bot-adapters`, because it already owns `BotProductCode`, `RiskWarning`, canonical codes, adapter warnings, and the no-live-control boundary.
2. Recommended API: a small pure normalizer in `packages/bot-adapters/src/warnings.ts` with three responsibilities only: extract canonical warning codes from unknown worker/adapter shapes, map product-allowed codes to package-owned `RiskWarning` DTOs, and summarize warnings for compact UI DTOs.
3. Keep `LEGACY_WARNINGS` as the always-on Legacy adapter baseline unless the product decision changes. Add `legacy_quarantined` as a package-owned definition for materialization from persisted runtime codes, not as an unconditional adapter warning.
4. Keep full `RiskWarning` rendering out of arbitrary health detail JSON unless the row is explicitly being projected into a warning summary. `projectHealthDetail` can continue emitting a canonical code array, while higher-level admin DTOs can render titles/details from `warningsFromCodes`.
5. Do not read metric `rawJson` in admin user drilldowns just to recover warnings. Use integration-health warning codes or explicit future warning DTO columns/summaries, scoped by user bot instance/provider mapping.

## Risks
1. Cross-product leakage: a product-unaware extractor would accept any canonical code on any target. The materializer should filter by product, and `projectHealthDetail` needs either generic code-only behavior or a target/product hint.
2. Legacy false positives: moving `legacy_quarantined` into `LEGACY_WARNINGS` would make every mock/blocked Legacy adapter appear quarantined. Use a definition map plus product-specific runtime materialization instead.
3. Cabinet data minimization: cabinet warning summaries must remain inside the allowed-product signal branch; otherwise unentitled products could expose operational state.
4. Admin user detail scope: Legacy warnings must respect the active provider-account mapping. If no mapping exists, the page should say warnings were not evaluated for that user, not "clear".
5. Test brittleness: existing static tests assert private helper names such as `warningCodesFromDetail` and `mergeWarnings`; after centralizing, those tests should assert shared-helper imports and behavior instead of exact old function names.

## Verification/tests
RUN:
1. Read-only source inspection of the files listed above.
2. `git status --short --branch` - observed pre-existing dirty/untracked worktree before writing this handoff.

NOT RUN:
1. Vitest - read-only audit only; no product/test code changed.
2. Typecheck, lint, build, Playwright/e2e, DB migration/generation/seed - skipped because this phase was scoped to audit/handoff only.
3. Worker tick/smoke, live bot start/stop/apply-config/retest, provider DB reads, `.env`, secrets, SSH, tmux, systemd - skipped by policy.

Focused tests recommended for the implementation slice:
1. Add/extend `packages/bot-adapters/src/adapters.test.ts` or a new `packages/bot-adapters/src/warnings.test.ts` for `warningCodesFromUnknown`, `warningsFromCodes`, product filtering, de-dupe order, `{ code }` object inputs, unknown-code dropping, `no_trade_history`, and conditional `legacy_quarantined`.
2. Update `tests/integration/admin-health-detail.test.ts` to assert shared-helper behavior for mixed `warnings`/`warningCodes`, secret-shaped unknown strings, and no `warningCodes` output.
3. Update `tests/integration/bot-read-safety-static.test.ts` to assert the user read model imports/uses the package normalizer rather than private app-local helpers.
4. Update `tests/integration/cabinet-pg9.test.ts` or `packages/cabinet/src/derive.test.ts` to cover Legacy owned-product notice count through a normalized summary while preserving the not-allowed fail-closed warning gate.
5. Extend `tests/integration/admin-user-bot-detail-loader.test.ts` to prove the new admin user warning DTO is scoped, secret-free, does not read metric `rawJson`, and distinguishes mapped Legacy warnings from not-evaluated state.
6. Keep Phase 3.85 focused regression set as the smoke bundle: `tests/integration/admin-health-detail.test.ts`, `tests/integration/admin-bot-health-loader.test.ts`, `tests/integration/bot-read-safety-static.test.ts`, `tests/integration/legacy-live-worker-static.test.ts`, and `tests/integration/admin-user-bot-detail-loader.test.ts`.

## Next actions
1. Implement package helpers in `packages/bot-adapters/src/warnings.ts` and export them from `packages/bot-adapters/src/index.ts`.
2. Replace app-local warning parsing in `apps/web/src/features/bots/data.tsx` with the package helper while preserving Tortila persistent defaults and Legacy conditional runtime codes.
3. Replace admin health local parsing in `apps/web/src/features/admin/health-detail.ts`; decide whether `projectHealthDetail` needs an optional target/product hint before rendering product-specific summaries.
4. Replace cabinet Tortila-only warning summary in `apps/web/src/features/cabinet/loader.ts` with normalized summaries for owned bot products only.
5. Add warning DTO fields to `apps/web/src/features/admin/types.ts`, populate them in `apps/web/src/features/admin/user-bot-detail-loader.ts`, and render them in `apps/web/src/app/admin/users/[userId]/bots/page.tsx`.
6. Run the focused tests above plus `npm run typecheck -w @wtc/web` and `npm run secret:scan` before any aggregate Phase 3.86 acceptance claim.
