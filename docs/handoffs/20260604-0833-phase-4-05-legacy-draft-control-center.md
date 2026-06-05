# phase-4-05-legacy-draft-control-center handoff
## Scope
Narrow Phase 4.05 implementation slice: make the top `Bot setup control center` react to unsaved Legacy stage-capacity draft edits before save. When a user edits stage RSI/CCI capacity into an over-capacity draft, the top control center now shows a distinct `Draft stage capacity warning` / `Unsaved over capacity` row and routes back to the exact Legacy stage.

Out of scope: live bot start/stop/apply, live exchange ping, worker tick, provider DB mutation, raw provider payloads, env/secret inspection, production/canary service checks, broad bot completion, and unrelated dirty worktree cleanup.

Per-agent handoffs collected:
1. `docs/handoffs/20260604-0819-legacy-draft-control-center-ux-auditor.md`
2. `docs/handoffs/20260604-0819-legacy-draft-control-center-tests-auditor.md`
3. `docs/handoffs/20260604-0822-legacy-draft-control-center-security-auditor.md`

All three background agents were closed after their handoffs were collected.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/20260604-0808-phase-4-04-legacy-stage-live-preview.md`
4. `docs/handoffs/20260604-0819-legacy-draft-control-center-ux-auditor.md`
5. `docs/handoffs/20260604-0819-legacy-draft-control-center-tests-auditor.md`
6. `docs/handoffs/20260604-0822-legacy-draft-control-center-security-auditor.md`
7. `apps/web/src/features/bots/config-review.ts`
8. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
9. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
10. `tests/e2e/bot-settings.spec.ts`
11. `tests/integration/bot-config-review-static.test.ts`
12. `tests/integration/bot-read-safety-static.test.ts`
13. `package.json`

## Files changed
1. `apps/web/src/features/bots/config-review.ts`
2. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
3. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
4. `tests/e2e/bot-settings.spec.ts`
5. `tests/integration/bot-config-review-static.test.ts`
6. `tests/integration/bot-read-safety-static.test.ts`
7. `docs/handoffs/20260604-0833-phase-4-05-legacy-draft-control-center.md`

## Findings
1. Severity: High. The UX requirement for this slice is implemented: unsaved over-capacity stage edits now surface at the top before save as a separate draft warning. Evidence: `config-review.ts` defines `LEGACY_STAGE_CAPACITY_DRAFT_EVENT`; `LegacyAveragingConfigTable.tsx` computes the first draft over-capacity issue from local `stageDrafts` and dispatches it after draft edits; `BotSetupControlCenter.tsx` listens to the event and inserts `Draft stage capacity warning` with `Unsaved over capacity`. Recommendation: keep this as an advisory client-local signal only. Target part: Legacy setup/settings control center.
2. Severity: High. Agent tests/security lanes correctly caught a forbidden live-control token in early draft copy: `retest`. The operator replaced it with non-live-control wording and reran the focused static gate green: 44 passed. Recommendation: keep static no-live-control string guards paired with rendered checks. Target part: safety copy and static regression tests.
3. Severity: Medium. Rendered desktop and mobile coverage proves the event bridge in the browser: editing `legacy_stage_rsi_0` and `legacy_stage_cci_0` to `0` shows the draft warning before save, then saved advisory remains distinguishable after save. Evidence: `tests/e2e/bot-settings.spec.ts` passed 8/8 on desktop and 8/8 on mobile. Recommendation: keep the draft-vs-saved labels separate. Target part: Playwright acceptance.
4. Severity: Medium. Source/security boundary remains intact: the bridge does not add server actions, provider DB reads, exchange calls, secret reads, bot adapter calls, or live-control paths. Evidence: focused static safety tests, secret scan, and security auditor handoff. Recommendation: any future saveable draft state must go through the existing CSRF, RBAC, entitlement, zod, forbidden-key, and WTC config persistence path. Target part: bot settings mutation boundary.
5. Severity: Low. The product semantics are intentionally over-capacity-only at the top. A harmless unsaved stage edit updates the stage-table live usage but does not add a top-level warning. Recommendation: add a separate low-severity unsaved-draft row only if product wants every unsaved capacity edit surfaced globally. Target part: product behavior.

## Decisions
1. Accepted the `window` custom event bridge for this narrow same-page advisory state because it avoids new server/runtime/provider coupling.
2. The top control center suppresses the saved capacity warning while an unsaved draft issue is active, then falls back to saved/resolved config when no draft is active.
3. Draft copy must avoid live-control tokens such as `retest`; the UI still states that saving stores WTC reference intent and does not change the running Legacy bot.
4. This phase does not claim the full Legacy/Tortila bot website objective is complete. It closes only the unsaved Legacy over-capacity top-warning slice.

## Risks
1. The repository worktree is broadly dirty from earlier phases; this handoff scopes ownership only to the files changed in Phase 4.05.
2. `window` events are advisory UI plumbing and can be spoofed by same-page client code; they must never become authorization, entitlement, persistence, or live-control authority.
3. In-app browser verification reached `/login` because the normal app auth boundary redirected the unauthenticated local browser. Rendered acceptance therefore relies on the existing Playwright harness, which did pass desktop and mobile.
4. Full CI/build/coverage were not run in this phase because the scope was a narrow UI/safety slice.

## Verification/tests
RUN:
1. Phase protocol/current-state read before edits; read-only agents launched before edits.
2. UX/product auditor handoff: `docs/handoffs/20260604-0819-legacy-draft-control-center-ux-auditor.md`.
3. Tests/rendered auditor handoff: `docs/handoffs/20260604-0819-legacy-draft-control-center-tests-auditor.md`.
4. Security/source-boundary auditor handoff: `docs/handoffs/20260604-0822-legacy-draft-control-center-security-auditor.md`.
5. `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-action-handler.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts` - PASS, 44 tests.
6. `npm exec tsc -- -p apps/web/tsconfig.json --noEmit` - PASS.
7. `npm exec eslint -- 'apps/web/src/features/bots/config-review.ts' 'apps/web/src/features/bots/BotSetupControlCenter.tsx' 'apps/web/src/features/bots/LegacyAveragingConfigTable.tsx' 'tests/e2e/bot-settings.spec.ts' 'tests/integration/bot-config-review-static.test.ts' 'tests/integration/bot-read-safety-static.test.ts'` - PASS.
8. `npm exec tsc -- --noEmit` - PASS.
9. `$env:E2E_PORT='3426'; npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=desktop` - PASS, 8 tests.
10. `$env:E2E_PORT='3427'; npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=mobile` - PASS, 8 tests.
11. `npm run secret:scan` - PASS.
12. `git diff --check` - PASS.
13. `npm run governance:check` - PASS with known historical warning: `20260529-1921-integration-risk-auditor.md` missing `## Files inspected`.
14. Local in-app browser smoke: temporary web dev server on `127.0.0.1:3430` returned 200; unauthenticated browser was redirected to `/login`; browser tab closed and port 3430 stopped.

NOT RUN:
1. Full `npm test`, full `npm run lint`, build, coverage, full CI, and full e2e matrix - skipped because Phase 4.05 is a focused UI/safety slice and the targeted static/type/lint/rendered gates passed.
2. Live bot start/stop/apply, live config push, position close, worker tick, exchange ping, provider DB mutation/read, raw provider payload inspection, env/secret value inspection, SSH/tmux/systemd, production/canary checks - skipped by explicit safety boundary.
3. Git commit, push, PR - not requested.

## Next actions
1. Continue the broader goal with the next small Legacy/Tortila completion slice; do not mark the overall bot website/settings/statistics objective complete yet.
2. Decide whether benign unsaved stage capacity edits should also show a low-severity top-level `Unsaved stage capacity draft` row, or whether top-level warning remains over-capacity-only.
3. Keep live bot operation, exchange ping, provider DB evidence, and admin/system configuration behind separate security and bot-integration phases.
