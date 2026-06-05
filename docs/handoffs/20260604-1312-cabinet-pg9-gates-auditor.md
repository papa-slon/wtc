# cabinet-pg9-gates-auditor handoff
## Scope
Read-only Phase 4.16 gate audit for the cabinet PG9/setup-wizard repair path. The audit focused on the minimum verification set needed after a small cabinet setup fix, how to rerun/report `node scripts/gates.mjs core` honestly, which DB/live bot/browser gates remain out of scope, and exact aggregate handoff language that avoids overclaiming.

No application code was edited. No DB-mutating acceptance, live bot control, exchange/provider calls, raw env reads, or raw secret reads were performed.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `scripts/gates.mjs`
- `package.json`
- `tests/integration/cabinet-pg9.test.ts`
- `logs/gates/test.log`
- `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `packages/cabinet/src/derive.ts`
- `packages/cabinet/src/derive.test.ts`
- `apps/web/src/features/cabinet/loader.ts`
- `apps/web/src/features/cabinet/CabinetProductCard.tsx`
- `apps/web/src/app/(app)/app/page.tsx`
- `tests/e2e/cabinet-pg9-mobile.spec.ts`
- `playwright.admin-user-bots-db.config.ts`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/safe-worker-tick.mjs`

## Files changed
- `docs/handoffs/20260604-1312-cabinet-pg9-gates-auditor.md` - this read-only audit handoff.
- Application code: None - read-only audit.

## Findings
1. Severity P1 - evidence `logs/gates/test.log:124`, `logs/gates/test.log:125`, `logs/gates/test.log:126`, `logs/gates/test.log:500`, `logs/gates/test.log:501`, `logs/gates/test.log:502`, `tests/integration/cabinet-pg9.test.ts:103`, `tests/integration/cabinet-pg9.test.ts:105`, `tests/integration/cabinet-pg9.test.ts:111` - recommendation: the first post-repair proof must be the isolated cabinet PG9 guard: `npx vitest run tests/integration/cabinet-pg9.test.ts`. Target part: cabinet/setup wizard static regression guard. This is the known failing gate from Phase 4.15 and it specifically expects at least two entitlement fail-closed server-action checks in the setup wizard.

2. Severity P1 - evidence `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:113`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:115`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:116`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:121`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:122`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:135`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:137`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:138`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:147`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:148` - recommendation: after the minimal setup fix, also run web-aware static checks: `npm run typecheck -w @wtc/web`, `npm run typecheck`, and `npm run lint` (or an equivalent ESLint invocation over the touched setup/cabinet files). Target part: setup wizard server actions and web TSX. Current source has the CSRF-before-session order, but the second entitlement deny branch is a redirect shape while the PG9 guard counts `if (!access.allowed) return;`.

3. Severity P2 - evidence `tests/integration/cabinet-pg9.test.ts:12`, `packages/cabinet/src/derive.ts:213`, `packages/cabinet/src/derive.ts:220`, `packages/cabinet/src/derive.ts:224`, `packages/cabinet/src/derive.ts:227`, `packages/cabinet/src/derive.test.ts:165`, `packages/cabinet/src/derive.test.ts:167`, `packages/cabinet/src/derive.test.ts:179`, `packages/cabinet/src/derive.test.ts:186` - recommendation: include `npx vitest run packages/cabinet/src/derive.test.ts` if the repair touches `@wtc/cabinet`, the cabinet loader, or entitlement fail-closed derivation; otherwise keep it as a low-cost optional companion to the isolated PG9 guard. Target part: cabinet pure deriver invariants.

4. Severity P2 - evidence `tests/integration/cabinet-pg9.test.ts:12`, `tests/integration/cabinet-pg9.test.ts:13`, `tests/e2e/cabinet-pg9-mobile.spec.ts:13`, `tests/e2e/cabinet-pg9-mobile.spec.ts:31`, `tests/e2e/cabinet-pg9-mobile.spec.ts:41`, `tests/e2e/cabinet-pg9-mobile.spec.ts:56` - recommendation: do not make PG9 Playwright/mobile proof part of the minimum server-action-only repair gate. Run `npx playwright test tests/e2e/cabinet-pg9-mobile.spec.ts --project=mobile` only if the repair changes rendered layout, wizard markup/classes, navigation, or mobile behavior, and then report it as a separate browser gate. Target part: PG9 mobile/browser acceptance.

5. Severity P1 - evidence `scripts/gates.mjs:13`, `scripts/gates.mjs:15`, `scripts/gates.mjs:31`, `scripts/gates.mjs:38`, `scripts/gates.mjs:39`, `scripts/gates.mjs:48`, `scripts/gates.mjs:50`, `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md:63`, `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md:64` - recommendation: rerun full `node scripts/gates.mjs core` only after the isolated cabinet PG9 guard and web lint/typecheck set pass, if this phase intends to claim core green. Target part: aggregate gate reporting. Core includes `npm test`, so without the repair it will fail again at `test`; with the repair it can still fail on unrelated full-suite instability and must be reported by the new observed failing log, not assumed green from Phase 4.15.

6. Severity P1 - evidence `logs/gates/test.log:320`, `logs/gates/test.log:322`, `logs/gates/test.log:323`, `logs/gates/test.log:325`, `logs/gates/test.log:326`, `logs/gates/test.log:327`, `logs/gates/test.log:513`, `logs/gates/test.log:514`, `logs/gates/test.log:515`, `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md:53` - recommendation: expected full-core failure modes to call out are: the known `tests/integration/cabinet-pg9.test.ts` failure if not fixed, and a possible Vitest worker unexpected-exit/unhandled-error in the full `npm test` run. Target part: honest core rerun reporting. A targeted PG9 pass alone is not the same as full `npm test` or full `core` green.

7. Severity P1 - evidence `package.json:24`, `package.json:25`, `package.json:26`, `package.json:34`, `package.json:35`, `package.json:41`, `playwright.admin-user-bots-db.config.ts:14`, `playwright.admin-user-bots-db.config.ts:17`, `playwright.admin-user-bots-db.config.ts:20`, `scripts/run-admin-user-bot-detail-e2e.mjs:7`, `scripts/run-admin-user-bot-detail-e2e.mjs:10`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:9`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:14`, `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md:67`, `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md:70` - recommendation: DB-backed browser/admin-user-bot acceptance remains NOT RUN in this cabinet repair phase unless an explicit throwaway Postgres target is provided and the operator scopes it in. Target part: DB/browser acceptance safety.

8. Severity P1 - evidence `package.json:22`, `package.json:23`, `scripts/safe-worker-tick.mjs:3`, `scripts/safe-worker-tick.mjs:4`, `scripts/safe-worker-tick.mjs:9`, `scripts/safe-worker-tick.mjs:11`, `scripts/safe-worker-tick.mjs:12`, `scripts/safe-worker-tick.mjs:13`, `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md:71`, `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md:72`, `AGENTS.md:76`, `AGENTS.md:77`, `AGENTS.md:81`, `AGENTS.md:82` - recommendation: live/DB worker continuity, live bot start/stop/apply-config, exchange/provider calls, raw env reads, and raw secret reads remain NOT RUN. Target part: safety gates. The minimal cabinet setup repair does not require these gates and should not claim them.

9. Severity P2 - evidence `AGENTS.md:57`, `docs/SESSION_PROTOCOL.md:54`, `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md:57`, `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md:67` - recommendation: aggregate handoff language must list exact gates RUN and exact gates NOT RUN. Target part: phase handoff. Do not write "core green" unless `node scripts/gates.mjs core` was rerun and observed green in this phase.

## Decisions
- Minimum post-fix verification set for a server-action-only cabinet PG9 setup fix:
  - `npx vitest run tests/integration/cabinet-pg9.test.ts`
  - `npm run typecheck -w @wtc/web`
  - `npm run typecheck`
  - `npm run lint`
- Add `npx vitest run packages/cabinet/src/derive.test.ts` if the repair touches `packages/cabinet`, cabinet derivation, or fail-closed view-model behavior; it is optional but cheap for a pure setup-page-only fix.
- Do not include PG9 mobile Playwright in the minimum if the repair only changes server-action entitlement handling. Run it only for rendered UI/layout/navigation changes.
- Rerun `node scripts/gates.mjs core` after the targeted set passes if the operator wants to close the Phase 4.15 red core gate. If it is not rerun, the aggregate must say core was NOT RUN in Phase 4.16 and remained previously red in Phase 4.15 due `test`.
- Keep DB-backed browser E2E, DB mutation/migrate/seed acceptance, worker continuity, live bot control, exchange/provider calls, and raw env/secret reads NOT RUN for this cabinet phase unless separately scoped with explicit throwaway targets.

## Risks
- Current audit-time source still shows the failing pattern: one entitlement deny branch as `return` and one as `redirect`; without a code repair, the isolated PG9 guard is expected to fail again.
- A targeted PG9 pass can close the known cabinet failure but cannot prove the whole `npm test` suite or full `node scripts/gates.mjs core` unless those commands are actually rerun.
- Full `npm test`/`core` may expose unrelated failures or a Vitest worker unexpected exit after the cabinet guard is fixed. The aggregate should report the new observed failure mode rather than describing the cabinet repair as complete core recovery.
- Running DB/browser/live gates without fresh throwaway targets or explicit scope would violate the phase boundary and could create unsafe evidence.

## Verification/tests
RUN by this read-only auditor:
- No tests or gates were executed. This lane inspected source, retained logs, gate definitions, and prior aggregate handoff evidence only.

NOT RUN by this read-only auditor:
- `npx vitest run tests/integration/cabinet-pg9.test.ts`
- `npx vitest run packages/cabinet/src/derive.test.ts`
- `npm run typecheck -w @wtc/web`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `node scripts/gates.mjs core`
- `npx playwright test tests/e2e/cabinet-pg9-mobile.spec.ts --project=mobile`
- `npm run e2e:admin-user-bots:db`
- `npm run e2e:admin-user-bots:db:managed`
- `npx playwright test -c playwright.admin-user-bots-db.config.ts`
- `npm run accept:worker:continuity`
- `npm run accept:real-pg:managed`
- `npm run db:migrate`
- `npm run db:seed`
- Full Playwright/e2e, production build, deploy, SSH/tmux/systemd, live bot start/stop/apply-config, exchange/provider calls, raw env reads, raw secret reads.

## Next actions
1. Apply the minimal cabinet setup repair in a separate non-auditor lane.
2. Run the minimum targeted post-fix set:
   - `npx vitest run tests/integration/cabinet-pg9.test.ts`
   - `npm run typecheck -w @wtc/web`
   - `npm run typecheck`
   - `npm run lint`
3. If `packages/cabinet` or cabinet derivation changed, also run `npx vitest run packages/cabinet/src/derive.test.ts`.
4. If rendered PG9 layout/navigation changed, run `npx playwright test tests/e2e/cabinet-pg9-mobile.spec.ts --project=mobile`; otherwise keep it NOT RUN.
5. After the targeted set is green, rerun `node scripts/gates.mjs core` if the phase wants to claim full core recovery. If it is skipped, write: "Full `node scripts/gates.mjs core` was NOT RUN in Phase 4.16; Phase 4.15 core remained red at `test` due `tests/integration/cabinet-pg9.test.ts`; this phase only closes the cabinet PG9 repair with the targeted gates listed above."
6. If core is rerun and passes, write: "`node scripts/gates.mjs core` PASSED in Phase 4.16: governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, and db:generate all green." If it fails, write the exact failing gate/log path and do not claim core green.
7. Keep the DB/live/bot/browser acceptance language explicit: "DB-backed browser E2E, worker continuity, real-PG acceptance, db:migrate/db:seed, full Playwright, live bot start/stop/apply-config, exchange/provider calls, raw env reads, and raw secret reads were NOT RUN by scope/no throwaway target."
