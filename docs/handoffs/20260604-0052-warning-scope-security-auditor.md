# warning-scope-security-auditor handoff
## Scope
Read-only Phase 3.86 security/scope audit for proposed warning summary wiring across admin fleet, admin user bot drilldown, and cabinet/user surfaces.

Focus boundaries:
1. Warning summaries must be canonical-code-only.
2. Admin user drilldown must not read `bot_metric_snapshots.raw_json` / `schema.botMetricSnapshots.rawJson` to build warnings.
3. Entitlements must fail closed and must not be inferred from warning/readiness state.
4. Warning summaries must not introduce live-control semantics.
5. Warning summaries must not render, log, store, or screenshot plaintext secrets, provider raw JSON, provider-origin free text, or raw provider error bodies.
6. Warning summaries must not expose provider-origin `quarantineReason` / `quarantineReasons`; use canonical `legacy_quarantined` only.

No product code or test code was edited. No provider DB, `.env`, secrets, live bots, SSH, tmux, systemd, worker ticks, or live controls were read or mutated.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0049-phase-3-85-bot-warning-normalization.md`
8. `docs/handoffs/20260603-2356-phase-3-84-bot-readiness-server-dto.md`
9. `packages/bot-adapters/src/warnings.ts`
10. `apps/web/src/features/admin/health-detail.ts`
11. `apps/web/src/features/admin/bot-health-loader.ts`
12. `apps/web/src/features/admin/types.ts`
13. `apps/web/src/features/admin/user-bot-detail-loader.ts`
14. `apps/web/src/app/admin/bots/page.tsx`
15. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
16. `apps/web/src/features/bots/data.tsx`
17. `tests/integration/admin-health-detail.test.ts`
18. `tests/integration/admin-bot-health-loader.test.ts`
19. `tests/integration/admin-user-bot-detail-static.test.ts`
20. `tests/integration/admin-user-bot-detail-loader.test.ts`
21. `tests/integration/bot-read-safety-static.test.ts`

## Files changed
None - read-only audit

## Findings
1. High - Canonical-code-only is the primary Phase 3.86 gate. Evidence: `packages/bot-adapters/src/warnings.ts:12` defines the only canonical warning code list, `packages/bot-adapters/src/warnings.ts:29` exposes `isCanonicalWarningCode`, `apps/web/src/features/admin/health-detail.ts:75` drops non-canonical warning strings, and the Phase 3.85 handoff explicitly requires warning summaries to use canonical codes only at `docs/handoffs/20260604-0049-phase-3-85-bot-warning-normalization.md:54`. Forbidden patterns: rendering `detail.warnings` / `detail.warningCodes` strings directly, local page-level warning title/detail maps, `title={code}` fallbacks, unknown-code "redacted" display, or any provider text becoming summary copy. Recommendation: add a shared `warningsFromCodes(productCode, codes)` helper in `@wtc/bot-adapters` that returns only registry-backed `RiskWarning` objects and includes canonical `legacy_quarantined`; require every Phase 3.86 callsite to import it. Target part: warning summary DTO/helper.
2. High - Admin user bot drilldown must not copy the admin fleet rawJson pattern. Evidence: fleet-level `loadAdminBotHealthFromDb` currently selects `schema.botMetricSnapshots.rawJson` at `apps/web/src/features/admin/bot-health-loader.ts:209` for Legacy fleet inspector data, while the user drilldown static guard already forbids `schema.botMetricSnapshots.rawJson` at `tests/integration/admin-user-bot-detail-static.test.ts:43`. The general user bot read model also reads raw metric JSON at `apps/web/src/features/bots/data.tsx:413` and `apps/web/src/features/bots/data.tsx:540`, so importing that model into admin user drilldown would cross the requested boundary. Forbidden patterns: `schema.botMetricSnapshots.rawJson`, `rawMetric`, `liveConfig`, `loadBotReadModelForUser`, `loadBotReadModel`, `JSON.stringify(metric.rawJson)`, or `schema.botTradeImports.rawJson` inside `apps/web/src/features/admin/user-bot-detail-loader.ts` or the admin user bot page. Recommendation: source admin user warning summaries from sanitized integration health detail plus the canonical helper, or from explicit future scalar columns, never from metric/trade raw JSON. Target part: `/admin/users/[userId]/bots` loader and page.
3. High - Provider-origin free text must not become warning copy. Evidence: Phase 3.85 removed Legacy retained `quarantineReasons` from health detail and declared retained warning evidence code/count-only at `docs/handoffs/20260604-0049-phase-3-85-bot-warning-normalization.md:53`; admin projection consumes and deletes input `warningCodes` at `apps/web/src/features/admin/health-detail.ts:96` and `apps/web/src/features/admin/health-detail.ts:98`. Existing fleet DTO still carries `quarantineReason` as a field at `apps/web/src/features/admin/types.ts:334`, so Phase 3.86 must not use it for summaries. Forbidden patterns: `quarantineReason`, `quarantineReasons`, provider `error`, provider `message`, `readStateDetail`, raw provider body fields, or rendered `JSON.stringify(hc.detail)` as summary text. Recommendation: map provider quarantine to canonical `legacy_quarantined` only; warning detail/title must come from the registry, not from provider strings. Target part: admin fleet warning summary and admin user drilldown summary.
4. High - Entitlement fail-closed must remain independent of warning state. Evidence: AGENTS requires entitlements to fail closed at `AGENTS.md:82`, the session protocol repeats that entitlements are the only access source of truth at `docs/SESSION_PROTOCOL.md:83`, and the admin user loader currently computes `accessOpen` through `explainAccess` at `apps/web/src/features/admin/user-bot-detail-loader.ts:899` and `apps/web/src/features/admin/user-bot-detail-loader.ts:916`. Forbidden patterns: `accessOpen = warningSummary...`, showing user/cabinet warning data in a denied branch, treating "no warning codes" as access allowed, or making cabinet summaries outside the existing `decision.allowed` branch. Recommendation: for user-facing/cabinet surfaces, warning gathering must run only after entitlement allow; for admin-only drilldowns, summary must be diagnostic only and must not alter `accessOpen` or render access CTAs. Target part: cabinet/product cards, user bot pages, admin user bot DTO.
5. High - Warning summaries must not introduce live-control semantics. Evidence: AGENTS blocks live bot start/stop/apply-config until separate audits at `AGENTS.md:81`, admin fleet copy states no start/stop/applyConfig buttons at `apps/web/src/app/admin/bots/page.tsx:77`, and admin user drilldown shows `LIVE CONTROL: DISABLED` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:80`. Existing static tests forbid start/stop/apply in the admin user page at `tests/integration/admin-user-bot-detail-static.test.ts:94`. Forbidden patterns: `startBot`, `stopBot`, `applyConfig`, `retest`, `test connection`, `Connection verified`, "resolve warning", "clear warning", "retry provider", submit forms, `CsrfField`, or button CTAs that imply live runtime change. Recommendation: summary UI should be read-only facts plus links to existing read-only diagnostics only. Target part: warning summary React components/pages.
6. Medium - "No warnings" must not become a green safety claim. Evidence: the seed says known Tortila risk signals must surface as warnings and never hide behind a green card at `docs/handoffs/0000-orchestrator-seed.md:29`; Phase 3.85 asks to distinguish "no warning codes reported", "warning snapshot unavailable", and "read blocked/not configured" at `docs/handoffs/20260604-0049-phase-3-85-bot-warning-normalization.md:95`. Forbidden patterns: "all clear", "safe", "green", or hiding Tortila persistent P0/P1 when no live warning snapshot is available. Recommendation: make the DTO state explicit, for example `warnings_present | none_reported | unavailable | access_denied | read_blocked`; render unavailable/blocked as neutral or warning, never as OK. Target part: summary DTO state and empty-state copy.
7. Medium - Existing tests are close but need Phase 3.86-specific guards. Evidence: current static tests already assert canonical warning normalization at `tests/integration/bot-read-safety-static.test.ts:174`, `tests/integration/bot-read-safety-static.test.ts:176`, and `tests/integration/bot-read-safety-static.test.ts:177`, and admin user drilldown guards raw metric JSON at `tests/integration/admin-user-bot-detail-static.test.ts:43`. Recommendation: add focused guards rather than broad snapshots: a pure helper test for unknown/secret-shaped warning codes, a static test for new summary callsites/imports/forbidden patterns, a PGlite admin-user loader test proving rawJson markers do not leak into `warningSummary`, and a small admin page static/e2e check that the summary has no forms or live-control copy. Target part: Phase 3.86 acceptance.

## Decisions
1. Treat `packages/bot-adapters/src/warnings.ts` as the only warning registry for Phase 3.86.
2. `legacy_quarantined` should be elevated into the shared warning helper/registry output instead of remaining page-local to `apps/web/src/features/bots/data.tsx`.
3. Admin fleet may continue to have legacy rawJson-backed inspector behavior until separately refactored, but Phase 3.86 must not extend that rawJson dependency into `/admin/users/[userId]/bots`.
4. Warning summary DTOs should carry registry-backed `RiskWarning` fields and explicit availability/access state; they should not carry raw input codes, provider reasons, raw detail JSON, or provider account ids.
5. Unknown warning strings should be dropped and optionally counted as `unknownDroppedCount` for internal tests only; they should not render as user/admin copy.
6. No live control, no provider read/probe, no worker tick, no vault open, no exchange-key test, and no provider DB access is needed to implement or verify Phase 3.86.

## Risks
1. `apps/web/src/features/admin/bot-health-loader.ts` still reads Legacy metric `rawJson` for the fleet inspector; any implementer could accidentally reuse that logic for user drilldown warnings.
2. `apps/web/src/features/admin/types.ts` exposes `quarantineReason` on `LegacyProviderAccountAdminView`; a warning summary implementation could accidentally render provider-origin free text from that field.
3. `apps/web/src/features/bots/data.tsx` has local warning normalization and raw metric JSON parsing in the same module; reusing it for admin user drilldown would be too broad for the requested boundary.
4. Existing admin fleet health table still renders truncated `JSON.stringify(hc.detail)`; the new warning summary should not treat that table as the target pattern.
5. Full test/build gates were not run because this was a read-only scope/security audit.

## Verification/tests
RUN:
1. Required protocol and status docs were read first: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260604-0049-phase-3-85-bot-warning-normalization.md`.
2. Static search for warning summary, warning-code, rawJson, quarantine, live-control, provider-free-text, and secret/logging patterns across `apps`, `packages`, and `tests/integration`.
3. Confirmed the requested handoff path did not already exist before writing.
4. Confirmed the workspace is git-backed with `git rev-parse --show-toplevel`.

NOT RUN:
1. Product/test code edits - not run by scope.
2. Vitest, Playwright, typecheck, lint, build, secret scan, governance check - not run because this auditor produced only a read-only handoff.
3. `.env`, secrets, provider DBs, live bots, SSH, tmux, systemd, worker ticks, live controls, exchange pings, screenshots - not read or run by policy.

Recommended Phase 3.86 guards:
1. `packages/bot-adapters/src/warnings.test.ts` - `warningsFromCodes(productCode, codes)` returns only canonical registry-backed warnings, dedupes, includes `legacy_quarantined`, drops unknown and secret-shaped strings, and never returns raw code strings as titles.
2. `tests/integration/warning-summary-static.test.ts` - new summary helpers/pages do not contain `rawJson`, `rawMetric`, `liveConfig`, `quarantineReason`, `quarantineReasons`, `JSON.stringify(hc.detail)`, `fetch(`, `getBotAdapter`, `vault.open`, `exchangeApiKeySecrets`, `apiKey`, `apiSecret`, `sealed`, `token`, `startBot`, `stopBot`, `applyConfig`, `retest`, `type="submit"`, `CsrfField`, `Connection verified`, `all clear`, or `safe`.
3. Extend `tests/integration/admin-user-bot-detail-static.test.ts` - keep forbidding `schema.botMetricSnapshots.rawJson` and add assertions that the admin user loader uses the shared warning helper, not `loadBotReadModelForUser`.
4. Extend `tests/integration/admin-user-bot-detail-loader.test.ts` - seed health `warningCodes` with canonical, unknown, secret-shaped, and provider free-text markers plus metric/trade `rawJson` leak markers; assert `warningSummary` contains only registry titles/details and no markers.
5. Extend `tests/integration/admin-bot-health-loader.test.ts` / `admin-health-detail.test.ts` - prove summary counts come from projected `warnings`, not `warningCodes`, `quarantineReason`, `error`, or `message`.
6. Extend `tests/integration/bot-read-safety-static.test.ts` / `cabinet-pg9.test.ts` - prove cabinet warning summary is gathered only inside entitlement-allowed paths and unavailable/denied states do not render green safety copy.
7. Optional focused Playwright: `/admin/bots` and `/admin/users/[userId]/bots` render the summary card without horizontal overflow, without forms/buttons implying live control, and without raw JSON text.

## Next actions
1. Implement the shared warning helper first, then wire admin fleet and admin user drilldown DTOs to that helper.
2. Keep Phase 3.86 to warning summary DTO/render plus tests/static guards; do not bundle provider DB work, worker ticks, live controls, or raw inspector refactors.
3. After implementation, run the focused helper/static/PGlite tests, web typecheck, `npm run secret:scan`, and `npm run governance:check`; list any broader gates not run in the aggregate phase handoff.
