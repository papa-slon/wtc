# cabinet-setup-bot-scope-auditor handoff
## Scope
Read-only Phase 4.16 audit of the current `tests/integration/cabinet-pg9.test.ts` failure and its relationship to user-side bot setup acceptance: easy setup, exchange keys, WTC-side readiness check before any future start, and fail-closed access.

No live bot mutation, no exchange/network ping, no DB mutation, no worker tick/restart, no env/vault/secret inspection, and no application-code edits were performed.

## Files inspected
1. `tests/integration/cabinet-pg9.test.ts`
2. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
3. `apps/web/src/app/(app)/app/page.tsx`
4. `apps/web/src/features/cabinet/loader.ts`
5. `apps/web/src/features/cabinet/CabinetProductCard.tsx`
6. `packages/cabinet/src/derive.ts`
7. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
8. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
9. `apps/web/src/features/bots/readiness-loader.ts`
10. `apps/web/src/features/bots/config-action-handler.ts`
11. `apps/web/src/lib/backend.ts`
12. `apps/web/src/lib/db-store.ts`
13. `apps/web/src/lib/demo.ts`
14. `packages/db/src/repositories.ts`
15. `apps/web/src/app/(app)/app/security/page.tsx`
16. `apps/web/src/app/(app)/app/indicators/page.tsx`
17. `docs/handoffs/20260604-0640-bot-setup-control-center-tests-auditor.md`
18. `docs/handoffs/20260604-0642-bot-setup-control-center-ux-auditor.md`
19. `docs/handoffs/20260604-0644-bot-setup-control-center-security-auditor.md`
20. `docs/handoffs/20260604-0653-phase-4-00-bot-setup-control-center.md`
21. `docs/handoffs/20260603-2236-phase-3-81-exchange-key-readiness.md`

## Files changed
1. `docs/handoffs/20260604-1312-cabinet-setup-bot-scope-auditor.md` - this handoff only.

Application code changed: None - read-only audit.

## Findings
1. Severity: High. The PG9 failure is directly relevant to bot setup/key workflow acceptance, but it is narrow: the setup wizard source no longer has two visible `if (!access.allowed) return;` guards for server actions. Evidence: PG9 requires at least two setup wizard server actions, CSRF before `requireUser`, and at least two exact fail-closed entitlement no-ops at `tests/integration/cabinet-pg9.test.ts:103-111`; current `wizardAddKey` has CSRF first and `if (!access.allowed) return;` at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:113-122`; current `wizardCheckExchangeKeyMetadata` has CSRF first but redirects denied access instead of using the canonical no-op at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:135-150`. Targeted command `npm test -- tests/integration/cabinet-pg9.test.ts` failed 1/18 with `expected 1 to be greater than or equal to 2` at `tests/integration/cabinet-pg9.test.ts:111`. Recommendation: make the minimal setup-page repair in `wizardCheckExchangeKeyMetadata` so unauthorized access no-ops before `recordExchangeKeyMetadataCheck`; do not weaken the PG9 assertion unless the product/security owner explicitly changes the policy. Target part: setup wizard server actions.

2. Severity: High. The current "connection test" boundary is metadata-only WTC vault readiness, not a live exchange connectivity test, and that boundary must survive the repair. Evidence: the setup action only calls `recordExchangeKeyMetadataCheck` after bot parse, product check, and entitlement check at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:139-150`; the panel says no live ping was run for passed/missing/invalid outcomes at `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:69-88`; the future exchange-ping button is disabled at `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:117-130`; the DB result model hard-codes `checkKind: 'sealed_metadata_only'` and `livePing: false` at `packages/db/src/repositories.ts:437-445` and records only safe audit fields at `packages/db/src/repositories.ts:490-500`. Recommendation: repair PG9 by preserving metadata-only wording and behavior; do not add `fetch`, adapter calls, vault open/decrypt, exchange API calls, worker calls, start/stop/apply, or live ping state in this slice. Target part: exchange-key readiness semantics.

3. Severity: Medium. The minimal repair should stay in the setup wizard file; adjacent cabinet/card/loader logic is already satisfying PG9's acceptance boundaries. Evidence: cabinet signals are gathered only under `decision.allowed ? await gatherSignals(...) : undefined` at `apps/web/src/features/cabinet/loader.ts:157-164`; the pure deriver consumes setup/activity/warnings only when `input.allowed` at `packages/cabinet/src/derive.ts:219-228`; the cabinet page stays thin and consumes `loadCabinet` plus `CabinetProductCard` at `apps/web/src/app/(app)/app/page.tsx:1-11` and `apps/web/src/app/(app)/app/page.tsx:33-37`; `CabinetProductCard` is presentational and imports the view-model type at `apps/web/src/features/cabinet/CabinetProductCard.tsx:1-3`. Recommendation: in-scope for a minimal repair is `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx` only; `tests/integration/cabinet-pg9.test.ts` is acceptance and should remain unless intentionally clarified after a code fix. Do not touch `features/cabinet/loader.ts`, `packages/cabinet/src/derive.ts`, `CabinetProductCard.tsx`, the overview page, DB repositories, worker, admin drilldowns, or bot adapters for this failure. Target part: scope control.

4. Severity: Medium. Delegated config saves appear fail-closed already, so broad rewrites could increase risk without addressing the failing assertion. Evidence: `resolveActionContext` reads the slug, requires the user, checks `botAccessForUser`, and returns `null` on denied access at `apps/web/src/features/bots/config-action-handler.ts:123-133`; save/apply/system-default handlers all no-op when that context is null at `apps/web/src/features/bots/config-action-handler.ts:159-167`, `apps/web/src/features/bots/config-action-handler.ts:191-198`, and `apps/web/src/features/bots/config-action-handler.ts:219-226`; forbidden form keys include secrets, provider ids, raw config, exchange test/apply/order, and live-control tokens at `apps/web/src/features/bots/config-action-handler.ts:51-86`. Recommendation: do not duplicate or bypass the helper in this repair; keep the explicit setup-page no-op for key actions and the helper-owned no-op for config actions. Target part: config action boundary.

5. Severity: High. Acceptance text/assertions that should remain true after repair are the ones preventing secret leaks and live-control confusion. Evidence: PG9 requires password inputs for `apiKey`/`apiSecret`, no `apiSecret` default value, live-control disabled copy, `liveAdapterBlocked`, `Connected through existing Legacy pub_id`, and wizard step CSS at `tests/integration/cabinet-pg9.test.ts:113-127`; setup renders password inputs at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:425-433`; setup review says WTC metadata/vault state and `live exchange ping not run` at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:613-623`; live control stays disabled at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:626`; cabinet loader copy distinguishes "Exchange vault metadata confirmed - live ping not available yet" and "Add exchange key metadata - live ping not available yet" at `apps/web/src/features/cabinet/loader.ts:96-108`; Legacy pub_id copy is present at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:333-337`. Recommendation: keep these strings/semantics or update the tests and UI together with equally strict metadata-only/no-secret/no-live-control language. Target part: user-facing acceptance copy.

## Decisions
1. Treat the PG9 failure as relevant to bot setup acceptance because it guards the key/setup wizard server-action boundary.
2. Treat it as a narrow static-pattern regression, not evidence that live bot setup, real exchange ping, DB schema, worker continuity, or cabinet derivation must be changed.
3. Recommended minimal repair: in `wizardCheckExchangeKeyMetadata`, use the canonical denied-access no-op (`if (!access.allowed) return;`) before `recordExchangeKeyMetadataCheck`; then rerun PG9.
4. Keep "connection test before start" scoped to WTC vault metadata readiness in this phase. A real exchange ping is a separate audited adapter phase.

## Risks
1. If the fix broadens the key check into a live exchange ping, it can leak secrets, create provider-side traffic, require rate limits/error taxonomy, and violate the no-live-mutation/no-live-control boundary.
2. If the fix weakens PG9 instead of restoring the no-op guard, denied users may receive user-visible key-check results or future code may accidentally run setup actions outside entitlement.
3. If cabinet loader/derive logic is touched, a lapsed/unowned user could trigger per-product setup/activity queries, violating fail-closed data minimisation.
4. If acceptance copy is made more optimistic, users may read metadata presence as "connection verified" or "safe to start," which is not currently true.
5. If config helper boundaries are bypassed, forbidden secret/provider/live-control form keys could reach persistence paths.

## Verification/tests
1. `git status --short --branch` - observed dirty branch `codex/bot-analytics-settings-canary-20260603...origin/codex/bot-analytics-settings-canary-20260603` with many pre-existing modified/untracked files. Application changes were not made by this auditor.
2. `pnpm vitest run tests/integration/cabinet-pg9.test.ts` - not run because `pnpm` is not installed in this shell.
3. `npm test -- tests/integration/cabinet-pg9.test.ts` - FAIL, 18 tests total, 17 passed, 1 failed. Failure: `PG9 - setup wizard server actions are CSRF-first and never render a secret > every server action is CSRF-first`; assertion at `tests/integration/cabinet-pg9.test.ts:111` expected at least two exact `if (!access.allowed) return;` matches but found one.
4. No full `npm test`, lint, typecheck, build, secret scan, Playwright, DB, worker, live exchange ping, or bot runtime gate was run by this read-only scope.

## Next actions
1. Main agent: minimally edit `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx` so `wizardCheckExchangeKeyMetadata` denies access with the same no-op pattern PG9 expects before metadata-check persistence.
2. Main agent: rerun `npm test -- tests/integration/cabinet-pg9.test.ts`.
3. Main agent: preserve PG9 acceptance text around password inputs, no secret default rendering, `Live control stays disabled`, `liveAdapterBlocked`, `Connected through existing Legacy pub_id`, wizard step CSS, and metadata-only live-ping-not-run copy.
4. Main agent: do not touch DB schema/repositories, worker, live adapters, admin surfaces, cabinet derive/loader/card, or real exchange ping behavior for this PG9 repair unless a separate phase authorizes it.
