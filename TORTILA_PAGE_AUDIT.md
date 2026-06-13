# Tortila page audit

Repo: `wtc_ecosystem_platform`. Route: `/app/bots/tortila`.

## What we found

The existing tortila overview lives in
`apps/web/src/app/(app)/app/bots/[bot]/page.tsx` — a generic per-bot route that
dispatches both `tortila` and `legacy`. The page is functionally honest (no
fabricated win-rate; the wins/trades/PF that come back are computed from real
canonical metrics), but the **design and data density are nowhere near** the
v2 journal at `bot_tortila/src/turtle_bot/journal/templates/overview.html`.

### Concrete problems

1. **`[bot]/page.tsx:247-266`** — KPIs are limited to 8 generic metric cards
   (wallet equity, closed pnl, unrealized pnl, ROI, win rate, profit factor,
   max DD, open risk). No Sharpe / Sortino / Calmar / Recovery / Time-in-market
   / Expectancy. None of `/api/metrics/advanced` is consumed.

2. **`[bot]/page.tsx:273-320`** — Open positions and recent trades are basic
   tables with 6 columns; no live mark, no price ladder, no stop/TP distance,
   no inline sparkline. Live `/api/marks` is never fetched (the comment chain
   "WTC must not call /api/marks" applies to the worker, not to the dashboard
   if user is showing his own bot — but more honestly: the existing adapter
   stores `markPrice = avg_entry` which makes uPnL meaningless; the v2 journal
   solves this by calling /api/marks server-side every 30s with a 30s cache).

3. **`[bot]/page.tsx:322-350`** — "Configuration & controls" section has two
   *disabled* "Start bot (disabled)" and "Stop bot (disabled)" buttons. They
   are not "broken" in the bug sense (`buttonClasses('ghost')` + `disabled`),
   but they are the "fake buttons" the user mentioned: a panel of greyed-out
   actions adds visual noise and confuses the user about what's possible.

4. **No equity curve, no drawdown chart, no monthly returns, no calendar
   heatmap, no symbol contribution, no P&L distribution histogram, no activity
   feed, no costs footer.** The page is a *summary* — the v2 journal is a
   *workspace*. That gap is the audit's headline finding.

5. **Wrong information architecture.** The dashboard surfaces *integration
   ladder* concerns (`BotReadinessMap`, `BotLaunchReadinessPanel`,
   `BotContinuityPanel`, `BotOperationMapPanel`, `BotRuntimeEvidencePanel`,
   `WarningSummaryPanel`) BEFORE any actual trading data. These are valuable
   ops/safety panels but they belong below-the-fold; a user opening
   `/app/bots/tortila` wants equity, P&L, open positions FIRST.

### What is OK and must stay

- The `BotContinuityPanel` / `BotRuntimeEvidencePanel` / `WarningSummaryPanel`
  trio is referenced by `tests/e2e/smoke.spec.ts:31-35` — those texts must
  remain on the page (the smoke harness asserts them). We will keep all three
  panels, just move them below the new performance dashboard.
- The mode pill (`StatusPill` for `read.adapterMode`) is correct and honest.
- `markUnavailable` warning is correct in the WTC worker-snapshot mode.
- `BOT_CAPS` capabilities table is honest.

## Live data reachability

`packages/bot-adapters/src/factory.ts:27-40` returns either:

- `createMockTortilaAdapter()` when `BOT_ADAPTER_MODE === 'mock'` (default).
- `createHttpTortilaAdapter(baseUrl, token)` when mode is `read-only` /
  `audited` and `TORTILA_JOURNAL_URL` is set.

Env vars (`apps/web/src/lib/server-config.ts:10-19`):

- `BOT_ADAPTER_MODE` — must be `read-only` to enable live read.
- `TORTILA_JOURNAL_URL` (or `TORTILA_JOURNAL_BASE_URL`) — journal base.
- `JOURNAL_READ_TOKEN` — bearer token.

Journal auth: `Authorization: Bearer <token>` OR `X-Journal-Read-Token: <token>`
header (`bot_tortila/src/turtle_bot/journal/app.py:100-116`). The existing
`http.ts:48` uses `Authorization: Bearer`. No change needed.

Endpoints already mapped: `/api/health`, `/api/summary`, `/api/trades/list`,
`/api/equity`. The advanced/rich endpoints are NOT mapped:

- `/api/metrics/advanced` — Sharpe/Sortino/Calmar/Recovery/etc.
- `/api/symbol_breakdown` — per-symbol P&L and contribution.
- `/api/calendar?weeks=N` — heatmap grid.
- `/api/monthly` — monthly returns.
- `/api/distribution` — histogram.
- `/api/drawdown` — underwater curve.
- `/api/marks` — live mark prices for open positions (30s cache).
- `/api/activity?limit=N` — mixed timeline.
- `/api/overview` — bundle of the above.

## Plan

1. Extend `packages/bot-adapters/src/tortila/` with **typed Zod schemas** and
   helper functions for the 9 unmapped endpoints. Keep the existing
   `BotAdapter` interface untouched; expose the new fetchers as a separate
   `TortilaJournalReader` that the dashboard imports directly.
2. Add a Next.js API route `/api/bots/tortila/overview` that proxies the
   journal bundle behind the session (so the JOURNAL_READ_TOKEN never reaches
   the client).
3. Replace the body of `[bot]/page.tsx` so when the slug is `tortila` it
   renders a new `TortilaOverview` server component (keeping the existing
   `BotReadinessMap`/Continuity/Evidence/Warning panels at the bottom, for
   E2E test compatibility).
4. Build the dashboard as 12 sections matching the v2 journal: hero strip,
   KPI grid, returns matrix, trade stats, extremes, equity+drawdown, risk
   panel, open positions w/ ladder, symbol contribution, monthly bars,
   calendar heatmap, distribution, trade history, activity, costs footer.
5. Auto-refresh every 30s via the API route.
6. Charts are **pure inline SVG** (server-rendered) — no new dependency.

## Hard rules retained

- Read-only. Adapter control methods stay disabled.
- No fake start/stop buttons in the new design — they are *removed*, not
  greyed out. Settings / setup links remain.
- Falls back gracefully to "section unavailable" when an endpoint is missing.
- All numbers go through formatters; never display NaN/Infinity.
- All E2E text assertions from `smoke.spec.ts` are preserved.
