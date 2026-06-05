# two-bot-finish-board-tests-auditor handoff
## Scope
Read-only Phase 4.45 tests/gates audit before implementing a `/app/bots` two-bot finish board. The target slice is no-env/local only: prove the overview page gives a user a clear finish path for Tortila and Legacy without adding live provider probes, exchange pings, bot start/stop/apply-config, managed DB, or broad gate churn.

## Files inspected
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `tests/e2e/bot-readiness-map.spec.ts`
- `scripts/gates.mjs`
- `package.json`
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `playwright.config.ts`
- `docs/handoffs/20260605-0215-bot-final-gap-tests-gates-auditor.md`
- `docs/handoffs/20260605-0215-phase-4-44-admin-worker-continuity-freshness.md`

## Files changed
- `docs/handoffs/20260605-0305-two-bot-finish-board-tests-auditor.md`

## Findings
1. Severity P2 - `/app/bots` is already the rendered overview target, so the finish-board proof should extend the existing smoke test instead of adding a new E2E file. Evidence: `tests/e2e/smoke.spec.ts:100` starts the bot overview/sub-tab journey, `tests/e2e/smoke.spec.ts:104` visits `/app/bots`, and `tests/e2e/smoke.spec.ts:109` already screenshots `bots-combined`. Recommendation: add the new finish-board assertions in this same block immediately after the existing combined portfolio assertions. Target part: `/app/bots` rendered finish board.
2. Severity P2 - Existing detailed bot settings/statistics/readiness E2E specs already cover the destination pages, so the finish board only needs stable overview links and copy, not repeated deep workflows. Evidence: `tests/e2e/bot-settings.spec.ts:80` covers Tortila and Legacy settings/setup, `tests/e2e/bot-statistics.spec.ts:44` and `tests/e2e/bot-statistics.spec.ts:63` cover dedicated Tortila/Legacy statistics, and `tests/e2e/bot-readiness-map.spec.ts:21` covers both bot dashboards/readiness maps. Recommendation: in smoke, assert exact `href`s from the finish board to those already-covered destinations. Target part: overview navigation coverage.
3. Severity P1 - The finish board must be statically protected from turning into a live-control or secret surface. Evidence: `tests/integration/bot-read-safety-static.test.ts:10` already reads `apps/web/src/app/(app)/app/bots/page.tsx`; `tests/integration/bot-read-safety-static.test.ts:271`-`273` apply no-adapter/no-secret/no-live-control static expectations to readiness/control helpers, but not specifically to the bot overview finish-board copy. Recommendation: add a focused static assertion block for `botsList` that requires the board copy/links and forbids `getBotAdapter`, `fetch(`, `vault.open`, `startBot`, `stopBot`, `applyConfig`, `retest`, `apiKey`, `apiSecret`, `sealed`, and `Connection verified`. Target part: `/app/bots` safety boundary.
4. Severity P3 - No gate-script/package change is needed for this slice. Evidence: `scripts/gates.mjs:145`-`153` already includes `tests/e2e/smoke.spec.ts`, `tests/e2e/bot-settings.spec.ts`, `tests/e2e/bot-readiness-map.spec.ts`, and `tests/e2e/bot-statistics.spec.ts` in the `bot-admin-e2e` gate; `scripts/gates.mjs:173` maps `bot-admin-e2e` to rendered plus visual inventory; `package.json:44` exposes it as `npm run accept:bots:rendered`. Recommendation: do not add a new script unless this becomes a repeated standalone acceptance pack. Target part: gate ergonomics.

## Decisions
- Extend `tests/integration/bot-read-safety-static.test.ts` with one focused `/app/bots` static board test.
- Extend `tests/e2e/smoke.spec.ts` inside the existing `bot dashboard sub-tabs render with unified analytics (Tortila)` test, directly after `page.goto('/app/bots')`.
- Do not change `tests/e2e/bot-settings.spec.ts`, `tests/e2e/bot-statistics.spec.ts`, or `tests/e2e/bot-readiness-map.spec.ts` for this slice unless the implementation changes their destination copy.
- Do not modify `scripts/gates.mjs` or `package.json`; the existing `accept:bots:rendered` wrapper is sufficient.
- Keep selectors copy-based and role-based. The board should expose exact stable visible labels so tests do not depend on CSS structure.

Recommended static assertions to add:
```ts
it('bot list exposes a two-bot finish board without live-control or secret wiring', () => {
  expect(botsList).toMatch(/Two-bot finish board/);
  expect(botsList).toMatch(/Tortila finish path/);
  expect(botsList).toMatch(/Legacy finish path/);
  expect(botsList).toMatch(/Default profile/);
  expect(botsList).toMatch(/Custom profile/);
  expect(botsList).toMatch(/Settings editor/);
  expect(botsList).toMatch(/Statistics cockpit/);
  expect(botsList).toMatch(/Readiness dashboard/);
  expect(botsList).toMatch(/Live controls disabled/);
  expect(botsList).toMatch(/\/app\/bots\/\$\{b\.slug\}\/setup/);
  expect(botsList).toMatch(/\/app\/bots\/\$\{b\.slug\}\/settings/);
  expect(botsList).toMatch(/\/app\/bots\/statistics\?bot=\$\{b\.slug\}/);
  expect(botsList).not.toMatch(/getBotAdapter|fetch\(|vault\.open|startBot|stopBot|applyConfig|retest|apiKey|apiSecret|sealed|Connection verified/);
});
```

Recommended rendered assertions to add after `await page.goto('/app/bots');` in `tests/e2e/smoke.spec.ts`:
```ts
await expect(page.getByRole('heading', { name: 'Two-bot finish board' })).toBeVisible();
await expect(page.getByText('Tortila finish path')).toBeVisible();
await expect(page.getByText('Legacy finish path')).toBeVisible();
await expect(page.getByText('Default profile')).toBeVisible();
await expect(page.getByText('Custom profile')).toBeVisible();
await expect(page.getByText('Exchange key readiness')).toBeVisible();
await expect(page.getByText('Provider pub_id readiness')).toBeVisible();
await expect(page.getByText('Live controls disabled')).toBeVisible();
await expect(page.getByRole('link', { name: 'Tortila setup' })).toHaveAttribute('href', '/app/bots/tortila/setup');
await expect(page.getByRole('link', { name: 'Tortila settings' })).toHaveAttribute('href', '/app/bots/tortila/settings');
await expect(page.getByRole('link', { name: 'Tortila statistics' })).toHaveAttribute('href', '/app/bots/statistics?bot=tortila');
await expect(page.getByRole('link', { name: 'Tortila readiness' })).toHaveAttribute('href', '/app/bots/tortila');
await expect(page.getByRole('link', { name: 'Legacy setup' })).toHaveAttribute('href', '/app/bots/legacy/setup');
await expect(page.getByRole('link', { name: 'Legacy settings' })).toHaveAttribute('href', '/app/bots/legacy/settings');
await expect(page.getByRole('link', { name: 'Legacy statistics' })).toHaveAttribute('href', '/app/bots/statistics?bot=legacy');
await expect(page.getByRole('link', { name: 'Legacy readiness' })).toHaveAttribute('href', '/app/bots/legacy');
await expect(page.getByText('Connection verified')).toHaveCount(0);
await expect(page.getByText(/startBot|stopBot|applyConfig/)).toHaveCount(0);
```

Optional but recommended if the smoke file accepts a tiny helper: add a local `noHScroll(page)` helper mirroring `tests/e2e/bot-readiness-map.spec.ts:7`-`12`, then assert `expect(await noHScroll(page), '/app/bots finish board scrolls horizontally').toBe(true);` after the board assertions. This is valuable because `accept:bots:rendered` runs both desktop and mobile projects through `playwright.config.ts:18`-`21`.

## Risks
- The exact board copy above is a test contract; implementation should either use it verbatim or update tests and handoff together before running gates.
- `smoke.spec.ts` currently has no horizontal-scroll helper. Adding one is small, but if implementation time is tight, the finish-board link/copy assertions plus existing desktop/mobile screenshot are the minimal acceptance path.
- The worktree was already heavily dirty before this audit; this handoff does not classify unrelated modified or untracked files.
- No managed DB or live runtime proof is implied by these tests. This slice proves a clear local UX finish path and safety boundary only.

## Verification/tests
RUN:
1. `git status --short --branch` - confirmed the current branch and pre-existing dirty tree.
2. Read-only `Get-Content` and `rg -n` inspections of the requested tests, gates, package scripts, Playwright config, current `/app/bots` page, and the latest relevant handoffs.

NOT RUN:
1. `npx vitest run ...` - not run because this is a read-only pre-implementation audit.
2. `npx playwright test ...` - not run because this audit should not start the dev server or write screenshots.
3. `npm run accept:bots:rendered` - not run because no implementation/assertions were changed in this audit.
4. `npm run accept:bots:local` and `npm run accept:bots:continuity:contract` - not run; broader than this audit and can write logs/worker evidence.
5. Managed DB, provider probes, exchange ping, live bot control, deploy, SSH/systemd/tmux, and CI - not run by scope.

Recommended gates after implementation:
1. `npx vitest run tests/integration/bot-read-safety-static.test.ts`
2. Focused rendered check, if a quick loop is needed:
   ```powershell
   $env:E2E_PORT = '3492'
   npx playwright test tests/e2e/smoke.spec.ts
   Remove-Item Env:E2E_PORT
   ```
3. Final rendered local acceptance:
   ```powershell
   npm run accept:bots:rendered
   ```
4. Standard safety/gov checks:
   ```powershell
   npm run typecheck -- --pretty false
   npm run secret:scan
   npm run governance:check
   git diff --check
   ```

## Next actions
1. Implement the `/app/bots` two-bot finish board using the exact visible labels and link names listed above.
2. Add the focused static and smoke assertions.
3. Run the recommended no-env gates in order.
4. Keep managed DB continuity, live provider probes, exchange ping, live bot start/stop/apply-config, deploy, and CI listed as NOT RUN unless a later audited phase supplies the required env and safety approval.
