# bot-export-browser-security-auditor handoff
## Scope
Read-only Phase 4.20 security/runtime audit before edits. Inspected config export/download routes, browser tests, runtime/config sanitizers, admin selected-user bot detail loaders, and bot continuity/readiness surfaces. Focus areas: leak prevention, RBAC/entitlement, admin read-only boundary, no live bot control, no plaintext exchange secret exposure, and whether browser download/API tests can be added safely without live provider or DB mutation.

No background agents were launched from this auditor, per operator instruction.

## Files inspected
- AGENTS.md
- docs/SESSION_PROTOCOL.md
- docs/handoffs/0000-orchestrator-seed.md
- docs/handoffs/20260604-1455-phase-4-19-bot-settings-export-copy.md
- apps/web/src/app/api/bots/[bot]/config-export/route.ts
- apps/web/src/features/bots/config-export-handler.ts
- apps/web/src/features/bots/config-export.ts
- apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx
- apps/web/src/features/bots/config-action-handler.ts
- apps/web/src/features/bots/config.ts
- apps/web/src/features/bots/runtime-config-sanitizer.ts
- apps/web/src/features/bots/data.tsx
- apps/web/src/features/bots/readiness.ts
- apps/web/src/features/bots/readiness-loader.ts
- apps/web/src/features/bots/continuity.ts
- apps/web/src/app/admin/users/[userId]/bots/page.tsx
- apps/web/src/features/admin/user-bot-detail-loader.ts
- apps/web/src/features/admin/health-detail.ts
- apps/web/src/features/admin/bot-health-loader.ts
- apps/web/src/app/api/bots/[bot]/backtest/runner-download/route.ts
- apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx
- apps/web/src/features/lms/material-download.ts
- apps/web/src/features/terminal/axioma-download.ts
- playwright.admin-user-bots-db.config.ts
- scripts/prepare-admin-user-bot-detail-e2e.ts
- scripts/run-admin-user-bot-detail-e2e-managed.mjs
- tests/e2e/bot-settings.spec.ts
- tests/e2e/backtester-pg10-mobile.spec.ts
- tests/e2e/admin-user-bot-detail-db.spec.ts
- tests/integration/bot-config-export-route-handler.test.ts
- tests/integration/bot-config-export-static.test.ts
- tests/integration/bot-runtime-config-sanitizer.test.ts
- tests/integration/bot-read-safety-static.test.ts
- tests/integration/admin-user-bot-detail-static.test.ts
- tests/integration/admin-user-bot-detail-loader.test.ts
- tests/integration/backtester-pg10.test.ts

## Files changed
None — read-only audit

## Findings
1. Severity P2 - Backtester runner ZIP download misses two hardening headers that config export and other download surfaces already use. Evidence: `apps/web/src/app/api/bots/[bot]/backtest/runner-download/route.ts:40` returns the ZIP response with `content-type`, `content-length`, `content-disposition`, `x-runner-version`, `x-runner-sha256`, and `cache-control`; `apps/web/src/features/bots/config-export-handler.ts:68` adds `x-content-type-options: nosniff` and `referrer-policy: no-referrer`; `apps/web/src/features/lms/material-download.ts:43` and `apps/web/src/features/terminal/axioma-download.ts:164` use the same download hardening pattern. Recommendation: add `x-content-type-options: nosniff` and `referrer-policy: no-referrer` to the runner download success path, and consider a shared download header helper for attachment responses. Target part: `apps/web/src/app/api/bots/[bot]/backtest/runner-download/route.ts`.

2. Severity P3 - Runner download browser/API acceptance coverage is still link-visible/static only, so the missing headers above would not fail a browser gate. Evidence: `tests/e2e/backtester-pg10-mobile.spec.ts:17` asserts the "Download local runner" link is visible; `tests/integration/backtester-pg10.test.ts:37` statically checks route source for session, entitlement, non-Legacy rejection, ZIP headers, and no job/upload wording; `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:72` exposes the download link. Recommendation: add a safe `page.request.get('/api/bots/tortila/backtest/runner-download')` browser/API assertion after fixture login that verifies 200, attachment filename, version/hash headers, `private, no-store`, `nosniff`, `no-referrer`, and no Legacy download path. This is safe if it only reads the local runner fixture and does not retain downloaded ZIP artifacts or traces with response bodies. Target part: `tests/e2e/backtester-pg10-mobile.spec.ts` or a focused backtester browser API spec.

3. Severity P3 - Admin selected-user bot detail is currently read-only and does not expose raw config, but its resolved-config sanitizer is projection-based rather than denylist-first. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:484` accepts `z.record(z.unknown())`; `apps/web/src/features/admin/user-bot-detail-loader.ts:497` parses resolved config with that broad schema; `apps/web/src/features/admin/user-bot-detail-loader.ts:594` then projects only safe summary fields; `tests/integration/admin-user-bot-detail-loader.test.ts:619` asserts no secret-shaped markers appear in the serialized model. Recommendation: reuse the bot config forbidden-key guard or add an explicit denylist strip at `safeAdminResolvedConfig`, then add a selected-user fixture containing forbidden keys such as `apiKey`, `apiSecret`, `providerPubId`, `liveConfig`, and `rawJson` to prove the projection cannot regress if new summary fields are added. Target part: `apps/web/src/features/admin/user-bot-detail-loader.ts`.

4. Severity P3 - Config export browser tests now cover authenticated Tortila success and Legacy provider-mapping block, but browser-level 401/entitlement-denied attachment checks are still left to extracted handler tests. Evidence: `tests/e2e/bot-settings.spec.ts:135` uses `page.request.get` for Tortila export success and header/body assertions; `tests/e2e/bot-settings.spec.ts:204` asserts the Legacy blocked route returns 403 JSON with no attachment; `tests/integration/bot-config-export-route-handler.test.ts:135` covers unauthenticated 401; `tests/integration/bot-config-export-route-handler.test.ts:153` covers denied entitlement before config/export loaders are called. Recommendation: add a fresh unauthenticated browser request context check for `/api/bots/tortila/config-export` returning 401 with no attachment headers. Keep denied-entitlement browser coverage in the extracted handler unless a throwaway DB fixture user exists, because mutating real entitlements would violate the phase boundary. Target part: `tests/e2e/bot-settings.spec.ts` plus `tests/integration/bot-config-export-route-handler.test.ts`.

## Decisions
- No P0/P1 leak or live-control issue was observed in the inspected config export, selected-user admin detail, readiness, or continuity surfaces.
- Config export is gated by session, entitlement, and Legacy provider mapping before loading/exporting config. Evidence: `apps/web/src/features/bots/config-export-handler.ts:40`, `apps/web/src/features/bots/config-export-handler.ts:48`, `apps/web/src/features/bots/config-export-handler.ts:56`.
- Config export success responses already use `no-store`, `nosniff`, and `no-referrer`, and generated export bodies intentionally omit exchange keys, provider pub_ids, live-apply tokens, and raw live config. Evidence: `apps/web/src/features/bots/config-export-handler.ts:68`, `apps/web/src/features/bots/config-export.ts:224`, `apps/web/src/features/bots/config-export.ts:251`, `apps/web/src/features/bots/config-export.ts:271`.
- User bot settings writes are WTC config-only and deny forbidden/live-control keys before persistence. Evidence: `apps/web/src/features/bots/config-action-handler.ts:51`, `apps/web/src/features/bots/config-action-handler.ts:159`, `apps/web/src/features/bots/config.ts:839`, `apps/web/src/features/bots/config.ts:877`, `apps/web/src/features/bots/config.ts:1085`.
- Runtime config display sanitizes forbidden secret/provider/live-control/raw keys and masks allowed provider identifiers. Evidence: `apps/web/src/features/bots/runtime-config-sanitizer.ts:3`, `apps/web/src/features/bots/runtime-config-sanitizer.ts:43`, `apps/web/src/features/bots/runtime-config-sanitizer.ts:72`, `tests/integration/bot-runtime-config-sanitizer.test.ts:30`.
- Admin selected-user bot detail is admin-gated, read-only, and avoids raw secret tables/raw JSON in the loader and UI. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:201`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:258`, `apps/web/src/features/admin/user-bot-detail-loader.ts:101`, `apps/web/src/features/admin/user-bot-detail-loader.ts:966`, `apps/web/src/features/admin/user-bot-detail-loader.ts:1137`, `tests/e2e/admin-user-bot-detail-db.spec.ts:177`.
- Continuity/readiness surfaces keep live control read-only/disabled and hide detailed rows when access is denied. Evidence: `apps/web/src/features/bots/readiness.ts:175`, `apps/web/src/features/bots/readiness.ts:212`, `apps/web/src/features/bots/readiness-loader.ts:116`, `apps/web/src/features/bots/continuity.ts:170`.
- Browser download/API tests can be added safely when they are GET-only against authenticated fixture users or fresh unauthenticated request contexts, avoid live provider calls, avoid real entitlement mutations, and do not retain downloaded bodies/traces containing potentially sensitive response data.

## Risks
- The worktree was already dirty before this audit. This handoff does not claim ownership of pre-existing modifications or untracked files.
- Browser download tests may create local artifacts or Playwright traces. Keep assertions at the response/header/body-scan level where possible, and do not retain ZIPs or export bodies unless the fixture data is verified secret-free.
- Browser denied-entitlement coverage needs a controlled fixture user. Without a throwaway DB harness, entitlement-denied behavior should remain covered by extracted handler tests.
- Admin fleet health code reads Legacy metric `rawJson.liveConfig` before projecting masked provider/runtime summaries. The inspected projection appears safe, but new fields in admin fleet or selected-user summaries should be treated as leak-sensitive until covered by denylist tests.

## Verification/tests
Read-only only. No tests, migrations, workers, servers, browser sessions, live providers, or DB-mutating commands were run by this auditor.

Commands run:
- `git status --short --branch`
- `Get-Content` on protocol/handoff/source/test files listed above
- `rg --files` for scoped file discovery
- `rg -n` for scoped evidence search across config export, download routes, browser tests, runtime sanitizers, admin loaders, readiness, continuity, and managed DB browser harness files

Commands not run:
- `pnpm test`, `npm test`, `pnpm lint`, `npm run lint`
- `npx vitest ...`
- `npx playwright test ...`
- `node scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- Any migration, seed, truncate, entitlement edit, user edit, or live database command
- Any worker, adapter, live provider, exchange, bot start/stop/apply-config, or SSH/deploy command

## Next actions
1. Add runner download `nosniff` and `no-referrer` headers, then add static and browser API assertions for those headers.
2. Add an unauthenticated browser request check for config export returning 401 with no attachment headers.
3. Harden `safeAdminResolvedConfig` with forbidden-key stripping or reuse the bot config denylist before projection.
4. If denied-entitlement or admin DB browser coverage is expanded, use only the managed throwaway DB harness and keep `BOT_ADAPTER_MODE=mock` plus `FEATURE_LIVE_BOT_CONTROL=false`.
