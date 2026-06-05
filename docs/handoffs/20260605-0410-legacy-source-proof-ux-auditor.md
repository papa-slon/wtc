# legacy-source-proof-ux-auditor handoff
## Scope
Read-only UX/product audit for WTC Phase 4.48. Objective: inspect current Legacy/Tortila bot statistics and admin/user bot surfaces and recommend where the new Legacy closed-trade source-proof status should be visible so users/admins understand why realized Legacy statistics remain pending. No source/product/test/docs edits were made except this single handoff. No env/secret files were read. No live service/provider calls, DB mutations, server control, or bot control were performed.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260605-0333-phase-4-47-legacy-source-proof-preflight.md`
- `apps/worker/src/legacy-live.ts`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/legacy-closed-trade-source-proof-static.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/admin-bot-completion-gate-map.test.ts`
- `tests/e2e/bot-statistics.spec.ts`

## Files changed
None - read-only audit, except this handoff file.

## Findings
1. Severity P1 - The proof status exists in persisted worker metric raw JSON but is not promoted through the user/admin web read models. Evidence: `apps/worker/src/legacy-live.ts:447` stores `closedTradeSourceProof.status`, `canImportClosedTrades`, and `missingRequirements` in `bot_metric_snapshots.rawJson`; `apps/web/src/features/bots/data.tsx:636` reads `latestMetric.rawJson` but extracts only `liveConfig`; `apps/web/src/features/admin/bot-health-loader.ts:246` similarly extracts only `liveConfig` from Legacy metric raw JSON for admin fleet rows. Recommendation: add a tiny typed/guarded extractor for `closedTradeSourceProof` beside the existing `liveConfig` extraction and expose only safe fields already written by the worker. Target part: `apps/web/src/features/bots/data.tsx`, `apps/web/src/features/admin/bot-health-loader.ts`, and shared/admin types if needed.

2. Severity P1 - The primary user statistics page currently says Legacy realized stats are pending, but not why in source-proof terms. Evidence: `apps/web/src/app/(app)/app/bots/statistics/page.tsx:458` shows `closed trade imports pending`; `apps/web/src/features/bots/statistics-panels.tsx:587` shows `Closed-trade history` as `pending import`; `apps/web/src/features/bots/statistics-panels.tsx:608` warns `Legacy closed-trade history pending`; Phase 4.47 explicitly records `CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF.status === 'blocked_no_source'` and says the worker stores a safe proof summary at `docs/handoffs/20260605-0333-phase-4-47-legacy-source-proof-preflight.md:55`. Recommendation: surface the source-proof status inside the existing `LegacyOperationsPanel`, directly under the `Closed-trade history` metric / warning, with copy such as `Source proof: blocked_no_source` and `Missing source proof, not missing user action`. Target part: `apps/web/src/features/bots/statistics-panels.tsx`; pass the proof summary from `apps/web/src/app/(app)/app/bots/statistics/page.tsx` through the existing Legacy-only prop path.

3. Severity P1 - The selected-user admin drilldown needs the same source-proof reason so support/admins do not tell users to wait for an import that cannot safely run. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:57` turns Legacy realized metrics into `pending import`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:183` renders `Closed-trade history` as `pending import`; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:186` says Legacy analytics are not fabricated from active slots/orders; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:812` labels the metric card `Closed-trade history` and `realized PnL pending import`. Recommendation: add one row/card detail in the existing selected-user statistics coverage matrix for Legacy only: `Source proof: blocked_no_source`, evidence `no durable closed-trade/fill table or API proven`, next proof `provide source-proof artifact before importer`. Target part: `apps/web/src/app/admin/users/[userId]/bots/page.tsx` and its admin user bot loader/type if the proof is not already present in the summary DTO.

4. Severity P2 - `/admin/bots` already has the right operator-level place, but it is static and not tied to the worker proof payload. Evidence: `apps/web/src/app/admin/bots/page.tsx:180` renders `Legacy closed-trade analytics`; `apps/web/src/app/admin/bots/page.tsx:182` states `source proof blocked`; `apps/web/src/app/admin/bots/page.tsx:183` names stable closed-trade ids, close timestamps, and rejected active-order/slot substitutes; `tests/integration/admin-bot-completion-gate-map.test.ts:19` asserts this gate exists. Recommendation: keep this gate map as the admin fleet placement, but when the loader exposes proof status, render `blocked_no_source` and missing requirement count from the latest Legacy metric snapshot instead of only static copy. Do not render raw payloads or provider URLs. Target part: `apps/web/src/app/admin/bots/page.tsx`, `apps/web/src/features/admin/bot-health-loader.ts`.

5. Severity P2 - Tests already protect pending copy and worker fail-closed semantics; extend them rather than adding a broad visual suite. Evidence: `tests/integration/legacy-closed-trade-source-proof-static.test.ts:48` asserts `blocked_no_source` and `canImportClosedTrades=false`; `tests/integration/legacy-closed-trade-source-proof-static.test.ts:116` asserts the worker writes `closedTradeSourceProof`; `tests/integration/bot-statistics-completion.test.ts:25` asserts Legacy operational completion does not fabricate performance history; `tests/e2e/bot-statistics.spec.ts:73` asserts the user page shows pending Legacy imports. Recommendation: smallest test slice is static coverage for extractor + prop/render copy, plus updating `bot-statistics-completion.test.ts`, `admin-bot-completion-gate-map.test.ts`, and the Legacy statistics E2E text expectation. Target part: `tests/integration/legacy-closed-trade-source-proof-static.test.ts`, `tests/integration/bot-statistics-completion.test.ts`, `tests/integration/admin-bot-completion-gate-map.test.ts`, `tests/e2e/bot-statistics.spec.ts`.

## Decisions
1. Recommended a small source-proof visibility slice on existing surfaces, not a new page, new workflow, or broader statistics redesign.
2. User-facing placement should be the existing Legacy statistics cockpit / pending history warning, because that is where the user sees missing realized stats.
3. Admin placement should be both `/admin/bots` gate map for fleet operators and selected-user statistics coverage for support/admin troubleshooting.
4. The visible status should use the worker's safe proof summary only: status, importability, and missing requirement keys/count. No raw payloads, provider URLs, secrets, env values, live probes, or source table speculation should be rendered.

## Risks
1. If the UI says only `pending import`, users/admins may misread the issue as queue lag or missing worker cadence instead of a deliberate source-proof block.
2. If the UI over-explains missing requirements with raw/source-field detail, it could leak internal/provider details or imply an unproven source contract.
3. If the admin fleet gate and selected-user drilldown diverge, support may give inconsistent guidance.
4. A future source candidate must still pass the Phase 4.47 preflight and importer replay/provider-scope tests before any UI status changes from blocked/pending to loaded.

## Verification/tests
- Read-only inspection only; no test commands were run in this auditor session.
- Verified by static file inspection that `closedTradeSourceProof` is written by the worker and that current user/admin pages already render pending Legacy closed-trade copy without exposing the proof status.
- Gates RUN: file inspection of listed docs/source/tests.
- Gates NOT RUN: lint/typecheck/Vitest/Playwright/secret scan/governance/diff check, because this was a read-only UX/product audit limited to one handoff.
- Live/provider/DB/server/bot-control gates NOT RUN by scope and safety policy.

## Next actions
1. Implement the smallest UX slice: extract the safe `closedTradeSourceProof` summary from Legacy metric raw JSON in user/admin loaders.
2. Pass that summary to `LegacyOperationsPanel` and render it beside the existing `Closed-trade history` pending status and warning.
3. Add the same proof reason to the selected-user admin statistics coverage matrix and hydrate `/admin/bots` gate copy from the proof summary when present.
4. Extend focused static tests and the Legacy statistics E2E expectation to require `blocked_no_source` / source-proof-blocked copy while preserving no-live-control and no-secret boundaries.
