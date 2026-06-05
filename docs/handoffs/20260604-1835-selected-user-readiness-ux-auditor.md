# selected-user-readiness-ux-auditor handoff
## Scope
Phase 4.29 read-only UX/readiness wording audit after Phase 4.28. Scope was limited to admin selected-user bot drilldown and user/admin statistics wording, with special focus on preventing admins or users from reading global fleet health or aggregate `target='worker'` heartbeat as selected-user runtime proof. No code edits were made.

Worktree observed: `codex/bot-analytics-settings-canary-20260603` with many pre-existing modified and untracked Phase 3/4 files. This audit left them untouched.

## Files inspected
- `docs/handoffs/20260604-1827-phase-4-28-bot-statistics-completion-cockpit.md`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`

## Files changed
- `docs/handoffs/20260604-1835-selected-user-readiness-ux-auditor.md` - this handoff only.

## Findings
1. Severity P1 - Selected-user admin launch readiness still has one wording path that can be misread as selected-user proof: the worker heartbeat is a global/latest persisted `integration_health_checks.target='worker'` row, but the selected-user UI labels it as `Worker heartbeat` and can show a green/ready item. Evidence: the loader fetches one latest `target='worker'` row at `apps/web/src/features/admin/user-bot-detail-loader.ts:1039-1050`, projects it once at `apps/web/src/features/admin/user-bot-detail-loader.ts:1179-1180`, and attaches `workerContinuitySummary(productCode, workerHealth, now)` to every selected-user bot at `apps/web/src/features/admin/user-bot-detail-loader.ts:1230`. The summary itself says `Aggregate worker continuity...` or `Aggregate target='worker'...` at `apps/web/src/features/admin/user-bot-detail-loader.ts:366-416`, while the page labels the readiness item `Worker heartbeat` and marks it ready when `workerContinuity.state === 'ok'` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:352-355` and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:410-416`. Recommendation: rename selected-user labels to `Aggregate worker precheck` or `Fleet worker heartbeat`, keep `target='worker'` visible in the detail, and change the positive detail to `Global worker row is fresh for <product>; this is a fleet/product precheck, not selected-user runtime proof.` Target part: selected-user launch readiness mirror, selected-user command center, DB E2E visible text.

2. Severity P1 - Statistics can appear ready without the worker aggregate being green unless the reader notices the separate heartbeat row. Evidence: `adminStatisticsReadinessStatus()` returns `ready` from scoped evidence plus runtime state only at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:358-362`, `statisticsTone()` similarly ignores `workerContinuity` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:129-134`, and the statistics coverage `Analytics status` row uses runtime and scoped evidence but not the aggregate worker precheck at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:184-190`. Recommendation: either gate the selected-user `Statistics` readiness item on `bot.workerContinuity.state === 'ok'`, or use split copy: `User-scoped evidence present; aggregate worker precheck still pending` when stats/runtime are available but worker continuity is not green. Target part: selected-user statistics coverage matrix and `Admin launch readiness mirror`.

3. Severity P2 - The selected-user evidence ladder is good, but it omits the aggregate worker precheck as an explicit separate layer, so the canonical-looking ladder does not teach the global-vs-user proof boundary. Evidence: `userBotEvidenceRows()` includes `Entitlement gate`, `WTC settings source`, `Runtime scope`, `User-scoped statistics`, and `Admin boundary` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:306-343`; the rendered panel copy lists the same model at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:618-625`. Recommendation: add a row after `Runtime scope` named `Aggregate worker precheck` with proof `target='worker'` and detail `Fleet/product heartbeat only; combine with runtime scope and user-scoped statistics before calling this selected user ready.` Target part: selected-user evidence ladder and static tests.

4. Severity P2 - Read-only admin inspection is mostly correctly communicated and should be preserved. Evidence: the selected-user page header says user-owned bot settings and provider mappings are view-only at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:461-475`; the launch mirror copy disables start/stop/apply/test/edit/position mutation at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:604-615`; settings are displayed as resolved summaries at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:701-755`; user-scoped statistics render persisted metrics/positions/trades/equity without live probes at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:788-837`; provider mapping evidence says it does not create/disable/edit mappings at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:936-945`. Static tests assert no admin mapping, config save, CSRF submit, start/stop/apply, or connection-test controls at `tests/integration/admin-user-bot-detail-static.test.ts:140-154`. Recommendation: keep this wording and do not add settings/provider mutation controls to the selected-user page. Target part: selected-user drilldown.

5. Severity P2 - Admin users and fleet routing already separates users, mapped `pub_id`, and fleet diagnostics, but the wording should keep the route boundaries prominent. Evidence: `/admin/users` builds user rows that open `/admin/users/${user.id}/bots`, Tortila owner rows that deep-link to `#bot-tortila_bot`, and Legacy rows that only deep-link when mapped while unmapped rows go to `/admin/bots` at `apps/web/src/app/admin/users/page.tsx:54-106`; the info banner says results open read-only user settings/statistics and unmapped Legacy `pub_id` rows stay fleet diagnostics at `apps/web/src/app/admin/users/page.tsx:197-203`. `/admin/bots` says fleet evidence is not live-control proof at `apps/web/src/app/admin/bots/page.tsx:435-438`, says unmapped Legacy rows remain fleet diagnostics at `apps/web/src/app/admin/bots/page.tsx:442-447`, and renders the `Legacy pub_id inspector` at `apps/web/src/app/admin/bots/page.tsx:696-716`. Recommendation: keep `Open fleet diagnostics` for unmapped rows, and add `selected-user drilldown only after mapping` to any future shortcut copy. Target part: admin user directory and fleet bot page.

6. Severity P2 - Tests exist for the right surfaces, but the anti-misinterpretation contract should become an exact assertion rather than implied by current labels. Evidence: static coverage asserts `Worker heartbeat`, `No aggregate worker row`, `freshness} aggregate`, and `target='worker' aggregate` at `tests/integration/admin-user-bot-detail-static.test.ts:108-112` and `tests/integration/admin-user-bot-detail-static.test.ts:216-227`; DB E2E covers degraded-readable, fresh-green, stale, and missing worker/runtime scenarios at `tests/e2e/admin-user-bot-detail-db.spec.ts:22-104`, then asserts worker text and no mutation controls at `tests/e2e/admin-user-bot-detail-db.spec.ts:239-275`. Recommendation: update tests to require the exact copy `Aggregate worker precheck`, `not selected-user proof`, `user-scoped statistics`, `runtime snapshot`, and `read-only settings`; add one static assertion that statistics readiness references `workerContinuity` if the implementation gates it. Target part: `tests/integration/admin-user-bot-detail-static.test.ts` and `tests/e2e/admin-user-bot-detail-db.spec.ts`.

## Decisions
- Treated the selected-user page as a diagnostic/admin mirror, not a place to edit settings, provider mappings, credentials, live config, positions, or runtime state.
- Treated `target='worker'` as a fleet/product precheck only. It can support readiness, but it is not proof that the selected user's bot ran, traded, or owns the shown stats.
- Kept the audit read-only and did not run heavy gates per operator instruction.

## Risks
- If the selected-user `Worker heartbeat` row remains green/ready with short labels like `fresh aggregate`, operators may overstate a selected user's readiness from a global worker row.
- If `Statistics` can be green while worker continuity is stale/missing, the selected-user readiness mirror may look complete even though Phase 4.27/4.28 continuity proof is not satisfied.
- Existing DB E2E is opt-in and environment-dependent; without running it in the managed admin-user bot matrix, rendered copy regressions can slip through.

## Verification/tests
- Run: read-only source inspection with line-level evidence.
- Run: `git status --short --branch` to record that the worktree was already dirty before this handoff.
- Not run: `npx vitest ...` - skipped by scope; this was a wording/readiness audit only.
- Not run: `npx playwright ...` / `npm run e2e:admin-user-bots:db` - skipped by scope and requires the opt-in DB-backed harness.
- Not run: typecheck/build/lint - skipped by scope; no code changed.

## Next actions
1. Rename selected-user UI copy from generic `Worker heartbeat` to `Aggregate worker precheck` or `Fleet worker heartbeat` in the command center, launch readiness mirror, and tests.
2. Add explicit detail text: `This is a global target='worker' row, not selected-user proof. Selected-user readiness also requires product runtime snapshot and user-scoped statistics evidence.`
3. Decide implementation behavior: either gate selected-user `Statistics` readiness on `workerContinuity.state === 'ok'`, or keep statistics as user evidence and show `user evidence present; aggregate worker pending` when worker continuity is not green.
4. Add an `Aggregate worker precheck` row to the selected-user evidence ladder so admins can inspect entitlement, settings, aggregate worker, runtime scope, statistics, and admin boundary in one place.
5. Update static and DB E2E expectations to assert the new anti-misinterpretation copy and the read-only boundary.
