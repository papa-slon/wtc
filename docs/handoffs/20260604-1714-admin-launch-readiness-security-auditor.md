# admin-launch-readiness-security-auditor handoff
## Scope
Read-only Phase 4.25 security/runtime audit for the admin selected-user launch-readiness mirror in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Audited whether the selected-user admin bot page can mirror launch readiness without editing user settings, provider mappings, exchange keys, live config, positions, or bot runtime, and without exposing raw `pubId`, `providerPubId`, `providerAccountId`, `rawJson`, exchange keys, sealed vault data, bearer tokens, DB URLs, or other secrets.

No live/provider/worker/deploy commands were run. No code was edited.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260604-1705-phase-4-24-bot-launch-readiness-command-center.md`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/health-detail.ts`
- `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx`
- `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/features/bots/readiness-loader.ts`
- `apps/web/src/features/bots/runtime-config-sanitizer.ts`
- `apps/web/src/features/bots/config-export.ts`
- `apps/web/src/features/bots/config-export-handler.ts`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/bot-readiness-server-dto-static.test.ts`
- `tests/integration/bot-runtime-config-sanitizer.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-config-export-route-handler.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`

## Files changed
None - read-only audit. This handoff file is the only written artifact.

## Findings
1. Severity P1 - The current selected-user admin mirror is read-only in code shape, but must stay that way. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:366` requires a user and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:368` asserts admin before loading the page; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:387`-`389` renders `LIVE CONTROL: DISABLED`, `user settings: read-only`, and `provider mappings: read-only`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:517`-`530` mounts `BotLaunchReadinessPanel` with admin anchor links, `no live probe`, and `Admin start unavailable`; `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx:121`-`127` renders the control as `type="button"` and `disabled`. Recommendation: keep the admin mirror limited to disabled review UI and anchor links; do not add forms, server actions, route handlers, adapter calls, or submit controls. Target part: admin selected-user launch-readiness mirror.

2. Severity P1 - Provider identity is currently masked before the admin DTO reaches the page, but the page still renders the masked value in multiple places, so raw-id regression tests are required for this slice. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:218`-`225` masks provider account ids, hashing very short ids; `apps/web/src/features/admin/user-bot-detail-loader.ts:718`-`732` maps `providerAccountId` through that masker; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:83`-`87` and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:541`-`548` render `bot.providerAccount.providerAccountId`, which is safe only because the loader already masked it; `tests/integration/admin-user-bot-detail-loader.test.ts:941`-`947` proves a short provider id becomes `id#...` and raw `AB12` does not serialize. Recommendation: do not pass raw provider ids, raw pub ids, or provider payloads into the launch mirror; add/keep tests that stringify the DTO and rendered page for raw `pubId`, `providerPubId`, `providerAccountId`, and known marker values. Target part: selected-user loader/page provider identity boundary.

3. Severity P1 - The admin loader avoids secret tables/payload columns and scopes Legacy stats by exact active provider mapping, which is the right runtime boundary for the mirror. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:921`-`930` selects only exchange account metadata, not `exchangeApiKeySecrets`; `apps/web/src/features/admin/user-bot-detail-loader.ts:978`-`1039` selects metric/position/trade scalar columns and omits `rawJson`; `apps/web/src/features/admin/user-bot-detail-loader.ts:1066`-`1077` accepts an active provider mapping only when exactly one exists; `apps/web/src/features/admin/user-bot-detail-loader.ts:1092`-`1100` refuses Legacy metric rows unless they match that active provider; `apps/web/src/features/admin/user-bot-detail-loader.ts:1143`-`1150` returns `liveControlDisabled: true`. Recommendation: keep launch readiness derived from this admin-safe DTO or a similarly scalar DTO; do not import `exchangeApiKeySecrets`, raw runtime JSON, provider response bodies, or worker/adapters into the admin page. Target part: admin user bot loader.

4. Severity P1 - Existing readiness DTO helpers are safe for user surfaces, but the admin mirror currently builds its own items from `AdminUserBotSummary`; any future unification must preserve the scalar-only boundary. Evidence: `apps/web/src/features/bots/readiness-loader.ts:1` is server-only; `apps/web/src/features/bots/readiness-loader.ts:53`-`71` summarizes exchange key readiness from account/metadata counts; `apps/web/src/features/bots/readiness-loader.ts:73`-`91` summarizes Legacy provider readiness from mapping status and counts; `packages/db/src/repositories.ts:415`-`432` selects only exchange account ids and secret-row account ids; `packages/db/src/repositories.ts:1849`-`1881` returns provider mapping counts/status, never provider ids. Recommendation: if Phase 4.25 refactors toward shared readiness DTOs, expose an admin-safe builder or adapter that takes only `AdminUserBotSummary`/scalar summaries; do not call a live read model from the admin page. Target part: readiness loader/DTO boundary.

5. Severity P1 - Test coverage has drift: the admin mirror intentionally adds a disabled start-labelled button, while the DB-backed admin e2e still asserts zero buttons matching start/stop/apply/test connection. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:527` sets `disabledLabel="Admin start unavailable"`; `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx:121`-`127` renders that as a disabled button; `tests/e2e/admin-user-bot-detail-db.spec.ts:226`-`228` still expects no forms, no CSRF hidden input, and no button named `/start|stop|apply|test connection/i`; `tests/integration/admin-user-bot-detail-static.test.ts:70`-`140` checks the page is read-only but does not assert the admin launch mirror itself. Recommendation: update the admin tests in the implementation phase to either assert the disabled admin readiness button explicitly plus no form/action/CSRF, or rename the disabled control to avoid live-control words; keep raw-id/secret leak assertions. Target part: admin selected-user static and DB-backed e2e gates.

6. Severity P2 - Config/export and runtime sanitizers are appropriately defensive, but the admin launch mirror must not consume exported/runtime raw bags. Evidence: `apps/web/src/features/bots/runtime-config-sanitizer.ts:3`-`37` blocks secret, provider, raw JSON, URL/header, and live-control keys; `apps/web/src/features/bots/runtime-config-sanitizer.ts:72`-`95` recursively strips or masks provider identity; `apps/web/src/features/bots/config-export.ts:224`-`230` deletes `providerPubId` from Legacy export rows; `apps/web/src/features/bots/config-export-handler.ts:56`-`80` gates export by session, entitlement, and exact-one Legacy provider mapping before emitting a file. Recommendation: keep the mirror as a view of admin-safe readiness facts, not a view of config-export bodies or runtime `raw` payloads; do not add "download/apply/start" affordances to the mirror. Target part: config/export sanitizer boundary.

## Decisions
- Treated this as one read-only per-agent auditor handoff, not a broad implementation phase. No "N-agent audit" claim is made.
- Did not edit code or tests. The only write is this handoff file.
- Did not run live/provider/worker/deploy commands, worker ticks, exchange pings, provider probes, DB migrations/seeds, SSH, tmux, systemd, preview, or Playwright.
- The no-live-control requirement for this mirror is: no `startBot`, `stopBot`, `applyConfig`, `restart`, `retest`, exchange ping, provider probe, live adapter call, worker mutation, route handler mutation, server action mutation, CSRF form, hidden mutation field, user-settings edit, provider-mapping edit, exchange-key edit, live config edit, position action, or bot runtime mutation.
- The no-exposure requirement for this mirror is: no raw `pubId`, `providerPubId`, `providerAccountId`, `rawJson`, `liveConfig`, sealed payload, `wrappedDek`, API key/secret, bearer token, DB URL, provider response body, or secret-shaped marker in HTML, JSON, logs, screenshots, tests, or handoffs.

## Risks
- The working tree was already heavily dirty before this audit and changed during inspection; this handoff describes the current inspected state and does not certify unrelated dirty files.
- The disabled button label `Admin start unavailable` may be acceptable UX, but it conflicts with the current admin DB e2e no-button assertion until tests are updated.
- The admin page renders a field named `providerAccountId`; it is masked by the loader today, but the misleading DTO property name can invite future raw-id misuse.
- Static tests guard many boundaries, but rendered admin launch-readiness coverage is not yet updated for the new mirror.
- Formal gates were not run in this read-only lane, so no green test/build/secret-scan claim is made.

## Verification/tests
RUN:
- Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and latest aggregate `docs/handoffs/20260604-1705-phase-4-24-bot-launch-readiness-command-center.md`.
- Static source inspection with `rg` and numbered `Get-Content` reads for the admin page, admin loader/DTOs, readiness DTO, launch panel, sanitizers, export route/handler, repository summaries, and relevant tests.
- `git status --short --branch` was inspected before the handoff; the tree was already dirty with many pre-existing modified/untracked files.
- Handoff target existence check for `docs/handoffs/20260604-1714-admin-launch-readiness-security-auditor.md` returned false before writing.

NOT RUN / NOT GREEN:
- No Vitest, Playwright, typecheck, lint, build, secret scan, governance check, `git diff --check`, or visual evidence gate was run in this read-only audit.
- No DB-backed admin e2e matrix was run; current source inspection indicates it likely needs an assertion update for the disabled admin start-readiness button.
- No live bot start/stop/apply-config, exchange ping, provider probe, worker tick/smoke/continuity command, SSH/tmux/systemd/deploy, DB migration/seed, or server mutation was run.

## Next actions
1. Update the implementation tests for the admin mirror: assert `Admin launch readiness mirror`, `no live probe`, disabled `Admin start unavailable` (or use a non-start label), no forms, no CSRF, no server actions, and no raw-id/secret markers.
2. Keep `adminLaunchReadinessItems()` fed from `AdminUserBotSummary` or a new admin-safe scalar readiness DTO; do not pass raw runtime config or provider payloads into the panel.
3. Rename the DTO display field from `providerAccountId` to `providerAccountLabel` or `providerAccountMask` when practical, so page code cannot accidentally treat it as raw provider identity.
4. Run focused static tests and the opt-in DB-backed admin user bot detail e2e after the implementation owner updates tests; do not run live/provider/worker/deploy commands for this mirror.
