# bot-admin-health-loader-auditor handoff
## Scope
Read-only Phase 4.14 audit of admin bot health loader and `/admin/bots` consumption after Phase 4.13 worker continuity. Focus: latest-50 sampling, target-filtered health queries, readState priority, worker `botContinuityStatus` detail consumption, and stale-row false green risk.

## Files inspected
- AGENTS.md
- docs/SESSION_PROTOCOL.md
- docs/handoffs/0000-orchestrator-seed.md
- docs/handoffs/20260604-1205-phase-4-13-worker-bot-continuity-proof.md
- docs/handoffs/20260604-1205-bot-worker-continuity-web-admin-auditor.md
- apps/web/src/features/admin/bot-health-loader.ts
- apps/web/src/features/admin/queries.ts
- apps/web/src/features/admin/types.ts
- apps/web/src/features/admin/health-detail.ts
- apps/web/src/app/admin/bots/page.tsx
- apps/worker/src/index.ts
- apps/worker/src/jobs.ts
- tests/integration/admin-bot-health-loader.test.ts
- tests/integration/worker-health-mapping.test.ts
- tests/integration/worker-tortila-snapshot.test.ts
- tests/integration/bot-read-safety-static.test.ts

## Files changed
None - read-only audit

## Findings
1. Severity P1 - evidence apps/worker/src/index.ts:293 and apps/worker/src/index.ts:296 and apps/web/src/features/admin/bot-health-loader.ts:363 - recommendation: add a safe worker continuity DTO from latest `target='worker'` and surface it on `/admin/bots` - target part: worker continuity detail consumption.
2. Severity P1 - evidence apps/web/src/features/admin/bot-health-loader.ts:363 and apps/web/src/features/admin/bot-health-loader.ts:390 - recommendation: replace global latest-50 filtering with SQL target-filtered/per-target latest health reads - target part: admin bot health loader and warning summaries.
3. Severity P1 - evidence apps/worker/src/jobs.ts:134 and apps/web/src/app/admin/bots/page.tsx:18 - recommendation: normalize readState before status/last-ok so `stale`, `unreachable`, and `malformed` cannot render green - target part: `/admin/bots` journal pill and fleet evidence.
4. Severity P1 - evidence apps/web/src/app/admin/bots/page.tsx:140 and apps/web/src/app/admin/bots/page.tsx:703 - recommendation: gate Tortila/Legacy snapshot and owner-row green states by latest product health/readState - target part: no false green from old snapshots or provider rows.
5. Severity P2 - evidence tests/integration/admin-bot-health-loader.test.ts:299 - recommendation: add focused PGlite tests for worker continuity projection, latest-50 displacement, stale status-ok rows, and malformed/unreachable detail - target part: admin bot health regression coverage.

## Decisions
- Read-only only; no edits, test writes, worker tick, DB mutation, live provider calls, or browser actions were performed by this agent.
- Treat persisted `integration_health_checks` as the admin truth surface; no live probe should run during render.
- Worker continuity is a fleet-level status, not permission for live control.

## Risks
- Worktree was already heavily dirty, including files in scope.
- Source-level audit only; no browser render or DB-backed e2e was run by this agent.

## Verification/tests
RUN:
- `git status --short --branch`
- Read-only `rg` searches and line-numbered source inspection.

NOT RUN:
- Vitest, Playwright, build/typecheck/lint.
- Worker tick or `accept:worker:continuity`.
- Live bot control, exchange/provider calls, SSH/tmux/systemd/deploy.

## Next actions
1. Implement target-filtered latest health reads and worker continuity projection.
2. Normalize `/admin/bots` tones from readState before status/last-ok/snapshot rows.
3. Add focused regression tests for stale status-ok rows, latest-50 displacement, worker attention/error detail, and malformed/unreachable readState.

