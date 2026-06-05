# legacy-provider-ux-product-auditor handoff
## Scope
Read-only UX/product audit for Phase 3.72 - Legacy provider-account ingestion + admin mapping foundation.

Focus areas:
- Current user bot settings UX for Tortila and Legacy.
- Legacy per-symbol/stage configuration and provider-account visibility.
- Bot statistics panels and Legacy capability/null states.
- Admin user bot drilldown for read-only user inspection and provider mapping state.
- Safe next UX step toward a premium simple settings page without live control and without admin editing user settings.

This audit did not touch live services, SSH, tmux, systemd, exchange APIs, provider DB, `.env`, or bot start/stop/apply-config.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md`
- `docs/handoffs/20260603-1758-phase-3-71-legacy-provider-account-scope.md`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/audit/src/audit.ts`

## Files changed
None - read-only audit

Handoff file written: `docs/handoffs/20260603-1815-legacy-provider-ux-product-auditor.md`

## Findings
1. Severity: High. The Legacy settings page can silently use a provider worker snapshot as the editable form source because `cur` is `legacyLiveConfig ?? state.current ?? {}`. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:123-127`; the summary cards show strategy mode, config version, and provider pub_id count but do not state whether the form is using built-in defaults, saved WTC config, or provider snapshot data at field level, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:165-172`. Recommendation: add a first-screen "Configuration source" band with explicit states: built-in defaults, saved WTC reference vN, provider snapshot, provider mapping pending, provider mapping verified. Add row/field source chips so users can see default vs custom vs provider-derived values before saving. Target part: user Legacy/Tortila settings.

2. Severity: High. Legacy provider-account visibility exists in user settings, but it is derived from `legacyLiveConfig.providerAccounts`, not from the durable WTC `bot_provider_accounts` ownership mapping. Evidence: provider rows are parsed from raw live config in `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:52-67` and rendered in `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:175-201`; user production reads fail closed unless exactly one active WTC provider mapping exists, `apps/web/src/features/bots/data.tsx:312-341`. Recommendation: label the user settings table as "provider snapshot visibility" and show "not ownership proof" when no durable mapping is present. Keep user pages unable to create or edit provider mappings. Target part: Legacy settings provider account card.

3. Severity: High. The main bot dashboard and statistics page imply at least one Legacy provider pub_id even when none is mapped or visible by using `legacyAccounts.length || 1`. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:173-180` and `apps/web/src/app/(app)/app/bots/statistics/page.tsx:318-323`. Recommendation: replace the fallback with explicit labels: "0 mapped", "mapping pending", or "provider snapshot unavailable"; do not show "1 provider pub_id" unless a provider account row is actually present. Target part: Legacy dashboard/statistics metric cards.

4. Severity: Medium. The Legacy per-symbol/stage UX has the right raw controls but is not yet the premium simple matrix the user requested. Evidence: the component summarizes active, RSI, CCI, delay, delta, and pub_id counts in `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:73-89`; editable symbol cards span `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:92-248`; stage capacity is a separate table at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:253-286`. Recommendation: add a dense read-only matrix above the editable cards: source, symbol, mapped pub_id state, enabled/paused, trigger, timeframe, stage, TP, entry, balance, leverage, ladder, delay/delta, and slot-capacity status. Keep the existing cards as the edit surface. Target part: Legacy settings matrix.

5. Severity: Medium. Tortila settings are closer to the requested model, but they still lack source/default/custom clarity. Evidence: Tortila per-coin cards expose symbol, manual override, timeframe, system, risk, ATR stop/add, max units, ATR, and TP in `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:48-145`; the export preview is explicit and read-only in `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:152-165`. Recommendation: add "baseline/custom" badges per coin and a "matches profile / differs from profile" summary for the selected reference profile. Target part: Tortila settings.

6. Severity: High. Admin user drilldown is appropriately read-only and already shows Legacy mapped vs pending state, but it does not provide the mapping action foundation yet. Evidence: the page copy states admins cannot edit user bot settings, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:31-35`; mapped/pending scope pills and warnings render at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:80-121`; there are no admin provider-account actions under `apps/web/src/features/admin/actions.ts` or schemas under `apps/web/src/features/admin/schemas.ts`. Recommendation: implement mapping from this admin drilldown as a separate admin-only form that writes only `bot_provider_accounts`, never `bot_configs` and never live bot state. Target part: admin user drilldown mapping foundation.

7. Severity: High. The DB/repository layer has enough primitives for a safe admin mapping foundation, but verification semantics are still thin. Evidence: `bot_provider_accounts` stores user, bot instance, product, provider, provider account id, label, status, creator, disabled time, and updated time, `packages/db/src/schema.ts:146-171`; repository upsert/disable functions validate ownership and audit map/update/disable actions, `packages/db/src/repositories.ts:1705-1818`; audit actions are registered in `packages/audit/src/audit.ts:36-38`. Recommendation: use `needs_review` as the default for unverified/manual mappings, require an admin reason, and treat "active" as an explicit admin assertion until richer fields like verified_at, verified_by, claim_source, last_seen_at, and disabled_reason exist. Target part: admin mapping action and provider-account status UX.

8. Severity: Medium. Admin drilldown hides user config payloads and exchange secrets, which is the right boundary for this phase. Evidence: the loader selects only safe exchange key metadata in `apps/web/src/features/admin/user-bot-detail-loader.ts:190-199`, only config version/update time in `apps/web/src/features/admin/user-bot-detail-loader.ts:217-227`, and maps latest metric summaries without raw JSON in `apps/web/src/features/admin/user-bot-detail-loader.ts:228-245`; DTOs contain exchange key mask only, `apps/web/src/features/admin/types.ts:31-37`, and bot config version without config payload, `apps/web/src/features/admin/types.ts:61-76`. Recommendation: preserve this boundary; do not add admin-side user settings editing in the mapping phase. Target part: admin drilldown loader and DTO.

9. Severity: Medium. The fleet admin bot page still renders full Legacy pub_id values in fleet diagnostics. Evidence: `/admin/bots` renders full pub_id in the Legacy inspector and active slot/order tables at `apps/web/src/app/admin/bots/page.tsx:219-249`, `apps/web/src/app/admin/bots/page.tsx:254-273`, and `apps/web/src/app/admin/bots/page.tsx:276-294`. Recommendation: mask pub_id by default or add an audited reveal/inspect flow before using fleet identifiers as admin mapping inputs. Target part: admin fleet bot diagnostics.

10. Severity: Medium. Configuration validation remains generic, so the premium settings page still cannot guide a user directly to the bad row/field. Evidence: save preflight redirects on config issues in `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:70-83`, and the banner is generic in `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:157-162`. Recommendation: preserve submitted values and render exact row-level validation messages for Legacy symbol/stage rows and Tortila coin rows. Target part: settings form error UX.

## Decisions
1. The safe Phase 3.72 UX step is read-only mapping clarity plus an admin mapping foundation, not live provider verification, live control, or admin user-settings editing.
2. User-facing Legacy pages should show provider snapshot facts and mapping blockers, but only admins should create or disable `bot_provider_accounts` mappings.
3. Admin mapping can be implemented safely if it writes only to `bot_provider_accounts` through existing repository functions, uses `assertAdmin`, CSRF, Zod validation, a required reason, and audit logging, and never calls provider DB, exchange APIs, or bot control adapters.
4. Use `needs_review` as the honest unverified mapping state. Show "unverified" and "mapping pending" as first-class warnings; do not collapse them into green "mapped" state.
5. The settings page should distinguish four sources everywhere: built-in default, selected reference profile, saved WTC config version, and provider snapshot.
6. The admin drilldown should remain a read-only user bot inspector for entitlements/config/metrics/exchange metadata. Mapping controls, if added, are provider-account ownership controls, not user bot setting controls.

## Risks
1. The current worktree is already dirty with prior Phase 3.70/3.71 changes and untracked handoffs/tests; this audit did not revert or overwrite them.
2. Existing `bot_provider_accounts` rows do not include richer verification proof fields. An "active" mapping currently means admin asserted it, not provider-confirmed it.
3. The current user-facing dashboard/statistics fallback can mislead by showing one provider pub_id when there are zero visible provider accounts.
4. Fleet diagnostics currently show full pub_id values. That is useful for ops but should be masked or audited before becoming the mapping workflow source.
5. No live provider DB or worker tick was inspected in this lane, so this handoff is UX/source-code scoped only.

## Verification/tests
RUN:
1. Read required governance and prior handoff docs listed in scope.
2. `git status --short --branch` - observed dirty branch `codex/bot-analytics-settings-canary-20260603...origin/codex/bot-analytics-settings-canary-20260603`; no files reverted.
3. Source inspection with `rg` for bot settings tables, bot pages, statistics panels, admin user drilldown, admin fleet diagnostics, provider-account DB schema/repositories, and admin actions/schemas.
4. `Test-Path docs/handoffs/20260603-1815-legacy-provider-ux-product-auditor.md` before writing - false.
5. Wrote exactly one handoff file: `docs/handoffs/20260603-1815-legacy-provider-ux-product-auditor.md`.

NOT RUN:
1. `npm test`, `npm run typecheck`, `npm run lint`, Playwright, or browser screenshots - not run because this is a read-only background UX audit with only a handoff write.
2. DB migrations, seeds, worker ticks, managed DB gates, deploy proof, or live service continuity checks - not run by policy and scope.
3. SSH, tmux, systemd, live bot start/stop/restart/apply-config/retest, exchange API calls, provider DB queries, `.env` reads/mutations - not run and intentionally avoided.
4. Admin provider-account mapping actions - not implemented in this read-only lane.

## Next actions
1. Add a "configuration source" band to user settings: defaults, selected profile, saved WTC version, provider snapshot, mapping pending, mapping verified.
2. Fix Legacy provider count cards so zero accounts render as zero/pending, not one implied pub_id.
3. Add a dense Legacy per-symbol/stage matrix above the current editable cards with source chips and mapping state.
4. Add Tortila source/default/custom chips per coin and a profile-diff summary without live apply.
5. Add admin provider-account mapping controls only on `/admin/users/[userId]/bots`: fixed target user/bot, provider `legacy-db`, provider account id, label, status `needs_review|active`, required reason, CSRF, `assertAdmin`, Zod, and repository audit. Do not edit `bot_configs`.
6. Surface `needs_review` provider accounts on the admin user drilldown as "unverified mapping exists" instead of only "provider account pending".
7. Mask full pub_id values in `/admin/bots` by default or add audited reveal before using fleet rows as mapping source.
8. Add integration/static tests proving admin drilldown has no user config edit forms, no live control buttons, mapping actions use the audited repository path, and user pages fail closed on missing/ambiguous Legacy mapping.
