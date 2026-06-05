# admin-user-resolved-source-platform-auditor handoff
## Scope
Read-only Phase 3.78 platform/data audit for adding resolved bot config source visibility to the admin selected-user bot drilldown at `/admin/users/[userId]/bots`.

Audit focus: whether the admin drilldown can show the same resolved source model introduced in Phase 3.77: user override -> published/applying system default -> built-in fallback, without mutating live bots, provider DBs, worker state, exchange connections, secrets, or user settings.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-2106-phase-3-77-user-resolved-bot-config-source.md`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/bots/config.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `packages/db/migrations/0020_*.sql`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/user-resolved-bot-config-static.test.ts`
- `tests/integration/user-resolved-bot-config-db.test.ts`
- `tests/integration/admin-global-bot-config-db.test.ts`
- `tests/integration/admin-global-bot-config-static.test.ts`

## Files changed
None — read-only audit

## Findings
1. Severity: High. The admin selected-user bot loader still projects only saved user `bot_configs`; it does not resolve inherited system defaults or built-in fallback for the admin drilldown. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:538-548` selects only `schema.botConfigs` for existing user bot instances; `apps/web/src/features/admin/user-bot-detail-loader.ts:656-678` passes only that saved row into `mapConfigSummary`; `apps/web/src/features/admin/user-bot-detail-loader.ts:256-260` returns `null` when no saved row exists. In contrast, the user-facing resolver already loads published defaults and falls back safely at `apps/web/src/features/bots/config.ts:884-939`, using the published-only DB boundary at `packages/db/src/repositories.ts:1853-1860`. Recommendation: add an admin-safe resolved config summary path that fetches published global defaults for `tortila_bot` and `legacy_bot`, validates them with the product config schema, and computes `user_override | system_default | built_in` before rendering. Target part: `loadAdminUserBotDetailFromDb` data access and config summary builder.
2. Severity: High. A user's explicit `Use system default` marker would be summarized as a saved user strategy instead of resolving to the actual admin-published default. Evidence: `apps/web/src/features/bots/config.ts:762-783` defines the marker payload with `__wtcBotConfigSource`, `globalConfigId`, and `selectedGlobalVersion`; `apps/web/src/features/bots/config.ts:959-972` persists that marker through `saveBotConfig`; `apps/web/src/features/admin/user-bot-detail-loader.ts:261-304` summarizes any saved row as strategy fields and hard-codes `Saved WTC reference v...` at `apps/web/src/features/admin/user-bot-detail-loader.ts:271` and `apps/web/src/features/admin/user-bot-detail-loader.ts:290`. Recommendation: detect the marker before summarizing user config JSON, keep the marker as a source preference/history fact, and resolve the displayed admin summary from the current valid published system default per Phase 3.77 policy. Target part: admin config summary resolver.
3. Severity: Medium. The admin DTO and page cannot express the resolved source model or override-lock state even if the loader resolves it. Evidence: `apps/web/src/features/admin/types.ts:96-108` exposes `sourceLabel` but not `source`, `sourceDetail`, `systemDefault`, `allowUserOverride`, `profileCode`, or separate user/global version fields; `apps/web/src/features/bots/config.ts:740-758` already models those fields for the user surface. The page still badges `config: v.../not saved` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:104-106`, titles the section `Saved WTC settings` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:153`, and says defaults are not shown at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:155-157`. Recommendation: extend `AdminUserBotConfigSummary` to carry a minimal resolved-source contract, then relabel the UI around `Resolved config source` while keeping user-owned save status separate. Target part: `apps/web/src/features/admin/types.ts` and `apps/web/src/app/admin/users/[userId]/bots/page.tsx`.
4. Severity: Medium. Current tests cover admin saved-config projection and user resolved-source behavior separately, but not resolved-source visibility on the admin selected-user drilldown. Evidence: `tests/integration/admin-user-bot-detail-loader.test.ts:170-205` creates only user-owned configs with `saveBotConfig`; assertions at `tests/integration/admin-user-bot-detail-loader.test.ts:421-424` and `tests/integration/admin-user-bot-detail-loader.test.ts:467-470` expect `Saved WTC reference v1`; static coverage only checks `configSummary: mapConfigSummary` at `tests/integration/admin-user-bot-detail-static.test.ts:40` and saved-settings page copy at `tests/integration/admin-user-bot-detail-static.test.ts:60-62`. The resolved-source user tests assert the resolver and DB defaults at `tests/integration/user-resolved-bot-config-static.test.ts:13-24` and `tests/integration/user-resolved-bot-config-db.test.ts:102-127`, but do not exercise the admin drilldown. Recommendation: add PGlite cases for no user config plus published default, explicit system-default marker, locked default overriding a stale user config, and no default built-in fallback; add static guards that the admin loader uses the published resolver/validation and the page renders resolved-source copy without adding edit/live controls. Target part: `tests/integration/admin-user-bot-detail-loader.test.ts` and `tests/integration/admin-user-bot-detail-static.test.ts`.

## Decisions
1. No product code, test code, schema, migration, provider, worker, or environment files were edited.
2. The recommended implementation should not call live adapters, provider databases, worker ticks, exchange checks, SSH, tmux, systemd, `.env`, or bot start/stop/apply/retest paths.
3. Prefer a pure shared resolver/helper or direct `Db`-injected admin resolver over calling `loadBotConfig` from `loadAdminUserBotDetailFromDb`, because `loadBotConfig` owns the user settings surface and `getServerDb()` boundary.
4. The admin page should remain read-only. Showing inherited defaults is visibility only, not an admin mutation path for selected-user settings.

## Risks
1. Returning raw resolved config JSON to the admin DTO would widen the exposure surface; keep the admin projection as a whitelist summary and validate global config JSON before summarizing.
2. The marker row records `selectedGlobalVersion`, while Phase 3.77 says resolution uses the latest valid published/applying system default. The UI should avoid implying the marker stores a copied config body.
3. The workspace already contains many dirty and untracked files. This audit did not attribute ownership of those changes and did not revert or normalize any of them.

## Verification/tests
RUN:
1. Read the required governance and prior-phase docs.
2. `git status --short --branch` - observed active dirty branch `codex/bot-analytics-settings-canary-20260603`.
3. Line-numbered read-only source inspection with `rg` and `Get-Content` for the scoped loader, page, config resolver, DB schema/repositories, and relevant tests.

NOT RUN / NOT GREEN:
1. Focused Vitest admin/user resolved-source suites - not run; this was a read-only audit and the current tests do not yet cover the requested admin visibility behavior.
2. `npm run typecheck`, `npm run lint`, `npm run build`, `npm run check:core`, full `npm test`, and Playwright - not run; no product implementation was made in this auditor lane.
3. Persistent DB migrate/seed, provider DB probe, worker tick/restart, live Legacy/Tortila bot continuity, exchange ping/test, SSH, tmux, systemd, `.env` reads/writes, start/stop/retest/apply-config - forbidden by scope and not run.

## Next actions
1. Implement the admin resolved-source summary in `apps/web/src/features/admin/user-bot-detail-loader.ts`, reusing the published-only DB boundary and product-schema validation.
2. Extend `AdminUserBotConfigSummary` and the admin drilldown page so admins can distinguish user override, inherited system default, and built-in fallback without seeing raw config JSON.
3. Add focused admin PGlite/static tests for inherited default, explicit system-default marker, locked default, and built-in fallback behavior.
4. After implementation, run the focused admin/user config suites plus web typecheck, lint, secret scan, and any scoped UI smoke the operator requires.
