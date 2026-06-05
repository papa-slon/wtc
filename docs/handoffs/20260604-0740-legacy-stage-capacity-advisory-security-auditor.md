# legacy-stage-capacity-advisory-security-auditor handoff
## Scope
Phase 4.03 read-only security/data-boundary audit for adding a Legacy over-capacity advisory to the top bot setup control center.

Inspected Legacy stage usage/capacity logic, `BotSetupControlCenter`, user bot settings/setup pages, readiness/runtime boundaries, and focused tests. The audit question was whether surfacing over-capacity at the top control center could expose provider IDs, exchange secrets, raw worker/provider runtime data, imply live bot control/connectivity, mutate settings, or confuse user/admin boundaries.

No product code was edited by this auditor. No live bot services, SSH, tmux, systemd, worker tick/restart, env/vault/secret file inspection, provider DB mutation, live exchange ping, live bot start/stop/apply/retest/control, or position action was run.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0729-phase-4-02-bot-validation-focus.md`
8. `docs/handoffs/20260604-0723-bot-validation-focus-security-auditor.md`
9. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
10. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
11. `apps/web/src/features/bots/config-types.ts`
12. `apps/web/src/features/bots/config.ts`
13. `apps/web/src/features/bots/config-review.ts`
14. `apps/web/src/features/bots/config-error-copy.ts`
15. `apps/web/src/features/bots/config-action-handler.ts`
16. `apps/web/src/features/bots/readiness-loader.ts`
17. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
18. `apps/web/src/features/bots/data.tsx`
19. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
20. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
21. `packages/db/src/repositories.ts`
22. `tests/integration/bot-read-safety-static.test.ts`
23. `tests/integration/bot-config-review-static.test.ts`
24. `tests/integration/bot-config-action-handler.test.ts`
25. `tests/integration/bot-runtime-config-sanitizer.test.ts`
26. `tests/e2e/bot-settings.spec.ts`

## Files changed
None — read-only audit

## Findings
1. Severity: High. The safe implementation path is to derive any top over-capacity advisory from the editable WTC config rows/stages, not from Legacy worker/runtime snapshots. Evidence: settings resolves the current WTC config into `legacyRows` and `legacyStages` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:201`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:207`, and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:209`, then feeds only review metrics/count state into `BotSetupControlCenter` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:217` and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:248`; setup follows the same WTC config path at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:210`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:215`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:216`, and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:268`. Recommendation: add the advisory as a derived WTC-draft DTO/metric from `legacyRows` plus `legacyStages`; do not source it from `legacyLiveConfig`, `legacySnapshotRows`, `legacySnapshotStages`, provider account rows, health detail, positions, or orders. Target part: top control-center capacity advisory data source.
2. Severity: High. Existing over-capacity logic is local presentation state and can be shared safely only if it stays provider-agnostic. Evidence: `LegacyAveragingConfigTable` counts active rows by stage and RSI/CCI signal only at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:45`; it renders `overRsi`/`overCci` status from usage versus stage slot counts at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:356`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:357`, and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:382`. Persistable `LegacySymbolConfig` has no provider identity at `apps/web/src/features/bots/config-types.ts:13`, while `providerPubId` exists only on the runtime extension at `apps/web/src/features/bots/config-types.ts:37`. Recommendation: if the stage-capacity calculation is lifted out for the control center, type it against `LegacySymbolConfig`/`LegacyStageConfig` or return sanitized numbers only; avoid `LegacyRuntimeSymbolConfig`. Target part: capacity helper/API.
3. Severity: High. A top advisory must remain render-only and must not become a new mutation or save-blocking path in this slice. Evidence: settings saves already run CSRF then the shared config handler at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:136`; setup saves do the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:142`; the shared handler rejects forbidden keys and form issues before parse/persist at `apps/web/src/features/bots/config-action-handler.ts:165`, `apps/web/src/features/bots/config-action-handler.ts:167`, `apps/web/src/features/bots/config-action-handler.ts:169`, and `apps/web/src/features/bots/config-action-handler.ts:179`; focused tests prove forbidden/form issue cases do not persist at `tests/integration/bot-config-action-handler.test.ts:154` and `tests/integration/bot-config-action-handler.test.ts:169`. Recommendation: do not add a new server action, hidden form field, DB query, or persistence branch for the advisory; if over-capacity should later block saves semantically, make that a separate validation phase. Target part: settings/setup mutation boundary.
4. Severity: Medium. Provider IDs, exchange secrets, and raw runtime payloads stay outside the current control-center boundary, but nearby settings code does have sanitized runtime snapshot material that must not be reused for the advisory. Evidence: control-center props accept counts/state, not provider IDs or raw payloads, at `apps/web/src/features/bots/BotSetupControlCenter.tsx:22`; provider readiness detail renders count text only at `apps/web/src/features/bots/BotSetupControlCenter.tsx:91`; readiness loads provider mapping count/state only at `apps/web/src/features/bots/readiness-loader.ts:73`; DB provider mapping summary is documented as counts-only at `packages/db/src/repositories.ts:1849`; runtime sanitizer strips forbidden runtime keys at `apps/web/src/features/bots/runtime-config-sanitizer.ts:3` and masks allowed provider identity values at `apps/web/src/features/bots/runtime-config-sanitizer.ts:72`; the settings page separately materializes Legacy runtime/provider snapshot display at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:197`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:214`, and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:411`. Recommendation: advisory copy may say stage/RSI/CCI counts such as "Stage 1 is over WTC draft capacity"; it must not include pub_id, provider account id, balances, orders, raw JSON, URLs, headers, or secret/vault fields. Target part: provider/secret/runtime data boundary.
5. Severity: Medium. Existing control-center copy avoids live connectivity and live-control claims; the advisory should preserve that language. Evidence: exchange readiness explicitly says live ping is not run at `apps/web/src/features/bots/BotSetupControlCenter.tsx:66`; the live-control boundary states start/stop/live diagnostics/live apply/position-closing are unavailable at `apps/web/src/features/bots/BotSetupControlCenter.tsx:222`; settings says save behavior is WTC version only with no live-control adapter actions at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:303`; setup invalid-save copy says a failed draft was not saved or applied to the live bot at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:486`; tests reject unsafe live/control wording at `tests/integration/bot-read-safety-static.test.ts:147` and `tests/e2e/bot-settings.spec.ts:156`. Recommendation: use WTC-draft wording and avoid "connected", "verified", "runtime slots full", "provider capacity", "apply", "retest", "start", or "stop" in the advisory. Target part: top control-center copy.
6. Severity: Medium. User/admin boundaries are currently explicit and should not be weakened by the advisory. Evidence: control-center boundary copy says users save their own profile while admins publish defaults and map Legacy pub_id, and this page cannot edit another user or provider account, at `apps/web/src/features/bots/BotSetupControlCenter.tsx:212`; denied readiness returns hidden data and zero counts at `apps/web/src/features/bots/readiness-loader.ts:126`; provider summary is loaded for the current user at `apps/web/src/features/bots/readiness-loader.ts:160`; runtime facts are hidden unless exactly one active provider account is mapped to this user's bot instance at `apps/web/src/features/bots/data.tsx:451` and `apps/web/src/features/bots/data.tsx:469`. Recommendation: link the advisory only to the user's local `#legacy-stage-N` editor target and describe it as editable WTC profile capacity; do not link to admin mapping pages or suggest the user can change provider mappings. Target part: user/admin boundary.
7. Severity: Low. Current focused tests cover the ingredients, but a top advisory will need its own static/rendered proof after implementation. Evidence: static tests already assert the control center has safe layers, issue routing, no `providerPubId`, and no connection-test wording at `tests/integration/bot-read-safety-static.test.ts:110`; config-review tests assert Legacy stage capacity metrics and table over-capacity strings at `tests/integration/bot-config-review-static.test.ts:55`, `tests/integration/bot-config-review-static.test.ts:140`, and `tests/integration/bot-config-review-static.test.ts:144`; rendered tests prove the existing Legacy stage targeted error path at `tests/e2e/bot-settings.spec.ts:138`. Recommendation: when the advisory is added, add a focused static assertion for no provider/raw/live-control terms and a rendered settings/setup assertion that the advisory appears only from editable WTC capacity state. Target part: focused tests.

## Decisions
1. Security/data-boundary verdict: the advisory is acceptable only as a WTC draft capacity advisory derived from sanitized editable config rows/stages and rendered as aggregate stage/RSI/CCI counts.
2. Do not add loaders, DB repositories, route handlers, server actions, adapter calls, live exchange pings, worker ticks, provider/runtime reads, or live-control actions for this advisory.
3. Keep over-capacity advisory semantics non-blocking in this slice. Existing invalid stage field validation remains the only observed stage save-blocking behavior.
4. Keep any new control-center prop narrow, for example a count/list of over-capacity stage summaries, rather than passing raw rows, runtime config, provider accounts, or validation strings.
5. This auditor was the requested per-agent read-only lane; no additional background agents were spawned here, so no spawned agents required cleanup.

## Risks
1. The worktree remains heavily dirty/untracked from prior phases; this handoff covers only the files and boundaries listed in scope.
2. Future implementation could accidentally use nearby `legacyLiveConfig`/provider snapshot data because those values are in the settings/setup pages for other read-only evidence blocks.
3. Existing setup copy includes "Connected through existing Legacy pub_id" for worker-snapshot evidence; avoid repeating that wording in the new top advisory because over-capacity is WTC draft state, not live connectivity.
4. This audit did not prove browser rendering for a new advisory because no advisory implementation exists yet.
5. This audit does not prove production deploy state, provider reachability, live exchange connectivity, or live bot runtime behavior.

## Verification/tests
RUN:
1. Read required protocol/truth docs and latest Phase 4.02 aggregate/security handoff before writing this handoff.
2. Inspected current git state before the handoff; branch is `codex/bot-analytics-settings-canary-20260603` with broad pre-existing dirty/untracked state.
3. Inspected scoped source/tests with read-only commands and line-number evidence.
4. `npm exec vitest -- run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-config-action-handler.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts` - PASS, 4 files / 43 tests.

NOT RUN:
1. Playwright/e2e - not run by this read-only auditor because it starts a local web server and can write browser artifacts.
2. Full `npm test`, full lint, typecheck, production build, coverage, governance, and secret scan - not run; this was a focused read-only audit.
3. Live services, SSH, tmux, systemd, env/vault/secret inspection, provider DB mutation, worker tick/restart, live exchange ping, live bot start/stop/apply/retest/control, or position actions - not run by scope and safety policy.
4. Git staging, commit, push, or PR - not requested.

## Next actions
1. Implement the advisory as a narrow derived WTC-config helper/prop that reports only over-capacity stage numbers and RSI/CCI count deltas.
2. Add focused tests proving the advisory does not include provider IDs, raw runtime fields, secret-shaped keys, live-control wording, or admin-only actions.
3. Add rendered settings/setup coverage only in the owning implementation/tests lane, using fresh Playwright ports and no live-provider checks.
4. Keep live Legacy apply, start/stop, retest, provider DB mutation, exchange ping, and admin provider mapping out of this advisory slice until separate bot-integration and security audits approve them.
