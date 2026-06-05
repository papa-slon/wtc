# phase-4-24-bot-launch-readiness-command-center handoff
## Scope
Phase 4.24 implementation slice for the WTC Legacy/Tortila bot completion goal. The phase answered the current auditor recommendation to add an obvious, read-only launch/start-readiness command center on the user bot dashboard, without adding live start, stop, apply-config, exchange ping, provider probe, position action, or secret access.

Per-agent handoffs linked by this aggregate:
- [docs/handoffs/20260604-1646-bot-next-completion-ux-auditor.md](docs/handoffs/20260604-1646-bot-next-completion-ux-auditor.md)
- [docs/handoffs/20260604-1648-bot-next-completion-gates-auditor.md](docs/handoffs/20260604-1648-bot-next-completion-gates-auditor.md)
- [docs/handoffs/20260604-1649-bot-next-completion-security-auditor.md](docs/handoffs/20260604-1649-bot-next-completion-security-auditor.md)

Background agents were launched before edits, their handoffs exist, and all three were closed after result collection. This aggregate is the operator handoff for the single implementation slice.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260604-1646-bot-next-completion-ux-auditor.md`
- `docs/handoffs/20260604-1648-bot-next-completion-gates-auditor.md`
- `docs/handoffs/20260604-1649-bot-next-completion-security-auditor.md`
- `docs/handoffs/20260604-1621-phase-4-22-bot-statistics-admin-command-center.md`
- `docs/handoffs/20260604-1637-phase-4-23-admin-bot-owner-selector.md`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx`
- `apps/web/src/features/bots/BotReadinessMap.tsx`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/features/bots/readiness-loader.ts`
- `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
- `apps/web/src/features/bots/BotSetupControlCenter.tsx`
- `tests/integration/bot-readiness-server-dto-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/e2e/bot-readiness-map.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `playwright.config.ts`

## Files changed
- `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx` - new read-only launch readiness command center.
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` - mounted the command center after the existing bot readiness map.
- `tests/integration/bot-readiness-server-dto-static.test.ts` - added static DTO/wiring/no-live-control assertions.
- `tests/integration/bot-read-safety-static.test.ts` - added static safety assertions for the new panel.
- `tests/e2e/bot-readiness-map.spec.ts` - added rendered desktop/mobile assertions and narrowed the Live control row locator to the readiness map table.
- `tests/e2e/smoke.spec.ts` - updated disabled-control smoke assertions to avoid ambiguity with the new disabled start-readiness CTA and to match current page copy.
- `docs/handoffs/20260604-1705-phase-4-24-bot-launch-readiness-command-center.md` - this aggregate handoff.

## Findings
1. Severity P1 - The user bot dashboard now has a first-class launch-readiness verdict, but it remains explicitly read-only. Evidence: `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx:52` renders `Launch readiness command center`, `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx:59` states that the page does not start, stop, apply config, retest exchange connectivity, or touch positions, and `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx:108` renders the disabled `Start bot unavailable` control. Recommendation: keep this as the only start-facing UX until a separate security plus bot-integration phase approves live control. Target part: user bot dashboard start-readiness.
2. Severity P1 - The panel reuses the server readiness DTO instead of introducing adapter, provider, exchange, or secret calls. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:175` passes `readinessItems` into `BotLaunchReadinessPanel`, and `tests/integration/bot-readiness-server-dto-static.test.ts:54`-`55` locks the import/render wiring. Recommendation: if this panel expands, feed it from existing safe DTOs and config-review metrics rather than recomputing from runtime/provider internals. Target part: readiness data boundary.
3. Severity P1 - Static safety tests now guard the new panel against live-control wiring and secret semantics. Evidence: `tests/integration/bot-readiness-server-dto-static.test.ts:74`-`81` checks the command center and forbids `form action`, `type="submit"`, `startBot`, `stopBot`, `applyConfig`, `fetch(`, adapter calls, API keys, sealed values, and `Connection verified`; `tests/integration/bot-read-safety-static.test.ts:130`-`138` adds the same surface to the bot read-safety suite. Recommendation: every future start-readiness/admin mirror slice should add the same negative assertions. Target part: static safety gates.
4. Severity P2 - Rendered desktop/mobile proof now covers Tortila and Legacy bot dashboards with the new launch-readiness panel. Evidence: `tests/e2e/bot-readiness-map.spec.ts:26`-`29` asserts the Tortila command center, disabled live start, no exchange ping, and disabled start CTA; `tests/e2e/bot-readiness-map.spec.ts:44`-`47` asserts the same for Legacy. Recommendation: add the same panel or an admin read-only equivalent to selected-user admin drilldowns in a later bounded slice. Target part: rendered bot dashboard proof.
5. Severity P2 - Existing smoke tests needed selector updates because the new command center intentionally adds another disabled start-facing button and another Live control row. Evidence: `tests/e2e/smoke.spec.ts:263` and `tests/e2e/smoke.spec.ts:331` now assert `Start bot unavailable` separately, while `tests/e2e/bot-readiness-map.spec.ts:15`-`17` narrows Live control checks to the readiness map row. Recommendation: keep Playwright locators table-specific when multiple read-only panels repeat the same operational layer names. Target part: browser test robustness.

## Decisions
- Implemented a narrow dashboard-only command center for this phase instead of broad live-control or provider work.
- Kept the user-facing start affordance disabled and explanatory: "Start bot unavailable" is a review/status signal, not a submit button or server action.
- Kept exchange readiness as "no exchange ping" in this panel. WTC vault/key metadata remains separate from real exchange connectivity proof.
- Did not mount the panel in admin selected-user drilldown in this slice. That remains a follow-up so the phase stays bounded.
- Did not kill existing node processes occupying ports 3410, 3411, and 3412. Browser gates were rerun on free `E2E_PORT` values.
- Closed the three Phase 4.24 background agent lanes after collecting their handoffs.

## Risks
- The repository was heavily dirty before this phase. This aggregate certifies only the files and gates listed here, not the entire working tree.
- The new command center can make the dashboard look closer to start-ready, so copy and tests deliberately keep the no-live-control boundary visible.
- Playwright failure artifacts from initial runs remain under `test-results/`; they were caused by occupied ports or stale test expectations and were resolved by final passing runs.
- Formal visual acceptance is still not green because this phase ran screenshot inventory only, not a manifest-backed visual review.
- Real DB-backed admin selector proof, real worker continuity proof, live exchange ping, provider reachability, and deploy verification were not run in this phase.

## Verification/tests
RUN:
- `npx vitest run tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/bot-read-safety-static.test.ts` - PASS, 2 files / 30 tests.
- `npm run typecheck -w @wtc/web` - PASS.
- `E2E_PORT=3421 npx playwright test tests/e2e/bot-readiness-map.spec.ts` - PASS, 2 tests, desktop and mobile.
- `E2E_PORT=3425 npx playwright test tests/e2e/smoke.spec.ts -g "Phase 2.3 no live-control buttons enabled|Phase 2.4 E2E-31/32"` - PASS, 4 tests, desktop and mobile.
- `node scripts/gates.mjs quick` - PASS, 4 gates: lint, typecheck, typecheck-web, test.
- `npm run secret:scan` - PASS.
- `npm run governance:check` - PASS with 0 errors and 1 known historical warning before this aggregate was written.
- `git diff --check` - PASS.
- `npm run evidence:visual -- --inventory tests/e2e/screenshots` - PASS inventory only: 103 image files, 0 blocked binary/container artifacts, 0 missing roots, 104 total artifact files, 0 dynamic marker(s).

INITIAL FAILURES, RESOLVED:
- Default Playwright on `localhost:3410` failed because the port was already in use.
- `E2E_PORT=3411/3412` were also occupied by existing node processes, so final browser runs used free ports.
- Early Playwright runs exposed stale/ambiguous test selectors after adding the new disabled start CTA and repeated Live control row. Tests were narrowed to current copy and table-specific locators, then final runs passed.

NOT RUN / NOT GREEN:
- `npm run evidence:visual -- --manifest <manifest>` - NOT RUN/NOT GREEN; no manifest-backed visual review was created in this slice.
- `npm run e2e:admin-user-bots:db:managed:matrix` - NOT RUN; requires explicit disposable Postgres/admin harness authorization.
- `npm run accept:worker:continuity`, `npm run worker:smoke`, worker tick/dev-worker commands - NOT RUN; worker continuity proof is a separate authorized slice.
- Live bot start/stop/apply-config, live exchange ping, provider probe, Legacy DB live provider read, SSH/tmux/systemd/deploy - NOT RUN by safety policy and phase scope.

## Next actions
1. Mirror the same read-only start-readiness verdict into selected-user admin drilldown, with no user-settings mutation and no provider mapping edits.
2. Add a richer pure readiness summary that includes Legacy RSI/CCI stage-capacity health and Tortila cap/key state from existing config-review DTOs.
3. Run the DB-backed admin selector matrix only when a disposable Postgres harness is explicitly authorized.
4. Plan a separate worker continuity proof slice that verifies the worker does not stop, while still avoiding live provider mutation and live bot control.
5. Promote screenshots to formal visual acceptance only with a manifest-backed visual review.
