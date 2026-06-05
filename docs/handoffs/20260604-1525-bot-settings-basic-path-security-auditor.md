# bot-settings-basic-path-security-auditor handoff
## Scope
Phase 4.21 read-only security/runtime audit before edits for the proposed settings first-viewport/basic-path slice.

Audit scope: settings page/actions, config action handler, config schemas, config export handler, readiness/continuity surfaces, admin/read-only separation, and tests around CSRF/RBAC/entitlement, secret exposure, live bot control, user-owned settings, and export/copy safety.

Process scope: followed `AGENTS.md` and `docs/SESSION_PROTOCOL.md`; no background agents were launched from this auditor session. The repository was already heavily dirty before this audit; this handoff describes the current files observed in that dirty tree.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260604-1517-phase-4-20-bot-export-browser-failclosed.md`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/bots/config-action-handler.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/config-export-handler.ts`
- `apps/web/src/features/bots/config-export.ts`
- `apps/web/src/features/bots/config-review.ts`
- `apps/web/src/features/bots/config-error-copy.ts`
- `apps/web/src/features/bots/BotSetupControlCenter.tsx`
- `apps/web/src/features/bots/BotSettingsQuickPath.tsx`
- `apps/web/src/features/bots/BotOperationMapPanel.tsx`
- `apps/web/src/features/bots/BotReadinessMap.tsx`
- `apps/web/src/features/bots/BotContinuityPanel.tsx`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/features/bots/readiness-loader.ts`
- `apps/web/src/features/bots/continuity.ts`
- `apps/web/src/features/bots/runtime-config-sanitizer.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/admin/bots/config/page.tsx`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/bot-config-action-handler.test.ts`
- `tests/integration/bot-config-export-route-handler.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-runtime-config-sanitizer.test.ts`
- `tests/integration/bot-readiness-builder.test.ts`
- `tests/integration/bot-continuity-builder.test.ts`
- `tests/integration/bot-readiness-server-dto-static.test.ts`
- `tests/integration/bot-config-review-static.test.ts`
- `tests/integration/bot-config-source-audit-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-global-bot-config-static.test.ts`
- `tests/integration/admin-global-bot-config-db.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/e2e/bot-settings.spec.ts`

## Files changed
None — read-only audit

## Findings
1. Severity P1 - settings mutation boundary is present and should be reused. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:148` calls `assertCsrf` before `handleSaveBotConfigAction`; preset and system-default actions do the same at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:156` and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:164`. The shared handler resolves product/user/access before mutation at `apps/web/src/features/bots/config-action-handler.ts:123`, blocks secret/provider/raw/live-control form keys at `apps/web/src/features/bots/config-action-handler.ts:51`, and saves only after parse/persist at `apps/web/src/features/bots/config-action-handler.ts:159`. Recommendation: the basic-path form must post to these existing server actions/helpers and include `CsrfField`; do not introduce a client-side API or parallel server action. Target part: first-viewport save/preset/system-default controls.
2. Severity P1 - user-owned settings persistence is scoped and does not call live bot control. Evidence: user config rejects secret/provider/raw/live-control keys at `apps/web/src/features/bots/config.ts:839`, validates against the product schema at `apps/web/src/features/bots/config.ts:891`, creates/updates only the caller's bot instance at `apps/web/src/features/bots/config.ts:1085`, and the DB repository comment states WTC DB save is never forwarded to a live bot at `packages/db/src/repositories.ts:2178`. The audit log stores only version metadata at `packages/db/src/repositories.ts:2190`. Recommendation: basic-path edits must stay in `persistBotConfig`/`saveBotConfig` and must not call bot adapters, worker routes, `applyConfig`, start/stop, or provider/exchange live checks. Target part: user settings persistence.
3. Severity P1 - export endpoint is session/entitlement gated and payloads are secret-safe. Evidence: route injection uses `requireUser`, `botAccessForUser`, `loadBotConfig`, and user-scoped read model loading at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:7`; handler returns no-store security JSON for unauthenticated/denied users at `apps/web/src/features/bots/config-export-handler.ts:56` and attachment responses with no-store/nosniff/no-referrer at `apps/web/src/features/bots/config-export-handler.ts:80`. Export serialization states no keys/secrets/live-apply token at `apps/web/src/features/bots/config-export.ts:251`, and Legacy export strips `providerPubId` before JSON/native output at `apps/web/src/features/bots/config-export.ts:224`. Recommendation: first-viewport export/copy may link this route or copy a draft preview, but must not expose raw runtime config, provider account IDs, exchange keys, or live-apply tokens. Target part: export/copy safety.
4. Severity P2 - Legacy export UI blocking is weaker than the endpoint's exact-one mapping rule. Evidence: the settings page blocks Legacy export only when `legacyAccounts.length === 0` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:263` and renders the download link otherwise at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:550`. The export handler blocks Legacy export unless the safe read model has exactly one provider account at `apps/web/src/features/bots/config-export-handler.ts:45` and `apps/web/src/features/bots/config-export-handler.ts:76`; readiness already represents `ambiguous_mapping` as a blocked state in `tests/integration/bot-readiness-builder.test.ts:113`. Recommendation: before widening the first viewport, change UI gating to require `readiness.providerPubIdState === 'db_mapping_confirmed'` or equivalent exact-one active mapping, and add an ambiguous-mapping UI/API regression. Target part: Legacy settings export affordance.
5. Severity P1 - readiness/continuity preserve entitlement and no-live-control boundaries. Evidence: settings loads readiness with `includeOperationalRows: false` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:203`; readiness loader returns hidden data when entitlement fails at `apps/web/src/features/bots/readiness-loader.ts:126` and does not fetch runtime rows for settings at `apps/web/src/features/bots/readiness-loader.ts:165`. The readiness map labels live apply disabled and says saves never start/stop/apply config at `apps/web/src/features/bots/readiness.ts:212`. Continuity requires fresh real worker proof before green at `apps/web/src/features/bots/continuity.ts:57` and its control boundary says it never starts/stops/runs checks/applies config/opens secrets/calls live providers at `apps/web/src/features/bots/continuity.ts:177`. Recommendation: basic-path status cards should reuse these DTOs rather than inventing new green/ready states. Target part: first-viewport status and continuity cards.
6. Severity P1 - admin/read-only separation is currently preserved. Evidence: global bot defaults page is admin-gated at `apps/web/src/app/admin/bots/config/page.tsx:1` and posts through an admin action with `CsrfField` at `apps/web/src/app/admin/bots/config/page.tsx:133`; the action requires user/admin/CSRF, validates Zod/form/schema, rejects forbidden keys, and calls `saveBotGlobalConfig` at `apps/web/src/features/admin/actions.ts:496`. Selected-user bot detail is admin-gated and explicitly read-only at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:201`, with visible `LIVE CONTROL: DISABLED`, `user settings: read-only`, and `provider mappings: read-only` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:222`. Static tests assert the selected-user page does not contain `CsrfField` or submit controls at `tests/integration/admin-user-bot-detail-static.test.ts:120`. Recommendation: do not add personal setting edits or provider mapping mutations to selected-user admin drilldowns as part of the basic path. Target part: admin surfaces.
7. Severity P2 - tests cover the current workbench/helper/export/readiness paths, but the proposed first-viewport/basic-path needs its own acceptance guard once implemented. Evidence: helper tests reject forbidden hidden fields and no-write paths at `tests/integration/bot-config-action-handler.test.ts:154`; export route tests cover unauth/denied/Legacy blocked/no unsafe markers at `tests/integration/bot-config-export-route-handler.test.ts:142`; browser settings tests cover current export headers/body and no live-control text at `tests/e2e/bot-settings.spec.ts:142` and `tests/e2e/bot-settings.spec.ts:268`. Recommendation: add a focused static or E2E gate for any new basic-path form proving `CsrfField`, existing handler usage, forbidden hidden-field rejection, no live-control strings, and exact-one Legacy export UI gating. Target part: tests for new basic path.

## Decisions
- No background agents were launched from this auditor session, per the user's explicit instruction.
- No code edits, schema edits, migrations, tests, builds, DB actions, browser sessions, or live runtime probes were run.
- Treated Phase 4.20's export browser fail-closed handoff as the immediate prior context, especially its deferred first-viewport/basic settings path and clipboard proof.
- Treated the only requested write as this handoff file; all source/test inspection was read-only.
- Did not claim any test gate green in this session because none were executed in this session.

## Risks
- This is a static/read-only audit over an already dirty worktree; it does not prove the dirty tree currently builds or passes tests.
- The Legacy export endpoint is fail-closed, but the UI can still offer the export link in an ambiguous two-provider-account state until finding 4 is fixed.
- First-viewport/basic-path code was not implemented yet in this auditor session; future implementation can regress CSRF/RBAC/export/copy safety unless it is forced through the existing helpers and tests.
- Clipboard behavior was not browser-proved in this session; existing coverage inspects current copy/export text and payload safety, not a rendered clipboard permission/fallback flow.
- Admin selected-user DB matrix and worker continuity are outside this audit and remain unclaimed here.

## Verification/tests
RUN:
- Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and latest phase handoff context.
- `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` and a heavily dirty worktree before this audit.
- Read-only `Get-Content`/line inspection over the files listed in `## Files inspected`.
- Read-only `Select-String` searches over settings/export/admin/readiness/test files for CSRF, RBAC, entitlement, secret/provider/raw/live-control strings, export/copy, and read-only admin evidence.
- `Test-Path docs/handoffs/20260604-1525-bot-settings-basic-path-security-auditor.md` - confirmed the target handoff did not exist before writing.

NOT RUN:
- `npx vitest run tests/integration/bot-config-action-handler.test.ts tests/integration/bot-config-export-route-handler.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts tests/integration/bot-readiness-builder.test.ts tests/integration/bot-continuity-builder.test.ts` - not run by read-only auditor scope.
- `npx playwright test tests/e2e/bot-settings.spec.ts` - not run by read-only auditor scope.
- `npm run typecheck -w @wtc/web` - not run by read-only auditor scope.
- `node scripts/gates.mjs quick`, `node scripts/gates.mjs core`, `node scripts/gates.mjs full`, `npm run ci:local` - not run by read-only auditor scope.
- `npm run secret:scan` and `npm run governance:check` - not run by read-only auditor scope.
- `npm run db:generate`, `npm run db:migrate`, `npm run db:seed` - not run; DB/schema mutation is outside this read-only audit.
- `npm run build -w @wtc/web` - not run by read-only auditor scope.
- `npm run e2e:admin-user-bots:db:managed`, `npm run e2e:admin-user-bots:db:managed:matrix`, `npm run accept:worker:continuity` - not run; require dedicated disposable DB/worker acceptance scope.
- Browser automation, screenshots, clipboard permission/stub proof, rendered-link download proof - not run by read-only auditor scope.
- Live bot start/stop/apply-config, live exchange/provider calls, raw env/secret reads, SSH/tmux/systemd/deploy actions - not run by non-negotiable safety policy.
- Background agents - not launched from this auditor session.

## Next actions
1. Fix Legacy export UI gating to match the endpoint's exact-one active mapped provider account rule before widening the settings first viewport.
2. Build the basic-path form by reusing the current server actions/shared handler and `CsrfField`; do not add a new mutation route.
3. Add focused static/E2E coverage for the new first-viewport path: CSRF present, handler reuse, forbidden hidden fields rejected, no live-control strings, export/copy payloads safe, and ambiguous Legacy mapping blocked.
4. Keep admin selected-user bot drilldowns read-only; route any admin system-default work only through the existing admin defaults page/action.
5. Continue to defer live bot control, live exchange/provider checks, and live config apply until a separate audited adapter/control phase authorizes them.
