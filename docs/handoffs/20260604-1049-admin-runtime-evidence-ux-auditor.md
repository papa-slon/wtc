# ecosystem-ux-ui-designer handoff
## Scope
Phase 4.11 read-only UX/product audit of admin bot runtime-evidence surfaces after Phase 4.10.

Audited `apps/web/src/app/admin/bots/page.tsx` and `apps/web/src/app/admin/users/[userId]/bots/page.tsx` for how admins see bot owners, user names, pub_id/user-id identity, settings/statistics evidence, global config boundaries, and individual-user read-only boundaries. No product, test, runtime, DB, service, env, provider, exchange, deploy, SSH, worker, or bot-control action was run.

No background subagents were launched by this auditor lane because the current Codex toolset did not expose an agent-spawn/close tool. This file is the named per-agent handoff for the `ecosystem-ux-ui-designer` auditor role.
## Files inspected
1. `apps/web/src/app/admin/bots/page.tsx`
2. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
3. `apps/web/src/features/admin/bot-health-loader.ts`
4. `apps/web/src/features/admin/user-bot-detail-loader.ts`
5. `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx`
6. `apps/web/src/features/admin/types.ts`
7. `apps/web/src/features/admin/queries.ts`
8. `apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx`
9. `apps/web/src/features/bots/BotOperationMapPanel.tsx`
10. `apps/web/src/app/admin/bots/config/page.tsx`
11. `docs/handoffs/20260604-1045-phase-4-10-tortila-runtime-evidence-ladder.md`
12. `tests/e2e/admin-user-bot-detail-db.spec.ts`
13. `tests/e2e/smoke.spec.ts`
14. `tests/integration/admin-user-bot-detail-static.test.ts`
15. `tests/integration/admin-bot-health-loader.test.ts`
16. `tests/integration/admin-user-bot-detail-loader.test.ts`
## Files changed
None - read-only audit except this handoff: `docs/handoffs/20260604-1049-admin-runtime-evidence-ux-auditor.md`.
## Findings
1. Severity: High. Evidence: `apps/web/src/app/admin/bots/page.tsx:87`, `apps/web/src/app/admin/bots/page.tsx:103`, `apps/web/src/features/admin/bot-health-loader.ts:160`, `apps/web/src/features/admin/bot-health-loader.ts:273`. The admin fleet page is an owner/snapshot explorer, not an all-bot-user index: Tortila rows require persisted metric snapshots, and Legacy rows require latest provider pub_id snapshot rows. Users with bot entitlements, WTC configs, or provider mappings but no current snapshot row can be absent from `/admin/bots`. Recommendation: add a compact "All bot users" band before or beside owner drilldown, sourced from entitlements + bot instances + active provider mappings, with columns `Name`, `Email`, `User ID`, `Access`, `Tortila instance`, `Legacy pub_id`, `Latest evidence`, and `Open drilldown`; label the current table "Runtime evidence rows" instead of implying full coverage. Target part: admin bot fleet page discovery model.
2. Severity: Medium. Evidence: `apps/web/src/app/admin/bots/page.tsx:45`, `apps/web/src/app/admin/bots/page.tsx:64`, `apps/web/src/app/admin/bots/page.tsx:78`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:142`. Admins see display name/email and links that contain the user id, but the user id itself is not a visible copyable terminal-style field on the fleet or selected-user surfaces. Recommendation: show a muted monospace `User ID` under each mapped owner and add a selected-user `User ID` metric beside Email/Roles/Registered; keep provider pub_id masked as it is today. Suggested copy: `User ID - WTC account identifier; diagnostic only, not a provider credential.` Target part: owner identity cells and selected-user header card.
3. Severity: Medium. Evidence: `apps/web/src/app/admin/bots/page.tsx:158`, `apps/web/src/app/admin/bots/page.tsx:305`, `apps/web/src/features/admin/bot-health-loader.ts:238`, `apps/web/src/features/admin/bot-health-loader.ts:250`, `apps/web/src/features/admin/types.ts:339`. The fleet evidence metric named `Latest snapshot` is backed by the Tortila `latestSnapshot` query, while Legacy snapshot freshness is present separately on provider rows. This can make a mixed Tortila/Legacy fleet read as having one unified latest snapshot when the proof is product-specific. Recommendation: split the metric into `Latest Tortila metric` and `Latest Legacy pub_id snapshot`, or rename the current metric to `Latest Tortila metric`; put Legacy freshness in the top evidence cards using the max `legacyProviderAccounts.latestSnapshotAt`. Target part: admin fleet evidence ladder metrics.
4. Severity: Medium. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:90`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:115`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:155`, `apps/web/src/features/admin/user-bot-detail-loader.ts:748`. Selected-user statistics status is gated mainly by `latestMetric`, even though the loader can have scoped positions, trades, and equity rows independently. A user with scoped positions/trades but no metric row would see `snapshot pending` in the evidence ladder while lower tables still show facts. Recommendation: drive evidence status from `latestMetric || positions.length || trades.length || equityCurve.length`, and show per-artifact freshness: `Metric`, `Positions`, `Trades`, `Equity samples`. Target part: selected-user evidence ladder and stats proof copy.
5. Severity: Medium. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:312`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:343`, `apps/web/src/features/bots/BotOperationMapPanel.tsx:126`, `apps/web/src/app/admin/bots/config/page.tsx:282`. Global defaults are correctly separate from user-owned settings, and the selected-user page is read-only, but the boundary is mostly embedded in pills/map copy and does not give admins an obvious global-config context. Recommendation: add one small boundary row in selected-user settings evidence: `Global defaults are edited only in System bot defaults and may affect many no-custom users; this drilldown never edits this user's saved profile.` Optionally link to `/admin/bots/config` as `Open system defaults` with neutral styling, not as an edit affordance for the selected user. Target part: selected-user settings evidence and global config boundary copy.
6. Severity: Low. Evidence: `tests/e2e/admin-user-bot-detail-db.spec.ts:5`, `tests/e2e/admin-user-bot-detail-db.spec.ts:9`, `tests/e2e/smoke.spec.ts:45`, `tests/integration/admin-user-bot-detail-static.test.ts:127`. Static tests cover the new admin evidence panel and read-only copy, but the visible admin ladder is not in the normal smoke path, and the opt-in DB E2E reads its marker file at module load time even when the opt-in env flag is absent. Recommendation: make marker loading lazy/guarded by `ADMIN_USER_BOTS_E2E`, and add a no-DB smoke/static assertion for `Admin fleet evidence ladder` plus a managed DB assertion for `Selected-user evidence ladder`. Target part: test acceptance for admin evidence UX.
## Decisions
1. Preferred placement is sound: the fleet evidence ladder belongs immediately after runtime safety summary and before owner drilldown, as currently placed in `apps/web/src/app/admin/bots/page.tsx:305`.
2. Selected-user evidence belongs inside each bot card before provider mapping/settings details, as currently placed in `apps/web/src/app/admin/users/[userId]/bots/page.tsx:292`.
3. Keep copy terminal-style and evidence-first: "persisted worker health", "owner snapshots", "provider pub_id mapping scope", "read-only boundary", "not live-control proof".
4. Do not add individual-user setting edits, provider mapping edits, exchange-key tests, start/stop, apply config, or live retest controls to selected-user bot drilldowns.
5. Global defaults are an admin-owned system surface; selected-user pages may link to it for context, but must not phrase it as editing the selected user's bot.
## Risks
1. `/admin/bots` can still be misread as "all users with bots" unless the owner/snapshot table is renamed or complemented with an all-bot-user index.
2. Without visible user ids, operator reconciliation against logs, audit rows, and support notes still depends on copying IDs from URLs or other pages.
3. Legacy/Tortila freshness can blur when a single top metric is used for product-specific snapshot evidence.
4. No runtime truth was verified in this audit. Existing UI copy must continue to avoid claims of current process liveness, exchange verification, or runtime enforcement.
5. Worktree was already heavily dirty/untracked before this auditor lane; this handoff does not validate ownership of those product/test changes.
## Verification/tests
RUN:
1. Static file inspection with `git status --short --branch`, `git log -1 --oneline`, `rg`, and line-numbered `Get-Content` slices.
2. Confirmed the requested handoff path did not already exist before writing.
3. Confirmed no product/test file edits were made by this auditor lane.

NOT RUN:
1. Unit/integration/E2E/Playwright tests - skipped because this lane is read-only and may write exactly one handoff file.
2. Dev server, browser screenshot, visual QA - skipped because no local services should be launched.
3. DB migrations, seeds, worker ticks, managed DB E2E, or DB mutations - skipped by explicit scope.
4. Live provider/API/exchange/journal calls, bot start/stop/apply/retest, deploy, SSH/tmux/systemd - skipped by explicit scope.
5. Env/secret reads - skipped by explicit scope.
## Next actions
1. Add an all-bot-user admin index or rename the current owner table so admins do not confuse runtime evidence rows with full user coverage.
2. Surface copyable `User ID` fields in the fleet owner cells and selected-user header, while keeping pub_id masked and credentials absent.
3. Split Tortila and Legacy freshness metrics in the fleet evidence ladder.
4. Make selected-user statistics evidence status reflect any scoped persisted evidence, not only latest metric rows.
5. Add the explicit global-default boundary row/link without creating selected-user edit affordances.
6. Harden the opt-in DB E2E marker load and add smoke/static coverage for the admin evidence ladders.
