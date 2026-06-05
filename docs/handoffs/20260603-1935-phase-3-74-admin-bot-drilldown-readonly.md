# Phase 3.74 admin bot drilldown read-only handoff
## Scope
Bounded implementation slice for the admin side of the Legacy/Tortila bot objective: an admin can open a user from `/admin/users`, inspect that user's bot access, safe saved WTC settings summary, masked provider mapping evidence, safe exchange-key metadata, and latest metric summary without editing the user's bot settings.

Read-only background agents were launched before product edits and closed before final report:
- `docs/handoffs/20260603-1918-admin-bot-drilldown-ux-auditor.md`
- `docs/handoffs/20260603-1921-admin-bot-drilldown-security-auditor.md`
- `docs/handoffs/20260603-1922-admin-bot-drilldown-platform-auditor.md`
- `docs/handoffs/20260603-1926-admin-bot-drilldown-tests-auditor.md`

No live Legacy/Tortila bot start, stop, restart, retest, exchange ping, apply-config, SSH, tmux, systemd, `.env`, provider DB mutation, or live bot control path was run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1910-phase-3-73-bot-settings-source-truth.md`
- Four Phase 3.74 per-agent handoffs listed above.
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/types.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`

## Files changed
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/types.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `docs/handoffs/20260603-1935-phase-3-74-admin-bot-drilldown-readonly.md`

## Findings
1. Severity: High. Evidence: UX/security agents found the user drilldown claimed read-only but rendered `Map Legacy pub_id` and `Disable` forms. Fix: removed mutation imports, CSRF forms, submit buttons, and action column from `/admin/users/[userId]/bots`; provider mappings are display-only on this page.
2. Severity: High. Evidence: security/tests agents found full Legacy `pub_id` flowed through normal admin DTO/UI. Fix: admin DTO masks provider account ids before rendering; tests assert full target and non-target pub_ids do not appear.
3. Severity: High. Evidence: security agent found provider mapping audit payload wrote full `providerAccountId`. Fix: mapping audit payload now writes `providerAccountIdMasked`, while the DB row keeps the full id for worker scoping.
4. Severity: Medium. Evidence: security agent flagged disable action predicate as too broad. Fix: server action now calls disable with required `productCode: 'legacy_bot'` and `provider: 'legacy-db'`; repository validates both when supplied.
5. Severity: Medium. Evidence: platform/UX agents found admin detail did not render saved user bot settings. Fix: loader now projects a safe config summary and the UI renders a read-only `Saved WTC settings` block per bot without raw config/history/secrets.

## Decisions
1. `/admin/users/[userId]/bots` is a read-only user drilldown, not a system configuration surface.
2. System/global bot defaults and provider mapping mutation controls belong in a separate admin system-config surface, not inside a selected user's read-only detail page.
3. User-owned saved settings can be summarized for admin, but raw `bot_configs.config`, config history JSON, exchange secrets, and live-apply credentials stay out of the DTO.
4. Provider account ids are masked in normal admin UI/DTO; full ids stay only in DB mappings needed for worker scoping.

## Risks
1. Positions, trades, and equity curves are not yet rendered in this admin drilldown. The current slice shows latest metric summary only; platform auditor recorded this as the next admin statistics gap.
2. Global admin bot configuration is still not implemented. The user-facing settings/source-truth work and admin drilldown are now separated, but the system-defaults/admin-config screen remains a future slice.
3. The worktree contains substantial pre-existing changes from adjacent bot/admin phases; this slice avoided reverting unrelated files.

## Verification/tests
RUN:
1. Four read-only background agent audits completed and were closed.
2. `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts` - PASS, 6 tests.
3. `npm run typecheck` - PASS.
4. `npm run typecheck -w @wtc/web` - PASS.
5. `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/bot-statistics-static.test.ts` - PASS, 37 tests.
6. `npm run lint` - PASS.
7. `npm run secret:scan` - PASS.
8. `npm run build -w @wtc/web` - PASS, `/admin/users/[userId]/bots` included.
9. `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` - PASS.

NOT RUN:
1. Full `npm test` - skipped because this was a bounded admin drilldown slice and focused integration, typecheck, lint, build, secret, and mobile admin gates were run.
2. DB migration apply/push - skipped because this slice did not add migrations.
3. Live Legacy/Tortila bot continuity proof, process watchdog, SSH, tmux, systemd, worker restart, exchange ping, provider DB mutation/read outside app mocks, `.env` reads, start/stop/retest/apply-config - forbidden by scope and not run.
4. Admin positions/trades/equity drilldown - not implemented in this slice; platform auditor marked it as next statistics gap.
5. Global admin bot configuration page - not implemented in this slice; it should be separate from user drilldown.

## Next actions
1. Phase 3.75: add admin read-only positions/trades/equity panels for selected user/bot using the same target-user scoping and provider mapping rules.
2. Phase 3.76: build separate admin global bot configuration/system-defaults surface, explicitly not user-owned settings.
3. Add browser QA for `/admin/users/[userId]/bots` against a DB-backed fixture once there is a stable seeded target user route for Playwright.
