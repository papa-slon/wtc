# admin-global-bot-config-tests-auditor handoff
## Scope
Read-only Phase 3.76 tests/acceptance audit before implementation of admin global bot configuration/system-defaults for Legacy and Tortila.

This lane inspected governance docs, the Phase 3.75 handoff, package scripts, current DB/config code, admin actions/schemas/pages, and admin/bot tests/e2e. It did not edit product code, tests, migrations, or docs other than this handoff. It did not run live services, worker ticks, live bot probes, SSH, tmux, systemd, exchange pings, provider DB reads, `.env` reads, or live control paths.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-2000-phase-3-75-admin-bot-stats-drilldown.md`
- `docs/handoffs/20260603-bot-settings-ux-product.md`
- `package.json`
- `apps/web/package.json`
- `packages/db/package.json`
- `vitest.config.ts`
- `playwright.config.ts`
- `playwright.auth-db.config.ts`
- `scripts/gates.mjs`
- `scripts/check-governance.mjs`
- `scripts/check-retained-visual-artifacts.mjs`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `docs/AUDIT_LOG_SCHEMA.md`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/admin-account-unlock-static.test.ts`
- `tests/integration/admin-account-unlock-db.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/legacy-live-worker-static.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/csrf-coverage.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/smoke.spec.ts`

## Files changed
None - read-only audit. Handoff artifact only: `docs/handoffs/20260603-2009-admin-global-bot-config-tests-auditor.md`.

## Findings
1. Severity: High. The global defaults slice needs its own schema/repository tests because current persisted bot config is user-owned, not system-owned. Evidence: bot instances require `userId` and `productCode` at `packages/db/src/schema.ts:138` to `packages/db/src/schema.ts:143`; current configs are keyed by `botInstanceId` at `packages/db/src/schema.ts:177` to `packages/db/src/schema.ts:182`; config history is also per `botInstanceId` at `packages/db/src/schema.ts:432` to `packages/db/src/schema.ts:446`; Phase 3.75 explicitly left "separate global admin bot configuration/system-defaults page" for the future at `docs/handoffs/20260603-2000-phase-3-75-admin-bot-stats-drilldown.md:60` and named Phase 3.76 at `docs/handoffs/20260603-2000-phase-3-75-admin-bot-stats-drilldown.md:87`; prior UX audit says reusing user `bot_configs` for system defaults blurs ownership/audit/inheritance at `docs/handoffs/20260603-bot-settings-ux-product.md:128`. Recommendation: add `tests/integration/admin-global-bot-config-db.test.ts` with PGlite migration coverage for the new global defaults tables/repos before accepting implementation. Target part: DB schema, migration, repository, resolved-config model.
2. Severity: High. The admin defaults action must not reuse the user settings mutation pipeline as-is. Evidence: user settings action does `assertCsrf` and `requireUser` but no `assertAdmin` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:98` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:130`; persistence writes through `persistBotConfig(user.id, meta.code, ...)` at `apps/web/src/features/bots/config.ts:791` to `apps/web/src/features/bots/config.ts:801`; existing admin action protocol is `requireUser() -> assertAdmin(roles) -> assertCsrf(formData) -> Zod -> repo -> revalidatePath` at `apps/web/src/features/admin/actions.ts:4` to `apps/web/src/features/admin/actions.ts:8`, with concrete examples at `apps/web/src/features/admin/actions.ts:141` to `apps/web/src/features/admin/actions.ts:165` and `apps/web/src/features/admin/actions.ts:347` to `apps/web/src/features/admin/actions.ts:419`. Recommendation: add static server-action tests requiring `requireUser`, `assertAdmin`, `assertCsrf`, schema `safeParse`, admin/global repo call, audit-path revalidation, and no import/call of user `persistBotConfig` or live adapter controls. Target part: `apps/web/src/features/admin/actions.ts`, `apps/web/src/features/admin/schemas.ts`.
3. Severity: High. Global defaults need product-specific Zod coverage for both Legacy and Tortila, including hard caps and malformed row rejection, not just happy-path preset saves. Evidence: current product schemas split Tortila and Legacy at `apps/web/src/features/bots/config.ts:46` to `apps/web/src/features/bots/config.ts:128`; the parser builds separate Legacy/Tortila form inputs at `apps/web/src/features/bots/config.ts:362` to `apps/web/src/features/bots/config.ts:375`; current issue collection covers row parsing and duplicates at `apps/web/src/features/bots/config.ts:399` to `apps/web/src/features/bots/config.ts:458`; Tortila audit notes malformed rows can be silently skipped/fallback if not blocked carefully at `docs/handoffs/20260603-tortila-bot-integration-auditor.md:106`. Recommendation: static/action tests must cover invalid product code, product/schema mismatch, duplicate symbols, row limits, malformed Tortila `SYMBOL_CONFIGS`, malformed Legacy stages, out-of-range risk/leverage/TP, and no silent fallback to built-in defaults on submitted admin data. Target part: admin global defaults schema and parser.
4. Severity: High. Audit acceptance must prove admin/system defaults are versioned and redacted without raw config JSON or secrets in audit rows. Evidence: current `saveBotConfig` updates current config, appends a version, and writes an audit row in one transaction at `packages/db/src/repositories.ts:1836` to `packages/db/src/repositories.ts:1848`; that audit writes only `{ version }` at `packages/db/src/repositories.ts:1848`; audit docs require redacted before/after fields and no secrets at `docs/AUDIT_LOG_SCHEMA.md:98` to `docs/AUDIT_LOG_SCHEMA.md:100`, and specifically say `bot.config.save` uses version-only payloads and no raw config JSON at `docs/AUDIT_LOG_SCHEMA.md:323`; redaction is applied in `packages/audit/src/audit.ts:169` to `packages/audit/src/audit.ts:185`. Recommendation: PGlite tests should assert version increments, current row/history row consistency, actor role `admin`, target type for global default, safe before/after payloads only, and no serialized `apiKey`, `secret`, `token`, `providerAccountId`, DB URL, raw config JSON, or live-apply credential. Target part: repository/audit tests.
5. Severity: Medium. Page static tests must prove the new admin surface is admin-only, clearly system-scoped, and cannot mutate live bots. Evidence: `/admin/bots` already requires `requireUser` and `assertAdmin` at `apps/web/src/app/admin/bots/page.tsx:41` to `apps/web/src/app/admin/bots/page.tsx:48`; its copy says live control is disabled and no start/stop/applyConfig buttons exist at `apps/web/src/app/admin/bots/page.tsx:55` to `apps/web/src/app/admin/bots/page.tsx:56`; orchestrator seed forbids live bot control, SSH/tmux/systemd/process control, and `.env` mutation at `docs/handoffs/0000-orchestrator-seed.md:115` to `docs/handoffs/0000-orchestrator-seed.md:120`. Recommendation: add `tests/integration/admin-global-bot-config-static.test.ts` to require the chosen route/section, likely `/admin/bots/config`, to render `CsrfField`, Legacy/Tortila product controls, current/resolved/default version labels, "no live apply" copy, and no start/stop/retest/apply-config/close-position/cancel-order/DB URL/provider secret fields. Target part: admin page/static tests.
6. Severity: Medium. Mobile/browser acceptance is not covered by current admin or bot settings e2e for this new surface. Evidence: current admin mobile spec covers `/admin/users/demo-user/bots` and `/admin/bots` at `tests/e2e/admin-mobile-pg8.spec.ts:23` to `tests/e2e/admin-mobile-pg8.spec.ts:28`, then checks mobile nav/no horizontal scroll at `tests/e2e/admin-mobile-pg8.spec.ts:36` to `tests/e2e/admin-mobile-pg8.spec.ts:58`; current bot settings e2e covers user settings pages only at `tests/e2e/bot-settings.spec.ts:13` to `tests/e2e/bot-settings.spec.ts:43`. Recommendation: extend `tests/e2e/admin-mobile-pg8.spec.ts` or add a dedicated `tests/e2e/admin-global-bot-config.spec.ts` for desktop and mobile route rendering, no horizontal scroll at 375px, product switching, disabled/no-live-control evidence, and safe screenshots. Target part: Playwright acceptance.
7. Severity: Medium. The implementation gate list must be explicit because current runner modes split static/build and Playwright. Evidence: root scripts include `test`, `secret:scan`, `lint`, `db:generate`, `e2e`, `evidence:visual`, `check:core`, `governance:check`, and `ci:local` at `package.json:14` to `package.json:44`; `scripts/gates.mjs` defines `full` as governance/check:core/lint/typecheck/typecheck-web/secret:scan/test/db:generate/build and keeps e2e separate at `scripts/gates.mjs:13` to `scripts/gates.mjs:17` and `scripts/gates.mjs:49` to `scripts/gates.mjs:53`; Playwright starts a dedicated local Next server on the e2e port at `playwright.config.ts:4` to `playwright.config.ts:34`. Recommendation: the implementation aggregate must list focused Vitest, db generate, typecheck, lint, secret scan, web build, governance, mobile Playwright, and any skipped full/e2e gates with reasons. Target part: acceptance/gates.

## Decisions
1. Required focused DB test: add `tests/integration/admin-global-bot-config-db.test.ts`. It should use PGlite, apply all migrations, seed admin/user rows, save global defaults for both `legacy_bot` and `tortila_bot`, prove one current row per product/scope, append immutable version history, reject invalid product/schema data, reject stale `expectedVersion` or prove deterministic last-write semantics, and assert no user `bot_configs` or `bot_instances` are created by system-default writes.
2. Required repository/resolution test: the DB test should prove resolution precedence explicitly: built-in defaults < admin global default < user saved `bot_configs`, while user page/export access remains entitlement-gated and global defaults never grant access.
3. Required action/static test: add or extend a static admin test that extracts the new action body and checks `requireUser -> assertAdmin -> assertCsrf -> schema.safeParse -> admin/global repo -> revalidatePath('/admin/bots')` and `revalidatePath('/admin/audit-log')`. It should reject user settings imports, live adapter imports, exchange-key writes, and direct `process.env` mutation.
4. Required schema/static test: validate product-specific Legacy/Tortila defaults and hard caps via Zod. Include row-level errors for Tortila symbol configs and Legacy averaging/stage configs.
5. Required page/static test: assert the admin global defaults page is admin RBAC gated, renders `CsrfField`, displays system/default/resolved-source labels, keeps live control disabled, and does not display provider secrets, DB URLs, full provider pub ids, raw JSON exports, or stack traces.
6. Required Playwright test: add `/admin/bots/config` to mobile admin coverage or a dedicated desktop/mobile spec. It must check no horizontal scroll at 375px, visible Legacy/Tortila sections, disabled/no-live-control copy, and screenshots that pass retained artifact policy if kept.
7. Do not run live service/probe gates for this slice. Local PGlite and Playwright dev server gates are acceptable after implementation; live Legacy/Tortila controls, provider DB live reads, exchange ping/test connection, SSH, tmux, systemd, `.env` reads/mutations, worker restart/tick, and live apply remain out of scope.

## Risks
1. Reusing user-owned `bot_configs` for global defaults would make inheritance, ownership, and audit ambiguous.
2. Adding an admin form without action static tests could accidentally ship a mutation without admin RBAC, CSRF, Zod, or audit revalidation.
3. Saving entire config JSON into audit rows would violate the audit minimization rule even if redaction catches obvious secret keys.
4. Global defaults can be mistaken for live bot apply unless page copy and tests forbid start/stop/apply/retest/control language.
5. A system default can accidentally become an access source if tests do not prove entitlements remain the only user-access source of truth.
6. Mobile forms with dense Legacy/Tortila config grids are likely to overflow unless every table/control cluster is checked at 375px.

## Verification/tests
RUN:
1. Static read-only inspection only, using `rg`, `Get-Content`, and file listing over the files named above.
2. No local Vitest, Playwright, build, lint, typecheck, secret, DB generate, governance, worker, live service, or probe gate was run in this audit lane.

NOT RUN:
1. `npx vitest run tests/integration/admin-global-bot-config-db.test.ts tests/integration/admin-global-bot-config-static.test.ts` - not run because these target tests do not exist yet and this was pre-implementation read-only audit.
2. `npx vitest run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/csrf-coverage.test.ts` - not run because no implementation was present to verify.
3. `npm run db:generate` - not run because this lane made no schema edits; required after the global defaults schema/migration is added.
4. `npm run typecheck` and `npm run typecheck -w @wtc/web` - not run; required after implementation.
5. `npm run lint` - not run; required after implementation.
6. `npm run secret:scan` - not run; required after implementation, especially after screenshots/handoffs are added.
7. `npm run governance:check` - not run; required after the aggregate phase handoff exists.
8. `npm run build -w @wtc/web` - not run; required after the admin page/action are added.
9. `node scripts/gates.mjs full` - not run; required for final aggregate unless each component is run and listed separately.
10. `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` or dedicated admin global config Playwright - not run because this pre-implementation audit did not start a dev server or write screenshots.
11. `node scripts/gates.mjs e2e` / full `npm run e2e` - not run because no product implementation exists and e2e starts a local dev server.
12. `npm run evidence:visual` - not run because no new screenshots were produced.
13. `npm run worker:smoke`, worker tick, managed Postgres apply/seed, live Legacy/Tortila bot continuity, SSH, tmux, systemd, exchange ping, provider DB live reads, `.env` reads/mutations, start/stop/retest/apply-config - forbidden by scope and not run.

## Next actions
1. Implement the global defaults schema/repositories first, with PGlite tests proving system scope, versioning, resolution precedence, audit minimization, and no user-row side effects.
2. Implement admin action/schema/page only after the DB contract is clear; wire static tests for RBAC/CSRF/Zod/audit/no-live-control before browser polish.
3. Add the admin mobile Playwright coverage for the new page or section and keep screenshots under the retained artifact rules.
4. Final Phase 3.76 aggregate should list every gate RUN and NOT RUN, and should not claim live bot safety or production readiness from this local/static acceptance slice.
