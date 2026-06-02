## Scope
Read-only audit of bot product setup/settings surfaces for Tortila and the legacy bot.

## Files inspected
- apps/web/src/features/bots/config.ts
- apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx
- tests/integration/bot-read-safety-static.test.ts

## Files changed
None by this auditor.

## Findings
- Bot settings were too generic for two different bots.
- Default automatic operation would be too risky for the current production-blocker state.
- Legacy setup must stay blocked while the plaintext-key upstream blocker remains.
- Tortila real read-only mode must not render missing mark/uPnL as 0.

## Decisions
- Make bot config product-specific.
- Default both bots to manual mode.
- Keep legacy live setup blocked.
- Render unavailable mark/uPnL as N/A.

## Risks
- These are WTC-side configuration surfaces only; they do not prove live adapter correctness.
- Real bot control remains disabled.

## Verification/tests
- Auditor was read-only. Operator must update static regression tests and run typecheck.

## Next actions
- Implement product-specific schemas/forms and N/A mark rendering.
