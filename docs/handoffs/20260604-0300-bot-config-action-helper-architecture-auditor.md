# bot-config-action-helper-architecture-auditor handoff
## Scope
Phase 3.91 read-only architecture audit for extracting the settings/setup bot config server-action logic into dependency-injected helpers. Scope was limited to save custom config, apply preset, and use system default for `settings` and `setup`, plus adjacent config helpers and the existing config-export handler pattern.

No product code, tests, package files, migrations, env, vault, live services, SSH/tmux/systemd, provider DB, worker, or bot state were edited or mutated. No live bot start/stop/apply-config/retest, exchange ping, provider/network mutation, worker tick/restart, or secret inspection was performed.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/handoffs/20260604-0254-phase-3-90-bot-config-runtime-export-acceptance.md`
5. `docs/handoffs/20260604-0236-bot-config-actions-runtime-auditor.md`
6. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
7. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
8. `apps/web/src/features/bots/config.ts`
9. `apps/web/src/features/bots/meta.ts`
10. `apps/web/src/features/bots/config-export-handler.ts`
11. `apps/web/src/features/bots/config-export.ts`
12. `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
13. `apps/web/src/features/admin/actions.ts`
14. `vitest.config.ts`
15. `tests/integration/bot-config-export-route-handler.test.ts`
16. `tests/integration/bot-config-source-audit-static.test.ts`
17. `tests/integration/user-resolved-bot-config-static.test.ts`
18. `tests/integration/user-resolved-bot-config-db.test.ts`
19. `tests/integration/admin-global-bot-config-db.test.ts`
20. `tests/integration/db-0002.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. The settings/setup action logic is duplicated and page-local, so root Vitest cannot runtime-test the actual save/preset/default contracts. Evidence: settings defines `saveBotConfigAction`, `applyBotPresetAction`, and `useSystemDefaultAction` inline at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:89`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:111`, and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:134`; setup repeats the same three shapes as `wizardSaveConfig`, `wizardApplyPreset`, and `wizardUseSystemDefault` at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:97`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:119`, and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:142`. The accepted export slice uses the opposite shape: a typed dependency object at `apps/web/src/features/bots/config-export-handler.ts:20` and one runtime-tested handler at `apps/web/src/features/bots/config-export-handler.ts:40`, with the route reduced to a wrapper at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:7`. Recommendation: create a new importable helper module, preferably `apps/web/src/features/bots/config-action-handlers.ts`, and leave the page actions as thin wrappers for CSRF, `requireUser`, Next redirect/revalidate application, and dependency wiring. Target part: settings/setup server-action runtime architecture.

2. Severity: High. A direct helper import from `apps/web/src/features/bots/config.ts` would drag `server-only` and backend DB wiring into root Vitest. Evidence: `config.ts` starts with `import 'server-only'` and imports `getServerDb` at `apps/web/src/features/bots/config.ts:1` and `apps/web/src/features/bots/config.ts:3`; root Vitest discovers `tests/integration/**/*.test.ts` while excluding only test files under `apps/web/**` at `vitest.config.ts:8` and `vitest.config.ts:9`; the working export runtime test imports the server-only-free handler directly from app source at `tests/integration/bot-config-export-route-handler.test.ts:3`. Recommendation: keep the action helper free of `server-only`, `@/lib/backend`, `@/lib/session`, `next/cache`, and `next/navigation`. Either inject form/preset parsing dependencies from the wrapper, or extract the pure schemas/form builders/presets from `config.ts` into a server-only-free module such as `apps/web/src/features/bots/config-input.ts`, then have `config.ts` re-export them. Target part: root Vitest helper boundary.

3. Severity: Medium. The current user save actions silently project known fields and rely on lower guards; they do not have an admin-equivalent forbidden FormData key scan. Evidence: settings calls `botConfigFormIssues`, `botConfigFormInput`, and `persistBotConfig` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:98`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:100`, and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:103`; setup does the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:106`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:108`, and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:111`. `botConfigFormInput` only builds from the expected field names at `apps/web/src/features/bots/config.ts:365`; forbidden config-object keys are checked later at `apps/web/src/features/bots/config.ts:696` and `apps/web/src/features/bots/config.ts:734`; admin global config already scans every form key before parsing at `apps/web/src/features/admin/actions.ts:484` and `apps/web/src/features/admin/actions.ts:496`. Recommendation: decide the user-action contract before implementation. Preferred safety contract: add a pure `findForbiddenBotConfigFormKeys(formData)` or `assertNoForbiddenBotConfigFormKeys(formData)` used by settings, setup, and admin global saves; test `apiKey`, `apiSecret`, `providerAccountId`, `rawJson`, `liveConfig`, `headers`, `applyConfig`, `startBot`, `stopBot`, and `retest` as rejected with no writes. If the chosen contract is "ignore unknown extras", document it and test non-persistence explicitly. Target part: malicious hidden-field action boundary.

4. Severity: Medium. Settings and setup have surface-specific action outcomes that must be preserved explicitly during extraction. Evidence: settings invalid/missing preset currently returns quietly at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:121` and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:124`, while setup redirects to `?step=strategy&err=config` at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:129` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:132`; successful settings saves revalidate the settings page at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:108`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:131`, and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:145`, while successful setup saves redirect to review at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:116`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:139`, and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:153`. Recommendation: make `surface: 'settings' | 'setup'` part of the helper input and return a typed outcome (`noop`, `redirect`, or `revalidate`) instead of letting each wrapper re-create the branching ad hoc. Target part: action extraction compatibility.

5. Severity: Medium. The next runtime acceptance needs to cover locked defaults, use-system-default selection markers, invalid saved override fallback/sourceIssue, and no-live-control guarantees, not only "helper was called". Evidence: locked-default rejection is thrown in `persistBotConfig` at `apps/web/src/features/bots/config.ts:955`; use-system-default saves a marker object rather than raw copied config through `systemDefaultSelectionConfig` at `apps/web/src/features/bots/config.ts:764` and `selectSystemDefaultBotConfig` at `apps/web/src/features/bots/config.ts:961`; invalid user configs fall back while retaining `sourceIssue` at `apps/web/src/features/bots/config.ts:913` and `apps/web/src/features/bots/config.ts:936`; repository forbidden-key no-write coverage exists at `tests/integration/db-0002.test.ts:69`, while current source/action coverage is mostly static at `tests/integration/bot-config-source-audit-static.test.ts:42` and `tests/integration/user-resolved-bot-config-static.test.ts:37`. Recommendation: add `tests/integration/bot-config-actions-runtime.test.ts` against the extracted helpers, with PGlite or injected repository-backed deps where needed, and assert exact no-write counts for `bot_instances`, `bot_configs`, `bot_config_versions`, and `audit_logs` on rejected saves. Target part: runtime acceptance gates for settings/setup actions.

## Decisions
1. Minimal helper shape should mirror the export handler pattern but return action outcomes instead of `Response` objects. Suggested server-only-free signatures:

```ts
export type BotConfigActionSurface = 'settings' | 'setup';
export type BotConfigActionOutcome =
  | { kind: 'noop'; reason: 'bot_not_found' | 'access_denied' | 'missing_preset' | 'invalid_preset' }
  | { kind: 'redirect'; href: string }
  | { kind: 'revalidate'; path: string };

export interface BotConfigActionDeps {
  accessForUser(user: BotConfigActionUser, productCode: BotProductCode): Promise<AccessDecision>;
  parseFormConfig(productCode: BotProductCode, formData: FormData): { ok: true; config: Record<string, unknown> } | { ok: false; issues: string[] };
  parsePresetConfig(productCode: BotProductCode, presetId: string): { ok: true; presetId: string; config: Record<string, unknown> } | { ok: false; reason: 'missing' | 'invalid' };
  persistConfig(userId: string, productCode: BotProductCode, config: Record<string, unknown>, note: string): Promise<'saved' | 'demo'>;
  selectSystemDefaultConfig(userId: string, productCode: BotProductCode): Promise<'saved' | 'unavailable'>;
  findForbiddenFormKeys?: (formData: FormData) => string[];
}

export async function handleSaveCustomBotConfig(input: { surface: BotConfigActionSurface; slug: string; user: BotConfigActionUser; formData: FormData; deps: BotConfigActionDeps }): Promise<BotConfigActionOutcome>;
export async function handleApplyBotConfigPreset(input: { surface: BotConfigActionSurface; slug: string; user: BotConfigActionUser; formData: FormData; deps: BotConfigActionDeps }): Promise<BotConfigActionOutcome>;
export async function handleUseSystemDefaultBotConfig(input: { surface: BotConfigActionSurface; slug: string; user: BotConfigActionUser; formData: FormData; deps: Pick<BotConfigActionDeps, 'accessForUser' | 'selectSystemDefaultConfig'> }): Promise<BotConfigActionOutcome>;
```

2. Page wrappers should continue to call `assertCsrf(formData)` and `requireUser()` before invoking the helper, then translate helper outcomes to `redirect()` or `revalidatePath()` locally.
3. Do not import `persistBotConfig`, `selectSystemDefaultBotConfig`, `botConfigFormInput`, `botConfigFormIssues`, `botConfigSchemaFor`, or `botConfigPresetFor` from `config.ts` inside the helper unless those pure pieces are first moved out of the `server-only` module.
4. If PGlite tests must exercise production persistence rather than a fake `persistConfig`, add a small server-only-free DB helper module and let `config.ts` remain the `getServerDb()` facade.
5. This auditor did not choose between "reject malicious extra FormData keys" and "ignore extras"; the implementation phase should choose explicitly before tests are written. The safer acceptance path is rejection.

## Risks
1. Importing `config.ts` from `config-action-handlers.ts` will likely reproduce the root Vitest `server-only` trap and undermine the whole runtime-test goal.
2. A helper that only uses mocked parse/persist deps can prove action branching but not real form projection or DB no-write invariants; pair it with either pure parser tests or PGlite-backed persistence tests.
3. Adding form-key rejection may be a user-visible behavior change from the current silent-drop behavior for unknown extra fields.
4. If the extraction normalizes settings/setup behavior without an explicit surface map, it may accidentally change invalid-preset, locked-default, and success navigation semantics.
5. The worktree was already heavily dirty on branch `codex/bot-analytics-settings-canary-20260603`; this audit did not normalize, stage, revert, or edit any pre-existing changes.

## Verification/tests
RUN:
1. Required protocol docs read before code inspection: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, and `docs/handoffs/20260604-0254-phase-3-90-bot-config-runtime-export-acceptance.md`.
2. `git status --short --branch` inspected branch and dirty state.
3. Read-only line-numbered source inspection of settings, setup, config helpers, metadata, export handler, export route, admin action guard pattern, and relevant integration/static tests.
4. Confirmed `docs/handoffs/20260604-0300-bot-config-action-helper-architecture-auditor.md` did not exist before this required handoff was written.

NOT RUN:
1. Product-code tests, typecheck, lint, build, Playwright, preview/browser checks, worker tick, worker smoke, or full gate suite. Reason: this lane is read-only architecture audit plus one handoff artifact.
2. Live bot start/stop/apply-config/retest, worker restart, provider DB access, exchange ping, `.env`, vault/secret inspection, SSH, tmux, systemd, or live server mutation. Reason: explicitly forbidden by scope and WTC safety protocol.
3. No background agents were spawned by this auditor lane; none are left running from this lane.

## Next actions
1. Add `apps/web/src/features/bots/config-action-handlers.ts` using the server-only-free dependency-injected signatures above.
2. Either extract pure config input/preset helpers from `config.ts` into a server-only-free module, or inject parser functions from the page wrappers and cover wrapper wiring with static guards.
3. Add `tests/integration/bot-config-actions-runtime.test.ts` for settings and setup save custom config, apply preset, and use system default. Cover allowed, denied, unknown bot, invalid config, invalid/missing preset, locked default, system default unavailable, and success destinations.
4. Add malicious FormData cases for `apiKey`, `apiSecret`, `providerAccountId`, `rawJson`, `liveConfig`, `headers`, `applyConfig`, `startBot`, `stopBot`, and `retest`; assert the chosen contract and no DB/audit/config history writes.
5. Extend DB/runtime coverage for invalid non-forbidden saved override fallback/sourceIssue and for use-system-default marker persistence, including no raw system config copy in the user current config.
6. After implementation, run the scoped non-live gates first: `npx vitest run tests/integration/bot-config-actions-runtime.test.ts tests/integration/admin-global-bot-config-db.test.ts tests/integration/user-resolved-bot-config-db.test.ts`, then `npm run typecheck -w @wtc/web`, root `npm run typecheck`, `npm run secret:scan`, and `npm run governance:check`.
