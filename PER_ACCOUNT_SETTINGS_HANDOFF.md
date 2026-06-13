# Per-Account Bot Settings — Build Handoff (for a FRESH session)

> Written at the end of the legacy-premium / account-switcher session, for a NEW
> session with none of that chat context. Read this fully, then read the approved
> spec `PER_ACCOUNT_SETTINGS_SPEC.md` (repo root) — it has the full design, the
> exact migration, the 10-step build DAG, and the RBAC model. Then orchestrate the
> build the same way the prior features were built (architect → build → adversarial
> security audit → gated deploy; YOU are the orchestrator).

## Goal
Give EACH trading account its own bot settings. Today a user has exactly ONE saved
config per `(user, bot product)`; we want per-account config + version history. The
**design is already approved (Design A — instance-per-account)** and the migration is
purely additive. Ship legacy_bot first; tortila stays single-instance for now.

## The approved design (see PER_ACCOUNT_SETTINGS_SPEC.md for the full detail + cited file:lines)
- **Migration `0022` (ADDITIVE, backward-compatible, reversible):** add nullable
  `bot_instances.account_id text` + TWO partial unique indexes
  (`bi_user_product_account_idx` on `(user_id,product_code,account_id) WHERE account_id IS NOT NULL`
  and `bi_user_product_default_idx` on `(user_id,product_code) WHERE account_id IS NULL`).
  `account_id = NULL` is the legacy aggregate bucket = today's single config; every existing
  row stays valid; no backfill. **`bot_instances` has NO db uniqueness today** (the
  one-per-(user,product) rule is app-only in `ensureBotInstance`), so this is additive, not a
  constraint swap. Do the schema.ts edit FIRST, then `drizzle-kit generate`, then verify the SQL.
- **App:** `ensureBotInstance(db,{userId,productCode,accountId?})` branches on `isNull(account_id)`
  for the NULL bucket vs `eq(...,accountId)` (NEVER `eq(col,null)`); new read-only
  `getBotInstanceForUserProductAccount`. `loadBotConfig`/`persistBotConfig`/`selectSystemDefaultBotConfig`
  gain `accountId?`. `config-action-handler.ts resolveActionContext` is the AUTHORITATIVE write
  gate. `getCurrentBotConfig`/`saveBotConfig`/`listBotConfigVersions`/`listBotSafetyEvents` are UNCHANGED.
- **Settings page** (`apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`): add an admin-only
  account selector for `legacy_bot` (mirror the stats switcher at `statistics/page.tsx`), reuse
  `loadLegacyAccounts()`, masked pub_id chips, hidden `name="account"` field on the save + preset +
  use-default forms. The byte-compatible save contract (all `legacy_*`/`tortila_*` names) is unchanged
  — this is a KEYING change, not a field change.
- **RBAC (enforced TWICE, server-side, fail-closed):** non-admin → NULL bucket only; admin → any
  account. Page read gate: `effectiveAccount = isAdmin(user) ? account : undefined`. Write gate
  (authoritative, because the hidden field is attacker-controllable): in `resolveActionContext`,
  `accountId = (requested && isAdmin(user)) ? requested : undefined`. `ensureBotInstance` is always
  userId-scoped. Account identity = `api_keys.pub_id` (free-form text, not an FK).

## ⚠️ This layer is DIFFERENT from everything shipped before
All prior work this project (premium pages, timeframe fix, the account STATS switcher) was UI +
read-only — **no DB migration**. This one runs a **schema migration on the LIVE multi-tenant canary
Postgres**. Treat the deploy with extra care:
- **CANARY PRE-FLIGHT (must run before the unique index):**
  `SELECT user_id, product_code, count(*) FROM bot_instances WHERE account_id IS NULL GROUP BY 1,2 HAVING count(*) > 1;`
  If it returns rows, DEDUPE first (re-point children — bot_config_versions, bot_safety_events,
  bot_provider_accounts, bot_metric_snapshots, bot_position_snapshots, bot_trade_imports,
  bot_trade_reviews — to the keeper instance id, then delete losers) OR ship `bi_user_product_default_idx`
  as a PLAIN (non-unique) index first and tighten later. Index on NOT-NULL rows is always safe.
  Expected: zero duplicate groups (ensureBotInstance has always guarded it) — but CONFIRM on the canary.
- **Take the DB dump** (DEPLOY_RUNBOOK.md §2b — `pg_dump` of the canary DB) BEFORE `db:migrate`. The
  prior UI deploys skipped it; for a migration, do NOT skip it.
- The migration is reversible while no row has a non-NULL account_id (drop the 2 indexes + the column).

## One product decision the build needs (ask the operator)
**RBAC scope for non-admins:** ship CONSERVATIVE (non-admin edits only their NULL/aggregate bucket),
OR immediately allow a non-admin to edit their OWN mapped accounts (ownership source exists today: a
user's active `bot_provider_accounts.providerAccountId` rows → `listBotProviderAccountsForUser`,
repositories.ts). The judge recommends conservative-first + own-account editing as a fast follow.
Confirm before building the write gate.

## Current state of the world (already shipped + LIVE on canary)
- **Branch:** `feat/legacy-premium-statistics` (off the Tortila premium branch; NOT merged to main).
  Tip is the account-switcher commit. Continue on this branch (or a new branch off it).
- **Live canary release:** `…443b1e6-legacy-accts-main` at `https://wtc.54.179.188.61.nip.io`. Has:
  the premium legacy DCA stats + settings pages, the timeframe combobox fix, and the admin per-account
  STATS switcher. Rollback target = the `…56cb807…` release.
- **Read-only shim:** systemd `legacy-journal.service` on `127.0.0.1:8090` (RO Postgres role
  `legacy_shim_ro`, SELECT-only). Exposes per-account `?api_id=` + `/api/accounts` (safe columns).
  Already deployed + verified. Source: `C:/Users/maxib/GTE BOT/bot/journal_shim/`. **LEGACY_SHIM_API_ID
  must stay UNSET** in this deploy (else the aggregate view silently scopes).
- **Canary env** (`<release>/.env.canary.live`, server-side): has `BOT_ADAPTER_MODE=read-only`,
  `DATABASE_URL`, `LEGACY_JOURNAL_URL=http://127.0.0.1:8090`, `LEGACY_JOURNAL_TOKEN`, `JOURNAL_READ_TOKEN`,
  `TORTILA_JOURNAL_URL`, `FEATURE_LIVE_BOT_CONTROL=false`. Carried forward on each deploy.
- **Uncommitted in the working tree:** 4 `tests/e2e/*.spec.ts` files (bot-statistics/bot-settings/smoke/
  warning-summary-visual) were realigned to the premium UI by a parallel spawned session — they're
  test-only, not committed by the main line. Decide whether to commit them.

## Deploy mechanism (proven this project — see DEPLOY_RUNBOOK.md)
- Canary = nginx :443 → `:8301` → docker `wtc-ecosystem-canary` (+ `-worker`), `node:22-bookworm`,
  `--network host`, bind-mounted to a release dir.
- Releases are **per-dir `git clone`** under `/home/ubuntu/apps/wtc_ecosystem_platform_releases/<ts>-<sha>-<tag>`
  (NOT rsync from a REPO — `/home/ubuntu/apps/wtc_ecosystem_platform` is NOT a git repo). Deploy =
  `git clone --branch feat/legacy-premium-statistics … "$NEW_DIR"` → `git checkout <sha>` → copy
  `.env.canary.live` forward from the current release → build in a throwaway `--rm node:22-bookworm`
  container (`npm ci && npm run build -w @wtc/web && npm run db:migrate -w @wtc/db`) → **GATE: swap only
  if build exit 0 AND `apps/web/.next/BUILD_ID` exists** → stop/rm/recreate canary+worker on the new dir
  → health-check → rollback = prior release dir (sub-minute swap).
- **This time `db:migrate` is NOT a no-op** — it applies `0022`. Run the pre-flight + DB dump first.
- SSH: `ssh -i "C:\Users\maxib\GTE BOT\keys\key_server_bot_singapur.pem" -o StrictHostKeyChecking=no ubuntu@54.179.188.61 "CMD"`.
  `sudo -n -u postgres psql -d tradingbot` works passwordless (for the WTC canary DB use its `DATABASE_URL`,
  NOT the tradingbot DB — bot_instances lives in the WTC canary Postgres, not the bot's DB). git is anon
  HTTPS on the server (push the branch first so the server can clone the SHA).

## HARD RULES (unchanged)
- The live real-money DCA bot (tmux `bot`, PID ~3916524) is NEVER touched — no restart, no DB writes,
  no key reuse. Per-account config is a WTC-versioned DRAFT; `FEATURE_LIVE_BOT_CONTROL=false`; nothing is
  pushed to a live bot/exchange. The legacy CONTROL adapter stays hard-blocked.
- Gates via `node scripts/gates.mjs <quick|core|full>` (sequential, low-noise). Keep the byte-compatible
  save contract green (the `tortila-settings-save-contract-static` + `bot-config-action-handler` tests).
- Memory: see `wtc-multi-account-requirement.md` and `legacy-dca-premium-complete.md`.

## Suggested phase plan for the new session
1. Read PER_ACCOUNT_SETTINGS_SPEC.md + this handoff; confirm the RBAC product decision with the operator.
2. Build the 10-step DAG (schema → migration → repo → loader → action gate → settings selector → setup → tests).
3. Run `scripts/gates.mjs full` (typecheck/lint/secret-scan/test/build) + `db:generate` to verify 0022.
4. Adversarial SECURITY audit (RBAC write-gate bypass, cross-tenant config read/write, migration safety) — fix.
5. Gated deploy: canary pre-flight (dedupe check) → DB dump → clone+build (db:migrate applies 0022) → swap →
   verify the admin sees a settings account selector and per-account config saves/loads independently. Rollback-ready.
