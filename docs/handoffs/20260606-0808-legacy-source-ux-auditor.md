# legacy-source-ux-auditor handoff
## Scope
Phase 4.73 read-only product/UX audit for Legacy bot user/admin statistics honesty after Tortila runtime auth/firewall was cleared. Goal: decide whether current UX already communicates that Legacy realized analytics remain blocked by source proof, or whether a concrete non-looping implementation is needed. No code, docs, tests, DB, server, SSH, provider, exchange, or live-control mutation was performed.

## Files inspected
- AGENTS.md
- docs/SESSION_PROTOCOL.md
- docs/STATUS.md
- docs/NEXT_ACTIONS.md
- docs/CONTRACTS/legacy-bot-adapter.md
- docs/handoffs/20260605-0410-phase-4-48-legacy-source-proof-visibility.md
- docs/handoffs/20260605-0500-phase-4-50-admin-source-proof-rendered-acceptance.md
- docs/handoffs/20260605-2112-phase-462-production-source-input-map.md
- apps/worker/src/legacy-live.ts
- packages/bot-adapters/src/legacy/closed-trade-source-proof.ts
- apps/web/src/features/bots/data.tsx
- apps/web/src/features/bots/statistics-panels.tsx
- apps/web/src/app/(app)/app/bots/statistics/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx
- apps/web/src/app/admin/bots/page.tsx
- apps/web/src/features/admin/user-bot-detail-loader.ts
- apps/web/src/app/admin/users/[userId]/bots/page.tsx
- tests/integration/legacy-closed-trade-source-proof-static.test.ts
- tests/integration/bot-statistics-completion.test.ts
- tests/integration/bot-statistics-static.test.ts
- tests/integration/admin-user-bot-detail-static.test.ts
- tests/integration/admin-user-bot-detail-loader.test.ts
- tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts
- tests/integration/admin-bot-completion-gate-map.test.ts
- tests/e2e/bot-statistics.spec.ts
- tests/e2e/admin-user-bot-detail-db.spec.ts

## Files changed
None - read-only audit

## Findings
1. Severity: P1 anti-loop/product verdict. Evidence: user Legacy statistics renders `Source-proof gate`, `pending import`, `closed trades pending`, `PF, win rate, realized PnL pending`, and the warning that win rate, profit factor, realized PnL, and attribution stay hidden (`apps/web/src/features/bots/statistics-panels.tsx:654`, `apps/web/src/features/bots/statistics-panels.tsx:678`, `apps/web/src/features/bots/statistics-panels.tsx:681`; `tests/e2e/bot-statistics.spec.ts:76`, `tests/e2e/bot-statistics.spec.ts:83`). Recommendation: do not build another user statistics UX/source-proof polish slice. Target part: current-user Legacy statistics.
2. Severity: P1 admin clarity sufficient. Evidence: admin fleet gate map states `Legacy closed-trade analytics`, `source proof blocked`, and says active orders or slots are not accepted substitutes (`apps/web/src/app/admin/bots/page.tsx:180`, `apps/web/src/app/admin/bots/page.tsx:183`; `tests/integration/admin-bot-completion-gate-map.test.ts:19`, `tests/integration/admin-bot-completion-gate-map.test.ts:24`). Selected-user admin adds a Legacy-only `Source-proof gate` row, names provenance, and points to `provide source-proof artifact` or `build audited mapper/importer` (`apps/web/src/app/admin/users/[userId]/bots/page.tsx:256`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:260`). Recommendation: no admin source-packet checklist is needed before a real source artifact exists. Target part: `/admin/bots` and selected-user admin bot drilldown.
3. Severity: P1 source-proof payload boundary is properly small. Evidence: the safe summary exposes status, importability, sanitized missing requirements, count, and provenance only (`packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:139`, `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:147`); admin/user loaders consume that summary instead of raw proof internals (`apps/web/src/features/bots/data.tsx:654`, `apps/web/src/features/admin/user-bot-detail-loader.ts:887`). Tests reject raw payload allowlists, evidence refs, API-key-shaped fields, and unscoped proof rendering (`tests/integration/legacy-closed-trade-source-proof-static.test.ts:115`, `tests/integration/legacy-closed-trade-source-proof-static.test.ts:143`; `tests/e2e/admin-user-bot-detail-db.spec.ts:311`, `tests/e2e/admin-user-bot-detail-db.spec.ts:318`). Recommendation: preserve this DTO boundary; do not add raw report/download UX that exposes provider payloads. Target part: source-proof DTO and admin rendered acceptance.
4. Severity: P0 remaining blocker is source, not UX. Evidence: contract says Legacy has no closed-trade history endpoint and active orders/slots are current state only (`docs/CONTRACTS/legacy-bot-adapter.md:293`, `docs/CONTRACTS/legacy-bot-adapter.md:312`). Current gate table says Legacy realized analytics/import are blocked by source proof and must not be implemented until a valid source artifact exists (`docs/NEXT_ACTIONS.md:132`, `docs/NEXT_ACTIONS.md:144`, `docs/NEXT_ACTIONS.md:217`). Recommendation: next non-looping work is source evidence: a table/API/artifact with provider/pub_id scope, stable trade/fill id, economics, timestamps, replay semantics, and raw payload allowlist. Target part: Legacy source-proof gate.

## Decisions
- Current user/admin UX already communicates the Legacy realized analytics blocked state clearly enough.
- No concrete local implementation is recommended now for operator report/download, admin checklist, or stronger blocked-state UI.
- The next non-looping Legacy path is source evidence: a table/API/artifact with provider/pub_id scope, stable trade/fill id, economics, timestamps, replay semantics, and raw payload allowlist.
- If that artifact arrives, run a new source-proof validation phase first; only `ready_for_mapper` may lead to a separate audited mapper/importer phase.

## Risks
- Adding another local UI/static-test/dashboard slice now would violate the documented anti-loop rule and create motion without source progress.
- Admin users who ignore docs and only read the app see a compact requirement summary, not the full packet checklist; this is acceptable for honesty because the app names the blocker and next artifact, while docs/NEXT_ACTIONS.md carries the full packet.
- `ready_for_mapper` must remain source-contract readiness only, not importer completion or live-control approval.
- No current-session rendered browser run was performed, so this audit relies on inspected code/tests/docs rather than fresh screenshots.

## Verification/tests
RUN:
- `git status --short --branch` observed `main...origin/main`.
- Read-only inspection of required docs, Legacy contract, user/admin statistics files, source-proof DTO logic, worker snapshot logic, and focused tests.
- Repository searches for Legacy source-proof, blocked analytics, admin/user copy, raw/secret leak guards, and anti-loop instructions.

NOT RUN:
- No tests, Playwright, build, lint, typecheck, server, DB, SSH, provider, exchange, or live-control command.
- No handoff file was written by the auditor because its assignment was read-only; the operator recorded this handoff from the completed auditor result to satisfy Phase 1.5 protocol.
- No background agents were launched by this auditor; no background agents are left running.

## Next actions
1. Do not implement another Legacy statistics/admin UX polish slice now.
2. Obtain the Legacy closed-trade source packet named in docs/NEXT_ACTIONS.md: source table/API/artifact, provider/pub_id filter, stable trade/fill id, symbol/side/size, entry/exit, realized PnL, fees/funding sign policy, opened/closed timestamps, exit reason, replay/backfill semantics, and raw payload allowlist.
3. In a new phase, validate that packet through the existing source-proof contract. If it remains `blocked_no_source`, stop; if it becomes `ready_for_mapper`, implement only the audited mapper/importer plus replay/idempotency tests.
4. Keep live controls, exchange pings, start/stop/apply-config, and fabricated realized analytics out of scope until separate bot-integration and security gates approve them.
