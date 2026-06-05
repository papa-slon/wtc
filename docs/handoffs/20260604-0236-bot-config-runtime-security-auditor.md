# bot-config-runtime-security-auditor handoff
## Scope
Read-only Phase 3.90 security/acceptance audit of current Legacy/Tortila bot config export, save, readiness, audit, and runtime response boundaries.

Focus: whether route/action/runtime responses can leak `apiKey`, `apiSecret`, `providerPubId`, `providerAccountId`, `rawJson`, `liveConfig`, `applyConfig`, `startBot`, `stopBot`, `retest`, exchange URLs, or request/response headers, and whether current audit/docs/test coverage proves no live bot mutation.

No product code, tests, docs, live bots/workers, provider DB, exchange ping, `.env`, vault, SSH, tmux, systemd, or live server path was touched.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0235-phase-3-89-bot-config-source-audit-hardening.md`
8. `docs/AUDIT_LOG_SCHEMA.md`
9. `packages/audit/src/audit.ts`
10. `packages/audit/src/redact.ts`
11. `packages/bot-adapters/src/types.ts`
12. `packages/db/src/repositories.ts`
13. `apps/web/src/features/bots/config.ts`
14. `apps/web/src/features/bots/data.tsx`
15. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
16. `apps/web/src/features/bots/statistics-panels.tsx`
17. `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
18. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
19. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
20. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
21. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
22. `apps/web/src/features/admin/actions.ts`
23. `apps/worker/src/legacy-live.ts`
24. `tests/integration/bot-config-export-static.test.ts`
25. `tests/integration/bot-config-source-audit-static.test.ts`
26. `tests/integration/bot-read-safety-static.test.ts`
27. `tests/integration/bot-readiness-server-dto-static.test.ts`
28. `tests/integration/bot-config-review-static.test.ts`
29. `tests/integration/bot-statistics-static.test.ts`
30. `tests/integration/admin-global-bot-config-static.test.ts`
31. `tests/integration/admin-global-bot-config-db.test.ts`
32. `tests/integration/db-0002.test.ts`
33. `tests/integration/db-persistence.test.ts`
34. `tests/integration/legacy-live-worker-static.test.ts`
35. `tests/integration/legacy-provider-worker.test.ts`

## Files changed
None - read-only audit. This handoff file is the only file written.

## Findings
1. Severity: High. Runtime DB snapshot config responses still carry a raw `liveConfig` object through `BotConfigView.raw`, so the web response boundary depends on every upstream writer keeping that blob safe instead of re-sanitizing at read time. Evidence: `apps/web/src/features/bots/data.tsx:493` selects `botMetricSnapshots.rawJson`; `apps/web/src/features/bots/data.tsx:628` reads `rawMetric.liveConfig`; `apps/web/src/features/bots/data.tsx:635` builds `configView`; `apps/web/src/features/bots/data.tsx:643` assigns `raw: liveConfig`; the type contract says raw is already redacted at `packages/bot-adapters/src/types.ts:64`. Current Legacy worker construction is whitelisted and has fixture coverage (`apps/worker/src/legacy-live.ts:192`, `apps/worker/src/legacy-live.ts:235`, `tests/integration/legacy-live-worker-static.test.ts:175`, `tests/integration/legacy-provider-worker.test.ts:204`), but the web loader does not defensively strip hostile `apiKey`/`apiSecret`/`providerAccountId`/`headers`/URLs/control fields if a DB row is polluted. Recommendation: replace `raw: liveConfig` with an explicit web-safe Legacy runtime config DTO or run the same forbidden-key sanitizer before returning `read.config.data`; add a runtime DB fixture with hostile nested fields and assert the returned read model plus rendered pages omit them. Target part: `loadBotReadModelForUser` DB snapshot config boundary.
2. Severity: Medium. Config export route behavior is only statically asserted, not route-handler tested with hostile state and response-body negative assertions. Evidence: the route gates session/entitlement and provider mapping at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:12`, `apps/web/src/app/api/bots/[bot]/config-export/route.ts:14`, and `apps/web/src/app/api/bots/[bot]/config-export/route.ts:20`, then returns export headers/body at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:23`; the export allowlist strips Legacy `providerPubId` at `apps/web/src/features/bots/config.ts:654` and `apps/web/src/features/bots/config.ts:658`; current coverage is source-string only at `tests/integration/bot-config-export-static.test.ts:14` and `tests/integration/bot-config-export-static.test.ts:27`. Recommendation: add route-handler tests for unauthenticated/denied/provider-mapping-required/success paths, including exact body/header assertions listed under Next actions. Target part: config-export route acceptance.
3. Severity: Medium. Server-action save paths have strong lower-level guards, but runtime action behavior for malicious hidden fields is not proven. Evidence: settings save parses known form fields and calls `persistBotConfig` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:89` and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:103`; setup save does the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:97` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:111`; `persistBotConfig` validates through `safeUserBotConfigForProduct` before DB persistence at `apps/web/src/features/bots/config.ts:1033`; the repository rejects forbidden config keys at `packages/db/src/repositories.ts:2176`; DB/static coverage exists at `tests/integration/db-0002.test.ts:69` and `tests/integration/bot-config-source-audit-static.test.ts:42`. Recommendation: add actual action-level tests with malicious `FormData` extras and assert either explicit rejection or safe ignored-field behavior plus unchanged history/audit rows. Target part: settings/setup server actions.
4. Severity: Medium. Exchange-key readiness appears metadata-only and no live exchange ping/control path was found in the inspected implementation, but coverage is mostly static plus DB repository tests rather than runtime page/action proof. Evidence: repository readiness selects account id plus secret-row id only at `packages/db/src/repositories.ts:455` and `packages/db/src/repositories.ts:467`, writes `exchange_key.metadata_check` with `livePing:false` at `packages/db/src/repositories.ts:487` and `packages/db/src/repositories.ts:491`, and the UI keeps the exchange ping button disabled at `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:122` and `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:127`. DB/static tests cover metadata-only behavior at `tests/integration/db-persistence.test.ts:126` and `tests/integration/bot-read-safety-static.test.ts:311`. Recommendation: add action/page runtime tests proving no `fetch`, adapter call, vault open, or exchange URL/header appears during metadata readiness, and that audit rows contain only metadata fields. Target part: exchange-key readiness acceptance.
5. Severity: Low. Audit docs contain stale redaction wording that can confuse acceptance. Evidence: `docs/AUDIT_LOG_SCHEMA.md:292` says blocklist additions are still TARGET/not yet in `redact.ts`, while `packages/audit/src/redact.ts:26` through `packages/audit/src/redact.ts:35` already include ciphertext/vault/sealed/credentials/bearer/refresh/id/access/one-time-code hints. Recommendation: in a later docs-only cleanup, update the audit doc wording from TARGET to implemented status, while keeping `iv`/`tag` caveat aligned with `redact.ts`. Target part: audit documentation truth.

## Decisions
1. This auditor did not run tests because the lane is read-only and the instruction allows exactly one written file; test runners can create temp/cache artifacts.
2. Masked Legacy pub_id display was treated as an intentional current UI behavior, not as a finding by itself. The required acceptance gap is proving only masked/derived fields render and hostile sibling fields never render.
3. No claim is made that runtime export/action/page gates are green; current evidence is code inspection plus previously existing static/DB tests.
4. No extra background agents were launched by this auditor; none are left running from this lane.

## Risks
1. A polluted `bot_metric_snapshots.raw_json.liveConfig` row could become visible through future callers because `config.raw` is still a generic object.
2. Static tests can pass while a route handler, Server Component/RSC payload, or server action serializes a forbidden field at runtime.
3. Current runtime pages intentionally use Legacy worker snapshot evidence; without response-body tests, provider identity masking and secret omission remain policy assumptions rather than observed acceptance.
4. Full no-live-mutation proof was not run in this lane; live bots/workers/provider DB/exchange paths were intentionally not touched.

## Verification/tests
RUN:
1. Required protocol/docs read.
2. Static source inspection of export route, config builder, settings/setup actions, runtime read model, readiness UI, audit docs, audit redactor, DB repositories, worker Legacy live-config builder, and focused tests.
3. Confirmed no product code/test/doc edit was made by this auditor.

NOT RUN:
1. Live bot start/stop/apply-config/retest, worker tick/restart/smoke, provider DB reads/writes, exchange ping, `.env`, vault/secret inspection, SSH, tmux, systemd - forbidden by scope.
2. Vitest, Playwright, build, lint, typecheck, governance, secret scan - skipped because this was a read-only audit and only one handoff write was allowed.
3. Runtime route-handler/server-action/page response tests - not present in current proof and recommended below.

## Next actions
1. Add config-export route-handler tests with exact negative assertions:
   - Denied access returns `403` and `{ error: 'access_required' }`; body and headers do not match `/apiKey|apiSecret|providerPubId|providerAccountId|rawJson|liveConfig|applyConfig|startBot|stopBot|retest|legacyDatabaseUrl|tortilaJournalUrl|headers|authorization|cookie|https?:\/\//i`.
   - Legacy provider mapping required returns `403` and `{ error: 'provider_mapping_required' }`; response body does not include provider IDs, runtime snapshot fields, URLs, headers, or live-control names.
   - Successful Legacy export with hostile mocked `state.current` and hostile mocked `legacyRead.config.data.raw` contains `wtc-legacy-config.json`, `cache-control: no-store`, `native.settings`, and `native.stage_config`, but does not contain the forbidden regex above; also assert no `providerPubId` key survives in `native.settings`.
   - Successful Tortila export with hostile mocked `state.current` contains only expected env keys and does not contain the forbidden regex above.
2. Add DB snapshot runtime tests for `loadBotReadModelForUser`:
   - Insert `bot_metric_snapshots.raw_json.liveConfig` containing valid Legacy rows plus nested `apiKey`, `apiSecret`, `providerAccountId`, `rawJson`, `headers`, `exchangeUrl`, `applyConfig`, `startBot`, `stopBot`, and `retest` marker values.
   - Assert `JSON.stringify(read.config.data)` and rendered dashboard/statistics/settings output do not contain those markers.
   - If masked pub_id display remains allowed, assert the full provider pub_id is absent and only the masked form is present.
3. Add settings/setup action tests:
   - Submit valid config plus hidden forbidden fields (`apiKey`, `apiSecret`, `providerAccountId`, `rawJson`, `liveConfig`, `headers`, `applyConfig`, `startBot`, `stopBot`, `retest`) to `saveBotConfigAction` and `wizardSaveConfig`.
   - Assert the action rejects with a non-secret error or safely ignores extras, and assert no forbidden key/value appears in `bot_configs`, `bot_config_versions`, `audit_logs`, redirects, or error text.
4. Add exchange-key readiness action/page tests:
   - Submit valid and invalid `exchangeAccountId` values.
   - Assert audit action is `exchange_key.metadata_check`, `after.livePing === false`, no `exchange_key.test` row is written, no adapter/fetch/vault-open mock is called, and no URL/header/provider response body appears in returned UI or audit JSON.
