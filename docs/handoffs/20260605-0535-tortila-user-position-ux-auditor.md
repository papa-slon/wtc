# ecosystem-ux-ui-designer handoff
## Scope
Read-only Phase 4.53 UX/product audit of user-facing Tortila position, equity, dashboard, and statistics surfaces after Phase 4.52 marks exclusion. Focus: whether mark price and unrealized PnL placeholders can be mistaken for live market data. No live servers, env, secrets, exchange, `/api/marks`, bot controls, or API routes were touched.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260605-0520-phase-4-52-tortila-marks-exclusion.md`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/tortila-runtime-format.ts`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx`
- `tests/e2e/bot-statistics.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/two-bot-continuity-contract-static.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity P0 - No user-facing real Tortila Mark/uPnL placeholder values were found on the dedicated positions page. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:14` derives `markUnavailable` for `meta.code === 'tortila_bot' && read.adapterMode === 'real'`; `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:57` renders Mark as `N/A`; `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:58` renders uPnL as `N/A`. Recommendation: no immediate UI patch required for this page; optional copy could explain that `N/A` means `/api/marks` is intentionally excluded. Target part: user Tortila positions table.
2. Severity P0 - No user-facing real Tortila Mark/uPnL placeholder values were found on the bot dashboard summary. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:131` derives the same `markUnavailable` real-Tortila flag; `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:251` renders the Unrealized PnL metric as `N/A`; `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:281` renders position Mark as `N/A`; `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:282` renders position uPnL as `N/A`. Recommendation: no immediate UI patch required; keep this guard if the read model changes. Target part: user Tortila dashboard metrics and open-position preview.
3. Severity P0 - The user statistics page gates the same real Tortila Mark/uPnL and reinforces the no-live-market boundary in product copy. Evidence: `apps/web/src/app/(app)/app/bots/statistics/page.tsx:295` derives `markUnavailable` for real Tortila; `apps/web/src/app/(app)/app/bots/statistics/page.tsx:202` renders Mark as `N/A`; `apps/web/src/app/(app)/app/bots/statistics/page.tsx:203-204` renders uPnL as `N/A`; `apps/web/src/app/(app)/app/bots/statistics/page.tsx:491` renders Unrealized PnL as `N/A`; `apps/web/src/features/bots/statistics-panels.tsx:93-100` says mark price is gated in the real adapter and the page does not call `/api/marks` or a live exchange. Recommendation: no-op is acceptable now. Target part: user Tortila statistics cockpit and journal-confidence panels.
4. Severity P1 - The shared DB read loader still normalizes missing position mark/uPnL fields into internal values before UI gating: mark falls back to entry price and unrealized PnL falls back to zero. Evidence: `apps/web/src/features/bots/data.tsx:575-588` maps `markPrice = num(p.markPrice) ?? entryPrice` and `unrealizedPnl: num(p.unrealizedPnlUsd) ?? 0`; Phase 4.52 worker real mode omits placeholders at `apps/worker/src/jobs.ts:216-228`. Current user UI hides these values through `markUnavailable`, so this is not a visible placeholder bug today. Recommendation: if a future API/CSV/export or component consumes `CanonicalPosition` outside the guarded UI, carry an explicit mark/uPnL availability flag or avoid substituting entry/zero for real Tortila. Target part: `loadBotReadModelForUser` DTO semantics.
5. Severity P2 - User-facing rendered tests prove Tortila statistics no-`/api/marks` copy, but they do not pin real-mode user dashboard/positions Mark and uPnL as `N/A`; the strongest pinned `N/A` browser assertion is selected-user admin. Evidence: `tests/e2e/bot-statistics.spec.ts:55-58` checks the Tortila journal-confidence/no-`/api/marks` copy; `tests/e2e/smoke.spec.ts:126-130` checks the positions page only for a mock row; `tests/e2e/admin-user-bot-detail-db.spec.ts:303-306` pins selected-user admin Tortila Mark/uPnL as `N/A`; `tests/integration/two-bot-continuity-contract-static.test.ts:159-162` statically pins worker real-mode omission and admin formatting. Recommendation: add a focused user-page static or fixture-rendered assertion in a later test slice if this area is touched; this is not required to prevent current user confusion. Target part: user bot positions/dashboard/statistics regression coverage.

## Decisions
1. User-facing UI patch needed now: No. No-op is acceptable for Phase 4.53 because real Tortila user surfaces render Mark, uPnL, and Unrealized PnL as `N/A` instead of placeholder market values.
2. Treat the loader fallback as a DTO semantics risk, not a current rendered UX defect, because the named user pages gate real Tortila display with `markUnavailable`.
3. Keep `/api/marks` excluded; do not replace it with live exchange or provider probes.
4. Do not run live servers, browser sessions, env checks, exchanges, bot controls, `/api/marks`, or API mutation paths in this read-only audit.

## Risks
1. If another component later consumes `CanonicalPosition.markPrice` or `CanonicalPosition.unrealizedPnl` without `markUnavailable`, the loader fallback could reintroduce live-looking entry-price/zero values for real Tortila.
2. Current user-facing rendered tests do not explicitly prove real-mode user dashboard/positions `N/A`; they mostly prove mock rendering and selected-user admin `N/A`.
3. Equity and wallet-equity surfaces remain based on persisted WTC metric/equity rows. This audit did not prove real Tortila journal/auth/firewall continuity or source freshness.
4. Visual/browser proof was not run in this audit, by scope. Conclusions are static source/test inspection only.

## Verification/tests
RUN:
1. Read required governance/context docs: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260605-0520-phase-4-52-tortila-marks-exclusion.md`.
2. Static source inspection of the requested user-facing Tortila dashboard, positions, equity, statistics, shared data, Tortila runtime formatter, statistics panels, and relevant tests.
3. `git status --short --branch` observed a dirty branch with many pre-existing modified/untracked files before this handoff; no code edits were made.

NOT RUN:
1. Browser/Playwright rendered proof - not run; read-only auditor scope requested inspection and one handoff.
2. `npm run typecheck`, Vitest, lint, secret scan, governance - not run; no code was changed.
3. Managed DB matrix - not run; outside this audit and previously env-blocked.
4. Real Tortila journal reads, `/api/marks`, exchange pings, provider probes, live bot start/stop/apply-config, API mutation routes - not run by safety scope.

## Next actions
1. Optional later hardening: add a focused user-facing static or rendered regression that proves real Tortila dashboard, positions page, and statistics page render Mark/uPnL/Unrealized PnL as `N/A`.
2. Optional DTO cleanup: add explicit mark/uPnL availability metadata to the read model, or avoid entry/zero fallback for real Tortila rows, before exposing positions through any new export/API/component.
3. Continue the separate Tortila real-read blockers only with proper env/auth/firewall proof: journal continuity, source-config provenance, safety-signal ingestion, and identity scope. Do not call `/api/marks`.
