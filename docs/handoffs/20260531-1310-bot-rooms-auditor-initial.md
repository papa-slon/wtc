## Scope
Read-only bot-room audit for the broad Phase 3.3 pass. This handoff is operator-persisted from the first bot-room subagent output before implementation.

## Files inspected
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/features/bots/config.ts`
- `tests/integration/bot-read-safety-static.test.ts`

## Files changed
None by this read-only auditor.

## Findings
- Bot settings existed but were too generic for Tortila vs Legacy.
- Manual/auto mode was not explicit enough as WTC-side intent.
- Demo config needed browser-session persistence so setup/settings could be visually tested without a real Postgres.
- Legacy bot must stay blocked for live setup because B3 is still open.

## Decisions
- Keep live bot control disabled.
- Add product-specific reference profiles and demo-only persisted config versions.
- Keep all bot config changes WTC-side only; no live server, bot, exchange, or worker interaction.

## Risks
- Future real adapter mode must not leak adapter health to users without entitlement.
- Legacy adapter remains blocked until upstream plaintext-key exposure is fixed.

## Verification/tests
- Final verification is recorded in the aggregate handoff for this epoch.

## Next actions
- Re-run bot-room gates after implementation.
- Keep B3 as a hard blocker for Legacy live integration.
