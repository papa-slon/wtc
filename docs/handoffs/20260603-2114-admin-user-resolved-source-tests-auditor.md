# admin-user-resolved-source-tests-auditor handoff
## Scope
Phase 3.78 read-only tests audit for proving the admin selected-user bot drilldown displays the resolved WTC bot config source correctly while remaining read-only, secret-safe, and free of live bot control.

This audit inspected governance docs, the Phase 3.77 resolved-source handoff, current admin drilldown tests, user resolved-source tests, admin global default guardrails, and admin e2e coverage. No product code was edited. No live service, provider, worker, SSH, tmux, systemd, exchange, `.env`, or live database operation was run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-2106-phase-3-77-user-resolved-bot-config-source.md`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-global-bot-config-static.test.ts`
- `tests/integration/admin-global-bot-config-db.test.ts`
- `tests/integration/user-resolved-bot-config-db.test.ts`
- `tests/integration/user-resolved-bot-config-static.test.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/bot-settings.spec.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/bots/config.ts`

## Files changed
None - read-only audit.

## Findings
1. Severity: High. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:656` builds every product summary, but `apps/web/src/features/admin/user-bot-detail-loader.ts:660` reads only the selected user's current `bot_configs` row and `apps/web/src/features/admin/user-bot-detail-loader.ts:677` passes that row into `mapConfigSummary`; `apps/web/src/features/admin/user-bot-detail-loader.ts:260` returns `null` when no user row exists. Recommendation: add loader tests that fail until admin drilldown resolves `user_override -> published/applying system_default -> built_in` for the selected user without creating user config rows during load. Target part: `tests/integration/admin-user-bot-detail-loader.test.ts`.
2. Severity: High. Evidence: admin config summaries currently label both Tortila and Legacy rows only as saved user references at `apps/web/src/features/admin/user-bot-detail-loader.ts:271` and `apps/web/src/features/admin/user-bot-detail-loader.ts:290`, while the Phase 3.77 user resolver exposes an explicit source model at `apps/web/src/features/bots/config.ts:739` and resolves system/built-in labels at `apps/web/src/features/bots/config.ts:805`. Recommendation: test that admin detail exposes source kind and source label for `user_override`, `system_default`, and `built_in`, ideally by sharing the source-label semantics or a DB-parameterized resolver rather than duplicating strings. Target part: admin loader plus `AdminUserBotConfigSummary`.
3. Severity: High. Evidence: the admin page still tells admins that defaults are not shown when no user-owned config exists at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:155`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:156`, and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:157`. Recommendation: add a static page guard that expects resolved-source copy such as "Resolved WTC settings" / "Config source" for system defaults and built-in fallback, while still saying the projection is read-only and not editable here. Target part: `tests/integration/admin-user-bot-detail-static.test.ts`.
4. Severity: Medium. Evidence: current PGlite admin drilldown coverage proves user isolation, unchanged table counts, and secret redaction at `tests/integration/admin-user-bot-detail-loader.test.ts:401`, `tests/integration/admin-user-bot-detail-loader.test.ts:403`, and `tests/integration/admin-user-bot-detail-loader.test.ts:520`, but its source assertions only cover `Saved WTC reference v1` at `tests/integration/admin-user-bot-detail-loader.test.ts:421` and `tests/integration/admin-user-bot-detail-loader.test.ts:467`. Recommendation: extend the PGlite fixture with published Tortila and Legacy global defaults, a no-user-config selected user, a system-default selection marker, a newer published default, and a no-default fallback user; assert before/after table counts remain equal and JSON output excludes raw config markers, sealed secrets, provider pub_id values, token-like strings, and other users' rows. Target part: admin loader DB test.
5. Severity: Medium. Evidence: user-side resolved-source tests already cover published-only inheritance, draft/non-applying rejection, user override precedence, Legacy defaults, and source chooser safety at `tests/integration/user-resolved-bot-config-db.test.ts:102`, `tests/integration/user-resolved-bot-config-db.test.ts:129`, `tests/integration/user-resolved-bot-config-db.test.ts:170`, `tests/integration/user-resolved-bot-config-db.test.ts:212`, and `tests/integration/user-resolved-bot-config-static.test.ts:77`. Recommendation: mirror these source-order cases in admin tests instead of relying on the user settings route as indirect proof. Target part: admin drilldown source tests.
6. Severity: Medium. Evidence: admin selected-user static guards already forbid secret joins, raw metric/trade JSON, submit forms, bot config save actions, and live-control strings at `tests/integration/admin-user-bot-detail-static.test.ts:33`, `tests/integration/admin-user-bot-detail-static.test.ts:35`, `tests/integration/admin-user-bot-detail-static.test.ts:75`, `tests/integration/admin-user-bot-detail-static.test.ts:77`, and `tests/integration/admin-user-bot-detail-static.test.ts:78`. Admin global default guards separately forbid live-control/provider/secret fields and default edit controls on selected-user drilldown at `tests/integration/admin-global-bot-config-static.test.ts:36`, `tests/integration/admin-global-bot-config-static.test.ts:74`, and `tests/integration/admin-global-bot-config-static.test.ts:115`. Recommendation: keep those guards in the focused gate and add assertions that any new admin source resolver imports only safe DB/repository helpers, not adapters, provider env names, exchange secret tables, worker code, or mutation actions. Target part: static safety tests.
7. Severity: Medium. Evidence: e2e admin coverage visits `/admin/users/demo-user/bots` for mobile readability at `tests/e2e/admin-mobile-pg8.spec.ts:20` and `tests/e2e/admin-mobile-pg8.spec.ts:23`, then checks heading/storage/no horizontal scroll at `tests/e2e/admin-mobile-pg8.spec.ts:42` through `tests/e2e/admin-mobile-pg8.spec.ts:54`; smoke coverage checks admin users/system health but not selected-user source labels at `tests/e2e/smoke.spec.ts:166`, and bot settings e2e covers user settings, not admin drilldown, at `tests/e2e/bot-settings.spec.ts:13`. Recommendation: after implementation, add a scoped admin selected-user browser assertion or extend the admin mobile spec to prove the visible `Config source` label, read-only copy, absence of `Start bot`/`Stop bot`/`Apply config`/`Save system default version` controls, and no horizontal scroll. Target part: e2e admin specs.

## Decisions
1. Treat PGlite integration tests as the primary proof for DB-backed resolved-source semantics; they replay migrations locally and do not touch live services.
2. Keep admin drilldown read-only in both tests and implementation: no source chooser, no system-default save form, no user config save action, no provider mapping edit form, and no live-control path.
3. Use user resolved-source tests as the oracle for source order, but require admin-specific assertions because the admin loader currently has its own summary path.
4. Do not run full e2e, worker smoke, provider probes, live DB checks, or env-dependent acceptance in this auditor lane.

## Risks
1. If admin code duplicates source-label logic instead of sharing a pure resolver, user pages and admin drilldown can drift again.
2. `AdminUserBotConfigSummary.version` is currently a required number at `apps/web/src/features/admin/types.ts:96`; built-in fallback may need nullable version/source metadata, and tests should force that model decision explicitly.
3. Browser e2e in demo mode may prove only visibility/read-only layout, not DB-backed published default inheritance; keep DB semantics in PGlite tests unless a separately managed DB e2e harness is chosen.
4. Adding global-default reads to admin drilldown can accidentally broaden exposure if the test does not keep the existing secret/provider/raw/live-control denylist in place.

## Verification/tests
RUN in this auditor session:
1. Read-only source inspection with `rg` and `Get-Content` for the required governance docs, handoff, integration tests, e2e specs, and relevant admin/user config source files.

NOT RUN in this auditor session:
1. `npx vitest ...` - not run; this handoff is the pre-implementation test plan.
2. `npm run typecheck -w @wtc/web` - not run; no product code changed.
3. `npm run lint` - not run; no product code changed.
4. `npm run secret:scan` - not run; no implementation artifacts were produced besides this handoff.
5. `npx playwright ...` - not run; no browser acceptance was requested before implementation.
6. Live Legacy/Tortila providers, worker tick/restart, exchange ping/test, SSH, tmux, systemd, `.env` reads/writes, start/stop/retest/apply-config - forbidden by scope and not run.

Focused gates to run after implementation:
1. `npx vitest run tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-global-bot-config-static.test.ts tests/integration/admin-global-bot-config-db.test.ts tests/integration/user-resolved-bot-config-db.test.ts tests/integration/user-resolved-bot-config-static.test.ts tests/integration/bot-read-safety-static.test.ts`
2. `npm run typecheck -w @wtc/web`
3. `npm run lint`
4. `npm run secret:scan`
5. `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile`
6. `npx playwright test tests/e2e/admin-user-bot-detail.spec.ts --project=desktop`
7. `npx playwright test tests/e2e/admin-user-bot-detail.spec.ts --project=mobile`
8. `git diff --check`

## Next actions
1. Add admin loader integration cases for source order: existing user override wins, system-default selection marker resolves the current published default body, no user config inherits published/applying global default, draft/archived/non-applying defaults fall back, and no default shows built-in fallback.
2. Add static source guards that the admin drilldown uses a safe global-default resolver and still excludes adapters, env names, exchange secret tables, raw provider/runtime JSON, forms, save actions, and live-control strings.
3. Add or extend e2e admin coverage for visible source labels and read-only/no-live-control UI on `/admin/users/<id>/bots`; keep DB-backed source truth in PGlite unless a managed DB browser harness is explicitly approved.
4. Run exactly the focused gates listed above and record PASS/FAIL plus any skipped gate reason in the Phase 3.78 aggregate handoff.
