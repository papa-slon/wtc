# phase-4-12-bot-continuity-monitor handoff
## Scope
Add a user-facing continuity monitor for Legacy and Tortila bot pages so users can see whether runtime proof is green, pending, stale/watch, or interrupted without adding live start/stop/apply/retest behavior. This phase keeps runtime control disabled and improves settings/setup clarity with read-only continuity language.

Per-agent handoffs linked:
- docs/handoffs/20260604-1114-bot-continuity-runtime-auditor.md
- docs/handoffs/20260604-1114-bot-continuity-ux-auditor.md
- docs/handoffs/20260604-1114-bot-continuity-tests-security-auditor.md

All three background agents were closed before this aggregate handoff.

## Files inspected
- AGENTS.md
- docs/SESSION_PROTOCOL.md
- docs/handoffs/20260604-1111-phase-4-11-admin-runtime-evidence-ladder.md
- docs/handoffs/20260604-1114-bot-continuity-runtime-auditor.md
- docs/handoffs/20260604-1114-bot-continuity-ux-auditor.md
- docs/handoffs/20260604-1114-bot-continuity-tests-security-auditor.md
- apps/web/src/features/bots/continuity.ts
- apps/web/src/features/bots/BotContinuityPanel.tsx
- apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx
- apps/web/src/features/bots/readiness.ts
- apps/web/src/features/bots/readiness-loader.ts
- apps/web/src/features/bots/data.tsx
- apps/web/src/app/(app)/app/bots/[bot]/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx
- apps/web/src/app/(app)/app/bots/statistics/page.tsx
- tests/integration/bot-continuity-builder.test.ts
- tests/integration/bot-read-safety-static.test.ts
- tests/e2e/bot-readiness-map.spec.ts
- tests/e2e/bot-settings.spec.ts
- tests/e2e/smoke.spec.ts

## Files changed
- apps/web/src/features/bots/continuity.ts
- apps/web/src/features/bots/BotContinuityPanel.tsx
- apps/web/src/app/(app)/app/bots/[bot]/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx
- apps/web/src/app/(app)/app/bots/statistics/page.tsx
- tests/integration/bot-continuity-builder.test.ts
- tests/integration/bot-read-safety-static.test.ts
- tests/e2e/bot-readiness-map.spec.ts
- tests/e2e/bot-settings.spec.ts
- tests/e2e/smoke.spec.ts
- docs/handoffs/20260604-1114-bot-continuity-runtime-auditor.md
- docs/handoffs/20260604-1114-bot-continuity-ux-auditor.md
- docs/handoffs/20260604-1114-bot-continuity-tests-security-auditor.md
- docs/handoffs/20260604-1145-phase-4-12-bot-continuity-monitor.md

## Findings
1. Severity P1 - evidence apps/web/src/features/bots/continuity.ts:94 - recommendation: centralize continuity truth in a pure builder - target part: continuity state model. The builder now refuses false green states: mock/demo is watch, not_configured is pending, stale/warnings are attention, and unreachable/malformed/process-down are interrupted.
2. Severity P1 - evidence apps/web/src/features/bots/BotContinuityPanel.tsx:32 - recommendation: render continuity as a first-screen status answer - target part: bot UX. The new panel shows overall continuity, worker cadence, last worker check, snapshot age, runtime source, scoped evidence rows, settings source, connection state, silent-stop guard, and control boundary.
3. Severity P1 - evidence apps/web/src/app/(app)/app/bots/[bot]/page.tsx:174 - recommendation: show continuity before deeper operation/runtime evidence - target part: bot dashboard. Dashboard now renders the monitor with dashboard evidence rows, settings source, and Legacy/Tortila connection context.
4. Severity P1 - evidence apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:254 and apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:293 - recommendation: settings must not be status-blind - target part: settings page. Settings now shows a read-only "Settings continuity monitor"; Tortila uses an honest unchecked/pending health state, while Legacy can reuse the already-loaded safe snapshot config read.
5. Severity P1 - evidence apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:253 and apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:305 - recommendation: setup must explain runtime proof separately from saving config - target part: setup wizard. Setup now shows a "Setup continuity monitor" with setup evidence rows and explicit copy that the wizard does not run runtime connection checks.
6. Severity P2 - evidence apps/web/src/app/(app)/app/bots/statistics/page.tsx:246 and apps/web/src/app/(app)/app/bots/statistics/page.tsx:366 - recommendation: statistics should expose whether analytics are backed by fresh runtime proof - target part: statistics dashboard. Statistics now has a "Statistics continuity monitor" with metric/position/trade/equity/config/warning row count.
7. Severity P2 - evidence apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx:47 - recommendation: safety page should name warning evidence separately - target part: safety tab. Safety now has a "Safety continuity monitor" whose evidence rows are warning rows, not fabricated metric coverage.
8. Severity P2 - evidence tests/integration/bot-continuity-builder.test.ts:17 and tests/e2e/bot-settings.spec.ts:63 - recommendation: lock both semantic states and rendered settings/setup visibility - target part: verification. Unit/static tests and desktop/mobile Playwright now cover the continuity builder and rendered continuity markers.

## Decisions
- This phase implemented user-facing continuity UX, not backend worker heartbeat hardening.
- No new live-control buttons or runtime mutations were added. The monitor explicitly says it never starts, stops, runs connection checks, applies config, opens secrets, or calls a live exchange/provider during render.
- Settings/setup do not add a new Tortila runtime read. They show pending runtime proof and point the user to dashboard/safety for worker-backed runtime proof.
- Disabled Start/Stop buttons were not removed in this phase because existing e2e and the future audited-control decision need a separate slice. The continuity/control-boundary copy was strengthened instead.

## Risks
- The runtime auditor found that the generic worker heartbeat is still not full bot-continuity proof because worker health is written before final Legacy/Tortila snapshot outcomes. That backend hardening remains the next mandatory slice before claiming the bots cannot stop silently.
- `npm run worker:smoke` was not used as continuity proof because it can fall back to memory demo without DATABASE_URL.
- The DB-backed worker one-shot and admin selected-user DB e2e were not run because this phase stayed within safe local UI/static/browser verification.
- The checkout remains heavily dirty from prior phases; this handoff lists only the files touched in this phase.

## Verification/tests
RUN:
- npm run typecheck -w @wtc/web - PASSED.
- npx eslint apps/web/src/features/bots/continuity.ts apps/web/src/features/bots/BotContinuityPanel.tsx apps/web/src/app/(app)/app/bots/[bot]/page.tsx apps/web/src/app/(app)/app/bots/statistics/page.tsx apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx tests/integration/bot-continuity-builder.test.ts tests/integration/bot-read-safety-static.test.ts tests/e2e/smoke.spec.ts tests/e2e/bot-readiness-map.spec.ts tests/e2e/bot-settings.spec.ts --max-warnings 0 - PASSED.
- npx vitest run tests/integration/bot-continuity-builder.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-readiness-builder.test.ts tests/integration/bot-readiness-server-dto-static.test.ts - PASSED, 4 files, 42 tests.
- $env:E2E_PORT='3431'; npx playwright test tests/e2e/bot-readiness-map.spec.ts tests/e2e/bot-settings.spec.ts --project=desktop - PASSED, 10 tests.
- $env:E2E_PORT='3432'; npx playwright test tests/e2e/bot-readiness-map.spec.ts tests/e2e/bot-settings.spec.ts --project=mobile - PASSED, 10 tests.
- In-app Browser DOM sanity on http://127.0.0.1:3420/app/bots/tortila/settings - PASSED for markers: Settings continuity monitor, Settings readiness map, settings evidence rows.
- npm run secret:scan - PASSED.
- git diff --check for this phase's changed app/test files - PASSED.

Intermediate checks:
- Initial Playwright run on default port failed before tests because port 3410 was already in use.
- First rendered desktop run found locator ambiguity introduced by the new continuity rows; tests were corrected to use specific layer/proof cells and then re-run green.

NOT RUN:
- DB-backed worker one-shot / `node scripts/safe-worker-tick.mjs --require-db` - NOT RUN because it requires explicit throwaway DATABASE_URL scope and runs a worker tick.
- `npm run worker:smoke` - NOT RUN as proof because it can fall back to memory demo.
- `npm run e2e:admin-user-bots:db:managed` - NOT RUN because this phase did not touch admin selected-user DB scope and no throwaway admin Postgres URL was provided.
- Full `npm run ci:local`, full Playwright suite, production build, deploy/SSH/tmux/systemd - NOT RUN due slice scope and time.
- Live bot start/stop/apply, runtime connection checks, provider calls, exchange pings, env/secret value reads - NOT RUN by safety policy.

## Next actions
1. Implement the backend worker continuity heartbeat hardening from the runtime auditor: final worker health must include Tortila/Legacy snapshot outcomes after both jobs run.
2. Fix `apps/worker/src/tick-once.ts` to emit one redacted DB tick summary line with both `tortila=` and `legacy=`.
3. Update admin bot surfaces to honor `readState=stale/unreachable/malformed` even when coarse DB health status is `ok`, and query bot health rows directly rather than filtering the latest 50 global rows.
4. In a separate UX/safety slice, decide whether to replace disabled Start/Stop buttons with non-interactive boundary status while preserving the future audited-control roadmap.
