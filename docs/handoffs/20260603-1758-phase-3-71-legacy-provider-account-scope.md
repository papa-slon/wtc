# Phase 3.71 Legacy provider-account scope handoff
## Scope
Implemented the next safety spine for finishing Legacy averaging bot UX honestly: WTC now has a normalized provider-account mapping primitive for Legacy `pub_id` ownership, admin target-user drilldown can show mapped vs pending provider-account state, and production user bot reads are no longer allowed to read latest product-level DB snapshots without a user-owned bot instance and, for Legacy, exactly one active mapped provider account.

This phase did not start, stop, restart, retest, apply config to, or live-probe any bot. It did not run worker ticks or query the live Legacy provider DB.

Read-only agents dispatched before edits and closed before final report:
- `docs/handoffs/20260603-legacy-provider-account-db-auditor.md`
- `docs/handoffs/20260603-legacy-provider-account-security-auditor.md`
- `docs/handoffs/20260603-legacy-provider-account-integration-auditor.md`
- `docs/handoffs/20260603-legacy-provider-account-ux-tests-auditor.md`

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md`
- `docs/handoffs/20260603-legacy-provider-account-db-auditor.md`
- `docs/handoffs/20260603-legacy-provider-account-security-auditor.md`
- `docs/handoffs/20260603-legacy-provider-account-integration-auditor.md`
- `docs/handoffs/20260603-legacy-provider-account-ux-tests-auditor.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0017_funny_gambit.sql`
- `packages/db/migrations/0018_provider_snapshot_scope.sql`
- `packages/audit/src/audit.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/bots/journal.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `packages/audit/src/audit.test.ts`

## Files changed
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0017_funny_gambit.sql`
- `packages/db/migrations/0018_provider_snapshot_scope.sql`
- `packages/db/migrations/meta/_journal.json`
- `packages/db/migrations/meta/0017_snapshot.json`
- `packages/db/migrations/meta/0018_snapshot.json`
- `packages/audit/src/audit.ts`
- `packages/audit/src/__smoke__.ts`
- `packages/audit/src/audit.test.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/journal.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `docs/handoffs/20260603-1758-phase-3-71-legacy-provider-account-scope.md`

## Findings
1. Severity: Critical. User-facing production bot reads were product-scoped, so a user with entitlement could receive latest product-level Legacy/Tortila DB snapshots. Evidence: all four read-only agents independently flagged this, and `apps/web/src/features/bots/data.tsx` previously selected snapshots by `bot_instances.product_code`. Recommendation implemented: user pages now call `loadBotReadModelForUser(user.id, productCode, parts)`.

2. Severity: Critical. Legacy `pub_id` ownership was not durable. Evidence: `bot_instances` was user/product scoped, but Legacy provider account identity lived only inside raw snapshot JSON. Recommendation implemented: added `bot_provider_accounts` plus repository map/update/disable primitives and audit actions.

3. Severity: High. Snapshot rows needed provider-account linkage, otherwise old fleet rows could be mistaken for user rows later. Recommendation implemented: nullable `bot_provider_account_id` was added to metric, position, trade, and safety snapshot tables. Existing null rows remain fleet/canary/system rows and are excluded from user Legacy reads.

4. Severity: High. Admin target-user drilldown needed mapped/pending state, not a permanent vague fleet warning. Recommendation implemented: the loader reads safe provider-account fields for the target user only, and the page renders provider account mapped/pending without edit controls.

5. Severity: High. Legacy config export could use an unscoped provider runtime snapshot. Recommendation implemented: the export route calls `loadBotReadModelForUser`; if the Legacy provider mapping is missing or ambiguous it returns `403 provider_mapping_required` instead of exporting provider live config.

6. Severity: High. New repository audit actions were not registered in `@wtc/audit`. Recommendation implemented: added `bot.provider_account.map`, `bot.provider_account.update`, and `bot.provider_account.disable` to the audit action registry and tests.

## Decisions
1. Legacy `Api_Key.pub_id` is modeled as text in WTC under `bot_provider_accounts.provider_account_id`; it is provider identity, not a WTC user id.
2. Production DB snapshots for user pages require a current WTC user scope. The adapter-only `loadBotReadModel()` remains as a demo/internal fallback and no longer reads product-level DB snapshots.
3. For Legacy production reads, exactly one active mapping is required for the user's Legacy bot instance. Zero or multiple active mappings fail closed.
4. Existing worker aggregate/system-owner Legacy snapshots remain fleet/canary diagnostics. They are not user-owned evidence because their new `bot_provider_account_id` is null.
5. This phase does not introduce admin mapping UI/actions yet. Repository primitives exist, but live admin map/update/disable forms need a separate RBAC/CSRF/Zod/audit UX slice.

## Risks
1. The Legacy worker still does not iterate active provider-account mappings. Until that lands, user-scoped Legacy live data will correctly show mapping/snapshot-required states rather than runtime facts.
2. Provider-account mapping lacks richer proof fields (`verified_at`, `verified_by`, `claim_source`, `provider_user_ref_hash`, `disabled_reason`, `last_seen_at`). The current primitive is enough to stop cross-user reads, not enough for final production onboarding.
3. Admin `/admin/bots` remains fleet diagnostics and can still show full provider `pub_id` values from latest raw fleet snapshots. That requires a later mask/reveal/audit slice.
4. Legacy unsupported analytics still need a capability/null mask across user/admin statistics so unavailable PnL/win-rate/drawdown cannot look like real zeros.
5. Managed/live DB gates are still outside this phase. No live bot continuity proof was collected here because this phase deliberately avoided live bot control and live provider DB access.

## Verification/tests
RUN:
1. `npx vitest run tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts` - PASS, 5 tests.
2. `npx vitest run packages/audit/src/audit.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts` - PASS, 11 tests.
3. `npm run check:core` - PASS.
4. `npm run typecheck` - PASS.
5. `npx vitest run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts packages/audit/src/audit.test.ts` - PASS, 34 tests.
6. `npm run typecheck -w @wtc/web` - PASS.
7. `npm run lint` - PASS.
8. `npm run secret:scan` - PASS.
9. `npm run governance:check` - PASS, 0 errors and 1 known historical warning for `docs/handoffs/20260529-1921-integration-risk-auditor.md`.
10. `git diff --check` - PASS.
11. `npm run build -w @wtc/web` - PASS.
12. `npm test` - PASS, 109 files passed, 962 tests passed, 10 skipped. The LMS DB e2e artifact messages are expected fail-closed fixture assertions with exit code 0.
13. `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` - PASS, 1 test.
14. `npx playwright test tests/e2e/bot-settings.spec.ts --project=desktop --project=mobile` - PASS, 2 tests.

NOT RUN:
1. Worker tick / managed DB / live DB migrations / deploy proof - not run by policy and scope.
2. Legacy/Tortila start, stop, restart, retest, apply-config, live exchange ping, provider DB query - not run and remain forbidden in this phase.

## Next actions
1. Refactor `apps/worker/src/legacy-live.ts` to iterate active verified `bot_provider_accounts`, query one `pub_id` at a time, and write `bot_provider_account_id` on metric/position/safety rows.
2. Add admin provider-account map/update/disable UI with CSRF, `assertAdmin`, Zod validation, reason capture, duplicate-claim handling, and in-transaction audit.
3. Add richer ownership-proof fields or an equivalent proof table before production provider-account onboarding.
4. Add a Legacy capability mask so unavailable closed-trade/equity/PnL metrics render as N/A/null, not zero-like values.
5. Mask full `pub_id` in broad `/admin/bots` diagnostics or add audited reveal/inspect.
6. Run the next implementation slice with fresh read-only agents before edits: Legacy worker per-provider-account ingestion, then admin map/update/disable UI and capability/null masks.
