# tortila-strategy-tests-security-auditor handoff
## Scope
Phase 4.07 read-only tests/security audit for a future Tortila draft strategy map/readiness/capacity summary in user settings/setup and adjacent admin defaults.

Goal: define focused safety/test gates and static assertions that let the UI explain Tortila strategy readiness and capacity without adding live apply, exchange ping, provider reads, secret exposure, or false live-state copy.

Out of scope: product-code edits, test-code edits, live servers, env files, secrets, DB reads/writes, SSH, tmux, systemd, bot/provider endpoints, exchange ping, worker tick, live bot start/stop/apply/retest, deploy/canary checks, broad CI, and unrelated dirty worktree cleanup.
## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/20260604-0900-phase-4-06-legacy-trigger-resolution-map.md`
4. `docs/handoffs/20260604-0836-legacy-trigger-resolution-tests-security-auditor.md`
5. `docs/handoffs/20260604-0833-phase-4-05-legacy-draft-control-center.md`
6. `docs/handoffs/20260604-0653-phase-4-00-bot-setup-control-center.md`
7. `docs/handoffs/20260604-0640-bot-setup-control-center-tests-auditor.md`
8. `docs/handoffs/20260604-0644-bot-setup-control-center-security-auditor.md`
9. `docs/handoffs/20260603-2209-phase-3-80-tortila-fleet-identity.md`
10. `tests/e2e/bot-settings.spec.ts`
11. `tests/integration/bot-config-review-static.test.ts`
12. `tests/integration/bot-read-safety-static.test.ts`
13. `tests/integration/bot-config-action-handler.test.ts`
14. `tests/integration/bot-runtime-config-sanitizer.test.ts`
15. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
16. `apps/web/src/features/bots/config.ts`
17. `apps/web/src/features/bots/config-review.ts`
18. `apps/web/src/features/bots/config-action-handler.ts`
19. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
20. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
21. `apps/web/src/features/bots/BotOperationMapPanel.tsx`
22. `apps/web/src/features/bots/BotReadinessMap.tsx`
23. `apps/web/src/features/bots/readiness.ts`
24. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
25. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
26. `apps/web/src/app/admin/bots/config/page.tsx`
27. `package.json`
28. `playwright.config.ts`
## Files changed
None - read-only audit
## Findings
1. Severity: High. Existing Tortila copy and page wiring already define the safe source boundary: the table says each card is saved as WTC-side strategy intent and nothing is pushed to a live bot, while settings/setup pass source details that live exchange apply and connection testing remain disabled. Evidence: `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:47`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:64`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:204`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:543`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:546`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:518`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:521`. Recommendation: the Tortila strategy map/readiness/capacity summary must say WTC reference profile, saved profile, or unsaved draft preview; it must not say running config, next trade, connection verified, synced, live capacity, live apply, or provider-confirmed. Target part: Tortila map copy and data source.
2. Severity: High. Current rendered coverage checks Tortila settings/setup presence, readiness, exchange metadata wording, export preview, no connection-verified copy, and no horizontal scroll, but it does not yet prove any concrete Tortila draft strategy map/readiness/capacity summary. Evidence: `tests/e2e/bot-settings.spec.ts:44`, `tests/e2e/bot-settings.spec.ts:47`, `tests/e2e/bot-settings.spec.ts:49`, `tests/e2e/bot-settings.spec.ts:50`, `tests/e2e/bot-settings.spec.ts:60`, `tests/e2e/bot-settings.spec.ts:61`, `tests/e2e/bot-settings.spec.ts:208`, `tests/e2e/bot-settings.spec.ts:214`. Recommendation: extend `tests/e2e/bot-settings.spec.ts` on desktop and mobile to assert the new Tortila map heading, concrete per-coin/system/risk/capacity values, settings and setup placement, no horizontal scroll, and absence of `Connection verified`, `applyConfig`, `startBot`, `stopBot`, `retest`, raw provider text, URLs, and secret-shaped text. Target part: rendered acceptance.
3. Severity: High. Static guardrails already pin the shared bot control/readiness boundaries but only pin Tortila table basics, not a new Tortila strategy/capacity map. Evidence: `tests/integration/bot-config-review-static.test.ts:220`, `tests/integration/bot-config-review-static.test.ts:233`, `tests/integration/bot-config-review-static.test.ts:236`, `tests/integration/bot-read-safety-static.test.ts:393`, `tests/integration/bot-read-safety-static.test.ts:401`, `tests/integration/bot-read-safety-static.test.ts:406`, `tests/integration/bot-read-safety-static.test.ts:429`. Recommendation: add focused static assertions for the new Tortila map strings/helper names, settings/setup/admin-default wiring, source-order before detailed edit rows when intended, and no unsafe tokens in the map surface. Target part: `bot-config-review-static.test.ts` and `bot-read-safety-static.test.ts`.
4. Severity: High. Existing mutation hardening rejects secret/provider/raw/live-control hidden fields before parsing or persistence, and tests verify no form parsing or persistence happens when forbidden fields appear. Evidence: `apps/web/src/features/bots/config-action-handler.ts:51`, `apps/web/src/features/bots/config-action-handler.ts:92`, `apps/web/src/features/bots/config-action-handler.ts:167`, `tests/integration/bot-config-action-handler.test.ts:155`, `tests/integration/bot-config-action-handler.test.ts:160`, `tests/integration/bot-config-action-handler.test.ts:163`, `tests/integration/bot-config-action-handler.test.ts:165`, `tests/integration/bot-config-action-handler.test.ts:361`. Recommendation: keep the Tortila summary route-only/read-only; if any draft controls add form fields, they must reuse current safe field names and the forbidden-field test must be extended before merge. Target part: config save action boundary.
5. Severity: High. Runtime sanitization strips raw runtime, URL/header, secret, provider, and live-control keys; Legacy has narrow masked provider identity exceptions, but Tortila should not inherit Legacy provider semantics. Evidence: `apps/web/src/features/bots/runtime-config-sanitizer.ts:3`, `apps/web/src/features/bots/runtime-config-sanitizer.ts:20`, `apps/web/src/features/bots/runtime-config-sanitizer.ts:22`, `apps/web/src/features/bots/runtime-config-sanitizer.ts:29`, `apps/web/src/features/bots/runtime-config-sanitizer.ts:59`, `apps/web/src/features/bots/runtime-config-sanitizer.ts:67`, `tests/integration/bot-runtime-config-sanitizer.test.ts:30`, `tests/integration/bot-runtime-config-sanitizer.test.ts:79`, `tests/integration/bot-runtime-config-sanitizer.test.ts:84`, `docs/handoffs/20260603-2209-phase-3-80-tortila-fleet-identity.md:84`, `docs/handoffs/20260603-2209-phase-3-80-tortila-fleet-identity.md:85`. Recommendation: the Tortila summary should derive readiness/capacity from WTC config rows plus existing readiness DTOs, not `providerPubId`, `providerAccounts`, raw runtime config, URLs, headers, or journal/provider payloads. Target part: secret/provider/live-state boundary.
6. Severity: Medium. `config-review.ts` already has safe Tortila facts for a capacity/readiness summary: system mix, risk profile, max open symbols, max total units, daily loss, drawdown halt, entry throttle, and a footnote that exchange keys and live exchange pings are separate. Evidence: `apps/web/src/features/bots/config-review.ts:122`, `apps/web/src/features/bots/config-review.ts:131`, `apps/web/src/features/bots/config-review.ts:132`, `apps/web/src/features/bots/config-review.ts:133`, `apps/web/src/features/bots/config-review.ts:138`, `apps/web/src/features/bots/config-review.ts:150`, `apps/web/src/features/bots/config-review.ts:151`, `apps/web/src/features/bots/config-review.ts:158`. Recommendation: compute the Tortila map/readiness/capacity from the same reviewed config model, preferably through a pure helper with static and unit-style assertions, instead of duplicating ad hoc math in JSX. Target part: Tortila summary calculations.
7. Severity: Medium. Settings/setup already load `tortilaRows`, `configReview`, and readiness DTOs before rendering the current control center and table; adding new backend, provider, adapter, or DB reads is unnecessary for this slice. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:191`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:207`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:218`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:249`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:198`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:214`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:223`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:269`. Recommendation: consume these existing props/DTOs only; if product wants runtime proof, open a separate audited provider/runtime phase. Target part: page data access.
8. Severity: Medium. Phase protocol and the latest handoff both require honest gate reporting and preserve the no-live-operation boundary. Evidence: `AGENTS.md:42`, `AGENTS.md:48`, `AGENTS.md:57`, `AGENTS.md:76`, `AGENTS.md:77`, `AGENTS.md:81`, `docs/SESSION_PROTOCOL.md:34`, `docs/SESSION_PROTOCOL.md:54`, `docs/SESSION_PROTOCOL.md:83`, `docs/handoffs/20260604-0900-phase-4-06-legacy-trigger-resolution-map.md:48`, `docs/handoffs/20260604-0900-phase-4-06-legacy-trigger-resolution-map.md:75`. Recommendation: implementation acceptance must list exactly which focused tests ran and explicitly list live apply, exchange ping, provider DB, worker tick, env/secret, SSH/tmux/systemd, deploy, and broad CI as not run when they remain out of scope. Target part: phase handoff and final report.
## Decisions
1. Treat the Tortila strategy map/readiness/capacity summary as a presentation/test-hardening slice over WTC config rows and existing readiness DTOs.
2. Do not recommend new loaders, route handlers, repositories, provider reads, adapter calls, worker ticks, exchange pings, or live-control actions for this slice.
3. Use `tests/e2e/bot-settings.spec.ts` as the rendered gate for both settings and setup, with desktop and mobile projects.
4. Use `bot-config-review-static.test.ts` and `bot-read-safety-static.test.ts` as the source/string safety gates for the new map.
5. Keep `bot-config-action-handler.test.ts` and `bot-runtime-config-sanitizer.test.ts` in the focused gate stack to prevent hidden live-control fields and unsafe runtime/provider/secret leakage.
## Risks
1. A phrase like live capacity, running config, synced, next, or connection verified can turn an advisory WTC draft summary into a false live-state claim.
2. Client-side draft summaries can be spoofed or stale like any browser UI; they must never become entitlement, persistence, provider, or live-control authority.
3. Tortila does not currently have the same approved provider identity semantics as Legacy; copying Legacy `pub_id` wording into Tortila would mislead users and weaken tests.
4. Static string tests can become brittle if they assert too much prose; keep them focused on safety-critical labels, helper names, source wiring, and forbidden tokens.
5. The working tree was already heavily dirty before this audit, so implementation acceptance should re-check branch/status and avoid attributing unrelated changes to Phase 4.07.
## Verification/tests
1. Read-only inspection was performed with `rg`, `Get-ChildItem`, `git status --short --branch`, and targeted source/test searches.
2. No Vitest, Playwright, typecheck, lint, build, secret scan, governance check, coverage, or full CI was run in this audit; no product/test code was changed by this auditor.
3. Recommended focused static gate after implementation:
   `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-action-handler.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts`
4. Recommended rendered gate after implementation:
   `npm run e2e -- tests/e2e/bot-settings.spec.ts --project=desktop`
   `npm run e2e -- tests/e2e/bot-settings.spec.ts --project=mobile`
5. Recommended compile/lint gate after implementation:
   `npm exec tsc -- -p apps/web/tsconfig.json --noEmit`
   `npm exec eslint -- apps/web/src/features/bots/TortilaSymbolConfigTable.tsx apps/web/src/features/bots/config.ts apps/web/src/features/bots/config-review.ts apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx tests/e2e/bot-settings.spec.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts`
6. Recommended repository safety gate after implementation:
   `npm run secret:scan`
   `npm run governance:check`
7. Gates intentionally not run or not recommended for this read-only slice: live bot start/stop/apply/retest, position close, live exchange ping, worker tick, provider DB read/write, raw provider payload inspection, env/secret value inspection, SSH, tmux, systemd, production/canary mutation, deploy, full e2e matrix, coverage, and full CI.
## Next actions
1. Add the Tortila summary as a pure UI/config-review surface fed by `tortilaRows`, `configReview`, `sourceLabel`, and existing readiness DTOs.
2. Add static assertions that the summary appears in settings/setup/admin-default wiring if applicable, uses WTC reference/draft wording, and excludes unsafe tokens: `Connection verified`, `applyConfig`, `startBot`, `stopBot`, `restartBot`, `retest`, `testExchange`, `providerPubId`, `providerAccountId`, `providerAccounts`, `rawJson`, `liveConfig`, `legacyDatabaseUrl`, `apiSecret`, `apiKey`, `sealed`, `headers`, and raw `https://` URLs.
3. Add rendered assertions for Tortila settings and setup: map heading, concrete row/system/risk/capacity/readiness values, saved-vs-unsaved wording, no unsafe live-control text, and no horizontal scroll on desktop/mobile.
4. If the map is draft-aware before save, test at least one unsaved edit that changes displayed map/capacity values before submit. If the map is saved-reference-only, make the copy explicit and test that wording.
5. Keep live/provider/runtime proof out of Phase 4.07 unless a separate security and bot-integration phase authorizes it.
