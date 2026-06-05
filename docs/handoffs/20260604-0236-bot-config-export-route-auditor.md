# bot-config-export-route-auditor handoff
## Scope
Read-only Phase 3.90 audit of current bot config export route runtime testability and route-handler patterns. Focus: `apps/web/src/app/api/bots/[bot]/config-export/route.ts`, bot config/export helpers, bot read-model provider-mapping behavior, backend/db access seams, and existing route-handler tests. The goal is the minimal implementation path to runtime-test unauthenticated, unauthorized, provider-mapping-required, and successful 200 export behavior, including headers, filenames, and negative payload leakage.

No product code edits, live bot/worker/provider DB/exchange calls, `.env`/vault/SSH/tmux/systemd access, or live service mutation were performed.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0235-phase-3-89-bot-config-source-audit-hardening.md`
8. `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
9. `apps/web/src/features/bots/config.ts`
10. `apps/web/src/features/bots/data.tsx`
11. `apps/web/src/lib/backend.ts`
12. `apps/web/src/lib/db-store.ts`
13. `apps/web/src/lib/access.ts`
14. `apps/web/src/lib/session.ts`
15. `packages/db/src/repositories.ts`
16. `packages/db/src/schema.ts`
17. `tests/integration/bot-config-export-static.test.ts`
18. `tests/integration/bot-read-safety-static.test.ts`
19. `tests/integration/user-resolved-bot-config-static.test.ts`
20. `apps/web/src/app/api/billing/webhook/route.ts`
21. `apps/web/src/features/billing/webhook-handler.ts`
22. `tests/integration/billing-webhook-route-handler.test.ts`
23. `apps/web/src/features/lms/material-download.ts`
24. `tests/integration/lms-material-download-handler.test.ts`
25. `apps/web/src/features/terminal/axioma-download.ts`
26. `tests/integration/axioma-download-handler.test.ts`
27. `apps/web/src/app/api/bots/[bot]/backtest/runner-download/route.ts`
28. `tests/integration/backtester-pg10.test.ts`

## Files changed
None - read-only audit, except this handoff: `docs/handoffs/20260604-0236-bot-config-export-route-auditor.md`.

## Findings
1. Severity: High. The config export route is not yet shaped as a runtime-testable handler, and unauthenticated behavior is not explicitly converted to a response. Evidence: the route calls `requireUser()` directly at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:12`, while `requireUser()` throws `UNAUTHENTICATED` at `apps/web/src/lib/session.ts:16-19`; the adjacent backtester download route catches that path and returns `{ error: 'unauthenticated' }` with status 401 at `apps/web/src/app/api/bots/[bot]/backtest/runner-download/route.ts:10-15`. Recommendation: extract `handleBotConfigExportRequest(req, { meta, requireUser, accessFor, loadConfig, loadReadModel, exportConfig })` into a feature module and make the route a thin wrapper. The extracted handler should catch auth failure and return 401 with `cache-control: no-store`. Target part: unauthenticated runtime behavior and handler seam.
2. Severity: High. The provider-mapping-required branch exists but is currently expensive and brittle to runtime-test through the route because it depends on production DB snapshot mode unless injected. Evidence: route-level Legacy gating checks `legacyRead?.config.issue?.code === 'legacy_provider_mapping_required'` and returns 403 `provider_mapping_required` at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:16-22`; the issue code is produced at `apps/web/src/features/bots/data.tsx:289-294`, but DB snapshot mode is gated by `NODE_ENV === 'production'` plus non-mock adapter mode at `apps/web/src/features/bots/data.tsx:298-300`, and the no/ambiguous active mapping branch lives at `apps/web/src/features/bots/data.tsx:468-480`. Recommendation: runtime-test this branch through an injected `loadReadModel` returning a config issue with that code; leave deeper PGlite mapping coverage optional. Target part: Legacy provider mapping gate.
3. Severity: Medium. The successful export path is safety-oriented, but current coverage is static and does not assert actual response bodies. Evidence: current tests only read source strings at `tests/integration/bot-config-export-static.test.ts:14-37`; the route calls `exportBotConfig(meta.code, state.current)` at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:23`; Tortila export emits an explicit env allowlist and `wtc-tortila-config.env` at `apps/web/src/features/bots/config.ts:681-699`; Legacy export deletes `providerPubId` at `apps/web/src/features/bots/config.ts:654-660` and emits `wtc-legacy-config.json` via an explicit JSON/native allowlist at `apps/web/src/features/bots/config.ts:701-737`. Recommendation: add runtime 200 tests that pass malicious extra fields (`apiKey`, `apiSecret`, `providerPubId`, `rawJson`, `liveConfig`, `headers`, `authorization`, `startBot`, `stopBot`) through `state.current` and assert the final response text/JSON and headers do not contain them. Target part: 200 export payload and leakage regression.
4. Severity: Medium. Unauthorized entitlement behavior is route-visible but should be locked by call-order assertions. Evidence: `botAccessForUser` grants admins and otherwise checks entitlements at `apps/web/src/lib/access.ts:10-14`; the route returns 403 `access_required` before loading config at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:13-18`; entitlements are the source of truth per `AGENTS.md:82`. Recommendation: in the extracted handler test, use spies to assert denied access returns 403, does not call `loadConfig`, does not call `loadReadModel`, does not call `exportConfig`, and does not set attachment headers. Target part: unauthorized runtime behavior.
5. Severity: Medium. Config export response headers are minimal compared with newer download handlers. Evidence: the route sets only `content-type`, `content-disposition`, and `cache-control: no-store` at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:24-30`; LMS and Axioma download handlers also set `x-content-type-options: nosniff` and `referrer-policy: no-referrer` at `apps/web/src/features/lms/material-download.ts:41-49` and `apps/web/src/features/terminal/axioma-download.ts:162-172`, with runtime assertions at `tests/integration/lms-material-download-handler.test.ts:121-126` and `tests/integration/axioma-download-handler.test.ts:235-241`. Recommendation: either lock the current three headers as intended or add `nosniff` and `no-referrer` during the seam extraction, then assert no `set-cookie`, no `location`, exact `content-disposition`, exact filename, and expected content type. Target part: attachment/header hardening.
6. Severity: Low. Existing route-handler patterns strongly favor extracted dependency-injected handlers over direct Next module mocking. Evidence: billing route delegates to `handleBillingWebhookRequest(req, { db: getServerDb(), env: process.env })` at `apps/web/src/app/api/billing/webhook/route.ts:16-20`, the handler accepts injected `db`, `env`, `now`, and `log` at `apps/web/src/features/billing/webhook-handler.ts:120-123`, and its test exercises real `Request` objects at `tests/integration/billing-webhook-route-handler.test.ts:91-104`; LMS and Axioma handlers follow the same option-injection style at `apps/web/src/features/lms/material-download.ts:15-24` and `apps/web/src/features/terminal/axioma-download.ts:34-50`. Recommendation: follow that pattern for bot config export instead of adding brittle alias/module mocks around the route file. Target part: test architecture.

## Decisions
1. The minimal path is a feature-level handler extraction plus a new `tests/integration/bot-config-export-route-handler.test.ts`; it does not require live bots, workers, provider DBs, exchange pings, `.env`, or vault access.
2. The route wrapper can keep slug resolution and `notFound()` behavior out of the first test slice; the extracted handler can be tested with a known `botMeta` object for `tortila_bot` and `legacy_bot`.
3. Provider-mapping-required should remain keyed on `legacy_provider_mapping_required`, not the human title string; current static tests already guard against title-string matching at `tests/integration/bot-config-export-static.test.ts:31-34`.
4. The 200 tests should use the real `exportBotConfig` helper so filename/content-type/body assertions cover the real export logic, while auth/access/load dependencies remain injected.

## Risks
1. Until the unauthenticated path is runtime-tested, the route may surface thrown auth as a framework error rather than the intended JSON 401. This audit did not run a Next server to observe the live status code.
2. If handler extraction accidentally swaps `state.current` for runtime read-model config, it would reopen the source-boundary issue Phase 3.89 just closed; preserve `exportBotConfig(meta.code, state.current)` from `apps/web/src/app/api/bots/[bot]/config-export/route.ts:23`.
3. Static tests can stay as broad source guards, but they are not sufficient acceptance for headers, filenames, body leakage, or call order.
4. Adding stricter headers is low-risk but may require updating current static tests if they begin asserting exact header text.

## Verification/tests
RUN:
1. Required protocol/context reads: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260604-0235-phase-3-89-bot-config-source-audit-hardening.md`.
2. Read-only route/test pattern inspection with `rg` and line-numbered file reads for the focus files and comparable billing/LMS/Axioma/backtester handlers.
3. `git status --short --branch` observed branch `codex/bot-analytics-settings-canary-20260603...origin/codex/bot-analytics-settings-canary-20260603` with substantial pre-existing dirty/untracked work across the broader bot-settings rollout, including the config export route and static test.
4. Background agents spawned by this auditor: none. Background agents left running: none.

NOT RUN:
1. Vitest, typecheck, build, lint, Playwright/e2e, preview, or full gate runner - skipped because this was a read-only audit with exactly one allowed handoff write.
2. Live bot start/stop/apply-config/retest, worker tick/restart/smoke, provider DB reads/writes, exchange ping, `.env`, vault/secret inspection, SSH, tmux, systemd - forbidden by scope and non-negotiable gates.
3. Runtime config-export route tests - not implemented in this auditor lane; this handoff defines the minimal implementation path.

## Next actions
1. Add `apps/web/src/features/bots/config-export-handler.ts` with a dependency-injected `handleBotConfigExportRequest` and make `apps/web/src/app/api/bots/[bot]/config-export/route.ts` a thin wrapper.
2. Add `tests/integration/bot-config-export-route-handler.test.ts` with five runtime cases: unauthenticated 401, unauthorized 403 with no downstream calls, Legacy provider-mapping-required 403, Tortila 200 env export, and Legacy 200 JSON/native export.
3. Assert headers and filenames exactly: Tortila `wtc-tortila-config.env` with `text/plain; charset=utf-8`, Legacy `wtc-legacy-config.json` with `application/json; charset=utf-8`, `content-disposition` attachment, `cache-control: no-store` or `private, no-store` if hardened, no `set-cookie`, no `location`, and any added `nosniff`/`no-referrer` headers.
4. Add negative leak assertions against response body plus headers for secret/provider/live-control markers: `apiKey`, `apiSecret`, `providerPubId`, `providerAccountId`, `rawJson`, `liveConfig`, `headers`, `authorization`, `token`, `startBot`, `stopBot`, `applyConfig`, and representative secret values.
5. Keep existing static tests as source-boundary smoke checks, but do not count them as runtime acceptance once the handler test exists.
