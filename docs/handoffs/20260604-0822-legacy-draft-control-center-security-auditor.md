# legacy-draft-control-center-security-auditor handoff
## Scope
Read-only Phase 4.05 security/source-boundary audit for adding an unsaved Legacy stage-capacity draft signal from `LegacyAveragingConfigTable` to the top `BotSetupControlCenter` through local client state/event/bridge.

This audit verified whether the slice added any new server action, provider DB/runtime/raw payload dependency, secret exposure, exchange call, live bot control, or unsafe user/admin boundary. No live services, provider DB, env values, secrets, worker ticks, exchange pings, start/stop/apply/retest actions, tmux/systemd/SSH, preview server, or production checks were used.

Repo state observed before handoff: branch `codex/bot-analytics-settings-canary-20260603`, git-backed, with many pre-existing modified and untracked files. This lane did not revert or normalize unrelated dirty state. This is a per-agent read-only audit lane; no additional background agents were launched by this auditor.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0808-phase-4-04-legacy-stage-live-preview.md`
8. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
9. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
10. `apps/web/src/features/bots/config-review.ts`
11. `apps/web/src/features/bots/config.ts`
12. `apps/web/src/features/bots/config-action-handler.ts`
13. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
14. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
15. `tests/integration/bot-config-review-static.test.ts`
16. `tests/integration/bot-read-safety-static.test.ts`
17. `tests/integration/bot-config-action-handler.test.ts`
18. `tests/e2e/bot-settings.spec.ts`

## Files changed
None - read-only audit. Required handoff only: `docs/handoffs/20260604-0822-legacy-draft-control-center-security-auditor.md`.

## Findings
1. Severity: High. Acceptance is not green: the focused static safety gate fails because the new draft-warning copy contains the forbidden live-control token `retest`. Evidence: `BotSetupControlCenter.tsx:159` to `BotSetupControlCenter.tsx:164` builds draft copy ending with "does not apply or retest the Legacy bot"; `tests/integration/bot-read-safety-static.test.ts:173` to `tests/integration/bot-read-safety-static.test.ts:174` asserts readiness/control-center sources do not contain `retest`; `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-action-handler.test.ts` failed with 1 failing test in `bot-read-safety-static.test.ts` and 42 passing tests. Recommendation: change the UI copy to avoid forbidden live-control tokens, for example "does not change the running Legacy bot", or deliberately narrow the static assertion if the team wants negative safety copy to be allowed. Target part: source safety gate / control-center copy.

2. Severity: Low. The draft bridge itself is local client state and browser event plumbing, with no server action, route handler, fetch, bot adapter, exchange, worker, or provider DB call in the bridge path. Evidence: `config-review.ts:62` to `config-review.ts:66` defines only a string event name and typed detail; `LegacyAveragingConfigTable.tsx:108` to `LegacyAveragingConfigTable.tsx:109` dispatches a `CustomEvent`; `BotSetupControlCenter.tsx:291` to `BotSetupControlCenter.tsx:299` listens/removes the same event in a client component. Recommendation: keep this event advisory/local only and never treat it as a persistence, entitlement, provider, or live-control source. Target part: local draft bridge.

3. Severity: Medium. The top control center prefers the unsaved draft issue only after draft activity, otherwise it falls back to saved/resolved capacity issues. Evidence: `LegacyAveragingConfigTable.tsx:140` to `LegacyAveragingConfigTable.tsx:143` keeps local `stageDrafts` and `stageDraftTouched`; stage input changes set touched and local draft state at `LegacyAveragingConfigTable.tsx:460` to `LegacyAveragingConfigTable.tsx:493`; unmount resets the event at `LegacyAveragingConfigTable.tsx:163`; the control-center selection is `draftStageCapacityPreview?.active ? draftStageCapacityPreview.issue : legacyStageCapacityIssue` at `BotSetupControlCenter.tsx:273`. Recommendation: preserve the touched/reset behavior so saved warnings do not remain shadowed after the editable table unmounts. Target part: unsaved draft lifecycle.

4. Severity: Medium. Existing save/server action boundaries remain the only mutation path; the draft bridge does not add a new save action. Evidence: setup save still calls `handleSaveBotConfigAction` after CSRF at `setup/page.tsx:142` to `setup/page.tsx:147`; settings save does the same at `settings/page.tsx:136` to `settings/page.tsx:141`; action context requires a user and entitlement access at `config-action-handler.ts:123` to `config-action-handler.ts:133`; forbidden form keys include secrets, provider IDs, raw/live config, apply/start/stop/retest/exchange control at `config-action-handler.ts:51` to `config-action-handler.ts:96`; parsed config is validated before persistence at `config-action-handler.ts:165` to `config-action-handler.ts:180`; persistence again rejects forbidden nested config keys at `config.ts:864` to `config.ts:914`. Recommendation: if future draft bridges become saveable, keep them inside this zod/RBAC/entitlement/forbidden-key pipeline. Target part: mutation boundary.

5. Severity: Medium. The audited bridge does not promote provider runtime/raw payload into user settings or the top control center. Evidence: setup derives `legacyRows`/`legacyStages` from `cur` and computes saved `legacyStageCapacityIssue` at `setup/page.tsx:214` to `setup/page.tsx:217`, then passes only readiness state/count and the saved issue into the control center at `setup/page.tsx:269` to `setup/page.tsx:285`; settings passes only readiness state/count and the saved issue into the control center at `settings/page.tsx:249` to `settings/page.tsx:265`; settings passes `legacyRows`, `legacyStages`, and provider count into the editable table at `settings/page.tsx:550` to `settings/page.tsx:558`. `LegacyAveragingConfigTable` can read `providerPubId` only behind `showProviderIdentity` at `LegacyAveragingConfigTable.tsx:149` and `LegacyAveragingConfigTable.tsx:214`, and setup/settings do not pass `showProviderIdentity`. Recommendation: keep user setup/settings on WTC config rows; split provider identity display out if this table grows beyond reference editing. Target part: provider/source boundary.

6. Severity: Medium. Static and rendered coverage exists for the new draft bridge, but rendered gates were not run in this read-only audit. Evidence: static review asserts `LEGACY_STAGE_CAPACITY_DRAFT_EVENT`, `Draft stage capacity warning`, and `Unsaved draft preview` at `tests/integration/bot-config-review-static.test.ts:138` to `tests/integration/bot-config-review-static.test.ts:143`; it asserts the table event dispatcher, first draft issue helper, touched flag, drafts, and setter at `tests/integration/bot-config-review-static.test.ts:181` to `tests/integration/bot-config-review-static.test.ts:188`; Playwright expectations cover setup draft warning/link at `tests/e2e/bot-settings.spec.ts:215` to `tests/e2e/bot-settings.spec.ts:224` and settings draft warning/link at `tests/e2e/bot-settings.spec.ts:249` to `tests/e2e/bot-settings.spec.ts:258`. Recommendation: after fixing Finding 1, rerun the focused static gate and then the bot-settings desktop/mobile rendered gate. Target part: regression coverage.

## Decisions
1. The implementation is source-boundary safe in the audited bridge path, but acceptance is blocked by the static no-live-control token failure.
2. No product/test/docs fixes were applied because this lane was explicitly read-only except for the required handoff.
3. The event bridge is acceptable only as advisory same-page UI state; it must not become an entitlement, persistence, provider, exchange, or live-control authority.
4. Existing Tortila exchange-key setup/check actions in setup/settings are out of scope for Legacy draft capacity and remain gated to Tortila paths; no new Legacy exchange call was found in the bridge.
5. Existing broad dirty worktree state is not attributed to this auditor.

## Risks
1. The static safety gate currently fails, so the phase should not be reported green until the copy/test mismatch is resolved and rerun.
2. The event name is window-scoped and can be spoofed by same-page client code or devtools; acceptable for warning copy, unsafe for any persisted or access-control decision.
3. `LegacyAveragingConfigTable` still accepts runtime-capable row types even though provider identity is not shown in setup/settings; future changes could accidentally widen that display.
4. Because Playwright rendered gates were not run, visual/interaction acceptance of the top warning remains based on inspected tests and source, not fresh browser evidence from this lane.

## Verification/tests
RUN:
1. Read required process docs and current state docs: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and latest Phase 4.04 aggregate.
2. Inspected `BotSetupControlCenter`, `LegacyAveragingConfigTable`, `config-review`, `config.ts`, `config-action-handler`, setup/settings pages, and static/rendered tests listed above.
3. `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with extensive pre-existing modified and untracked files.
4. Source-boundary grep over audited feature files and setup/settings pages for bot adapters, fetch, vault open, secrets, raw/live config, provider IDs, exchange/action controls, and live-control tokens. Findings are recorded above; bridge files did not introduce network/adapter/server calls.
5. `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-action-handler.test.ts` - FAILED: `bot-config-review-static` passed, `bot-config-action-handler` passed, `bot-read-safety-static` failed 1 test because `BotSetupControlCenter.tsx` contains `retest`; total 42 passed / 1 failed.
6. `npm run secret:scan` - passed.

NOT RUN:
1. Product/test/docs fixes - skipped by read-only audit scope.
2. Playwright `tests/e2e/bot-settings.spec.ts` desktop/mobile - skipped because this was a read-only security/source audit and the focused static gate already failed.
3. Full `npm test`, full lint, typecheck, build, coverage, CI, governance, preview, and browser visual verification - skipped as broader phase/operator gates outside this lane.
4. Live server mutation, provider DB, env/secret inspection, worker ticks, exchange pings, start/stop/apply/retest, SSH, tmux, systemd, production/canary checks - explicitly not run by scope and safety policy.
5. Git commit, push, PR - not requested.

## Next actions
1. Fix Finding 1 by removing the forbidden `retest` token from `BotSetupControlCenter` copy or explicitly adjusting the static guard if negative safety copy is intended.
2. Rerun `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-action-handler.test.ts`.
3. After static gates pass, rerun the focused rendered bot-settings desktop/mobile gate that covers setup and settings draft warning links.
4. Keep future expansion of unsaved draft signals client-local/advisory and route any save through the existing CSRF, RBAC, entitlement, zod, forbidden-key, and WTC config persistence path.
