# bot-settings-source-ux-auditor handoff
## Scope
Read-only Phase 3.73 UX audit of user-facing Legacy/Tortila bot settings, setup, dashboard, and statistics surfaces for configuration source clarity. Focus: built-in default vs saved WTC custom config vs provider/runtime snapshot vs mapping pending; per-symbol/per-stage source clarity; and whether zero Legacy provider mappings are shown honestly as zero rather than implied one.
## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1830-phase-3-72-legacy-provider-ingestion-admin-mapping.md`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/e2e/smoke.spec.ts`
## Files changed
- `docs/handoffs/20260603-1840-bot-settings-source-ux-auditor.md` only. No product code changed.
## Findings
1. Severity: High. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:176`, `apps/web/src/app/(app)/app/bots/statistics/page.tsx:320`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:88`. The Legacy dashboard/statistics/settings summaries use `length || 1` or `providerCount || 1`, so a zero-mapping/runtime-missing case can be presented as `1 provider pub_id`. Recommendation: render the actual count, with explicit `0 provider pub_id`, `Not mapped`, or `mapping pending` states; never coerce zero to one. Target part: Legacy mapping count cards and Legacy strategy map summary.
2. Severity: High. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:123`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:127`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:135`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:141`. Legacy settings/setup use `legacyLiveConfig ?? savedConfig ?? {}` as the editable form source, even though surrounding copy says saves create WTC-side reference versions. A normal user can edit provider/runtime snapshot values without being told those fields are not their saved WTC custom config. Recommendation: default editable fields to saved WTC config or built-in template, show provider/runtime snapshot in a separate read-only comparison panel, and require an explicit "copy runtime snapshot to WTC draft" action if seeding from runtime. Target part: Legacy settings and setup strategy forms.
3. Severity: High. Evidence: `apps/web/src/features/bots/data.tsx:330`, `apps/web/src/features/bots/data.tsx:335`, `apps/web/src/features/bots/data.tsx:337`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:175`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:338`. The loader has an honest fail-closed mapping issue for zero/multiple active Legacy mappings, but settings/setup do not surface `legacyRead.config.issue`; the provider account table is hidden when count is zero, and review can summarize only config saved/live snapshot state. Recommendation: render the mapping issue on settings/setup, including `0 active Legacy provider mappings` and `admin mapping required/pending` states. Target part: Legacy settings provider-account card and setup review step.
4. Severity: Medium. Evidence: `apps/web/src/features/bots/config.ts:576`, `apps/web/src/features/bots/config.ts:583`, `apps/web/src/features/bots/config.ts:596`, `apps/web/src/features/bots/config.ts:619`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:127`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:134`. Config helpers return built-in Tortila/Legacy defaults when no config is present, and settings immediately passes those rows into UI counts/tables. This makes built-in templates look like actual configured symbols/stages unless the user cross-checks the version card. Recommendation: carry source metadata (`built_in_default`, `saved_wtc`, `provider_snapshot`) into summaries and tables, and label unsaved defaults as templates rather than configured runtime or saved config. Target part: bot config helpers plus settings/dashboard/statistics summaries.
5. Severity: Medium. Evidence: `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:77`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:110`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:255`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:52`, `apps/web/src/features/bots/statistics-panels.tsx:556`, `apps/web/src/features/bots/statistics-panels.tsx:589`. Per-symbol and per-stage tables show values and capacities but not the source of each row. Recommendation: add row/section chips such as `saved WTC`, `provider snapshot`, `built-in default`, and `pending mapping`; for provider-derived Legacy rows, clarify whether the row is read-only runtime evidence or editable WTC intent. Target part: Legacy/Tortila per-symbol tables and Legacy operations coverage matrix/stage slots.
6. Severity: Medium. Evidence: `apps/web/src/features/bots/config.ts:150`, `apps/web/src/features/bots/config.ts:158`, `apps/web/src/features/bots/config.ts:159`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:166`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:299`. The operation-mode copy calls `auto` a "Managed live profile" and says it uses the provider-side strategy attached to a pub_id, while setup also says operation mode is WTC-side intent only. Recommendation: rename/contextualize `auto` as WTC automation intent unless the displayed source is explicitly provider/runtime snapshot. Target part: operation mode labels, hints, and metric card subcopy.
## Decisions
1. Treated this as a named per-agent audit lane, not a broad/major phase implementation session.
2. Did not launch background agents; none are running or need cleanup from this audit.
3. Did not edit product code, docs other than this handoff, tests, env files, provider data, or runtime control paths.
4. Used current dirty worktree state for evidence because multiple target files already had pre-existing changes.
## Risks
1. Users can mistake a provider/runtime snapshot for their saved WTC custom config and unintentionally persist runtime-derived values as WTC reference intent.
2. Zero Legacy provider mappings can be visually implied as one in several summary cards, undermining the Phase 3.72 fail-closed mapping model.
3. Built-in default templates can read as configured/saved rows, especially when there is no saved version yet.
4. Without per-row source tags, per-symbol and per-stage differences between provider snapshot, saved custom config, and built-in defaults remain hard to audit visually.
## Verification/tests
RUN:
1. Read binding docs and prior phase handoff listed in scope.
2. Read target route/component/source files listed above.
3. `git status --short --branch` - observed dirty worktree with pre-existing changes in target bot files; no reverts performed.
4. `rg` source review for source, provider, snapshot, mapping, pub_id, default, custom, stage, symbol, runtime, saved, pending, and zero-related copy.
5. `git diff --check -- docs/handoffs/20260603-1840-bot-settings-source-ux-auditor.md` - PASS.

NOT RUN:
1. Unit/integration/e2e tests - not run because this was a read-only UX audit and no product code changed.
2. Browser/Playwright visual review - not run because the requested output is source-audit handoff and no dev server/live preview was started.
3. Live Legacy/Tortila bot control, SSH, tmux, systemd, exchange APIs, provider DBs, `.env` reads/mutations, live worker ticks, start/stop/restart/probe/apply-config - forbidden by scope and not run.
## Next actions
1. Fix Legacy zero-mapping displays first: replace `|| 1` count fallbacks with explicit zero/pending states and add regression tests.
2. Split editable WTC config from provider/runtime snapshot in settings/setup, with a visible source band and optional copy-to-draft action.
3. Add source metadata through config parsing and tables so built-in defaults, saved WTC config, and provider snapshots are labeled consistently.
4. Extend static/e2e tests to assert `0 provider pub_id`/mapping-pending copy and prevent future fallback-to-one regressions.
