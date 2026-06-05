# admin-selected-user-drilldown-ux-auditor handoff
## Scope
Read-only Phase 3.99 UX/product audit for the selected-user admin bot drilldown in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Focus: what the selected-user top overview should show, stable anchors and link copy, first-viewport clarity, and premium terminal UX. No product code, tests, live services, provider DB, env/vault/secret files, SSH, tmux, systemd, worker tick/restart, start/stop/apply/retest, or live bot state were edited or touched.

This is a single named auditor lane. No N-agent audit is claimed.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/handoffs/20260604-0617-phase-3-98-admin-bot-owner-drilldown.md`
8. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
9. `apps/web/src/app/admin/bots/page.tsx`
10. `apps/web/src/app/admin/users/page.tsx`
11. `apps/web/src/features/admin/types.ts`
12. `apps/web/src/features/admin/user-bot-detail-loader.ts`
13. `tests/integration/admin-user-bot-detail-static.test.ts`
14. `tests/integration/admin-user-bot-detail-loader.test.ts`
15. `tests/e2e/admin-user-bot-detail-db.spec.ts`
16. `tests/e2e/admin-mobile-pg8.spec.ts`
17. `tests/integration/admin-responsive.test.ts`
18. Targeted search excerpts from `tests/integration/bot-read-safety-static.test.ts` and `tests/integration/admin-bot-health-loader.test.ts`

## Files changed
None - read-only audit. The only artifact produced by this auditor is this handoff file.

## Findings
1. Severity: High. The Phase 3.98 next action for a selected-user `Bot drilldown overview` is now present in the current tree: the route defines stable `bot-${productCode}` anchors, renders a top overview table with Bot, Access, Settings source, Runtime scope, Warnings, Latest stats, and Drilldown columns, and wraps each bot card with `id={botAnchor(bot)}`. Evidence: `docs/handoffs/20260604-0617-phase-3-98-admin-bot-owner-drilldown.md:104`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:72`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:150`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:159`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:177`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:190`. Recommendation: keep this as the canonical selected-user top overview shape. Target part: selected-user overview and anchors.
2. Severity: Medium. First-viewport clarity is better than Phase 3.98 requested, but still not as operator-dense as a premium terminal screen should be: the route renders the header, safety pills, operational-scope banner, and a separate User card before the bot overview. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:103`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:109`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:120`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:138`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:150`. Recommendation: move the bot overview immediately after the status pills or fold the User metrics into the overview header so the first viewport answers "which bots, access, scope, warnings, latest stats, where to jump" before dossier details. Target part: first viewport.
3. Severity: Medium. Product-aware deep linking is partially solved: the primary fleet drilldown action points to `/admin/users/<id>/bots#bot-tortila_bot` or `#bot-legacy_bot`, and the selected-user targets exist. The secondary mapped-user text link still says `Open details` and links only to `/admin/users/<id>/bots`, while the user directory action says `Bot details` and also lands at the page top. Evidence: `apps/web/src/app/admin/bots/page.tsx:64`; `apps/web/src/app/admin/bots/page.tsx:71`; `apps/web/src/app/admin/bots/page.tsx:78`; `apps/web/src/app/admin/bots/page.tsx:92`; `apps/web/src/app/admin/bots/page.tsx:107`; `apps/web/src/app/admin/users/page.tsx:117`; `apps/web/src/app/admin/users/page.tsx:118`. Recommendation: keep product-aware hash links for row actions; rename generic entry points to `Bot overview` or `Open selected-user overview`, and add product-specific copy such as `Open Legacy card` where row context has a product anchor. Target part: anchors and link copy.
4. Severity: Medium. The detail cards are safe and complete, but their density is more dossier-like than terminal-like after the top overview: each bot card carries provider mapping, canonical warnings, resolved settings, operation map, key metadata, metric cards, positions, trades, and equity sections. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:215`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:238`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:281`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:343`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:359`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:375`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:400`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:433`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:466`. Recommendation: keep the overview as the command surface, then make detailed evidence visually subordinate with compact section anchors or tighter bands for scope/settings/runtime/positions/trades/equity. Target part: premium terminal UX.
5. Severity: High. The loader and DTO already provide the exact data needed for the selected-user overview without schema, provider, or live adapter work: access state, config source, provider account, latest metric, positions/trades/equity counts, stats scope, and canonical warnings are all already present on `AdminUserBotSummary`. Evidence: `apps/web/src/features/admin/types.ts:146`; `apps/web/src/features/admin/types.ts:153`; `apps/web/src/features/admin/types.ts:157`; `apps/web/src/features/admin/types.ts:159`; `apps/web/src/features/admin/types.ts:160`; `apps/web/src/features/admin/types.ts:164`; `apps/web/src/features/admin/types.ts:165`; `apps/web/src/features/admin/types.ts:166`; `apps/web/src/features/admin/user-bot-detail-loader.ts:1009`; `apps/web/src/features/admin/user-bot-detail-loader.ts:1019`; `apps/web/src/features/admin/user-bot-detail-loader.ts:1030`; `apps/web/src/features/admin/user-bot-detail-loader.ts:1033`; `apps/web/src/features/admin/user-bot-detail-loader.ts:1038`; `apps/web/src/features/admin/user-bot-detail-loader.ts:1043`. Recommendation: keep any remaining UX polish in the route/tests layer; do not add DB queries, migrations, provider reads, or mutation actions for this overview. Target part: product/data boundary.
6. Severity: Medium. Test coverage now asserts overview presence, two jump links, read-only guardrails, no horizontal scroll, and source-table wrapping, but it does not yet prove hash navigation from fleet/user routes lands on the intended bot card. Evidence: `tests/integration/admin-user-bot-detail-static.test.ts:77`; `tests/integration/admin-user-bot-detail-static.test.ts:82`; `tests/integration/admin-user-bot-detail-static.test.ts:83`; `tests/e2e/admin-user-bot-detail-db.spec.ts:110`; `tests/e2e/admin-user-bot-detail-db.spec.ts:118`; `tests/e2e/admin-user-bot-detail-db.spec.ts:120`; `tests/e2e/admin-mobile-pg8.spec.ts:43`; `tests/e2e/admin-mobile-pg8.spec.ts:57`; `tests/integration/admin-responsive.test.ts:69`; `tests/integration/admin-responsive.test.ts:75`. Recommendation: add a focused static assertion for `#${row.detailAnchor}` and a Playwright deep-link check for `/admin/users/<id>/bots#bot-legacy_bot` with target visibility and no horizontal scroll. Target part: verification.

## Decisions
1. Treated the current live worktree as source of truth because it already contains changes beyond the Phase 3.98 handoff's next-action text.
2. Accepted `bot-${productCode}` as the stable anchor convention for selected-user bot cards.
3. Accepted the top overview columns as the correct product shape: Bot, Access, Settings source, Runtime scope, Warnings, Latest stats, Drilldown.
4. Did not recommend loader/schema/provider changes; the current DTO is sufficient.
5. Did not edit product code or tests; this auditor only records UX/product findings.
6. Did not launch background agents because this was a single selected auditor lane and no N-agent audit is claimed; no background cleanup was required.

## Risks
1. The worktree is broadly dirty with many pre-existing tracked and untracked Phase 3.x files; this audit should not be treated as a clean release baseline.
2. No rendered browser screenshot was taken in this auditor lane, so first-viewport density is source-inspected rather than visually accepted.
3. The populated DB-backed admin user-bot rendered gate remains opt-in and was not run here.
4. Because the route appears ahead of the Phase 3.98 handoff next actions, a later operator should reconcile whether this was already implemented by another lane before assigning duplicate implementation work.

## Verification/tests
RUN:
1. Protocol/docs read: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, and the Phase 3.98 handoff.
2. Source inspection of selected-user route, fleet route, user directory, admin DTOs, loader, and relevant tests using `Get-Content` and `rg`.
3. `git rev-parse --show-toplevel` - RUN; git root is `C:/Users/maxib/GTE BOT/wtc_ecosystem_platform`.
4. `git status --short` - RUN; broad dirty/untracked Phase 3.x state observed.
5. `Test-Path docs/handoffs/20260604-0620-admin-selected-user-drilldown-ux-auditor.md` - RUN before writing; file did not previously exist.

NOT RUN:
1. `npm test`, focused Vitest, Playwright, typecheck, lint, build, secret scan, and governance check - not run because this was read-only UX/product audit with no product code changes.
2. Live services, provider DB, env/vault/secret files, SSH, tmux, systemd, worker tick/restart, start/stop/apply/retest, and live exchange probes - not run by explicit safety scope.
3. Background read-only agents - not launched because this is one selected auditor handoff, not an N-agent aggregate phase.

## Next actions
1. Keep the selected-user `Bot drilldown overview` and stable `bot-${productCode}` anchors as the canonical shape.
2. Tighten the first viewport by moving the overview immediately after status pills or merging the User card metrics into the overview header.
3. Normalize link copy: use `Bot overview` for generic user-directory entry and product-specific `Open Tortila card` / `Open Legacy card` for hash-aware fleet rows.
4. Add hash-navigation verification for `/admin/users/<id>/bots#bot-tortila_bot` and `/admin/users/<id>/bots#bot-legacy_bot`.
5. Keep all live control, provider mapping mutation, exchange secret access, and user settings edits out of this selected-user drilldown unless a separate security and bot-integration phase approves them.
