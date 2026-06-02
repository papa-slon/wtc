## Scope

Phase 2.3 visible-progress wave — ecosystem-tests-runner (final gate agent). Full gate sequence run on the post-implementation tree. Added integration tests for new Phase 2.3 surfaces, fixed 2 lint errors left by implementer agents, updated + extended E2E smoke spec.

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md` — entitlement state machine, hard rules, RBAC.
- `docs/handoffs/20260530-1145-ecosystem-tests-runner-mustlands.md` — prior scoped gate run (163/5, 22 files).
- `docs/handoffs/20260530-1145-ecosystem-frontend-implementer.md` — billing/pricing/terminal/bots surfaces.
- `docs/handoffs/20260530-1145-ecosystem-frontend-implementer-admin.md` — admin users/system-health/support/entitlements.
- `docs/handoffs/20260530-1145-ecosystem-tradingview-access-implementer.md` — TV admin queue + user indicators enhanced.
- `docs/handoffs/20260530-1145-ecosystem-axioma-bridge-auditor.md` — terminal DB-wiring audit.
- `packages/db/src/repositories.ts` — confirmed: `grantProduct` (reason?, validUntil?), `revokeProduct` (reason?), `updateSupportTicket` (actorId, in-txn audit), `createTvGrant`/`revokeTvGrant`/`listTvGrantsForUser`, `upsertTerminalRelease`/`getCurrentTerminalRelease`/`recordDownloadEvent`/`recordLicenseEvent`, `listProductAccessEvents`.
- `apps/web/src/features/admin/queries.ts` — lint error: unused `getUserById` import (line 15).
- `apps/web/src/features/tv/actions.ts` — lint error: unused `reason` variable (line 74 in enhancedGrantAction).
- `apps/web/src/app/(app)/app/billing/page.tsx` — billing timeline card title: "Access event timeline"; mock checkout label.
- `apps/web/src/app/(app)/app/terminal/page.tsx` — hard boundary callout text; storage pill; dev-placeholder buttons disabled.
- `apps/web/src/app/(app)/app/indicators/page.tsx` — storage label now "in-memory (demo)" (changed from "in-memory (dev)").
- `apps/web/src/app/admin/users/page.tsx` — heading: "User directory".
- `apps/web/src/app/admin/system-health/page.tsx` — "Live bot control" + "TradingView automation" DISABLED pills.
- `apps/web/src/app/admin/support/page.tsx` — heading: "Support ticket triage".
- `apps/web/src/app/admin/tradingview-access/page.tsx` — "Manual grant/revoke only" copy; empty queue in demo mode.
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` — Start/Stop buttons disabled; safety policy text.
- `apps/web/src/features/tv/queries.ts` — loadTvAdminData returns empty rows in demo mode (confirmed cause of prior e2e failure on demo_trader_99).
- `tests/integration/db-0002.test.ts` — reference for PGlite harness pattern.
- `tests/e2e/smoke.spec.ts` — prior 18-test e2e spec (to be updated).
- `docs/STATUS.md` — updated with final gate results.

## Files changed

- `apps/web/src/features/admin/queries.ts` — FIXED: removed unused `getUserById` from import on line 15.
- `apps/web/src/features/tv/actions.ts` — FIXED: renamed `reason` to `_grantReason` (enhancedGrantAction line 74) and `reason` to `_reason` (enhancedRevokeAction line 137) to satisfy @typescript-eslint/no-unused-vars.
- `tests/integration/phase23-visible-progress.test.ts` — NEW: 8 PGlite integration tests (TV-1/TV-2/TV-3, TRM-1/TRM-2/TRM-3, ADM-1/ADM-2).
- `tests/e2e/smoke.spec.ts` — UPDATED: fixed 2 stale assertions (demo_trader_99 → manual-first copy; in-memory (dev) → in-memory (demo)); added 5 new Phase 2.3 test cases (10 specs desktop+mobile).
- `docs/STATUS.md` — UPDATED: Phase 2.3 final gate run section prepended; real-vs-mocked tally updated.

## Findings

**Lint errors (2, now fixed):**
1. `apps/web/src/features/admin/queries.ts:15` — `getUserById` imported from `@wtc/db` but never used in the module body. Frontend-implementer-admin agent imported it but the function was not called (user rows are fetched differently). Fix: removed from import list.
2. `apps/web/src/features/tv/actions.ts:74` — `reason` destructured from `parsed.data` in `enhancedGrantAction` but `grantTv` does not accept a reason param. The grant reason is validated by Zod but not forwarded (documented as a tracked enhancement). `void reason` does not satisfy the rule. Fix: renamed to `_grantReason`. Similarly `_reason` in enhancedRevokeAction (already partially fixed; completed).

**E2E stale assertions (2, now fixed):**
1. `demo_trader_99` — The prior admin TV page used `tvService.listAll()` (in-memory backend which includes the seeded `demo_trader_99` request). The Phase 2.3 implementer replaced this with `loadTvAdminData()` from `features/tv/queries.ts`, which returns empty rows in demo mode (no DATABASE_URL). The empty queue is correct behaviour; updated assertion to verify `'Manual grant/revoke only'` copy (visible in all modes).
2. `storage: in-memory (dev)` on the indicators page — Phase 2.3 implementer changed the label to `storage: in-memory (demo)` for consistency with other surfaces. Updated assertion to match.

**New integration test findings (all PGlite-verified):**
- TV-1: `createTvGrant` writes grant row with grantedBy=adminId; `getTvProfile` returns currentGrantId=grantId; audit action `tv_access.grant` with actorUserId=adminId.
- TV-2: `revokeTvGrant(grantId, adminId, 'subscription expired')` stamps revokeReason='subscription expired' on grant row; currentGrantId nulled to null; audit action `tv_access.revoke`.
- TV-3: `listTvGrantsForUser(otherUserId)` returns empty array (per-user isolation).
- TRM-1: Two `upsertTerminalRelease` calls — second promotion demotes first (isCurrent=false); `getCurrentTerminalRelease` returns latest.
- TRM-2: `recordDownloadEvent(entitlementVerified:true)` — audit row has `after.entitlementVerified=true`; no 'secret'/'apikey'/'password' in payload string.
- TRM-3: `recordLicenseEvent(eventType:'link_confirmed')` — audit row present; no plaintext secret in payload.
- ADM-1: `updateSupportTicket(ticketId, {status:'in_progress'}, adminId)` — ticket status updated; audit row `support.ticket_update` with actorUserId=adminId, targetId=ticketId.
- ADM-2: `grantProduct(db, userId, 'axioma_terminal', now, adminId, 'sales_promotion_june', validUntil)` — PAE row has reason='sales_promotion_june'; audit after.validUntil=validUntil; entitlement.expiresAt within 5s of validUntil.

**No plaintext secrets in any test payload** — confirmed by string-matching test payloads.

## Decisions

- Lint fixes in features/admin and features/tv are in the tests-runner's responsibility as gate keeper (fix-until-green rule). Did not alter logic, only renamed unused variables.
- For the E2E admin TV assertion: chose `'Manual grant/revoke only'` (visible in all modes from the SectionHeader copy) rather than fabricating a seeded DB row that would only work with DATABASE_URL. This is the most honest assertion: structure + label, not DB persistence (per task specification).
- No state-guard test for TV added (task says "skip gracefully if not wired"). The createTvGrant and revokeTvGrant repos do not include a state guard at the repo level (state guard is at the action level in features/tv/actions.ts). Skipped gracefully.

## Risks

- `whsec_testfake` in `billing-webhook.test.ts` (from prior wave) passes secretlint today. If the preset adds length enforcement on `whsec_` prefixes, a secretlint-disable comment would be needed.
- Phase 2.3 implementer agents left `_grantReason` and `_reason` unused as tracked enhancements — these are forward-pass stubs awaiting `grantTv`/`revokeTv` reason param additions to repositories.ts.
- The two-step grant atomicity gap in enhancedGrantAction (grantTv then createTvGrant in separate txns) is documented by the TV implementer; not a tests-runner concern but noted.

## Verification/tests

All commands observed and recorded (no inferred results):

| Gate | Command | Observed Result |
|------|---------|----------------|
| governance:check | `npm run governance:check` | PASS — 0 errors, 1 allowlisted warning (20260529-1921 historical drift) |
| check:core | `npm run check:core` | PASS — 7 smokes |
| lint | `npm run lint` | PASS — exit 0 (after fixing 2 errors) |
| typecheck | `npm run typecheck` | PASS — exit 0 |
| typecheck web | `npm run typecheck -w @wtc/web` | PASS — exit 0 |
| secret:scan | `npm run secret:scan` | PASS — no findings |
| test | `npm test` | PASS — 171 passed / 5 skipped (176) across 23 files |
| coverage | `npm run coverage` | PASS — 24.33% stmts / 71.06% branch |
| db:generate | `npm run db:generate -w @wtc/db` | PASS — 38 tables, "No schema changes" |
| build | `npm run build -w @wtc/web` | PASS — 44 routes compile cleanly |
| e2e | `npx playwright test` | PASS — 28/28 (14 desktop + 14 mobile) |
| db:migrate | NOT RUN | no DATABASE_URL / Docker |
| db:seed | NOT RUN | no DATABASE_URL / Docker |
| real-PG harness | NOT RUN (5 skipped in db-real-postgres.test.ts) | no REAL_POSTGRES_DATABASE_URL |

New test file: `tests/integration/phase23-visible-progress.test.ts` — 8 PGlite tests (TV-1/2/3, TRM-1/2/3, ADM-1/2), all passing.
Updated spec: `tests/e2e/smoke.spec.ts` — 28 total (was 18): +10 Phase 2.3 surfaces (5 test cases × 2 projects).
Screenshots written to `tests/e2e/screenshots/`: 38 files total (19 surfaces × 2 projects).

## Next actions

- Operator writes the `20260530-1145` aggregate handoff citing all per-agent handoffs in this wave.
- Phase 3 migration 0003 (rich LMS columns + slug/level/tags/embed/file-meta/progress-state-machine).
- Axioma account-link flow (not yet implemented; terminal shows honest "not_linked" placeholder).
- `revokeTv`/`grantTv` reason param addition to repositories.ts to close the tracked enhancement.
- Real Postgres provisioning (credentials + db:migrate + db:seed run) before production deployment.
