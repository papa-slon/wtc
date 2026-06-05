# bot-readiness-map-platform-security-auditor handoff
## Scope
Phase 3.82 read-only platform/security audit for a safe WTC bot readiness map and cabinet setup signal clarity.

This audit inspected the current user bot dashboard, settings, setup, cabinet, admin user-bot detail, admin bot fleet, DB schema/repository, and static test boundaries for a future readiness map that clarifies:

1. Access entitlement.
2. Exchange key and vault metadata.
3. Strategy config source.
4. Runtime/provider snapshot source.
5. Statistics readiness.
6. Live-control disabled state.

Safety scope followed the operator constraints: no live exchange ping, no bot start/stop/apply/retest, no worker tick/restart, no SSH/tmux/systemd, no `.env` read/write, no provider DB live read/write, and no product/test/docs edits except this handoff.

This is one requested read-only auditor handoff, not an aggregate N-agent phase. No N-agent claim is made. No background agents were launched in this lane; none are left running.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/handoffs/20260603-2236-phase-3-81-exchange-key-readiness.md`
5. `docs/STATUS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/NEXT_ACTIONS.md`
8. `apps/web/src/features/cabinet/loader.ts`
9. `packages/cabinet/src/derive.ts`
10. `packages/cabinet/src/derive.test.ts`
11. `apps/web/src/features/bots/BotReadinessMap.tsx`
12. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
13. `apps/web/src/features/bots/data.tsx`
14. `apps/web/src/features/bots/config.ts`
15. `apps/web/src/features/bots/statistics-panels.tsx`
16. `apps/web/src/app/(app)/app/bots/page.tsx`
17. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
18. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
19. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
20. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
21. `apps/web/src/app/(app)/app/security/page.tsx`
22. `apps/web/src/features/admin/queries.ts`
23. `apps/web/src/features/admin/user-bot-detail-loader.ts`
24. `apps/web/src/features/admin/bot-health-loader.ts`
25. `apps/web/src/features/admin/health-detail.ts`
26. `apps/web/src/features/admin/types.ts`
27. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
28. `apps/web/src/app/admin/bots/page.tsx`
29. `packages/db/src/schema.ts`
30. `packages/db/src/repositories.ts`
31. `apps/web/src/lib/backend.ts`
32. `apps/web/src/lib/db-store.ts`
33. `apps/web/src/lib/demo.ts`
34. `tests/integration/bot-read-safety-static.test.ts`
35. `tests/integration/admin-user-bot-detail-static.test.ts`
36. `tests/integration/admin-global-bot-config-static.test.ts`
37. `tests/integration/user-resolved-bot-config-static.test.ts`
38. `tests/e2e/bot-settings.spec.ts`

## Files changed
None - read-only audit. Required handoff only: `docs/handoffs/20260603-2240-bot-readiness-map-platform-security-auditor.md`.

## Findings
1. High - runtime readiness can currently turn bad/unknown read states green. Evidence: `apps/web/src/features/bots/data.tsx:165-166` recognizes `unreachable`, `malformed`, and `stale`; `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:51-54` only downgrades `stale`, `not_configured`, or mock mode and otherwise returns `ready`. Recommendation: make readiness status allowlist-only: only `readState === 'ok'` plus non-mock/fresh evidence may be `ready`; `unreachable`, `malformed`, null/unknown, and stale must be `blocked` or `attention`. Target part: bot dashboard readiness map and any cabinet readiness summary.

2. High - the current bot dashboard/settings loaders are too broad for cabinet-level readiness because they can deserialize runtime snapshot internals. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:127-145` loads `['metrics','positions','trades','config']`, reads `config.raw`, and derives provider account/slot/order facts; `apps/web/src/features/bots/data.tsx:363` selects `schema.botMetricSnapshots.rawJson`; `apps/web/src/features/bots/data.tsx:490-505` extracts `liveConfig` and returns it as `raw`; `packages/db/src/schema.ts:527` defines snapshot `rawJson`. Recommendation: add a narrow `loadBotReadinessForUser` server-only projection that excludes `rawJson`, `config.raw`, adapter calls, provider payload internals, and raw config JSON. Target part: user bot dashboard/settings/setup/cabinet readiness source.

3. High - exchange-key metadata readiness has the right safety boundary and should be reused as-is, not expanded into a live ping. Evidence: `packages/db/src/repositories.ts:404-407` lists only exchange account metadata and explicitly avoids joining secret material; `packages/db/src/repositories.ts:431-454` selects account metadata plus only the secret-row id marker and sets `checkKind: 'sealed_metadata_only'` with `livePing: false`; `packages/db/src/repositories.ts:459-473` writes only safe audit metadata. UI evidence: `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:60-61`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:72-73`, and `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:145-148` all avoid claiming live exchange connectivity. Recommendation: readiness map may show `vault metadata saved`, `metadata missing`, or `future ping unavailable`, but must not open the vault, decrypt, call adapters, call `fetch`, or label the state as connected/verified. Target part: exchange-key/vault readiness row.

4. High - entitlement fail-closed gating is already present and must remain the first readiness boundary. Evidence: `apps/web/src/features/cabinet/loader.ts:152-157` gathers per-product signals only inside `decision.allowed`; `apps/web/src/app/(app)/app/bots/page.tsx:19-20` loads bot read data only when access is allowed; `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:113-123` returns an access-required view before reading bot data. Recommendation: cabinet readiness must never load bot, key, config, provider, statistics, or activity signals for denied/non-active access; it should show entitlement state only. Target part: cabinet loader and any shared readiness service.

5. Medium - cabinet setup signals are safe but too compressed for the requested readiness map. Evidence: `packages/cabinet/src/derive.ts:37-44` supports setup checklist items, one activity line, and warnings; `packages/cabinet/src/derive.ts:208-216` correctly drops those signals when not allowed; `apps/web/src/features/cabinet/loader.ts:83-106` currently compresses key state and strategy source into setup items/activity text. Recommendation: extend the safe cabinet signal model or add a parallel readiness DTO with explicit rows for entitlement, key metadata, config source, runtime snapshot, statistics readiness, and live-control disabled state instead of overloading `activityLine`. Target part: `@wtc/cabinet` and `apps/web/src/features/cabinet/loader.ts`.

6. Medium - admin user-bot detail is RBAC-gated and read-only, but its current config summary still reads config JSON to derive safe summaries. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:61-82` requires admin and labels live control/user settings/provider mappings read-only; `tests/integration/admin-user-bot-detail-static.test.ts:88-97` guards against admin user-setting/control actions; however `apps/web/src/features/admin/user-bot-detail-loader.ts:785-790` selects `schema.botConfigs.config`, and `apps/web/src/features/admin/user-bot-detail-loader.ts:324-356` parses config values into a safe projection. Recommendation: if admin readiness map is implemented, keep it read-only and consider a narrow source/version/symbol-count summary that does not require selecting raw config JSON for the map itself. Target part: admin user-bot detail readiness projection.

7. Medium - admin user-bot detail has the safer provider-scoped pattern for user-specific runtime facts; admin fleet diagnostics should not be used as cabinet proof. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:615-632` filters Legacy rows by active mapped provider account; `apps/web/src/features/admin/user-bot-detail-loader.ts:644-675` builds scoped stats; `apps/web/src/features/admin/user-bot-detail-loader.ts:899-943` returns `providerScope` and `liveControlDisabled: true`. In contrast, `apps/web/src/features/admin/bot-health-loader.ts:203-230` reads Legacy snapshot `rawJson` and extracts fleet provider internals for admin diagnostics. Recommendation: user/cabinet readiness should follow the user-detail scoped summary pattern, not the admin fleet raw-diagnostic loader. Target part: runtime/provider snapshot readiness row.

8. Medium - visible readiness copy still exposes some internal runtime/config labels that are useful to engineers but noisy for users and risky for the requested clarity goal. Evidence: `apps/web/src/app/(app)/app/bots/page.tsx:38-48` renders internal runtime flag text in the user bot list; `apps/web/src/app/admin/bots/page.tsx:277` renders internal server configuration names in admin copy. Recommendation: new readiness-map copy should use product language such as `preview data`, `read-only worker snapshots`, `provider mapping pending`, and `server path configured/not configured`, and should not display server variable names, route URLs, stack traces, or provider DB connection labels. Target part: user bot list, bot readiness map, cabinet, and admin readiness copy.

## Decisions
1. Safety constraint: readiness map implementation should be a presentation of existing WTC-owned metadata and persisted snapshots only; it must not be a proof of live exchange connectivity or live bot operability.
2. Safety constraint: no admin-side readiness map should mutate user settings, provider mappings, exchange keys, live config, start/stop state, or open positions.
3. Safety constraint: readiness proofs must not read or expose sealed secrets, raw provider payloads, snapshot `rawJson`, raw config JSON, provider DB URLs, server env names, stack traces, or exchange adapter errors beyond the existing safe taxonomy.
4. The recommended source boundary is a narrow server-only DTO, not reuse of the existing full analytics read model.
5. Only explicit observed states should be green. Missing, stale, malformed, unreachable, demo/mock, or not-configured evidence must be `attention`/`blocked`/`read-only`.
6. Admin fleet diagnostics may remain a separate privileged diagnostics surface, but they should not be treated as cabinet/user readiness proof.

## Risks
1. Without fixing the read-state mapper, a malformed/unreachable persisted health state can be presented as `ready`, which breaks the no-false-green rule.
2. Reusing `loadBotReadModelForUser(..., ['config'])` for cabinet readiness could pull raw snapshot/config internals into a user-facing readiness surface.
3. Reusing admin fleet health for user/cabinet readiness could blur fleet diagnostics with user-owned provider scope.
4. Extending the cabinet model by stuffing multiple readiness facts into a single activity line will be hard to test and easy to misread.
5. Internal runtime/config names in copy can make users believe they are expected to configure infrastructure and can leak operational shape unnecessarily.

## Verification/tests
RUN:
1. Required docs/protocol reads: PASS - `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, and `docs/handoffs/20260603-2236-phase-3-81-exchange-key-readiness.md`.
2. Session status/doc reads: PASS - `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`.
3. Static source inspection: PASS - cabinet, bot dashboard, bot settings/setup, exchange-key readiness, admin user-bot detail, admin bot fleet, DB schema/repositories, backend selector, and relevant static/e2e test files listed above.
4. Git state read: PASS - `git rev-parse --show-toplevel` showed the expected repo root. `git status --short` showed a dirty tree with many pre-existing product/docs/test changes before this handoff; this auditor did not modify them.

NOT RUN:
1. `npm test`, lint, typecheck, build, e2e, secret scan, and governance check - not run because this was a read-only audit with no product/test code changes and tests may write generated artifacts/logs.
2. Live exchange ping/test - not run by policy.
3. Live bot start/stop/apply-config/retest - not run by policy.
4. Worker tick/restart, SSH, tmux, systemd, provider DB live read/write, `.env` read/write - not run by policy.
5. Browser/Playwright manual verification - not run; no UI implementation changed in this audit.

Tests to add/run in the implementation slice:
1. Focused static test for `runtimeReadinessStatus`: `unreachable`, `malformed`, `stale`, `not_configured`, null/unknown, and mock mode must not map to `ready`.
2. Static test for the new readiness loader forbidding `rawJson`, `config.raw`, `getBotAdapter`, `fetch(`, live control verbs, vault open/decrypt calls, sealed secret projections, server env names, provider DB connection strings, and `Connection verified`.
3. Cabinet test proving unentitled products get no setup/readiness/activity/statistics/provider/key signals even if a caller accidentally supplies them.
4. Admin user-bot detail static test proving the readiness section has no forms/actions for user settings, provider mapping, exchange keys, or live bot control.
5. Optional e2e after implementation for user bot dashboard/settings/setup and cabinet to verify the map copy says metadata/snapshot/read-only rather than connected/live/control.

## Next actions
1. Implement a narrow `loadBotReadinessForUser(userId, productCode)` projection that returns only safe status rows and timestamps/counts from entitlement, exchange account metadata, bot config source/version, integration health projection, metric snapshot scalar columns, and scoped provider-account mapping.
2. Fix `runtimeReadinessStatus` to be explicit and fail-closed: only known-good fresh evidence can be ready.
3. Extend `@wtc/cabinet` with a safe readiness model or add a parallel cabinet readiness DTO; keep all signal gathering inside the entitlement-allowed branch.
4. Wire the existing `BotReadinessMap` to the narrow DTO on dashboard/settings/setup; do not add new live-control buttons or admin user-setting mutation paths.
5. For admin, use the `admin-user-bot-detail-loader` scoped-summary pattern if a readiness map is shown; do not reuse `admin/bot-health-loader` raw fleet diagnostics as user readiness proof.
6. Replace internal runtime/config labels in user-facing readiness copy with product-language states.
7. Run the focused static tests first, then normal gates for the implementation slice; keep live/provider/bot-control gates explicitly NOT RUN unless a separate audited adapter phase authorizes them.
