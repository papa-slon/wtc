# phase-4-20-bot-export-browser-failclosed handoff
## Scope
Phase 4.20 foreground implementation and acceptance for bot settings export browser proof.

Read-only agents were launched before edits, per `AGENTS.md` and `docs/SESSION_PROTOCOL.md`.
The concrete objective was to turn the Phase 4.19 export/copy work into browser-level evidence:
a logged-in browser context must prove Tortila config export headers/body safety, and Legacy config
export must fail closed when the user has no safe provider `pub_id` mapping.

External product references considered during this phase:
- 3Commas DCA bot settings docs: DCA settings are structured around pair, order/safety-order,
  take-profit, and capital usage previews.
- Freqtrade UI docs: bot monitoring/configuration is separated from config-file execution.
- Hummingbot Dashboard docs: strategy configs stay user-private while dashboard/API manage
  deployment and monitoring surfaces.
- TradingView watchlist docs: symbol collections benefit from compact summaries and filterable
  watchlist-style controls.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260604-1455-phase-4-19-bot-settings-export-copy.md`
- `docs/handoffs/20260604-1505-bot-export-browser-ux-auditor.md`
- `docs/handoffs/20260604-1505-bot-export-browser-security-auditor.md`
- `docs/handoffs/20260604-1505-bot-export-browser-gates-auditor.md`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/bots/config-export-handler.ts`
- `apps/web/src/features/bots/config-export.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/runtime-config-sanitizer.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/middleware.ts`
- `packages/auth/src/security-headers.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/security-headers.spec.ts`
- `tests/integration/auth-rate-limit-middleware.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-config-export-route-handler.test.ts`

## Files changed
- `tests/e2e/bot-settings.spec.ts` - added browser `page.request.get()` assertions for Tortila
  config export status, attachment headers, no-store/nosniff/no-referrer, safe body content,
  absence of the unsaved Tortila draft row, forbidden marker checks, and Legacy 403
  `provider_mapping_required` response with no attachment.
- `apps/web/src/middleware.ts` - corrected document-header stamping so GET `/api/*` routes are
  not treated as document navigations and route-level attachment/security headers are not
  overwritten by the global document policy.
- `tests/integration/auth-rate-limit-middleware.test.ts` - added regression coverage proving
  document GETs receive global security headers while API GETs are left for route handlers.
- `apps/web/src/features/bots/config-export-handler.ts` - made Legacy export fail closed unless
  the config read model proves exactly one safe `providerAccounts` row, not merely absence of a
  `legacy_provider_mapping_required` issue.
- `tests/integration/bot-config-export-route-handler.test.ts` - added Legacy no-provider-account
  block coverage and updated the mapped Legacy success fixture.
- `tests/integration/bot-config-export-static.test.ts` - added static guards for browser export
  assertions and provider-account fail-closed helper wiring.
- `docs/handoffs/20260604-1517-phase-4-20-bot-export-browser-failclosed.md` - this aggregate handoff.

## Agent handoffs
- UX/product audit: `docs/handoffs/20260604-1505-bot-export-browser-ux-auditor.md`
- Security/runtime audit: `docs/handoffs/20260604-1505-bot-export-browser-security-auditor.md`
- Tests/gates audit: `docs/handoffs/20260604-1505-bot-export-browser-gates-auditor.md`

## Findings
1. Severity P1 - evidence `tests/e2e/bot-settings.spec.ts`, `apps/web/src/middleware.ts`,
   first Playwright failure in this phase - the route handler emitted `referrer-policy:
   no-referrer`, but the browser received the global `strict-origin-when-cross-origin` because
   middleware stamped document headers on API GETs. Recommendation implemented: exclude `/api/*`
   from document navigation header stamping and add middleware regression coverage. Target part:
   browser-observed attachment route headers.
2. Severity P1 - evidence `tests/e2e/bot-settings.spec.ts`,
   `apps/web/src/features/bots/config-export-handler.ts`, second Playwright failure in this phase
   - Legacy UI disabled export when no provider `pub_id` was mapped, but direct browser API
   returned `200`. Recommendation implemented: Legacy export now requires exactly one safe
   provider-account row in the config read model or returns `403 provider_mapping_required`.
   Target part: Legacy settings export fail-closed behavior.
3. Severity P2 - evidence `tests/e2e/bot-settings.spec.ts`,
   `docs/handoffs/20260604-1505-bot-export-browser-gates-auditor.md` - Phase 4.19 proved link
   text and route-handler payloads, but not browser-level response headers/body. Recommendation
   implemented: the bot settings workbench now checks authenticated Tortila export response
   headers/body and Legacy blocked JSON from the browser request context. Target part: browser
   export acceptance.
4. Severity P2 - evidence `docs/handoffs/20260604-1505-bot-export-browser-security-auditor.md` -
   runner ZIP download still lacks the same `nosniff` and `no-referrer` hardening used by config,
   LMS, and Axioma download handlers. Recommendation deferred: add runner download headers and a
   browser API assertion in a later backtester/download slice. Target part: backtester runner
   download route.
5. Severity P2 - evidence `docs/handoffs/20260604-1505-bot-export-browser-ux-auditor.md` - the
   bot settings pages are layout-safe but still long expert workbenches. Recommendation deferred:
   make a first-viewport basic path for coin/stage/trigger/system/risk/save/export, with advanced
   ladders/caps collapsed. Target part: user configuration simplicity.

## Decisions
- Kept this phase read-only until all three agents were dispatched.
- Treated direct browser `page.request.get()` as the safest high-signal export proof for this
  phase: no live bot control, no exchange/provider call, no DB migration/seed, and no downloaded
  file artifact retention.
- Fixed actual endpoint behavior when Playwright contradicted UI intent instead of weakening the
  test to match the bug.
- Left Legacy no-`pub_id` product policy as fail-closed for now. The endpoint and UI are now
  aligned; a future phase can decide whether to add a WTC-only sanitized Legacy reference export
  without provider mapping.
- Did not bundle backtester runner headers, admin selected-user DB matrix, clipboard API proof,
  or first-viewport settings simplification into this phase because they are separate acceptance
  slices.

## Risks
- This phase proves browser API response bodies/headers, not a rendered-link download event or OS
  download artifact.
- The Legacy export policy is secure and consistent but may still feel restrictive for a user who
  configured WTC reference settings before admin mapped a `pub_id`.
- Admin selected-user rendered DB matrix and worker continuity remain outside this phase and must
  not be claimed green from these gates.
- The worktree was already heavily dirty before Phase 4.20; this handoff claims only the files
  listed above.

## Verification/tests
RUN:
- `npx vitest run tests/integration/bot-config-export-static.test.ts tests/integration/bot-config-export-route-handler.test.ts` - passed before middleware/handler fixes, 2 files / 9 tests.
- `npx eslint "tests/e2e/bot-settings.spec.ts" "tests/integration/bot-config-export-static.test.ts" --max-warnings 0` - passed before middleware/handler fixes.
- `npx playwright test tests/e2e/bot-settings.spec.ts -g "bot settings workbench"` - first run failed 2/2 because browser export response had `referrer-policy: strict-origin-when-cross-origin` instead of route-level `no-referrer`; fixed in `apps/web/src/middleware.ts`.
- `npx vitest run tests/integration/auth-rate-limit-middleware.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/bot-config-export-route-handler.test.ts` - passed, 3 files / 15 tests after middleware fix.
- `npx eslint "apps/web/src/middleware.ts" "tests/integration/auth-rate-limit-middleware.test.ts" "tests/e2e/bot-settings.spec.ts" "tests/integration/bot-config-export-static.test.ts" --max-warnings 0` - passed after middleware fix.
- `npx playwright test tests/e2e/bot-settings.spec.ts -g "bot settings workbench"` - second run failed 2/2 because Legacy direct API returned `200` while UI showed export blocked; fixed in `apps/web/src/features/bots/config-export-handler.ts`.
- `npx vitest run tests/integration/auth-rate-limit-middleware.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/bot-config-export-route-handler.test.ts` - passed, 3 files / 16 tests after handler fix.
- `npx eslint "apps/web/src/middleware.ts" "apps/web/src/features/bots/config-export-handler.ts" "tests/integration/auth-rate-limit-middleware.test.ts" "tests/e2e/bot-settings.spec.ts" "tests/integration/bot-config-export-static.test.ts" "tests/integration/bot-config-export-route-handler.test.ts" --max-warnings 0` - passed after handler fix.
- `npx playwright test tests/e2e/bot-settings.spec.ts -g "bot settings workbench"` - passed, 2/2 desktop and mobile.
- `npm run typecheck -w @wtc/web` - passed.
- `npx playwright test tests/e2e/security-headers.spec.ts` - passed, 2/2 desktop and mobile.
- `git diff --check` - passed.
- `node scripts/gates.mjs quick` - passed, 4/4 gates: lint, typecheck, typecheck-web, test.
- `npm run secret:scan` - passed.
- `npm run governance:check` - passed after writing this aggregate as current phase `20260604-1517`, 0 errors and 1 known historical warning.
- `npm run evidence:visual -- --inventory` - passed inventory: 103 images, 0 blocked binary/container artifacts, 0 missing roots, 104 total artifact files, 0 dynamic markers.

NOT RUN:
- Rendered-link Playwright download event with downloaded file bytes - skipped; browser API body/header proof was sufficient for this fail-closed slice and avoids retained download artifacts.
- Clipboard permission/stub assertion for `Copy draft SYMBOL_CONFIGS` - skipped; deferred to a dedicated copy UX acceptance slice.
- `npm run e2e:admin-user-bots:db:managed` / `npm run e2e:admin-user-bots:db:managed:matrix` - skipped; requires explicit disposable maintenance Postgres URL and creates/drops throwaway DB resources.
- `npm run accept:worker:continuity` - skipped; requires explicit throwaway WTC DB and is a worker continuity slice, not export/browser proof.
- `npm run db:generate`, `npm run db:migrate`, `npm run db:seed` - skipped by scope and safety policy.
- `npm run build -w @wtc/web`, `node scripts/gates.mjs core`, `node scripts/gates.mjs full`, `npm run ci:local` - skipped because focused quick/typecheck/browser gates covered this slice without invoking broader schema/build surfaces.
- `npm run evidence:visual -- --manifest <manifest>` - skipped because no visual review manifest was created and no visual acceptance claim is made for this phase.
- Live bot start/stop/apply-config, exchange/provider calls, raw env reads, raw secret reads, SSH/tmux/systemd/deploy - skipped by non-negotiable safety policy and phase scope.

## Next actions
1. Add runner ZIP `nosniff` and `no-referrer` headers plus browser API assertions for the Tortila runner download route.
2. Add Tortila rendered-link download event proof only if retained download artifacts are scanned/reviewed or discarded safely.
3. Add clipboard success/fallback acceptance for `Copy draft SYMBOL_CONFIGS`.
4. Build the first-viewport/basic settings path so users can configure coin, stage/system, RSI/CCI or Turtle settings, risk, save, and export without scanning the whole expert workbench.
5. When an explicit disposable Postgres admin URL is available, run the admin selected-user DB E2E matrix and retain reviewed screenshots before claiming rendered admin drilldown acceptance.
6. Keep `/admin/users/[userId]/bots` read-only; do not add personal settings or provider-mapping mutation to that page.
