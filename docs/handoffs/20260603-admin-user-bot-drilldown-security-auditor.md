# ecosystem-security-auditor handoff
## Scope
Read-only security/RBAC audit for a proposed admin user -> bot settings/statistics drilldown in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Task questions answered:
- Safe DTO boundaries for an admin read-only user bot drilldown.
- What the drilldown can and cannot show before normalized provider-account scoping.
- Audit requirements for target-user bot inspection.
- Whether a bounded UI-only route/section is acceptable before normalized provider-account scoping.

No application/runtime code, secrets, live server, live bot, provider, exchange, database state, migrations, or deployment state were mutated. Background agent tooling was not exposed in this Codex session, so this is the assigned security-auditor handoff only and not an N-agent audit claim.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-bot-settings-security-access.md`
- `docs/handoffs/20260603-bot-settings-platform-db.md`
- `docs/handoffs/20260603-bot-settings-ux-product.md`
- `docs/handoffs/20260603-bot-settings-tests-runner.md`
- `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/RBAC_MATRIX.md`
- `docs/SECURITY_MODEL.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `apps/web/src/lib/nav.ts`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/health-detail.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `packages/auth/src/rbac.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/admin-health-detail.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`

## Files changed
- `docs/handoffs/20260603-admin-user-bot-drilldown-security-auditor.md` only.

## Findings
1. Severity: HIGH. A bounded admin user -> bot drilldown is acceptable before normalized provider-account scoping only if it is explicitly read-only, admin-only, DTO-only, and does not claim target-user provider ownership.
   Evidence: current admin layout requires a session and redirects non-admins at `apps/web/src/app/admin/layout.tsx:12` to `apps/web/src/app/admin/layout.tsx:16`; `/admin/users` repeats `requireUser()` and `assertAdmin()` before `loadAdminUsers()` at `apps/web/src/app/admin/users/page.tsx:18` to `apps/web/src/app/admin/users/page.tsx:22`; `/admin/bots` repeats the same guard at `apps/web/src/app/admin/bots/page.tsx:44` to `apps/web/src/app/admin/bots/page.tsx:48`; non-negotiable policy keeps discovery/read-only and no live bot control at `AGENTS.md:74` to `AGENTS.md:82`. The current nav has `/admin/users` and `/admin/bots`, but no user-specific bot drilldown route at `apps/web/src/lib/nav.ts:20` to `apps/web/src/lib/nav.ts:32`.
   Recommendation: a first slice may add `/admin/users/[userId]/bots` or a section/drawer under `/admin/users`, but it must render only safe target-user DTOs and states such as "not scoped yet" where provider ownership is unknown. Do not use it to reveal full Legacy provider accounts, active orders, or live runtime ownership before normalized provider-account scoping. Keep the current admin-only layout; do not broaden to support users in this slice.
   Target part: admin IA, admin server loader, admin DTOs.

2. Severity: HIGH. Do not reuse current `loadBotReadModel(productCode, parts)` for target-user admin drilldown because its DB snapshot path is product-scoped, not target-user/provider-account scoped.
   Evidence: `loadDbBotReadModel()` accepts only `productCode` and `parts` at `apps/web/src/features/bots/data.tsx:241` to `apps/web/src/features/bots/data.tsx:245`; latest metric, position, and trade selectors join `bot_instances` but filter only by `productCode` at `apps/web/src/features/bots/data.tsx:258` to `apps/web/src/features/bots/data.tsx:294`; the selected `botInstanceId` is then inferred from the latest product row at `apps/web/src/features/bots/data.tsx:296` to `apps/web/src/features/bots/data.tsx:299`; Legacy runtime config exposes `rawMetric.rawJson.liveConfig` as `config.raw` at `apps/web/src/features/bots/data.tsx:395` to `apps/web/src/features/bots/data.tsx:411`. Prior platform/DB handoff identifies this same product-scoped gap at `docs/handoffs/20260603-bot-settings-platform-db.md:69` to `docs/handoffs/20260603-bot-settings-platform-db.md:72`.
   Recommendation: implement a dedicated admin query, for example `loadAdminUserBotDrilldown(targetUserId)`, that starts from `listBotInstancesForUser(db, targetUserId)` / `loadBotConfig(targetUserId, productCode)` and then reads only rows tied to that target user's `bot_instance.id`. If no target-owned bot instance or snapshot exists, show an empty/unavailable state. Never call product-wide `loadBotReadModel()` for a target user page.
   Target part: `apps/web/src/features/admin/queries.ts`, `apps/web/src/features/admin/types.ts`, `apps/web/src/features/bots/data.tsx` future refactor.

3. Severity: HIGH. Legacy provider-account identity must remain masked/minimized in the target-user drilldown until `bot_provider_accounts` or equivalent normalized ownership exists.
   Evidence: current DB has `bot_instances.userId`, `productCode`, and optional `exchangeAccountId`, but no provider-account ownership table at `packages/db/src/schema.ts:138` to `packages/db/src/schema.ts:152`; `/admin/bots` derives Legacy rows from the latest raw `legacy_bot` snapshot at `apps/web/src/features/admin/queries.ts:426` to `apps/web/src/features/admin/queries.ts:459`; the admin fleet page renders full `pub_id` values and active slot/order details at `apps/web/src/app/admin/bots/page.tsx:219` to `apps/web/src/app/admin/bots/page.tsx:288`; user settings masks pub_id with `shortPubId()` and renders only the shortened form at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:43` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:45` and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:175` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:201`; statistics panels similarly shorten provider IDs at `apps/web/src/features/bots/statistics-panels.tsx:434` to `apps/web/src/features/bots/statistics-panels.tsx:435` and render shortened IDs at `apps/web/src/features/bots/statistics-panels.tsx:484` to `apps/web/src/features/bots/statistics-panels.tsx:554`.
   Recommendation: for target-user drilldown before normalized scoping, show counts, stale/fresh status, masked provider IDs, and source labels only. Do not show full `pub_id`, per-pub_id active slots/orders, balances as target-owned facts, or "this user's live account" copy unless a normalized account row proves the relation. Full provider-ID reveal should move behind a future audited inspect action with reason.
   Target part: Legacy admin DTO, admin drilldown UI, future provider-account model.

4. Severity: MEDIUM/PASS. Current safe DTO building blocks are sufficient for a UI-only first slice if the new route composes them rather than exposing raw rows.
   Evidence: `AdminUserView` intentionally strips `passwordHash` and returns only user display/security fields at `apps/web/src/features/admin/types.ts:6` to `apps/web/src/features/admin/types.ts:29`; `mapToAdminUserView()` excludes password hashes at `apps/web/src/features/admin/queries.ts:104` to `apps/web/src/features/admin/queries.ts:138`; the DB repository warns `listUsersWithCreatedAt()` returns `passwordHash` and must not be returned directly at `packages/db/src/repositories.ts:3274` to `packages/db/src/repositories.ts:3282`; exchange key listing never joins sealed secret rows at `packages/db/src/repositories.ts:404` to `packages/db/src/repositories.ts:407`; admin health detail projection redacts and allowlists keys at `apps/web/src/features/admin/health-detail.ts:3` to `apps/web/src/features/admin/health-detail.ts:74`; Legacy export now rebuilds from an allowlisted config at `apps/web/src/features/bots/config.ts:637` to `apps/web/src/features/bots/config.ts:718`.
   Recommendation: define `AdminUserBotDrilldownState` as a new DTO in `apps/web/src/features/admin/types.ts`. Safe fields: target user id/email/displayName/roles/createdAt/lockout; product entitlement/access state; WTC config version, mode, safe symbol/stage summaries, and version timestamps; target-owned bot instance id/product only when needed for links; masked exchange-key metadata (`id`, `exchange`, `label`, `mode`, `keyMask`) for Tortila; projected health/read-state; aggregate/safe metrics only when tied to target-owned rows. Explicitly exclude raw DB rows, `passwordHash`, session tokens, sealed/ciphertext material, raw `rawJson`, raw `liveConfig`, DB URLs, stack traces, and raw provider diagnostic blobs.
   Target part: admin types/query boundary.

5. Severity: MEDIUM. The drilldown needs audit policy before it graduates from a masked summary to sensitive account inspection.
   Evidence: `AUDIT_ACTIONS` includes `admin.user_view` but no `admin.bot_account.inspect` or `admin.user_bot_drilldown` action at `packages/audit/src/audit.ts:120` to `packages/audit/src/audit.ts:128`; audit docs list `admin.user_view` as an optional security event at `docs/AUDIT_LOG_SCHEMA.md:256` to `docs/AUDIT_LOG_SCHEMA.md:262`; RBAC docs say read-only escalation audit is a target policy unless explicitly implemented at `docs/RBAC_MATRIX.md:292` to `docs/RBAC_MATRIX.md:306`; audit payloads must be minimal and redacted at `docs/AUDIT_LOG_SCHEMA.md:312` to `docs/AUDIT_LOG_SCHEMA.md:326`, and `auditRowValues()` routes payloads through `buildEvent()` redaction before DB insert at `packages/db/src/repositories.ts:410` to `packages/db/src/repositories.ts:419`.
   Recommendation: for a UI-only masked summary, document that no new read audit is emitted and keep sensitive details out. For any target-user bot drilldown that exposes cross-user config/statistics beyond the existing user directory, prefer writing `admin.user_view` with `after: { section: 'bots', productCodes, sensitiveReveal: false }`. Before full provider account reveal, add `admin.bot_account.inspect` with actor id, target user id, product, provider account id or masked pub_id, reason, result, and no raw snapshot/config. This means the "audited reveal" version is no longer pure UI-only because it writes an audit row.
   Target part: `packages/audit`, `packages/db`, admin read route/server action policy.

6. Severity: MEDIUM. The route must not introduce live bot control, exchange key testing, or runtime apply semantics.
   Evidence: admin bot page states live control is disabled and no live-control buttons exist at `apps/web/src/app/admin/bots/page.tsx:30` to `apps/web/src/app/admin/bots/page.tsx:43`; the bot detail page renders start/stop controls disabled and says monitoring is read-only at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:239` to `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:266`; `saveBotConfig()` is WTC DB only and never forwarded to a live bot at `packages/db/src/repositories.ts:1677` to `packages/db/src/repositories.ts:1690`; previous aggregate keeps live start/stop/apply-config and exchange key test out of scope at `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md:90` to `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md:96`.
   Recommendation: the drilldown may link to user bot pages or show "reference config" and "runtime snapshot" labels, but must not include start, stop, apply, retest, key plaintext reveal, live exchange ping, or "configuration applied to bot" claims.
   Target part: admin drilldown UI copy and controls.

7. Severity: MEDIUM. Existing tests cover several safety invariants, but not the target-user drilldown isolation/audit gates.
   Evidence: bot read safety tests assert admin bot health uses safe detail projection and exposes a safe Legacy inspector at `tests/integration/bot-read-safety-static.test.ts:87` to `tests/integration/bot-read-safety-static.test.ts:104`; export tests assert `legacyAllowedExportConfig` and entitlement-gated export at `tests/integration/bot-config-export-static.test.ts:14` to `tests/integration/bot-config-export-static.test.ts:32`; admin health detail tests assert redaction/allowlisting at `tests/integration/admin-health-detail.test.ts:4` to `tests/integration/admin-health-detail.test.ts:45`; no inspected test asserts that an admin user bot drilldown avoids `loadBotReadModel(productCode)` product-wide reads or creates a read audit event.
   Recommendation: add static tests before/with implementation: route is under admin layout and repeats `requireUser/assertAdmin`; admin drilldown query does not import/call `loadBotReadModel`; no `rawJson`, `liveConfig`, full `pubId`, sealed, token, URL, or password fields are rendered; Legacy provider details are masked/unavailable before normalized scoping; optional read audit action is emitted when sensitive inspection is enabled.
   Target part: integration/static tests and future Playwright admin drilldown test.

## Decisions
1. A bounded UI-only admin user bot drilldown is acceptable before normalized provider-account scoping, but only as a masked/read-only summary of WTC-owned state and target-owned rows. It is not acceptable as a full Legacy provider-account inspector.
2. The safe boundary is a new admin DTO from `apps/web/src/features/admin/queries.ts` and `apps/web/src/features/admin/types.ts`, not raw `BotReadModel`, raw `bot_metric_snapshots.rawJson`, raw `legacyLiveConfig`, or repository user rows that include `passwordHash`.
3. For WTC reference settings, it is safe to show version, operation mode, symbol/stage summaries, validation status, and export availability. The copy must say "reference config" unless runtime snapshot data proves otherwise.
4. For statistics, it is safe to show target-owned `bot_instance` aggregates only when the query begins with target user ownership. If current data is product-wide/system-owner only, render "not scoped yet" or "fleet latest, not user-owned" rather than target-user stats.
5. For Legacy, show masked provider identity and counts only until `bot_provider_accounts` or equivalent proves `user_id <-> provider_pub_id` ownership. Full `pub_id` reveal and per-account slot/order drilldown require a future audited inspect action.
6. The current App Router admin console is admin-only; keep this drilldown admin-only. Do not rely on the broader docs-level support-read allowance for this sensitive slice.
7. No live bot control, exchange key test, live config apply, provider mutation, or secret reveal belongs in this drilldown.

## Risks
1. Reusing product-scoped bot snapshot loaders would let an admin target-user page accidentally display the latest global Legacy/Tortila snapshot as if it belonged to the selected user.
2. Full Legacy `pub_id`, balance, slot, and order detail can become cross-user operational leakage without a normalized provider-account table and audit trail.
3. A "UI-only" route that avoids audit writes is lower risk only while it stays masked and summary-level; it is not enough for sensitive reveal/impersonate-style inspection.
4. Support-role read access in docs does not match the current admin-only App Router layout; broadening access later requires a separate support-safe DTO policy.
5. Static source inspection did not prove runtime behavior, DB contents, production grants, or deployed route behavior.

## Verification/tests
RUN:
- `git status --short --branch` before writing: branch `codex/bot-analytics-settings-canary-20260603...origin/codex/bot-analytics-settings-canary-20260603` with pre-existing modified/untracked files in bot settings, admin queries, bot tests, and handoffs. These were not authored by this audit and were left untouched.
- `Test-Path docs/handoffs/20260603-admin-user-bot-drilldown-security-auditor.md` before writing returned `False`.
- Static source inspection with `Get-Content`/`rg` over the files listed above.
- `npx secretlint "docs/handoffs/20260603-admin-user-bot-drilldown-security-auditor.md"` passed.
- Final `git status --short --branch` showed additional concurrent admin-drilldown files outside this handoff, including `apps/web/src/app/admin/users/[userId]/`, `docs/handoffs/20260603-admin-user-bot-drilldown-tests-auditor.md`, `docs/handoffs/20260603-admin-user-bot-drilldown-ux-auditor.md`, and `tests/integration/admin-user-bot-detail-static.test.ts`. They were not authored by this audit and were left untouched.
- No live server, bot, provider, exchange, SSH, tmux, systemd, Docker, database mutation, migration, seed, or secret-bearing command was run.

NOT RUN:
- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`: not run because this task was a read-only audit plus one handoff file.
- Playwright/browser/dev server checks: not run because no application UI code changed.
- `npm run secret:scan`: not run; focused `secretlint` on this handoff passed.
- DB migrations/seeds/managed DB gates/worker ticks: not run by read-only scope.
- Audit append-only role proof and Legacy column-restricted DB role proof: not run; unchanged open gates.
- Live bot start/stop/apply-config/retest/exchange key test: not run by policy.

## Next actions
1. Implement the first UI-only slice as `/admin/users/[userId]/bots` or a user-row drilldown with `requireUser()` + `assertAdmin()` and a new `AdminUserBotDrilldownState` DTO.
2. Build the loader from target user ownership: `AdminUserView` + entitlements + `loadBotConfig(targetUserId, productCode)` + target-owned `bot_instances` snapshots only. Do not call product-scoped `loadBotReadModel()`.
3. Render Legacy provider-account data as masked counts/unavailable states until normalized `bot_provider_accounts` lands.
4. Decide whether the masked summary emits `admin.user_view`; add `admin.bot_account.inspect` only when full provider-account reveal is implemented with a reason field.
5. Add focused static tests for admin guard, no raw snapshot rendering, no product-scoped read model import, masked Legacy identity, no secrets, no live-control buttons, and optional audit behavior.
6. Start a separate DB/security phase for normalized provider accounts and user/pub_id-scoped reads before any full production Legacy drilldown.
