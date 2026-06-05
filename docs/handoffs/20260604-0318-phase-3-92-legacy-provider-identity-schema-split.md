# phase-3-92-legacy-provider-identity-schema-split handoff
## Scope
Phase 3.92 closed the Legacy provider identity split discovered after Phase 3.91. The slice keeps `providerPubId` and provider-account runtime identity out of persistable user/global bot config while preserving masked read-only provider identity for Legacy runtime statistics, dashboard summaries, settings snapshots, exports, and DB-history proof. No live bot start/stop/apply-config/retest, worker tick/restart, provider DB access, exchange ping, env/vault/secret inspection, SSH, tmux, systemd, or live server mutation was performed.

Per-agent handoffs:
- [`docs/handoffs/20260604-0318-legacy-provider-identity-schema-auditor.md`](20260604-0318-legacy-provider-identity-schema-auditor.md)
- [`docs/handoffs/20260604-0318-legacy-provider-identity-consumers-auditor.md`](20260604-0318-legacy-provider-identity-consumers-auditor.md)
- [`docs/handoffs/20260604-0318-legacy-provider-identity-tests-auditor.md`](20260604-0318-legacy-provider-identity-tests-auditor.md)

Background agents:
- `019e8f24-4131-7280-a87a-fff600ab43e4` closed after result collection.
- `019e8f24-5546-7031-b2d3-57b6ca749874` closed after result collection.
- `019e8f24-6a57-7bc2-9d8c-52f42d40418a` closed after result collection.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0300-phase-3-91-bot-config-action-runtime-acceptance.md`
8. `docs/handoffs/20260604-0318-legacy-provider-identity-schema-auditor.md`
9. `docs/handoffs/20260604-0318-legacy-provider-identity-consumers-auditor.md`
10. `docs/handoffs/20260604-0318-legacy-provider-identity-tests-auditor.md`
11. `apps/web/src/features/bots/config.ts`
12. `apps/web/src/features/bots/config-types.ts`
13. `apps/web/src/features/bots/config-export.ts`
14. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
15. `apps/web/src/features/bots/config-action-handler.ts`
16. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
17. `apps/web/src/features/bots/statistics-panels.tsx`
18. `apps/web/src/features/bots/data.tsx`
19. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
20. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
21. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
22. `packages/db/src/repositories.ts`
23. `tests/integration/bot-read-safety-static.test.ts`
24. `tests/integration/bot-config-export-static.test.ts`
25. `tests/integration/bot-config-export-route-handler.test.ts`
26. `tests/integration/bot-config-action-handler.test.ts`
27. `tests/integration/bot-config-source-audit-static.test.ts`
28. `tests/integration/bot-runtime-config-sanitizer.test.ts`
29. `tests/integration/db-0002.test.ts`

## Files changed
1. `apps/web/src/features/bots/config.ts`
2. `apps/web/src/features/bots/config-types.ts`
3. `apps/web/src/features/bots/config-export.ts`
4. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
5. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
6. `apps/web/src/features/bots/statistics-panels.tsx`
7. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
8. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
9. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
10. `packages/db/src/repositories.ts`
11. `tests/integration/bot-read-safety-static.test.ts`
12. `tests/integration/bot-config-export-static.test.ts`
13. `tests/integration/bot-config-action-handler.test.ts`
14. `tests/integration/bot-runtime-config-sanitizer.test.ts`
15. `tests/integration/db-0002.test.ts`
16. `docs/handoffs/20260604-0318-phase-3-92-legacy-provider-identity-schema-split.md`

## Findings
1. Severity: High. Persistable Legacy config no longer carries `providerPubId`. Evidence: `legacySymbolConfigShape` remains provider-free, `legacySymbolConfigSchema` is the schema used by `legacyBotConfigSchema`, and `legacyRuntimeSymbolConfigSchema` is the only config schema with optional `providerPubId`. Recommendation: keep this split as the contract for user/global settings and snapshots. Target part: `apps/web/src/features/bots/config.ts`.
2. Severity: High. Runtime Legacy display now uses runtime rows where runtime data is the source. Evidence: statistics, dashboard, and settings snapshot paths call `legacyRuntimeSymbolConfigsFromConfig` for `legacyLiveConfig` / `runtimeConfig`, while editable saved WTC config still uses `legacySymbolConfigsFromConfig`. Recommendation: keep editable settings/setup on persistable rows and reserve runtime rows for read-only snapshots. Target part: `statistics/page.tsx`, `[bot]/page.tsx`, and `[bot]/settings/page.tsx`.
3. Severity: High. The runtime sanitizer no longer destroys all Legacy provider evidence, but it still blocks secrets and raw provider-account internals. Evidence: `buildSafeRuntimeConfigView` masks only the allowed Legacy identity keys in `providerAccounts`, `symbolConfigs`, `activeSlots`, and `activeOrderSummary`; `providerAccountId`, secrets, URLs, headers, `rawJson`, and live-control keys remain stripped. Recommendation: treat masked provider identity as read-only evidence, not a config input. Target part: `apps/web/src/features/bots/runtime-config-sanitizer.ts`.
4. Severity: High. The low-level `insertBotConfigVersion` bypass identified by tests-auditor is closed. Evidence: `insertBotConfigVersion` now calls the same recursive forbidden-key guard as `saveBotConfig`; PGlite coverage rejects nested `symbolConfigs[].providerPubId` and `rawJson` without appending history. Recommendation: keep the DB repository guard as the final backstop. Target part: `packages/db/src/repositories.ts` and `tests/integration/db-0002.test.ts`.
5. Severity: Medium. Export remains safe for polluted runtime/persisted input. Evidence: export has a local persistable/runtime schema split, parses possible runtime rows, deletes `providerPubId`, and route-handler tests still prove the final JSON/native payload omit provider identity. Recommendation: future cleanup can centralize schemas, but this phase kept the export route non-live and safe. Target part: `apps/web/src/features/bots/config-export.ts`.

## Decisions
1. `LegacySymbolConfig` is the persistable user/global config type.
2. `LegacyRuntimeSymbolConfig` is the read-only runtime/display row type.
3. Raw provider-account IDs and full provider pub_ids are not user config; only masked provider identity may be displayed from scoped runtime snapshots.
4. Runtime sanitizer masking is allowed only for Legacy runtime provider display containers, not for arbitrary `raw` payloads.
5. The DB forbidden-key guard is not weakened; direct append helpers also use it.

## Risks
1. Full e2e/browser visual verification was not run in this slice, so this is not a visual acceptance claim.
2. Full repository test/lint/build was not run; the phase is supported by focused tests, typechecks, secret scan, diff check, and governance.
3. Historical DB rows, if any existed before the guard, were not live-audited in this session because no production/provider DB access was allowed.
4. `config-export.ts` still duplicates schema logic and should eventually be centralized to reduce drift.
5. The worktree was heavily dirty before this phase; unrelated prior changes were preserved and not reverted.

## Verification/tests
RUN:
1. Phase protocol docs and Phase 3.91 handoff refreshed before edits.
2. Three read-only agents were dispatched before edits and each wrote a per-agent handoff linked above.
3. `npx vitest run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/bot-config-export-route-handler.test.ts tests/integration/bot-config-action-handler.test.ts tests/integration/bot-config-source-audit-static.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts tests/integration/db-0002.test.ts` - PASS, 7 files / 67 tests.
4. `npm run typecheck -w @wtc/web` - PASS.
5. `npm run typecheck` - PASS.
6. `npm run secret:scan` - PASS.
7. `git diff --check` - PASS.
8. `npm run governance:check` - PASS for current phase `20260604-0318`: 0 errors, 1 known historical warning (`20260529-1921-integration-risk-auditor.md` missing `## Files inspected`, exempt).

NOT RUN:
1. Full `npm test` - skipped for phase scope/time; focused suites above covered the changed boundaries.
2. `npm run lint` - skipped for phase scope/time.
3. `npm run build` / `npm run build -w @wtc/web` - skipped for phase scope/time.
4. Playwright/e2e/preview/browser screenshots - skipped; no visual acceptance claimed.
5. Worker tick/restart/smoke, live bot start/stop/apply-config/retest, provider DB, exchange ping, `.env`, vault/secret inspection, SSH, tmux, systemd - forbidden by protocol for this slice.

## Next actions
1. Add a later global-default DB test for `symbolConfigs[].providerPubId` in `admin-global-bot-config-db.test.ts`.
2. Consider centralizing the server-neutral Legacy schema pair used by `config.ts` and `config-export.ts`.
3. When a safe disposable DB is available, run a historical saved-config audit for provider identity markers before claiming production data migration impact is zero.
4. Continue the broader bot-settings/statistics completion goal in a new phase; this phase only closed the provider identity schema/runtime boundary.
