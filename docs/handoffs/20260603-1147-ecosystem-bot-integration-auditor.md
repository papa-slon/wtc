# ecosystem-bot-integration-auditor handoff
## Scope
Read-only WTC integration audit for adding the legacy averaging bot surface to the existing WTC bot product model.

## Files inspected
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `docs/CONTRACTS/legacy-bot-adapter.md`

## Files changed
None - read-only audit.

## Findings
1. Severity: High. Current WTC supports two fixed bot products, `tortila_bot` and `legacy_bot`, not arbitrary bot instances. Recommendation: implement the current legacy bot as the existing `legacy` product unless a separate product-model phase adds multi-instance routing. Target part: product model.
2. Severity: High. The non-mock legacy adapter is deliberately blocked and the factory ignores live legacy base URL settings. Recommendation: do not create a new data path that bypasses `createLegacyBlockedAdapter()`. Target part: adapter safety.
3. Severity: Medium. `apps/web/src/features/bots/config.ts` currently represents legacy config as a flat profile, which misses the real per-symbol RSI/CCI/stage/ladder model. Recommendation: expand the saved WTC-side config schema before connecting any live data. Target part: settings.
4. Severity: Medium. `bot_instances` currently picks the first `(user, productCode)` match and has no adapter kind, route slug, source adapter, health target, or upstream runtime reference. Recommendation: defer true multi-instance support to a later product/data-model phase. Target part: database/product model.
5. Severity: Medium. Tortila production canary data is DB-snapshot based; legacy has no equivalent safe WTC import path yet. Recommendation: legacy stats should be operational/reference-only until a key-free upstream endpoint exists. Target part: analytics.

## Decisions
- Do the first implementation slice as WTC-side UI/data enrichment only.
- Keep legacy real adapter blocked.
- Keep entitlement as the only access source of truth.

## Risks
- Adding multi-instance support inside this phase would touch product routes, entitlements, billing, DB, and adapter contracts, increasing blast radius.
- Showing legacy win rate, profit factor, drawdown, or Sharpe without imported closed trades/equity would be misleading.

## Verification/tests
RUN: local code/contract review.

NOT RUN: live legacy API calls, DB migrations, route-model changes, or live adapter enabling.

## Next actions
1. Expand the legacy settings form for the current `legacy` product.
2. Add legacy operational statistics panels that do not fabricate performance analytics.
3. Add safe upstream legacy read endpoint design after this UI slice.
