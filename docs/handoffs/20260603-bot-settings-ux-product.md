# ecosystem-product-architect + ecosystem-ux-ui-designer handoff
## Scope
Product and UX target definition for a premium bot settings/statistics experience covering WTC's two bot products: Tortila Bot and Legacy Bot. The requested scope includes user self-service, admin read-only user drilldown, admin global system configuration, defaults vs personal overrides, coin selectors, per-symbol/stage settings, RSI/CCI slot logic, exchange-key test flow, safety-gated start/stop UX, institutional-style analytics dashboards, and clear loading/empty/error states.

This was a read-only product/UX pass over docs, code, and retained screenshots. No application code was edited. No live bot, server, DB, provider, exchange, SSH, tmux, systemd, or secret-bearing path was touched.

This handoff is a scoped foreground per-agent handoff, not an aggregate phase handoff and not an "N-agent audit" claim. No background agents were launched.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1522-phase-3-69-legacy-premium-settings.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCT_BRIEF.md`
- `docs/SITEMAP.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `docs/SECRET_VAULT_DESIGN.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/RBAC_MATRIX.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/shared/src/schemas.ts`
- `packages/crypto/src/vault.ts`
- `packages/audit/src/audit.ts`
- `packages/analytics/src/metrics.ts`
- `packages/analytics/src/advanced.ts`
- `packages/ui/src/components.tsx`
- `apps/web/src/lib/nav.ts`
- `apps/web/src/components/BotSubNav.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `tests/e2e/screenshots/bot-tortila-desktop.png`
- `tests/e2e/screenshots/bot-statistics-journal-desktop.png`
- `tests/e2e/screenshots/bot-controls-disabled-desktop.png`
- `tests/e2e/screenshots/admin-bots-mobile375.png`
- `tests/e2e/screenshots/wizard-key-mobile375.png`
- `tests/e2e/screenshots/wizard-strategy-mobile375.png`

## Files changed
- `docs/handoffs/20260603-bot-settings-ux-product.md` only.

## Findings
1. Severity: High. Product taxonomy needs one explicit correction before final UX copy: the current docs define Tortila as a turtle/trend futures bot, while Legacy is the RSI/CCI multi-stage averaging bot. Evidence: `docs/PRODUCT_BRIEF.md:100`, `docs/PRODUCT_BRIEF.md:120`, `apps/web/src/features/bots/meta.ts:21-22`. Recommendation: keep a shared "Bot operations" IA for both products, but use "averaging" language only for Legacy unless the product owner intentionally repositions Tortila. Target part: information architecture and product copy.

2. Severity: High. The route model already supports a flat premium bot room, so the target IA should extend the current dynamic routes rather than add duplicate static/deep routes. Evidence: `docs/SITEMAP.md:15-24`, `docs/SITEMAP.md:35-44`, `docs/SITEMAP.md:73-80`, `apps/web/src/components/BotSubNav.tsx:4-14`. Recommendation: keep `/app/bots`, `/app/bots/[bot]`, `/app/bots/[bot]/settings`, and `/app/bots/statistics?bot=:bot` as the user IA. Treat exchange keys, symbols/coins, risk, stages, and review as sections inside Settings/Setup, not top-level routes unless URL-addressable wizard state becomes necessary. Target part: user IA.

3. Severity: High. The target settings page needs a resolved defaults/override model, because current code has per-user bot config versions and hard-coded presets/defaults but no visible effective-config model. Evidence: bot config schemas/defaults/presets exist in `apps/web/src/features/bots/config.ts:14-18`, `apps/web/src/features/bots/config.ts:32-65`, `apps/web/src/features/bots/config.ts:67-126`, `apps/web/src/features/bots/config.ts:150-160`, `apps/web/src/features/bots/config.ts:252-339`; user configs persist through `bot_instances`, `bot_configs`, and `bot_config_versions` at `packages/db/src/schema.ts:138-151`, `packages/db/src/schema.ts:403-417`; saving is versioned and audited at `packages/db/src/repositories.ts:1677-1689`. Recommendation: define four visible layers: System default, bot profile default, user personal override, and per-symbol override. Render a "Resolved config" preview with inherited/custom/invalid/stale flags and a diff against defaults. Target part: settings product model.

4. Severity: High. Admin global system config is not the same object as user personal overrides and should not be faked by editing a user config. Evidence: inspected DB bot schema exposes user-owned `bot_instances.userId` and per-instance configs at `packages/db/src/schema.ts:138-151`, while existing admin bot health is read-only diagnostics at `apps/web/src/app/admin/bots/page.tsx:30-43`. Recommendation: target a separate admin Global Bot Defaults area under `/admin/bots` or `/admin/bots/config`, with versioned global defaults, hard caps, key-test policy, safety-gate status, and audit. It must clearly say "changes affect future/resolved WTC reference config only; no live bot apply." Target part: admin global config.

5. Severity: High. Legacy already has the raw UX ingredients for a premium averaging-bot settings page, but the target should reduce the long mobile scroll and make coin/stage structure scannable. Evidence: current Legacy editor summarizes active coins, RSI/CCI split, and pub_id count at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:66-78`; each row has coin/status/timeframe/trigger at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:108-143`; indicator and TP/stage fields at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:146-181`; sizing/averaging ladder at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:184-222`; stage capacities at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:228-247`. Recommendation: target a split workbench: left coin selector with search/filter/status chips, right per-coin editor, and a sticky stage-capacity matrix. Each coin row/card should show trigger, stage, TP, ladder, leverage, balance percent, provider pub_id, and inherited/custom state. Target part: Legacy settings UX.

6. Severity: Medium. Tortila per-coin configuration and native export exist, but the target settings page should turn the table into a coin-basket workbench that matches the premium dashboard style. Evidence: current Tortila editor explains the native export row format at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:21-29`, renders symbol/TF/system/risk/ATR/TP fields at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:32-76`, and displays generated `SYMBOL_CONFIGS` without live push at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:79-90`; serialization/export is implemented at `apps/web/src/features/bots/config.ts:441-456`, `apps/web/src/features/bots/config.ts:541-558`. Recommendation: use coin chips plus a detail panel, show per-symbol risk and TP flags, show portfolio caps beside per-symbol rows, and preserve exact export visibility. Target part: Tortila settings UX.

7. Severity: High. Exchange-key capture exists, but the target flow needs a separate, auditable key test UX with careful state handling. Evidence: setup saves keys through CSRF, entitlement, Zod validation, and vault-backed `addExchangeKey` at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:41-60`, with fields rendered at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:200-230`; shared input validation is at `packages/shared/src/schemas.ts:26-33`; sealed storage/audit behavior is at `packages/db/src/repositories.ts:384-407`; `exchange_key.test` is an audit action at `packages/audit/src/audit.ts:38-40` and documented at `docs/AUDIT_LOG_SCHEMA.md:171-176`. Recommendation: add a "Test connection" state machine: idle, testing, success, warning, failed, expired, not-tested. Output should include exchange, mode, key mask, permission/scope status, account-read reachability, timestamp, and safe failure reason; never show plaintext, ciphertext, raw headers, provider tokens, or stack traces. Legacy should say WTC does not collect new exchange keys and uses provider pub_id snapshots. Target part: key management UX.

8. Severity: Critical. Start, stop, and apply-config UX must stay constrained by safety gates and must not imply order control. Evidence: all bot controls default disabled at `docs/BOT_CONTROL_SAFETY_MODEL.md:13-24`; stop does not close positions and has future confirmation requirements at `docs/BOT_CONTROL_SAFETY_MODEL.md:47-71`; apply-config must show diff and must not silently restart at `docs/BOT_CONTROL_SAFETY_MODEL.md:75-89`; live read/write capability table forbids writes/start/stop until audited at `docs/BOT_CONTROL_SAFETY_MODEL.md:253-268`; current dashboard renders disabled start/stop buttons at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:239-266`; admin bot page states no live-control buttons exist at `apps/web/src/app/admin/bots/page.tsx:30-43`. Recommendation: target a Safety Gate Panel above any control CTA: entitlement active, adapter audited, key test passed if applicable, current config version selected, unresolved P0/P1 warnings reviewed, open positions snapshot reviewed, typed confirmation for future stop, and audit preview. Until all gates pass, buttons remain disabled and explanatory. Target part: live-control UX.

9. Severity: High. Analytics can look institutional without faking blended metrics. Evidence: statistics page already avoids blending strategy-specific win rate/PF at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:266-275`; it distinguishes simulated data and issues at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:298-314`; it renders advanced Tortila metrics at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:327-346`; advanced analytics include returns, trade quality, risk, symbols, daily PnL, distribution, and exposure at `packages/analytics/src/advanced.ts:66-74`, `packages/analytics/src/advanced.ts:326-342`; BotJournalPanels compose the institutional sections at `apps/web/src/features/bots/statistics-panels.tsx:605-647`. Recommendation: target a dashboard with Overview, Risk, Returns, Trades, Symbols, Exposure, and Activity sections; show data-source badges (`mock`, `real`, `stale`, `DB snapshot`, `worker not run`) on every section. Legacy should emphasize operational coverage until closed-trade/equity sources exist. Target part: statistics UX.

10. Severity: Medium. Legacy statistics should remain operational until a real closed-trade/equity source exists. Evidence: latest Phase 3.69 handoff says Legacy was changed away from fake-looking performance zeros toward provider accounts, active slots/orders, stage capacity, and symbol/signal coverage at `docs/handoffs/20260603-1522-phase-3-69-legacy-premium-settings.md:67-70`, and flags closed-trade/equity source risk at `docs/handoffs/20260603-1522-phase-3-69-legacy-premium-settings.md:79-83`; current statistics page renders Legacy wallet/config/slots/orders instead of generic PnL cards at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:318-324`. Recommendation: target Legacy dashboard language as "operations and exposure" until closed trade import is real; do not show Sharpe, PF, win rate, heatmap, or equity curve unless data is present. Target part: Legacy analytics.

11. Severity: High. Admin lacks a user-specific read-only bot drilldown, while the requested UX requires one. Evidence: admin nav has `/admin/users` and `/admin/bots` but no user bot detail route at `apps/web/src/lib/nav.ts:20-32`; admin users page is a directory/security screen at `apps/web/src/app/admin/users/page.tsx:26-30`, `apps/web/src/app/admin/users/page.tsx:62-145`; admin bots page is fleet health at `apps/web/src/app/admin/bots/page.tsx:53-57`, `apps/web/src/app/admin/bots/page.tsx:219-340`. Recommendation: target `/admin/users/:userId/bots` or a user-row drawer with read-only entitlement state, bot summaries, resolved config, user overrides, runtime snapshot, key metadata/test history, safety events, analytics, and audit timeline. No secret reveal, no start/stop/apply-config, no cross-user leakage. Target part: admin IA.

12. Severity: High. Admin bot data must stay sanitized and source-labeled. Evidence: admin query comments state `/admin/bots` never exposes exchange keys, URLs, or stack traces and hardcodes live control disabled at `apps/web/src/features/admin/queries.ts:337-340`; admin types expose booleans and safe Legacy pub_id rows, never exchange keys, at `apps/web/src/features/admin/types.ts:149-187`; admin Legacy extraction maps only pub_id, market, running, balance, symbols, slots, and orders at `apps/web/src/features/admin/queries.ts:437-474`. Recommendation: target admin drilldown fields should use safe DTOs only: key mask/status, test result, pub_id, snapshot age, adapter mode, and read-state detail. Do not add admin plaintext reveal or copy controls. Target part: admin safety.

13. Severity: Medium. Error/empty/loading states need to be specified as first-class product states, not inferred ad hoc by each page. Evidence: SITEMAP requires settings, positions, trades, equity, and safety states at `docs/SITEMAP.md:286-355`; shared UI provides `EmptyState` and `MetricValue` null rendering at `packages/ui/src/components.tsx:69-83`; bot data loader catches adapter blockers and issues without crashing pages at `apps/web/src/features/bots/data.tsx:56-78`, `apps/web/src/features/bots/data.tsx:107-143`, `apps/web/src/features/bots/data.tsx:445-473`; admin page already renders demo/no snapshot/no health-check states at `apps/web/src/app/admin/bots/page.tsx:83-89`, `apps/web/src/app/admin/bots/page.tsx:187-195`, `apps/web/src/app/admin/bots/page.tsx:297-307`. Recommendation: define per-section state specs: loading skeleton, empty, demo, no DB, unconfigured, validation error, adapter blocked, stale, unauthorized/entitlement denied, save success, and save failed. Target part: state system.

14. Severity: Medium. Settings validation UX is incomplete in the current settings page. Evidence: the settings server action returns silently on invalid config at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:67-80`, while setup redirects with `err=config` at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:63-75`. Recommendation: target settings UX must preserve user input and show inline field errors, section-level error summaries, and "invalid override" badges in the resolved config diff. Target part: settings error UX.

15. Severity: Medium. The visual direction should stay terminal-first and dense, not become a marketing-style settings page. Evidence: design principles require terminal-first, restrained premium, explicit state, and fail-visible risk at `docs/DESIGN_SYSTEM.md:26-37`; form fields and secret input rules are specified at `docs/DESIGN_SYSTEM.md:443-490`; bot tabs use the product-area tab pattern at `docs/DESIGN_SYSTEM.md:494-516`; current screenshots show the existing shell, warnings, metric tiles, and disabled controls already align with that direction. Recommendation: target UI should use dense panels, segmented controls, searchable selects/comboboxes, status pills, tables with mobile data labels, and non-collapsed risk warnings. Avoid decorative cards, hero treatment, and hidden risk accordions. Target part: visual design system.

## Decisions
- Target user IA:
  - `/app/bots`: portfolio-level bot switcher and combined safe totals.
  - `/app/bots/[bot]`: command-center overview with live/read-state, warnings, headline metrics, positions/trades summary, config summary, disabled controls, and capability summary.
  - `/app/bots/[bot]/settings`: daily configuration workbench with sections for Defaults, Coins, Risk/Portfolio caps, Stages/Slots for Legacy, Exchange Keys for Tortila, Review/Export, Safety Gates, and Version History.
  - `/app/bots/[bot]/setup`: guided onboarding that reuses the same primitives but optimizes for first-run completion.
  - `/app/bots/statistics?bot=:bot`: institutional dashboard, with strategy-specific stats and no fake blended PF/win-rate.

- Target admin IA:
  - `/admin/bots`: fleet-level health, global safety gates, worker/read-state, and system defaults entry point.
  - `/admin/bots/config`: target route or section for global defaults, hard caps, key-test policy, and safety gates. Versioned and audited; no live apply.
  - `/admin/users/:userId/bots`: target read-only drilldown from the user directory. Shows that user's entitlements, resolved bot configs, overrides, runtime snapshots, safe key metadata/test state, warnings, and audit trail.

- Defaults/override vocabulary:
  - System default: global WTC baseline owned by admin/product.
  - Bot profile default: named profile such as Legacy balanced/conservative or Tortila reference heroes.
  - Personal override: user's saved WTC config version.
  - Per-symbol override: coin-specific row values.
  - Resolved config: computed effective view used for review/export; never implied to be live runtime config.
  - Runtime snapshot: read-only adapter/worker state from the actual bot service or DB snapshots.

- Legacy-specific UX:
  - WTC does not collect new exchange keys for Legacy.
  - Primary settings concept is provider pub_id plus per-symbol RSI/CCI, averaging ladder, stage slot capacity, TP, balance, leverage, and runtime coverage.
  - Legacy stats are operational coverage until real closed trades/equity are sourced.

- Tortila-specific UX:
  - Keep per-coin risk and native `SYMBOL_CONFIGS` export visible.
  - Treat exchange keys as WTC-vaulted credentials for WTC-side setup/test only.
  - Keep P0/P1 warnings persistent until journal evidence clears them.

- Control UX:
  - Start/stop/apply-config remain disabled by default.
  - Future enabled controls require visible gate checklist, config diff, open-position snapshot, typed confirmation for stop, audit preview, and explicit copy that stop does not close positions.

## Risks
- Product vocabulary risk: calling both products "averaging bots" conflicts with current product evidence for Tortila. Align copy before implementation to avoid user confusion.
- Global defaults require backend/data design. Reusing user `bot_configs` for system defaults would blur ownership, audit, and inheritance.
- Key testing may require live exchange/API calls. It needs separate security/bot-integration approval, timeout/rate-limit policy, redacted errors, audit, and no retained secret artifacts.
- Admin drilldown raises cross-user leakage risk. Use safe DTOs only and keep support/admin permissions read-only unless a future audited mutation is explicitly scoped.
- Legacy institutional analytics cannot be completed honestly until closed-trade/equity sources are real. Until then, show operational coverage and data-unavailable states.
- Current settings validation can fail silently on the settings page. Implementation should not ship the target workbench without field-level error display.
- Long mobile forms can become unusable. Retained `wizard-strategy-mobile375.png` shows the current strategy form is extremely tall; the target must use search, sticky coin selector, section anchors, and collapsible advanced panels while keeping warnings visible.

## Verification/tests
RUN:
- Read protocol and canonical seed docs.
- Read current product, sitemap, design, safety, RBAC, secret, audit, DB, adapter, bot, admin, analytics, and UI component evidence.
- Inspected retained screenshots for bot dashboard, statistics, disabled controls, admin bots, and setup wizard.
- Confirmed no live bot/server/provider mutation was performed.
- Confirmed no application code was edited.

NOT RUN:
- `npm test`, typecheck, lint, build: not run because this is a product/UX handoff-only change.
- Playwright/browser fresh capture: not run; only retained screenshots were inspected.
- Dev server/preview: not started.
- DB migrations/seeds/worker ticks: not run.
- Exchange key test/provider calls: not run.
- Live bot start/stop/apply-config: not run by policy.
- Background agent fan-out: not launched; this handoff does not claim an N-agent audit, so no agent cleanup was required.

## Next actions
1. Product owner: decide whether Tortila should be marketed as an averaging bot or remain the documented turtle/trend bot. Update copy before UI implementation.
2. Platform/DB architect: design global defaults and resolved-config data model separately from user bot config versions.
3. Security + bot-integration auditors: define the exchange-key test contract and safety gate checklist before any test endpoint or live-control affordance is implemented.
4. Frontend implementer: build the settings workbench using existing dynamic bot routes, BotSubNav, WTC cards/pills/fields, per-coin selectors, version history, resolved-config diff, and explicit empty/error/loading states.
5. Admin implementer: add a read-only user bot drilldown and global bot defaults view using sanitized DTOs only; do not add live control buttons.
6. Tests runner: add static tests for copy/gates/no-secret rendering, Playwright coverage for mobile settings/statistics/admin drilldown states, and screenshot acceptance only with visual review manifests.
