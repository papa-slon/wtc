# Handoff: ecosystem-frontend-implementer
**Epoch:** 20260530-1355
**Slug:** ecosystem-frontend-implementer
**Agent:** ecosystem-frontend-implementer (admin ops)
**Wave:** Phase 2.4 — Workstream F + C-UI

---

## Scope

Admin operations frontend implementation:
1. N+1 fix in loadAdminUsers (F-05 from admin-ops-ux-auditor)
2. Billing manual-review queue: types, loader, page, actions, schemas
3. /admin/bots: full health surface replacing Placeholder (F-01, F-03 from bot-runtime-auditor)
4. /admin/system-health: additive manual-review count + billing review section
5. /admin/entitlements: manual-review queue section + Flag-for-review controls
6. fmtDateTime helper in lib/format.ts
7. nav.ts: removed soon:true from /admin/bots (F-11)

---

## Files inspected

`apps/web/src/features/admin/*`, `apps/web/src/app/admin/**`, and the cited admin-ops-ux + billing-access + bot-runtime + security auditor handoffs.

## Findings

No new findings — implemented Workstream F + C-UI per the auditor handoffs. See the aggregate "Findings → fixes".

## Risks

Honest demo state when no DB; `assertAdmin` in every action; `passwordHash` never rendered (AdminUserView). Manual-review queue reads `billing_manual_review_items`; `/admin/bots` is read-only (no control buttons).

## Verification/tests

typecheck (web) PASS; build PASS (45 routes incl. `/admin/entitlements/review`). Final phase gates in the aggregate table.

## Next actions

Surface `revokeReason` in the TV UI; `listUsersWithEmailByIds` to kill the TV-admin N+1 (Phase 2.5). See the aggregate "Next actions".

## Files changed

- `apps/web/src/features/admin/types.ts` — added ManualReviewItemView, AdminManualReviewState, AdminBotHealthResult
- `apps/web/src/features/admin/queries.ts` — N+1 fix (listUsersWithCreatedAt), loadManualReviewItems, loadAdminBotHealth
- `apps/web/src/features/admin/schemas.ts` — added resolveReviewSchema, flagReviewSchema
- `apps/web/src/features/admin/actions.ts` — added adminFlagReviewAction, adminApproveReviewAction, adminRejectOrDismissReviewAction
- `apps/web/src/app/admin/entitlements/page.tsx` — manual-review queue section, Flag-for-review control per entitlement, Approve/Reject links for manual_review state
- `apps/web/src/app/admin/entitlements/review/page.tsx` — NEW: pending billing_manual_review_items queue with Approve/Reject/Dismiss forms
- `apps/web/src/app/admin/bots/page.tsx` — replaced Placeholder with full RSC: adapter mode, safety-disabled states, Tortila P0/P1 warnings, health checks, metric snapshot, legacy BLOCKED card
- `apps/web/src/app/admin/system-health/page.tsx` — added billing manual-review pending count + loadManualReviewItems call
- `apps/web/src/lib/format.ts` — added fmtDateTime(ms) → 'YYYY-MM-DD HH:MM'
- `apps/web/src/lib/nav.ts` — removed soon:true from /admin/bots

---

## Routes added

- `/admin/entitlements/review` — NEW: billing manual-review queue (pending items, Approve/Reject/Dismiss)

---

## State coverage per surface

### /admin/entitlements/review (NEW)
| State | Display |
|---|---|
| demo (no DATABASE_URL) | StatusPill warn + EmptyState with "Connect DATABASE_URL" hint |
| postgres, 0 pending items | EmptyState "No pending items" |
| postgres, N items | Card per item: provider/eventId/eventType/reason/createdAt/userId; eventSnapshot in collapsible code block; Approve form (with userId + product selector); Reject form; Dismiss form |
| approve/reject/dismiss | Server actions with requireUser → assertAdmin → assertCsrf → Zod → resolveManualReviewItem → revalidate |

### /admin/bots (full replacement)
| State | Display |
|---|---|
| demo (no DATABASE_URL) | RiskWarningBanner warn + all EmptyStates; safety-disabled states always visible |
| postgres + no checks | EmptyStates for health checks and snapshots with run-worker hint |
| postgres + checks present | Health check table + metric snapshot metrics |
| adapter=mock | Amber "adapter: mock" pill; snapshot source shows "mock" with clarification |
| adapter=read-only | Neutral "adapter: read-only" pill |
| Tortila P0/P1 | Always-visible RiskWarningBanner per TORTILA_PERSISTENT_WARNINGS (non-dismissible) |
| Legacy BLOCKED | Always-visible RiskWarningBanner error + metric cards |

### /admin/system-health (additive)
| State | Display |
|---|---|
| demo | "Demo mode — connect DATABASE_URL" copy in review card |
| 0 pending | "No pending billing events" |
| N pending | Count MetricCard + link to /admin/entitlements/review |

### /admin/entitlements (additive)
| State | Display |
|---|---|
| demo review mode | Copy + link to review queue |
| 0 pending items | Empty state with link |
| N pending items | Summary table (top 5) + "Open review queue" button |
| entitlement in manual_review | Shows link to /admin/entitlements/review instead of revoke/flag forms |
| entitlement in other state | Revoke form + Flag-for-review form side by side |

---

## Security properties

- Every new action enforces: requireUser → assertAdmin → assertCsrf → Zod → repo (in-txn audit) → revalidatePath
- passwordHash never returned (mapToAdminUserView strips it via listUsersWithCreatedAt)
- eventSnapshot rendered only for non-secret parsed fields (id, type, planCode) — raw Stripe body never stored/rendered
- No exchange keys, stack traces, or secrets rendered anywhere
- Never auto-grant on ambiguous data — approve action requires explicit userId + productCode input
- resolveManualReviewItem uses fail-closed guard: throws if item not pending or not found

---

## Self-verify results

```
npm run typecheck -w @wtc/web  →  PASS (exit 0, no errors)
npm run build -w @wtc/web      →  PASS (45 routes compiled, 0 errors)
```

Route count in build output: 45 routes (was 44; +1 = /admin/entitlements/review).

---

## N+1 fix details

`loadAdminUsers` previously issued N+1 queries: `listUsers(db)` (SELECT all users + N roles queries) then per-user `SELECT createdAt FROM users WHERE id = ?` (N extra queries). Now uses `listUsersWithCreatedAt(db)` from `@wtc/db` which resolves all users + all role rows in exactly 2 flat queries and joins in-process — O(N) not O(N^2). passwordHash present in DbUserWithCreatedAt is stripped by mapToAdminUserView before any data leaves this function.

---

## Decisions / deviations

- `adminApproveReviewAction`: uses a single `select` from product picker rather than comma-separated text input for product codes — simpler UX for admins, still sends comma-separated value that the action parses. For multi-product approval (bundles), admin enters multiple codes as a comma-separated string in the hidden input (select only covers one at a time; full multi-select is Phase 3 UX polish).
- `loadAdminBotHealth` uses `like(target, 'bot.%')` for Drizzle instead of raw SQL LIKE — requires Drizzle `like` import from `drizzle-orm` (added to import line).
- System-health page still uses the existing `loadSystemHealth` call; the manual-review summary is a second parallel call to `loadManualReviewItems` — acceptable as both are fast DB reads.

---

## Remaining / follow-up

- Support ticket assign-to-me button (F-08 from admin-ops-ux-auditor) — not in this wave's OWNED FILES boundary (support/page.tsx)
- Admin overview page listUsers import replacement (F-09) — that page uses listUsers from lib/backend which is architecturally suboptimal but not a security defect; deferred
- Admin layout tone="bad" → tone="warn" for ADMIN MODE badge (F-10) — cosmetic; also outside admin layout.tsx which this implementer does not own
- Audit log auth guard (F-01 from security-auditor) — owned by admin-implementer, in audit-log/page.tsx; not in this wave's OWNED FILES boundary
- TV revoke reason thread (F-02/F-03 from security-auditor) — db-architect + tv-implementer scope
