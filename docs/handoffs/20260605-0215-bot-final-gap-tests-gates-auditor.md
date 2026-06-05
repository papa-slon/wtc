# bot-final-gap-tests-gates-auditor handoff
## Scope
Read-only Phase 4.44 tests/gates next-gap audit after Phase 4.43. Objective: identify the minimal focused static/rendered tests and local no-env gates for the next implementation slice across the two bot pages, settings, statistics, admin separation, and continuity. Managed DB, live provider, deploy, and live bot-control gates were intentionally out of scope.

## Files inspected
- `package.json`
- `scripts/gates.mjs`
- `playwright.config.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `tests/e2e/bot-readiness-map.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/bot-readiness-builder.test.ts`
- `tests/integration/two-bot-continuity-contract-static.test.ts`
- `tests/integration/bot-admin-acceptance-runner.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-bot-completion-gate-map.test.ts`
- `docs/handoffs/20260605-0145-phase-4-43-admin-readonly-labels.md`

## Files changed
- `docs/handoffs/20260605-0215-bot-final-gap-tests-gates-auditor.md`

## Findings
1. Severity P2 - The selected-user admin bot detail page still has only thin no-DB rendered proof. Evidence: `tests/e2e/admin-mobile-pg8.spec.ts:23` includes `/admin/users/demo-user/bots`, but its page-specific assertions are limited to read-only labels at `tests/e2e/admin-mobile-pg8.spec.ts:64-68`; desktop smoke stops at `/admin/users` read-only selector copy at `tests/e2e/smoke.spec.ts:184-188`; Phase 4.43 notes a previous no-DB selected-user assertion had to be narrowed to stable intro/pill copy at `docs/handoffs/20260605-0145-phase-4-43-admin-readonly-labels.md:73`. Recommendation: add one focused no-DB rendered assertion block in `tests/e2e/smoke.spec.ts` for `/admin/users/demo-user/bots` using stable copy already proven in PG8: heading, read-only access copy, `LIVE CONTROL: DISABLED`, `user settings: read-only`, `provider mappings: read-only`, and absence of `Connection verified` / live-control verbs. Target part: admin selected-user separation rendered proof.
2. Severity P2 - Dashboard-to-statistics continuity is statically expected but not rendered as a user journey. Evidence: the static safety test requires the launch readiness panel to expose `Open statistics` at `tests/integration/bot-read-safety-static.test.ts:143`; the rendered readiness spec visits `/app/bots/tortila` and `/app/bots/legacy` at `tests/e2e/bot-readiness-map.spec.ts:24` and `tests/e2e/bot-readiness-map.spec.ts:43` but does not assert or follow that link; the statistics spec proves direct URLs only at `tests/e2e/bot-statistics.spec.ts:47` and `tests/e2e/bot-statistics.spec.ts:66`. Recommendation: add two small assertions to `tests/e2e/bot-readiness-map.spec.ts`: for Tortila and Legacy, assert the `Open statistics` link href targets the matching `?bot=` URL, click or navigate through it, and verify the matching statistics heading without live-control copy. Target part: two-bot dashboard-to-statistics continuity.
3. Severity P2 - Existing static coverage is focused, but the local script surface has no named focused static bot/admin gate. Evidence: package scripts expose `accept:bots:rendered`, `accept:bots:local`, and `accept:bots:continuity:contract` at `package.json:44-46`; `scripts/gates.mjs:173-175` maps those to rendered+visual, broad local, and continuity plans only; focused static contracts such as `tests/integration/bot-statistics-completion.test.ts:38-55`, `tests/integration/bot-readiness-builder.test.ts:73-88`, and `tests/integration/two-bot-continuity-contract-static.test.ts:132-156` are available but not grouped under a small bot/admin static acceptance script. Recommendation: for the next slice, either run the explicit focused Vitest command listed below or add a tiny `accept:bots:static` wrapper that only runs the no-env bot/admin static contract pack. Target part: minimal local gate ergonomics.
4. Severity P3 - The final rendered gate should be the existing no-env rendered wrapper, not another ad hoc smoke-only proof. Evidence: Phase 4.43 did not run the full rendered pack and says targeted smoke/PG8 were used instead at `docs/handoffs/20260605-0145-phase-4-43-admin-readonly-labels.md:77`; the wrapper already includes smoke, bot settings, readiness, statistics, warning visual, admin mobile PG8, and visual inventory at `scripts/gates.mjs:145-153` and `scripts/gates.mjs:173`. Recommendation: after the two small rendered assertions above are added, run `npm run accept:bots:rendered` as the final rendered no-env proof. Target part: local rendered acceptance discipline.

## Decisions
- Recommend no product-code changes for the next tests/gates slice unless a new test exposes a real UI regression.
- Keep the next slice no-env/demo-stable: Playwright already runs with mock adapters and live-control disabled via `playwright.config.ts:33-38`.
- Prefer extending existing specs over adding a new rendered spec, because `scripts/gates.mjs:145-153` already includes the relevant files in `accept:bots:rendered`.
- Do not run or recommend managed DB, live provider, deploy, GitHub CI, SSH/systemd/tmux, live bot start/stop/apply-config, exchange ping, or provider probes for this slice.

## Risks
- The worktree was already heavily dirty before this audit, including modified and untracked tests/handoffs; this handoff does not classify unrelated dirty files.
- No commands were run that execute tests, render browsers, start servers, or write screenshots/logs, because the task was read-only except this handoff.
- Demo/no-DB selected-user detail can render fewer row-level sections than DB-backed detail; new assertions must use stable intro/pill/boundary copy rather than row-only text.
- Adding a new `accept:bots:static` script would touch gate/package files; if the next slice wants zero gate-code changes, use the explicit Vitest command instead.

## Verification/tests
RUN:
1. `git status --short --branch` - inspected branch and confirmed the pre-existing dirty tree.
2. Read-only `Get-Content` and `rg -n` inspections of the requested package, gate, Playwright, E2E, integration, and Phase 4.43 handoff files.

NOT RUN:
1. `npm run accept:bots:rendered` - not run; this audit is read-only except the handoff and should not create Playwright screenshots or visual inventory.
2. `npm run accept:bots:local` - not run; broader than needed and includes worker smoke/log activity.
3. `npm run accept:bots:continuity:contract` - not run; no continuity implementation changed in this audit.
4. Managed DB/provider/deploy/live commands - not run by scope.

Recommended next no-env gates after the focused assertions are added:
1. `npx vitest run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-statistics-completion.test.ts tests/integration/bot-readiness-builder.test.ts tests/integration/two-bot-continuity-contract-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-bot-completion-gate-map.test.ts tests/integration/bot-admin-acceptance-runner.test.ts`
2. `npm run accept:bots:rendered`
3. `npm run accept:bots:continuity:contract` only if the next slice touches worker/readiness/continuity status logic.

## Next actions
1. Add the focused `/admin/users/demo-user/bots` desktop rendered assertions to `tests/e2e/smoke.spec.ts`.
2. Add the Tortila and Legacy `Open statistics` href/journey assertions to `tests/e2e/bot-readiness-map.spec.ts`.
3. Run the focused Vitest static pack, then `npm run accept:bots:rendered`.
4. If these static tests become a repeated handoff requirement, add a small no-env `accept:bots:static` wrapper; otherwise keep the explicit Vitest command to avoid gate churn.
