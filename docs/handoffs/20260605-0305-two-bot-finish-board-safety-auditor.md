# two-bot-finish-board-safety-auditor handoff
## Scope
Read-only safety/RBAC/source-boundary audit for the planned `/app/bots` two-bot finish board before implementation. The audit focused on what a normal user may safely see, and what the board must not do or imply: entitlement scoping, no admin data, no exchange secrets, no provider URLs/raw JSON, no live start/stop/apply/test connection, no fake green continuity, and no Legacy closed-trade analytics overclaim.

## Files inspected
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/readiness-loader.ts`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/config-review.ts`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/runtime-config-sanitizer.ts`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/NEXT_ACTIONS.md`
- `tests/integration/bot-read-safety-static.test.ts`

## Files changed
`docs/handoffs/20260605-0305-two-bot-finish-board-safety-auditor.md`

## Findings
1. P0 - The finish board must remain entitlement-first and must not read bot data for locked products. Evidence: `/app/bots` requires a user, checks `botAccessForUser`, and only calls `loadBotReadModelForUser(user.id, b.code, ['metrics', 'warnings'])` when `access.allowed` is true (`apps/web/src/app/(app)/app/bots/page.tsx:16-23`). Locked rows explicitly hide adapter status (`apps/web/src/app/(app)/app/bots/page.tsx:81-87`). Static coverage already pins this pattern (`tests/integration/bot-read-safety-static.test.ts:80-83`). Recommendation: keep the board per-product and derive locked cards only from bot metadata plus access reason; do not call readiness/read loaders for locked rows beyond the loader's own denied DTO path unless the code remains visibly fail-closed. Target part: `/app/bots` data loop and finish board cards.

2. P0 - The finish board may show normal-user bot status, readiness, settings source, metadata counts, warnings, and read-only statistics only through existing user-scoped loaders; it must not import admin loaders or show any admin/user list. Evidence: production DB reads are scoped by `botInstances.userId` and product code (`apps/web/src/features/bots/data.tsx:432-438`), Legacy runtime facts require exactly one active mapped provider account (`apps/web/src/features/bots/data.tsx:450-490`), and non-mock mode refuses global adapter fallback (`apps/web/src/features/bots/data.tsx:710-727`). Recommendation: use `loadBotReadModelForUser` and `loadBotReadinessForUser` only; do not import from `features/admin`, do not link to `/admin/users`, and do not expose owner/pub-id management affordances on the user board. Target part: board loader imports and CTAs.

3. P0 - The board must not expose exchange secrets, provider URLs, raw provider payloads, raw runtime JSON, or plaintext provider identities. Evidence: user config rejects secret/control/provider/raw keys including `apikey`, `secret`, `providerpubid`, `provideraccounts`, `liveconfig`, `rawjson`, provider URLs, `applyconfig`, `startbot`, `stopbot`, `retest`, and `testexchange` (`apps/web/src/features/bots/config.ts:839-895`). Runtime config sanitizer removes the same class of forbidden keys and only returns a safe raw view after sanitization (`apps/web/src/features/bots/runtime-config-sanitizer.ts:3-37`, `apps/web/src/features/bots/runtime-config-sanitizer.ts:86-121`). Recommendation: finish board copy may show counts/states such as "WTC vault metadata confirmed", "1 provider pub_id mapped", or masked/safe identity already emitted by existing panels, but must not render `rawJson`, `liveConfig`, provider URL, exchange URL, API key metadata beyond counts, or full pub_id values. Target part: any new summary rows or detail cards.

4. P0 - The board must not add or imply live start/stop/apply/test-connection controls. Evidence: safety model says all controls are disabled until required gates pass and adapter methods throw `ControlDisabledError` (`docs/BOT_CONTROL_SAFETY_MODEL.md:13-23`); WTC must never use systemd/tmux/process kill, mutate `.env`, call exchanges, read bot API keys, or clear bot state (`docs/BOT_CONTROL_SAFETY_MODEL.md:36-42`); current evidence pages must show no runtime control buttons or even disabled placeholders without separate audit (`docs/BOT_CONTROL_SAFETY_MODEL.md:70-82`); the action matrix keeps write config/start/stop/exchange/SSH/env/order/key reads at "No/Never" until future audited gates (`docs/BOT_CONTROL_SAFETY_MODEL.md:257-269`). Recommendation: allowed CTAs are navigation only: dashboard, setup, settings, statistics, safety. Forbidden labels and behavior include "Start", "Stop", "Apply", "Restart", "Retest", "Test connection", "Connection verified", "Ping exchange", and disabled live-control teasers. Target part: board actions/buttons and copy.

5. P0 - The board must not show fake green continuity. Evidence: user readiness loads aggregate `target='worker'` only in operational surfaces, computes age, blocks error/unreachable/malformed states, and requires a fresh row no older than `WORKER_CONTINUITY_STALE_AFTER_SECONDS` before readiness can be green (`apps/web/src/features/bots/readiness-loader.ts:118-196`). Readiness copy says a fresh worker row is still not permission to start/stop/apply live config (`apps/web/src/features/bots/readiness.ts:120-132`). Phase 4.44 docs record that stale worker rows cannot make `/admin/bots` green (`docs/NEXT_ACTIONS.md:3-7`). Recommendation: derive the board's "continuity" lane from `readiness.items`/runtime worker detail, not from `read.health.status` alone. Stale, missing, mock/demo, not_configured, unscoped, or blocked rows must stay attention/blocked and must never become a completion checkmark. Target part: finish board completion score/status derivation.

6. P1 - The board may summarize settings progress, but it must keep settings distinct from live runtime and exchange connectivity. Evidence: config source text distinguishes user override, system default, and built-in fallback, and explicitly says admins cannot edit user-owned profiles, provider snapshots are not copied into forms, exchange keys stay encrypted separately, and live exchange apply/connection testing remains disabled (`apps/web/src/features/bots/config.ts:942-960`). `loadBotConfig` reads user-owned config versions through the current user/bot instance (`apps/web/src/features/bots/config.ts:1025-1082`) and `persistBotConfig` validates safe config before saving (`apps/web/src/features/bots/config.ts:1085-1101`). Recommendation: board may show source labels such as user override/system default/built-in, config review metrics, stage capacity warnings, and "open settings" CTAs; it must not say a saved WTC profile is applied to the live bot or connected to an exchange. Target part: settings lane and summary copy.

7. P1 - Legacy statistics must stay honest: show operations/snapshot coverage, not closed-trade analytics unless imported closed trades exist. Evidence: Legacy capability notes state `hasTradeHistory: false` and "Closed-trade analytics are not connected yet" (`apps/web/src/features/bots/meta.ts:69-80`). Legacy operations panel shows "Closed-trade history pending" and says PF, win rate, realized PnL, and attribution stay hidden until WTC imports closed trades for the mapped provider pub_id (`apps/web/src/features/bots/statistics-panels.tsx:586-610`). `NEXT_ACTIONS` blocks Legacy closed-trade import until a source-proof artifact names the durable table/API and field contract; inactive orders/slots and Tortila journal rows are not valid substitutes (`docs/NEXT_ACTIONS.md:60-64`). Recommendation: the finish board may show "Legacy operations snapshot/slots/orders available" and "closed trades pending"; it must not show Legacy PF/win-rate/realized-PnL as ready unless `closedTradeCount > 0` comes from the scoped read model. Target part: statistics lane and combined portfolio summary.

8. P1 - The board may use existing two-product metadata and direct user CTAs, but should not blend strategy analytics across bots. Evidence: bot list metadata defines exactly Tortila and Legacy (`apps/web/src/features/bots/meta.ts:20-23`), current `/app/bots` combines only entitled bot metrics (`apps/web/src/app/(app)/app/bots/page.tsx:26-31`, `apps/web/src/app/(app)/app/bots/page.tsx:53-68`), and current copy says win rate/profit factor are per-bot, never averaged across strategies (`apps/web/src/app/(app)/app/bots/page.tsx:65-67`). Recommendation: finish board can show an ecosystem-level "2 bots" overview and per-bot lanes, but PF/win-rate/drawdown must remain per bot; combined cards should be limited to safe additive metrics and count/state summaries. Target part: top summary and per-bot metric cards.

## Decisions
- Safe user-visible finish board inputs: `BOT_LIST`/`BOT_CAPS`, `botAccessForUser`, `loadBotReadModelForUser(user.id, code, ['metrics', 'warnings'])`, `loadBotReadinessForUser(user, code, 'dashboard', { access, read })`, and derived/presentational helpers from existing readiness/config/statistics models.
- Safe user-visible finish board outputs: access state, settings source label/detail, exchange key metadata state/count for Tortila, provider mapping state/count for Legacy, worker heartbeat freshness/age/detail, runtime read state, warning summary, metrics availability, Legacy closed-trade pending state, direct navigation CTAs to dashboard/setup/settings/statistics/safety.
- Forbidden inputs: `loadBotReadModel` adapter-only fallback, `getBotAdapter`, direct `fetch`, provider/admin loaders, `features/admin/*`, vault openers, raw DB secret tables, raw provider payloads, provider URLs, or admin user fleet records.
- Forbidden outputs/actions: live start/stop/apply/restart/test connection, "connection verified", exchange ping, full pub_id/provider URL/raw JSON/liveConfig, admin owner lists, fake all-clear/no-warning copy, green continuity from stale/missing/mock rows, and Legacy PF/win-rate/realized-PnL completion without closed-trade imports.

## Risks
- If implementation computes a single "finish percent" naively, locked products, stale worker rows, built-in fallback configs, or Legacy closed-trade gaps could appear as done. Use explicit lane statuses (`ready`, `attention`, `blocked`, `readonly`) instead of a single optimistic percentage.
- If the board calls `loadBotReadinessForUser` for every product without reusing the existing `read`, it can duplicate DB reads. This is acceptable for a small page if scoped, but safer implementation should pass `{ access, read }` for entitled rows and preserve no-read behavior for locked rows.
- If provider identity from `statistics-panels` is reused directly, only masked/safe identity should appear. Full pub_id should remain admin/worker-internal unless already masked by the existing safe presentation.
- The worktree is heavily dirty. The implementer must avoid broad rewrites and preserve existing static safety assertions while adding board-specific assertions.

## Verification/tests
Read-only audit only. No product tests were run and no product/source/test files were edited.

Recommended test additions for `tests/integration/bot-read-safety-static.test.ts` after implementation:
- Assert `/app/bots` still imports/uses `botAccessForUser`, calls user read data only behind `access.allowed`, and keeps the existing "adapter status hidden until entitlement is active" behavior.
- Assert `/app/bots` uses `loadBotReadinessForUser` or a pure helper fed by `readiness.items` for the finish board, and does not derive continuity from `read.health.status` alone.
- Assert `/app/bots` has no forbidden imports/strings: `features/admin`, `loadAdmin`, `getBotAdapter`, `fetch(`, `vault.open`, `startBot`, `stopBot`, `applyConfig`, `retest`, `apiKey`, `apiSecret`, `sealed`, `Connection verified`, `test connection`, `providerUrl`, `rawJson`, `liveConfig`.
- Assert `/app/bots` contains explicit no-live-control copy such as `Start/stop/apply disabled` or `Live controls remain disabled`.
- Assert `/app/bots` contains Legacy honesty copy such as `closed-trade history pending`, `closed trade imports pending`, or `Legacy statistics are snapshot/projection based until closed-trade history is available`.
- Assert `/app/bots` links only to user routes (`/app/bots/${slug}`, `/app/bots/${slug}/setup`, `/app/bots/${slug}/settings`, `/app/bots/statistics`, `/app/bots/${slug}/safety`) and not `/admin/users` or `/admin/bots`.
- If a new pure board helper is created, add unit/static coverage for stale worker/missing worker/locked access/built-in config/Legacy closed-trade pending cases so none can produce an all-green finish state.

Recommended rendered checks after implementation:
- `npx vitest run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-readiness-builder.test.ts tests/integration/bot-statistics-completion.test.ts`
- `npm run typecheck -- --pretty false`
- `npm run secret:scan`
- `git diff --check`
- If CSS/layout changes are non-trivial, run the existing rendered bot acceptance loop instead of relying only on static checks.

## Next actions
1. Implement the `/app/bots` two-bot finish board as a user-only, entitlement-scoped command board over the existing safe loaders and readiness DTOs.
2. Add board-specific static assertions before or with the implementation so forbidden imports/actions/copy cannot slip in.
3. Keep the board navigation-only: dashboard, setup, settings, statistics, safety. Do not add live control placeholders.
4. Keep Legacy closed-trade analytics non-green until a source-proofed closed-trade import exists and the scoped read model provides closed trades.
