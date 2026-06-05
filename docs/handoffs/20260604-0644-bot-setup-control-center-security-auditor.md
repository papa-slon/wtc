# bot-setup-control-center-security-auditor handoff
## Scope
Phase 4.00 read-only security/data-boundary audit of the current user bot setup/settings surfaces and the proposed top-level setup/control center summary.

Inspected `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`, `settings/page.tsx`, bot config/readiness/control-center components, exchange-key metadata readiness, config action handling, backend/shared schema paths, and focused tests. Goal: verify the next slice can summarize setup/control state without leaking secrets or raw provider ids, without adding live start/stop/apply/retest, while preserving CSRF/RBAC/entitlements and distinguishing metadata checks from live exchange pings.

No live services, SSH, env/vault/secret inspection, provider DB mutation, worker tick/restart, exchange ping, live bot start/stop/apply/retest, or live bot control was run. Product code was not edited by this auditor.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0629-phase-3-99-admin-selected-user-drilldown-overview.md`
8. `docs/handoffs/20260604-0642-bot-setup-control-center-ux-auditor.md`
9. `docs/handoffs/20260604-0640-bot-setup-control-center-tests-auditor.md`
10. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
11. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
12. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
13. `apps/web/src/features/bots/BotReadinessMap.tsx`
14. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
15. `apps/web/src/features/bots/config-action-handler.ts`
16. `apps/web/src/features/bots/config.ts`
17. `apps/web/src/features/bots/config-types.ts`
18. `apps/web/src/features/bots/config-review.ts`
19. `apps/web/src/features/bots/readiness.ts`
20. `apps/web/src/features/bots/readiness-loader.ts`
21. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
22. `apps/web/src/lib/access.ts`
23. `apps/web/src/lib/backend.ts`
24. `apps/web/src/lib/csrf.tsx`
25. `apps/web/src/lib/db-store.ts`
26. `apps/web/src/lib/vault.ts`
27. `packages/db/src/repositories.ts`
28. `packages/shared/src/schemas.ts`
29. `tests/integration/bot-read-safety-static.test.ts`
30. `tests/integration/bot-readiness-server-dto-static.test.ts`
31. `tests/integration/bot-config-action-handler.test.ts`
32. `tests/integration/bot-config-review-static.test.ts`
33. `tests/integration/bot-runtime-config-sanitizer.test.ts`
34. `tests/e2e/bot-settings.spec.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. The control center is currently wired into both user setup and settings pages, but it must remain presentation-only over already-loaded safe facts. Evidence: settings renders `BotSetupControlCenter` with scalar props at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:248`; setup renders it before the setup source/action area at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:268`; the component renders links/read-only cells only at `apps/web/src/features/bots/BotSetupControlCenter.tsx:176`. Recommendation: keep the slice links-only/no forms; if a form is added, extend `tests/integration/bot-config-action-handler.test.ts` before merging. Target part: `BotSetupControlCenter.tsx`, setup/settings pages.
2. Severity: High. Existing mutation boundaries are appropriate and should be reused, not bypassed by the summary. Evidence: settings/setup server actions call `assertCsrf(formData)` before config mutations at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:138` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:143`; `assertCsrf` fails closed at `apps/web/src/lib/csrf.tsx:31`; the shared handler resolves the bot and checks entitlement before persistence at `apps/web/src/features/bots/config-action-handler.ts:123`; forbidden FormData keys include secret/provider/live-control fields at `apps/web/src/features/bots/config-action-handler.ts:51`. Recommendation: do not add new server actions for the control center; route to existing setup/settings anchors only. Target part: server-action safety.
3. Severity: High. The readiness data boundary is safe only if the control center consumes DTO/count/state summaries, not raw adapter or provider payloads. Evidence: `loadBotReadinessForUser` checks access and returns hidden/zeroed data when access is denied at `apps/web/src/features/bots/readiness-loader.ts:123`; exchange readiness summarizes account/secret metadata counts without selecting sealed payloads at `packages/db/src/repositories.ts:415`; Legacy provider readiness selects only timestamps/counts scoped to the user's bot instance at `packages/db/src/repositories.ts:1849`. Recommendation: pass `exchangeKeyState` and `providerPubIdState` or existing readiness rows into the control center; do not pass `legacyLiveConfig`, `providerAccounts`, `raw`, `rawJson`, or adapter reads. Target part: control-center props and readiness-loader usage.
4. Severity: High. Exchange-key checks are metadata/vault checks, not live exchange pings, and current code preserves that distinction. Evidence: `ExchangeKeyReadinessPanel` says no live ping is claimed at `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:58`, the future exchange-ping button is disabled at `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:123`, and the DB check records `checkKind: 'sealed_metadata_only'` plus `livePing: false` at `packages/db/src/repositories.ts:473`. Recommendation: control-center copy/tests should say "WTC vault metadata" or "metadata saved/confirmed", never "connection verified"; add static assertions against `Connection verified`, `fetch(`, `getBotAdapter`, `exchange_key.test`, and live-control tokens in the control-center source. Target part: metadata readiness semantics.
5. Severity: High. Secret handling remains sealed/masked today, but the control center must not broaden its inputs. Evidence: `db-store.addExchangeKey` seals `{ apiKey, apiSecret }` before repository persistence at `apps/web/src/lib/db-store.ts:110`; `listExchangeKeys` never joins secret rows and returns only `keyMask` at `packages/db/src/repositories.ts:404`; runtime config sanitizer strips secret/provider/raw/live-control keys at `apps/web/src/features/bots/runtime-config-sanitizer.ts:3`. Recommendation: only render counts, `keyMask`, source labels, and sanitized readiness/status DTOs; never render `apiKey`, `apiSecret`, `sealed`, `wrappedDek`, URLs, headers, raw JSON, or vault internals. Target part: setup/settings summary data props.
6. Severity: Medium. Legacy provider identity is mostly contained, but the adjacent settings page still materializes raw `pubId` in a local view before masking it for display. Evidence: `legacyProviderAccounts` reads `row.pubId` into `LegacyProviderAccountView` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:81`; the table display uses `shortPubId(account.pubId)` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:442`; the control center currently receives only `providerAccountCount` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:258`. Recommendation: do not pass `legacyAccounts` or raw provider ids into the control center; if provider identity is ever shown there, derive it from a masked DTO/repository summary first. Target part: Legacy provider boundary.
7. Severity: Medium. Residual page copy still contains the exact word `retest` outside the control-center component. Evidence: settings renders `sub="no live apply, start, stop, or retest"` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:308`; the control center itself now uses "live diagnostics" instead of `retest` at `apps/web/src/features/bots/BotSetupControlCenter.tsx:127`; static tests forbid `retest` in readiness/control-center sources at `tests/integration/bot-read-safety-static.test.ts:125`. Recommendation: either replace the settings metric with "no live-control adapter actions" or add a source-order scoped test proving the new top summary contains no `startBot`, `stopBot`, `applyConfig`, `retest`, or "Connection verified". Target part: safety copy and tests.
8. Severity: Medium. Focused local tests are green for the current tree, but rendered first-viewport/mobile proof was not run in this read-only lane. Evidence: `tests/e2e/bot-settings.spec.ts:20` covers Tortila settings, `tests/e2e/bot-settings.spec.ts:45` covers Legacy settings, and `tests/e2e/bot-settings.spec.ts:106` covers setup; this audit did not start the Playwright dev server. Recommendation: implementation acceptance should run desktop/mobile `tests/e2e/bot-settings.spec.ts` plus source-order/no-unsafe-text assertions before claiming the top-level summary is visually accepted. Target part: rendered acceptance.

## Decisions
1. Treat the next slice as presentation/test hardening over existing setup/settings state, not a backend/provider/live-control slice.
2. Keep `BotSetupControlCenter` as the canonical top-level summary component because it is already wired into both user surfaces.
3. Require metadata-only wording for exchange-key readiness; no live exchange ping, no connection-verified claim.
4. Require count/state/DTO inputs for provider and key readiness; no raw provider id, raw config, sealed secret, or vault internals.
5. Do not recommend new DB/provider/adapter reads for this slice.

## Risks
1. The branch is `codex/bot-analytics-settings-canary-20260603` and the worktree was already heavily dirty/untracked before this audit, including target setup/settings files and many handoffs.
2. The target files changed during/around this audit window; line evidence and tests reflect the current filesystem after the final focused rerun.
3. A summary named "control center" can be misunderstood as authority to operate a bot unless the disabled-live-action boundary stays visible.
4. The current audit covers local code/static boundaries only; it does not prove production deploy state, provider reachability, or rendered browser UX.

## Verification/tests
RUN:
1. Read protocol/seed/status docs and recent relevant handoffs.
2. Inspected current setup/settings pages, control-center, readiness, exchange-key readiness, config-action handler, backend/shared schema paths, and focused tests using read-only shell commands.
3. `npm exec vitest -- run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/bot-config-action-handler.test.ts` - PASS, 3 files, 42 tests.
4. `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts` - PASS, 2 files, 4 tests.
5. Checked current handoff path before writing.

NOT RUN:
1. Playwright/e2e - not run because it starts a local web server and writes screenshots; implementation should run focused desktop/mobile rendered gates separately.
2. Full `npm test`, lint, typecheck, build, secret scan, coverage, governance - not run; this was a focused read-only security/data-boundary audit.
3. Live services, SSH, tmux, systemd, env/vault/secret inspection, provider DB mutation, worker tick/restart, live exchange ping, live bot start/stop/apply/retest/control - not run by scope.
4. Git staging, commit, push, or PR - not requested.

## Next actions
1. Keep the implementation as one pure control-center hardening slice using existing `configReview`, readiness DTOs, source labels, key counts/states, and provider mapping counts/states.
2. Add/extend tests for source order, no forms/actions in the summary, no raw provider ids/secrets/raw JSON, metadata-only exchange readiness, and absence of live-control action tokens.
3. Replace or scope residual `retest` copy on settings before using page-level no-live-control text assertions.
4. Run focused rendered acceptance for `tests/e2e/bot-settings.spec.ts` on desktop/mobile only after the implementation pass deliberately starts a local e2e server.
