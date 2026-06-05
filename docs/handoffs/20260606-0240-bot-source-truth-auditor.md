# bot-source-truth-auditor handoff
## Scope
Read-only audit of two-bot backend/source truth: Legacy and Tortila adapters, DB ownership, worker snapshots, closed-trade analytics proof, live-control safety, and current canary handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260606-0104-phase-466-server-canary-update.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/bot-adapters/src/**`
- `apps/worker/src/**`
- `apps/web/src/features/bots/**`
- `tests/integration/**`

## Files changed
None - read-only audit.

## Findings
1. Severity: P0. Legacy realized analytics/import remains blocked by absent closed-trade source truth. Evidence: `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts`, `docs/CONTRACTS/legacy-bot-adapter.md`, `docs/handoffs/20260606-0104-phase-466-server-canary-update.md`. Recommendation: do not build realized PnL, win rate, or equity from orders/slots/snapshots. Target part: Legacy source truth and closed-trade importer.
2. Severity: P0. Tortila runtime is canary-proven, but canonical git-backed source and production perimeter remain incomplete. Evidence: `docs/handoffs/20260606-0104-phase-466-server-canary-update.md`, `docs/CONTRACTS/tortila-adapter.md`, `docs/NEXT_ACTIONS.md`. Recommendation: canonicalize Tortila source, provision journal read token, restrict network perimeter, run authorized read-only probes, then burn in worker monitoring. Target part: Tortila production source gate.
3. Severity: P1. Provider-account ownership is already modeled; production work should populate/prove mappings rather than redesign schema. Evidence: `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`, `apps/web/src/features/bots/data.tsx`, `apps/worker/src/legacy-live.ts`. Recommendation: keep exactly-one-active provider mapping as fail-closed read contract. Target part: provider-account ownership.
4. Severity: P1. WTC import destination exists; missing piece is source-specific mapper proof. Evidence: `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`, `docs/IMPLEMENTED_FILES.md`. Recommendation: once Legacy source proof exists, map into `importBotTrade()` with provider-scoped idempotency and raw-field allowlist tests. Target part: DB import pipeline.
5. Severity: P1. Live control remains intentionally disabled and must stay out of this production-completion slice. Evidence: `packages/bot-adapters/src/control.ts`, `packages/bot-adapters/src/factory.ts`, `docs/BOT_CONTROL_SAFETY_MODEL.md`, `tests/integration/bot-config-action-handler.test.ts`. Recommendation: no start/stop/apply-config/exchange-ping in this phase. Target part: live-control safety.
6. Severity: P1. Server canary is useful, but long burn-in/alerting is not yet complete. Evidence: `docs/handoffs/20260606-0104-phase-466-server-canary-update.md`, `docs/NEXT_ACTIONS.md`. Recommendation: run read-only canary burn-in with health rows, redacted logs, PID/NRestarts continuity, and rollback criteria. Target part: canary/worker operations.

## Decisions
- Treat Phase 4.66 as latest observed deployment truth, not full production completion.
- Do not claim Legacy realized analytics until source proof changes from blocked.
- Keep live control separate from read-only source/prod gates.

## Risks
- Fabricated Legacy analytics is the highest product-truth risk.
- Tortila can drift until runtime source is canonical and protected.
- Provider mapping mistakes can leak or hide bot facts.

## Verification/tests
Read-only inspection only. No build, tests, SSH probes, DB probes, bot restarts, exchange pings, or live controls were run by this agent.

## Next actions
1. Tortila canonical source/token/network/burn-in phase.
2. Legacy closed-trade source packet before importer work.
3. Provider mapping proof for canary users/accounts.
4. Worker/canary read-only burn-in.
