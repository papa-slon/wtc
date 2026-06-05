# Phase 4.49 admin selected-user source-proof handoff

## Scope
Selected-user admin visibility for Legacy closed-trade source-proof status. This phase made the source-proof contract
package-owned, added provenance-aware safe summaries, and taught the selected-user admin drilldown to prefer the latest
provider-scoped Legacy worker metric proof when available while falling back to the global fail-closed preflight.

No Legacy closed-trade importer, live exchange ping, live provider probe, bot start/stop/apply-config, or user-setting
mutation was added.

Read-only phase handoffs:
- [20260605-0490-admin-selected-user-source-proof-ux-auditor.md](20260605-0490-admin-selected-user-source-proof-ux-auditor.md)
- [20260605-0490-admin-selected-user-source-proof-safety-auditor.md](20260605-0490-admin-selected-user-source-proof-safety-auditor.md)
- [20260605-0490-admin-selected-user-source-proof-tests-auditor.md](20260605-0490-admin-selected-user-source-proof-tests-auditor.md)

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0410-phase-4-48-legacy-source-proof-visibility.md`
- [20260605-0490-admin-selected-user-source-proof-ux-auditor.md](20260605-0490-admin-selected-user-source-proof-ux-auditor.md)
- [20260605-0490-admin-selected-user-source-proof-safety-auditor.md](20260605-0490-admin-selected-user-source-proof-safety-auditor.md)
- [20260605-0490-admin-selected-user-source-proof-tests-auditor.md](20260605-0490-admin-selected-user-source-proof-tests-auditor.md)
- `packages/bot-adapters/src/index.ts`
- `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/legacy-closed-trade-source-proof.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/legacy-closed-trade-source-proof-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`

## Files changed
- `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts`
- `packages/bot-adapters/src/index.ts`
- `apps/worker/src/legacy-closed-trade-source-proof.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/legacy-closed-trade-source-proof-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0490-admin-selected-user-source-proof-ux-auditor.md`
- `docs/handoffs/20260605-0490-admin-selected-user-source-proof-safety-auditor.md`
- `docs/handoffs/20260605-0490-admin-selected-user-source-proof-tests-auditor.md`
- `docs/handoffs/20260605-0490-phase-4-49-admin-selected-user-source-proof.md`

## Findings
1. Severity P1 - The selected-user admin page needed source-proof reason with provenance. Evidence:
   [20260605-0490-admin-selected-user-source-proof-safety-auditor.md](20260605-0490-admin-selected-user-source-proof-safety-auditor.md)
   warned that global source-proof status could be misread as selected-user worker proof. Recommendation: include
   `global_preflight` vs `scoped_worker_metric` provenance. Target part: admin selected-user DTO and copy.
2. Severity P1 - The source-proof contract belonged in a shared package, not `apps/worker`, once both worker and web needed
   it. Evidence: `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts` now owns the proof contract, evaluator,
   and safe summary helpers; `apps/worker/src/legacy-live.ts` imports the current proof from `@wtc/bot-adapters`.
   Recommendation: keep future source-proof mapper/importer gates behind this package boundary. Target part: package
   architecture.
3. Severity P1 - Dynamic admin selected-user hydration can be safe if raw metric JSON is parsed and discarded at the loader
   boundary. Evidence: `legacyClosedTradeSourceProofFromMetricRaw()` reads only `rawJson.closedTradeSourceProof`, calls the
   shared sanitizer, and returns a tiny DTO; tests seed hostile raw proof fields and assert they do not leak. Recommendation:
   do not pass raw metric JSON to React props or DTOs. Target part: selected-user loader.
4. Severity P1 - Provider scoping remains mandatory for Legacy proof. Evidence: the loader still filters Legacy metric rows
   by the single active provider mapping before choosing latest metrics/proofs; the new isolated test proves a newer
   unscoped Legacy metric cannot override the scoped source-proof summary. Recommendation: keep provider-scoped filtering
   before proof parsing. Target part: Legacy selected-user attribution.
5. Severity P2 - User-facing source-proof parsing now shares the same sanitizer. Evidence:
   `apps/web/src/features/bots/data.tsx` uses `legacyClosedTradeSourceProofSummaryFromRaw(..., 'scoped_worker_metric')`
   instead of a local parser. Recommendation: keep user/admin source-proof statuses consistent. Target part: user statistics.

## Decisions
1. Moved the canonical Legacy source-proof contract to `@wtc/bot-adapters` while leaving the previous worker module as a
   compatibility re-export.
2. Added `source: 'global_preflight' | 'scoped_worker_metric'` to the safe summary DTO.
3. Preferred scoped worker metric proof for selected-user admin only after provider-scope filtering; otherwise fallback to
   the global fail-closed preflight.
4. Rendered source-proof as a Legacy-only coverage row and a small sublabel on the existing `Closed-trade history` metric,
   not as a new admin action or edit surface.
5. Closed all three background agents after collecting their handoffs.

## Risks
1. `ready_for_mapper` still means source-contract readiness only; importer replay, analytics unlock, and live-control approval
   remain separate gates.
2. The selected-user admin DB/browser matrix still needs managed env before rendered DB proof can run.
3. Legacy realized statistics remain blocked unless a real source artifact proves stable trade/fill id, mapped provider
   filter, economic fields, close timestamps, replay semantics, and raw-payload allowlist.
4. Raw metric JSON selection in the admin loader is intentionally narrow; future edits must not expose `rawJson`, `liveConfig`,
   provider payloads, evidence refs, blockers, unsafe raw fields, or secret-shaped keys.

## Verification/tests
RUN:
1. This phase's read-only agents created handoffs before implementation:
   [20260605-0490-admin-selected-user-source-proof-ux-auditor.md](20260605-0490-admin-selected-user-source-proof-ux-auditor.md),
   [20260605-0490-admin-selected-user-source-proof-safety-auditor.md](20260605-0490-admin-selected-user-source-proof-safety-auditor.md), and
   [20260605-0490-admin-selected-user-source-proof-tests-auditor.md](20260605-0490-admin-selected-user-source-proof-tests-auditor.md).
2. Environment preflight checked `WORKER_CONTINUITY_ADMIN_DATABASE_URL`, `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`,
   `LEGACY_DATABASE_URL`, `LEGACY_LIVE_READS_ENABLED`, `DATABASE_URL`, and `REAL_POSTGRES_DATABASE_URL`; all were `NOT_SET`
   in this shell.
3. `npx vitest run tests/integration/legacy-closed-trade-source-proof-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/bot-statistics-completion.test.ts`
   -> PASS (`4` files, `26` tests).
4. `npm run typecheck -w @wtc/web` -> PASS.
5. `npm run typecheck -w @wtc/worker` -> PASS.
6. `npm run typecheck` -> PASS.
7. `npm run secret:scan` -> PASS.
8. `npm run governance:check` -> PASS (`0` errors, one known historical warning).
9. `git diff --check` -> PASS.
10. Completed background agents were closed after collecting results:
   `019e95f8-e46a-73c2-9f2d-edd6999eb31a`, `019e95f8-f893-76b2-a6f2-581876887bde`, and
   `019e95f9-0d97-79d3-b61c-f3d1b15484a2`.

NOT RUN:
1. `npm run e2e:admin-user-bots:db:managed:matrix` - blocked by missing `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`.
2. `npm run accept:worker:continuity:managed` - blocked by missing `WORKER_CONTINUITY_ADMIN_DATABASE_URL`.
3. Playwright admin selected-user DB proof - not run because managed DB env is absent.
4. Full `npm run accept:bots:local` / `npm run accept:bots:rendered` - not run in this focused selected-user DTO phase.
5. Live Legacy DB/provider/exchange probes, live exchange key ping, live bot start/stop/apply-config - blocked by safety
   protocol and absent approved adapters.
6. Production deploy, canary switch, GitHub CI, and monitoring/burn-in - outside this focused local phase.

## Next actions
1. When `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is supplied, run the managed selected-user admin DB matrix so rendered DB
   proof covers the new source-proof row.
2. Keep Legacy closed-trade importer blocked until a real source-proof artifact passes the shared contract and a separate
   mapper/importer replay gate is implemented.
3. If this dirty tree is to ship, run a dedicated CI/deploy/canary phase with staging scope and post-deploy browser/runtime
   proof.
