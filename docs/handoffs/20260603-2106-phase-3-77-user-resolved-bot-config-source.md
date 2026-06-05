# Phase 3.77 handoff
## Scope
Implemented user-facing resolved bot config source handling for Tortila and Legacy.

This phase wires published admin-owned system defaults into user settings/setup/export without mutating live bots, provider state, worker state, or exchange connections. The resolved order is user override -> published/applying system default -> built-in fallback. Users can explicitly choose `Use system default` or `Customize my settings`; custom saves remain user-owned `bot_configs`, while system defaults remain admin-owned `bot_global_configs`.

Agent handoffs linked:
- `docs/handoffs/20260603-2047-user-resolved-bot-config-platform-auditor.md`
- `docs/handoffs/20260603-2044-user-resolved-bot-config-ux-auditor.md`
- `docs/handoffs/20260603-2045-user-resolved-bot-config-security-auditor.md`
- `docs/handoffs/20260603-2045-user-resolved-bot-config-tests-auditor.md`

All four background agents were closed after their handoffs were collected. No live bot start/stop/restart/retest/apply-config, worker tick/restart, SSH, tmux, systemd, `.env` read/write, exchange ping, provider DB mutation, or live provider probe was run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260603-2037-phase-3-76-admin-global-bot-config.md`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/cabinet/loader.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `tests/integration/*bot*`
- `tests/e2e/bot-settings.spec.ts`

## Files changed
- `packages/db/src/repositories.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/cabinet/loader.ts`
- `tests/integration/user-resolved-bot-config-db.test.ts`
- `tests/integration/user-resolved-bot-config-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `docs/handoffs/20260603-2106-phase-3-77-user-resolved-bot-config-source.md`

## Findings
1. Severity: High. User settings/setup previously skipped `bot_global_configs` and went from user config to built-in defaults. Evidence: `loadBotConfig` previously used only user instance/config repositories. Recommendation implemented: load a published/applying system default after entitlement-gated page access and before built-in fallback. Target part: user config resolver.
2. Severity: High. The broad admin helper could expose draft/archived/non-inheriting defaults if used directly. Evidence: auditors flagged `getBotGlobalConfig` as product/profile-only. Recommendation implemented: added `getPublishedBotGlobalConfig` and validated the stored JSON against the product schema before inheritance. Target part: DB/app resolver boundary.
3. Severity: High. `allowUserOverride=false` existed but was not enforced by user saves. Evidence: admin global defaults persisted the flag; user actions still called `persistBotConfig`. Recommendation implemented: custom saves/presets now fail closed and UI disables custom save controls when overrides are locked. Target part: user mutation authorization.
4. Severity: Medium. Export previously used `state.current ?? liveConfig`, which could make a Legacy runtime snapshot act like the WTC config source. Recommendation implemented: export now uses the resolved WTC config only while preserving the Legacy provider-mapping gate. Target part: config export route.
5. Severity: Medium. Cabinet/dashboard labels could still say "not saved" even when a system default was inherited. Recommendation implemented: dashboard and cabinet now surface `sourceLabel` and count inherited system defaults as an active strategy source. Target part: adjacent user product surfaces.

## Decisions
1. No new migration was added. `Use system default` is represented as a tiny user-owned marker config version, preserving user history while resolving the actual body from the latest published global default.
2. Published defaults are inherited only when `status='published'`, `appliesToNewUsers=true`, and the config passes the Tortila/Legacy Zod schema.
3. User overrides still win unless the current published default locks overrides with `allowUserOverride=false`.
4. Admin selected-user pages remain read-only; this phase did not add admin controls to mutate selected-user settings.
5. Runtime/provider snapshots remain evidence only and are not copied into system defaults or user custom configs.

## Risks
1. `Use system default` currently records a marker in the user config stream rather than a dedicated source-preference table. This avoids a migration but may deserve a first-class source state if more profile types are added.
2. Playwright coverage used the existing demo-mode settings spec; DB-backed published-default inheritance is covered by PGlite/static tests, not browser DB e2e.
3. Full `npm test`, full `npm run e2e`, and retained screenshot manifest acceptance were not run.

## Verification/tests
RUN:
1. `npx vitest run tests/integration/user-resolved-bot-config-db.test.ts tests/integration/user-resolved-bot-config-static.test.ts tests/integration/admin-global-bot-config-db.test.ts tests/integration/admin-global-bot-config-static.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/bot-read-safety-static.test.ts` - PASS, 41 tests.
2. `npm run typecheck -w @wtc/web` - PASS.
3. `npm run typecheck` - PASS.
4. `npm run lint` - PASS.
5. `npm run secret:scan` - PASS.
6. `npm run build -w @wtc/web` - PASS, 36 static pages generated and settings/setup built.
7. `npx playwright test tests/e2e/bot-settings.spec.ts --project=desktop` - PASS, 1 test.
8. `npx playwright test tests/e2e/bot-settings.spec.ts --project=mobile` - PASS, 1 test.
9. `npm run check:core` - PASS.
10. `git diff --check` - PASS.

NOT RUN / NOT GREEN:
1. Full `npm test` - not run; focused Vitest suites listed above were run.
2. Full `npm run e2e` / `node scripts/gates.mjs e2e` - not run; scoped bot settings desktop/mobile Playwright was run.
3. `node scripts/gates.mjs full` - not run; component gates were run individually.
4. `npm run evidence:visual` acceptance - not run; existing retained screenshots still require manifest-backed review. Playwright regenerated bot settings screenshots for smoke only.
5. DB migration apply/seed against a persistent DB - not run; PGlite migration replay covered the repository behavior in focused tests.
6. Live Legacy/Tortila bot continuity, worker tick/restart, exchange ping/test, provider DB live read/write, SSH, tmux, systemd, `.env` reads/writes, start/stop/retest/apply-config - forbidden by phase scope and not run.

## Next actions
1. Add a first-class source-preference table only if multiple global profiles or source transitions become more complex.
2. Add a guarded managed DB browser spec if visual acceptance must prove Postgres-backed published defaults end to end.
3. Add a visual review manifest before retaining new screenshots as acceptance artifacts.
