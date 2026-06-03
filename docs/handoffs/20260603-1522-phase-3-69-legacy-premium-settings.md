# phase-3.69 Legacy premium settings handoff
## Scope
Production slice for the Legacy averaging bot UX/data surface after the operator review of the settings page.

Implemented:
- Legacy settings rewritten from a technical table into native per-coin cards.
- One visible trigger per coin: RSI or CCI.
- Provider `pub_id` context carried through worker snapshots and settings UI.
- Legacy dashboard/statistics switched from fake-looking performance zeros to operational snapshots: provider accounts, active slots, active orders, stage capacity, and symbol/signal coverage.
- Admin bot page gained a safe Legacy `pub_id` inspector, active slots, and active order coverage.
- Internal warning copy was removed from the primary Legacy settings/dashboard/statistics surfaces.

No live bot start/stop/apply-config was performed. Bot services were not modified.

Read-only agent handoffs collected:
- `docs/handoffs/20260603-1459-ecosystem-ux-ui-designer.md`
- `docs/handoffs/20260603-1504-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260603-1504-ecosystem-db-architect.md`

All three agents were closed after results were collected.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1459-ecosystem-ux-ui-designer.md`
- `docs/handoffs/20260603-1504-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260603-1504-ecosystem-db-architect.md`
- `apps/worker/src/legacy-live.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `tests/integration/legacy-live-worker-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`

## Files changed
- `apps/worker/src/legacy-live.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `tests/integration/legacy-live-worker-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `docs/handoffs/20260603-1459-ecosystem-ux-ui-designer.md`
- `docs/handoffs/20260603-1504-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260603-1504-ecosystem-db-architect.md`
- `docs/handoffs/20260603-1522-phase-3-69-legacy-premium-settings.md`

## Findings
1. Severity: High. Legacy settings were previously hard to operate because signal choice, coin choice, indicator thresholds, stage capacity, and averaging ladder lived in one dense table. Recommendation implemented: per-coin cards, native coin select, RSI/CCI segmented trigger, signal-specific inputs, and collapsed advanced sizing/averaging fields.
2. Severity: High. Legacy DB live-read was working but the UI still used internal warning language and implied blocked reads. Recommendation implemented: primary user surfaces now show DB live-read operational state and hide adapter-internal warnings from normal Legacy pages.
3. Severity: High. Admin could not inspect the safe provider `pub_id` state. Recommendation implemented: admin page now reads the latest Legacy worker snapshot and renders provider accounts, active slots, and active order coverage.
4. Severity: Medium. Current Legacy performance metrics can look like real zero PnL despite unavailable closed-trade/equity sources. Recommendation implemented: Legacy dashboard/statistics emphasize wallet balance snapshots, slots, orders, configured symbols, and stage capacity instead of generic PnL/win-rate cards.
5. Severity: Medium. The worker snapshot needed to carry safe `pub_id` context into config, positions, stage configs, slots, and order summary. Recommendation implemented with no secret columns added.

## Decisions
- Keep Legacy runtime control read-only in this phase: no start, stop, retest, credential rotation, or live apply from WTC.
- Use product policy of exactly one visible trigger per coin in WTC settings: RSI or CCI. The source Legacy runtime can support both flags, but WTC prevents accidental double-signal configuration on the operator-facing surface.
- Use existing snapshot `rawJson.liveConfig` for this production slice rather than introducing a migration mid-flow. The DB agent's normalized provider-account/snapshot-table model remains the next deeper production step.
- Keep `pub_id` visible to admins and masked/shortened in normal user settings where appropriate.

## Risks
- User-scoped provider-account ownership is still not normalized in DB. Current production slice improves visibility but does not replace the DB agent's proposed `bot_provider_accounts` model.
- Legacy closed-trade analytics and real equity curves are still unavailable. The UI now avoids fabricating those metrics, but the next phase needs a real source before Bloomberg-style closed-trade analytics can be completed.
- Current settings saves still create WTC reference versions; they do not apply to the running Legacy bot.

## Verification/tests
RUN:
- `npx vitest run tests/integration/legacy-live-worker-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-statistics-static.test.ts` -> 30 tests passed.
- `npm run typecheck` -> passed.
- `npm run build` -> passed.
- `npm run lint` -> passed.
- `npm run secret:scan` -> passed.

NOT RUN:
- Browser/Playwright visual verification after deployment: pending deploy.
- Live server deploy: pending after this handoff.
- Live bot start/stop/apply-config: not run by policy.
- DB migrations: not part of this slice.
- Column-restricted Legacy DB role proof: not run in this slice.

## Next actions
1. Deploy this slice to the WTC server without touching live bot services.
2. Run the worker snapshot and verify Legacy `pub_id` rows, active slots, and active order coverage render on production.
3. Browser-check `/app/bots/legacy/settings`, `/app/bots/legacy`, `/app/bots/statistics?bot=legacy`, and `/admin/bots`.
4. Start the next phase for normalized provider-account ownership and Legacy closed-trade/statistics source.
