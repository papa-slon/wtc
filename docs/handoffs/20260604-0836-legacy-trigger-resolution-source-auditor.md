# legacy-trigger-resolution-source-auditor handoff
## Scope
Read-only Phase 4.06 bot-integration/source-truth audit for adding or validating a Legacy trigger-resolution map in the WTC settings/setup UI. Scope: determine what wording is safe and truthful about RSI/CCI rows, stage slots, multiple CCI/RSI coins, capacity, runtime evidence, and no live apply.

Out of scope: code edits, live bot start/stop/apply/retest, worker ticks, exchange pings, provider DB mutation, raw provider payload capture, env/secret inspection, SSH, tmux, systemd, preview/canary/prod service checks, and test execution beyond source reads.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/handoffs/20260604-0833-phase-4-05-legacy-draft-control-center.md`
7. `docs/handoffs/20260604-0751-phase-4-03-legacy-stage-capacity-advisory.md`
8. `docs/handoffs/20260604-0808-phase-4-04-legacy-stage-live-preview.md`
9. `docs/CONTRACTS/legacy-bot-adapter.md`
10. `docs/BOT_CONTROL_SAFETY_MODEL.md`
11. `docs/BOT_INTEGRATION_PLAN.md`
12. `apps/web/src/features/bots/config.ts`
13. `apps/web/src/features/bots/config-review.ts`
14. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
15. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
16. `apps/web/src/features/bots/BotConfigReviewPanel.tsx`
17. `apps/web/src/features/bots/config-action-handler.ts`
18. `apps/web/src/features/bots/config-export.ts`
19. `apps/web/src/features/bots/config-types.ts`
20. `apps/web/src/features/bots/data.tsx`
21. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
22. `apps/web/src/features/bots/statistics-panels.tsx`
23. `apps/web/src/features/bots/meta.ts`
24. `apps/worker/src/legacy-live.ts`
25. `packages/bot-adapters/src/legacy/legacy-blocked.ts`
26. `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`
27. `packages/bot-adapters/src/factory.ts`
28. `C:\Users\maxib\GTE BOT\bot\client_server\schemas\trade.py`
29. `C:\Users\maxib\GTE BOT\bot\models.py`
30. `C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py`
31. `C:\Users\maxib\GTE BOT\bot\core\trading_indicators.py`
32. `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Evidence: WTC editable Legacy rows are deliberately modeled as one selected trigger per coin: the schema stores `useRsi` and `useCci`, rejects equal values with "Choose exactly one signal: RSI or CCI", and the form parser derives them from `legacy_signal_*` (`apps/web/src/features/bots/config.ts:71`, `apps/web/src/features/bots/config.ts:98`, `apps/web/src/features/bots/config.ts:516`, `apps/web/src/features/bots/config.ts:650`). The table copy currently says "One coin uses one trigger: RSI or CCI" and "A coin consumes one slot in its selected stage and trigger bucket" (`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:241`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:243`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:246`). Recommendation: safe UI wording is "In WTC's editable profile, each coin row selects one trigger: RSI or CCI." Do not claim the provider DB can only store one true flag, because the Legacy model has separate `use_rsi` and `use_cci` columns (`C:\Users\maxib\GTE BOT\bot\models.py:145`, `C:\Users\maxib\GTE BOT\bot\models.py:146`). Target part: Legacy strategy row wording.

2. Severity: High. Evidence: Stage capacity is source-backed as two separate slot buckets per stage. Legacy source maps `ReasonEnum.YELLOW` to `rsi_slots` and `ReasonEnum.RED` to `cci_slots` (`C:\Users\maxib\GTE BOT\bot\models.py:57`, `C:\Users\maxib\GTE BOT\bot\models.py:64`, `C:\Users\maxib\GTE BOT\bot\models.py:72`), and `StageConfigModel` exposes `stage`, `rsi_slots`, and `cci_slots` (`C:\Users\maxib\GTE BOT\bot\client_server\schemas\trade.py:37`). WTC's resolved config schema mirrors `stage`, `rsiSlots`, and `cciSlots` (`apps/web/src/features/bots/config.ts:121`), and the review/table code compares active rows against those buckets (`apps/web/src/features/bots/config-review.ts:176`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:137`). Recommendation: safe wording is "Stage N has separate RSI and CCI slot budgets" and "capacity state is inside capacity/full/over capacity for the visible WTC profile." Target part: stage-slot and capacity-state copy.

3. Severity: High. Evidence: The trigger-resolution map implementation groups active rows by stage and selected signal, then reports RSI candidates, CCI candidates, used/slot counts, and capacity state (`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:137`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:147`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:150`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:155`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:157`). Its copy is appropriately cautious: "Multiple RSI or CCI coins in the same stage are independent trigger candidates" and "WTC does not assign a hidden priority order from this page" (`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:274`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:276`). Recommendation: keep that wording. Do not say multiple coins will all open, that WTC resolves priority, or that the next admitted coin is known from this screen. Target part: trigger-resolution map.

4. Severity: High. Evidence: Actual Legacy admission is runtime-dependent: indicators dispatch RSI and CCI signals from market data (`C:\Users\maxib\GTE BOT\bot\core\trading_indicators.py:135`, `C:\Users\maxib\GTE BOT\bot\core\trading_indicators.py:141`), trading logic checks duplicate active slots, calls `can_open_extra`, then checks balance and price before adding a slot (`C:\Users\maxib\GTE BOT\bot\core\trading_logic.py:220`, `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py:226`, `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py:231`, `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py:262`). `can_open_extra` counts active slots by api, stage, and reason before admitting a stage (`C:\Users\maxib\GTE BOT\bot\models.py:318`, `C:\Users\maxib\GTE BOT\bot\models.py:351`, `C:\Users\maxib\GTE BOT\bot\models.py:355`, `C:\Users\maxib\GTE BOT\bot\models.py:364`). Recommendation: any claim that a coin "will trigger", "will open", "has free live capacity", "is blocked right now", or "is next in priority" requires live runtime proof from an approved snapshot/run and must not appear in WTC setup copy. Target part: runtime/admission claims.

5. Severity: High. Evidence: WTC's accepted Legacy path is read-only worker snapshots, not live HTTP/control. The contract says the canary path does not call Legacy HTTP management endpoints and does not start/stop/retest/apply config (`docs/CONTRACTS/legacy-bot-adapter.md:24`), and it reads safe provider Postgres columns by `pub_id` (`docs/CONTRACTS/legacy-bot-adapter.md:25`, `docs/CONTRACTS/legacy-bot-adapter.md:34`). The worker selects settings, stages, active slots, and active orders from explicit columns, then rejects secret-looking fields before snapshotting (`apps/worker/src/legacy-live.ts:349`, `apps/worker/src/legacy-live.ts:362`, `apps/worker/src/legacy-live.ts:368`, `apps/worker/src/legacy-live.ts:381`). Recommendation: safe runtime wording is "DB snapshot evidence" only when the WTC worker has persisted a scoped snapshot; otherwise say "provider snapshot pending/unavailable." Target part: runtime-source labels and operations panel.

6. Severity: High. Evidence: Current user-facing read logic hides Legacy runtime facts unless exactly one active `legacy-db` provider mapping exists for the user's bot instance (`apps/web/src/features/bots/data.tsx:451`, `apps/web/src/features/bots/data.tsx:469`, `apps/web/src/features/bots/data.tsx:475`). The operations panel explicitly warns that built-in defaults and saved WTC reference drafts are not runtime evidence (`apps/web/src/features/bots/statistics-panels.tsx:485`, `apps/web/src/features/bots/statistics-panels.tsx:489`). Recommendation: do not label WTC saved/default rows as "running bot config" unless they came from `liveConfig` in a scoped worker snapshot. Target part: setup/settings source badges and statistics links.

7. Severity: High. Evidence: No-live-apply language is already correct in the relevant UI surfaces: the table default source detail says no live Legacy config apply happens from the table (`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:176`), top-control draft warning says saving stores a WTC reference version only and does not apply changes or run live diagnostics (`apps/web/src/features/bots/BotSetupControlCenter.tsx:159`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:162`), and the live-control boundary row says start, stop, live diagnostics, live apply, and position closing are unavailable (`apps/web/src/features/bots/BotSetupControlCenter.tsx:255`). The control model says control methods are disabled at adapter level, not only UI (`docs/BOT_CONTROL_SAFETY_MODEL.md:15`, `docs/BOT_CONTROL_SAFETY_MODEL.md:23`). Recommendation: keep "save/reference/review" verbs and avoid "apply/sync/push/retest/check live" verbs in this UI. Target part: buttons, warnings, and helper text.

8. Severity: Medium. Evidence: The WTC worker normalizes provider settings to one signal by treating `use_cci === true && use_rsi !== true` as CCI and otherwise RSI (`apps/worker/src/legacy-live.ts:99`), then exports `signal`, `useRsi`, and `useCci` into `liveConfig.symbolConfigs` (`apps/worker/src/legacy-live.ts:206`, `apps/worker/src/legacy-live.ts:211`, `apps/worker/src/legacy-live.ts:212`). Recommendation: if the map is later fed by provider snapshots, say "WTC-normalized signal" rather than "provider-exclusive signal" unless Legacy upstream adds an invariant/test proving exactly one flag. Target part: provider-snapshot trigger rows.

9. Severity: Medium. Evidence: Built-in WTC defaults currently include many active stage-1 symbols and default stage capacities of `3 RSI / 2 CCI` for stage 1 and `2 RSI / 1 CCI` for stage 2 (`apps/web/src/features/bots/config.ts:247`, `apps/web/src/features/bots/config.ts:262`). The over-capacity advisory compares rows to these WTC values (`apps/web/src/features/bots/config-review.ts:190`, `apps/web/src/features/bots/config-review.ts:192`, `apps/web/src/features/bots/config-review.ts:207`). Recommendation: it is safe to call this an "advisory/reference capacity check"; it is not safe to imply the live provider currently has the same capacity unless the row source is a current scoped provider snapshot. Target part: advisory severity and source label.

## Decisions
1. Safe primary wording: "One WTC coin row selects one trigger: RSI or CCI. The selected trigger consumes one slot in the coin's stage bucket."
2. Safe multiple-coin wording: "Multiple RSI or CCI coins in the same stage are independent trigger candidates. Stage capacity shows whether the bucket has room; WTC does not assign a hidden priority order from this page."
3. Safe capacity wording: "Capacity compares visible active WTC/profile rows to stage RSI/CCI slot budgets. It is a readiness advisory, not a live bot admission result."
4. Safe runtime wording: "Provider runtime snapshot" or "DB snapshot evidence" only when `legacy-db` worker data is scoped to exactly one active provider pub_id mapping.
5. Unsafe without live proof: "running bot uses this config", "capacity is free right now", "coin will open", "coin is next", "live diagnostics passed", "config applied", "no active slots/orders", or "exchange/provider confirmed."
6. Save wording must remain "stores/saves a WTC reference version"; do not use apply, push, sync, retest, exchange test, or live diagnostics language for this setup/settings UI.

## Risks
1. WTC editable rows and provider snapshot rows share similar shapes; copy must keep the source label visible so users do not confuse reference drafts with live runtime evidence.
2. Legacy provider source can store both `use_rsi` and `use_cci` booleans; WTC normalizes this to one signal for display, but that normalization is not the same as an upstream provider invariant.
3. Static source review can identify safe wording and forbidden claims, but it cannot prove current live capacity, active slot counts, runtime priority, or exchange readiness.
4. The worktree is broadly dirty from earlier phases; this read-only handoff does not claim ownership of any existing dirty code/doc changes.

## Verification/tests
RUN:
1. Required governance/current-state reads: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260604-0833-phase-4-05-legacy-draft-control-center.md`.
2. Source-truth read of WTC Legacy config/review/table/control-center/runtime snapshot code.
3. Source-truth read of Legacy Python schemas, models, indicator dispatch, and trading admission code under `C:\Users\maxib\GTE BOT\bot`, excluding env/secret/key files.
4. Contract/safety read of `docs/CONTRACTS/legacy-bot-adapter.md`, `docs/BOT_CONTROL_SAFETY_MODEL.md`, and `docs/BOT_INTEGRATION_PLAN.md`.
5. `git status --short --branch` - observed a broadly dirty worktree before this handoff; no cleanup attempted.

NOT RUN:
1. Vitest, typecheck, lint, Playwright, build, full CI, coverage, secret scan, governance check - skipped because this was a read-only source-truth audit and no product/test code was edited.
2. Live bot start/stop/apply/retest, live diagnostics, exchange ping, worker tick, provider DB mutation/read, raw provider payload capture, env/vault/secret inspection, SSH, tmux, systemd, preview/canary/prod checks - skipped by explicit scope and safety policy.
3. Git commit, push, PR - not requested.

## Next actions
1. Keep the trigger-resolution map wording source-labeled as WTC reference/profile unless the rows come from a scoped `legacy-db` worker snapshot.
2. Add or keep static/rendered guards for the exact safe phrases above and for forbidden live-control words in Legacy setup/settings copy.
3. If product wants runtime claims, run a separate approved phase that observes a scoped Legacy worker snapshot and documents the exact provider pub_id, snapshot time, active slots, stage configs, and NOT-RUN live-control gates without touching live controls.
