# phase-4-11-admin-runtime-evidence-ladder handoff
## Scope
Add a read-only admin runtime evidence ladder for bot fleet diagnostics and selected-user bot drilldowns. The slice makes admin evidence explicit without adding live bot control, exchange key reads, user setting mutation, provider mapping mutation, or direct runtime probes during render.

Per-agent handoffs linked:
- docs/handoffs/20260604-1049-admin-runtime-evidence-platform-security-auditor.md
- docs/handoffs/20260604-1049-admin-runtime-evidence-ux-auditor.md
- docs/handoffs/20260604-1049-admin-runtime-evidence-tests-auditor.md

All three background agents were closed before this aggregate handoff.

## Files inspected
- AGENTS.md
- docs/SESSION_PROTOCOL.md
- docs/handoffs/20260604-1045-phase-4-10-tortila-runtime-evidence-ladder.md
- docs/handoffs/20260604-1049-admin-runtime-evidence-platform-security-auditor.md
- docs/handoffs/20260604-1049-admin-runtime-evidence-ux-auditor.md
- docs/handoffs/20260604-1049-admin-runtime-evidence-tests-auditor.md
- apps/web/src/app/admin/bots/page.tsx
- apps/web/src/app/admin/users/[userId]/bots/page.tsx
- apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx
- tests/integration/admin-user-bot-detail-static.test.ts
- tests/integration/bot-read-safety-static.test.ts
- tests/e2e/admin-mobile-pg8.spec.ts
- tests/e2e/admin-user-bot-detail-db.spec.ts

## Files changed
- apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx
- apps/web/src/app/admin/bots/page.tsx
- apps/web/src/app/admin/users/[userId]/bots/page.tsx
- tests/integration/admin-user-bot-detail-static.test.ts
- tests/integration/bot-read-safety-static.test.ts
- tests/e2e/admin-mobile-pg8.spec.ts
- tests/e2e/admin-user-bot-detail-db.spec.ts
- docs/handoffs/20260604-1049-admin-runtime-evidence-platform-security-auditor.md
- docs/handoffs/20260604-1049-admin-runtime-evidence-ux-auditor.md
- docs/handoffs/20260604-1049-admin-runtime-evidence-tests-auditor.md
- docs/handoffs/20260604-1111-phase-4-11-admin-runtime-evidence-ladder.md

## Findings
1. Severity P1 - evidence apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx:18 - recommendation: keep admin runtime proof in a dedicated read-only component - target part: admin runtime evidence UI. The new shared panel renders read-only metrics and proof rows and repeats the admin boundary copy at apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx:36 and apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx:76.
2. Severity P1 - evidence apps/web/src/app/admin/bots/page.tsx:318 - recommendation: separate fleet evidence from user setting control - target part: admin bot fleet page. The fleet page now has an "Admin fleet evidence ladder" and feeds it with explicit metrics/rows from apps/web/src/app/admin/bots/page.tsx:138 and apps/web/src/app/admin/bots/page.tsx:184.
3. Severity P1 - evidence apps/web/src/app/admin/bots/page.tsx:164 and apps/web/src/app/admin/bots/page.tsx:170 - recommendation: do not collapse Tortila and Legacy freshness into one metric - target part: fleet runtime freshness. Tortila metric freshness and Legacy pub_id freshness are now separate.
4. Severity P2 - evidence apps/web/src/app/admin/bots/page.tsx:56 - recommendation: make admin owner drilldown rows auditable by stable user id - target part: owner identity UX. Mapped owners now show User ID in addition to display name/email.
5. Severity P1 - evidence apps/web/src/app/admin/users/[userId]/bots/page.tsx:299 - recommendation: show selected-user evidence inside each bot card without nested cards - target part: selected-user admin drilldown. The page now renders a dense "Selected-user evidence ladder" with framed=false at apps/web/src/app/admin/users/[userId]/bots/page.tsx:303.
6. Severity P1 - evidence apps/web/src/app/admin/users/[userId]/bots/page.tsx:96 and apps/web/src/app/admin/users/[userId]/bots/page.tsx:160 - recommendation: count scoped statistics evidence from metric, position, trade, and equity rows - target part: user-scoped statistics proof. A metric row is no longer the only accepted proof of statistics evidence.
7. Severity P2 - evidence tests/e2e/admin-mobile-pg8.spec.ts:53 and tests/e2e/admin-user-bot-detail-db.spec.ts:122 - recommendation: lock the evidence ladder with static and browser acceptance - target part: test coverage. Mobile admin acceptance and opt-in DB e2e now assert the new visible evidence markers.

## Decisions
- Admin evidence remains diagnostic only. This phase did not add start, stop, apply, retest, exchange ping, provider mapping mutation, or user settings mutation.
- Fleet proof separates persisted integration health checks, Tortila owner snapshots, Legacy pub_id scope, and admin read-only boundary.
- Selected-user proof uses the existing admin loader scope and does not reach into exchange key secrets, raw provider payloads, or live adapters.
- The all-user index question remains open: the current fleet evidence is a runtime evidence ladder over available persisted bot rows, not a complete all-users directory.

## Risks
- The DB-backed selected-user browser harness was not run because ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL was absent. Static and mobile admin browser gates passed, but the full throwaway Postgres acceptance remains the next high-value proof.
- Browser plugin DOM verification was attempted earlier in the phase but was blocked by an in-app browser user-cookie redirect and CDP timeout. Playwright CLI mobile acceptance is the current visual/browser proof.
- This phase does not prove live bot continuity directly. It only makes persisted worker/runtime evidence clearer in admin UI and keeps live-control gates closed.
- Legacy provider raw snapshot DTO shaping still deserves a sanitizer/pick-list follow-up if the admin fleet loader is broadened.

## Verification/tests
RUN:
- npm run typecheck -w @wtc/web - PASSED after fixing latestMetric nullability.
- npx eslint apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx apps/web/src/app/admin/bots/page.tsx 'apps/web/src/app/admin/users/[userId]/bots/page.tsx' tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/e2e/admin-mobile-pg8.spec.ts tests/e2e/admin-user-bot-detail-db.spec.ts --max-warnings 0 - PASSED.
- npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-responsive.test.ts tests/integration/admin-bot-health-loader.test.ts tests/integration/admin-user-bot-detail-loader.test.ts - PASSED, 5 files, 84 tests.
- $env:E2E_PORT='3428'; npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile - PASSED, 1 test.
- npm run secret:scan - PASSED.
- Earlier focused gates before the final nullability/static-test fix also caught two useful issues: typecheck flagged nullable latestMetric, and Vitest flagged the static denylist false positive around AdminBotRuntimeEvidencePanel naming. Both were fixed and re-run green.

NOT RUN:
- npm run e2e:admin-user-bots:db:managed - NOT RUN because ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL was absent; the harness requires a throwaway/admin Postgres URL.
- Browser plugin DOM route verification - NOT GREEN because the in-app browser session redirected to /app as a non-admin user and then hit a CDP timeout during logout/login. Playwright CLI mobile acceptance was used instead.
- Worker tick, DB migrations/seeds, provider/exchange/journal calls, bot start/stop/apply/retest, env/secret value reads, deploy/SSH/tmux/systemd - NOT RUN by safety scope.
- Full npm run ci:local and full desktop+mobile Playwright suite - NOT RUN due scope/time; targeted gates for this slice passed.

## Next actions
1. Run the guarded DB browser proof with a throwaway Postgres database: ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL=postgres://<redacted-maintenance-db> npm run e2e:admin-user-bots:db:managed.
2. Add a broader admin fleet all-users index only after deciding whether it belongs on /admin/bots or a separate admin/user runtime matrix.
3. Continue toward the broader goal with the next new phase session: runtime continuity proof for Legacy/Tortila worker evidence, then premium user-facing bot settings/statistics polish.
