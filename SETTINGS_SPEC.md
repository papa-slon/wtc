# SETTINGS_SPEC.md — Tortila premium settings UX

**Owner doc for the build agent.** Target route: `/app/bots/[bot]/settings` (Tortila).
Goal: a **native, intuitive, premium** settings experience — pick coins, configure each one (timeframe / Turtle system / risk / stop / add / units / ATR / TP), see it clearly, save. Like a paid product, **not a code editor or a status-panel constructor**.

Constraint that overrides everything: **only wire the REAL save path. No fake controls, no live-exchange-apply buttons.** The save mechanism already exists and is solid — the work is a clean redesign of the UI around it, plus deleting noise.

---

## 1. What exists today (and the problem)

File: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`

**The real, working save path (KEEP — do not touch the logic):**
- Server action `saveBotConfigAction(formData)` → `assertCsrf(formData)` → `handleSaveBotConfigAction(...)` → `persistBotConfig(userId, productCode, config, 'manual edit')`. CSRF is enforced via `<CsrfField />`; the form posts `bot` (hidden) + per-row fields.
- Per-coin fields are named by index `0..7`: `symbol_{i}`, `symbol_custom_{i}`, `tf_{i}`, `system_{i}`, `risk_{i}`, `stop_{i}`, `add_{i}`, `maxUnits_{i}`, `atr_{i}`, `tp_{i}` — parsed by `botConfigFormInput` / `tortilaSymbolConfigsFromConfig`. Portfolio caps: `maxOpenSymbols`, `maxTotalUnits`, `maxUnitsPerDirection`, `haltDrawdownPercent`, `dailyMaxLossPercent`, `maxNewEntriesPerTick`. Also `operationMode` (strategy mode select) + the `TORTILA_FIELDS` extras (`leverage`, …).
- Validation: `botConfigSchemaFor('tortila_bot')` (Zod), with field-level error copy via `botConfigErrorCopy` and inline `saveIssue` highlighting per row (`tortila-row` + `row` index) and per cap (`tortila-cap`).
- Config shape (`apps/web/src/features/bots/config-types.ts` → `TortilaSymbolConfig`): `symbol, timeframe('1h'|'4h'), system(1|2), riskPercent, stopN, addStep, maxUnits, atrPeriod, takeProfitRr`.
- Other server actions on the page (KEEP): `applyBotPresetAction`, `useSystemDefaultAction`, `checkExchangeKeyMetadataAction` (all CSRF-guarded).

**The problem — the page is buried in the same Codex noise as the stats page.** Before the actual config form, the render stacks SIX status/constructor panels:
1. `BotSetupControlCenter` — "command center / constructor"
2. `BotSettingsQuickPath` — quick-path ladder
3. `BotReadinessMap` — "Settings readiness map"
4. `BotContinuityPanel` — **"Settings continuity monitor"** (settings evidence rows, runtime proof theater)
5. `BotConfigReviewPanel` — config review facts
6. `BotOperationMapPanel` — **"How this bot will operate"** operation map

And inside the actual config table (`TortilaSymbolConfigTable.tsx`) there is more junk wrapped around the real inputs:
- a **"Tortila strategy map"** preview table (groups rows by system, "candidate labels", "risk shape", "position guardrails")
- a **"Portfolio caps"** draft-pressure table ("draft over reference cap", "reference cap reached")
- a **"Runtime export preview"** `<details>` with a generated `SYMBOL_CONFIGS` string + "Copy draft SYMBOL_CONFIGS" button
- per-row `StatusPill` clutter and a separate **"Manual symbol override"** input sitting next to the coin picker.

This is the editor-feeling, panel-heavy mess. The redesign removes all of it and keeps a clean coin configurator over the same form fields.

---

## 2. The premium settings UX — design

A single, calm, three-zone page. House palette (`--panel`, `--stroke`, `--gold2`, `--green`, `--red`), Inter UI, mono for numbers — same premium language as the stats dashboard so the two pages feel like one product.

### Zone A — Header strip (one line)
- `SectionHeader` kicker `Tortila — Settings`, title `Configuration`.
- ONE `StatusPill` showing the effective source: `system v{n}` (gold) / `custom v{n}` (ok) / `built-in fallback` (warn). (Reuse existing `effectiveStatus`.)
- `BotSubNav` (keep — it's the bot's own tab nav, not noise).
- A storage note ONLY when not Postgres-backed (the existing in-memory/dev warning). When Postgres, show nothing or a tiny "saved to your account" hint.
- **Delete** panels 1–6 from Section 1. None of them render here.

### Zone B — Coin picker + per-coin config cards (the heart)
This replaces `TortilaSymbolConfigTable`'s cluttered body. Build a clean **portfolio-of-coins** editor:

- **Coin picker / add-coin:** a single prominent control to add a coin to the portfolio — a searchable combobox over the Tortila/BingX swap catalog (`instrumentOptionsForBot('tortila_bot', …)`, already wired via `InstrumentPicker` + `<datalist>`). Picking a coin adds a config card. A user can type a CCXT swap symbol (e.g. `XRP/USDT:USDT`) for anything not in the catalog — **fold the "Manual symbol override" into this one field** (datalist + free text already supports it; drop the separate `symbol_custom_{i}` UI and just post the typed value into `symbol_{i}`, OR keep `symbol_custom_{i}` hidden/merged so the save contract is unchanged — builder's choice, but the user sees ONE coin field).
- **Per-coin config card** (one card per active coin, not a fixed 8-slot grid of mostly-empty rows): header = coin symbol + a side-neutral chip for `System {1|2}` + a small remove (×) button. Body = a tidy field grid:
  - **Timeframe** — segmented control or select: `4h` / `1h`.
  - **Turtle system** — `System 2 (55/20)` / `System 1 (20/10)` with a one-line plain-English hint.
  - **Risk %** — number, step 0.1, with a subtle low/standard/elevated band hint.
  - **ATR stop (N)** — number, step 0.5.
  - **Add step (N)** — number, step 0.25.
  - **Max units** — number, step 1.
  - **ATR period** — number, step 1.
  - **Take-profit (R)** — number, step 1; `0` shown as "off".
  - Labels small + muted; inputs `wtc-input`; values readable. No per-field `StatusPill` spam.
- **Add / remove coin:** "Add coin" appends a card; "×" removes it. Empty/blank rows are simply not rendered (the save layer already ignores blank `effectiveSymbol`). Cap at 8 coins (`TORTILA_SYMBOL_ROW_LIMIT`) — show a quiet "max 8 coins" note when reached, not an error panel.
- **Portfolio caps:** keep these as ONE small, collapsed-by-default group (max open symbols, max total units, units per direction, drawdown halt %, daily loss halt %, entries per tick). They are real saved fields. Present as a simple labeled input grid — **delete the "draft pressure" comparison table and all the "draft over reference cap" status rows.** A single inline error if a cap is violated on save (reuse `tortila-cap` `saveIssue`).
- **Delete:** the "Tortila strategy map" preview table, the "candidate label" strings, the "Runtime export preview" `<details>` + "Copy draft SYMBOL_CONFIGS" button. (The legit JSON export already lives in its own "Export current reference config" card lower on the page via `/api/bots/[bot]/config-export` — keep that one card, drop the inline copy widget.)

### Zone C — Save bar + supporting cards
- **Sticky/clear Save bar:** `Save custom settings` primary button (the existing submit of `#custom-settings` form) + a one-line helper "Saving appends a versioned profile to your account. Nothing is pushed to a live exchange." Disabled when `!canCustomize` (locked system default) with a plain reason.
- **Strategy mode** select (`operationMode`) stays — place it at the top of the form (it's a real saved field).
- **Reference profiles** card (presets → `applyBotPresetAction`) — keep, it's a genuine one-click baseline feature. Trim copy.
- **Private exchange connection** (`ExchangeKeyReadinessPanel`) — keep (Tortila), it's real key state, not theater. It already lives in its own card.
- **Export current reference config** — keep (one card, real download).
- **Version history** + **Safety events** tables — keep (real, audited, honest). These are fine; they're plain tables, not constructor panels.

### Validation & feedback
- On invalid save, the server redirects back with `?err=config` + issue metadata; `botConfigErrorCopy` produces the inline message. Render it **at the offending coin card / cap field** (reuse the existing `aria-describedby` + `scrollMarginTop` focus pattern, which is good UX) — just inside the new clean cards instead of the old cluttered ones.
- No client-side fake "valid ✓" theater. Show errors only when they exist.

---

## 3. Data / actions: exist vs. need adding

**Already exists — reuse, no new backend:**
- Save: `saveBotConfigAction` → `handleSaveBotConfigAction` → `persistBotConfig` (CSRF-guarded). ✅
- Field parse + Zod validation + error copy: `botConfigFormInput`, `botConfigSchemaFor`, `botConfigErrorCopy`, `tortilaSymbolConfigsFromConfig`, `serializeTortilaSymbolConfigs`. ✅
- Catalog: `instrumentOptionsForBot('tortila_bot', …)` + `InstrumentPicker`. ✅
- Presets / system-default / exchange-key-check actions. ✅
- Current config load: `loadBotConfig(user.id, meta.code)` → `state.current`, `state.versions`, `state.safety`, `state.source`. ✅

**Needs building (UI only):**
- New presentational components to replace `TortilaSymbolConfigTable`'s body: a `CoinConfigCard` + an "add coin" control + a collapsed `PortfolioCapsGroup`. **They MUST keep the exact same input `name` attributes** (`symbol_{i}`, `tf_{i}`, `system_{i}`, `risk_{i}`, `stop_{i}`, `add_{i}`, `maxUnits_{i}`, `atr_{i}`, `tp_{i}`, cap names) so the unchanged server action parses them. This is a pure render swap inside the existing `<form id="custom-settings" action={saveBotConfigAction}>`.
- Dynamic add/remove is already a client `useState` pattern in `TortilaSymbolConfigTable` — port that state model, drop the preview tables.
- Premium CSS: reuse `--gold2/--green/--red/--panel/--stroke` and add a small `.set-*` (or reuse `wtc-*`) block in `globals.css` for the coin-card grid. Match the `.tov-*` density so settings and stats look like one product.

**Must NOT add:** any "Apply to live bot", "Push to exchange", "Start/Stop", "Test connection" control. `FEATURE_LIVE_BOT_CONTROL=false` on the canary; the save path is **WTC-versioned config only**. Every existing disclaimer ("not pushed to a live bot") stays true — keep a single quiet version of it, delete the repeated triple-copies.

---

## 4. Premium visual rules (settings)

- Same tokens/typography as `STATS_SPEC.md` §4. Inter UI; mono for numeric inputs' helper readouts; `--gold2` for the few section headers; `--green`/`--red` only for real save success/error.
- One card per coin, `auto-fill minmax(~300px,1fr)` grid or a single column of full-width cards — readable, not a dense spreadsheet. Inputs grouped 4-up on wide, stacking on narrow.
- Collapsed portfolio caps + collapsed advanced (`leverage`, etc.) so the default view is just "your coins + save".
- Zero `StatusPill` confetti. A coin card needs at most: its system chip. That's it.
- Keep the existing accessibility wins: labeled inputs, `aria-invalid`, focusable error anchors, `data-label` on any remaining tables.

**Acceptance test:** a non-technical user lands on the page, sees their configured coins as cards, clicks "Add coin", searches `SOL`, sets TF/system/risk/stop/TP, clicks Save, gets a clean confirmation + new version in history — without ever seeing the words "evidence", "continuity", "operation map", "draft pressure", "candidate label", or a copy-paste `SYMBOL_CONFIGS` box. The POSTed form is byte-compatible with the current `saveBotConfigAction` contract.
