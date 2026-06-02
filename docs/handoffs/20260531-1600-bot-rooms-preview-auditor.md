# Bot Rooms Preview Auditor

## Scope
Read-only audit of the current bot product rooms after the broad platform package, focused on whether the two-bot cabinet is usable and what still blocks production truth.

## Files inspected
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/config.ts`

## Files changed
- None by this auditor; read-only findings were implemented by the operator in the Phase 3.6 pass where applicable.

## Findings
The bot rooms are present and broad: list, details, positions, trades, equity, safety, backtester, settings, and setup exist for the product cabinet. Remaining truth gaps are Legacy real data blocked by B3, no user-facing durable DB snapshot read model for all bot runtime state, Tortila real config read not yet wired from the live service, and Tortila backtester remains local-download only rather than a server-run backtester.

## Decisions
Keep the WTC app read-only and mock-safe by default. Do not enable live bot control, non-mock adapters, or exchange-facing actions during this phase.

## Risks
If the site claims live bot operations before B3 and live-control safety gates clear, users will read demo or unavailable state as exchange truth. The current UI must keep explicit simulated/not-live labels where adapters are mock or blocked.

## Verification/tests
Recommended strict e2e coverage over bot rooms with no flaky retries and no enabled live-control buttons. The final Phase 3.6 e2e run covered the bot room routes under the strict auth helper.

## Next actions
After production blockers clear, add a durable bot snapshot read model and only then consider real read-only status for both bots. Live control remains a separate audited phase.
