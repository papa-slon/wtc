# exchange-key-test-tests-auditor handoff
## Scope
Phase 3.81 read-only tests audit for a safe exchange-key "Test connection" UX in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Scope was source inspection only. No product code, test code, fixtures, environment files, providers, live services, SSH, tmux, systemd, or exchange endpoints were read or touched. No tests were executed.

The audit inspected existing Vitest/static/Playwright coverage for exchange key add flows, bot setup/settings, secret scan, audit redaction, no-live-control boundaries, and admin/user bot pages. The goal was to recommend focused gates before implementing a safe connection-test UX that must not ping exchanges or reveal secrets.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260603-2209-phase-3-80-tortila-fleet-identity.md`
8. `package.json`
9. `scripts/gates.mjs`
10. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
11. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
12. `apps/web/src/features/bots/config.ts`
13. `apps/web/src/features/admin/actions.ts`
14. `apps/web/src/lib/backend.ts`
15. `apps/web/src/lib/db-store.ts`
16. `apps/web/src/lib/demo.ts`
17. `packages/shared/src/schemas.ts`
18. `packages/db/src/schema.ts`
19. `packages/db/src/repositories.ts`
20. `packages/audit/src/audit.ts`
21. `packages/audit/src/redact.ts`
22. `packages/audit/src/audit.test.ts`
23. `packages/audit/src/redact.test.ts`
24. `packages/bot-adapters/src/control.ts`
25. `packages/bot-adapters/src/factory.ts`
26. `packages/bot-adapters/src/adapters.test.ts`
27. `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts`
28. `packages/bot-adapters/src/__tests__/getHealth-states.test.ts`
29. `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts`
30. `tests/e2e/bot-settings.spec.ts`
31. `tests/e2e/admin-mobile-pg8.spec.ts`
32. `tests/e2e/cabinet-pg9-mobile.spec.ts`
33. `tests/integration/bot-read-safety-static.test.ts`
34. `tests/integration/bot-config-export-static.test.ts`
35. `tests/integration/admin-bot-health-loader.test.ts`
36. `tests/integration/admin-user-bot-detail-loader.test.ts`
37. `tests/integration/admin-user-bot-detail-static.test.ts`
38. `tests/integration/user-resolved-bot-config-static.test.ts`
39. `tests/integration/user-resolved-bot-config-db.test.ts`
40. `tests/integration/admin-global-bot-config-static.test.ts`
41. `tests/integration/admin-global-bot-config-db.test.ts`
42. `tests/integration/db-persistence.test.ts`
43. `docs/AUDIT_LOG_SCHEMA.md`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Current coverage proves the exchange-key connection-test UX is intentionally disabled/pending, but there is no implemented safe test-connection action or service contract yet. Evidence: `tests/e2e/bot-settings.spec.ts:18-24` expects "Private exchange connection", "No live exchange ping", "Test connection pending audit", and "Connection verified" count `0`; `tests/integration/bot-read-safety-static.test.ts:207-213` statically checks the same negative claim; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:387-393` renders the pending-audit button and no-live-ping copy; `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:328-336` renders pending-audit copy during setup. Recommendation: before adding an enabled button, add a pure test-connection contract with Vitest coverage that proves the implementation uses only a mocked/dev adapter, returns a typed safe result, and cannot call real provider/exchange endpoints.

2. Severity: High. Exchange-key add/storage coverage is strong for sealed storage and safe listing, but the future test action needs its own audit-write tests rather than reusing create-key evidence. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:55-73` validates CSRF, user access, and `exchangeKeyInputSchema` before calling `addExchangeKey`; `apps/web/src/lib/db-store.ts:108-124` seals key material and returns only list-safe account metadata; `packages/db/src/schema.ts:118-133` separates account metadata from sealed secret JSON; `packages/db/src/repositories.ts:384-406` writes sealed exchange keys and lists accounts without joining `exchange_api_key_secrets`; `tests/integration/db-persistence.test.ts:112-123` asserts sealed storage and redacted audit behavior. Recommendation: add PGlite/Vitest tests for `exchange_key.test` that assert the audit payload contains only account id, exchange, mode, key mask, safe status/reason, and timestamps; it must never include raw API key, API secret, sealed JSON, wrapped DEK, provider token, headers, stack traces, or exchange response bodies.

3. Severity: High. No-live-control and no-provider boundaries are well covered for bot controls, but the future exchange test path needs explicit no-network/no-provider guards because this UX is security-sensitive and user-facing. Evidence: `AGENTS.md:76-88`, `docs/SESSION_PROTOCOL.md:83-84`, and `docs/handoffs/0000-orchestrator-seed.md:117-124` forbid live mutation, plaintext exchange secrets, fake integrations, and live bot control; `packages/bot-adapters/src/control.ts:3-17` hard-disables control; `packages/bot-adapters/src/adapters.test.ts:18-30` asserts read-only health and disabled controls; `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts:111-134` asserts no fetch for health and disabled start/stop/apply; `packages/bot-adapters/src/__tests__/getHealth-states.test.ts:26-33` asserts no token means no fetch; `apps/web/src/features/admin/actions.ts:431-464` forbids `retest`, `testexchange`, live-control, and secret-shaped keys in admin global config. Recommendation: add static tests for the new action/module that reject imports or strings for `getBotAdapter`, `createHttpTortilaAdapter`, `fetch`, provider base URLs, `process.env.TORTILA_JOURNAL_URL`, `LEGACY_DATABASE_URL`, `/api_management`, `/retest`, `/api/marks`, `startBot`, `stopBot`, and `applyConfig`.

4. Severity: Medium. Admin and selected-user bot pages already have read-only/no-secret coverage; extend those tests to make sure the new UX remains user-owned and does not appear in admin surfaces. Evidence: `tests/integration/admin-user-bot-detail-static.test.ts:16-40` checks safe tables and no sealed secret table load; `tests/integration/admin-user-bot-detail-static.test.ts:84-97` checks no secret material, no submit form, and no start/stop/apply/test-connection calls; `tests/integration/admin-user-bot-detail-loader.test.ts:573-581` checks selected-user bot detail output does not expose sealed secret/API key/token fields; `tests/integration/admin-bot-health-loader.test.ts:194-259` checks health output omits secret/provider token data; `tests/e2e/admin-mobile-pg8.spec.ts:22-59` covers admin bot/user pages and screenshots. Recommendation: add negative static and Playwright assertions that admin fleet, admin selected-user bot detail, and admin global config pages do not render or submit an exchange-key test action and never display key material.

5. Severity: Medium. Existing Playwright coverage covers present copy and mobile snapshots, but it does not cover a clickable safe test result state. Evidence: `tests/e2e/bot-settings.spec.ts:13-24` checks current settings copy; `tests/e2e/cabinet-pg9-mobile.spec.ts:35-56` checks setup pages and screenshots; `tests/e2e/admin-mobile-pg8.spec.ts:43-59` checks admin pages and screenshots. Recommendation: after implementation, add a focused Playwright spec that clicks "Test connection" against seeded mock/dev data, intercepts and fails any calls to known exchange/provider/legacy retest URLs, asserts a safe non-secret status message, asserts "Connection verified" appears only for explicit mocked/dev success, and checks the page HTML, visible text, console, and screenshots do not contain plaintext keys/secrets.

6. Severity: Medium. Secret-scan and local gates exist, but the future UX should add focused gate ordering rather than relying only on the broad suite. Evidence: `package.json:17` defines `secret:scan`; `package.json:44` includes `secret:scan` inside `ci:local`; `scripts/gates.mjs:37-51` includes `secret:scan` in core/full gates; `scripts/gates.mjs:71-104` redacts child process output; `packages/audit/src/redact.test.ts:10-67` covers token, key, secret, long-hex, and nested redaction; `docs/AUDIT_LOG_SCHEMA.md:177` documents `exchange_key.test` and `docs/AUDIT_LOG_SCHEMA.md:333` forbids raw exchange API keys/secrets in audit logs. Recommendation: require focused Vitest/static/Playwright gates plus `npm run secret:scan` before accepting the connection-test UX; run broader `node scripts/gates.mjs full` only after the focused gates are green and scope permits.

## Decisions
1. Treat the actual safe "Test connection" behavior as not implemented in the current tree. Current tests only validate safe disabled/pending UX copy.
2. The first implementation target should be a mock/dev adapter or pure service contract. Real exchange pings and Legacy `/api_management/{id}/retest` calls remain out of scope.
3. The UX should be user-owned on bot setup/settings pages only. Admin fleet and selected-user admin pages should remain read-only inspection surfaces.
4. The audit event for connection tests should be metadata-only and category-based: safe status, reason code, exchange, mode, key mask/account id, actor, and timestamps. Do not include raw errors, headers, provider responses, ciphertext, key ids unless explicitly justified by the audit model, or any secret-like values.

## Risks
1. Enabling a button without a no-network service boundary could accidentally call live exchange/provider endpoints or legacy retest endpoints from a server action.
2. Failure messages are a likely leak path if raw adapter/provider exceptions, headers, or response bodies are copied into UI or audit logs.
3. Admin pages could accidentally inherit the action if shared bot cards/components are reused without role/page-specific negative tests.
4. Playwright screenshots, traces, console logs, and retained HTML can become secret artifacts if tests seed realistic key values.
5. Existing static tests search important strings, but string guards can miss dynamic imports or helper indirection unless paired with unit tests that fail on `global.fetch` or provider adapter calls.

## Verification/tests
RUN:
1. Required source/docs inspection only.
2. Static source search using `rg` for exchange-key, test-connection, setup/settings, secret, audit, live-control, admin bot, and provider/retest terms.
3. Handoff target existence check before write; target did not previously exist.

NOT RUN:
1. Vitest was not run because the task forbade test execution beyond source inspection.
2. Playwright was not run because the task forbade test execution beyond source inspection.
3. `npm run secret:scan` was not run because it is executable gate work, not source inspection.
4. Typecheck/lint/build/gates were not run because the task was read-only inspection.
5. No live/provider/env operations were run.
6. No SSH/tmux/systemd/process-control operations were run.
7. No `.env` files were read or written.

## Next actions
1. Add a focused Vitest suite for a new safe exchange-key test service/action. It should stub or spy on `global.fetch`, fail on any network attempt, use only mock/dev adapter data, validate ownership/entitlement/CSRF/Zod boundaries, and return a typed safe result.
2. Add static tests for the new implementation path that forbid provider/live-control imports and strings: `getBotAdapter`, HTTP Tortila/Legacy adapters, `fetch`, exchange hostnames, `/api_management`, `/retest`, `/api/marks`, `process.env.TORTILA_JOURNAL_URL`, `LEGACY_DATABASE_URL`, `startBot`, `stopBot`, and `applyConfig`.
3. Add PGlite/audit tests for `exchange_key.test` success and failure events. Assert redacted payloads and no raw secret, ciphertext, wrapped DEK, key material, provider token, header, stack trace, or response-body leakage.
4. Add Playwright coverage for setup/settings "Test connection" once enabled: mock/dev success, mock/dev safe failure, no plaintext in UI/HTML/screenshots/console, no admin exposure, no horizontal overflow on mobile, and route interception that fails on exchange/provider/legacy retest calls.
5. Keep admin fleet, admin selected-user bot detail, admin global config, and export/config tests as negative gates: no test-connection form/action, no secret material, and no live controls.
6. Recommended acceptance gate order after implementation: focused Vitest/static tests for the service/action, audit redaction/PGlite tests, focused Playwright spec, `npm run secret:scan`, relevant web typecheck, then broader `node scripts/gates.mjs full` only if the phase scope allows.
