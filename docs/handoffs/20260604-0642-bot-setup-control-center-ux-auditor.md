# bot-setup-control-center-ux-auditor handoff
## Scope
Phase 4.00 read-only UX/product audit of current user bot setup/settings control surfaces only.

Inspected the current Legacy and Tortila setup/settings pages, config tables, readiness/review/operation panels, setup control center, admin selected-user boundary references, and relevant static/e2e tests. Goal was to identify the smallest high-value next slice toward making Legacy and Tortila bot setup very clear: default vs custom, coin selection, RSI/CCI/stage slots, exchange-key metadata test, admin/user boundary, and no live bot stop/start.

No live services, SSH, env/vault/secret inspection, provider DB mutation, worker tick/restart, exchange ping, live bot start/stop/apply/retest, or live bot control was run. No product files were edited by this auditor.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0629-phase-3-99-admin-selected-user-drilldown-overview.md`
8. `docs/handoffs/20260604-0559-phase-3-97-bot-operation-map.md`
9. `docs/handoffs/20260604-0410-phase-3-94-bot-settings-rendered-ux-slots.md`
10. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
11. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
12. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
13. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
14. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
15. `apps/web/src/features/bots/BotReadinessMap.tsx`
16. `apps/web/src/features/bots/BotConfigReviewPanel.tsx`
17. `apps/web/src/features/bots/BotOperationMapPanel.tsx`
18. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
19. `apps/web/src/features/bots/config.ts`
20. `apps/web/src/features/bots/config-review.ts`
21. `apps/web/src/features/bots/readiness.ts`
22. `apps/web/src/features/bots/readiness-loader.ts`
23. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
24. `tests/e2e/bot-settings.spec.ts`
25. `tests/e2e/bot-readiness-map.spec.ts`
26. `tests/integration/bot-config-review-static.test.ts`
27. `tests/integration/bot-read-safety-static.test.ts`
28. `tests/integration/bot-readiness-builder.test.ts`
29. `tests/integration/user-resolved-bot-config-static.test.ts`
30. `tests/integration/user-resolved-bot-config-db.test.ts`
31. `tests/integration/admin-user-bot-detail-static.test.ts`
32. `tests/integration/bot-config-action-handler.test.ts`
33. `tests/integration/bot-config-export-route-handler.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. The smallest high-value next slice is to harden the already-wired `BotSetupControlCenter`, not add backend/live-control capability. Evidence: settings renders `BotSetupControlCenter` before readiness/source/review panels at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:248`; setup renders it before the setup source and operation maps at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:268`; the component already has rows for `Default or custom`, key/pub_id, coin map, review/statistics, and live boundary at `apps/web/src/features/bots/BotSetupControlCenter.tsx:85`. Recommendation: make this component the canonical "setup control center" slice for the next pass, using only existing safe DTOs and no new live adapter paths. Target part: `BotSetupControlCenter.tsx`, setup/settings pages, focused tests.
2. Severity: High. The control center shows Tortila key readiness as count-only, while richer metadata state already exists elsewhere. Evidence: `BotSetupControlCenterProps` only accepts `exchangeKeyCount` and `providerAccountCount` at `apps/web/src/features/bots/BotSetupControlCenter.tsx:28`; its connection state is derived from counts at `apps/web/src/features/bots/BotSetupControlCenter.tsx:83`; but readiness loading already computes `missing`, `metadata_saved`, and `vault_metadata_confirmed` at `apps/web/src/features/bots/readiness-loader.ts:53`, and the readiness row renders `WTC vault metadata confirmed` without claiming a live ping at `apps/web/src/features/bots/readiness.ts:102`. Recommendation: pass `exchangeKeyState` and `providerPubIdState` into the control center or reuse the existing readiness item so the top row says metadata saved/confirmed/missing instead of only key count. Target part: `BotSetupControlCenter.tsx`, `settings/page.tsx`, `setup/page.tsx`.
3. Severity: High. The final setup review still uses ambiguous exchange-test wording at the exact completion gate. Evidence: review step copy says `${keys.length} saved (encrypted), connection test pending audited adapter` at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:570`; the dedicated key panel correctly says no live ping was run and no bot was started/stopped/reconfigured at `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:73`; it also distinguishes metadata/format/exchange ping/live-control rows at `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:107`. Recommendation: replace the review line with metadata-only status copy such as `WTC vault metadata: saved/confirmed; live exchange ping not run`, and optionally render the compact key-readiness panel in review. Target part: setup review card and `ExchangeKeyReadinessPanel` compact usage.
4. Severity: High. Admin/user boundary is correct but split across source detail, operation map, and admin pages instead of being an explicit setup-control row. Evidence: source details explain admins cannot edit user-owned Legacy/Tortila profiles at `apps/web/src/features/bots/config.ts:969` and `apps/web/src/features/bots/config.ts:971`; operation map has `Admin visibility` guardrails at `apps/web/src/features/bots/BotOperationMapPanel.tsx:126`; admin selected-user pages show `LIVE CONTROL: DISABLED`, `user settings: read-only`, and `provider mappings: read-only` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:115`. Recommendation: add a `User/admin boundary` row to the setup control center: users can save their own WTC config version, admins publish system defaults and map Legacy pub_id, nobody can start/stop/apply/close positions here. Target part: `BotSetupControlCenter.tsx` and static/e2e guardrails.
5. Severity: Medium. Legacy coin/RSI/CCI/stage-slot clarity is strong in the table, but the control center does not surface over-capacity or invalid-row state. Evidence: the Legacy table explains one trigger per coin at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:112`, exposes stage slot group input at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:260`, and computes over-capacity status at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:352`; the control center's coin row only uses metric strings and `hasConfig` tone at `apps/web/src/features/bots/BotSetupControlCenter.tsx:80` and `apps/web/src/features/bots/BotSetupControlCenter.tsx:110`. Recommendation: feed the control center a small derived warning state from `configReview` or form issue state, then link the action to the first coin/stage row needing attention. Target part: `BotSetupControlCenter.tsx`, `config-review.ts`, `LegacyAveragingConfigTable.tsx`.
6. Severity: Medium. Focused tests cover control-center presence but should be extended for the next slice's exact semantics. Evidence: e2e asserts basic control-center rows for Tortila and Legacy at `tests/e2e/bot-settings.spec.ts:26` and `tests/e2e/bot-settings.spec.ts:56`; static tests assert strings such as `Default or custom`, `Exchange key`, and `Live control boundary` at `tests/integration/bot-config-review-static.test.ts:94`; the current control-center search shows no `exchangeKeyState`/`providerPubIdState` usage in the component. Recommendation: add a focused static/e2e test that checks metadata-confirmed/missing wording, admin/user boundary wording, final review copy, and absence of `Connection verified`, `startBot`, `stopBot`, `applyConfig`, `retest`, raw provider ids, and secrets. Target part: `tests/e2e/bot-settings.spec.ts`, `tests/integration/bot-read-safety-static.test.ts`, `tests/integration/bot-config-review-static.test.ts`.

## Decisions
1. Recommended the next slice as presentation/test hardening over existing safe data: "Bot setup control center hardening".
2. Did not recommend live exchange ping, live bot apply, live start/stop, provider DB mutation, or adapter activation.
3. Treated `BotSetupControlCenter` as the right anchor because it is already present on both user settings and setup pages.
4. Treated exchange-key "test" as metadata-only WTC vault readiness, not live connectivity.
5. Treated admin visibility as audit/read-only UX, not user setting mutation or provider mapping from user pages.

## Risks
1. The worktree was already heavily dirty before this audit, including bot setup/settings files and many untracked handoffs. Findings are based on the current dirty tree.
2. The control center appears actively in-progress; line evidence should be rechecked before implementation if another phase lands first.
3. No rendered browser or Vitest gates were run by this auditor, so visual fit and test pass/fail state are not claimed green here.
4. The broader Legacy plus Tortila product objective remains open; this slice improves setup clarity only.

## Verification/tests
RUN:
1. Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and recent relevant phase handoffs.
2. Inspected current setup/settings pages, bot config tables, readiness/review/operation/control-center panels, admin selected-user read-only boundary, and relevant tests with read-only shell commands.
3. Checked current branch/status; worktree was already heavily dirty/untracked before this handoff.
4. Checked the requested timestamped handoff path did not already exist before writing.

NOT RUN:
1. Vitest, Playwright, lint, typecheck, build, secret scan, governance, coverage, or full `npm test` - read-only UX/product audit only.
2. Live services, SSH, tmux, systemd, env/vault/secret inspection, provider DB reads/writes, worker tick/restart, exchange ping, live bot start/stop/apply/retest, or live bot control - forbidden by scope.
3. Git staging, commit, push, or PR - not requested.

## Next actions
1. Implement one focused "Bot setup control center hardening" slice: pass existing readiness state into the control center, add explicit user/admin boundary copy, and fix final review metadata wording.
2. Add focused tests for control-center metadata state, admin/user boundary, Legacy slot over-capacity surfacing, no live-control language, and no horizontal scroll.
3. Keep any live exchange ping, Legacy/Tortila apply, start/stop, retest, or close-position work out of this slice until separate security and bot-integration audits approve it.
