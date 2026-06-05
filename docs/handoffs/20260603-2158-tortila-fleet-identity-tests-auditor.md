# tortila-fleet-identity-tests-auditor handoff
## Scope
Phase 3.80 read-only tests audit for Tortila fleet identity on `/admin/bots`.

The audit inspected existing Vitest, Playwright, static, DB-loader, worker, schema, and handoff coverage for admin bot health, bot-read safety, admin responsive/mobile PG8, selected-user bot drilldown, Tortila DB-backed read-only paths, and worker snapshot persistence. It recommends focused tests/gates for the current Tortila fleet identity shape: owner projection through `bot_metric_snapshots -> bot_instances -> users`, aggregate/unmapped behavior, raw-secret redaction, no live controls, no DB/provider mutation from loaders/pages, and demo-mode browser limitations.

No product code, test code, runtime, worker, provider, live server, `.env`, SSH, tmux, systemd, exchange, or database operation was performed. No tests were executed.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260603-2155-phase-3-79-admin-fleet-user-mapping.md`
8. `docs/handoffs/20260603-2142-admin-fleet-user-mapping-platform-auditor.md`
9. `docs/handoffs/20260603-2142-admin-fleet-user-mapping-ux-security-auditor.md`
10. `docs/handoffs/20260603-2144-admin-fleet-user-mapping-tests-auditor.md`
11. `apps/web/src/features/admin/bot-health-loader.ts`
12. `apps/web/src/features/admin/types.ts`
13. `apps/web/src/features/admin/queries.ts`
14. `apps/web/src/app/admin/bots/page.tsx`
15. `apps/web/src/features/admin/user-bot-detail-loader.ts`
16. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
17. `apps/web/src/features/bots/data.tsx`
18. `apps/web/src/features/bots/journal.ts`
19. `apps/worker/src/jobs.ts`
20. `apps/worker/src/index.ts`
21. `packages/db/src/schema.ts`
22. `packages/db/src/repositories.ts`
23. `tests/integration/admin-bot-health-loader.test.ts`
24. `tests/integration/bot-read-safety-static.test.ts`
25. `tests/integration/admin-responsive.test.ts`
26. `tests/integration/admin-user-bot-detail-loader.test.ts`
27. `tests/integration/admin-user-bot-detail-static.test.ts`
28. `tests/integration/worker-tortila-snapshot.test.ts`
29. `tests/e2e/admin-mobile-pg8.spec.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Evidence: current `/admin/bots` code already contains the intended Tortila owner chain: `tortilaFleetSnapshots()` selects `bot_metric_snapshots`, joins `bot_instances`, joins `users`, filters `bot_instances.productCode='tortila_bot'`, keeps the latest row per bot instance, and emits `scope: 'bot_instance_owner'` (`apps/web/src/features/admin/bot-health-loader.ts:116`-`153`). The DTO documents this as latest Tortila snapshots joined to WTC bot instance owners (`apps/web/src/features/admin/types.ts:315`-`363`), and the page renders `Tortila user-scoped snapshots` with owner links and explanatory copy that no Legacy-style provider id is inferred (`apps/web/src/app/admin/bots/page.tsx:226`-`269`). Recommendation: keep `bot_metric_snapshots -> bot_instances -> users` as the focused acceptance path unless product/security explicitly chooses a future `bot_provider_accounts(provider='tortila-journal')` model. Target part: Tortila fleet identity semantics on `/admin/bots`.

2. Severity: High. Evidence: focused PGlite coverage now proves the Tortila owner path and redaction at the loader boundary: it creates a Tortila owner and bot instance, writes two metric snapshots with raw journal/token/secret markers, asserts the newest snapshot is shown with `scope: 'bot_instance_owner'`, checks table counts before/after the loader, and verifies raw marker/token/secret/password/providerAccountId strings are absent (`tests/integration/admin-bot-health-loader.test.ts:200`-`260`). Recommendation: make `tests/integration/admin-bot-health-loader.test.ts` the primary DB semantic gate for Tortila fleet identity. Target part: focused Vitest/PGlite gate.

3. Severity: Medium. Evidence: the same loader test still covers Legacy mapped/unmapped provider rows, active slot/order mapping, no loader mutation, and raw `pub_id`/secret/password redaction (`tests/integration/admin-bot-health-loader.test.ts:59`-`198`). Static coverage checks that admin bot health uses the extracted loader, joins users for Tortila, avoids `exchangeApiKeySecrets`, renders the Tortila table, keeps Legacy safe, hides DB URLs, and has no submit control (`tests/integration/bot-read-safety-static.test.ts:101`-`134`). Recommendation: run the Legacy and Tortila loader/static checks together so Tortila owner identity does not regress while Legacy provider mapping remains masked and navigation-only. Target part: admin fleet tests.

4. Severity: Medium. Evidence: selected-user drilldown PGlite coverage proves target-owned Tortila metrics/positions/trades are isolated from another user and from raw config/secrets (`tests/integration/admin-user-bot-detail-loader.test.ts:424`-`582`). The selected-user static guard verifies RBAC/read-only/no-live-control behavior and rejects submit/config/live controls (`tests/integration/admin-user-bot-detail-static.test.ts:56`-`98`). Recommendation: keep selected-user drilldown tests as adjacent confidence for the `/admin/users/[userId]/bots` destination, but do not count them as the sole proof for fleet rows on `/admin/bots`. Target part: selected-user drilldown destination.

5. Severity: Medium. Evidence: worker persistence coverage proves Tortila snapshots are written through `ensureBotInstance` and DB worker tick paths, imports positions/trades idempotently, records health, and does not fetch the journal in read-only mode without `JOURNAL_READ_TOKEN` (`tests/integration/worker-tortila-snapshot.test.ts:54`-`146`). Worker source documents and implements read-only snapshot writes without live control (`apps/worker/src/jobs.ts:82`-`187`) and resolves the Tortila instance through `SYSTEM_BOT_INSTANCE_ID` or `SYSTEM_BOT_OWNER_ID` before `snapshotTortilaJournal()` (`apps/worker/src/index.ts:154`-`191`). Recommendation: include `tests/integration/worker-tortila-snapshot.test.ts` when verifying the full Tortila owner chain, because `/admin/bots` identity depends on persisted worker snapshots, not page-render adapter calls. Target part: Tortila DB-backed read-only path and worker snapshot persistence.

6. Severity: Medium. Evidence: aggregate/latest snapshot behavior is distinct from Tortila owner rows: the loader still returns a generic `latestSnapshot` from the latest `bot_metric_snapshots` row without owner fields (`apps/web/src/features/admin/bot-health-loader.ts:194`-`202`, `302`-`309`), while the Tortila table has an empty state for no joined owner snapshots (`apps/web/src/app/admin/bots/page.tsx:226`-`235`). Recommendation: add or keep a regression assertion that aggregate cards remain ownerless diagnostics and do not create a user link, while Tortila owner links appear only inside `tortilaFleetSnapshots`; if future "unmapped Tortila" rows are desired, define them explicitly because the current FK chain makes real metric snapshots instance-owned. Target part: aggregate/unmapped row policy.

7. Severity: Medium. Evidence: PG8 mobile coverage includes `/admin/bots` and `/admin/users/demo-user/bots`, proves mobile nav/storage/no horizontal scroll, and records that e2e runs in demo mode with empty DB rows (`tests/e2e/admin-mobile-pg8.spec.ts:12`-`15`, `20`-`57`). Static responsive coverage checks every admin table is wrapped and has `data-label` cells, including `/admin/bots` and selected-user bot detail (`tests/integration/admin-responsive.test.ts:19`-`37`, `69`-`89`). Phase 3.79 also recorded DB-backed browser proof of actual mapped rows as not run (`docs/handoffs/20260603-2155-phase-3-79-admin-fleet-user-mapping.md:117`-`122`). Recommendation: use PG8 Playwright as a render/mobile/no-control gate only; do not claim it proves DB-backed mapped Tortila rows unless a throwaway DB-backed browser harness is added. Target part: Playwright acceptance wording.

## Decisions
1. Tortila fleet identity should be verified as `bot_instance_owner` via WTC-owned `bot_instances`, not by inferring a provider account id from raw journal data.
2. Legacy fleet identity remains a separate provider-account mapping problem; its mapped/unmapped rows and raw `pub_id` masking are already covered by the admin bot health loader test.
3. Browser/mobile PG8 remains valuable for layout and no-control regressions, but semantic DB mapping proof belongs in PGlite loader tests unless a safe throwaway DB-backed Playwright harness is created.
4. This auditor did not run tests because the phase explicitly forbade test execution; all commands below are recommended gates only.
5. No background agents were launched by this per-agent auditor lane; no background agents are left running from this audit.

## Risks
1. The workspace changed during audit; the affected admin loader/test files were refreshed before this handoff, but line numbers can drift if other agents continue editing.
2. The current Tortila test covers a single owner with two snapshots. It does not yet prove multi-owner ordering/limit behavior or that an unrelated latest aggregate snapshot cannot be mistaken for a Tortila owner row.
3. Current Playwright proof is demo-mode, so it cannot validate real DB row content, mapped links, or redaction in rendered browser text.
4. Showing admin-only user email/display name is intentional for owner navigation but still broadens PII on `/admin/bots`; keep the projection minimal and never join password hashes, exchange secrets, sealed payloads, raw snapshot JSON, tokens, or provider URLs.
5. Tortila ownership depends on worker-created/selected bot instance ids. If production uses a shared `SYSTEM_BOT_OWNER_ID`, the owner shown is the WTC owner of that bot instance, not necessarily an exchange-account sub-owner unless product semantics later change.

## Verification/tests
RUN in this audit:
1. Required governance/docs read: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260603-2155-phase-3-79-admin-fleet-user-mapping.md`.
2. Source-only inspection of the files listed above.
3. Read-only working tree/path checks for the requested handoff path.

NOT RUN in this audit:
1. Vitest, Playwright, typecheck, lint, build, secret scan, governance, coverage, `scripts/gates.mjs`, and visual evidence checks - skipped because this was a read-only tests audit and test execution was forbidden.
2. Persistent DB migrate/seed, worker tick/restart, provider DB read/write, live journal read, exchange ping, start/stop/apply/retest/test-connection, SSH, tmux, systemd, `.env` read/write, preview/canary mutation, and live/provider/env operations - forbidden and not performed.

Recommended focused gates for implementation acceptance:
1. DB semantic loader gate:
   `npx vitest run tests/integration/admin-bot-health-loader.test.ts`
2. Static safety/responsive gate:
   `npx vitest run tests/integration/bot-read-safety-static.test.ts tests/integration/admin-responsive.test.ts tests/integration/admin-user-bot-detail-static.test.ts`
3. Selected-user DB destination gate:
   `npx vitest run tests/integration/admin-user-bot-detail-loader.test.ts`
4. Worker persistence gate:
   `npx vitest run tests/integration/worker-tortila-snapshot.test.ts`
5. Demo-mode mobile/no-control render gate:
   `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile`
6. Standard post-change hygiene, if code changed:
   `npm run typecheck -w @wtc/web`
   `npm run typecheck`
   `npm run lint`
   `npm run secret:scan`
   `npm run build -w @wtc/web`
7. Optional DB-backed browser gate only with a throwaway DB harness: assert Tortila owner row link opens `/admin/users/<userId>/bots`, aggregate/latest snapshot card has no owner link, raw snapshot JSON/secrets/password/provider ids are absent from visible text, and no start/stop/apply/test controls are visible.

## Next actions
1. Run the focused gates above in a non-read-only implementation/verification phase if product code or tests are being accepted.
2. Add a small PGlite extension to `admin-bot-health-loader.test.ts` for multi-owner Tortila rows and aggregate/latest snapshot ownerless behavior.
3. If DB-backed browser proof becomes required, create a throwaway DB Playwright harness; do not reuse live/provider/staging DBs for this proof.
4. Keep Tortila provider-account mapping out of `/admin/bots` until a stable audited Tortila provider id is defined and separately approved.
