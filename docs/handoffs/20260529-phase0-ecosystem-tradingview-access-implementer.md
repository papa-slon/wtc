# Handoff: ecosystem-tradingview-access-implementer

**Agent:** ecosystem-tradingview-access-implementer  
**Phase:** 0 — Documentation and architecture  
**Date:** 2026-05-29  
**Status:** Complete

---

## Scope

Write Phase 0 documentation for the TradingView Indicators access workflow:

1. `docs/TRADINGVIEW_ACCESS_PLAN.md` — full manual-first workflow, state diagram, scheduler design, audit spec, admin queue UX, and optional automation adapter spec.
2. `docs/CONTRACTS/tradingview-access.md` — production-grade contract with all required fields per the orchestrator-seed spec.
3. This handoff.

---

## Files Inspected (read-only)

| File | Purpose |
|---|---|
| `docs/handoffs/0000-orchestrator-seed.md` | Canonical decisions: table names, product codes, entitlement states, RBAC roles, hard rules |
| `C:/Users/maxib/GTE BOT/bot_tortila/ECOSYSTEM_PLATFORM_CLOUD_CODE_PROMPT.md` | Full platform prompt including TradingView flow requirements |
| `C:/Users/maxib/GTE BOT/bot_tortila/WTC_ECOSYSTEM_ARCHITECTURE_BLUEPRINT.md` | Architecture blueprint including `packages/tradingview-access` spec |
| `C:/Users/maxib/GTE BOT/bot_tortila/WTC_ECOSYSTEM_DISCOVERY_MAP.md` | Discovery snapshot confirming no official TradingView API exists |

## Files Written

| File | Description |
|---|---|
| `docs/TRADINGVIEW_ACCESS_PLAN.md` | Full access plan: user flow, state machine, DB tables, scheduler algorithm, task runner, audit events, admin queue UX, user dashboard states, automation adapter interface |
| `docs/CONTRACTS/tradingview-access.md` | Contract: owner, consumers, auth, all endpoint/function boundaries with Zod schemas, error envelope, idempotency, rate limits, timeouts, mock/real status, required tests |

---

## Findings

1. **No official TradingView API exists** for script invite management. The discovery map and all reference docs confirm this. The production default must be manual admin queue; any automation is explicitly experimental.

2. **Four canonical tables** are defined in the seed for the TradingView bounded context: `tradingview_profiles`, `tradingview_access_requests`, `tradingview_access_grants`, `tradingview_access_tasks`. The plan and contract use all four without deviation.

3. **Entitlement check is the outer gate.** Access request submission is blocked at the server if `hasAccess(userId, 'tradingview_indicators')` returns false. The admin grant action re-checks the entitlement at the time of granting (not only at submission time). This prevents granting access to a user whose subscription lapsed in the interim.

4. **Fail-closed on errors.** Any unexpected error during an entitlement check aborts the operation. The state is never advanced on an ambiguous check.

5. **Audit is mandatory, not optional.** Every grant and revoke — whether by admin, scheduler, or automation adapter — writes an `audit_logs` entry. The contract specifies minimum audit fields.

6. **State machine has 5 user-facing states** (`pending`, `granted`, `expiring_soon`, `expired`, `revoked`) plus the initial `none` (no request). All invalid transitions throw `INVALID_STATE`.

---

## Decisions

| Decision | Rationale |
|---|---|
| Manual-first admin queue is the production default | Hard rule from orchestrator-seed and all reference docs; no official TradingView API exists |
| Automation adapter defined as an interface + mock only | Allows future wiring without service-layer changes when/if a compliant mechanism exists |
| `FEATURE_TV_AUTOMATION_ADAPTER` environment variable gates the adapter | Deployment-level decision, not configurable from the frontend or admin UI |
| Partial unique index on `tradingview_access_requests` enforces one active request per user | Simpler than application-level serialization; `expired`/`revoked` rows retained for audit without violating the constraint |
| `tradingview_access_grants` is append-only | Immutable grant history is required for audit; no updates, no deletes |
| Scheduler cadence default 6 hours | Balances timeliness of expiry detection against DB load; configurable via env var |
| Warning threshold default 7 days before expiry | Gives users actionable renewal window; configurable via env var |
| TV username treated as PII (not a secret) | Not encrypted-at-rest, but excluded from error logs and external monitoring payloads |

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| No compliant TradingView automation mechanism may ever exist | Medium | Manual queue is production-grade on its own; automation adapter is a future enhancement, not a dependency |
| Admin queue becomes backlogged if staff volume is insufficient | Medium | Bulk grant/revoke actions reduce per-row friction; expiry scheduler handles revokes automatically |
| Race condition: entitlement lapses between submission and admin grant | Low | Admin grant action re-checks entitlement server-side at grant time; returns `ENTITLEMENT_LAPSED` error if lapsed |
| Task runner failures leaving TradingView access in inconsistent state | Low | Retry logic (up to 3 attempts); failed tasks alert admin; task status visible in admin UI |
| TradingView username change after grant | Low | Username changes on a `pending` request are allowed. Changes after `granted` require a revoke + re-submission cycle to maintain a clean audit trail |

---

## Tests / Verification

All required tests are enumerated in both `TRADINGVIEW_ACCESS_PLAN.md` (summary table) and `CONTRACTS/tradingview-access.md` (full table with file locations and types). No code has been written in Phase 0. Tests will be implemented when `packages/tradingview-access` is scaffolded in Phase 1+.

Minimum tests required before production use (from contract):
- Entitlement gate on submission
- Duplicate active request prevention
- All valid and invalid state transitions
- Admin role enforcement on grant/revoke
- Entitlement re-check at grant time
- Audit log present on every grant and revoke
- Scheduler expiry and warning logic
- Task runner retry/fail behavior
- Feature flag: adapter not called when disabled

---

## Next Actions

1. **Phase 1 scaffold:** create `packages/tradingview-access/` with `types.ts`, `service.ts`, `admin-service.ts`, `scheduler.ts`, `task-runner.ts`, `adapter.ts`, `adapters/mock.ts`, `adapters/real.stub.ts`, Zod schemas, Drizzle queries.
2. **DB migration:** add Drizzle schema definitions for `tradingview_profiles`, `tradingview_access_requests`, `tradingview_access_grants`, `tradingview_access_tasks` to `packages/db/schema/tradingview.ts`. Add partial unique index.
3. **Worker integration:** wire `runExpiryScheduler()` and `processTasks()` into `apps/worker` cron loop.
4. **UI:** implement `/app/indicators` page (user dashboard), `/admin/tradingview-access` queue page with filters, drawer, grant/revoke modals.
5. **Unit tests:** implement Vitest tests in `packages/tradingview-access/tests/`.
6. **E2E tests:** add Playwright tests for user and admin flows.
7. **Notification delivery:** wire notification enqueue to email/Telegram when that subsystem is built (currently TODO stub).
