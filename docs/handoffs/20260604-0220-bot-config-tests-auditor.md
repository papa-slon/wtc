# bot-config-tests-auditor handoff
## Scope
Phase 3.89 read-only tests/acceptance audit for the planned backend/security bot config hardening follow-up from Phase 3.88. Scope covered existing Vitest, PGlite, static source, and Playwright/e2e coverage for user override invalid row fallback, forbidden field rejection, `bot.config.save` audit `before.version`, exchange key metadata audit wording, and the bot config export route.

This audit did not edit product code, run Vitest/PGlite/static/e2e gates, start preview, run worker ticks, read provider DBs, ping exchanges, inspect `.env`/vault/secret material, use SSH/tmux/systemd, or start/stop/apply/retest any live bot.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0214-phase-3-88-bot-settings-effective-review.md`
8. `docs/handoffs/20260604-0152-bot-settings-platform-security-auditor.md`
9. `docs/handoffs/20260604-0152-bot-settings-tests-visual-auditor.md`
10. `docs/AUDIT_LOG_SCHEMA.md`
11. `vitest.config.ts`
12. `apps/web/src/features/bots/config.ts`
13. `apps/web/src/features/bots/config-types.ts`
14. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
15. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
16. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
17. `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
18. `apps/web/src/app/admin/bots/config/page.tsx`
19. `apps/web/src/features/admin/actions.ts`
20. `apps/web/src/features/admin/schemas.ts`
21. `packages/audit/src/audit.ts`
22. `packages/audit/src/audit.test.ts`
23. `packages/db/src/repositories.ts`
24. `packages/shared/src/schemas.ts`
25. `tests/integration/user-resolved-bot-config-static.test.ts`
26. `tests/integration/user-resolved-bot-config-db.test.ts`
27. `tests/integration/admin-global-bot-config-static.test.ts`
28. `tests/integration/admin-global-bot-config-db.test.ts`
29. `tests/integration/bot-config-export-static.test.ts`
30. `tests/integration/bot-read-safety-static.test.ts`
31. `tests/integration/bot-readiness-builder.test.ts`
32. `tests/integration/db-0002.test.ts`
33. `tests/integration/db-persistence.test.ts`
34. `tests/integration/billing-webhook-route-handler.test.ts`
35. `tests/integration/axioma-jwks-readiness.test.ts`
36. `tests/e2e/bot-settings.spec.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Invalid active user override fallback is not acceptance-covered, and the current resolver still returns active user config without product-schema revalidation. Evidence: system defaults are parsed before inheritance at `apps/web/src/features/bots/config.ts:803` to `apps/web/src/features/bots/config.ts:807`, but active user overrides are returned directly at `apps/web/src/features/bots/config.ts:919` to `apps/web/src/features/bots/config.ts:926`; existing PGlite tests cover inheritance and override precedence at `tests/integration/user-resolved-bot-config-db.test.ts:102` to `tests/integration/user-resolved-bot-config-db.test.ts:209`, but not invalid override fallback; static coverage asserts only the system-default parse at `tests/integration/user-resolved-bot-config-static.test.ts:13` to `tests/integration/user-resolved-bot-config-static.test.ts:24`; the export route exports `state.current` at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:23`, and Tortila export can emit current scalar values at `apps/web/src/features/bots/config.ts:688` to `apps/web/src/features/bots/config.ts:695`. Recommendation: add a focused PGlite/source-model test in `tests/integration/user-resolved-bot-config-db.test.ts` or a new `tests/integration/bot-config-source-hardening.test.ts` that seeds a valid published system default, persists or inserts an invalid current user override such as `maxOpenSymbols: 999` or malformed `symbolConfigs`, resolves config through the user-facing source model, and asserts the invalid row is marked non-green and falls back to the system default or built-in config; include an export assertion that the invalid value is not emitted. Target part: user override invalid row fallback.

2. Severity: High. Forbidden-field rejection is covered for admin global defaults but not for the user override save boundary below the current form reconstruction. Evidence: settings and setup rebuild configs from allow-listed form fields and parse them at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:98` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:103` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:106` to `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:111`; admin defaults have an explicit forbidden-key set at `apps/web/src/features/admin/actions.ts:431` to `apps/web/src/features/admin/actions.ts:464` and invoke the form/config checks at `apps/web/src/features/admin/actions.ts:492` to `apps/web/src/features/admin/actions.ts:522`; static admin tests assert those keys at `tests/integration/admin-global-bot-config-static.test.ts:74` to `tests/integration/admin-global-bot-config-static.test.ts:99`; but `saveBotConfig` still accepts generic `Record<string, unknown>` at `packages/db/src/repositories.ts:2122` and writes it at `packages/db/src/repositories.ts:2127` to `packages/db/src/repositories.ts:2132`, while Legacy symbol schema permits `providerPubId` at `apps/web/src/features/bots/config.ts:69` to `apps/web/src/features/bots/config.ts:72`. Recommendation: add a table-driven focused test, preferably `tests/integration/bot-config-forbidden-fields.test.ts`, that attempts to save user configs with top-level and nested `apiKey`, `apiSecret`, `rawJson`, `providerAccounts`, `liveConfig`, `applyConfig`, `retest`, `testExchange`, and `symbolConfigs[0].providerPubId`; assert the chosen safe user save API rejects with a deterministic forbidden-field error and that no current config, version row, or `bot.config.save` audit is written. Add a static guard that settings/setup user-save paths call the same shared forbidden-key validator used by the backend save boundary. Target part: forbidden field rejection.

3. Severity: Medium. `bot.config.save` audit `before.version` is documented but not verified, and the current repository write omits it. Evidence: docs require `before = { version }, after = { version }` at `docs/AUDIT_LOG_SCHEMA.md:324` and show the sample at `docs/AUDIT_LOG_SCHEMA.md:411` to `docs/AUDIT_LOG_SCHEMA.md:424`; `saveBotConfig` reads the current row at `packages/db/src/repositories.ts:2124` but writes only `after: { version }` at `packages/db/src/repositories.ts:2132`; the existing PGlite test only checks that some `bot.config.save` event exists at `tests/integration/db-0002.test.ts:54` to `tests/integration/db-0002.test.ts:63`. Recommendation: extend `tests/integration/db-0002.test.ts` so the two-save case fetches the two `bot.config.save` audit rows and asserts first save `before.version === null` and `after.version === 1`, second save `before.version === 1` and `after.version === 2`, actor and target are correct, and neither `before` nor `after` contains raw config JSON, symbols, API keys, provider ids, or runtime payloads. Target part: audit before.version.

4. Severity: Medium. Exchange key metadata behavior has useful DB/static coverage, but audit wording and taxonomy still allow reports to sound like a live exchange connection test. Evidence: `docs/AUDIT_LOG_SCHEMA.md:177` still says `exchange_key.test` is an "Exchange connection test performed"; repository behavior is metadata-only with `checkKind: 'sealed_metadata_only'`, `livePing: false`, and safe `after` payload at `packages/db/src/repositories.ts:473` to `packages/db/src/repositories.ts:495`; PGlite coverage verifies metadata-only, cross-user missing, no sealed material, and no key/secret leakage at `tests/integration/db-persistence.test.ts:126` to `tests/integration/db-persistence.test.ts:162`; static UI/action coverage also asserts no live ping at `tests/integration/bot-read-safety-static.test.ts:311` to `tests/integration/bot-read-safety-static.test.ts:337`; the audit action registry still lists `exchange_key.test` at `packages/audit/src/audit.ts:42` to `packages/audit/src/audit.ts:44`. Recommendation: add `tests/integration/exchange-key-metadata-audit-static.test.ts` or extend `packages/audit/src/audit.test.ts` to assert the docs no longer contain "connection test performed" or "key used transiently" for this action, and that docs/code consistently say metadata-only, `sealed_metadata_only`, and `livePing: false`; if the action is renamed or aliased, assert `AUDIT_ACTIONS`, repository emission, docs, and PGlite audit rows use the chosen `exchange_key.metadata_check` or compatibility mapping consistently. Target part: exchange key metadata audit wording.

5. Severity: High. Config export route coverage is static/link-only, not runtime acceptance for 403/200 behavior or payload shape. Evidence: route behavior lives at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:8` to `apps/web/src/app/api/bots/[bot]/config-export/route.ts:31`; static coverage checks route source strings at `tests/integration/bot-config-export-static.test.ts:27` to `tests/integration/bot-config-export-static.test.ts:37` and `tests/integration/user-resolved-bot-config-static.test.ts:63` to `tests/integration/user-resolved-bot-config-static.test.ts:75`; Playwright only proves the settings link is visible at `tests/e2e/bot-settings.spec.ts:50`, not that a request returns the correct status/body; existing route-handler harness patterns exist elsewhere, for example the billing webhook extracted handler test at `tests/integration/billing-webhook-route-handler.test.ts:4` to `tests/integration/billing-webhook-route-handler.test.ts:31` and request execution at `tests/integration/billing-webhook-route-handler.test.ts:76` to `tests/integration/billing-webhook-route-handler.test.ts:97`. Recommendation: add `tests/integration/bot-config-export-route-handler.test.ts` using an extracted/injected handler or equivalent route harness; cover unauthenticated/unauthorized denial, entitled Tortila `200` with `wtc-tortila-config.env`, entitled Legacy `200` with `wtc-legacy-config.json`, Legacy provider mapping required `403`, `cache-control: no-store`, content-disposition filenames, and negative payload checks for `apiKey`, `apiSecret`, `providerPubId`, `rawJson`, `liveConfig`, `applyConfig`, and live-apply tokens. Target part: config export route.

## Decisions
1. Treated this as a per-agent read-only tests/acceptance lane, not an implementation phase.
2. No existing test was re-run; this handoff is based on source/test inspection only.
3. Accepted existing static tests as useful guardrails, but did not count them as runtime route/action acceptance.
4. Recommended focused tests are intentionally narrow and avoid live bots, provider DBs, exchange calls, `.env`, SSH, tmux, systemd, worker start/restart, and live apply/retest paths.

## Risks
1. The worktree is already heavily dirty, including many untracked prior-phase handoffs and bot settings files; this audit did not try to classify unrelated dirt beyond the inspected scope.
2. Current source guards can still pass while a future low-level caller persists unsafe user config through `saveBotConfig`.
3. Without an invalid-override resolver test, stale bad rows can remain a hidden export/readiness risk even if normal form submits validate.
4. Without a config-export runtime harness, source-string tests can miss auth, entitlement, provider-mapping, header, and payload regressions.
5. Exchange key metadata implementation is safer than its action wording; leaving the stale wording invites false "exchange connection verified" reporting.

## Verification/tests
RUN:
1. Read required session docs and Phase 3.88 aggregate handoff.
2. Read Phase 3.88 platform/security and tests/visual auditor handoffs for deferred coverage gaps.
3. Inspected relevant source, PGlite tests, static tests, route-handler test patterns, and Playwright specs with read-only `rg`/PowerShell commands.
4. Checked the requested handoff path did not already exist before writing.

NOT RUN:
1. Vitest, PGlite, static test suites, root `npm test`, focused `npx vitest`, coverage, lint, typecheck, build, secret scan, governance, or Playwright/e2e - not run because this was a read-only coverage audit.
2. Preview/dev server, browser automation, worker tick/smoke/restart, live bots, provider DB reads/writes, exchange ping, `.env`, vault/secrets, SSH, tmux, systemd, start/stop/apply/retest - forbidden by scope.
3. Git staging/commit/push/PR - not requested.

## Next actions
1. Add the invalid user override fallback resolver/export test before accepting source-of-truth hardening.
2. Add shared forbidden-field validation for user config saves and table-driven tests proving rejected payloads leave no config/version/audit writes.
3. Add `before.version` assertions to the `saveBotConfig` PGlite test.
4. Update and test exchange key metadata audit wording or action naming so metadata checks cannot be mistaken for live pings.
5. Add a runtime config-export handler test covering denial states, headers, filenames, and secret/provider/live-control negative payload assertions.
