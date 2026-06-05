# bot-admin-selector-gates-auditor handoff
## Scope
Read-only Phase 4.23 tests/gates audit for the next bounded WTC bot completion slice: admin selector/search by user, display name, and Legacy pub_id; read-only drilldown links; mobile 375px proof; no secret/live-control regressions; and user statistics fail-closed behavior.

No code, live provider, live bot, deploy, or server mutation commands were run. This audit writes only this handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260604-1621-phase-4-22-bot-statistics-admin-command-center.md`
- `package.json`
- `scripts/check-retained-visual-artifacts.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/admin-account-unlock-static.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`

## Files changed
This handoff only: `docs/handoffs/20260604-1626-bot-admin-selector-gates-auditor.md`

## Findings
1. Severity P1 - `/admin/users` has no implemented selector/search contract yet, so the next slice must add both implementation and tests instead of only extending existing assertions. Evidence: `apps/web/src/app/admin/users/page.tsx:19` renders `AdminUsersPage()` without `searchParams`; `apps/web/src/app/admin/users/page.tsx:23` calls `loadAdminUsers()` with no query; `apps/web/src/app/admin/users/page.tsx:63` renders a full `Users (${users.length})` table; `apps/web/src/app/admin/users/page.tsx:117` only links each row to `Bot drilldown`. Recommendation: add a bounded GET search/filter UI and loader contract for email/display name/user id plus mapped Legacy `pub_id`, then test empty, exact, partial/case-insensitive, and no-result states. Target part: admin users selector/search.
2. Severity P1 - Current selected-user drilldown coverage is strong, but it starts after the user is already selected; it does not prove search-to-drilldown routing. Evidence: `tests/e2e/admin-user-bot-detail-db.spec.ts:177` goes directly to `/admin/users/${marker.userAId}/bots`; `tests/e2e/admin-user-bot-detail-db.spec.ts:205` asserts two `Jump to bot card` links; `tests/integration/admin-user-bot-detail-static.test.ts:259` only asserts the directory contains `/admin/users/${u.id}/bots` and `Bot drilldown`. Recommendation: extend the DB e2e flow to visit `/admin/users`, search by seeded email/name/pub_id, click the matching read-only drilldown, assert the selected-user page, and assert other seeded user/provider markers stay hidden. Target part: search-to-drilldown acceptance.
3. Severity P1 - Secret/live-control guards already exist for selected-user drilldown and must be retained while adding selector/pub_id search. Evidence: `tests/e2e/admin-user-bot-detail-db.spec.ts:113-163` defines hidden markers for other-user data, raw config, sealed secrets, `apiSecret`, `apiKey`, `Apply config`, `Start bot`, and `Stop bot`; `tests/e2e/admin-user-bot-detail-db.spec.ts:224-228` asserts hidden markers, no forms, no CSRF hidden input, and no start/stop/apply/test buttons; `tests/integration/admin-user-bot-detail-static.test.ts:127-139` blocks mutation actions and live-control strings. Recommendation: add equivalent assertions for `/admin/users` selector results and any pub_id display, including no full raw pub_id unless masked/approved by the product boundary. Target part: admin users list security.
4. Severity P1 - User statistics fail-closed behavior is already statically covered and should be kept in the next gate stack. Evidence: `tests/integration/bot-read-safety-static.test.ts:334-345` requires user-scoped DB snapshots, Legacy provider mapping, `userScopedSnapshotRequired`, and no global adapter fallback; `tests/integration/admin-user-bot-detail-static.test.ts:50-52` requires exact-one active provider mapping; `docs/handoffs/20260604-1621-phase-4-22-bot-statistics-admin-command-center.md` records the Phase 4.22 P1 fixes. Recommendation: keep these tests in the focused gate and add selector-specific tests proving an unmatched/ambiguous pub_id does not make statistics appear scoped. Target part: fail-closed stats source.
5. Severity P2 - Mobile 375px coverage exists for admin users and selected-user drilldown, but the demo-mode pass does not render real DB rows or selector result density. Evidence: `tests/e2e/admin-mobile-pg8.spec.ts:20-29` includes `/admin/users` and `/admin/users/demo-user/bots`; `tests/e2e/admin-mobile-pg8.spec.ts:37-65` resizes to 375px and asserts no horizontal scroll; comment at `tests/e2e/admin-mobile-pg8.spec.ts:12-15` states demo mode renders empty states while real rows are guarded statically; `tests/integration/admin-responsive.test.ts:69-82` only checks table wrappers/data-labels in source. Recommendation: either extend the DB-backed admin-user-bot Playwright harness with a 375px `/admin/users` search/results pass or add a dedicated admin-users DB e2e spec. Target part: mobile proof with real selector rows.
6. Severity P2 - Existing visual evidence has an explicit manifest caveat; screenshots alone are inventory, not formal acceptance. Evidence: Phase 4.22 handoff says `npm run evidence:visual` formal acceptance was NOT GREEN because no visual review manifest exists; `scripts/check-retained-visual-artifacts.mjs:161-171` requires a manifest; `scripts/check-retained-visual-artifacts.mjs:185-243` fails missing artifacts, missing review labels, duplicate entries, unsafe paths, and non-pass reviews. Recommendation: for any retained selector/mobile screenshots, run inventory during iteration and create/pass a visual review manifest before claiming formal visual acceptance. Target part: screenshot/visual manifest gate.
7. Severity P2 - Existing command scripts support a disposable DB matrix for selected-user bot detail and should be reused rather than inventing live/provider commands. Evidence: `package.json:34-36` defines `e2e:admin-user-bots:db`, `e2e:admin-user-bots:db:managed`, and `e2e:admin-user-bots:db:managed:matrix`; `scripts/prepare-admin-user-bot-detail-e2e.ts:476-489` refuses unless a fresh throwaway DB URL and prep token are present and records a selected-user fixture; `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:25-31` asserts these scripts stay opt-in and out of default CI. Recommendation: extend this harness with selector fixtures and keep it opt-in/managed. Target part: DB-backed acceptance harness.

## Decisions
- Treat the next slice as a UI/read-model/search acceptance slice only: no live bot start/stop/apply-config, no exchange ping, no provider live read, no deploy.
- Reuse the existing admin-user-bot DB e2e harness where possible because it already seeds two users, other-user leak markers, provider mappings, runtime scenarios, and screenshots.
- Keep `/admin/users` search server-side and query-param driven unless the implementation phase chooses a client enhancement backed by the same server result contract; acceptance should be URL-addressable either way.
- Keep Legacy `pub_id` display/search safe: search may match mapped provider accounts, but rendered results should avoid leaking unrelated users or raw provider internals.

## Risks
- The working tree was already very dirty before this audit; do not infer any file's changes were made by this auditor except this handoff.
- Selector search by `pub_id` may tempt a broad join against provider/runtime tables; the implementation must only use admin-safe DTO fields and must not include raw provider payloads, sealed exchange secrets, password hashes, or live adapter calls.
- A green demo-mode 375px screenshot is insufficient for selector completion because real search results and long email/pub_id/name values can introduce mobile overflow.
- Formal visual acceptance remains not green unless a manifest covers retained screenshots; inventory-only visual checks should be reported as inventory-only.

## Verification/tests
Commands run this audit:
- `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with pre-existing modified/untracked files.
- `Get-Content` / `rg` / `Select-String` read-only inspections over the files listed above.
- `Get-Date -Format 'yyyyMMdd-HHmm'` - produced `20260604-1626` for this handoff filename.

Gates not run this audit:
- `npx vitest ...` - NOT RUN; audit-only request, no code changes to validate.
- `npx playwright ...` - NOT RUN; no browser/server commands requested, and no live/provider/deploy commands authorized.
- `npm run secret:scan` - NOT RUN; audit-only request.
- `npm run evidence:visual` - NOT RUN; no new screenshots created in this audit.
- `npm run e2e:admin-user-bots:db:managed:matrix` - NOT RUN; requires explicit disposable Postgres managed harness authorization.
- Live bot/provider/deploy commands - NOT RUN by instruction and policy.

Exact recommended gate stack for the implementation slice:
- `npx vitest run tests/integration/admin-account-unlock-static.test.ts tests/integration/admin-responsive.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-statistics-static.test.ts`
- `npm run typecheck -w @wtc/web`
- `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` after adding selector/result assertions for `/admin/users` at 375px, or a new DB-backed 375px selector spec.
- `npm run e2e:admin-user-bots:db:managed:matrix` only with an explicit throwaway Postgres admin URL, after extending the harness/spec to cover `/admin/users` search by email/display name/user id/pub_id and click-through.
- `npm run secret:scan`
- `npm run governance:check`
- `git diff --check`
- `npm run evidence:visual -- --inventory tests/e2e/screenshots` for inventory only during iteration.
- `npm run evidence:visual -- --manifest <workspace-local-selector-visual-manifest.json> tests/e2e/screenshots` before claiming formal visual acceptance for retained screenshots.

Commands that should remain out of scope:
- No `npm run worker:tick`, `npm run accept:worker:continuity`, provider preflights, live bot control, exchange key probes, SSH/deploy, docker restart, or production smoke commands for this selector/search slice.

## Next actions
1. Add admin-user selector/search implementation on `/admin/users` with URL-addressable query state and safe result copy for email/display name/user id/mapped Legacy pub_id.
2. Extend static coverage to require the selector UI, query-param handling, safe DTO fields, read-only drilldown links, no secret/live-control strings, and wrapped/data-labelled result tables.
3. Extend the DB-backed Playwright harness to seed multiple searchable users and mapped/unmapped Legacy pub_id rows, then assert search by email, display name, user id, and pub_id, including no-result and other-user no-leak cases.
4. Add real-row 375px proof for `/admin/users` selector/results and selected-user drilldown links; retain screenshots only with inventory plus manifest-backed visual acceptance when claiming green.
5. Keep user statistics fail-closed: no global adapter fallback, no ambiguous Legacy provider mapping, and no scoped stats shown unless persisted user-scoped snapshots or exact-one active provider mapping prove the scope.
