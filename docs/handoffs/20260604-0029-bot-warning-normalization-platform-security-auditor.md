# bot-warning-normalization-platform-security-auditor handoff
## Scope
WTC Phase 3.85 read-only platform/security audit for bot warning normalization boundaries. Scope was to verify that warning normalization across the health-detail projector, admin/user loaders, bot data read model, worker health-detail writes, and static tests preserves these boundaries: no secrets, no raw provider payload leakage, no live bot mutation, and no entitlement bypass.

Required pre-read was completed before code inspection: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, and `docs/handoffs/20260603-2356-phase-3-84-bot-readiness-server-dto.md`.

This auditor did not read or write `.env`, did not open/decrypt secrets, did not connect to provider DBs, did not start/stop/apply/retest bots, did not tick/restart workers, and did not touch SSH/tmux/systemd/live services.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/handoffs/20260603-2356-phase-3-84-bot-readiness-server-dto.md`
5. `package.json`
6. `apps/web/src/features/admin/health-detail.ts`
7. `apps/web/src/features/admin/bot-health-loader.ts`
8. `apps/web/src/features/admin/queries.ts`
9. `apps/web/src/features/admin/user-bot-detail-loader.ts`
10. `apps/web/src/features/admin/types.ts`
11. `apps/web/src/app/admin/bots/page.tsx`
12. `apps/web/src/app/admin/system-health/page.tsx`
13. `apps/web/src/lib/access.ts`
14. `apps/web/src/features/bots/data.tsx`
15. `apps/web/src/features/bots/readiness-loader.ts`
16. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
17. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
18. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
19. `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
20. `apps/web/src/features/cabinet/loader.ts`
21. `apps/worker/src/jobs.ts`
22. `apps/worker/src/legacy-live.ts`
23. `packages/bot-adapters/src/warnings.ts`
24. `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`
25. `tests/integration/admin-health-detail.test.ts`
26. `tests/integration/bot-read-safety-static.test.ts`
27. `tests/integration/bot-readiness-server-dto-static.test.ts`
28. `tests/integration/legacy-live-worker-static.test.ts`
29. `tests/integration/legacy-provider-worker.test.ts`
30. `tests/integration/admin-bot-health-loader.test.ts`

## Files changed
None - read-only audit

## Findings
1. Medium - Admin health-detail warning normalization is key-allowlisted but not value-allowlisted to canonical warning codes. Evidence: `apps/web/src/features/admin/health-detail.ts:3` allowlists both `warningCodes` and `warnings`, then `apps/web/src/features/admin/health-detail.ts:64` to `apps/web/src/features/admin/health-detail.ts:96` merges any string/array values into `safe.warnings` after redaction; admin bot/system-health pages render the projected detail as JSON at `apps/web/src/app/admin/bots/page.tsx:401` and `apps/web/src/app/admin/system-health/page.tsx:310`; the current admin projection test intentionally keeps a non-canonical redacted warning string at `tests/integration/admin-health-detail.test.ts:22` and `tests/integration/admin-health-detail.test.ts:35`. Recommendation: filter projected `warnings`/`warningCodes` values through `CANONICAL_WARNING_CODES` or a local canonical-code set, and expose unknown provider-origin warning data only as count/generic status. Target part: admin health-detail projector and admin health surfaces.

2. Medium - Legacy worker health details still persist provider-origin quarantine reason text into WTC health-check detail. Evidence: `apps/worker/src/legacy-live.ts:529` to `apps/worker/src/legacy-live.ts:550` collects sanitized `quarantine_reason` values from provider DB rows, then writes them into `recordHealthCheck` detail at `apps/worker/src/legacy-live.ts:567` to `apps/worker/src/legacy-live.ts:587` and `apps/worker/src/legacy-live.ts:619` to `apps/worker/src/legacy-live.ts:638`; `safeText` redacts token/key patterns at `apps/worker/src/legacy-live.ts:116` to `apps/worker/src/legacy-live.ts:121`, but the persisted field remains free-form provider text. Recommendation: keep `quarantinedCount` plus canonical `legacy_quarantined` in `warningCodes`, and remove `quarantineReasons` from WTC health detail or replace it with non-provider generic reason codes. Add a static guard that forbids `quarantineReasons` in worker `recordHealthCheck` detail. Target part: Legacy worker health-detail writes.

3. Info - User-facing bot read warnings are now stricter than the admin projector and are registry-driven. Evidence: `apps/web/src/features/bots/data.tsx:189` to `apps/web/src/features/bots/data.tsx:203` builds runtime warning registries from `LEGACY_WARNINGS`, `TORTILA_WARNINGS`, and `TORTILA_PERSISTENT_WARNINGS`; `apps/web/src/features/bots/data.tsx:218` to `apps/web/src/features/bots/data.tsx:248` accepts both `detail.warnings` and `detail.warningCodes`, deduplicates, and filters by product-specific canonical sets. Recommendation: factor or mirror this canonical value allowlist in `projectHealthDetail` so user/admin warning normalization cannot drift. Target part: shared warning normalization.

4. Medium - Current static acceptance is not green because the test asserts a literal warning code in the loader instead of the canonical registry path. Evidence: `tests/integration/bot-read-safety-static.test.ts:126` to `tests/integration/bot-read-safety-static.test.ts:130` requires `warningCodesFromDetail`, `detail.warnings`, `detail.warningCodes`, `legacy_quarantined`, and literal `no_trade_history` in `apps/web/src/features/bots/data.tsx`; current `apps/web/src/features/bots/data.tsx:7` to `apps/web/src/features/bots/data.tsx:10` imports registry constants and `apps/web/src/features/bots/data.tsx:189` to `apps/web/src/features/bots/data.tsx:203` maps through those registries, so `no_trade_history` can be present via `LEGACY_WARNINGS` without a loader literal. The current focused test run failed on this assertion. Recommendation: update the static guard to assert registry use plus `packages/bot-adapters/src/warnings.ts:21` to `packages/bot-adapters/src/warnings.ts:24`, or add a behavior test for `dbWarningsFromDetail` instead of matching the loader literal. Target part: warning-normalization static tests.

5. Info - Entitlement and live-control boundaries remain intact for the inspected warning/readiness surfaces. Evidence: bot pages return access-required before read calls at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:101` to `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:116`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:173` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:181`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:182` to `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:190`, and `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx:7` to `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx:15`; cabinet gathers bot signals only when `decision.allowed` at `apps/web/src/features/cabinet/loader.ts:158` to `apps/web/src/features/cabinet/loader.ts:164`; readiness DTO denial returns access-only rows before config/runtime reads at `apps/web/src/features/bots/readiness-loader.ts:116` to `apps/web/src/features/bots/readiness-loader.ts:158`. Recommendation: keep warning/readiness data behind these same server-side gates; do not move warning projection into client-side inference. Target part: user bot and cabinet loaders.

6. Info - Worker/provider read paths have secret-selection guardrails, but those guards do not replace the need for count/code-only health detail. Evidence: Legacy provider SQL selects explicit non-secret columns at `apps/worker/src/legacy-live.ts:331` to `apps/worker/src/legacy-live.ts:344`, and `assertNoSecretFields` rejects secret-looking selected fields at `apps/worker/src/legacy-live.ts:141` to `apps/worker/src/legacy-live.ts:149` plus `apps/worker/src/legacy-live.ts:381` to `apps/worker/src/legacy-live.ts:385`; the static worker test forbids `select *`, `api_key`, and `secret_key` at `tests/integration/legacy-live-worker-static.test.ts:175` to `tests/integration/legacy-live-worker-static.test.ts:180`. Recommendation: preserve those guards, and extend them with an output-shape guard for health detail so provider free text cannot become retained platform evidence. Target part: worker static guards.

## Decisions
1. Treated the current workspace state after observed concurrent churn as the source of truth for this handoff.
2. Did not edit product code or test code; only this required per-agent handoff was written.
3. Classified admin `warningCodes` projection as partially implemented: visibility exists, redaction exists, but canonical value allowlisting is not yet strong enough.
4. Classified current warning-normalization acceptance as not green because the current focused suite fails one static assertion.
5. Treated admin diagnostic inspection as a separate privileged path; ordinary user and cabinet surfaces remain entitlement-gated.

## Risks
1. The worktree was heavily dirty before this audit, and files in this scope changed during the audit. The final evidence above cites the current state after re-read.
2. Admin health detail can render arbitrary non-secret strings written under `warnings` or `warningCodes`, after redaction/truncation. That is safer than raw JSON, but it is not a canonical warning-code allowlist.
3. Legacy worker health detail stores sanitized provider-origin `quarantineReasons`; even if current admin projection drops the key, retained DB health detail is not strictly count/code-only.
4. Focused static verification currently fails; phase acceptance should not be called green until the static guard is corrected or the implementation is adjusted.
5. This audit did not verify behavior in a live browser or against real Postgres/provider DBs by policy.

## Verification/tests
RUN:
1. Required governance/docs read: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, and `docs/handoffs/20260603-2356-phase-3-84-bot-readiness-server-dto.md`.
2. Static inspection with `rg`/line-numbered reads over admin health projection, admin/user loaders, bot read model, readiness DTO, cabinet loader, worker writes, warning registry, and static tests.
3. `npm run test -- tests/integration/admin-health-detail.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/legacy-live-worker-static.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/admin-bot-health-loader.test.ts tests/integration/legacy-provider-worker.test.ts` - initial run PASS before concurrent file churn was detected: 6 files, 37 tests.
4. Re-read current files after detecting changed warning-normalization code and reran the same focused command - FAIL in current state: 5 files passed, 1 file failed; 37 tests passed, 1 failed. Failing test: `tests/integration/bot-read-safety-static.test.ts` > `safety route reads warnings through the safe wrapper`, expected `apps/web/src/features/bots/data.tsx` to match `/no_trade_history/`.

NOT RUN:
1. Full `npm test` - not run; current focused suite already fails.
2. `npm run lint` - not run; this was a read-only audit and current focused tests are not green.
3. `npm run typecheck`, web typecheck, worker typecheck, or build - not run; scope was static/security audit and current focused static gate is failing.
4. `npm run secret:scan` and `npm run governance:check` - not run; no acceptance claim made.
5. Playwright/browser verification - not run; no UI change by this auditor.
6. `db:migrate`, `db:seed`, migration generation, or worker tick/smoke - not run by policy/scope.
7. Live exchange ping/test - not run by policy.
8. Live bot start/stop/apply-config/retest - not run by policy.
9. SSH/tmux/systemd/provider DB access - not run by policy.
10. `.env` read/write or vault open/decrypt - not run by policy.
11. Git stage/commit/push/PR - not requested.

## Next actions
1. Tighten `projectHealthDetail` so `warnings` and `warningCodes` are normalized to canonical warning codes only; drop or count unknown warning strings instead of rendering them.
2. Remove `quarantineReasons` from Legacy worker health detail and keep `quarantinedCount` plus canonical `legacy_quarantined` only.
3. Update `tests/integration/bot-read-safety-static.test.ts` to assert registry-driven `no_trade_history` coverage instead of requiring a literal in `apps/web/src/features/bots/data.tsx`, or add a direct behavior test for `dbWarningsFromDetail`.
4. Add a static worker guard forbidding provider-origin free-text fields such as `quarantineReasons` in `recordHealthCheck` detail.
5. Rerun the focused suite, then run broader lint/typecheck/secret/governance gates only after the focused warning-normalization suite is green.
