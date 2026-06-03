# ecosystem-ux-ui-designer handoff
## Scope
Phase 3.69 read-only product/UX audit acting as `ecosystem-ux-ui-designer` plus `ecosystem-product-architect`.

Inspected current WTC web bot settings, setup, statistics, admin bot health, and cabinet surfaces for Tortila and Legacy.
Designed the premium product model for:
- user setup where exchange keys stay private;
- automatic vs manual mode as clear product concepts, not engineering flags;
- native symbol picking;
- RSI xor CCI selection per Legacy symbol;
- stage and averaging settings;
- admin inspection of any `pub_id` or WTC user bot statistics without exposing secrets;
- removal or reframing of internal warning copy from operator-facing screens.

This handoff did not intentionally modify or accept product code, package code, tests, runtime services, database state, bot services, or live endpoints.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCT_BRIEF.md`
- `docs/SITEMAP.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/handoffs/20260603-1435-phase-3-68-legacy-db-live-read-canary.md`
- `docs/handoffs/20260603-1147-ecosystem-ux-statistics-auditor.md`
- `docs/handoffs/20260603-1147-ecosystem-legacy-settings-auditor.md`
- `docs/handoffs/20260603-1147-phase-3-66-bot-analytics-settings-richness.md`
- `docs/handoffs/20260603-1305-ecosystem-bot-integration-auditor.md`
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/cabinet/loader.ts`
- `apps/web/src/features/cabinet/CabinetProductCard.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/lib/db-store.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/worker/src/legacy-live.ts`

## Files changed
None — read-only audit

## Findings
1. Severity: High. The exchange-key privacy foundation is aligned for Tortila user setup. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:217-226` captures keys with password fields and an "Encrypt & save key" action; `apps/web/src/lib/db-store.ts:108-121` seals the key pair with the vault before persistence; `packages/db/src/repositories.ts:404-407` lists exchange accounts without joining `exchange_api_key_secrets`; `packages/db/src/schema.ts:128-133` stores only sealed vault material. Recommendation: keep the product flow centered on "Private exchange connection" cards showing exchange, label, mode, mask, created date, and rotation state, never a reveal button on app/admin screens. Target part: `/app/bots/[bot]/setup`, `/app/security`, cabinet setup cards.

2. Severity: High. Legacy product truth is split between current code/contracts and older product docs. Evidence: `docs/CONTRACTS/legacy-bot-adapter.md:24-36` defines the accepted canary path as worker snapshots by existing provider `pub_id`, with no secret columns selected; current setup copy also says WTC does not collect new exchange keys for Legacy at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:187-190` and review shows "not collected by WTC" at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:308-312`; however `docs/PRODUCT_BRIEF.md:124-128` still describes Legacy setup as API key vault -> symbols/RSI/CCI config. Recommendation: reframe Legacy onboarding as "Existing Legacy account by pub_id" plus WTC reference settings, not key collection. Target part: `PRODUCT_BRIEF`, `SITEMAP`, `/app` cabinet, `/app/bots/legacy/setup`.

3. Severity: High. Automatic/manual modes need a stable product vocabulary. Evidence: current uncommitted source labels `manual` as "Custom draft" and `auto` as "Managed live profile" at `apps/web/src/features/bots/config.ts:150-159`; setup/settings still describe WTC-side intent boundaries at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:266-275` and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:168-177`; dashboard reduces it to a "WTC mode" metric at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:162-166`. Recommendation: define two explicit product concepts: "Manual Review" = WTC stores a reference that a human reviews before any external bot update; "Automatic Strategy" = the bot is intended to run unattended in its own runtime, while WTC still does not apply/start/stop it. Avoid "Managed live profile" unless the provider account is actually linked, current, and read-only verified. Target part: `OperationModeSelector`, setup wizard, settings, dashboard summary.

4. Severity: High. Native symbol picking is only partially addressed. Evidence: Tortila symbol rows remain free-text inputs at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:52-54`; current uncommitted Legacy code adds a static `BASE_SYMBOL_OPTIONS` list at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:13-26` and a native select at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:111-116`; `docs/DESIGN_SYSTEM.md:455-458` defines `Combobox` explicitly for a searchable symbol picker. Recommendation: replace static/free-text fields with a native `SymbolPicker` Combobox/tag-list component backed by product/exchange-specific instrument catalogs, with a guarded manual-entry fallback only when catalog status is unavailable. Target part: Tortila and Legacy setup/settings matrices.

5. Severity: Medium. Current uncommitted source now aligns with the RSI xor CCI product rule, but it is not tested or accepted in this read-only handoff. Evidence: `apps/web/src/features/bots/config.ts:90-92` rejects equal `useRsi`/`useCci` values and says "Choose exactly one signal"; form parsing maps only `rsi` or `cci` at `apps/web/src/features/bots/config.ts:388-395`; current Legacy UI options are only `RSI` and `CCI` at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:131-145`. Recommendation: preserve this xor model, add focused tests for schema/form/export behavior, and ensure provider snapshots with both flags choose a deterministic/fenced signal rather than silently changing runtime truth. Target part: Legacy symbol matrix, config schema, safe export, tests.

6. Severity: Medium. Stage and averaging settings are moving toward the right hierarchy but still need a stable component contract and validation states. Evidence: current uncommitted Legacy UI splits trigger/indicator fields at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:149-185`, puts sizing and averaging in a details block at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:187-225`, and renders stage RSI/CCI capacity at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:231-244`; validation already checks averaging drop/volume counts against levels at `apps/web/src/features/bots/config.ts:94-100`. Recommendation: formalize this as `StageAveragingMatrix` with visible `valid | row_error | count_mismatch | out_of_range | empty` states, not ad hoc details markup. Target part: `/app/bots/legacy/settings`, `/app/bots/legacy/setup`, Legacy operations panel.

7. Severity: High. Admin still cannot inspect a specific `pub_id` or WTC user bot statistics as a first-class workflow. Evidence: current uncommitted worker code adds provider identity into live config and positions at `apps/worker/src/legacy-live.ts:192-231` and `apps/worker/src/legacy-live.ts:276-284`, but `/admin/bots` still loads only global cross-user health/latest snapshot through `loadAdminBotHealth`; the latest metric query orders all bot snapshots by timestamp without `user_id` or `pub_id` filter at `apps/web/src/features/admin/queries.ts:412-421`; `AdminBotHealthResult` exposes only one `latestSnapshot` shape at `apps/web/src/features/admin/types.ts:173-178`; `bot_instances` still stores WTC user/product/exchange-account only at `packages/db/src/schema.ts:138-143`. Recommendation: add an admin `BotAccountInspector` surface with search by WTC email/user id/product/`pub_id`, safe stats, positions, warnings, config summary, and stage summary; persist or index safe provider identity without storing secret columns. Target part: `/admin/bots`, likely `/admin/bots/accounts` or `/admin/bots/statistics`.

8. Severity: High. Operator-facing screens still expose internal implementation flags and docs paths that should be moved to diagnostics. Evidence: `/app/bots` includes `BOT_ADAPTER_MODE` in hero copy and mock warning detail at `apps/web/src/app/(app)/app/bots/page.tsx:34-49`; bot dashboard mock copy also prints `BOT_ADAPTER_MODE=mock` at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:94-99`; `/admin/bots` labels a card "Safety-disabled states (hardcoded policy)" and prints `FEATURE_LIVE_BOT_CONTROL` plus a docs path at `apps/web/src/app/admin/bots/page.tsx:92-100`; it also shows "DB URL" as a metric label at `apps/web/src/app/admin/bots/page.tsx:207-216`. Recommendation: user/operator copy should say "Simulated preview data", "Read-only monitoring", "Live actions unavailable", and "Provider connection configured/not configured"; raw env names, table names, DB URL labels, and docs paths belong in a collapsed "Deployment diagnostics" area for admin only. Target part: `/app/bots`, `/app/bots/[bot]`, `/app/bots/statistics`, `/admin/bots`.

9. Severity: Medium. The bot dashboard still renders raw runtime config JSON inline, which is not premium and creates a bad precedent for raw payload display. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:172-178` renders `JSON.stringify(config.raw, null, 2)` or a runtime-read empty state. Recommendation: replace raw JSON with `ConfigSummary` cards: mode, key/private status, symbol count, selected signals, stage capacity, averaging profile, last snapshot, and a safe export CTA. Target part: bot dashboard "Configuration & controls".

10. Severity: Medium. Cabinet indicates Legacy setup is done because it uses an existing `pub_id` runtime, but it does not show which account was matched or whether a current snapshot exists. Evidence: `apps/web/src/features/cabinet/loader.ts:83-91` sets "Use existing Legacy pub_id runtime" as done unconditionally for Legacy; the current admin/source model does not persist a provider account identity in `bot_instances` at `packages/db/src/schema.ts:138-143`. Recommendation: add a `LegacyAccountIdentity` state: unlinked, linked by `pub_id`, snapshot current, snapshot stale, quarantined; expose it on cabinet/setup/dashboard without keys. Target part: `/app`, `/app/products`, `/app/bots/legacy/setup`, `/app/bots/legacy`.

## Decisions
- Product setup model:
  - Tortila uses a "Private Exchange Connection" first step. The user can add, rotate, revoke, and label a key; WTC only shows exchange, label, mode, mask, created/rotated timestamps, and audit status.
  - Legacy uses "Existing Legacy Account" instead of key collection. It identifies the provider runtime by `pub_id`, reads safe worker snapshots, and lets the user save WTC reference versions only.
  - Both bots then enter "Strategy Intent": Manual Review or Automatic Strategy. These are product states, not live-control permissions.
  - Both bots end with "Review & Export": show what is saved in WTC, what is read from provider snapshots, and what live actions remain unavailable.

- Recommended component/state model:
  - `ExchangeConnectionVault`: `not_started | saving | saved | invalid | vault_unavailable | legacy_not_collected`; props include `exchange`, `label`, `mode`, `keyMask`, `createdAt`, `rotatedAt`, `auditStatus`.
  - `OperationModeSelector`: `manual_review | automatic_strategy`; copy explains behavior and boundaries; never says this starts or applies a live bot.
  - `NativeSymbolPicker`: `catalog_loading | catalog_ready | catalog_empty | catalog_error | manual_fallback`; product-aware symbols, exchange-aware formatting, multi-select tags, duplicate prevention.
  - `LegacySignalSelector`: exactly one of `rsi` or `cci`; selected family enables thresholds/lengths; non-selected family is hidden or collapsed as inactive defaults.
  - `StageAveragingMatrix`: `valid | row_error | count_mismatch | out_of_range | empty`; summarizes level count, drop ladder, volume ladder, and RSI/CCI slot capacity.
  - `ConfigSummary`: replaces raw JSON on dashboard with mode, safe account identity, symbols, signal distribution, stage capacity, averaging profile, snapshot freshness, and export CTA.
  - `AdminBotAccountInspector`: search/filter by `productCode`, `userId/email`, `pub_id`, symbol, date range; returns safe DTOs only.
  - `DeploymentDiagnosticsPanel`: admin-only, collapsed by default; contains env flag/table/worker target details currently mixed into normal screen copy.

- Recommended safe admin DTO:
  - `productCode`, `userId`, `userEmail`, `providerPubId`, `exchange`, `runtimeStatus`, `snapshotAt`, `sourceAdapter`, `walletEquity`, `openPositions`, `warnings`, `configSummary`, `stageSummary`, `keyMaskCount`, `secretsVisible:false`.
  - No API key, secret key, sealed vault blob, DB URL, bearer token, cookie, raw provider payload, or unredacted health detail.
  - Every admin drilldown view should write an audit event such as `admin.bot_account.inspect` with `targetId` = bot/account id or `pub_id`, no secrets.

## Risks
- A `pub_id` drilldown still needs a schema/repository decision: current uncommitted worker/source changes expose provider identity inside config/raw snapshot objects, but there is no accepted indexed admin lookup model yet.
- Native symbol catalogs can drift by exchange and market type; manual fallback must be visibly lower-confidence and audit-friendly.
- "Automatic Strategy" copy can imply WTC live control if written loosely; keep "WTC stores intent, bot runtime acts separately" visible.
- Admin cross-user bot inspection is legitimate ops functionality but high-privacy; it needs admin RBAC, audit logging, scoped safe DTOs, and no raw payload display.
- Removing internal copy from normal screens must not hide diagnostic facts from operators; move them into admin diagnostics, not out of the product entirely.

## Verification/tests
RUN:
- Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, and `docs/handoffs/0000-orchestrator-seed.md`.
- Checked git start state: branch `codex/bot-analytics-settings-canary-20260603`, clean before writing this handoff.
- Read current WTC product docs, design docs, Legacy/Tortila contracts, recent Phase 3.66-3.68 handoffs, and the current bot setup/settings/statistics/admin/cabinet source.
- Static read-only UX/product model audit only.
- Final git status after writing showed uncommitted source diffs in `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`, `apps/web/src/features/bots/config.ts`, and `apps/worker/src/legacy-live.ts`. They appeared during this read-only audit, were not authored/staged/tested by this handoff, and are treated here as unverified current workspace context only.

NOT RUN / NOT GREEN:
- No product code edits.
- No tests, typecheck, lint, build, Playwright, preview, browser inspection, or visual acceptance.
- No live endpoint calls, SSH, server deploy, Docker, DB migration, DB writes, worker tick, bot service mutation, bot start/stop/apply-config, exchange calls, or provider credential reads.
- No separate background agent was launched; no multi-agent audit is claimed in this handoff.

## Next actions
1. Update product truth docs (`PRODUCT_BRIEF`, `SITEMAP`, `DESIGN_SYSTEM`) so Legacy setup is `pub_id`/worker snapshot based and Tortila setup is the private exchange-key path.
2. Implement `OperationModeSelector`, `NativeSymbolPicker`, `LegacySignalSelector`, `StageAveragingMatrix`, and `ConfigSummary` in the bot setup/settings/dashboard surfaces.
3. Add focused verification for the current Legacy RSI xor CCI direction: schema, form parsing, safe export, provider snapshot mapping, and UI state.
4. Add an admin-safe `pub_id`/user bot account drilldown, including safe provider identity storage or snapshot mapping, RBAC, and `admin.bot_account.inspect` audit.
5. Reframe normal app/admin copy to product language and move env/table/worker names into a collapsed admin diagnostics panel.
6. Before implementation, dispatch the relevant read-only security and bot-integration agents per the phase protocol because the admin drilldown and provider identity mapping touch privacy and bot-boundary risk.
