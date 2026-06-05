# bot-stats-admin-security-auditor handoff
## Scope
Read-only security/runtime/admin-boundary audit for Phase 4.22 planning after Phase 4.21. Focus: current bot statistics and admin/user bot drilldown boundaries, with user statistics scoped to the signed-in user, admin selected-user/pub_id inspection read-only, no user personal-setting mutation in selected-user views, no raw secret/live-control leakage, entitlement/RBAC fail-closed behavior, scoped Legacy pub_id attribution, and runtime continuity boundaries.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260604-1549-phase-4-21-bot-settings-basic-path.md`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/` route tree; no `[bot]/statistics` route exists
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`

## Files changed
Only this requested handoff: `docs/handoffs/20260604-1555-bot-stats-admin-security-auditor.md`. No code or other docs changed.

## Findings
1. Severity P1 - User statistics can fall back to adapter data instead of failing closed to user-scoped DB snapshots outside production DB snapshot mode. Evidence: `apps/web/src/app/(app)/app/bots/statistics/page.tsx:226-232` calls `loadBotReadModelForUser(user.id, bot.code, ...)` only after entitlement, but `apps/web/src/features/bots/data.tsx:299-300` enables DB snapshot mode only in `NODE_ENV === 'production'` with non-mock mode, and `apps/web/src/features/bots/data.tsx:709-713` falls back to `loadAdapterBotReadModel(productCode, parts)` when DB snapshot mode is off or no DB model is returned. The adapter path then calls adapter health/metrics/positions/trades/config/warnings without a user id at `apps/web/src/features/bots/data.tsx:672-689`. Recommendation: for user-facing bot statistics/dashboard pages, make real/read-only runtime data fail closed to DB user/bot-instance/provider scope whenever adapter mode is not explicit mock preview; expose adapter-only reads only on clearly labelled demo/internal surfaces. Add a regression proving `/app/bots/statistics` cannot show global adapter stats as "my" stats when no user-owned bot instance/snapshot exists. Target part: user bot read model and statistics route.
2. Severity P1 - Admin selected-user Legacy drilldown does not enforce an exact-one active provider pub_id mapping before attaching provider-scoped stats. Evidence: the user-facing DB loader blocks Legacy runtime facts unless exactly one active provider account is mapped (`apps/web/src/features/bots/data.tsx:451-478`), but the admin selected-user loader loads all provider rows for the user (`apps/web/src/features/admin/user-bot-detail-loader.ts:931-945`), then stores only the first active row per bot instance (`apps/web/src/features/admin/user-bot-detail-loader.ts:1066-1070`) and passes that single id into `buildAdminBotStats` (`apps/web/src/features/admin/user-bot-detail-loader.ts:1103-1107`). `buildAdminBotStats` then scopes rows to that chosen id (`apps/web/src/features/admin/user-bot-detail-loader.ts:788-805`, `apps/web/src/features/admin/user-bot-detail-loader.ts:830-848`). Recommendation: mirror the user loader's exact-one rule in the admin selected-user loader; when zero or multiple active Legacy mappings exist for the selected user's bot instance, show provider scope as pending/ambiguous and suppress Legacy stats/warnings instead of picking the newest active mapping. Add DB and E2E fixtures with two active mappings for the same selected user. Target part: admin selected-user bot detail loader and tests.
3. Severity P2 - Selected-user admin runtime health is product-global, so the page can overstate runtime continuity for a user/pub_id. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:950-960` fetches the latest `integrationHealthChecks` row by target only (`tortila-journal` or `legacy-bot`), `apps/web/src/features/admin/user-bot-detail-loader.ts:1072-1081` maps that into `healthByProduct`, and `apps/web/src/features/admin/user-bot-detail-loader.ts:1104` assigns `runtimeHealthSummary(productCode, healthByProduct.get(productCode)...)` to every selected user's bot summary. The UI presents that near selected-user runtime scope and statistics (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:178-196`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:494-516`). Recommendation: label these health rows as fleet/runtime-health evidence unless the health detail or snapshot row carries the selected `botInstanceId` or exact Legacy provider-account id; do not let product-global health mark selected-user statistics as fresh/green on its own. Target part: admin runtime health DTO and selected-user evidence ladder.
4. Severity P2 - Coverage mostly protects selected-user admin read-only/no-secret behavior, but the missing ambiguous-mapping and user-stat adapter-fallback cases leave the highest-risk boundaries untested. Evidence: static tests assert selected-user page has no forms/actions/live-control words and no raw secret imports (`tests/integration/admin-user-bot-detail-static.test.ts:67-132`, `tests/integration/admin-user-bot-detail-static.test.ts:166-179`); E2E hides cross-user/raw/secret markers and verifies no forms/buttons (`tests/e2e/admin-user-bot-detail-db.spec.ts:113-163`, `tests/e2e/admin-user-bot-detail-db.spec.ts:177-229`); bot statistics static tests assert safe loader usage but only by string match (`tests/integration/bot-statistics-static.test.ts:32-40`). Recommendation: add behavioral tests, not only static grep, for exact-one Legacy admin mapping, user stats no-global-fallback, and product-global health not being treated as selected-user freshness proof. Target part: integration/E2E gates for Phase 4.22.

## Decisions
- Treated this as a single assigned read-only auditor session. No background agents were launched per operator instruction.
- Did not run live provider/exchange/bot calls, DB migrations/seeds, deploy, SSH/tmux, or live-control commands.
- Did not run test commands because the audit was constrained to read-only inspection except the requested handoff.
- Considered raw exchange/API secrets, sealed key rows, raw config/trade JSON, live-control verbs, user/pub_id scoping, and entitlement/RBAC as the priority evidence classes.

## Risks
- The worktree was already heavily dirty before this audit, including modified and untracked files across the audited surfaces; this handoff reports current disk state only and does not imply a clean baseline.
- The admin selected-user loader masks provider account IDs before rendering, but the fleet admin page still displays raw Legacy `pubId` as an admin operational identifier. That appears intentional for admin pub_id selection, but Phase 4.22 should keep raw pub_id out of ordinary user pages and continue masking in selected-user detail where possible.
- Product-global runtime health can be useful operational context, but it is unsafe as sole selected-user freshness proof until worker health/snapshot provenance carries selected bot instance or provider-account scope.

## Verification/tests
RUN:
- `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with heavy pre-existing dirty/untracked state.
- Read-only file inspection with `rg`, `Get-ChildItem`, and numbered `Get-Content` for the required files and related tests.

NOT RUN:
- `npm run typecheck`, `npm run lint`, `npm run build`, `node scripts/gates.mjs ...`, `npm run secret:scan`, Playwright, Vitest - skipped because this was a read-only audit and no verification gate was requested; running tests may write artifacts.
- `npm run db:generate`, `npm run db:migrate`, `npm run db:seed` - forbidden/out of scope.
- Live bot start/stop/apply-config, live exchange/provider calls, live exchange ping, deploy/SSH/tmux - forbidden/out of scope.

## Next actions
1. In Phase 4.22 implementation, harden `loadBotReadModelForUser` so user-facing statistics fail closed to user-owned DB snapshots for real/read-only modes; keep adapter-only reads for explicit mock/demo/internal surfaces.
2. Make admin selected-user Legacy stats enforce exact-one active provider-account mapping before attaching provider-scoped stats, warnings, or runtime evidence.
3. Split selected-user runtime health into "fleet health" versus "selected bot/provider freshness" and only mark selected-user evidence green when the proof is scoped.
4. Add focused integration/E2E coverage for no user-stat global fallback, ambiguous Legacy mappings, no selected-user forms/actions, no raw secret/raw JSON leakage, and runtime-health scope labels.
