# ecosystem-ux-ui-designer handoff
## Scope
Read-only UX/product audit for Phase 4.08. Scope: inspect the current Tortila settings/setup implementation and latest handoffs, then recommend how to embed top-level Tortila portfolio caps into the existing strategy-map UI so the page feels premium, simple, and clear.

Out of scope: product code edits, test edits, live server mutation, env/secret inspection, provider/API exchange actions, bot start/stop/apply/test, worker ticks, DB/provider reads or writes, deploy/canary checks, and unrelated dirty worktree cleanup.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/STATUS.md`
4. `docs/handoffs/20260604-0921-phase-4-07-tortila-strategy-map.md`
5. `docs/handoffs/20260604-0906-tortila-strategy-ux-auditor.md`
6. `docs/handoffs/20260604-0906-tortila-strategy-source-auditor.md`
7. `docs/handoffs/20260604-0906-tortila-strategy-tests-security-auditor.md`
8. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
9. `apps/web/src/features/bots/config.ts`
10. `apps/web/src/features/bots/config-types.ts`
11. `apps/web/src/features/bots/config-review.ts`
12. `apps/web/src/features/bots/config-error-copy.ts`
13. `apps/web/src/features/bots/BotConfigReviewPanel.tsx`
14. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
15. `apps/web/src/features/bots/BotOperationMapPanel.tsx`
16. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
17. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
18. `tests/e2e/bot-settings.spec.ts`
19. `tests/integration/bot-config-review-static.test.ts`
20. `tests/integration/bot-read-safety-static.test.ts`

## Files changed
None — read-only audit.

Handoff written: `docs/handoffs/20260604-0926-tortila-portfolio-caps-ux-auditor.md`.

## Findings
1. Severity: High. The exact Phase 4.08 gap is already identified: the strategy map now summarizes per-coin max units, but top-level portfolio caps still render below as generic fields. Evidence: `docs/handoffs/20260604-0921-phase-4-07-tortila-strategy-map.md:67`; `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:255`; `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:256`. Recommendation: embed a `Portfolio caps` strip inside the existing `Tortila strategy map` card, above the Turtle bucket table, so users see coin plan and portfolio guardrails in one decision surface. Target part: Tortila strategy-map card.
2. Severity: High. The cap taxonomy and validation already exist and should be reused verbatim. Evidence: schema fields are `maxOpenSymbols`, `maxTotalUnits`, `maxUnitsPerDirection`, `haltDrawdownPercent`, `dailyMaxLossPercent`, and `maxNewEntriesPerTick` at `apps/web/src/features/bots/config.ts:63`; `apps/web/src/features/bots/config.ts:68`; labels/hints are defined at `apps/web/src/features/bots/config.ts:189`; `apps/web/src/features/bots/config.ts:194`; validation copy groups portfolio, risk, and throttle errors at `apps/web/src/features/bots/config-error-copy.ts:141`; `apps/web/src/features/bots/config-error-copy.ts:146`. Recommendation: use the existing labels and form names, grouped as exposure caps, halt caps, and entry throttle; do not introduce new names such as live capacity, slots, or current exposure. Target part: cap labels and validation copy.
3. Severity: High. Settings and setup already share `TortilaSymbolConfigTable`, while generic fields are rendered after it in both pages. Evidence: settings filters `symbols` but keeps the rest of `fields` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:202`; settings passes the shared table at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:542`; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:548`; then renders `fields.map` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:560`; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:581`; setup does the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:211`; `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:517`; `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:523`; `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:535`; `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:549`. Recommendation: split Tortila portfolio fields out of the generic field grid, pass them into the shared table, and render them once inside the map card using the same `name` values so `botConfigFormInput` continues to parse the current form. Target part: shared settings/setup wiring.
4. Severity: Medium. The strategy map is draft-aware for coin rows but not for top-level caps, which leaves users comparing draft unit totals against caps by memory. Evidence: row drafts feed `activeRows`, `exportValue`, and `mapRows` at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:178`; `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:180`; current draft max units are computed at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:187`; and displayed at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:211`; bucket guardrails sum max units at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:150`; `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:158`; the component props do not yet accept portfolio caps at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:163`; `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:173`. Recommendation: make cap inputs draft-aware in the same component and show compact comparisons such as `8 / 12 total units`, `5 open symbols`, and `2 entries/tick`, clearly labeled as draft/reference before save. Target part: draft preview behavior.
5. Severity: Medium. Effective-review code already presents the cap story after save; the edit surface should align with that model. Evidence: `config-review.ts` has a `Portfolio caps` metric at `apps/web/src/features/bots/config-review.ts:134`; and a `Risk limits` section with max open symbols, max total units, daily max loss, halt drawdown, and entry throttle at `apps/web/src/features/bots/config-review.ts:147`; `apps/web/src/features/bots/config-review.ts:154`; `BotConfigReviewPanel` renders metrics and review sections at `apps/web/src/features/bots/BotConfigReviewPanel.tsx:18`; `apps/web/src/features/bots/BotConfigReviewPanel.tsx:38`. Recommendation: extract or mirror a small pure formatter for cap summary text so the editable map and effective review use the same labels, values, and risk-first ordering. Target part: shared presentation model.
6. Severity: High. Copy must keep the safety boundary: portfolio caps are WTC reference/export caps, not live exposure or runtime capacity. Evidence: AGENTS forbids live server mutation and live bot start/stop/apply-config at `AGENTS.md:76`; `AGENTS.md:81`; session protocol repeats no live bot control or secrets at `docs/SESSION_PROTOCOL.md:83`; the source audit says safe cap copy is WTC reference/export caps and warns against live capacity/current exposure claims at `docs/handoffs/20260604-0906-tortila-strategy-source-auditor.md:52`; `docs/handoffs/20260604-0906-tortila-strategy-source-auditor.md:56`; the current table already labels the map `draft preview` and `no live exchange apply` at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:227`; `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:228`. Recommendation: keep the badge language `draft preview`, `WTC reference profile`, and `no live exchange apply`; avoid `running config`, `synced`, `live capacity`, `will open`, and `connection verified`. Target part: safety-sensitive UI copy.
7. Severity: Medium. Tests now prove the strategy map exists, but they do not yet prove portfolio caps are embedded in the map. Evidence: rendered settings test asserts `Tortila strategy map`, draft-row copy, and `Runtime export preview (draft)` at `tests/e2e/bot-settings.spec.ts:62`; `tests/e2e/bot-settings.spec.ts:72`; setup test asserts the same at `tests/e2e/bot-settings.spec.ts:225`; `tests/e2e/bot-settings.spec.ts:227`; static coverage pins map strings but not a cap strip at `tests/integration/bot-read-safety-static.test.ts:399`; `tests/integration/bot-read-safety-static.test.ts:419`. Recommendation: add focused rendered and static coverage for `Portfolio caps` inside the strategy map on settings and setup, one unsaved cap edit reflected before save, mobile no-horizontal-scroll, and absence of live-control/exchange-proof terms. Target part: acceptance tests for the next implementation slice.

## Decisions
1. Recommended UX shape: keep a single premium, dense `Tortila strategy map` card with two layers: a top `Portfolio caps` strip and the existing Turtle bucket table below it.
2. The cap strip should be editable, not only informational, because the current generic fields are already editable and users need the controls near the coin plan they constrain.
3. Use a restrained two-row grid: `Max open symbols`, `Max total units`, `Max units per direction`, `Halt drawdown %`, `Daily max loss %`, and `Max new entries/tick`. Put source/draft/no-live badges in the card header, not repeated beside every field.
4. Keep form field names unchanged so the existing server-side parse path continues through `botConfigFormInput`; this is a UI relocation and presentation slice, not a persistence or backend feature.
5. Keep all cap language WTC-reference scoped. Any runtime diff, live current config, exchange ping, or live capacity claim requires a separate security plus bot-integration phase.

## Risks
1. Rendering portfolio inputs both inside the map and in the old generic field grid would duplicate form names and confuse save behavior.
2. A cap strip that looks like live capacity could mislead users into believing WTC has checked current Tortila exposure.
3. Client-side draft summaries are browser-editable and must remain advisory; server-side zod validation and existing save actions remain the authority.
4. If validation errors for portfolio caps stay only in a global banner, users may not know which cap field to fix after the controls move into the map.
5. The broader worktree is heavily dirty from prior phases; this audit does not claim ownership of existing product/test changes.

## Verification/tests
RUN:
1. `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with a heavily dirty pre-existing worktree.
2. Read-only inspection with `rg`, `Get-Content`, `Test-Path`, and targeted line-numbered slices.
3. Confirmed the requested handoff path did not exist before writing.
4. Wrote only `docs/handoffs/20260604-0926-tortila-portfolio-caps-ux-auditor.md`.

NOT RUN:
1. Playwright, Vitest, typecheck, lint, build, secret scan, governance check, coverage, full CI - skipped because this was an authorized read-only UX/product audit handoff with no product/test edits.
2. Live bot start/stop/apply/test, live diagnostics, exchange ping, `/api/marks`, worker tick, provider DB reads/writes, raw provider payload inspection, env/secret inspection, SSH/tmux/systemd, production/canary checks - skipped by explicit safety boundary.
3. Git commit, push, PR - not requested.

## Next actions
1. Implement the next slice in `TortilaSymbolConfigTable`: add a `Portfolio caps` strip inside the existing strategy map card and move Tortila cap inputs there from the generic field grid.
2. Update settings/setup wiring to pass only Tortila portfolio field descriptors/values/defaults into the shared table, while leaving non-portfolio fields in the existing generic grid.
3. Add rendered tests for settings and setup on desktop/mobile: cap strip visible inside the map, one cap edit updates draft copy before save, no horizontal scroll, and no live-control or exchange-proof language.
4. Add static tests for the cap helper/strings and unchanged safe form names: `maxOpenSymbols`, `maxTotalUnits`, `maxUnitsPerDirection`, `haltDrawdownPercent`, `dailyMaxLossPercent`, and `maxNewEntriesPerTick`.
5. Keep runtime config proof, live exchange ping, and live start/stop/apply behind a separate audited provider/runtime phase.
