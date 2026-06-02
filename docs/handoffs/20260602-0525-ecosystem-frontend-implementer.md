# ecosystem-frontend-implementer handoff
## Scope
Phase 3.34 read-only audit of the admin/operator UI surface for count-only LMS cleanup dead-letter review and alerting after Phase 3.33. Inspect existing admin routes, components, and design conventions. Recommend minimal UI integration that does not expose LMS object keys, filenames, hashes, task IDs, signed URLs, provider headers, or provider error bodies.
## Files inspected
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/admin/system-health/page.tsx`
- `apps/web/src/app/admin/education/page.tsx`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/health-detail.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/lib/nav.ts`
- `packages/ui/src/components.tsx`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `tests/integration/admin-health-detail.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/lms-object-cleanup-tasks.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `docs/handoffs/20260602-0506-phase-3-33-lms-durable-upload-cleanup.md`
## Files changed
None - read-only audit.
## Findings
1. High - Current admin health projection hides the Phase 3.33 LMS cleanup counts even though the worker writes them. Evidence: worker health status becomes `error` when pending cleanup fails or dead-letters, then writes `lmsPendingObjectCleanupScanned`, `lmsPendingObjectDeleteAttempted`, `lmsPendingObjectDeleteConfirmed`, `lmsPendingObjectCleanupCompleted`, `lmsPendingObjectCleanupFailed`, and `lmsPendingObjectCleanupDeadLettered` into `integration_health_checks.detail` at `apps/worker/src/index.ts:124-144`; `projectHealthDetail()` only keeps keys in `SAFE_HEALTH_DETAIL_KEYS`, which currently ends at generic/bot/TV keys and omits all LMS cleanup fields at `apps/web/src/features/admin/health-detail.ts:3-24`; `/admin/system-health` reads the latest `target='worker'` row and projects detail through that allowlist at `apps/web/src/features/admin/queries.ts:159-194`. Recommendation: add only the six Phase 3.33 count keys to `SAFE_HEALTH_DETAIL_KEYS`, then render them as count metrics. Target part: admin health projection and `/admin/system-health`.
2. High - The UI must not render `lms_object_cleanup_tasks` rows directly. Evidence: the table intentionally contains `storage_key` at `packages/db/src/schema.ts:302-323`; `listPendingLmsObjectCleanupTasks()` returns `cleanupTaskId` and `storageKey` for worker use at `packages/db/src/repositories.ts:914-950`; Phase 3.33 tests require worker health detail to omit cleanup task IDs, object key fragments, and object-storage secrets at `tests/integration/worker-tortila-snapshot.test.ts:320-337`; generated-artifact scanning fails on pending upload cleanup logs that contain task IDs, object paths, `Authorization`, or `X-Amz-*` material at `tests/integration/lms-db-e2e-artifact-scan.test.ts:88-96`. Recommendation: if the UI needs a live backlog count, add a count-only aggregate loader that selects counts by status/reason/provider and never selects `id`, `storage_key`, `last_error_code`, URL, header, filename, hash, or task-level timestamps. Target part: admin data loader contract.
3. Medium - `/admin/system-health` is the correct minimal integration point; `/admin/education` should stay course/moderation-focused. Evidence: `/admin/system-health` already owns worker heartbeat/status, storage mode, safety policy, billing review queue, TV queue counts, and integration health rows at `apps/web/src/app/admin/system-health/page.tsx:20-23`, `apps/web/src/app/admin/system-health/page.tsx:40-67`, `apps/web/src/app/admin/system-health/page.tsx:118-149`, and `apps/web/src/app/admin/system-health/page.tsx:175-218`; `/admin/education` is course/teacher/enrollment management at `apps/web/src/app/admin/education/page.tsx:20-33` and `apps/web/src/app/admin/education/page.tsx:56-80`; `ADMIN_NAV` already includes `System Health` at `apps/web/src/lib/nav.ts:20-31`. Recommendation: add a compact `Card title="LMS object cleanup"` after the Worker heartbeat card and before safety-disabled policy, using existing `MetricCard` and `StatusPill` components. Target part: admin operator layout.
4. Medium - The alert should be count-only and non-mutating in this phase. Evidence: existing UI primitives support compact cards, action pills, and metrics at `packages/ui/src/components.tsx:13-24`, `packages/ui/src/components.tsx:37-53`; admin pages consistently use per-page `requireUser()` plus `assertAdmin()` at `apps/web/src/app/admin/system-health/page.tsx:8-13` and the layout also gates admin access at `apps/web/src/app/admin/layout.tsx:12-16`; there is no existing cleanup resolution action, and admin actions follow mutation protocol `requireUser -> assertAdmin -> assertCsrf -> Zod -> repo -> revalidatePath` at `apps/web/src/features/admin/actions.ts:1-18`. Recommendation: first UI pass should show status only: `bad` when dead-letter count is above 0, `warn` when failed count is above 0 or worker heartbeat is stale, and `ok` when latest worker tick reports zero failed/dead-lettered cleanup. Do not add retry/delete/resolve buttons until a backend operational workflow is specified and audited. Target part: operator alert behavior.
5. Low - A new admin route/nav item is unnecessary and would increase mobile acceptance work. Evidence: the admin nav currently enumerates all admin pages at `apps/web/src/lib/nav.ts:20-31`; PG8 mobile e2e enumerates every admin page and requires visible mobile nav, storage pill, and no horizontal scroll at `tests/e2e/admin-mobile-pg8.spec.ts:20-57`; static responsive guards require wrapped tables, `data-label` cells for tables, and a `StatusPill` on every admin page at `tests/integration/admin-responsive.test.ts:68-89`. Recommendation: avoid a new `/admin/lms-cleanup` page for Phase 3.34; keep the first review/alerting surface inside `/admin/system-health`. Target part: admin navigation and mobile acceptance.
## Decisions
- Recommend `/admin/system-health` as the frontend home for LMS cleanup review/alerting because the signal is operational worker health, not teacher/course moderation.
- Recommend count-only rendering from sanitized worker health detail plus, if needed, a count-only DB aggregate. Do not render task rows, object keys, filenames, hashes, task IDs, signed URLs, headers, last raw provider errors, or file-level timestamps.
- Recommend no mutation controls in the first UI slice. Dead-letter remediation needs a separate backend/security/education audit because a retry/resolve/delete button would be an operational mutation.
- Recommend reusing existing `Card`, `MetricCard`, `StatusPill`, `EmptyState`/dim text, `wtc-row`, and `wtc-grid` conventions instead of adding a new UI pattern.
## Risks
- If only the worker status pill changes to `error` while the LMS count keys remain filtered out, operators will see a red worker but not the cleanup reason.
- If an implementer queries `lms_object_cleanup_tasks` directly for a review table, object keys and task IDs can leak into rendered HTML, screenshots, logs, or browser artifacts.
- A dedicated route would require nav, responsive, and e2e updates while duplicating existing system-health responsibilities.
- A retry/resolve UI without a specified backend state machine could create unaudited live object-store mutations.
## Verification/tests
Read-only audit only; no tests or gates run by this agent.
Recommended implementation gates for the next frontend slice:
- `npm test -- tests/integration/admin-health-detail.test.ts tests/integration/admin-responsive.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `npm run typecheck -w @wtc/web`
- `node scripts/gates.mjs e2e` or at minimum the admin mobile PG8 spec after any `/admin/system-health` layout change.
## Next actions
1. Add the six Phase 3.33 LMS cleanup count keys to `SAFE_HEALTH_DETAIL_KEYS` and extend `tests/integration/admin-health-detail.test.ts` to prove the count keys pass while `storageKey`, `cleanupTaskId`, `fileName`, `contentSha256`, `Authorization`, and `X-Amz-*` do not.
2. Add a count-only `LMS object cleanup` card to `/admin/system-health` after Worker heartbeat. Suggested metrics: scanned, delete attempted, delete confirmed, completed, failed, dead-lettered. Suggested action pill: `0 dead-lettered` ok, `<n> failed` warn, `<n> dead-lettered` bad.
3. If current backlog needs to survive beyond latest heartbeat, add a loader field such as `lmsCleanupBacklogCounts` that performs count-only aggregation over `lms_object_cleanup_tasks` statuses and does not select row identifiers or object metadata.
4. Keep `/admin/education` unchanged except for future course/material moderation needs; do not add cleanup task data to LMS teacher/student DTOs or course pages.
