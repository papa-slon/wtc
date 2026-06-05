# phase-3-78-admin-user-resolved-source handoff
## Scope
Phase 3.78 completed a narrow admin selected-user drilldown slice: admins can now see the resolved WTC bot settings source for a selected user without gaining edit controls over that user's settings.

Resolved source order is now visible on `/admin/users/[userId]/bots` as `user_override -> system_default -> built_in`. The loader also handles explicit "Use system default" marker rows and locked admin defaults correctly. Live bot control, worker operation, provider DB reads, exchange testing, `.env` handling, and start/stop/apply/retest paths remained out of scope and were not touched.

## Agent handoffs
- `docs/handoffs/20260603-2114-admin-user-resolved-source-platform-auditor.md`
- `docs/handoffs/20260603-2114-admin-user-resolved-source-tests-auditor.md`
- `docs/handoffs/20260603-2116-admin-user-resolved-source-ux-security-auditor.md`

All three background agents were closed after their results were collected:
- `019e8dd2-d4ea-7c21-aeb3-3f91abe724c7`
- `019e8dd2-e92f-7833-ac93-89997861479c`
- `019e8dd2-fff5-7a73-ab0f-6be7a517136a`

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-2106-phase-3-77-user-resolved-bot-config-source.md`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/bots/config.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-global-bot-config-db.test.ts`
- `tests/integration/admin-global-bot-config-static.test.ts`
- `tests/integration/user-resolved-bot-config-db.test.ts`
- `tests/integration/user-resolved-bot-config-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`

## Files changed
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `docs/handoffs/20260603-2138-phase-3-78-admin-user-resolved-source.md`

## Findings
1. Severity: High. The selected-user admin drilldown previously only summarized saved user `bot_configs`, so inherited system defaults and built-in fallback looked like "no saved settings." Fixed by adding an admin-safe resolver over user config rows plus published/applying `bot_global_configs`.
2. Severity: High. A user row that only stored the `__wtcBotConfigSource=system_default` marker could be misreported as a saved custom strategy. Fixed by detecting the marker and resolving the displayed body from the current valid published system default.
3. Severity: Medium. A locked system default (`allowUserOverride=false`) needed to override an existing stale user custom row in the admin projection. Fixed and covered in PGlite tests.
4. Severity: High. Short Legacy provider ids could render raw because the masking helper returned ids of length <= 10 unchanged. Fixed for selected-user mapping evidence by rendering a deterministic `id#<sha256-prefix>` fingerprint for short ids.

## Decisions
1. The admin loader now keeps two concepts separate: user saved version evidence (`configVersion`, `userVersion`, `userUpdatedAt`) and resolved active settings source (`source`, `sourceLabel`, `sourceDetail`, `systemDefault`).
2. Admin selected-user pages remain read-only: no user setting save, no system-default save, no provider mapping form, and no live start/stop/apply/test controls were added.
3. The resolver validates admin-visible global defaults with a local safe-summary schema and never returns raw config JSON to the page DTO.
4. The adjacent `/admin/bots` fleet diagnostics raw `pub_id` policy was not changed in this slice; this phase only fixed selected-user mapping evidence.

## Risks
1. The global default validation is intentionally a safe-summary validator, not a full copy of the user settings Zod schema, to avoid importing `server-only` user settings code into PGlite-loaded admin tests. Full global default writes are still validated by the admin save action.
2. `/admin/bots` may still show raw fleet `pub_id` values by design. If selected-user and fleet journeys must share the same redaction policy, that needs a separate fleet diagnostics slice.
3. The worktree remains broadly dirty from earlier phases. This phase only touched the scoped files listed above and did not revert unrelated changes.

## Verification/tests
RUN and PASS:
1. `npx vitest run tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts` - 2 files, 7 tests.
2. `npx vitest run tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-global-bot-config-db.test.ts tests/integration/admin-global-bot-config-static.test.ts tests/integration/user-resolved-bot-config-db.test.ts tests/integration/user-resolved-bot-config-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-export-static.test.ts` - 8 files, 48 tests.
3. `npm run typecheck -w @wtc/web` - PASS.
4. `npm run typecheck` - PASS.
5. `npm run lint` - PASS.
6. `npm run secret:scan` - PASS.
7. `npm run build -w @wtc/web` - PASS, 36 static pages generated.
8. `npm run check:core` - PASS.
9. `npm run governance:check` - PASS, 0 errors and 1 known historical warning.
10. `git diff --check` - PASS.
11. `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` - PASS, 1 test.
12. `npm run evidence:visual -- --inventory tests/e2e/screenshots` - PASS, 75 image files, 0 blocked artifacts.

NOT RUN:
1. Full `npm test` - skipped for phase scope; focused DB/static suites covered the changed contracts.
2. Full `npm run e2e` - skipped for phase scope; the mobile admin PG8 smoke was run instead.
3. `node scripts/gates.mjs full` and `node scripts/gates.mjs e2e` - skipped; not required for this narrow slice.
4. Persistent DB migrate/seed - skipped; PGlite replayed migrations locally in the focused DB tests.
5. Live Legacy/Tortila bot continuity, worker tick/restart, exchange ping/test, provider DB live read/write, SSH, tmux, systemd, `.env` reads/writes, start/stop/retest/apply-config - forbidden by the safety protocol and not run.
6. Browser proof of DB-backed selected-user source labels - skipped because the current admin mobile e2e runs in demo mode; DB-backed source semantics are proven in PGlite tests.

## Next actions
1. Decide whether `/admin/bots` fleet diagnostics should mask raw Legacy `pub_id` values like selected-user mapping evidence.
2. Continue closing the remaining broader user goal by connecting the same source clarity into the next highest-risk bot settings/statistics/admin workflow slice, without live bot mutation.
