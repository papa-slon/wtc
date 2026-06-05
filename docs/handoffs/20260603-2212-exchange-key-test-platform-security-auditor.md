# exchange-key-test-platform-security-auditor handoff
## Scope
Phase 3.81 read-only platform/security audit for the smallest safe user-visible "Test connection" step for exchange keys.

This is a per-agent audit handoff, not an aggregate phase handoff. No code implementation was performed. No live exchange ping, live bot start/stop/apply/retest, provider DB live read/write, worker tick/restart, SSH, tmux, systemd, or `.env` read/write was performed. The worktree was already dirty on branch `codex/bot-analytics-settings-canary-20260603`; this audit did not revert or overwrite others' changes.

The recommended next implementation is a sealed-key metadata-only check with an `exchange_key.test` audit event. It must not decrypt the vault record, must not call a real exchange, must not use existing bot adapters as a connection proof, and must not show "Connection verified". A real read-only exchange ping belongs to a future audited adapter interface.

## Files inspected
1. `AGENTS.md:42-58`, `AGENTS.md:74-88`
2. `docs/SESSION_PROTOCOL.md:18-22`, `docs/SESSION_PROTOCOL.md:24-39`, `docs/SESSION_PROTOCOL.md:52-57`, `docs/SESSION_PROTOCOL.md:81-85`
3. `docs/handoffs/0000-orchestrator-seed.md:113-125`
4. `docs/STATUS.md:1-21`, `docs/STATUS.md:1690-1693`
5. `docs/IMPLEMENTED_FILES.md:1811-1830`
6. `docs/NEXT_ACTIONS.md:13-16`, `docs/NEXT_ACTIONS.md:1201-1204`
7. `docs/handoffs/20260603-2209-phase-3-80-tortila-fleet-identity.md:1-8`, `docs/handoffs/20260603-2209-phase-3-80-tortila-fleet-identity.md:123-126`
8. `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md:5-17`, `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md:128-130`, `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md:183-202`
9. `docs/handoffs/20260603-1840-bot-settings-security-tests-auditor.md:32-49`
10. `docs/AUDIT_LOG_SCHEMA.md:142-147`, `docs/AUDIT_LOG_SCHEMA.md:172-178`, `docs/AUDIT_LOG_SCHEMA.md:331-340`
11. `docs/SECRET_VAULT_DESIGN.md:40-83`, `docs/SECRET_VAULT_DESIGN.md:190-197`
12. `docs/BOT_CONTROL_SAFETY_MODEL.md:13-24`, `docs/BOT_CONTROL_SAFETY_MODEL.md:28-44`, `docs/BOT_CONTROL_SAFETY_MODEL.md:98-145`, `docs/BOT_CONTROL_SAFETY_MODEL.md:155-180`, `docs/BOT_CONTROL_SAFETY_MODEL.md:265-271`
13. `docs/CONTRACTS/tortila-adapter.md:1-9`, `docs/CONTRACTS/tortila-adapter.md:26-45`, `docs/CONTRACTS/tortila-adapter.md:455-483`
14. `docs/CONTRACTS/legacy-bot-adapter.md:1-7`, `docs/CONTRACTS/legacy-bot-adapter.md:24-36`, `docs/CONTRACTS/legacy-bot-adapter.md:56-81`, `docs/CONTRACTS/legacy-bot-adapter.md:371-409`
15. `apps/web/src/app/(app)/app/security/page.tsx:8-21`, `apps/web/src/app/(app)/app/security/page.tsx:34-47`, `apps/web/src/app/(app)/app/security/page.tsx:50-68`
16. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:55-74`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:164-170`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:287-337`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:483-497`
17. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:77-97`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:148-153`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:220-228`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:367-397`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:441-497`
18. `apps/web/src/lib/backend.ts:20-35`, `apps/web/src/lib/backend.ts:49-64`
19. `apps/web/src/lib/db-store.ts:108-124`
20. `apps/web/src/lib/demo.ts:351-366`
21. `apps/web/src/lib/server-config.ts:4-18`
22. `packages/shared/src/schemas.ts:26-34`
23. `packages/db/src/schema.ts:118-135`, `packages/db/src/schema.ts:138-143`
24. `packages/db/src/repositories.ts:374-408`, `packages/db/src/repositories.ts:410-422`, `packages/db/src/repositories.ts:1661-1675`
25. `packages/audit/src/audit.ts:8-18`, `packages/audit/src/audit.ts:42-44`, `packages/audit/src/audit.ts:170-187`
26. `packages/audit/src/redact.ts:12-36`, `packages/audit/src/redact.ts:58-78`
27. `packages/crypto/src/vault.ts:49-61`, `packages/crypto/src/vault.ts:89-95`, `packages/crypto/src/vault.ts:109-150`, `packages/crypto/src/vault.ts:153-157`
28. `packages/bot-adapters/src/types.ts:73-92`
29. `packages/bot-adapters/src/control.ts:1-18`
30. `packages/bot-adapters/src/factory.ts:7-14`, `packages/bot-adapters/src/factory.ts:26-39`
31. `packages/bot-adapters/src/http.ts:1-10`, `packages/bot-adapters/src/http.ts:41-55`, `packages/bot-adapters/src/http.ts:57-73`, `packages/bot-adapters/src/http.ts:75-89`, `packages/bot-adapters/src/http.ts:280-286`
32. `packages/bot-adapters/src/legacy/legacy-blocked.ts:1-17`, `packages/bot-adapters/src/legacy/legacy-blocked.ts:54-100`
33. `apps/worker/src/jobs.ts:1-15`, `apps/worker/src/jobs.ts:82-99`, `apps/worker/src/jobs.ts:105-180`
34. `apps/worker/src/index.ts:48-79`, `apps/worker/src/index.ts:85-152`, `apps/worker/src/index.ts:154-223`
35. `apps/web/src/app/admin/bots/page.tsx:55-78`, `apps/web/src/app/admin/bots/page.tsx:112-130`
36. `apps/web/src/features/admin/queries.ts:347-367`
37. `apps/web/src/features/admin/user-bot-detail-loader.ts:90-104`, `apps/web/src/features/admin/user-bot-detail-loader.ts:740-757`, `apps/web/src/features/admin/user-bot-detail-loader.ts:876-904`, `apps/web/src/features/admin/user-bot-detail-loader.ts:936-944`
38. `apps/web/src/app/admin/users/[userId]/bots/page.tsx:107-112`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:229-236`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:400-417`
39. `apps/web/src/features/admin/actions.ts:431-464`, `apps/web/src/features/admin/actions.ts:492-543`
40. `tests/e2e/bot-settings.spec.ts:13-26`
41. `tests/integration/bot-read-safety-static.test.ts:165-214`
42. `tests/integration/cabinet-pg9.test.ts:85-105`
43. `tests/integration/db-persistence.test.ts:112-130`
44. `tests/integration/admin-user-bot-detail-static.test.ts:16-54`, `tests/integration/admin-user-bot-detail-static.test.ts:56-98`
45. `tests/integration/admin-global-bot-config-static.test.ts:74-105`
46. `tests/integration/user-resolved-bot-config-static.test.ts:20-30`, `tests/integration/user-resolved-bot-config-static.test.ts:77-95`
47. `tests/integration/worker-health-mapping.test.ts:45-66`

## Files changed
None - read-only audit. Only this required handoff file was written.

## Findings
1. Severity: High. The current Tortila key UX is intentionally not a connection test. Evidence: setup renders saved key cards with a disabled `Test connection pending audit` button and warning that no live exchange ping has been performed at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:327-337`; settings renders the same disabled state and explicit "No live exchange ping is claimed" copy at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:386-393`; Playwright asserts the page does not show `Connection verified` at `tests/e2e/bot-settings.spec.ts:18-24`; static tests assert the same safety copy at `tests/integration/bot-read-safety-static.test.ts:207-214`. Recommendation: the next step may enable a button only if the result is labelled as a vault/metadata check, not a real connection verification. Target part: user-facing Tortila setup/settings key cards.

2. Severity: High. The existing key save path is safe enough to reuse for ownership and display semantics, but it does not test connectivity. Evidence: bot setup action is CSRF-first, requires a user, denies Legacy/live-adapter-blocked key collection, checks entitlement, validates `exchangeKeyInputSchema`, and calls `addExchangeKey` at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:55-74`; shared validation is at `packages/shared/src/schemas.ts:26-34`; DB-backed save seals the JSON key pair before repository persistence at `apps/web/src/lib/db-store.ts:108-121`; the repository transaction writes `exchange_accounts`, `exchange_api_key_secrets`, and a redacted audit row at `packages/db/src/repositories.ts:384-400`; `listExchangeKeys` never joins the secret row at `packages/db/src/repositories.ts:404-407`. Recommendation: implement the connection-test UX as a new server action/service adjacent to this pipeline, using account ownership and existing metadata projections, not raw secrets. Target part: exchange-key actions and repository wrapper.

3. Severity: High. The smallest safe implementation should be sealed-key metadata-only plus audit, not mock/dev-only "success". Evidence: `exchange_key.test` already exists in code at `packages/audit/src/audit.ts:42-44` and docs at `docs/AUDIT_LOG_SCHEMA.md:172-178`; audit event construction redacts payloads at `packages/audit/src/audit.ts:170-187`; redaction treats `apiKey`, `secret`, `sealed`, `vaultrecord`, `credentials`, bearer tokens, and long hex blobs as sensitive at `packages/audit/src/redact.ts:12-36` and `packages/audit/src/redact.ts:58-78`; audit docs forbid raw exchange keys, AES fields, sealed blobs, and plaintext vault content at `docs/AUDIT_LOG_SCHEMA.md:331-340`. Recommendation: write `exchange_key.test` with only non-secret fields such as `checkKind: 'sealed_metadata_only'`, `livePing: false`, `outcome: 'not_run'`, `exchange`, `mode`, `keyMask`, and a generic reason. Do not write ciphertext, plaintext, headers, stack traces, provider URLs, or raw adapter responses. Target part: audit event contract.

4. Severity: High. Decrypting the vault record is not required for the first user-visible step and should remain forbidden in this phase. Evidence: vault code exposes `open()` at `packages/crypto/src/vault.ts:89-95`, but current web paths only call `seal()` for key creation at `apps/web/src/lib/db-store.ts:112` and `apps/web/src/lib/demo.ts:354`; `SECRET_VAULT_DESIGN` limits `vault.open()` to a future validated exchange connection test inside `packages/bot-adapters`, with tests proving no plaintext output/logging at `docs/SECRET_VAULT_DESIGN.md:190-197`. Recommendation: do not call `getVault().open()` for Phase 3.81 implementation. A metadata check can query only the owned `exchange_accounts` row and, if needed, a count/keyId-only projection from `exchange_api_key_secrets` without selecting `sealed`. Target part: vault/DB boundary.

5. Severity: High. Existing bot adapters are not a safe exchange-key test path. Evidence: adapter interface control methods remain disabled at `packages/bot-adapters/src/types.ts:89-92`; control assertion always throws unless both feature flag and audit approval are true at `packages/bot-adapters/src/control.ts:16-18`; Tortila HTTP adapter is journal GET-only and explicitly forbids live exchange calls/control at `packages/bot-adapters/src/http.ts:1-10` and `packages/bot-adapters/src/http.ts:75-89`; `/api/marks` is excluded and start/stop/apply are hard-disabled in the Tortila contract at `docs/CONTRACTS/tortila-adapter.md:455-461`; Legacy non-mock mode routes to a blocked adapter with no network path at `packages/bot-adapters/src/factory.ts:32-39` and `packages/bot-adapters/src/legacy/legacy-blocked.ts:1-17`. Recommendation: do not route "Test connection" through `getBotAdapter`, worker snapshot jobs, Legacy HTTP, Tortila journal, or any live bot endpoint. Target part: adapter safety policy.

6. Severity: Medium. Admin surfaces should remain metadata-only and should not gain a test button. Evidence: `/admin/bots` says no exchange keys, URLs, stack traces, or live-control buttons are rendered at `apps/web/src/app/admin/bots/page.tsx:62-78`; selected-user admin detail maps only exchange account label/exchange/mode/keyMask at `apps/web/src/features/admin/user-bot-detail-loader.ts:90-104` and selects only `exchange_accounts` metadata at `apps/web/src/features/admin/user-bot-detail-loader.ts:740-757`; the admin user page tells operators "Secret material is not loaded" at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:229-236`; static coverage rejects "test connection" on that admin page at `tests/integration/admin-user-bot-detail-static.test.ts:56-98`. Recommendation: put the first UX only on user-owned Tortila setup/settings key cards, not admin fleet or selected-user drilldowns. Target part: admin/user separation.

7. Severity: Medium. Config/default/source paths already treat `testExchange` as forbidden, so the implementation must not persist connection-test intent in bot config JSON. Evidence: admin global defaults forbid `testexchange`, `retest`, `start`, `stop`, `applyconfig`, secret, sealed, provider, raw runtime, and URL-like keys at `apps/web/src/features/admin/actions.ts:431-464`; static tests assert `testexchange` is forbidden at `tests/integration/admin-global-bot-config-static.test.ts:74-99`; user resolved config tests assert source chooser surfaces do not import adapter/control/env paths or include `testExchange` at `tests/integration/user-resolved-bot-config-static.test.ts:77-95`. Recommendation: do not add `testExchange`, connection results, provider responses, or live-status fields to `bot_configs`, `bot_global_configs`, exports, or config resolver state. Target part: config persistence and export safety.

8. Severity: Medium. Current tests prove "no live ping claimed" but do not yet prove the proposed metadata-only action. Evidence: `tests/e2e/bot-settings.spec.ts:18-24` asserts no green connection status; `tests/integration/db-persistence.test.ts:112-130` proves sealed storage and audit redaction for create, not test; `tests/integration/cabinet-pg9.test.ts:85-105` covers CSRF-first setup actions and password inputs; `tests/integration/worker-health-mapping.test.ts:45-66` covers disabled safety flags, not key testing. Recommendation: add focused PGlite and static tests before enabling the button, and only then a narrow Playwright copy assertion. Target part: tests.

## Decisions
1. Recommended first implementation: sealed-key metadata-only check plus `exchange_key.test` audit event.
2. Not recommended: mock/dev-only green "connected" status. Demo/in-memory mode may support the same metadata-only action, but it must still render as "Vault check only" or equivalent, never "Connection verified".
3. Not recommended in this phase: decrypting/opening the vault record, even transiently.
4. Not recommended in this phase: a live read-only exchange ping. That belongs to a later adapter contract after security and bot-integration approval.
5. Not recommended in this phase: using existing Tortila/Legacy bot adapters, worker ticks, `/api/marks`, Legacy `/api_management/*`, `/retest`, provider DB reads, or live bot runtime state as the connection-test source.
6. No schema migration is needed for the smallest step. Use an audit row and a transient redirect/search-param result first. A persistent state machine (`not_tested`, `vault_present`, `live_ping_unavailable`, `verified`, `failed`) should wait until a real adapter contract exists.
7. The button may be visibly labelled "Test connection" only if the immediate result text says the actual operation: "Vault record found; live exchange ping not run." Avoid green success language tied to real connectivity.

## Risks
1. User trust risk: a button named "Test connection" can be misread as a live exchange ping. Mitigation: result copy must explicitly say no exchange network call was made and no connection is verified.
2. Secret-exposure risk: selecting or returning `exchange_api_key_secrets.sealed`, calling `vault.open()`, logging thrown errors, or echoing submitted form values can leak sensitive material. Mitigation: metadata-only query, no `sealed` projection, existing redaction, and tests that search outputs for `apiKey`, `apiSecret`, `wrappedDek`, `payload`, `sealed`, headers, and stack traces.
3. Authorization risk: a user could submit another user's `exchangeAccountId`. Mitigation: repository/action must check `exchange_accounts.user_id = actor.id` and return the same generic failure for missing and unauthorized rows.
4. Entitlement risk: enabling the button from `/app/bots/tortila` without `botAccessForUser` would bypass fail-closed access. Mitigation: only render/execute from bot pages after the same entitlement check used by setup/settings.
5. Audit semantics risk: writing `exchange_key.test` with `result: 'success'` could imply connectivity. Mitigation: the audit `after` payload must include `checkKind: 'sealed_metadata_only'`, `livePing: false`, and `outcome: 'not_run'`; UI wording must not use "verified".
6. Scope creep risk: implementing a future adapter now could accidentally touch exchanges, bot runtimes, provider DBs, worker ticks, or `.env`. Mitigation: explicitly forbid all live/provider/runtime operations in tests and code review for this slice.

## Verification/tests
RUN:
1. Required protocol/status reads: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260603-2209-phase-3-80-tortila-fleet-identity.md`.
2. Static source inspection of exchange-key forms/actions, setup/settings pages, vault/DB/audit APIs, bot adapters/control policy, admin metadata pages, worker safety code, and relevant tests.
3. `git status --short --branch` observed a dirty worktree before this audit. No pre-existing files were reverted or overwritten.

NOT RUN:
1. Vitest, Playwright, build, lint, typecheck, secret scan, governance, or gate runners - skipped because this task is a read-only audit and the only allowed write is this handoff.
2. WTC DB read/write, managed DB harness, migrations, seeds, or provider DB live read/write - forbidden/out of scope.
3. Live exchange ping/test, live bot start/stop/apply/retest, worker tick/restart, SSH, tmux, systemd, `.env` reads/writes, provider URL probes, or live service checks - forbidden and not performed.

## Next actions
1. Add a small backend API in the existing layers:
   - `packages/db/src/repositories.ts`: add `recordExchangeKeyMetadataCheck(db, { userId, exchangeAccountId, now })`.
   - It should transactionally select the owned `exchange_accounts` row, optionally confirm a secret row exists without selecting `sealed`, write `exchange_key.test`, and return only `{ exchange, mode, keyMask, outcome: 'vault_present' | 'missing', livePing: false }`.
   - It must return a generic missing/unauthorized outcome and must not expose whether another user's key exists.
2. Add wrappers in `apps/web/src/lib/db-store.ts`, `apps/web/src/lib/demo.ts`, and `apps/web/src/lib/backend.ts` with the same fail-closed production behavior as existing core exchange-key functions.
3. Add user server actions only on Tortila setup/settings key cards:
   - CSRF first.
   - `requireUser`.
   - `botMeta` + `botAccessForUser` for `tortila_bot`.
   - Zod schema for `{ bot, exchangeAccountId }`.
   - Call the metadata-check wrapper.
   - Redirect/revalidate with copy such as "Vault record found; live exchange ping not run."
4. Keep `/app/security` display-only for the first slice, or add the same metadata check there only after deciding the entitlement rule for generic key management.
5. Add tests:
   - PGlite test for owned key metadata check, unauthorized/missing generic failure, no `sealed`/payload/plaintext in return, and redacted `exchange_key.test` audit payload.
   - Static tests banning `getBotAdapter`, `fetch`, `vault.open`, `startBot`, `stopBot`, `applyConfig`, `retest`, provider DB env names, `apiKey`, `apiSecret`, `sealed`, and "Connection verified" from the new action/UI.
   - Playwright smoke asserting the button/result says no live ping was run.
6. Defer the real exchange ping to a separate future adapter contract:
   - Define a dedicated read-only exchange-key test interface.
   - Permit `vault.open()` only inside that adapter boundary.
   - Require no plaintext in returns/logs/audit/screenshots.
   - Require exchange permission checks, timeout/error normalization, rate limits, CSRF/RBAC/entitlement gates, and security plus bot-integration sign-off before enabling it.
