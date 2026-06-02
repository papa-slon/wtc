## Scope
Read-only bot entitlement/data-minimisation audit after bot-room changes.

## Files inspected
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/features/bots/config.ts`
- `tests/integration/bot-read-safety-static.test.ts`

## Files changed
None by this read-only auditor.

## Findings
- `/app/bots` called `loadBotReadModel` for every bot before entitlement gating.
- In real adapter mode, that could trigger read attempts and expose adapter health/process metadata to unentitled users.
- Product-specific bot config/presets were otherwise coherent for Tortila and Legacy.

## Decisions
- Gate `loadBotReadModel` on `access.allowed`.
- Render locked adapter status as hidden until entitlement is active.
- Add a static regression test for the entitlement-first adapter read policy.

## Risks
- Future bot summary views must follow the same pattern: access decision first, adapter read second.

## Verification/tests
- Targeted bot safety static test passed after fixes; final full gates are recorded in the aggregate handoff.

## Next actions
- Keep live controls disabled until a separately audited adapter is approved.
