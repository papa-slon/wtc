# bot-config-source-backend-auditor handoff
## Scope
Phase 3.89 read-only backend/source audit of user bot config source-of-truth hardening for Legacy and Tortila. Scope covered `loadBotConfig` user override validation, `persistBotConfig` and `saveBotConfig` call paths, forbidden-key validation below the action layer, config export behavior, and built-in/system default/user override layering. This audit did not edit product code, run live bots, start/stop/apply/retest, tick or restart workers, access provider DBs, ping exchanges, inspect `.env`/vault/SSH/tmux/systemd, or mutate live services.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0214-phase-3-88-bot-settings-effective-review.md`
8. `docs/handoffs/20260604-0152-bot-settings-platform-security-auditor.md`
9. `docs/AUDIT_LOG_SCHEMA.md`
10. `apps/web/src/features/bots/config.ts`
11. `apps/web/src/features/bots/config-types.ts`
12. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
13. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
14. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
15. `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
16. `apps/web/src/features/admin/actions.ts`
17. `apps/web/src/features/admin/user-bot-detail-loader.ts`
18. `packages/db/src/repositories.ts`
19. `packages/db/src/schema.ts`
20. `packages/audit/src/audit.ts`
21. `packages/shared/src/schemas.ts`
22. `tests/integration/bot-config-export-static.test.ts`
23. `tests/integration/user-resolved-bot-config-static.test.ts`
24. `tests/integration/user-resolved-bot-config-db.test.ts`
25. `tests/integration/admin-global-bot-config-static.test.ts`
26. `tests/integration/admin-global-bot-config-db.test.ts`
27. `tests/integration/admin-user-bot-detail-loader.test.ts`
28. `tests/integration/db-0002.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. User override config hardening is still enforced mainly by current settings/setup action callers, not by the lower persistence boundary. Evidence: settings and setup rebuild config from known form fields and validate before persisting at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:98` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:103` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:106` to `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:111`; the generic form builder is allow-listed at `apps/web/src/features/bots/config.ts:364` to `apps/web/src/features/bots/config.ts:383`; admin global defaults have a recursive forbidden-key guard at `apps/web/src/features/admin/actions.ts:431` to `apps/web/src/features/admin/actions.ts:522`; but user persistence still accepts a generic `Record<string, unknown>` at `apps/web/src/features/bots/config.ts:945` and writes it directly through `packages/db/src/repositories.ts:2122` to `packages/db/src/repositories.ts:2131`. Recommendation: create a shared product-aware safe-save validator below page/action code, pass `productCode` into the user-config persistence path, reject forbidden secret/provider/raw-runtime/live-control keys recursively, and use a stricter user-editable Legacy schema that excludes runtime-only fields such as `providerPubId`. Target part: user override source-of-truth boundary.
2. Severity: High. `loadBotConfig` validates published system defaults before using them but trusts the active user override row without product-schema or forbidden-key re-validation. Evidence: system defaults are parsed through `botConfigSchemaFor(productCode).safeParse(row.config)` at `apps/web/src/features/bots/config.ts:803` to `apps/web/src/features/bots/config.ts:807`; the user override branch returns `cfg.config` directly as `current` and `userCurrent` at `apps/web/src/features/bots/config.ts:919` to `apps/web/src/features/bots/config.ts:930`; the export route then exports `state.current` at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:16` to `apps/web/src/app/api/bots/[bot]/config-export/route.ts:23`. Recommendation: parse active user rows through the same product schema plus the forbidden-key guard on load; if invalid, expose a non-green source issue, keep the history visible, fall back to the valid system default or built-in defaults, and do not export the invalid row. Target part: resolved user config source model.
3. Severity: Medium. `bot.config.save` audit payloads still do not match the documented metadata-only shape because the repository omits the prior version even though it has already read the current row. Evidence: `docs/AUDIT_LOG_SCHEMA.md:324` documents `before = { version }`, `after = { version }`; `packages/db/src/repositories.ts:2124` reads `cur`; `packages/db/src/repositories.ts:2132` writes only `after: { version }`. Recommendation: write `before: { version: cur?.version ?? null }` and keep `after: { version }`, with no raw config JSON, then add a focused repository regression. Target part: user override audit trail.
4. Severity: Medium. Config export is intentionally safe in shape, but its acceptance remains mostly static and it inherits the loader trust gap above. Evidence: the route requires a session and entitlement and blocks missing Legacy provider mapping at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:12` to `apps/web/src/app/api/bots/[bot]/config-export/route.ts:22`; Tortila export writes a fixed env allowlist at `apps/web/src/features/bots/config.ts:681` to `apps/web/src/features/bots/config.ts:698`; Legacy export strips `providerPubId` at `apps/web/src/features/bots/config.ts:654` to `apps/web/src/features/bots/config.ts:659` and returns explicit safe warning text at `apps/web/src/features/bots/config.ts:701` to `apps/web/src/features/bots/config.ts:710`; existing coverage string-matches these properties at `tests/integration/bot-config-export-static.test.ts:13` to `tests/integration/bot-config-export-static.test.ts:44`. Recommendation: add runtime route tests for unauthenticated/access-denied/provider-mapping-required/200 export paths and DB-backed tests where a malformed or forbidden user row is ignored rather than exported. Target part: config export acceptance.
5. Severity: Medium. Built-in/system default/user override layering is mostly coherent, but the "use system default" selection is stored as a magic user config marker through the same generic `saveBotConfig` path. Evidence: published defaults are limited to `status === 'published'` plus `appliesToNewUsers` at `packages/db/src/repositories.ts:1991` to `packages/db/src/repositories.ts:1998`; selecting the system default stores `__wtcBotConfigSource`, `globalConfigId`, and selected version at `apps/web/src/features/bots/config.ts:781` to `apps/web/src/features/bots/config.ts:787` and saves it at `apps/web/src/features/bots/config.ts:963` to `apps/web/src/features/bots/config.ts:977`; current DB tests prove published defaults do not create user config rows at `tests/integration/user-resolved-bot-config-db.test.ts:102` to `tests/integration/user-resolved-bot-config-db.test.ts:127` and admin locked defaults ignore stale user config at `tests/integration/admin-user-bot-detail-loader.test.ts:762` to `tests/integration/admin-user-bot-detail-loader.test.ts:785`. Recommendation: replace or wrap the magic marker with a typed selection schema/service, validate that the selected profile still resolves to a valid published default, and keep user custom config JSON separate from source-selection metadata if this area grows. Target part: system default/user override layering.
6. Severity: Medium. Guardrail tests cover source strings and repository happy paths, but they do not yet exercise the actual Next server actions or route behavior at runtime. Evidence: `tests/integration/user-resolved-bot-config-static.test.ts:32` to `tests/integration/user-resolved-bot-config-static.test.ts:75` uses source inspection for settings/setup/export wiring; `tests/integration/admin-global-bot-config-static.test.ts:45` to `tests/integration/admin-global-bot-config-static.test.ts:72` uses source inspection for admin action pipeline; `tests/integration/db-0002.test.ts:54` to `tests/integration/db-0002.test.ts:63` proves version/audit existence but not audit `before` shape or forbidden config rejection. Recommendation: add focused runtime/action tests for locked-default save rejection, forbidden-field rejection, export status codes, exchange-key metadata cross-user denial/no-live-ping behavior, and repository-level rejection of forbidden user config. Target part: backend acceptance tests.

## Decisions
1. Treated Phase 3.88's platform/security backend findings as still open because the effective-review slice improved UX but did not centralize persistence validation or loader re-validation.
2. Treated `providerPubId` as runtime/display metadata for Legacy snapshots, not a user-editable config field; user save/load validation should distinguish editable WTC configs from runtime-derived snapshot rows.
3. Treated config export as WTC reference export only, not a live apply path. Export should continue to use resolved WTC config, never raw provider snapshots, exchange keys, live tokens, or adapter calls.
4. Kept this as a single read-only auditor lane. No N-agent claim is made here.

## Risks
1. Existing or future DB rows written by direct repository calls, old code, fixtures, or manual scripts can bypass current page/action validation until validation is centralized below the action layer.
2. A stale or malformed user row can currently be promoted to `state.current` in user-facing settings/export before a later component sanitizes or ignores individual fields.
3. Static tests can miss behavior changes in Next server actions, route handlers, auth redirects, and response bodies.
4. The workspace is already heavily dirty from prior phases; this audit reflects the current uncommitted tree and intentionally did not revert or normalize unrelated files.

## Verification/tests
RUN:
1. Required docs/protocol read: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260604-0214-phase-3-88-bot-settings-effective-review.md`.
2. Read-only source inspection using `rg` and line-numbered reads for bot config loaders, save call paths, admin forbidden-key guards, DB repositories/schema, export route, audit docs, and relevant static/PGlite tests.
3. Read-only `git status --short` confirmed the workspace was already dirty with many pre-existing modified/untracked files.
4. Read-only target check confirmed `docs/handoffs/20260604-0220-bot-config-source-backend-auditor.md` did not exist before this handoff write.

NOT RUN:
1. Live bot start/stop/apply-config/retest, worker tick/restart/smoke, provider DB reads/writes, exchange ping, `.env`, vault/secret inspection, SSH, tmux, and systemd - forbidden by explicit scope and safety protocol.
2. Vitest, Playwright, build, lint, typecheck, secret scan, or governance check - skipped because this was a read-only source audit with exactly one handoff write.
3. Runtime route/action execution - not run; the lack of runtime route/action coverage is itself called out in Findings.

## Next actions
1. Implement a shared product-aware bot config validation and forbidden-key helper below page/action code; use it for user config persistence and admin global defaults.
2. Re-validate active user override rows in `loadBotConfig`; if invalid or forbidden, surface a non-green source issue and fall back to system/built-in defaults without exporting the invalid row.
3. Add metadata-only `before.version` to `bot.config.save` audit rows and prove it with a focused repository test.
4. Add runtime route/action tests for config export status/body behavior, locked-default save rejection, forbidden field rejection, and metadata-only exchange-key checks.
5. After fixes, run focused Vitest for bot config source/export/admin global tests, web typecheck, and secret scan; keep live bot/provider/server gates NOT RUN unless a separate approved phase explicitly unlocks them.
