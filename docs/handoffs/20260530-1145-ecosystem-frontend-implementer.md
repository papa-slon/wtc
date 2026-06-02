## Scope

Phase 2.3 visible-progress wave — ecosystem-frontend-implementer.

- T1: /app/billing — product-access timeline via `loadUserTimeline`, subscriptions via `listSubscriptionsForUser`, per-product access state via `accessFor`/`reasonLabel`/`reasonTone`, honest storage mode label, dev-only mock checkout kept clearly labelled.
- T2: /pricing — real plan/product catalogue from `@wtc/entitlements`, honest CTAs ("Create account" / "View in billing"), per-product access state for logged-in users, feature comparison table, no implied instant Stripe checkout.
- T3: /app/terminal — new `features/terminal/loader.ts` (DB-backed `getCurrentTerminalRelease` → `TerminalReleaseView`; mock fallback when db is null); ES256/JWKS readiness display; `LicenseStatus` extended with `grace | revoked | unknown` in `packages/axioma-bridge/src/bridge.ts`; hard boundary callout; Download and Open-Journal DISABLED with "(dev placeholder)" text; storage mode honest label; account-link state honest ("not_linked").
- T4: /app/bots — additive read-only polish: capability summary table (trade history / equity curve / backtester / TP / SL state) on bot overview page, Legacy "limited data / not available" pill on bots listing page, persistent risk note on bots listing page and bot overview page.

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/DESIGN_SYSTEM.md`
- `apps/web/src/app/(app)/app/billing/page.tsx` (original)
- `apps/web/src/app/(public)/pricing/page.tsx` (original)
- `apps/web/src/app/(app)/app/terminal/page.tsx` (original)
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` (original)
- `apps/web/src/app/(app)/app/bots/page.tsx` (original)
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx`
- `apps/web/src/features/billing/timeline.ts`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/lib/access.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/server-config.ts`
- `apps/web/src/lib/format.ts`
- `packages/axioma-bridge/src/bridge.ts` (original)
- `packages/axioma-bridge/src/index.ts`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/jwks.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/entitlements/src/index.ts`
- `packages/entitlements/src/registry.ts`
- `packages/db/src/repositories.ts` (getCurrentTerminalRelease, listSubscriptionsForUser, listProductAccessEvents signatures)
- `packages/db/src/schema.ts` (terminalReleaseCache columns)
- `packages/db/src/index.ts`
- `packages/ui/src/index.ts`
- `packages/ui/src/components.tsx`

## Files changed

- `packages/axioma-bridge/src/bridge.ts` — extended `LicenseStatus` with `'grace' | 'revoked' | 'unknown'`; added tone-mapping JSDoc comment. Backward-compatible (existing consumers that only handled the prior 4 values get `bad` tone for the new states via the fallthrough mapping in terminal/page.tsx).
- `apps/web/src/features/terminal/loader.ts` — NEW file. Server-only terminal feature loader: `loadTerminalRelease(channel, platform)` calls `getCurrentTerminalRelease(db, channel, platform)` when db is non-null; falls back to `MOCK_RELEASE` when db is null (dev/demo). Also checks `AXIOMA_HANDOFF_SIGNING_KEY` presence for JWKS readiness (never exposes the value). Returns `TerminalLoaderResult` with `{ mode, release, jwksConfigured }`.
- `apps/web/src/app/(app)/app/terminal/page.tsx` — Rewritten to consume `loadTerminalRelease`; derives `LicenseStatus` from entitlement decision (not mock bridge); shows installer name/sha256 from DB row; adds static hard-boundary callout ("WTC never gates your local Axioma order execution") at top; shows ES256/JWKS readiness (presence only); Download and Open-Journal are DISABLED with "(dev placeholder)" text when isDev; storage mode pill; account-link state "not_linked" with honest "not yet implemented" note.
- `apps/web/src/app/(app)/app/billing/page.tsx` — Rewritten to consume `loadUserTimeline` (timeline table), `listSubscriptionsForUser` (subscriptions table), `accessFor`/`reasonLabel`/`reasonTone` (per-product access state table). Storage mode honest label. Dev mock checkout kept with "Mock checkout — hard disabled in production" banner. Handles empty states honestly.
- `apps/web/src/app/(public)/pricing/page.tsx` — Rewritten with honest CTAs ("Create account" / "View in billing"), feature comparison table, per-product access state for logged-in users (reads session cookie, calls `accessFor`), "How access works" info banner, no implied Stripe checkout. Plan catalogue from `@wtc/entitlements`.
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` — Added `BOT_CAPS`/`capLabel` import; capability summary table (trade history, equity curve, backtester, TP, SL); persistent risk note; backtester link conditional on `caps.hasBacktester`; fixed Unicode smart-quote byte corruption in JSX attribute strings (replaced `\xe2\x80\x9c/\x9d` with straight ASCII quotes).
- `apps/web/src/app/(app)/app/bots/page.tsx` — Added `BOT_CAPS` import; Legacy capability note ("limited data") on bot card when `!hasTradeHistory`; persistent risk note at page bottom.

## Findings

1. The original `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` contained Unicode smart-quote bytes (`\xe2\x80\x9c`, `\xe2\x80\x9d`) in JSX attribute string positions. TypeScript parser rejects these as "Invalid character". Fixed by binary replace to straight ASCII double-quote `"`.
2. `TerminalReleaseRow` from `@wtc/db` has `checksumSha256` and `releaseNotesMarkdown` columns but no `sizeBytes` or `installerName` column. The loader derives `installerName` from `version + platform` and sets `sizeBytes: null` honestly.
3. The `listSubscriptionsForUser` repo returns `SubscriptionRow[]` where `currentPeriodEnd` is a `Date | null` (not epoch-ms), so `s.currentPeriodEnd.getTime()` is used to format it.
4. `AXIOMA_HANDOFF_SIGNING_KEY` presence check is safe: reads `process.env.AXIOMA_HANDOFF_SIGNING_KEY` as a boolean (truthy/falsy) and never logs or exposes the value.
5. The `/api/axioma/download` proxy does not exist — noted in button `title` attributes.

## Decisions

- LicenseStatus extension (`grace | revoked | unknown`) is backward-compatible: existing consumers (`createMockAxiomaBridge`) still only return the prior values; new values are only emitted by the terminal page's own entitlement-to-LicenseStatus mapping.
- `loadTerminalRelease` tries `stable` then falls back to `beta` when no stable row exists — consistent with the "show the most useful available release" principle without fabricating data.
- Pricing page reads the session cookie server-side via `userForToken` (same pattern as other server components) — returns null gracefully when not authenticated.
- `maybeCurrentUser()` in pricing swallows errors (try/catch) so an expired or missing session never breaks the public pricing page.
- The bot overview page's Backtester link is now conditional on `caps.hasBacktester` — Legacy Bot no longer shows the link (matching the backtester page's own "Legacy not available" gate).

## Risks

- If `getCurrentTerminalRelease` returns a row with a very long `releaseNotesMarkdown` field, the note parser (split on `\n`, filter lines starting with `-`) may render partial content. Acceptable for MVP; a proper markdown renderer is a future enhancement.
- The pricing page's `maybeCurrentUser` reads the raw cookie — if the session schema changes (cookie name `wtc_session`), this will silently return null (safe failure; page still renders correctly without access state).
- `listSubscriptionsForUser` is called with `db` from `getServerDb()` which may be null in demo mode. The null-guard (`db ? await listSubscriptionsForUser(db, user.id) : []`) correctly handles this.

## Verification/tests

```
npm run typecheck -w @wtc/web   # exit 0 — clean
npm run build -w @wtc/web       # exit 0 — 31 routes, all ƒ dynamic
```

All 31 routes compiled. No new type errors. No suppressed errors.

## Next actions

- Admin terminal surface: seed `terminal_release_cache` rows via `/admin` interface so the terminal page shows real DB data.
- Account-link flow (`beginAccountLink` + device code exchange) — marked "not yet implemented" in the terminal page.
- ES256 JWKS: generate a P-256 key, set `AXIOMA_HANDOFF_SIGNING_KEY`, and verify the `/.well-known/axioma-jwks.json` response.
- Pricing page: add real price points when billing provider is wired.
- `jti` replay store (durable, cross-process) — documented TARGET in `axioma-bridge`.
