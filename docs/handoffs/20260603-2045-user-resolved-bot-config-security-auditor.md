# user-resolved-bot-config-security-auditor handoff
## Scope
Phase 3.77 read-only security/RBAC audit for WTC user-facing resolved bot config.

Verified the boundaries requested by the operator:
- safe user-page reads for published `bot_global_configs`
- entitlement gating before user-facing config/default visibility
- no admin mutation of selected-user bot settings
- no secrets, provider ids, raw runtime payloads, or live-control fields in system defaults
- no live apply/test/start/stop behavior

This was a single requested security-auditor pass. No background agents were launched or claimed.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/SECURITY_MODEL.md`
- `docs/RBAC_MATRIX.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/SECRET_VAULT_DESIGN.md`
- `docs/handoffs/20260603-2037-phase-3-76-admin-global-bot-config.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/bots/config/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `tests/integration/admin-global-bot-config-static.test.ts`
- `tests/integration/admin-global-bot-config-db.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`

## Files changed
None - read-only audit. Product code, tests, live services, env files, and runtime state were not edited. This handoff artifact is the only file written.

## Findings
1. Severity: High. The user-facing resolved-config read path is not implemented yet, so published `bot_global_configs` cannot be accepted as safely consumed on user pages. Evidence: Phase 3.76 explicitly left this as next work at `docs/handoffs/20260603-2037-phase-3-76-admin-global-bot-config.md:63` and `docs/handoffs/20260603-2037-phase-3-76-admin-global-bot-config.md:95`; settings reads only user config plus built-in defaults at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:145` and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:155`; `loadBotConfig()` reads `bot_instances`/`bot_configs`, not `bot_global_configs`, at `apps/web/src/features/bots/config.ts:774`; setup does the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:158`. Recommendation: add a dedicated server-side resolved-config loader that returns source labels for user override -> published system default -> built-in fallback. Target part: user settings/setup/export config model.
2. Severity: High. The existing `getBotGlobalConfig()` repository helper is too broad for user-facing inheritance because it filters only by product/profile, not by `status = 'published'` and `appliesToNewUsers = true`. Evidence: `packages/db/src/repositories.ts:1840` to `packages/db/src/repositories.ts:1849`; the schema defines the active inherited-default condition separately at `packages/db/src/schema.ts:204` to `packages/db/src/schema.ts:206`. Recommendation: add a published-only helper for user pages, or make the resolver explicitly filter on published+applies before reading `config`. Target part: DB repository/resolved-config loader.
3. Severity: Medium. Current user bot pages are entitlement-gated before user config reads, and the resolved default loader must preserve that order. Evidence: `loadBot()` calls `requireUser()` and `botAccessForUser()` at `apps/web/src/features/bots/data.tsx:27` to `apps/web/src/features/bots/data.tsx:32`; normal users fall through to `accessFor()` at `apps/web/src/lib/access.ts:10` to `apps/web/src/lib/access.ts:15`; settings stops on `BotAccessRequired` before loading config at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:142` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:147`; setup stops before loading config at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:138` to `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:160`; config export checks access at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:12` to `apps/web/src/app/api/bots/[bot]/config-export/route.ts:18`. Recommendation: never fetch or render global defaults for an unentitled user. Target part: resolved-config loader call sites.
4. Severity: Info. Admin system defaults are separated from user settings and do not mutate selected-user bot configs in the inspected code. Evidence: admin global action uses `saveBotGlobalConfig`, not `persistBotConfig`, at `apps/web/src/features/admin/actions.ts:492` to `apps/web/src/features/admin/actions.ts:539`; repository tests assert no user bot instances/configs are created at `tests/integration/admin-global-bot-config-db.test.ts:95` to `tests/integration/admin-global-bot-config-db.test.ts:135`; selected-user bot detail is `requireUser()` + `assertAdmin()` and read-only at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:41` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:64`; static tests prohibit global edit controls there at `tests/integration/admin-global-bot-config-static.test.ts:115` to `tests/integration/admin-global-bot-config-static.test.ts:121`. Recommendation: keep admin default publishing and user override editing as separate actions and routes. Target part: admin/user bot settings boundary.
5. Severity: Info. The admin global-default write path rejects secret/provider/raw-runtime/live-control keys before persistence, and audit rows record metadata only. Evidence: forbidden keys include `apikey`, `apisecret`, `token`, `providerpubid`, `provideraccountid`, `rawjson`, `applyconfig`, `start`, `stop`, `restart`, `retest`, and `testexchange` at `apps/web/src/features/admin/actions.ts:431` to `apps/web/src/features/admin/actions.ts:464`; recursive checks run before and after Zod parsing at `apps/web/src/features/admin/actions.ts:470` to `apps/web/src/features/admin/actions.ts:523`; audit payload uses metadata-only before/after at `packages/db/src/repositories.ts:1955` to `packages/db/src/repositories.ts:1963`; DB tests assert audit rows omit raw config and provider fields at `tests/integration/admin-global-bot-config-db.test.ts:183` to `tests/integration/admin-global-bot-config-db.test.ts:192`. Recommendation: reuse the same sanitizer/forbidden-key expectations for any future import, seed, or resolver fixture. Target part: defaults persistence and audit safety.
6. Severity: Medium. `config-export` can still fall back to sanitized Legacy live runtime config when no saved WTC user config exists. This is not a global-default leak today, but it must not become the resolved-default source. Evidence: export route passes `state.current ?? liveConfig` at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:16` to `apps/web/src/app/api/bots/[bot]/config-export/route.ts:27`; export sanitizer removes Legacy `providerPubId` at `apps/web/src/features/bots/config.ts:648` to `apps/web/src/features/bots/config.ts:653` and warns "No exchange keys" / "No live apply token" at `apps/web/src/features/bots/config.ts:675` to `apps/web/src/features/bots/config.ts:704`. Recommendation: after resolved defaults are implemented, make exports use the resolved WTC config source explicitly and keep runtime snapshots display-only. Target part: config export/read-model boundary.
7. Severity: Info. No live apply/test/start/stop behavior was found in the inspected default/user settings paths. Evidence: admin defaults page states live control disabled and entitlement source preserved at `apps/web/src/app/admin/bots/config/page.tsx:275` to `apps/web/src/app/admin/bots/config/page.tsx:280`; settings copy says live exchange apply and connection testing remain disabled at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:377` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:381`; setup copy says WTC intent is never applied live at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:349` to `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:363`; static tests reject adapter/control calls at `tests/integration/admin-global-bot-config-static.test.ts:36` to `tests/integration/admin-global-bot-config-static.test.ts:42`. Recommendation: resolved-config implementation must not import adapters, worker tick helpers, provider probes, or control functions. Target part: user config pages and API routes.

## Decisions
1. Current code is safe because user pages do not yet consume `bot_global_configs`; it is not acceptable as a completed user-facing resolved-default feature.
2. A user-facing resolver must be entitlement-first and published-only.
3. `getBotGlobalConfig()` should remain admin/internal unless wrapped by a stricter published+applies helper.
4. User override state remains user-owned in `bot_configs`; admin-owned defaults remain in `bot_global_configs`.
5. Runtime snapshots may be displayed as evidence, but must not be silently promoted into default inheritance.
6. No N-agent or background-agent audit claim is made for this handoff.

## Risks
1. A future implementer could call `getBotGlobalConfig()` directly from user pages and accidentally show draft/archived or non-inheriting defaults.
2. If the resolver is called before `access.allowed`, unentitled users could observe strategy defaults even while bot data is blocked.
3. Legacy runtime fallback in config export can confuse source-of-truth semantics if it is reused for resolved defaults.
4. Static tests cover many guardrails, but there is not yet a resolver-specific DB test proving user override -> published default -> built-in fallback precedence.
5. The repo has a large pre-existing dirty tree on `codex/bot-analytics-settings-canary-20260603`; this audit did not attempt to classify unrelated dirty files beyond the inspected scope.

## Verification/tests
RUN in this audit:
1. Source inspection only through `rg`, `Get-Content`, and targeted line-number reads.
2. `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with pre-existing dirty files.

NOT RUN in this audit:
1. `npm test` - not run; read-only audit, no implementation changes to validate.
2. `npx vitest ...` focused suites - not run; this handoff specifies required tests for the implementation session.
3. `npm run typecheck`, `npm run lint`, `npm run secret:scan`, `npm run build -w @wtc/web`, Playwright, and visual evidence - not run; no code/test changes and no live/browser acceptance requested.
4. DB migration apply/seed, worker tick/restart, provider DB reads/writes, exchange ping/test, SSH, tmux, systemd, `.env` reads/writes, live apply/start/stop/retest - forbidden by scope and not run.

Required tests before accepting Phase 3.77 implementation:
1. Add resolver DB tests proving:
   - user override wins over system default
   - only `status = 'published'` and `appliesToNewUsers = true` defaults are inherited
   - draft, archived, and `appliesToNewUsers = false` rows are ignored
   - built-in defaults remain fallback when no published row exists
   - reading defaults creates no `bot_instances`, `bot_configs`, or `bot_config_versions`
2. Add static/source tests proving user pages call the resolver only after `requireUser()` + `botAccessForUser()` / `access.allowed`.
3. Add negative tests for unentitled users: settings/setup/export render `BotAccessRequired` or 403 without showing system-default config.
4. Extend `admin-global-bot-config-static.test.ts` or add resolver tests proving no `getBotAdapter`, `applyConfig`, `startBot`, `stopBot`, `testExchange`, worker tick, provider probe, or env/live-service import enters the resolver path.
5. Extend secret/provider tests proving resolved user views and exports do not serialize `apiKey`, `apiSecret`, `secret`, `token`, `providerPubId`, `providerAccountId`, `rawJson`, sealed vault fields, runtime URLs, or live-control fields.
6. Required command set after implementation:
   - `npx vitest run tests/integration/admin-global-bot-config-db.test.ts tests/integration/admin-global-bot-config-static.test.ts`
   - `npx vitest run tests/integration/bot-config-export-static.test.ts tests/integration/bot-read-safety-static.test.ts`
   - new resolver DB/static tests
   - `npm run typecheck -w @wtc/web`
   - `npm run lint`
   - `npm run secret:scan`
   - `npm run governance:check`
   - `git diff --check`
   - scoped Playwright/mobile smoke only if user-facing UI changes are made

Stop conditions for the implementation session:
1. STOP if agent/process protocol for a broad implementation phase cannot be satisfied.
2. STOP if there is no dedicated published-only resolver or helper; do not use broad `getBotGlobalConfig()` directly on user pages.
3. STOP if a global default can render before entitlement is verified.
4. STOP if admin pages/actions can mutate selected-user `bot_configs` while publishing system defaults.
5. STOP if any default/resolved payload can contain provider ids, secrets, sealed vault fields, raw runtime JSON, runtime URLs, or live-control keys.
6. STOP if any route/action imports or calls live adapter/control/test/start/stop/apply/worker/provider functionality.
7. STOP if required tests need live services, live DB credentials, `.env` secrets, exchange connectivity, SSH, tmux, systemd, or worker mutation.

## Next actions
1. Implement a dedicated resolved-config model with source labels: `user_override`, `published_system_default`, `built_in_default`.
2. Add a published-only DB helper or resolver filter for `bot_global_configs`.
3. Wire settings/setup/config-export to the resolver only after entitlement checks.
4. Add the required tests above before claiming Phase 3.77 acceptance.
5. Keep the aggregate Phase 3.77 report honest: list this handoff path, gates run, gates not run, and no background-agent closure claim unless agents actually exist.
