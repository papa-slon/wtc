# Legacy (DCA / averaging) Bot — Premium Pages Handoff

> Written at the end of the Tortila premium-pages session, for a FRESH session to
> build the SAME premium statistics + settings pages for the **second bot**
> ("legacy_bot", the DCA/averaging bot). The new session has none of the prior
> chat context — this doc is the brief. Read it fully, then orchestrate.

## Goal
Deliver, deployed and visible, for the **legacy_bot**:
1. A **premium statistics page** matching the quality of the just-shipped Tortila page.
2. A **premium, native settings page** (same bar as Tortila settings).
Both live on the WTC ecosystem canary, behind auth, at
`https://wtc.54.179.188.61.nip.io/app/bots/statistics?bot=<legacy-slug>` and the
legacy settings route.

The user explicitly wants **orchestrated agents that argue/disagree and converge**:
architect → build → 3 adversarial auditors (clutter / correctness / premium-design)
→ consolidated fix → deploy → verify. YOU are the orchestrator/reviewer between phases.
This exact pipeline produced the Tortila result the user loved — replicate it.

## The gold standard (match this)
- The deployed Tortila pages (this repo, branch context below): `apps/web/src/app/(app)/app/bots/statistics/page.tsx` + `apps/web/src/features/bots/tortila-overview/*` (sparkline, equity-panel, trade-history, position-card, symbol-bars, monthly-bars, distribution-chart, calendar-heatmap, activity-feed, costs, format) + the settings editor `apps/web/src/features/bots/.../TortilaCoinConfigEditor.tsx`.
- The original inspiration (a FastAPI dashboard the user called 1000x better than the old ecosystem page): `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\` (`templates/overview.html`, `static/dashboard.js`, `static/app.css`). Study its density, JetBrains-Mono numbers, dark premium terminal feel.
- Fonts are now loaded platform-wide via `next/font` (Inter + JetBrains Mono) in `apps/web/src/app/layout.tsx`; mono figure classes already exist. Reuse them.

## What the second bot IS (do NOT disturb it — REAL MONEY, multi-tenant)
- Location: server `/home/ubuntu/apps/bot/` (live PID was 3916524 — verify current), local mirror `C:\Users\maxib\GTE BOT\bot`.
- Stack: **FastAPI + uvicorn** on `:8000` (`root_path=/live`) + **PostgreSQL** db `tradingbot` (async SQLAlchemy / asyncpg, bound to 127.0.0.1).
- Strategy: in-house **RSI/CCI mean-reversion** signals → **DCA / averaging-down** to a fixed **+0.45% take-profit**, **NO stop-loss**, position count gated by a "Tetris" slot/stage system.
- **Multi-tenant** (2 users, 2 BingX API keys). **`DEMO=False` → REAL MONEY.** Healthy and trading.
- Data volume (~85 days): ~3,800 orders, ~791 closed cycles, a couple open positions fully averaged (depth 3/3).
- **HARD RULE: never restart it, never edit its code, never write to its DB, never touch its tmux/PID, never issue exchange writes, never reuse its API keys/session.** Read-only Postgres only.

## The data challenge (key difference from Tortila)
The `tradingbot` DB has **no realized-PnL / equity / drawdown / fees tables** (Tortila's journal had those). So stats must be **reconstructed** honestly:
- **Realized PnL / equity curve**: reconstruct from closed cycles — each closed cycle exits at +0.45% TP on the averaged entry. Sum per-cycle gains (notional × 0.45% − fees). Label "reconstructed" in the UI; never fabricate.
- **Directly available**: open positions, per-symbol breakdown, **averaging depth ("how stuck" — 1/2/3)**, RED/YELLOW CCI/RSI **signal mix**, hold-times, order/cycle activity over time.
- **Genuinely unavailable** (e.g. live unrealized PnL without a BingX mark pull) → hide or label, never fake.
The legacy stats page is therefore a DIFFERENT shape than Tortila (DCA bot, no stops/TP-ladder): show averaging-depth distribution + signal mix + reconstructed PnL/equity + per-symbol + activity; HIDE Tortila-only sections (stop/TP price ladder).

## The read-only data shim (partially built — finish + deploy)
- `C:\Users\maxib\GTE BOT\bot\journal_shim\` — a read-only FastAPI over the `tradingbot` Postgres (SELECT-only, `default_transaction_read_only=on`), reconstructs PnL from cycles, exposes journal-style endpoints (`/api/health`, `/api/summary`, `/api/positions`, `/api/symbol_breakdown`, `/api/signals`, `/api/activity`, `/api/equity`, `/api/depth_distribution`). Token-gated. **20 pytest pass, ruff clean, NOT deployed.** Has `DEPLOY_LEGACY_SHIM.md`.
- Plan: finish/verify the shim, then DEPLOY it as its own read-only service (e.g. systemd `legacy-journal.service` on a free port like 8090, read-only Postgres role) — the careful gated step. The ecosystem reads it exactly like it reads the Tortila journal on :8080.

## Ecosystem wiring (already partly there)
- `legacy_bot` is a real product code: `BotProductCode = 'tortila_bot' | 'legacy_bot'` (`packages/bot-adapters/src/types.ts`), in `BOT_LIST`/nav/entitlements. The statistics page (`statistics/page.tsx`) already has a `legacy_bot` branch — currently a basic/placeholder render. Upgrade it to the premium `BotOverview` variant.
- Reuse the Tortila premium components via a `variant`/`capabilities` prop (DCA shows depth/signal-mix, hides stop/TP ladder) — do NOT fork them. See `BOT2_INTEGRATION_PLAN.md` (this repo root) for the exact routing/adapter/shared-file map.
- Add a `legacy` adapter + reader mirroring `packages/bot-adapters/src/tortila/tortila-journal-reader.ts`, env vars `LEGACY_JOURNAL_URL` + `LEGACY_JOURNAL_TOKEN`, pointed at the deployed shim.

## Settings page for the DCA bot (CAUTION)
- The DCA bot's config is DIFFERENT from Tortila: it's RSI/CCI per-symbol + stage/slot ("Tetris") config + the +0.45% TP + caps, NOT Donchian/ATR. Settings UX must reflect THAT model (pick coins, set RSI/CCI params, stages/slots, caps), native + premium like Tortila's coin-config editor.
- **The DCA bot has a REAL, destructive write API** (full-replace on a live real-money account). For v1, mirror Tortila: settings save to a **WTC-versioned config**, NOT wired to the live destructive write path (`FEATURE_LIVE_BOT_CONTROL=false`). **No fake buttons, no live apply/start/stop.** If a real save-to-bot path is ever wanted, that's a separate, explicitly-approved, heavily-guarded step.

## Deploy mechanism (proven this session)
- Ecosystem canary: nginx :443 → :8301 → docker `wtc-ecosystem-canary` (+ `-worker`), each `docker run --network host --restart unless-stopped -v <release_dir>:/app --env-file <release_dir>/.env.canary.live node:22-bookworm` running `npm run start -w @wtc/web -- --hostname 127.0.0.1 --port 8301`.
- Releases: per-dir `git clone` under `/home/ubuntu/apps/wtc_ecosystem_platform_releases/<ts>-<sha>-<phase>-main`. Deploy = clone branch at SHA → copy `.env.canary.live` forward → build in a throwaway `--rm node:22-bookworm` container → **GATE: swap only if build exit 0 AND `apps/web/.next/BUILD_ID` exists** → stop/rm/recreate canary+worker on the new dir → health-check → rollback dir = the prior release (sub-minute container swap). Full runbook: `DEPLOY_RUNBOOK.md` (this repo root).
- `db:migrate`: only if migration files differ vs the live release; UI-only changes → no-op/skip. Never run unknown migrations on the multi-tenant DB.
- SSH: `ssh -i "C:\Users\maxib\GTE BOT\keys\key_server_bot_singapur.pem" -o StrictHostKeyChecking=no ubuntu@54.179.188.61 "CMD"`. Git/gh authed locally as `papa-slon` (server has anon HTTPS clone; no gh on server).

## Reference docs already on disk
- `OLD_BOT_AUDIT.md` (in `C:\Users\maxib\GTE BOT\bot_tortila\`) — full audit of the DCA bot: stack, schema, data model, feasibility.
- `BOT2_INTEGRATION_PLAN.md` (this repo root) — how to wire a 2nd bot into the ecosystem (routing, adapter, shared files to sequence).
- `DEPLOY_RUNBOOK.md` (this repo root) — canary deploy procedure.
- `STATS_SPEC.md` / `SETTINGS_SPEC.md` (this repo root) — the Tortila specs; use as templates, adapt to the DCA bot's data/config shape.
- Tortila PR: `https://github.com/papa-slon/wtc/pull/17` (branch `feat/tortila-premium-statistics`, deployed to canary).

## Suggested phase plan for the new session
1. **Architect**: read OLD_BOT_AUDIT + BOT2_INTEGRATION_PLAN + the deployed Tortila pages; produce LEGACY_STATS_SPEC + LEGACY_SETTINGS_SPEC + a finish-and-deploy plan for the shim. (agents may propose competing designs; you judge.)
2. **Shim**: finish `bot/journal_shim`, verify reconstruction accuracy against real Postgres (read-only), deploy it as a gated service, confirm endpoints return live reconstructed data.
3. **Build**: legacy adapter/reader + the premium statistics page (BotOverview legacy variant) + the premium settings page.
4. **Adversarial review** (3 auditors: clutter/simplicity, correctness/data+build, premium-design+settings-UX) — they should argue; converge.
5. **Fix** the consolidated findings.
6. **Deploy** to canary (gated, rollback-ready); **verify** the user's URL shows the premium legacy pages with real reconstructed data.

## Roadmap after this (user's stated sequence, for context only)
legacy_bot pages (this) → then the trading **terminal** integration when it's ready →
then a larger **ecosystem refactor** (adding education/LMS capabilities, etc.). Keep
each in its own session to avoid context bloat.
