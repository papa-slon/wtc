# admin-user-resolved-source-ux-security-auditor handoff
## Scope
Read-only Phase 3.78 UX/security audit for admin selected-user bot drilldown UX/RBAC.

Acceptance lens: an admin may inspect a selected user's resolved bot settings source, safe settings summary, persisted statistics, and provider pub_id mapping evidence, but must not edit user settings, mutate provider/worker/live bot state, or expose secrets/raw provider ids.

No live service/provider/worker, SSH, tmux, systemd, exchange, `.env`, or runtime mutation operations were performed.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-2106-phase-3-77-user-resolved-bot-config-source.md`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/bots/config/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/lib/nav.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-global-bot-config-static.test.ts`
- `tests/integration/admin-global-bot-config-db.test.ts`
- `tests/integration/user-resolved-bot-config-static.test.ts`
- `tests/integration/user-resolved-bot-config-db.test.ts`

## Files changed
None — read-only audit.

## Findings
1. Severity: High. The selected-user bot drilldown does not show the Phase 3.77 resolved settings source; it only summarizes the latest user-owned `bot_configs` row. Evidence: the admin loader builds `configSummary` from `configsByInstance`/`config` only (`apps/web/src/features/admin/user-bot-detail-loader.ts:632`, `apps/web/src/features/admin/user-bot-detail-loader.ts:660`, `apps/web/src/features/admin/user-bot-detail-loader.ts:677`) and labels both products as `Saved WTC reference v...` (`apps/web/src/features/admin/user-bot-detail-loader.ts:271`, `apps/web/src/features/admin/user-bot-detail-loader.ts:290`). The page explicitly says defaults are not shown when no user config exists (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:155`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:157`). Meanwhile the user resolver already resolves `user_override -> system_default -> built_in` through published global defaults (`apps/web/src/features/bots/config.ts:887`, `apps/web/src/features/bots/config.ts:899`, `apps/web/src/features/bots/config.ts:915`, `apps/web/src/features/bots/config.ts:931`). Recommendation: add an admin-safe resolved config projection that reuses or mirrors the resolver, including `source`, `sourceLabel`, `sourceDetail`, `systemDefault`, `userCurrent`, and a safe summary of the active resolved config. Target part: admin selected-user loader/page/tests.
2. Severity: High. Provider account masking still exposes short raw provider ids. Evidence: `maskProviderAccountId` returns the full value when length is `<= 10` (`apps/web/src/features/admin/user-bot-detail-loader.ts:202`, `apps/web/src/features/admin/user-bot-detail-loader.ts:204`), and the selected-user page renders that DTO in the provider mapping block/table (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:126`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:127`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:348`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:349`). Current loader tests only prove a long fixture is redacted (`tests/integration/admin-user-bot-detail-loader.test.ts:155`, `tests/integration/admin-user-bot-detail-loader.test.ts:502`, `tests/integration/admin-user-bot-detail-loader.test.ts:519`). Recommendation: always render a non-reversible display fingerprint or partial mask that never equals the stored provider id, and add a short-id fixture. Target part: provider mapping DTO and tests.
3. Severity: Medium. The admin drilldown journey is inconsistent on raw provider ids because it links from the masked selected-user view to the fleet page, where raw Legacy `pub_id` values are rendered. Evidence: selected-user page links to `/admin/bots` (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:386`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:387`); the fleet page renders `account.pubId`, `slot.pubId`, and `order.pubId` directly (`apps/web/src/app/admin/bots/page.tsx:219`, `apps/web/src/app/admin/bots/page.tsx:233`, `apps/web/src/app/admin/bots/page.tsx:234`, `apps/web/src/app/admin/bots/page.tsx:262`, `apps/web/src/app/admin/bots/page.tsx:284`). Recommendation: align the fleet diagnostics display with the selected-user raw-id policy, or explicitly document that fleet inspectors are a separate privileged raw-id surface and avoid routing this drilldown journey there as a primary action. Target part: nav/admin pages and Legacy fleet diagnostics.
4. Severity: Medium. Test coverage passes for the current saved-config behavior but does not exercise the new resolved-source states for this admin page. Evidence: the static test asserts `configSummary: mapConfigSummary` and safe-table reads (`tests/integration/admin-user-bot-detail-static.test.ts:21`, `tests/integration/admin-user-bot-detail-static.test.ts:39`, `tests/integration/admin-user-bot-detail-static.test.ts:40`), and the DB test asserts `Saved WTC reference v1` for both products (`tests/integration/admin-user-bot-detail-loader.test.ts:421`, `tests/integration/admin-user-bot-detail-loader.test.ts:423`, `tests/integration/admin-user-bot-detail-loader.test.ts:467`, `tests/integration/admin-user-bot-detail-loader.test.ts:469`). It does not include `bot_global_configs`, system-default marker rows, locked overrides, built-in fallback, or short provider ids. Recommendation: add focused PGlite/admin-static cases for published system default inheritance, marker-selected system defaults, `allowUserOverride=false`, no-instance built-in fallback, and short provider id redaction. Target part: admin user bot detail tests.
5. Severity: Low. RBAC is currently enforced at the admin page/layout layer, but the admin query helper itself intentionally does not repeat RBAC before returning selected-user bot detail. Evidence: `queries.ts` documents that callers own `requireUser() + assertAdmin()` (`apps/web/src/features/admin/queries.ts:8`, `apps/web/src/features/admin/queries.ts:9`), and `loadAdminUserBotDetail` directly returns the DB projection (`apps/web/src/features/admin/queries.ts:171`, `apps/web/src/features/admin/queries.ts:176`). The selected-user page does assert admin today (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:42`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:43`), and admin layout also redirects non-admins (`apps/web/src/app/admin/layout.tsx:15`). Recommendation: for this high-sensitivity loader, either accept an actor and assert admin inside the query wrapper or add a static guardrail that this loader is only imported by admin-gated server components. Target part: admin RBAC boundary.

## Decisions
1. This audit did not edit product code, tests, migrations, fixtures, env files, live providers, workers, or runtime state.
2. The selected-user page has a solid current read-only posture: it calls `requireUser`/`assertAdmin`, displays `LIVE CONTROL: DISABLED`, labels user settings/provider mappings as read-only, and the static tests assert no mapping/settings/live-control forms are present (`tests/integration/admin-user-bot-detail-static.test.ts:52`, `tests/integration/admin-user-bot-detail-static.test.ts:57`, `tests/integration/admin-user-bot-detail-static.test.ts:72`, `tests/integration/admin-user-bot-detail-static.test.ts:76`, `tests/integration/admin-user-bot-detail-static.test.ts:77`, `tests/integration/admin-user-bot-detail-static.test.ts:80`).
3. The loader avoids sealed exchange secrets and raw snapshot JSON in its selected columns/tests (`tests/integration/admin-user-bot-detail-static.test.ts:33`, `tests/integration/admin-user-bot-detail-static.test.ts:35`, `tests/integration/admin-user-bot-detail-static.test.ts:36`) and the DB fixture confirms table counts do not change during load (`tests/integration/admin-user-bot-detail-loader.test.ts:398`, `tests/integration/admin-user-bot-detail-loader.test.ts:401`).
4. The main acceptance blocker is not live-control safety; it is resolved-source correctness and raw-provider-id consistency.

## Risks
1. Admins can currently misread "No user-owned WTC reference" as "no active settings" even when a published system default or built-in fallback is the actual resolved settings source.
2. A short Legacy provider id can be displayed verbatim in selected-user mapping evidence until masking is made non-reversible for all lengths.
3. Adjacent fleet diagnostics may remain intentionally raw-id oriented; if so, the product needs a written policy distinction between raw fleet diagnostics and selected-user drilldown evidence.
4. The worktree was already dirty before this audit, including the target admin/user bot files and many previous handoffs; this audit did not revert or normalize those existing changes.

## Verification/tests
RUN:
1. `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts` - PASS, 2 files / 6 tests.
2. Read-only source inspection of the required governance docs, selected-user admin page/loader, admin user/nav/fleet/defaults pages, bot config resolver, and admin user bot detail tests.

NOT RUN / NOT GREEN:
1. Product code changes - not run; phase scope is read-only audit.
2. Full `npm test` - not run; focused admin-user bot detail suites only.
3. Full `npm run typecheck`, `npm run lint`, `npm run build`, Playwright, visual evidence gates, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e` - not run; audit scope did not require full verification and no product code was edited.
4. DB migration apply/seed against persistent DB - not run; only PGlite test migration replay inside the focused Vitest suite.
5. Live Legacy/Tortila bot continuity, worker tick/restart, exchange ping/test, provider DB live read/write, SSH, tmux, systemd, `.env` reads/writes, start/stop/retest/apply-config - forbidden by scope and not run.

## Next actions
1. Implement an admin-safe resolved config summary for selected-user bot detail by sharing resolver semantics with `loadBotConfig`, while preserving separate user-owned config evidence.
2. Make provider id display non-reversible for every length across selected-user mapping evidence; add short-id and exact-raw-id negative assertions.
3. Decide whether `/admin/bots` is allowed to display raw fleet `pub_id`; if not, mask/fingerprint it there too before treating the admin drilldown journey as compliant.
4. Add PGlite/static tests for system default, built-in fallback, locked override, system-default marker, and short provider id cases.
