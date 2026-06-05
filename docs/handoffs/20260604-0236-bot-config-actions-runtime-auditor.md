# bot-config-actions-runtime-auditor handoff
## Scope
Read-only Phase 3.90 audit of settings/setup/admin global bot config save flows. Focus was minimal runtime/action acceptance coverage for locked-default save rejection, forbidden-field rejection/error behavior, invalid user override fallback/sourceIssue, and no live apply/start/stop.

No product code, tests, live bots/workers, provider DB, exchange ping, `.env`, vault, SSH, tmux, systemd, or live server state was modified or queried. This is a per-agent auditor handoff, not an aggregate phase handoff.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0235-phase-3-89-bot-config-source-audit-hardening.md`
8. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
9. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
10. `apps/web/src/features/bots/config.ts`
11. `apps/web/src/features/admin/actions.ts`
12. `apps/web/src/features/admin/schemas.ts`
13. `packages/db/src/repositories.ts`
14. `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
15. `apps/web/src/lib/backend.ts`
16. `apps/web/src/lib/db-store.ts`
17. `vitest.config.ts`
18. `package.json`
19. `tests/integration/admin-global-bot-config-db.test.ts`
20. `tests/integration/user-resolved-bot-config-db.test.ts`
21. `tests/integration/admin-global-bot-config-static.test.ts`
22. `tests/integration/user-resolved-bot-config-static.test.ts`
23. `tests/integration/bot-config-source-audit-static.test.ts`
24. `tests/integration/bot-config-export-static.test.ts`
25. `tests/integration/bot-read-safety-static.test.ts`
26. `tests/integration/lms-rbac-pipeline.test.ts`
27. `tests/integration/csrf-coverage.test.ts`
28. `tests/integration/lms-material-download-handler.test.ts`
29. `tests/integration/axioma-download-handler.test.ts`
30. `packages/bot-adapters/src/adapters.test.ts`
31. `tests/e2e/bot-settings.spec.ts`

## Files changed
None - read-only audit, except this required handoff: `docs/handoffs/20260604-0236-bot-config-actions-runtime-auditor.md`.

## Findings
1. Severity: High. Locked-default rejection exists in the runtime path, but it is not directly action-tested. Evidence: `persistBotConfig` validates the candidate config, loads the published default, and throws `bot_config_override_disabled` when `allowUserOverride` is false at `apps/web/src/features/bots/config.ts:1033`; the settings action maps that error to `/settings?err=locked` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:102`; the setup action maps it to `/setup?step=strategy&err=locked` at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:110`; the UI disables customization when locked at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:351` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:409`. Recommendation: add a PGlite-backed action/helper test that publishes a locked system default, invokes the settings and setup save paths with valid form data, expects the locked redirect/error contract, and asserts no `bot_instances`, `bot_configs`, `bot_config_versions`, or `audit_logs` rows were created by the rejected save. Target part: user settings/setup save actions.
2. Severity: High. Forbidden-field protection is strong below the action layer and on admin global form keys, but user settings/setup do not currently have an admin-equivalent form-key scan to prove rejection/error behavior for malicious extra FormData keys. Evidence: admin global scans every form key before parsing at `apps/web/src/features/admin/actions.ts:484` and scans parsed config before saving at `apps/web/src/features/admin/actions.ts:522`; the admin schema is strict at `apps/web/src/features/admin/schemas.ts:124`; the shared DB guard rejects forbidden keys at `packages/db/src/repositories.ts:544`, and both `saveBotGlobalConfig` and `saveBotConfig` call it at `packages/db/src/repositories.ts:2087` and `packages/db/src/repositories.ts:2176`; user config objects are guarded by `safeUserBotConfigForProduct` at `apps/web/src/features/bots/config.ts:839`; settings/setup save actions currently project form fields through `botConfigFormInput` and call `persistBotConfig` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:98` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:106`. Existing proof is repository/static only: `tests/integration/admin-global-bot-config-db.test.ts:181`, `tests/integration/admin-global-bot-config-static.test.ts:55`, and `tests/integration/bot-config-source-audit-static.test.ts:42`. Recommendation: if acceptance requires error behavior, extract a shared `assertNoForbiddenBotConfigFormKeys(formData)` and call it from settings, setup, and admin global saves; then test `apiKey`, `providerAccountId`, `rawJson`, `applyConfig`, `startBot`, and `stopBot` FormData cases for rejection and no writes. If the intended user action behavior is to ignore extra keys, document that explicitly and test non-persistence instead of rejection. Target part: admin global and user save action boundary.
3. Severity: High. Invalid user override fallback/sourceIssue is implemented but lacks DB runtime coverage. Evidence: invalid custom configs are converted to `Saved custom profile failed validation` at `apps/web/src/features/bots/config.ts:931`; `loadBotConfig` parses the current user config, falls back to system default or built-in, and attaches `sourceIssue` at `apps/web/src/features/bots/config.ts:1004` and `apps/web/src/features/bots/config.ts:1019`; settings and setup render the issue at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:286` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:290`. Existing DB coverage checks inheritance and valid overrides only at `tests/integration/user-resolved-bot-config-db.test.ts:102` and `tests/integration/user-resolved-bot-config-db.test.ts:170`. Recommendation: extract or inject the DB resolver behind `loadBotConfig` so a PGlite test can seed an invalid, non-forbidden `bot_configs.config` row, publish a valid system default, and assert `source='system_default'`, `current` equals the default, `userCurrent=null`, `version` remains visible, and `sourceIssue.kind='error'`; repeat without a published default to assert built-in fallback. Target part: resolved config source runtime.
4. Severity: Medium. No live apply/start/stop is currently supported by static UI guards, forbidden-key lists, and adapter tests, but the action acceptance should still lock this down around the new save helpers. Evidence: settings states "no live apply, start, stop, or retest" at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:281` and export copy says no live apply at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:443`; setup says live apply/start/stop stay disabled at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:272` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:528`; forbidden lists include live-control keys at `apps/web/src/features/bots/config.ts:811` and `packages/db/src/repositories.ts:530`; adapter tests prove start/stop/apply throw at `packages/bot-adapters/src/adapters.test.ts:26`; static action checks assert metadata actions do not call adapter/fetch/live control at `tests/integration/bot-read-safety-static.test.ts:329`. Recommendation: add a guard in the new action-runtime test that fails if the action helper imports/calls `getBotAdapter`, `fetch`, `vault.open`, live provider envs, `startBot`, `stopBot`, `applyConfig`, `restart`, `retest`, or exchange test paths; pair it with the forbidden FormData cases above. Target part: no-live-control safety.
5. Severity: Medium. Existing test structure explains why this gap survived: app server actions are mostly statically checked, while importable route-handler helpers get real runtime tests. Evidence: root Vitest includes `packages/**/*.test.ts` and `tests/integration/**/*.test.ts` but excludes `apps/web/**` at `vitest.config.ts:8`; the LMS action test says Next request context prevents direct node execution at `tests/integration/lms-rbac-pipeline.test.ts:6`; a dependency-injected runtime handler pattern exists in `tests/integration/lms-material-download-handler.test.ts:69`; settings/setup actions are private page-local functions at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:89` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:97`, while admin global is exported from a feature module at `apps/web/src/features/admin/actions.ts:492`. Recommendation: move bot config save/preset/use-system-default behavior into an exported, dependency-injected helper such as `apps/web/src/features/bots/config-action-handlers.ts`, keep page actions as thin wrappers that handle `redirect`/`revalidatePath`, and test the helpers with PGlite plus mocked `requireUser`, access decisions, redirect/revalidate sinks, and no-live spies. Target part: server-action test harness.

## Decisions
1. This auditor made no product-code changes and did not run any live or provider-facing commands.
2. Minimal acceptance should be runtime/helper-level Vitest with PGlite, not Playwright or live Next, because the desired proof is mutation behavior, redirects/errors, and no-write invariants.
3. Locked-default save rejection should be accepted only if rejected saves leave no bot instance/config/version/audit writes.
4. Forbidden-field acceptance must choose and document one user-action contract: reject malicious extra form keys, or ignore them and prove non-persistence. The admin global contract already rejects extra forbidden form keys.
5. Invalid saved user overrides should remain visible as a non-green `sourceIssue` while the effective config falls back to the published default or built-in default.

## Risks
1. Static tests can stay green while redirect/error behavior in the actual action wrapper changes.
2. Private page-local actions make direct action runtime tests awkward unless the flow is extracted or exported.
3. The worktree was already heavily dirty on branch `codex/bot-analytics-settings-canary-20260603`; this audit did not normalize or revert any pre-existing changes.
4. Adding a user form-key rejection guard may be a behavior change if the intended contract was silent dropping of unknown FormData keys.

## Verification/tests
RUN:
1. Required docs/protocol files read: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260604-0235-phase-3-89-bot-config-source-audit-hardening.md`.
2. `git status --short --branch` inspected current branch and dirty state.
3. Read-only source inspection with `rg` and line-numbered `Get-Content` excerpts over the requested focus files and existing harness patterns.
4. Confirmed target handoff did not exist before writing.

NOT RUN:
1. No product-code tests, typecheck, lint, build, Playwright, preview, worker tick, worker smoke, or full gate suite. Reason: read-only auditor scope requested evidence and one handoff only.
2. No live bot start/stop/apply-config/retest, worker restart, provider DB, exchange ping, `.env`, vault/secret inspection, SSH, tmux, systemd, or live server mutation. Reason: explicitly forbidden by scope and WTC safety gates.
3. No background agents were spawned by this auditor; none are left running from this auditor lane.

## Next actions
1. Add `apps/web/src/features/bots/config-action-handlers.ts` with exported, dependency-injected helpers for settings/setup save, preset apply, and use-system-default. Page actions should stay thin wrappers for CSRF, user/access, redirect, and revalidate.
2. Add `tests/integration/bot-config-actions-runtime.test.ts` using PGlite migrations + seed. Cover locked default rejection for settings and setup, valid saves, forbidden key rejection/no-write cases, and invalid saved override fallback/sourceIssue.
3. Add or clarify user forbidden-form-key behavior. Preferred safety path: shared form-key guard used by settings/setup/admin global save flows, with runtime tests for `apiKey`, `providerAccountId`, `rawJson`, `applyConfig`, `startBot`, and `stopBot`.
4. Extend `tests/integration/user-resolved-bot-config-db.test.ts` or the new runtime test to seed an invalid, non-forbidden saved config row and assert fallback/sourceIssue semantics.
5. After the focused runtime tests land, run only the scoped gates first: `npx vitest run tests/integration/bot-config-actions-runtime.test.ts tests/integration/admin-global-bot-config-db.test.ts tests/integration/user-resolved-bot-config-db.test.ts`, then `npm run typecheck -w @wtc/web`, root `npm run typecheck`, and `npm run secret:scan`. Keep live bot/workers/provider/exchange gates NOT RUN unless a later phase explicitly authorizes them.
