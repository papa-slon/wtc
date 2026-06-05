# phase-3-93-admin-global-provider-identity-boundary handoff
## Scope
Phase 3.93 closes the admin/global bot-config provider identity and live-control alias boundary after Phase 3.92 split Legacy runtime provider identity from persistable user/global config. The slice keeps admin-published system defaults from persisting `providerPubId`, provider-account containers, runtime slot/order summaries, raw JSON, or live-control aliases through the admin action, DB repository current rows, global config history, or generic config version append path.

No live bot start/stop/apply-config/retest, worker tick/restart, provider DB access, exchange ping, env/vault/secret inspection, SSH, tmux, systemd, or live server mutation was performed.

Per-agent handoffs:
- [`docs/handoffs/20260604-0340-admin-global-provider-identity-boundary-auditor.md`](20260604-0340-admin-global-provider-identity-boundary-auditor.md)
- [`docs/handoffs/20260604-0340-admin-global-provider-identity-tests-auditor.md`](20260604-0340-admin-global-provider-identity-tests-auditor.md)
- [`docs/handoffs/20260604-0340-admin-global-provider-identity-ux-source-auditor.md`](20260604-0340-admin-global-provider-identity-ux-source-auditor.md)

Background agents:
- `019e8f37-bed7-7a20-9471-c1e45d91c660` closed after result collection.
- `019e8f38-1061-7c03-8c7f-d721db58816a` closed after result collection.
- `019e8f38-6704-7c23-9f8d-24ac97cd4047` closed after result collection.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0318-phase-3-92-legacy-provider-identity-schema-split.md`
8. `docs/handoffs/20260604-0340-admin-global-provider-identity-boundary-auditor.md`
9. `docs/handoffs/20260604-0340-admin-global-provider-identity-tests-auditor.md`
10. `docs/handoffs/20260604-0340-admin-global-provider-identity-ux-source-auditor.md`
11. `apps/web/src/app/admin/bots/config/page.tsx`
12. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
13. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
14. `apps/web/src/features/admin/actions.ts`
15. `apps/web/src/features/admin/schemas.ts`
16. `apps/web/src/features/bots/config.ts`
17. `apps/web/src/features/bots/config-review.ts`
18. `apps/web/src/features/bots/BotConfigReviewPanel.tsx`
19. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
20. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
21. `packages/db/src/repositories.ts`
22. `tests/integration/admin-global-bot-config-db.test.ts`
23. `tests/integration/admin-global-bot-config-static.test.ts`
24. `tests/integration/bot-config-source-audit-static.test.ts`
25. `tests/integration/bot-config-action-handler.test.ts`
26. `tests/integration/db-0002.test.ts`

## Files changed
1. `packages/db/src/repositories.ts`
2. `apps/web/src/features/admin/actions.ts`
3. `tests/integration/admin-global-bot-config-db.test.ts`
4. `tests/integration/admin-global-bot-config-static.test.ts`
5. `tests/integration/db-0002.test.ts`
6. `docs/handoffs/20260604-0340-phase-3-93-admin-global-provider-identity-boundary.md`

## Findings
1. Severity: High. The direct repository gap found by the boundary auditor is closed. Evidence: the read-only boundary auditor proved direct `saveBotGlobalConfig` accepted and persisted `liveControl`, `exchangeApply`, and `exchangeOrder` before this phase fix (`docs/handoffs/20260604-0340-admin-global-provider-identity-boundary-auditor.md:31`); the repository forbidden-key set now includes `exchangeapply`, `exchangeorder`, and `livecontrol` (`packages/db/src/repositories.ts:540`, `packages/db/src/repositories.ts:541`, `packages/db/src/repositories.ts:542`), and `saveBotGlobalConfig` calls the recursive guard before global config writes (`packages/db/src/repositories.ts:2075`, `packages/db/src/repositories.ts:2092`). Recommendation: keep the repository guard as the final backstop for any future internal global-default writer. Target part: DB repository boundary.
2. Severity: High. Admin/global DB coverage now rejects provider identity, runtime containers, and live-control aliases without appending current rows, history rows, or audit rows. Evidence: the forbidden cases cover nested `symbolConfigs[].providerPubId`, `activeSlots`, `activeOrderSummary`, `liveControl`, `exchangeApply`, and `exchangeOrder` (`tests/integration/admin-global-bot-config-db.test.ts:181`, `tests/integration/admin-global-bot-config-db.test.ts:184`, `tests/integration/admin-global-bot-config-db.test.ts:187`, `tests/integration/admin-global-bot-config-db.test.ts:188`, `tests/integration/admin-global-bot-config-db.test.ts:193`, `tests/integration/admin-global-bot-config-db.test.ts:194`, `tests/integration/admin-global-bot-config-db.test.ts:195`), and the test asserts config/version/audit counts remain unchanged after rejection (`tests/integration/admin-global-bot-config-db.test.ts:198`, `tests/integration/admin-global-bot-config-db.test.ts:216`, `tests/integration/admin-global-bot-config-db.test.ts:220`, `tests/integration/admin-global-bot-config-db.test.ts:221`). Recommendation: keep this focused suite in the acceptance gate for any future global-default changes. Target part: admin global config DB coverage.
3. Severity: High. The admin action forbidden-key list is now aligned with the repository for the newly closed aliases and read-only runtime containers. Evidence: `FORBIDDEN_GLOBAL_BOT_CONFIG_KEYS` includes `rawjson`, `activeslots`, `activeordersummary`, `startbot`, `stopbot`, `exchangeapply`, `exchangeorder`, and `livecontrol` (`apps/web/src/features/admin/actions.ts:431`, `apps/web/src/features/admin/actions.ts:450`, `apps/web/src/features/admin/actions.ts:451`, `apps/web/src/features/admin/actions.ts:452`, `apps/web/src/features/admin/actions.ts:458`, `apps/web/src/features/admin/actions.ts:459`, `apps/web/src/features/admin/actions.ts:465`, `apps/web/src/features/admin/actions.ts:466`, `apps/web/src/features/admin/actions.ts:467`), and the action guards parsed config before save (`apps/web/src/features/admin/actions.ts:496`, `apps/web/src/features/admin/actions.ts:526`). Recommendation: add parity coverage if this list grows again. Target part: admin global config action.
4. Severity: High. Generic config history append now shares the same live-control alias backstop. Evidence: `insertBotConfigVersion` calls `assertNoForbiddenBotConfigKeys` (`packages/db/src/repositories.ts:2196`, `packages/db/src/repositories.ts:2197`), and the DB test now rejects `{ liveControl: true }` before appending history (`tests/integration/db-0002.test.ts:96`, `tests/integration/db-0002.test.ts:112`, `tests/integration/db-0002.test.ts:113`). Recommendation: keep direct append helpers behind the same forbidden-key guard as current config saves. Target part: bot config version history.
5. Severity: Medium. Source/UX clarity for system defaults versus user overrides versus Legacy runtime evidence remains acceptable at source level, but no visual acceptance is claimed. Evidence: the UX/source auditor found admin global defaults, user settings, and setup copy all preserve the shared-default/user-owned/read-only runtime split (`docs/handoffs/20260604-0340-admin-global-provider-identity-ux-source-auditor.md:24`, `docs/handoffs/20260604-0340-admin-global-provider-identity-ux-source-auditor.md:26`, `docs/handoffs/20260604-0340-admin-global-provider-identity-ux-source-auditor.md:28`, `docs/handoffs/20260604-0340-admin-global-provider-identity-ux-source-auditor.md:30`), but also noted browser-visible acceptance was not run (`docs/handoffs/20260604-0340-admin-global-provider-identity-ux-source-auditor.md:32`). Recommendation: run focused browser/Playwright checks before claiming premium rendered UX acceptance for this surface. Target part: admin defaults and user bot settings/setup UI.

## Decisions
1. Admin-published system defaults must not store Legacy provider identity or runtime state; they remain shared WTC reference config only.
2. `providerPubId`, provider-account containers, runtime slot/order summaries, raw JSON, and live-control aliases are rejected recursively at the repository boundary, not only in the UI/action layer.
3. The Phase 3.92 next action for global-default DB coverage of `symbolConfigs[].providerPubId` is closed by this phase.
4. No claim is made that historical production rows are clean because provider/live DB access was intentionally not used.
5. No claim is made that the rendered UX is visually accepted because browser/e2e/preview gates were not run in this slice.

## Risks
1. Historical rows, if any existed before these guards, were not scanned in a real database.
2. The action and repository still maintain separate forbidden-key sets; static and DB coverage reduce drift risk, but centralization would be cleaner.
3. Direct SQL inserts can bypass repository guards; no DB-level JSONB CHECK constraint was added in this phase.
4. The worktree was already heavily dirty before Phase 3.93; unrelated changes were preserved and not reverted.
5. Full-platform gates were not run, so this phase is a focused boundary acceptance, not total site completion.

## Verification/tests
RUN:
1. Protocol docs and latest Phase 3.92 aggregate handoff refreshed before edits.
2. Three read-only agents were dispatched before edits and each wrote a per-agent handoff linked above.
3. Background agents `019e8f37-bed7-7a20-9471-c1e45d91c660`, `019e8f38-1061-7c03-8c7f-d721db58816a`, and `019e8f38-6704-7c23-9f8d-24ac97cd4047` were closed after result collection.
4. `npx vitest run tests/integration/admin-global-bot-config-static.test.ts tests/integration/admin-global-bot-config-db.test.ts tests/integration/db-0002.test.ts tests/integration/bot-config-source-audit-static.test.ts tests/integration/bot-config-action-handler.test.ts` - PASS, 5 files / 43 tests.
5. `npm run typecheck` - PASS.
6. `npm run typecheck -w @wtc/web` - PASS.
7. `git diff --check` - PASS.
8. `npm run secret:scan` - PASS.
9. `npm run governance:check` - PASS for current phase `20260604-0340`: 0 errors, 1 known historical warning (`20260529-1921-integration-risk-auditor.md` missing `## Files inspected`, exempt).

NOT RUN:
1. Full `npm test` - skipped for phase scope/time; focused suites above covered the changed boundaries.
2. `npm run lint` - skipped for phase scope/time.
3. `npm run build` / `npm run build -w @wtc/web` - skipped for phase scope/time.
4. Playwright/e2e/preview/browser screenshots - skipped; no visual acceptance claimed.
5. Real Postgres migration/seed, provider DB, worker tick/restart/smoke, live bot start/stop/apply-config/retest, exchange ping, `.env`, vault/secret inspection, SSH, tmux, systemd, and live server checks - forbidden by protocol/scope for this slice.

## Next actions
1. Consider centralizing the action/repository forbidden-key lists or adding a parity test to prevent future drift.
2. When a safe disposable production-like DB snapshot exists, run a historical saved-config scan for provider identity and live-control markers.
3. Open a new phase for rendered browser/Playwright acceptance of admin defaults, user settings, and setup before claiming premium UX acceptance.
4. Continue the broader Legacy + Tortila completion goal in a new phase; this phase only closed admin/global provider identity and live-control alias persistence.
