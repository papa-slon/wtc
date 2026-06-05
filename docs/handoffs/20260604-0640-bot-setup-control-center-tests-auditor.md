# bot-setup-control-center-tests-auditor handoff
## Scope
Read-only Phase 4.00 tests/rendered audit for adding a top-level setup/control center summary to the user bot setup and settings pages.

Inspected the existing static and rendered guardrails around bot setup, settings, readiness, config review, config actions, runtime config sanitization, and responsive/mobile behavior. This audit recommends focused gates and assertion targets only. It did not edit product code, run live services, inspect env/vault/secret files, mutate provider DBs, or start/stop/apply/retest any bot.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0629-phase-3-99-admin-selected-user-drilldown-overview.md`
8. `docs/handoffs/20260604-0410-bot-settings-rendered-tests-auditor.md`
9. `docs/handoffs/20260604-0410-bot-settings-rendered-ux-auditor.md`
10. `docs/handoffs/20260604-0214-phase-3-88-bot-settings-effective-review.md`
11. `docs/handoffs/20260604-0559-phase-3-97-bot-operation-map.md`
12. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
13. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
14. `apps/web/src/features/bots/BotReadinessMap.tsx`
15. `apps/web/src/features/bots/BotOperationMapPanel.tsx`
16. `apps/web/src/features/bots/BotConfigReviewPanel.tsx`
17. `apps/web/src/features/bots/WarningSummaryPanel.tsx`
18. `apps/web/src/features/bots/readiness.ts`
19. `apps/web/src/features/bots/readiness-loader.ts`
20. `apps/web/src/features/bots/config-review.ts`
21. `apps/web/src/features/bots/config-action-handler.ts`
22. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
23. `packages/ui/src/theme.css`
24. `tests/integration/bot-read-safety-static.test.ts`
25. `tests/integration/bot-config-review-static.test.ts`
26. `tests/integration/bot-config-action-handler.test.ts`
27. `tests/integration/bot-runtime-config-sanitizer.test.ts`
28. `tests/integration/admin-responsive.test.ts`
29. `tests/e2e/bot-settings.spec.ts`
30. `tests/e2e/admin-mobile-pg8.spec.ts`
31. `package.json`
32. `apps/web/package.json`
33. `playwright.config.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. The setup/settings pages already load the safest inputs needed for a top summary, so the first implementation should be presentation-only over existing state rather than adding a new adapter/provider read. Evidence: settings loads `state`, `legacyRead`, `exchangeKeys`, and `readiness` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:191`, builds `configReview` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:217`, and setup loads `keys`, `cfg`, `legacyRead`, and `readiness` at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:198` before building its review at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:222`. Recommendation: implement the control center as a pure component fed by existing config-review, readiness, source, key-count, and provider-mapping summaries. Target part: user setup/settings UI.
2. Severity: High. The top-level summary should sit before the detailed maps/forms and get source-order assertions. Evidence: settings currently renders the page header at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:243`, subnav at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:246`, readiness map at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:262`, config source at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:300`, and review/map details at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:394`; setup similarly renders the header at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:237`, setup source at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:302`, review at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:353`, and readiness/review-step details at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:553`. Recommendation: add static checks that the new summary component appears after header/subnav and before `BotReadinessMap`, `Setup source`, or the first edit form. Target part: source layout and first-viewport rendered acceptance.
3. Severity: High. The summary must not imply live bot control or connection verification. Evidence: readiness construction uses `Live apply` or `Live control` labels at `apps/web/src/features/bots/readiness.ts:178` and disabled values at `apps/web/src/features/bots/readiness.ts:215`, settings repeats `no live apply, start, stop, or retest` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:308`, setup warns that live control stays disabled at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:573`, and current rendered checks forbid `Connection verified` on settings/setup at `tests/e2e/bot-settings.spec.ts:37`, `tests/e2e/bot-settings.spec.ts:85`, and `tests/e2e/bot-settings.spec.ts:102`. Recommendation: assert the summary contains disabled live-control language and never contains `Connection verified`, `applyConfig`, `startBot`, `stopBot`, `retest`, or exchange-ping-success wording. Target part: safety copy and rendered page assertions.
4. Severity: High. If the control center includes forms, hidden fields, or CTAs, it can reopen a path current action tests deliberately close. Evidence: `tests/integration/bot-config-action-handler.test.ts:154` checks forbidden hidden fields including `apiSecret`, `providerAccountId`, `providerPubId`, `rawJson`, `applyConfig`, `startBot`, `stopBot`, `retest`, and `liveControl`, while the handler blocks forbidden FormData before parsing at `apps/web/src/features/bots/config-action-handler.ts:167`, `apps/web/src/features/bots/config-action-handler.ts:198`, and `apps/web/src/features/bots/config-action-handler.ts:226`. Recommendation: keep the summary links-only or route-only; if it adds any form, extend the forbidden-key/no-persist tests before merging. Target part: server-action safety.
5. Severity: High. Runtime/provider data in the summary needs the existing safe views, not raw live config. Evidence: the runtime sanitizer forbids raw/provider/control keys at `apps/web/src/features/bots/runtime-config-sanitizer.ts:3`, `apps/web/src/features/bots/runtime-config-sanitizer.ts:20`, `apps/web/src/features/bots/runtime-config-sanitizer.ts:22`, and `apps/web/src/features/bots/runtime-config-sanitizer.ts:29`, masks Legacy provider identity at `apps/web/src/features/bots/runtime-config-sanitizer.ts:67`, and its test proves raw provider/control markers do not survive while masked provider ids can remain as read-only evidence at `tests/integration/bot-runtime-config-sanitizer.test.ts:30` and `tests/integration/bot-runtime-config-sanitizer.test.ts:79`. Recommendation: never pass `liveConfig.raw`, provider DB IDs, URLs, headers, or secret-shaped keys into the control center; use counts, source labels, masked pub_id context, and safe readiness/status DTOs. Target part: data boundary.
6. Severity: Medium. The rendered gate already covers the right user routes and should be extended rather than replaced. Evidence: `tests/e2e/bot-settings.spec.ts:20` through `tests/e2e/bot-settings.spec.ts:39` checks Tortila settings readiness, disabled live apply, exchange metadata copy, review/map sections, no `Connection verified`, no horizontal scroll, and screenshots; `tests/e2e/bot-settings.spec.ts:45` through `tests/e2e/bot-settings.spec.ts:70` does the Legacy settings pass; `tests/e2e/bot-settings.spec.ts:109` through `tests/e2e/bot-settings.spec.ts:134` covers setup for Tortila and Legacy. Recommendation: add desktop/mobile expectations for the new summary heading, four critical cells/cards, no unsafe text, order before forms, and no horizontal scroll to this same spec. Target part: rendered acceptance.
7. Severity: Medium. Responsive protection should follow the existing table/card-stack conventions, but `admin-responsive.test.ts` should remain admin-scoped unless shared CSS or admin pages are touched. Evidence: `admin-responsive.test.ts` declares itself an admin mobile-readability static guard at `tests/integration/admin-responsive.test.ts:2` and `tests/integration/admin-responsive.test.ts:8`; shared table conventions live in `packages/ui/src/theme.css:114` through `packages/ui/src/theme.css:182`; current bot summary/map components already use `wtc-table-wrap` plus `data-label` at `apps/web/src/features/bots/BotReadinessMap.tsx:31` and `apps/web/src/features/bots/BotConfigReviewPanel.tsx:30`. Recommendation: for a user-page summary, rely on `bot-settings.spec.ts` no-horizontal-scroll plus a focused static check for `wtc-grid`/`wtc-table-wrap`/`data-label` if a table is introduced; run `admin-responsive.test.ts` only if shared UI CSS or admin pages change. Target part: mobile stability.

## Decisions
1. Do not recommend a new live/provider/e2e DB gate for this slice unless the implementation intentionally adds new DB-backed summary facts.
2. Prefer one pure `BotSetupControlCenterSummary` style component, or equivalent, wired into both setup and settings pages using already-loaded safe DTOs.
3. Recommend static source-order assertions for placement because the requested feature is specifically top-level/first-viewport.
4. Recommend extending `tests/e2e/bot-settings.spec.ts` for rendered desktop/mobile proof because it already owns settings/setup screenshots and no-horizontal-scroll checks.
5. Treat `admin-responsive.test.ts` as a conditional shared-CSS/admin regression gate, not the primary user-page gate.
6. No tests were run in this audit; the current rendered spec writes screenshots and this read-only lane should leave the handoff as the only intentional file artifact.

## Risks
1. The worktree was already heavily dirty/untracked before this audit, including the target bot settings/setup files and tests.
2. A summary labelled "control center" can confuse users unless every live action is visibly disabled and phrased as WTC-side setup state, not bot runtime authority.
3. Adding warning or runtime status to setup/settings may broaden data reads; keep the first slice to existing readiness/config/source inputs unless a separate platform/security audit approves more.
4. Playwright starts a local Next e2e server and `tests/e2e/bot-settings.spec.ts` writes screenshots via `tests/e2e/bot-settings.spec.ts:4`, `tests/e2e/bot-settings.spec.ts:39`, `tests/e2e/bot-settings.spec.ts:70`, `tests/e2e/bot-settings.spec.ts:117`, and `tests/e2e/bot-settings.spec.ts:134`.
5. Prior rendered-gate handoffs note port/reuse and `.next-e2e` instability; use a fresh `E2E_PORT` and a clean serialized Playwright run before claiming rendered green.

## Verification/tests
RUN:
1. Protocol and seed documents were inspected.
2. Target static tests, e2e spec, page files, and relevant shared bot components were inspected.
3. `git status --short --branch` was checked before writing; branch was `codex/bot-analytics-settings-canary-20260603` with many pre-existing modified/untracked files.

NOT RUN:
1. `npm exec vitest -- run ...` - not run; this was a read-only recommendation audit.
2. `npm exec playwright -- test ...` - not run; it starts a local e2e dev server and writes screenshot artifacts.
3. `npm run preview:safe`, live services, SSH, tmux, systemd, env/vault/secret inspection, provider DB mutation, worker tick/restart, live bot start/stop/apply-config/retest, live exchange ping - not run by safety policy.
4. Full `npm test`, full `npm run lint`, web build, governance, and secret scan - not run; no product code was changed.

Recommended focused implementation gates:

```powershell
npm exec vitest -- run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-config-action-handler.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts
```

```powershell
npm exec vitest -- run tests/integration/admin-responsive.test.ts
```

Run the admin responsive gate only if the implementation touches shared UI CSS, admin routes, table/card-stack conventions, or `StatusPill`/table wrappers.

```powershell
$env:E2E_PORT = '3428'
npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=desktop --project=mobile --reporter=line
```

This is the focused rendered gate for the new summary. It should assert:
1. Tortila settings and Legacy settings show the new top-level summary before detailed settings/forms.
2. Tortila setup strategy/review and Legacy setup show the summary before the review/form sections.
3. Summary includes settings/setup source, exchange-key or provider-mapping state, disabled live apply/control, and config-review status.
4. Summary does not contain `Connection verified`, `applyConfig`, `startBot`, `stopBot`, `retest`, raw provider ids, raw JSON, URLs, headers, or secret-shaped text.
5. Desktop and mobile have no horizontal document scroll.

```powershell
npm exec tsc -- -p tsconfig.json --noEmit
npm exec tsc -- -p apps/web/tsconfig.json --noEmit
```

```powershell
npm exec eslint -- apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx apps/web/src/features/bots tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-config-action-handler.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts tests/e2e/bot-settings.spec.ts --max-warnings 0
```

```powershell
npm run secret:scan
npm run governance:check
git diff --check -- apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx apps/web/src/features/bots tests/integration tests/e2e/bot-settings.spec.ts docs/handoffs
```

## Next actions
1. Add the summary as a pure shared presentation component using existing safe setup/settings inputs.
2. Extend `bot-read-safety-static.test.ts` with source-order, no-live-control, no-raw-provider, and no-new-loader assertions.
3. Extend `bot-config-review-static.test.ts` only if a new summary builder derives config-review metrics.
4. Extend `bot-config-action-handler.test.ts` only if the summary introduces any form or action path.
5. Extend `bot-runtime-config-sanitizer.test.ts` only if the summary consumes sanitized runtime/provider evidence.
6. Extend `tests/e2e/bot-settings.spec.ts` with desktop/mobile summary visibility, ordering, safety text, no unsafe text, and no-horizontal-scroll checks.
7. Keep live bot/provider, env/vault/secret, and DB mutation gates out of this slice unless a later phase explicitly scopes and audits them.
