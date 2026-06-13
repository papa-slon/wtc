# LEGACY_SETTINGS_SPEC.md — Legacy (DCA/averaging) Bot premium settings page

**Owner doc for the build agent.** Target route: `/app/bots/legacy/settings`.
Goal: a **native, premium, calm** settings experience for the RSI/CCI + DCA/averaging + "Tetris" stage model — same bar as the Tortila settings page — replacing the cluttered `LegacyAveragingConfigTable.tsx`. Pure RENDER swap; the save path is unchanged and byte-compatible.

Constraint that overrides everything: **only the REAL save path. `FEATURE_LIVE_BOT_CONTROL=false` → settings save to a WTC-versioned config ONLY.** The DCA bot has a REAL destructive write API — NO apply/start/stop/push-to-exchange buttons anywhere. The "nothing is pushed to a live exchange" disclaimer is load-bearing; keep ONE quiet copy on the save bar.

---

## 0. The mechanism — pure render swap (KEEP, do not touch)
- File: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`. The new editor `LegacyAveragingConfigEditor` is swapped in at lines 343-352 for `<LegacyAveragingConfigTable/>`. Same `<form id="custom-settings" action={saveBotConfigAction}>`, same `<CsrfField/>`, same hidden `bot` input, same `operationMode` select, same `saveIssue` plumbing.
- Save path (KEEP): `saveBotConfigAction` → `assertCsrf` → `handleSaveBotConfigAction` → `persistBotConfig`. Validation: `botConfigFirstFormIssue`/`botConfigFormIssues` → `legacySymbolConfigsFromForm`/`legacyStageConfigsFromForm` (config.ts:644-693) parse `formData.get('legacy_*_{i}')` by index. Error copy: `botConfigErrorCopy` with targets `legacy-row`/`legacy-stage` + `row` index. Row limits: `LEGACY_SYMBOL_ROW_LIMIT=14`, `LEGACY_STAGE_ROW_LIMIT=4`.
- **Because the editor posts byte-identical `name` attributes, ZERO server/action/schema/error-copy changes are needed.** Same swap pattern proven for `TortilaCoinConfigEditor`.

---

## 1. EXHAUSTIVE preserved save contract (byte-for-byte — the acceptance gate)
Every `name` MUST be emitted with the same index suffix, or `legacySymbolConfigsFromForm`/`legacyStageConfigsFromForm` silently falls the row back to defaults and the user's edits vanish.

**Per coin, index `i` in `0..13`:**
- `legacy_symbol_{i}` — visible coin combobox (typed dash-format supported).
- `legacy_symbol_custom_{i}` — **KEEP as a hidden empty input** folded into the one coin field (server resolves `custom || selected`).
- `legacy_active_{i}` — Enabled/Paused.
- `legacy_tf_{i}` — `1m|3m|5m|15m|1h`.
- `legacy_signal_{i}` — `rsi|cci` (drives which threshold pair is visible).
- `legacy_rsi_len_{i}`, `legacy_rsi_thr_{i}` — shown when signal=rsi.
- `legacy_cci_len_{i}`, `legacy_cci_thr_{i}` — shown when signal=cci.
- **CRITICAL:** when one trigger is selected, the OTHER trigger's pair MUST still be emitted as **hidden mirror inputs** carrying current values (the existing table does this at LegacyAveragingConfigTable.tsx:488-489 and 519-520). `legacySymbolConfigSchema` validates `legacy_rsi_*` AND `legacy_cci_*` on EVERY row regardless of `legacy_signal` (config.ts:524-527) — drop the inactive pair and the Zod row parse fails.
- `legacy_stage_{i}` — stage slot group (number).
- `legacy_tp_{i}` — take-profit % (default 0.5; surface +0.45% as hint/placeholder).
- `legacy_entry_{i}` — initial entry %.
- `legacy_balance_{i}` — balance %.
- `legacy_lev_{i}` — leverage.
- `legacy_levels_{i}` — averaging levels (DCA depth cap).
- `legacy_drops_{i}` — drop ladder % (comma list).
- `legacy_volumes_{i}` — volume ladder % (comma list).
- `legacy_delay_on_{i}` + `legacy_delay_bars_{i}` — delay filter.
- `legacy_delta_on_{i}` + `legacy_delta_{i}` — delta filter.

**Per stage, index `i` in `0..3`:** `legacy_stage_slot_{i}` (stage id), `legacy_stage_rsi_{i}` (RSI capacity), `legacy_stage_cci_{i}` (CCI capacity).

**Form-level (KEEP):** `operationMode`, `bot` (hidden), `CsrfField` (hidden CSRF token).

> **Full preserved list (24 legacy_* + 3 form-level):** `legacy_symbol_{i}`, `legacy_symbol_custom_{i}`, `legacy_active_{i}`, `legacy_tf_{i}`, `legacy_signal_{i}`, `legacy_rsi_len_{i}`, `legacy_rsi_thr_{i}`, `legacy_cci_len_{i}`, `legacy_cci_thr_{i}`, `legacy_stage_{i}`, `legacy_tp_{i}`, `legacy_entry_{i}`, `legacy_balance_{i}`, `legacy_lev_{i}`, `legacy_levels_{i}`, `legacy_drops_{i}`, `legacy_volumes_{i}`, `legacy_delay_on_{i}`, `legacy_delay_bars_{i}`, `legacy_delta_on_{i}`, `legacy_delta_{i}`, `legacy_stage_slot_{i}`, `legacy_stage_rsi_{i}`, `legacy_stage_cci_{i}`, plus `operationMode`, `bot`, CSRF field.

---

## 2. The premium settings UX — design (zones A/B/C, mirror Tortila)
Single calm page. House palette, Inter UI, mono for numbers. **Reuse `tset-*` CSS verbatim** (`tset-root`, `tset-toolbar`, `tset-coin-grid`, `tset-coin-card`, `tset-coin-head`, `tset-coin-id`, `tset-sys-chip`, `tset-field`, `tset-field-grid`, `tset-seg`/`tset-seg-btn`, `tset-input`, `tset-label`, `tset-hint`, `tset-caps`, `tset-savebar`, `tset-inline-error`, `tset-visually-hidden`). Port the `useState` slot model + add/remove-coin pattern from `TortilaCoinConfigEditor`.

### Zone A — Header strip (one line) — lives on settings/page.tsx, KEEP as-is
`SectionHeader` kicker `Legacy Bot — Settings`, title `Configuration`. ONE `effectiveStatus` `StatusPill` (system v{n} / custom v{n} / default settings). `BotSubNav`. The one quiet storage note (postgres) or in-memory dev banner. **Strategy mode** select (`operationMode`) at the top of the form (real saved field).

### Zone B — Per-coin DCA cards (the heart — replaces the 14-row spreadsheet body)
One `tset-coin-card` per configured coin (NOT a fixed 14-slot grid of empty rows). "+ Add coin" appends a card via the slot `useState`; "×" removes (min 1). Cap at 14 with a quiet "max 14 coins" note.
- **Card header (`tset-coin-head`):** coin symbol + at most ONE small chip — the trigger chip `RSI`|`CCI` (or a combined `Stage N · RSI` chip) + a single state chip Enabled/Paused. Remove (×) button. **No pill confetti.**
- **Hidden:** `<input type="hidden" name={`legacy_symbol_custom_${i}`} value="" />`.
- **Field grid (`tset-field-grid`):**
  - **Coin** — combobox (`InstrumentPicker`/datalist over `instrumentOptionsForBot('legacy_bot', …)`) → `legacy_symbol_{i}`. ONE field.
  - **Status** — segmented Enabled/Paused → `legacy_active_{i}`.
  - **Timeframe** — segmented control writing a visually-hidden `<select name={`legacy_tf_${i}`}>` (`1m/3m/5m/15m/1h`), mirroring the Tortila tf pattern.
  - **Trigger** — segmented `RSI|CCI` → `legacy_signal_{i}`; conditionally shows the matching length+threshold pair and KEEPS the inactive pair as hidden mirror inputs (the contract).
  - **RSI length / threshold** → `legacy_rsi_len_{i}` / `legacy_rsi_thr_{i}` (when RSI; hints 2-100, 1-100).
  - **CCI length / threshold** → `legacy_cci_len_{i}` / `legacy_cci_thr_{i}` (when CCI; hints 2-100, -500..500).
  - **Stage slot group** → `legacy_stage_{i}`.
  - **Take-profit %** → `legacy_tp_{i}` (default 0.5; hint "Fixed take-profit. This bot uses no stop-loss.").
- **Collapsed per-card `<details>` "Position sizing & averaging ladder":** `legacy_entry_{i}`, `legacy_balance_{i}`, `legacy_lev_{i}`, `legacy_levels_{i}` (hint ties to the stats "how stuck" metric), `legacy_drops_{i}`, `legacy_volumes_{i}`, `legacy_delay_on_{i}` + `legacy_delay_bars_{i}`, `legacy_delta_on_{i}` + `legacy_delta_{i}`.

### Zone B.2 — Stage capacity (ONE compact collapsed `<details>`, 4 rows)
The "Tetris" caps. 4 stage rows: `legacy_stage_slot_{i}` (stage id), `legacy_stage_rsi_{i}` (RSI slots), `legacy_stage_cci_{i}` (CCI slots). **KEEP** the useful client-side usage readout but render it as ONE quiet plain-mono line per stage (e.g. `Stage 1: 2/3 RSI · 1/2 CCI`) — **NOT** a `StatusPill` grid + resolution table. Keep the `stageUsageRows` math, drop the visual clutter.

### Zone C — Save bar + supporting cards (reuse Tortila chrome)
- `tset-savebar`: `Save custom settings` primary (existing submit) + ONE line "Saving appends a versioned profile to your account. Nothing is pushed to a live exchange or bot." Disabled when `!canCustomize`.
- Advanced `<details>` for remaining `botConfigFieldsFor('legacy_bot')` extras (KEEP).
- **Supporting cards below the form STAY as-is (real, honest read-only evidence — only the editor BODY is redesigned):** Provider runtime snapshot, Legacy provider accounts, Reference profiles (`applyBotPresetAction`), Export current reference config (KEEP its exactly-one-mapped-pub_id guard), Version history, Safety events.

### Validation & feedback (KEEP the existing pattern)
On invalid save, server redirects with `?err=config` + issue metadata; `botConfigErrorCopy` produces the inline message rendered at the offending coin card / stage row via the existing `aria-invalid` + `aria-describedby` + `scrollMarginTop:96` focus pattern, targets `legacy-row`/`legacy-stage` + `row=i+1` (page.tsx already passes `saveIssue` at line 350). No client-side "valid ✓" theater.

---

## 3. What NOISE to DELETE from `LegacyAveragingConfigTable.tsx`
| Delete | Why |
|---|---|
| The **"Trigger resolution map"** section entirely — `resolutionRows`/`stageResolutionRows` table + candidate-label strings ("#3 SYMBOL 3m RSI 14<=20") + the "WTC does not assign a hidden priority order" disclaimer (lines 287-335). | The settings-page equivalent of the banned "operation/strategy map" theater — the legacy twin of the Codex noise stripped from Tortila. The honest usage signal survives as the ONE quiet per-stage mono readout in Zone B.2. |
| The **top toolbar 7-`StatusPill` cluster** (active coins / RSI / CCI / delay / delta / pub_ids — lines 276-284) + the resolution-map "overloaded/full buckets" + "RSI/CCI bucket" pills. | Pill wall. Collapse to at most ONE source pill + a quiet "N active coins" count line (mirror the Tortila editor's restraint). |
| The separate **"Manual symbol override"** visible input per row (lines 402-414). | Fold into the one coin combobox; keep `legacy_symbol_custom_{i}` as a hidden empty input. |
| **Per-row 5-`StatusPill` confetti** (enabled/paused + signalLabel + "Stage X / SIGNAL slot" gold pill + delay/delta on/off — lines 382-388) and the `wtc-kicker` "reference profile slot N" / "pub_id …" per-row labels. | Reduce to coin symbol + ONE system/trigger chip + ONE state chip in `tset-coin-head`. |
| The bottom **"Stage capacity"** duplicate header + its 4-`StatusPill` totals row (lines 598-616) and the full `wtc-table` stage grid with per-cell Usage/Status pills (lines 618-725). | Replace with the compact collapsed stage group + plain-mono usage readout (Zone B.2). |
| The **three stacked "Source: … / WTC does not … / Saving still only writes a WTC-side reference profile"** paragraphs repeated per section (lines 266-274, 299-304, 601-606). | Keep ONE quiet "nothing is pushed to a live exchange" line on the save bar. |
| The **`LEGACY_STAGE_CAPACITY_DRAFT_EVENT` custom-event dispatch** (`dispatchDraftStageCapacityPreview`, lines 138-140, 237-240) IF it only feeds a deleted preview panel. | **VERIFY no other consumer** (config-review.ts / any draft-pressure panel) before removing; otherwise keep the dispatch but drop only the visual. Logged as an open question. |

The editor stays a single client component over the same form. No new server code. Reuse the `aria-invalid`/`scrollMarginTop` inline-error pattern. `FEATURE_LIVE_BOT_CONTROL=false`: no apply/start/stop/push controls anywhere.

---

## 4. Acceptance test
A non-technical user lands on `/app/bots/legacy/settings`, sees configured coins as clean cards, clicks "Add coin", searches a symbol, picks RSI or CCI and sets its params + stage + TP, sets the averaging ladder in the collapsed `<details>`, sees the compact stage-capacity usage, clicks Save → clean confirmation + new version in history — without ever seeing "trigger resolution map", "candidate label", a pill wall, or repeated disclaimers. **The POSTed form is byte-compatible with the current `saveBotConfigAction` contract** (every name in §1 present, incl. the inactive-trigger hidden-mirror inputs).