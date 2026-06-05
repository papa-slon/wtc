# Phase 3.72 Legacy provider ingestion and admin mapping handoff
## Scope
Implemented the next non-live slice toward finishing the Legacy averaging bot safely: WTC now has a provider-account-scoped Legacy worker ingestion path, an admin-only Legacy `pub_id` mapping/disable foundation, a DB uniqueness guard for one active Legacy provider account per bot instance/provider, provider-account-scoped admin user drilldown metrics, and focused tests/gates proving the new ownership path.

This phase did not start, stop, restart, retest, apply config to, live-probe, SSH into, tmux/systemd-control, or mutate any live bot/provider/exchange service. Legacy live control remains disabled. Provider DB reads were not run; worker ingestion was verified with synthetic safe rows and WTC PGlite DB fixtures.

Read-only agents dispatched before edits and closed before final report:
- `docs/handoffs/20260603-1815-legacy-provider-worker-db-auditor.md`
- `docs/handoffs/20260603-1815-legacy-provider-security-rbac-auditor.md`
- `docs/handoffs/20260603-1815-legacy-provider-ux-product-auditor.md`
- `docs/handoffs/20260603-1815-legacy-provider-tests-auditor.md`

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1758-phase-3-71-legacy-provider-account-scope.md`
- `docs/handoffs/20260603-1815-legacy-provider-worker-db-auditor.md`
- `docs/handoffs/20260603-1815-legacy-provider-security-rbac-auditor.md`
- `docs/handoffs/20260603-1815-legacy-provider-ux-product-auditor.md`
- `docs/handoffs/20260603-1815-legacy-provider-tests-auditor.md`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/index.ts`
- `apps/worker/package.json`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0019_freezing_beyonder.sql`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/legacy-live-worker-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `package.json`

## Files changed
- `apps/worker/src/legacy-live.ts`
- `apps/worker/package.json`
- `apps/worker/tsconfig.json`
- `package.json`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0019_freezing_beyonder.sql`
- `packages/db/migrations/meta/_journal.json`
- `packages/db/migrations/meta/0019_snapshot.json`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `docs/handoffs/20260603-1830-phase-3-72-legacy-provider-ingestion-admin-mapping.md`

## Findings
1. Severity: Critical. The Phase 3.71 ownership primitive existed, but the actual Legacy worker still wrote unscoped fleet/system snapshots. Recommendation implemented: `snapshotLegacyBotPostgres()` now lists active `legacy_bot` / `legacy-db` mappings, reads one mapped `providerAccountId` / `pub_id` at a time, and writes scoped metric/position snapshots through `snapshotLegacyRowsToWtc()`.

2. Severity: Critical. Admin user drilldown could pick latest Legacy metric rows by bot instance only, so newer null/fleet rows could outrank user-owned provider-account rows. Recommendation implemented: Legacy admin detail metrics are now accepted only when their `bot_provider_account_id` matches the active mapping.

3. Severity: High. The DB did not enforce exactly one active provider account per bot instance/provider. Recommendation implemented: migration `0019_freezing_beyonder.sql` adds partial unique index `bpa_active_instance_provider_idx`.

4. Severity: High. Disable-by-id needed target ownership validation. Recommendation implemented: `disableBotProviderAccountMapping()` accepts `userId` and refuses mismatched mappings before updating/auditing.

5. Severity: High. Admin mapping controls did not exist. Recommendation implemented: `/admin/users/[userId]/bots` now has admin-only Legacy `pub_id` map and disable forms wired to CSRF/admin/Zod/repository actions. These actions write only `bot_provider_accounts`; they do not edit user `bot_configs`, exchange keys, live bot config, starts/stops, or open positions.

6. Severity: Medium. Worker source had no workspace typecheck gate. Recommendation implemented: `apps/worker/tsconfig.json`, `@wtc/worker` `typecheck` script, and root `ci:local` now include `npm run typecheck -w @wtc/worker`.

## Decisions
1. Provider `pub_id` mapping is an admin/system ownership primitive, not the user's personal strategy config.
2. Legacy runtime user facts must be scoped by exactly one active WTC provider-account mapping; zero, multiple, null, disabled, or mismatched rows fail closed for user-owned views.
3. Existing null `bot_provider_account_id` rows remain fleet/canary diagnostics and are not user-owned runtime evidence.
4. The old system-owner Legacy snapshot path remains only as fleet diagnostics fallback when no active provider-account mappings exist and system owner env is configured.
5. This phase intentionally avoids live Legacy provider DB proof. The verified behavior is WTC-side ingestion/write/read logic over safe synthetic rows.

## Risks
1. A mapping marked active is still an admin assertion, not cryptographic/provider-verified ownership. Richer proof fields such as `verified_at`, `verified_by`, `claim_source`, `last_seen_at`, and `disabled_reason` are still needed before final production onboarding.
2. Legacy worker still writes metric and position snapshots only. Closed-trade history remains honestly unavailable until a safe provider trade source exists; safety-event insertion for quarantines/risk signals can be added later with dedupe.
3. `/admin/bots` fleet diagnostics can still show full Legacy `pub_id` values from fleet snapshots. A later mask/reveal/audit slice should handle that.
4. DB-backed Playwright for mapped/pending admin states is still not implemented; current browser coverage is local demo/mock route rendering plus focused DB/Vitest proof.
5. No live bot continuity proof was collected in this phase because live bot control and provider probing remain out of scope.

## Verification/tests
RUN:
1. `npx vitest run tests/integration/legacy-provider-worker.test.ts tests/integration/legacy-live-worker-static.test.ts` - PASS, 7 tests.
2. `npx vitest run tests/integration/legacy-provider-worker.test.ts tests/integration/legacy-live-worker-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts` - PASS, 14 tests.
3. `npm run typecheck` - PASS.
4. `npm run typecheck -w @wtc/web` - PASS.
5. `npm run typecheck -w @wtc/worker` - PASS.
6. `npm run check:core` - PASS.
7. `npm run lint` - PASS.
8. `npm run secret:scan` - PASS.
9. `npm run governance:check` before this aggregate - PASS, 0 errors and 1 known historical warning.
10. `npm run db:generate -w @wtc/db` - PASS; generated migration `0019_freezing_beyonder.sql`.
11. `npm run build -w @wtc/web` - PASS; route table includes `/admin/users/[userId]/bots`.
12. `npx playwright test tests/e2e/bot-settings.spec.ts tests/e2e/admin-mobile-pg8.spec.ts --project=desktop --project=mobile` - PASS, 3 passed and 1 expected project skip.
13. `npm test` - PASS, 110 files passed, 966 tests passed, 10 skipped. The LMS artifact scanner "failed" lines are intentional negative fixture assertions with exit code 0.
14. `git diff --check` - PASS.

NOT RUN:
1. Live Legacy provider DB query / `LEGACY_DATABASE_URL` worker tick - not run by phase safety scope.
2. Managed/live DB migrations or deploy proof - not run by phase safety scope.
3. Legacy/Tortila start, stop, restart, retest, apply-config, live exchange ping, SSH, tmux, systemd, `.env` reads/mutations - forbidden and not run.
4. DB-backed Playwright mapped/pending provider-account state - not implemented in this slice.
5. Production burn-in/monitoring and live bot continuity proof - not run.

## Next actions
1. Add richer provider-account verification metadata or a separate proof table before treating active mappings as production-grade onboarding.
2. Add Legacy worker safety-event rows for real quarantine/risk signals with dedupe and `botProviderAccountId`.
3. Add DB-backed Playwright for mapped/pending Legacy provider states in admin drilldown and user settings/export.
4. Fix the remaining UX clarity gaps: configuration source band, default/custom/provider chips, and zero-mapping cards that never imply "1 pub_id".
5. Mask or audited-reveal full `pub_id` values in broad `/admin/bots` fleet diagnostics.
6. In a later approved live/managed phase, run the worker against intended environment credentials without touching bot control paths, then collect live continuity evidence.
