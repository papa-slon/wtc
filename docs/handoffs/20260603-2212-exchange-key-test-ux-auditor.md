# exchange-key-test-ux-auditor handoff
## Scope
Phase 3.81 read-only UX/product audit for safe exchange-key connection-test UX in the WTC ecosystem platform.

The audit inspected current user bot setup/settings pages, Tortila exchange-key UI, cabinet setup signals, selected-user/admin bot pages, live-control/test-connection copy, and premium terminal UI conventions. The goal was to answer the user question: "I entered my exchange keys; what does Test mean now?" without falsely claiming live exchange validation.

No product-code edits, live/provider/env operations, SSH, tmux, systemd, worker tick/restart, provider DB reads/writes, exchange pings, `.env` reads/writes, or database mutations were performed. This is exactly one read-only auditor handoff and does not claim an N-agent audit.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260603-2209-phase-3-80-tortila-fleet-identity.md`
8. `docs/handoffs/20260603-2158-tortila-fleet-identity-ux-security-auditor.md`
9. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
10. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
11. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
12. `apps/web/src/features/cabinet/loader.ts`
13. `apps/web/src/app/admin/bots/page.tsx`
14. `apps/web/src/features/admin/bot-health-loader.ts`
15. `apps/web/src/features/admin/types.ts`
16. `apps/web/src/features/admin/user-bot-detail-loader.ts`
17. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
18. `apps/web/src/lib/db-store.ts`
19. `apps/web/src/lib/demo.ts`
20. `packages/shared/src/schemas.ts`
21. `packages/db/src/schema.ts`
22. `packages/db/src/repositories.ts`
23. `packages/ui/src/theme.css`
24. `packages/ui/src/components.tsx`
25. `docs/AUDIT_LOG_SCHEMA.md`
26. `docs/RBAC_MATRIX.md`
27. `docs/DOMAIN_MODEL.md`
28. `docs/ARCHITECTURE.md`
29. `docs/INTEGRATION_MAP.md`
30. `docs/BOT_CONTROL_SAFETY_MODEL.md`
31. `tests/integration/bot-read-safety-static.test.ts`
32. `tests/integration/admin-user-bot-detail-static.test.ts`
33. `tests/integration/admin-user-bot-detail-loader.test.ts`
34. `tests/e2e/bot-settings.spec.ts`
35. `tests/integration/cabinet-pg9.test.ts`

## Files changed
None - read-only audit.

## Findings
1. Severity: High. The current "Test connection pending audit" label is safe but still leaves the product question unanswered: users see a test affordance but cannot tell what, if anything, has been validated today. Evidence: setup shows saved key cards with `Vault: sealed + audited` and a disabled `Test connection pending audit` button at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:319` to `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:337`; settings repeats the same disabled button and says no live exchange ping is claimed at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:367` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:394`; static tests intentionally require this no-ping truth at `tests/integration/bot-read-safety-static.test.ts:207` to `tests/integration/bot-read-safety-static.test.ts:214`. Recommendation: split the UI into two explicit concepts: `Saved key metadata` for the current WTC-side validation, and `Read-only exchange ping` for the future audited adapter. Target part: Tortila setup/settings private exchange connection cards.

2. Severity: High. Current save behavior validates input shape and stores sealed key material, but it does not validate the exchange account, permissions, IP allowlist, balance access, or provider reachability. Evidence: `exchangeKeyInputSchema` validates exchange, label, API key length, secret length, and mode only at `packages/shared/src/schemas.ts:26` to `packages/shared/src/schemas.ts:33`; `db-store.addExchangeKey` seals key+secret and passes only a key mask to the repository at `apps/web/src/lib/db-store.ts:108` to `apps/web/src/lib/db-store.ts:121`; the DB repository inserts account and sealed-secret rows transactionally, audits metadata only, and `listExchangeKeys` never joins `exchange_api_key_secrets` at `packages/db/src/repositories.ts:384` to `packages/db/src/repositories.ts:407`; RBAC docs explicitly call key creation "key format validation only - no live exchange test" at `docs/RBAC_MATRIX.md:145` to `docs/RBAC_MATRIX.md:155`. Recommendation: label the current passed state as `Metadata check passed` or `Saved in WTC vault`, with subcopy: "No exchange network call was made." Target part: key save result, setup review row, settings exchange card, cabinet setup signal.

3. Severity: High. The future test action is already a known target, but it must be a separate audited read-only exchange ping, not a live-control shortcut. Evidence: `exchange_key.test` exists as an audit action for a transient key use at `docs/AUDIT_LOG_SCHEMA.md:172` to `docs/AUDIT_LOG_SCHEMA.md:177`; older domain target flow says "Test connection via adapter" and "read-only ping" at `docs/DOMAIN_MODEL.md:687` to `docs/DOMAIN_MODEL.md:705`; bot controls remain disabled until safety gates pass at `docs/BOT_CONTROL_SAFETY_MODEL.md:13` to `docs/BOT_CONTROL_SAFETY_MODEL.md:23`; architecture/integration docs keep `startBot`, `stopBot`, and `applyConfig` hard-disabled and separate from read-only adapter promotion at `docs/ARCHITECTURE.md:145` to `docs/ARCHITECTURE.md:147`, `docs/ARCHITECTURE.md:570` to `docs/ARCHITECTURE.md:578`, and `docs/INTEGRATION_MAP.md:97` to `docs/INTEGRATION_MAP.md:101`. Recommendation: future CTA should be `Run read-only exchange ping`, not generic `Test`, and should require a new security + bot-integration audit, CSRF/RBAC/entitlement gates, rate limiting, safe error taxonomy, and in-txn `exchange_key.test` audit. Target part: future key-test package/API/server action and audit contract.

4. Severity: Medium. The cabinet currently treats Tortila setup as two checklist items, "Add an exchange API key" and "Choose or save a strategy configuration"; it does not show that the saved key is metadata-only and not exchange-tested. Evidence: cabinet signal gathering lists the Tortila setup items at `apps/web/src/features/cabinet/loader.ts:79` to `apps/web/src/features/cabinet/loader.ts:101`. Recommendation: when a Tortila key exists, the cabinet card should use an activity/setup label like `Exchange metadata saved - live ping not available yet`; when no key exists, keep `Add exchange API key`. Target part: `gatherSignals` and `@wtc/cabinet` view copy in a future implementation phase.

5. Severity: Medium. Admin selected-user pages correctly show safe exchange-key metadata and no test action, but they should eventually mirror the same "metadata vs live ping" status so support/admin cannot overstate validation. Evidence: selected-user copy says the page is read-only and includes safe exchange-key metadata at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:68` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:83`; it renders `Exchange key metadata` with label, exchange, and mask only at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:229` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:243`; saved keys table shows label/exchange/mode/mask only at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:400` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:421`; the loader selects `schema.exchangeAccounts` safe fields and does not select sealed secrets at `apps/web/src/features/admin/user-bot-detail-loader.ts:748` to `apps/web/src/features/admin/user-bot-detail-loader.ts:757`; static tests assert no `exchangeApiKeySecrets` join and no `test connection` text at `tests/integration/admin-user-bot-detail-static.test.ts:16` to `tests/integration/admin-user-bot-detail-static.test.ts:40` and `tests/integration/admin-user-bot-detail-static.test.ts:56` to `tests/integration/admin-user-bot-detail-static.test.ts:98`. Recommendation: future admin view should add read-only status fields such as `metadata: passed`, `live ping: not run`, `last ping: stale/failed/verified`, and never expose an admin-side ping button in this page. Target part: admin user bot detail DTO/page.

6. Severity: Medium. Existing live-control copy is strong and should not be mixed with key-test language. Evidence: user bot dashboard shows `Live actions: Unavailable`, disabled Start/Stop buttons, and read-only monitoring copy at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:245` to `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:272`; admin fleet copy states live control is permanently disabled and no start/stop/applyConfig buttons exist at `apps/web/src/app/admin/bots/page.tsx:72` to `apps/web/src/app/admin/bots/page.tsx:90` and `apps/web/src/app/admin/bots/page.tsx:112` to `apps/web/src/app/admin/bots/page.tsx:140`. Recommendation: keep exchange ping in a credential-readiness lane; never position it as bot readiness, start readiness, stop readiness, or config-apply readiness. Target part: bot dashboard, setup review, settings page, admin pages.

7. Severity: Medium. There is no durable connection-test result model exposed in current safe DTOs, so any future UI claiming "tested" needs a modeled source of truth before shipping. Evidence: `exchange_accounts` stores exchange, label, mode, key mask, and createdAt; `exchange_api_key_secrets` stores only sealed payload/key id at `packages/db/src/schema.ts:117` to `packages/db/src/schema.ts:135`; admin exchange-key DTOs expose only id/exchange/label/mode/keyMask at `apps/web/src/features/admin/types.ts:31` to `apps/web/src/features/admin/types.ts:37`; `AdminUserBotSummary.exchangeAccount` has no test result field at `apps/web/src/features/admin/types.ts:135` to `apps/web/src/features/admin/types.ts:155`. Recommendation: future live-ping work should add a safe test-result model before UI claims success, for example status, checkedAt, adapterMode, resultKind, safeReasonCode, keyMask, exchange, mode, auditId, and expiry/stale window; no raw provider response, headers, account IDs, ciphertext, or stack traces. Target part: DB/domain contract plus user/admin DTOs.

8. Severity: Info. The existing premium terminal UI system supports the right UX if it stays compact and state-driven. Evidence: terminal tokens use dark panel, gold/cyan accents, and constrained radii at `packages/ui/src/theme.css:3` to `packages/ui/src/theme.css:22`; status pills, warnings, tables, mobile table wrappers, wizard steps, and key/value rows are already standardized at `packages/ui/src/theme.css:77` to `packages/ui/src/theme.css:100`, `packages/ui/src/theme.css:105` to `packages/ui/src/theme.css:178`, and `packages/ui/src/theme.css:185` to `packages/ui/src/theme.css:202`; reusable `Card`, `StatusPill`, `MetricCard`, `RiskWarningBanner`, and `EmptyState` exist at `packages/ui/src/components.tsx:9` to `packages/ui/src/components.tsx:69`. Recommendation: present key-test UX as dense operational cards/pills, not a modal-heavy explainer or marketing copy. Target part: setup/settings/cabinet/admin visual treatment.

## Decisions
1. "Test" must not remain a single ambiguous concept. Product language should reserve `Run read-only exchange ping` for the future audited provider call.
2. Current mock/dev validation should be named `metadata validation`, `saved key metadata`, or `saved in WTC vault`, not `connection verified`.
3. Current user-facing states should be:
   - `No key saved`: action `Add exchange key`; copy `No exchange credential is stored for this bot yet.`
   - `Metadata check failed`: action `Review key fields`; copy `WTC could not save the key metadata. No key was stored.`
   - `Saved in WTC vault`: action `Continue setup` or `Edit settings`; copy `WTC validated the form shape and stored encrypted key material. No exchange network call was made.`
   - `Demo storage only`: action `Use Postgres-backed setup`; copy `This preview is in-memory and not persistent.`
   - `Live exchange ping unavailable`: disabled action `Run read-only exchange ping (future)`; copy `Requires audited read-only exchange adapter and security approval.`
4. Current key cards should show two rows:
   - `WTC metadata: passed` or `WTC metadata: saved`
   - `Exchange ping: not run / unavailable`
5. Future audited live-ping states should be:
   - `Not eligible - audit required`
   - `Ready for read-only ping`
   - `Checking exchange reachability`
   - `Read-only ping verified`
   - `Reached exchange - permissions limited`
   - `Ping failed`
   - `Result stale - retest required`
6. Future audited live-ping result details should include only safe facts: exchange, mode, key mask, checkedAt, adapterMode, read-only scope checked, safe reason code, and audit id. It must not include plaintext key/secret, sealed payload, raw headers, provider response body, bearer token, account secrets, stack trace, or screenshots containing sensitive data.
7. Legacy copy remains separate: WTC does not collect new exchange keys for Legacy; Legacy uses existing provider `pub_id` snapshots and no WTC key-test CTA.
8. Admin pages remain read-only mirrors: they may show metadata/test status, but no selected-user admin page should run a live ping, edit keys, or apply bot config.

## Risks
1. If the button continues to say only `Test connection pending audit`, users may treat a saved key as "almost tested" or wait for a missing action without understanding that only local metadata/vault storage happened.
2. If future copy says `verified` without the qualifier `read-only exchange ping`, users may infer trade permissions, order placement, start/stop readiness, or config-apply readiness. Those are different safety gates.
3. A future live-ping path will transiently decrypt key material. Without a dedicated model, redaction tests, rate limits, and append-only audit, it could leak secrets through audit payloads, errors, logs, screenshots, or admin diagnostics.
4. The `mode: live` pill on saved keys can be misread as live validation. It should be framed as the user's selected credential mode, not proof that WTC reached the live exchange.
5. Demo/in-memory preview can make metadata checks look persistent when they are not. Demo mode needs a visible `not persisted` state beside any saved-key UX.

## Verification/tests
RUN:
1. Required governance/source reads: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260603-2209-phase-3-80-tortila-fleet-identity.md`.
2. Read-only source inspection of user bot setup/settings/dashboard pages, cabinet loader, admin fleet page, selected-user admin loader/page, exchange-key storage paths, UI primitives/theme, static/e2e guards, audit/RBAC/domain/integration/control docs.
3. Static searches with `rg` for `exchange`, `Test connection`, `live ping`, `testExchange`, `exchange_key.test`, `startBot`, `stopBot`, `applyConfig`, `secret`, `sealed`, and related copy.
4. Verified by inspection that the requested handoff path did not already exist before writing this file.

NOT RUN:
1. Vitest, Playwright, typecheck, lint, build, governance, secret scan, and gate runners were not run because this was a read-only UX/product audit with no product-code edits.
2. No live Legacy/Tortila continuity check, worker tick/restart, exchange ping/test, provider DB live read/write, SSH, tmux, systemd, `.env` read/write, start/stop/retest/apply-config, or live control was run.
3. No database mutation, migration, seed, provider operation, or environment inspection was run.

## Next actions
1. Implement the copy split on Tortila setup/settings:
   - replace ambiguous primary label `Test connection pending audit` with `Exchange ping unavailable`
   - add `WTC metadata: saved` and `Exchange ping: not run` rows
   - keep a disabled `Run read-only exchange ping (future)` action until audited.
2. Update cabinet setup signals so a saved Tortila key reads as `Exchange metadata saved - live ping not available yet`, not simply a completed exchange connection.
3. Add static tests that require the new labels and forbid `Connection verified` unless a modeled, audited live-ping result exists.
4. Design the future live-ping model/contract in a separate phase before implementation: safe result fields, audit payload, stale window, failure taxonomy, rate limit, CSRF/RBAC/entitlement, no raw provider output, and no bot-control coupling.
5. Keep selected-user/admin pages read-only: show metadata/test status only after a safe DTO exists; do not add admin-side test, edit, apply, start, or stop actions.
