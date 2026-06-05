# phase-3-84-bot-readiness-server-dto handoff
## Scope
Phase 3.84 implemented the server-only bot readiness DTO slice requested after Phase 3.83. The phase moved dashboard, settings, setup review, and cabinet readiness rows behind one entitlement-gated loader while preserving rich page data for metrics/config panels. Tortila exchange readiness now distinguishes count-only metadata from account-plus-encrypted-secret metadata proof, and Legacy readiness now distinguishes runtime snapshots from exact active DB provider mapping proof.

This phase did not read or write `.env`, did not open/decrypt vault secrets, did not ping live exchanges, did not start/stop/apply/retest bots, did not tick/restart workers, did not touch SSH/tmux/systemd/provider DBs, and did not mutate live bot services. Existing local Next dev processes on `127.0.0.1:3310` and `127.0.0.1:3000` were observed; `127.0.0.1:3310` was used only for Browser UI verification.

Per-agent handoffs linked by path:
1. [docs/handoffs/20260603-2356-bot-readiness-server-dto-db-backend-auditor.md](20260603-2356-bot-readiness-server-dto-db-backend-auditor.md)
2. [docs/handoffs/20260603-2356-bot-readiness-server-dto-platform-security-auditor.md](20260603-2356-bot-readiness-server-dto-platform-security-auditor.md)
3. [docs/handoffs/20260603-2356-bot-readiness-server-dto-tests-ux-auditor.md](20260603-2356-bot-readiness-server-dto-tests-ux-auditor.md)

All three background agents were closed with `close_agent` before the final report.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260603-2346-phase-3-83-bot-readiness-dto.md`
8. `docs/handoffs/20260603-2356-bot-readiness-server-dto-db-backend-auditor.md`
9. `docs/handoffs/20260603-2356-bot-readiness-server-dto-platform-security-auditor.md`
10. `docs/handoffs/20260603-2356-bot-readiness-server-dto-tests-ux-auditor.md`
11. `packages/db/src/schema.ts`
12. `packages/db/src/repositories.ts`
13. `apps/web/src/lib/backend.ts`
14. `apps/web/src/lib/access.ts`
15. `apps/web/src/features/bots/data.tsx`
16. `apps/web/src/features/bots/config.ts`
17. `apps/web/src/features/bots/meta.ts`
18. `apps/web/src/features/bots/readiness.ts`
19. `apps/web/src/features/bots/BotReadinessMap.tsx`
20. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
21. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
22. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
23. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
24. `apps/web/src/features/cabinet/loader.ts`
25. `apps/web/src/features/cabinet/CabinetProductCard.tsx`
26. `packages/cabinet/src/derive.ts`
27. `tests/integration/bot-readiness-builder.test.ts`
28. `tests/integration/bot-read-safety-static.test.ts`
29. `tests/integration/cabinet-pg9.test.ts`
30. `tests/integration/db-persistence.test.ts`
31. `tests/integration/legacy-provider-worker.test.ts`
32. `tests/e2e/bot-readiness-map.spec.ts`
33. `tests/e2e/bot-settings.spec.ts`
34. `tests/e2e/cabinet-pg9-mobile.spec.ts`

## Files changed
1. `packages/db/src/repositories.ts` - added passive `summarizeExchangeKeyMetadata` and `summarizeUserBotProviderMapping` helpers.
2. `apps/web/src/features/bots/readiness-loader.ts` - new server-only DTO loader `loadBotReadinessForUser`.
3. `apps/web/src/features/bots/readiness.ts` - added blocked `ambiguous_mapping` state for Legacy provider readiness.
4. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` - dashboard readiness map now consumes the DTO.
5. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` - settings readiness map now consumes the DTO.
6. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx` - setup review readiness map and Legacy provider count now consume the DTO.
7. `apps/web/src/features/cabinet/loader.ts` - cabinet bot card readiness now consumes the DTO inside the existing allowed branch.
8. `tests/integration/bot-readiness-builder.test.ts` - added `ambiguous_mapping` coverage.
9. `tests/integration/bot-readiness-server-dto-static.test.ts` - new static guard for DTO boundary, safe repository summaries, and callsites.
10. `tests/integration/bot-read-safety-static.test.ts` - updated safety guard to require DTO callsites.
11. `tests/integration/cabinet-pg9.test.ts` - updated cabinet static expectations for DTO and Legacy mapping copy.
12. `tests/integration/db-persistence.test.ts` - added Tortila metadata summary coverage.
13. `tests/integration/legacy-provider-worker.test.ts` - added Legacy provider mapping summary coverage.
14. `tests/e2e/cabinet-pg9-mobile.spec.ts` - updated mobile expectation for honest Legacy admin mapping copy.
15. `docs/handoffs/20260603-2356-phase-3-84-bot-readiness-server-dto.md` - this aggregate handoff.

## Findings
1. High - Readiness no longer needs page-local raw/runtime evidence to decide green states. Evidence: the new DTO loader is server-only and entitlement-gated at `apps/web/src/features/bots/readiness-loader.ts:1` and `apps/web/src/features/bots/readiness-loader.ts:116`; dashboard/settings/setup/cabinet consume `readiness.items` at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:134`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:209`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:210`, and `apps/web/src/features/cabinet/loader.ts:88`. Recommendation: future readiness changes should go through `loadBotReadinessForUser`, not page-local builder inputs. Target part: web readiness boundary.
2. High - Tortila green key readiness is now backed by a passive account-plus-secret-metadata summary, not by key count. Evidence: `summarizeExchangeKeyMetadata` selects account ids and secret metadata account ids at `packages/db/src/repositories.ts:416`, while the loader maps `vaultMetadataCount > 0` to `vault_metadata_confirmed` at `apps/web/src/features/bots/readiness-loader.ts:58`; tests cover this at `tests/integration/db-persistence.test.ts:120` and `tests/integration/bot-readiness-server-dto-static.test.ts:36`. Recommendation: keep `recordExchangeKeyMetadataCheck` as a user-triggered check only; do not run it on page render. Target part: Tortila exchange key readiness.
3. High - Legacy green provider readiness is now backed by exact active DB mapping summary rather than runtime `providerAccounts`. Evidence: `summarizeUserBotProviderMapping` scopes by user, bot instance, product, provider, and active status at `packages/db/src/repositories.ts:1793`; the loader maps one active row to `db_mapping_confirmed` and ambiguous rows to `ambiguous_mapping` at `apps/web/src/features/bots/readiness-loader.ts:79`; tests cover missing/active/disabled behavior at `tests/integration/legacy-provider-worker.test.ts:113`, `tests/integration/legacy-provider-worker.test.ts:141`, and `tests/integration/legacy-provider-worker.test.ts:228`. Recommendation: runtime snapshots stay diagnostics only; admin mapping remains the readiness proof. Target part: Legacy provider pub_id readiness.
4. Medium - Cabinet is still fail-closed and now has better user copy for Legacy. Evidence: signal gathering remains inside `decision.allowed` at `apps/web/src/features/cabinet/loader.ts:163`, and Legacy setup copy now says `Admin maps one active Legacy provider pub_id` at `apps/web/src/features/cabinet/loader.ts:95`; e2e asserts the copy at `tests/e2e/cabinet-pg9-mobile.spec.ts:23`. Recommendation: keep `packages/cabinet` pure and keep bot readiness projection in the app loader. Target part: cabinet product cards.
5. Medium - The pure builder now blocks ambiguous Legacy provider mappings instead of treating all nonzero mappings as attention/ready. Evidence: builder status maps `ambiguous_mapping` to `blocked` at `apps/web/src/features/bots/readiness.ts:130`; builder test asserts two mapped pub_ids is blocked at `tests/integration/bot-readiness-builder.test.ts:116`. Recommendation: if a DB invariant ever fails, the UI must show operator resolution required. Target part: readiness status semantics.
6. Medium - Browser verification confirmed the live local pages reflect the DTO copy and disabled-control state. Evidence: Browser DOM check on `http://127.0.0.1:3310/app` found `Account overview`, Tortila key setup copy, and Legacy admin mapping copy; Browser DOM check on `/app/bots/legacy` found `Bot readiness map`, `Provider pub_id`, `0 provider pub_ids mapped`, and `Start/stop/apply disabled`. Recommendation: keep this in the focused acceptance story until the full bot settings/statistics work is finished. Target part: visual/UI acceptance.

## Decisions
1. `apps/web/src/features/bots/readiness.ts` remains pure presentation-domain logic; `apps/web/src/features/bots/readiness-loader.ts` is the server-only assembler.
2. The DTO resolves access first and returns access-only rows for denied users before reading config, key metadata, provider mapping, runtime, or statistics.
3. Tortila `metadata_saved` can come from demo/in-memory key metadata, but `vault_metadata_confirmed` requires DB account plus encrypted secret metadata row.
4. Legacy `db_mapping_confirmed` requires exactly one active DB `legacy-db` mapping for the current user's Legacy bot instance.
5. `ambiguous_mapping` is a blocked readiness state.
6. Dashboard may still load rich runtime/config data for metrics and tables, but readiness rows are rendered from the DTO.
7. Cabinet bot cards receive compact projected readiness rows only after entitlement allows the product.
8. Live start/stop/apply and live exchange ping remain disabled/not-run.

## Risks
1. Full Legacy/Tortila product completion is still not done. This phase closed the server-only readiness DTO slice, not the full settings/statistics/admin/live-control roadmap in the operator's goal.
2. The worktree was heavily dirty before this phase; many unrelated modified/untracked files remain.
3. Settings/setup still load broader config/runtime data for panels and forms. That is allowed for rich UI, but readiness must continue to use the DTO only.
4. Demo/memory mode cannot prove encrypted secret metadata rows, so Tortila demo readiness remains count-only/attention until Postgres is configured.
5. Warning-code normalization called out by the DB/backend auditor is not fully addressed in this slice.
6. Existing Next dev processes on ports `3000` and `3310` were not started by this phase and were left running.

## Verification/tests
RUN:
1. Read protocol and current state docs: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and Phase 3.83 aggregate handoff.
2. Launched three read-only agents before edits; collected the three required handoffs linked above.
3. `npm run test -- tests/integration/bot-readiness-builder.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/cabinet-pg9.test.ts tests/integration/db-persistence.test.ts tests/integration/legacy-provider-worker.test.ts` - PASS, 6 files, 73 tests.
4. `npm run typecheck -w @wtc/web` - PASS.
5. `npm run e2e -- tests/e2e/bot-readiness-map.spec.ts tests/e2e/bot-settings.spec.ts tests/e2e/cabinet-pg9-mobile.spec.ts` - first run FAILED because mobile cabinet e2e still expected old Legacy copy; updated the test to the new honest mapping copy.
6. `npm run e2e -- tests/e2e/bot-readiness-map.spec.ts tests/e2e/bot-settings.spec.ts tests/e2e/cabinet-pg9-mobile.spec.ts` - PASS, 6 passed, 2 skipped.
7. `npm run secret:scan` - PASS.
8. `npm run governance:check` - PASS before aggregate handoff, 0 errors and 1 known historical warning for `20260529-1921-integration-risk-auditor.md`.
9. `git diff --check` - PASS.
10. In-app Browser on `http://127.0.0.1:3310/app` - PASS: cabinet visible, Tortila key setup copy visible, Legacy admin mapping copy visible.
11. In-app Browser on `http://127.0.0.1:3310/app/bots/legacy` - PASS: Bot readiness map, Provider pub_id row, `0 provider pub_ids mapped`, and disabled live control copy visible.

NOT RUN:
1. Full `npm test` - not run; focused integration suite was run for this slice.
2. Full unfocused Playwright suite - not run; focused bot readiness/settings/cabinet e2e was run.
3. Full root `npm run typecheck` - not run; web typecheck was run because this slice touched web/server DTO and pages.
4. `npm run build -w @wtc/web` - not run; typecheck/e2e covered this slice's current risk.
5. `npm run lint` - not run; focused static/integration and `git diff --check` were run.
6. `db:migrate`, `db:seed`, or migration generation - not run; this slice added repository helpers only and no schema changes.
7. Live exchange ping/test - not run by policy.
8. Live bot start/stop/apply-config/retest - not run by policy.
9. Worker tick/restart - not run by policy.
10. SSH/tmux/systemd/provider DB live read/write - not run by policy.
11. `.env` read/write or vault open/decrypt - not run by policy.
12. Git stage/commit/push/PR - not requested.

## Next actions
1. Continue the broader bot completion goal: finish Legacy and Tortila settings UX, default/custom strategy presets, per-symbol/stage indicator slots, user/admin statistics, and admin read-only user drilldown.
2. Normalize `warnings` vs `warningCodes` projection so both Tortila and Legacy warning summaries are consistently visible across user/admin health surfaces.
3. Add a narrow DTO behavior test if Vitest can import `server-only` safely, or keep expanding static plus DB-helper tests if not.
4. Consider passing already-loaded full config into the DTO to avoid duplicate config reads on heavy pages, while keeping DTO output scalar/sanitized.
5. Later, after separate security and bot-integration audit, design live-control readiness without enabling start/stop/apply in this UI.
