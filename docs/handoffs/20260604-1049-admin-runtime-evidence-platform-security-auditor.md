# ecosystem-platform-security-auditor handoff
## Scope
Read-only Phase 4.11 platform/security audit of the current admin runtime-evidence surfaces after Phase 4.10.

Scope covered how admin loaders and pages expose bot fleet evidence and selected-user runtime evidence for Tortila and Legacy:
- fleet health rows versus owner/user-scoped snapshot proof;
- Legacy pub_id mapping boundaries;
- absence of admin mutation of user settings, provider mappings, credentials, live config, positions, and runtime state;
- absence of raw provider payloads, exchange secrets, and live-control claims in admin UI.

No product, test, runtime, DB, worker, provider, exchange, deploy, SSH, tmux, systemd, env/secret, or live service action was run. The current worktree was already heavily dirty/untracked before this audit, and admin evidence files changed during the audit window; this handoff reflects the final files re-read from disk before writing.

## Files inspected
1. `apps/web/src/features/admin/bot-health-loader.ts`
2. `apps/web/src/features/admin/user-bot-detail-loader.ts`
3. `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx`
4. `apps/web/src/features/admin/health-detail.ts`
5. `apps/web/src/features/admin/queries.ts`
6. `apps/web/src/features/admin/types.ts`
7. `apps/web/src/app/admin/bots/page.tsx`
8. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
9. `apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx`
10. `packages/db/src/repositories.ts`
11. `packages/db/src/schema.ts`
12. `apps/worker/src/legacy-live.ts`
13. `tests/integration/admin-bot-health-loader.test.ts`
14. `tests/integration/admin-user-bot-detail-loader.test.ts`
15. `tests/integration/admin-user-bot-detail-static.test.ts`
16. `docs/handoffs/20260604-1045-phase-4-10-tortila-runtime-evidence-ladder.md`

## Files changed
None - read-only audit except this handoff: `docs/handoffs/20260604-1049-admin-runtime-evidence-platform-security-auditor.md`.

## Findings
1. Severity: Low. Evidence: `apps/web/src/app/admin/bots/page.tsx:225-240`, `apps/web/src/app/admin/bots/page.tsx:305-310`, `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx:18-38`, `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx:75-78`. The fleet admin page is admin-gated and now has a minimal safe fleet evidence ladder: persisted fleet health, Tortila owner snapshots, Legacy pub_id mapping scope, and an explicit inspect-only boundary. Recommendation: keep this as the fleet ladder baseline and do not treat it as live runtime acceptance. Target part: admin fleet `/admin/bots`.
2. Severity: Low. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:171-194`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:292-298`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:582-587`. The selected-user page is admin-gated and now shows a per-bot ladder for entitlement, WTC settings source, runtime scope, user-scoped statistics, and admin boundary. The page copy explicitly says provider mappings and settings are read-only. Recommendation: accept this as the selected-user ladder baseline. Target part: admin selected-user bot drilldown.
3. Severity: Medium. Evidence: `apps/web/src/features/admin/bot-health-loader.ts:250-268`, `apps/web/src/features/admin/bot-health-loader.ts:277-321`, `apps/worker/src/legacy-live.ts:116-121`, `apps/worker/src/legacy-live.ts:235-245`, `apps/web/src/app/admin/bots/page.tsx:566-616`. Legacy fleet diagnostics still derive provider account, active-slot, and active-order facts from the latest `bot_metric_snapshots.rawJson.liveConfig`. The page renders masked pub_id and safe scalar fields, and the worker truncates/redacts `quarantineReason`, but the admin loader itself does not re-project that provider-origin object before shaping the DTO. Recommendation: keep these rows labelled fleet diagnostics only, and add an admin-loader sanitizer or explicit pick-list that drops or canonicalizes `quarantineReason` before any future render. Target part: Legacy fleet live-read DTO boundary.
4. Severity: Medium. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:707-723`, `apps/web/src/features/admin/user-bot-detail-loader.ts:735-767`, `apps/web/src/features/admin/user-bot-detail-loader.ts:998-1007`, `tests/integration/admin-user-bot-detail-loader.test.ts:521-567`, `tests/integration/admin-user-bot-detail-loader.test.ts:569-623`. Selected-user statistics are correctly scoped: Tortila uses the user's bot instance, while Legacy requires `botProviderAccountId` to match the active provider mapping. The tests assert no cross-user rows, unscoped Legacy rows, raw trade JSON, exchange secrets, or passwords leak. Recommendation: preserve this provider-account gate as the only way Legacy runtime facts become user-scoped. Target part: selected-user runtime statistics.
5. Severity: Medium. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:263-303`, `apps/web/src/features/admin/user-bot-detail-loader.ts:868-877`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:323-340`. Legacy warning attribution is intentionally conservative: runtime warnings are included for a selected user only when the latest `legacy-bot` health detail says exactly one provider mapping was seen and snapshotted. This avoids unsafe attribution, but it is health-row count based rather than a durable per-provider proof. Recommendation: add an explicit per-bot runtime-evidence DTO with health target, snapshot time, metrics/positions/trades availability, and provider mapping id; keep ambiguous Legacy health warnings product-level until that proof exists. Target part: selected-user warning/runtime evidence.
6. Severity: Low. Evidence: `apps/web/src/features/admin/bot-health-loader.ts:160-197`, `apps/web/src/features/admin/bot-health-loader.ts:238-248`, `apps/web/src/app/admin/bots/page.tsx:136-170`, `apps/web/src/app/admin/bots/page.tsx:469-550`. The fleet page separates `latestSnapshot` from `tortilaFleetSnapshots`, but the fleet ladder metric "Latest snapshot" is a single latest Tortila metric row without owner identity, while owner attribution lives in the Tortila owner snapshot table. Recommendation: keep `latestSnapshot` labelled as fleet/latest metric only; do not use it for user attribution unless owner id/link is included in the DTO. Target part: Tortila fleet evidence copy.
7. Severity: Low. Evidence: `apps/web/src/features/admin/health-detail.ts:4-42`, `apps/web/src/features/admin/health-detail.ts:68-83`, `tests/integration/admin-bot-health-loader.test.ts:263-298`. Integration health detail rendering uses a whitelist and audit redaction, drops `warningCodes`, and maps warnings through canonical warning copy. Recommendation: keep admin health tables behind `projectHealthDetail`; do not render raw health detail directly. Target part: admin bot health checks and warning summaries.
8. Severity: Low. Evidence: `tests/integration/admin-user-bot-detail-static.test.ts:127-163`, `tests/integration/admin-user-bot-detail-static.test.ts:237-260`, `tests/integration/admin-bot-health-loader.test.ts:184-199`, `tests/integration/admin-bot-health-loader.test.ts:252-261`. Static and loader tests now cover read-only admin evidence, masked pub_id, no raw JSON in pages, no live-control action names, and no secret markers in returned DTOs. Recommendation: run these gates in the next implementation/verifier session; this audit did not execute tests. Target part: regression coverage.

## Decisions
1. Minimal safe fleet ladder: `AdminBotRuntimeEvidencePanel` on `/admin/bots` with rows for `Fleet health row`, `Tortila owner snapshots`, `Legacy pub_id scope`, and `Admin boundary`.
2. Minimal safe selected-user ladder: `AdminBotRuntimeEvidencePanel` inside each selected-user bot card with rows for `Entitlement gate`, `WTC settings source`, `Runtime scope`, `User-scoped statistics`, and `Admin boundary`.
3. Tortila owner proof should remain WTC bot-instance-owner based until a stable audited provider id exists.
4. Legacy runtime facts become user-scoped only through one active WTC provider-account mapping; unmapped Legacy pub_id facts remain fleet diagnostics.
5. Admin pages must stay inspect-only. No admin mutation of user settings, provider mappings, exchange keys, live bot config, positions, live runtime state, or live control belongs in this evidence ladder.

## Risks
1. This audit was read-only and did not run typecheck, lint, Vitest, Playwright, DB migrations, worker ticks, browser checks, or deployment verification.
2. The admin evidence panel and page imports were present by the final disk read, but those files were untracked/modified in a very dirty worktree. Treat gate status as unknown until a focused verifier run executes tests.
3. Legacy fleet diagnostics still depend on the latest persisted worker snapshot, not a live read during render and not complete proof that every provider account is currently fresh.
4. The admin ladder does not prove a bot is running, has current exchange connectivity, or applied WTC-side settings. It only exposes persisted evidence and scope.

## Verification/tests
RUN:
1. `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with extensive pre-existing modified/untracked files.
2. Read-only line-number inspection of the files listed above.
3. `rg` scans for `BotRuntimeEvidencePanel`, `AdminBotRuntimeEvidencePanel`, raw/secret strings, mutation action names, and provider/runtime evidence boundaries.

NOT RUN:
1. `npx vitest run tests/integration/admin-bot-health-loader.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts` - skipped because this was a read-only audit-only lane.
2. `npm run typecheck -w @wtc/web`, `npm run lint`, full test suite, Playwright, and browser verification - skipped because this lane was restricted to read-only inspection plus this handoff.
3. Worker ticks, worker smoke, DB mutations, migrations, seeds, managed DB e2e, provider/API/exchange calls, journal endpoint calls, live bot start/stop/apply/retest, deploy, SSH, tmux, systemd, and env/secret reads - skipped by explicit safety boundary.

## Next actions
1. Run the focused verifier gates for the current admin evidence files: `npx vitest run tests/integration/admin-bot-health-loader.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts`, then `npm run typecheck -w @wtc/web` and `npm run lint`.
2. Add a small admin-loader sanitizer/pick-list for Legacy `rawJson.liveConfig` before shaping fleet DTOs, especially around `quarantineReason` and any future provider-origin strings.
3. Add an explicit `runtimeEvidence` DTO for selected-user bots so the UI can distinguish health-only evidence, metric snapshot proof, position/trade proof, stale proof, and provider-scoped Legacy proof without inferring from multiple fields.
4. Keep all admin evidence copy read-only and evidence-scoped; do not add admin controls for user settings, provider mappings, exchange keys, live config, start/stop, or apply/retest inside these pages.
