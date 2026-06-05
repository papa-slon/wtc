# bot-settings-export-security-auditor handoff
## Scope
Phase 4.19 read-only security/export audit for Tortila and Legacy bot settings export plus generated runtime/config preview boundaries.

Inspected whether config exports and preview/runtime boundaries can expose exchange keys, sealed secrets, raw provider payloads, live bot control fields, `apiKey`/`apiSecret`, DB URLs, or admin-only user data. Also inspected whether the export route is entitlement gated and read-only, and reviewed existing static/browser coverage plus exact missing assertions.

This was treated as one foreground read-only security-auditor lane. No N-agent claim is made, no background agents were launched, and no background agents remain open.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260604-1423-phase-4-18-bot-key-readiness-browser.md`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/bots/config-export-handler.ts`
- `apps/web/src/features/bots/config-export.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/config-action-handler.ts`
- `apps/web/src/features/bots/runtime-config-sanitizer.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/readiness-loader.ts`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/features/bots/config-review.ts`
- `apps/web/src/features/bots/BotConfigReviewPanel.tsx`
- `apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx`
- `apps/web/src/features/bots/BotOperationMapPanel.tsx`
- `apps/web/src/features/bots/BotSetupControlCenter.tsx`
- `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/lib/access.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `packages/entitlements/src/engine.ts`
- `packages/entitlements/src/state-machine.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/bot-config-export-route-handler.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-runtime-config-sanitizer.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-action-handler.test.ts`
- `tests/integration/bot-config-review-static.test.ts`
- `tests/integration/user-resolved-bot-config-static.test.ts`
- `tests/e2e/bot-settings.spec.ts`

## Files changed
None - read-only audit. The only written artifact is this authorized handoff file.

## Findings
1. Severity P1 - verified control. Evidence `apps/web/src/app/api/bots/[bot]/config-export/route.ts:7`, `apps/web/src/features/bots/config-export-handler.ts:44`, `apps/web/src/features/bots/config-export-handler.ts:51`, `apps/web/src/features/bots/config-export-handler.ts:56`, `apps/web/src/features/bots/config-export-handler.ts:64`, `apps/web/src/features/bots/config-export-handler.ts:65`, `apps/web/src/lib/access.ts:10`, `packages/entitlements/src/engine.ts:117`. The config export path is a GET route that delegates to an extracted handler, requires a user, checks bot entitlement before loading/exporting config, checks Legacy provider mapping before Legacy export, exports only `state.current`, and returns no-store attachment responses. Normal users are fail-closed through `explainAccess`; admins are intentionally allowed by `botAccessForUser`. Recommendation: keep export behavior in the extracted handler and keep 401/403/no-store/content-disposition tests as the route acceptance target. Target part: export route access/read-only boundary.
2. Severity P1 - verified control. Evidence `apps/web/src/features/bots/config-export.ts:249`, `apps/web/src/features/bots/config-export.ts:251`, `apps/web/src/features/bots/config-export.ts:253`, `apps/web/src/features/bots/config-export.ts:261`, `apps/web/src/features/bots/config-export.ts:276`, `apps/web/src/features/bots/config-export.ts:281`, `apps/web/src/features/bots/config-export.ts:282`, `apps/web/src/features/bots/config-export.ts:296`, `apps/web/src/features/bots/config-export.ts:302`, `apps/web/src/features/bots/config-export.ts:304`, `tests/integration/bot-config-export-route-handler.test.ts:172`, `tests/integration/bot-config-export-route-handler.test.ts:203`. The export builder is allowlist-shaped: Tortila emits a small env-style reference file, Legacy emits a JSON/native config from allowed settings only, and `providerPubId` is stripped from Legacy runtime-derived symbol rows. Current route-handler tests inject `apiKey`, `apiSecret`, provider account IDs, raw/live config, authorization headers, and live-control markers and assert they do not appear in body or headers. Recommendation: retain allowlist export and avoid spreading any saved config object into the response. Target part: export payload boundary.
3. Severity P2 - coverage gap. Evidence `tests/integration/bot-config-export-route-handler.test.ts:98`, `tests/integration/bot-config-export-route-handler.test.ts:172`, `tests/integration/bot-config-export-route-handler.test.ts:203`, `tests/integration/bot-config-export-static.test.ts:24`, `tests/integration/bot-config-export-static.test.ts:26`, `tests/integration/bot-config-export-static.test.ts:30`. Existing export tests do not explicitly include all forbidden classes from this audit scope: `sealed`, `keyId`, `wrappedDek`, `vaultRecord`, `DATABASE_URL`/`databaseUrl`, admin-only fields such as `email`, `roles`, `passwordHash`, or a `liveControl` field. Recommendation: extend `expectNoUnsafeMarkers()` and both hostile Tortila/Legacy config fixtures with those fields; assert body and serialized response headers do not contain them. Add a static assertion that `config-export.ts` contains no `process.env`, `DATABASE_URL`, `exchangeApiKeySecrets`, `users.email`, `passwordHash`, `roles`, `startBot`, `stopBot`, `applyConfig`, or `liveControl`. Target part: export regression coverage.
4. Severity P2 - boundary clarity risk. Evidence `apps/web/src/features/bots/runtime-config-sanitizer.ts:3`, `apps/web/src/features/bots/runtime-config-sanitizer.ts:72`, `apps/web/src/features/bots/runtime-config-sanitizer.ts:86`, `apps/web/src/features/bots/runtime-config-sanitizer.ts:108`, `apps/web/src/features/bots/runtime-config-sanitizer.ts:120`, `tests/integration/bot-runtime-config-sanitizer.test.ts:77`, `tests/integration/bot-runtime-config-sanitizer.test.ts:79`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:208`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:234`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:476`. Runtime config is sanitized recursively and strips secret/control/url/header keys, but it is still exposed to pages as `config.data.raw` and tests intentionally allow sanitized provider-shaped arrays (`providerAccounts`, `activeSlots`, `activeOrderSummary`) with masked pub IDs. This is not an observed secret leak, but the `raw` name and provider-shaped bag make the "no raw provider payload" boundary easy to regress. Recommendation: in the next implementation phase, project runtime config into a named safe DTO (counts, masked pub_id, stage/order summaries only) before page code, or add static/browser assertions that no unmasked provider IDs, `rawJson`, DB URLs, secret keys, sealed blobs, or provider response bodies render. Target part: generated runtime preview boundary.
5. Severity P1 - verified adjacent action control. Evidence `apps/web/src/features/bots/config-action-handler.ts:51`, `apps/web/src/features/bots/config-action-handler.ts:92`, `apps/web/src/features/bots/config-action-handler.ts:165`, `apps/web/src/features/bots/config-action-handler.ts:167`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:147`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:153`, `tests/integration/bot-config-action-handler.test.ts:154`. Adjacent settings/setup save actions are not export actions and are not read-only by design because they save WTC-side config versions, but they run CSRF first, resolve user/access through the shared handler, and reject forbidden hidden form keys before parsing or persistence. Recommendation: keep export acceptance separate from config-save acceptance and add static assertions that export route files never import `persistBotConfig`, `saveBotConfig`, `addExchangeKey`, `recordExchangeKeyMetadataCheck`, `getBotAdapter`, or `fetch`. Target part: route/action separation.

## Decisions
- Did not run browser, Vitest, lint, typecheck, DB, worker, provider, migration, seed, live server, raw env, SSH, tmux, or systemd commands. This phase was read-only static inspection plus one handoff write.
- Treated `Download config export` as a GET export route, not as a server action. The route is read-only; settings/setup server actions nearby are WTC-version mutations by design and were inspected only for secret/live-control boundaries.
- Treated masked Legacy pub_id operational evidence as allowed current product behavior, but flagged the remaining `raw` DTO naming as a future hardening risk.

## Risks
- No test suite was executed in this audit, so no gate is claimed green.
- The export payload builder is allowlist-shaped today, but coverage does not yet lock every forbidden class named in this scope.
- Sanitized runtime previews still pass provider-shaped arrays through a property named `raw`; without stronger tests or a projected DTO, future work could accidentally treat sanitized evidence as a raw provider payload.
- The worktree was heavily dirty before this audit. All existing dirty tracked/untracked files were treated as pre-existing user/session work.
- This audit did not prove production canary behavior, DB contents, real browser downloads, or live provider behavior.

## Verification/tests
RUN:
- Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and latest Phase 4.18 handoff.
- `git status --short --branch` - inspected only; current branch `codex/bot-analytics-settings-canary-20260603` has many pre-existing modified/untracked files.
- Static source inspection of export route/handler/builder, config save handler, runtime sanitizer, read model, settings/setup preview components, entitlement gate, exchange-key metadata storage, and existing tests.
- Static grep sweeps for forbidden markers across export code/tests and runtime sanitizer/tests.

RUN WITH NON-GREEN RESULT:
- None. No executable gate was run.

NOT RUN:
- `npx vitest run tests/integration/bot-config-export-route-handler.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts` - skipped to keep this audit read-only and avoid generated test artifacts.
- `npx playwright test tests/e2e/bot-settings.spec.ts` - skipped; browser run is outside this read-only audit and may generate screenshots/artifacts.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `node scripts/gates.mjs quick/core/full`, `npm run secret:scan` - skipped; not required for read-only inspection and some gates may generate output.
- `npm run db:generate`, `db:migrate`, `db:seed`, any managed DB/e2e harness - skipped by explicit no DB/migrate/seed scope.
- Worker, provider, exchange, raw env, live bot, SSH, tmux, systemd, deploy, and production canary checks - skipped by explicit safety scope.

## Next actions
1. Add export route-handler test fixtures with `sealed`, `keyId`, `wrappedDek`, `vaultRecord`, `DATABASE_URL`, `databaseUrl`, `adminEmail`, `email`, `roles`, `passwordHash`, `liveControl`, `providerAccounts`, `activeSlots`, `activeOrderSummary`, and raw provider body markers; assert none appear in export body or response headers.
2. Add a static export-route assertion that `route.ts`, `config-export-handler.ts`, and `config-export.ts` never import or reference mutation/provider/secret sources: `persistBotConfig`, `saveBotConfig`, `addExchangeKey`, `recordExchangeKeyMetadataCheck`, `exchangeApiKeySecrets`, `getBotAdapter`, `fetch`, `process.env`, `DATABASE_URL`, `startBot`, `stopBot`, `applyConfig`, `liveControl`.
3. Add browser/API assertions to `tests/e2e/bot-settings.spec.ts` after the existing `Download config export` link checks: fetch `/api/bots/tortila/config-export` and `/api/bots/legacy/config-export` in the authenticated context, assert `content-disposition` filenames, `cache-control: no-store`, and absence of the forbidden marker list.
4. Replace or wrap `config.data.raw` with a projected safe runtime DTO before settings/statistics/dashboard pages, or add static tests that runtime-preview surfaces render only counts/masked IDs and never raw provider payload keys or unmasked provider IDs.
