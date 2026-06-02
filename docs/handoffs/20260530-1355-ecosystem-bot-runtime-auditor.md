# Handoff: ecosystem-bot-runtime-auditor
Epoch: 20260530-1355
Agent: ecosystem-bot-runtime-auditor
Role: Workstreams B/C — bot-adapter/runtime + worker auditor

---

## Scope

Read-only audit of the bot-adapter package, worker, DB repositories, and bot UI surfaces as they
stand at Phase 2.4 entry. Covers four mandated audit questions:

1. How BOT_ADAPTER_MODE selects the Tortila read-only adapter safely (default stays mock; read-only
   only when explicitly set; fallback guards; control stays disabled; legacy stays blocked).
2. Worker wiring required for a read-only 'tortila-journal' snapshot/health collector that writes
   integration_health_checks + bot_metric_snapshots — exact repo calls, cadence, failure handling.
3. Exactly what /admin/bots must show (Tortila adapter status, legacy blocked, last successful
   snapshot, last error, disabled live-control, demo-vs-Postgres mode).
4. Graceful AdapterNotReadyError handling so bot pages never crash.

---

## Files inspected

- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/warnings.ts`
- `packages/bot-adapters/src/mock-tortila.ts`
- `packages/bot-adapters/src/mock-legacy.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/index.ts`
- `packages/bot-adapters/src/adapters.test.ts`
- `packages/db/src/repositories.ts` (lines 516–641, bot + health-check repos)
- `packages/db/src/schema.ts` (lines 243–303, integration_health_checks + botMetricSnapshots)
- `packages/analytics/src/metrics.ts`
- `packages/analytics/src/index.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/tick-once.ts`
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/lib/server-config.ts`
- `docs/handoffs/20260530-1145-ecosystem-bot-integration-auditor.md`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py` (local source, read-only)

---

## Files changed

None — read-only audit

---

## Findings

### Finding 1 — MEDIUM: Worker has no bot-snapshot job; integration_health_checks is written only for
'worker' target, never for 'tortila-journal'

**Severity:** MEDIUM
**Evidence:** `apps/worker/src/index.ts:19-21` — the `dbTick()` function calls only
`reconcileAllEntitlements`, `sweepTvExpiry`, and `recordHealthCheck(db, 'worker', 'ok', {...})`.
No call to `insertBotMetricSnapshot` or any Tortila adapter call exists anywhere in
`apps/worker/src/`. `apps/worker/src/jobs.ts` contains only `reconcileEntitlements` and
`sweepTradingViewAccess`. There is no `snapshotBotHealth`, `snapshotBotMetrics`, or equivalent job.
`packages/db/src/repositories.ts:516-518` — `recordHealthCheck` is present and takes `(db, target, status, detail)`.
`packages/db/src/repositories.ts:580-591` — `insertBotMetricSnapshot` and `listBotMetricSnapshots`
are present with a complete `BotMetricSnapshotInput` interface.
The schema at `packages/db/src/schema.ts:281-303` defines `bot_metric_snapshots` with all required
columns: `botInstanceId`, `snapshotAt`, `walletEquityUsd`, `closedPnlUsd`, `unrealizedPnlUsd`,
`winRate`, `profitFactor`, `maxDrawdownPct`, `currentDrawdownPct`, `totalFeesUsd`,
`totalFundingUsd`, `openRiskUsd`, `tradeCount`, `sourceAdapter`, `rawJson`.

**Recommendation:** Phase 2.4 must add a `snapshotTortilaJournal` job to the worker. Implementation
plan:

```typescript
// apps/worker/src/jobs.ts — additive function
export async function snapshotTortilaJournal(
  db: Db,
  adapter: BotAdapter,
  botInstanceId: string,
  now: Date,
): Promise<{ ok: boolean; lastError: string | null }> {
  try {
    const health = await adapter.getHealth();
    // getMetrics throws AdapterNotReadyError when mode=read-only (all data methods stub);
    // only getHealth is confirmed mapped. Catch and record as last_error without throwing.
    let metrics: CanonicalMetrics | null = null;
    try {
      metrics = await adapter.getMetrics(botInstanceId);
    } catch (err) {
      // AdapterNotReadyError is expected until schema files land; not a crash condition.
    }
    await insertBotMetricSnapshot(db, {
      botInstanceId,
      snapshotAt: now,
      sourceAdapter: 'tortila',
      walletEquityUsd: metrics ? String(metrics.walletEquity) : undefined,
      closedPnlUsd: metrics ? String(metrics.closedPnl) : undefined,
      unrealizedPnlUsd: metrics ? String(metrics.unrealizedPnl) : undefined,
      winRate: metrics?.winRatePct != null ? String(metrics.winRatePct) : undefined,
      profitFactor: metrics?.profitFactor != null ? String(metrics.profitFactor) : undefined,
      maxDrawdownPct: metrics?.maxDrawdownPct != null ? String(metrics.maxDrawdownPct) : undefined,
      currentDrawdownPct: metrics?.currentDrawdownPct != null ? String(metrics.currentDrawdownPct) : undefined,
      totalFeesUsd: metrics ? String(metrics.feesTotal) : undefined,
      totalFundingUsd: metrics ? String(metrics.fundingTotal) : undefined,
      openRiskUsd: metrics ? String(metrics.openRisk) : undefined,
      tradeCount: metrics?.tradeCount,
      rawJson: { adapterMode: adapter.mode, healthStatus: health.status, processAlive: health.processAlive },
    });
    await recordHealthCheck(db, 'tortila-journal', health.processAlive ? 'ok' : 'down', {
      status: health.status,
      warnings: health.warnings.map((w) => w.code),
    });
    return { ok: true, lastError: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordHealthCheck(db, 'tortila-journal', 'error', { error: msg });
    return { ok: false, lastError: msg };
  }
}
```

The worker's `dbTick()` in `apps/worker/src/index.ts` must call this function. Cadence: once per
tick (currently 60 s at `index.ts:8`). The `botInstanceId` must be resolved from
`ensureBotInstance(db, { userId: SYSTEM_BOT_OWNER_ID, productCode: 'tortila_bot' })` — a
system-owned instance separate from user instances; this requires a SYSTEM_BOT_INSTANCE_ID env var
or a convention documented in ARCHITECTURE.md. Failure (adapter down, DB error) must be caught,
written to integration_health_checks with `status: 'error'`, and must NOT crash the tick — the
other jobs (entitlement reconcile, TV sweep) must still run.

**Target Workstream:** B (worker/runtime)

---

### Finding 2 — HIGH: No BOT_ADAPTER_MODE guard in the worker; the worker creates no adapter at all

**Severity:** HIGH
**Evidence:** `apps/worker/src/index.ts:14-22` — `dbTick` imports from `@wtc/db` only; no import
from `@wtc/bot-adapters`. The worker has never called `getBotAdapter` or any adapter method.
`apps/web/src/lib/server-config.ts:6-16` — `botAdapterMode()` and `botAdapterOptions()` are
`server-only` (apps/web), not shared with the worker.

The worker must read `BOT_ADAPTER_MODE`, `TORTILA_JOURNAL_BASE_URL` from its own env and apply
the same mode-selection logic as the web app: default to `mock`, only use real when explicitly
`read-only` AND a base URL is set. The factory at `packages/bot-adapters/src/factory.ts:23-28`
already implements this double-guard (mode + base URL both required for real). The worker should
call `getBotAdapter('tortila_bot', { mode, tortilaBaseUrl })` using that same factory.

In mock mode the snapshot job still writes to DB (mock health = `degraded`, mock metrics are
synthetic). This is honest — the snapshot's `sourceAdapter` column at schema:298 is `text('source_adapter').notNull()`
and must be `'tortila-mock'` when mock, `'tortila'` when real. The admin page can then distinguish
the two.

**Recommendation:** The worker's `dbTick` must import `getBotAdapter` from `@wtc/bot-adapters` and
resolve the adapter using env vars it reads directly (not from `apps/web/src/lib/server-config.ts`,
which is `server-only` tagged). Extract the mode-resolution logic into a shared helper or duplicate
the three-line `botAdapterMode()` function inside the worker. The control methods stay unconditionally
throwing regardless of env.

**Target Workstream:** B (worker/runtime)

---

### Finding 3 — HIGH: /admin/bots is a Placeholder — it has no real content

**Severity:** HIGH
**Evidence:** `apps/web/src/app/admin/bots/page.tsx:1-5` — the entire page is:

```tsx
import { Placeholder } from '@/components/Placeholder';
export default function Page() {
  return <Placeholder kicker="Admin · bots" title="Bot fleet"
    note="Cross-user bot health & adapter diagnostics. Live control stays disabled until the audited adapter ships." />;
}
```

There is no DB query, no adapter call, no health data, no snapshot history, and no mode disclosure.
The Phase 2.4 prompt specifies that `/admin/bots` must show: Tortila adapter status, legacy blocked
status, last successful snapshot timestamp, last error, disabled live-control notice, and
demo-vs-Postgres mode indicator.

**Recommendation:** Replace the Placeholder with a real server component. Exact content specification:

1. **Adapter status row for Tortila:** `BOT_ADAPTER_MODE` value from env (sourced via
   `botAdapterMode()`), base URL configured (bool — do not expose the URL itself), adapter mode
   badge (`mock` / `read-only` / `audited`).
2. **Legacy adapter blocked row:** Always show `legacy_plaintext_keys: BLOCKED — plaintext keys
   unresolved; service-account gate NOT STARTED`. No toggle, no override UI.
3. **Last successful snapshot:** Read from `integration_health_checks` WHERE `target = 'tortila-journal'`
   AND `status = 'ok'` ORDER BY `checkedAt DESC` LIMIT 1. Show the `checkedAt` timestamp as
   `fmtDate(row.checkedAt)` or "never" if no row exists.
4. **Last error:** Read from `integration_health_checks` WHERE `target = 'tortila-journal'` AND
   `status != 'ok'` ORDER BY `checkedAt DESC` LIMIT 1. Show the `detail.error` message or "none"
   if no error row exists. Do NOT expose stack traces.
5. **Last metric snapshot:** Read from `bot_metric_snapshots` ORDER BY `snapshotAt DESC` LIMIT 1.
   Show `snapshotAt`, `walletEquityUsd`, `sourceAdapter` (to distinguish mock vs real data).
6. **Disabled live-control notice:** Inline text: "startBot / stopBot / applyConfig are
   HARD-disabled. FEATURE_LIVE_BOT_CONTROL is not set. See docs/BOT_CONTROL_SAFETY_MODEL.md."
   The notice must be non-collapsible and non-dismissible.
7. **Mode indicator:** If DATABASE_URL is absent, show "Demo mode — snapshots are not persisted
   (no DATABASE_URL)." If set, show "Postgres mode."

The admin page must require admin RBAC (`requireRole(user, 'admin')`) and must not expose any
exchange keys, password hashes, or full raw JSON blobs from the `rawJson` column.

**Owned by:** `apps/web/src/app/admin/bots/page.tsx`
**Target Workstream:** C (admin ops)

---

### Finding 4 — HIGH: Bot overview and sub-pages call adapter data methods without try/catch; they
will crash with an unhandled rejection if BOT_ADAPTER_MODE switches to read-only and the real
adapter throws AdapterNotReadyError

**Severity:** HIGH
**Evidence:**

- `apps/web/src/app/(app)/app/bots/page.tsx:21` — `await Promise.all([adapter.getHealth(), adapter.getMetrics(b.code)])` — no try/catch.
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:36-42` — `await Promise.all([...adapter.getMetrics..., adapter.getPositions..., adapter.getTrades..., adapter.getConfig...])` — no try/catch.
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx:16-19` — `await Promise.all([...adapter.getTrades..., adapter.getMetrics...])` — no try/catch.
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:14` — `await Promise.all([adapter.getHealth(), adapter.getPositions(...)])` — no try/catch.
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx:17,19` — `await adapter.getEquityCurve(...)`, `await Promise.all([adapter.getHealth(), adapter.getMetrics(...)])` — no try/catch.

The real HTTP adapter at `packages/bot-adapters/src/http.ts:77-89` throws `AdapterNotReadyError`
from `getMetrics`, `getPositions`, `getTrades`, `getConfig`. If `BOT_ADAPTER_MODE=read-only` with a
base URL is set, all those call sites will throw, propagating to a Next.js unhandled error
(500 page) rather than showing a graceful degraded state.

The adapter's `getHealth()` does NOT throw (it catches internally at http.ts:59-63 and returns a
`processAlive: false` health object). So health checks are safe. Data methods are not.

**Recommendation:** Phase 2.4 must add graceful fallback wrappers. The pattern is:

```typescript
// In features/bots/data.tsx or a new features/bots/adapter-safe.ts
import { AdapterNotReadyError } from '@wtc/bot-adapters';
import type { BotAdapter, BotHealth } from '@wtc/bot-adapters';
import type { CanonicalMetrics, CanonicalPosition, CanonicalTrade } from '@wtc/analytics';
import { computeMetrics } from '@wtc/analytics';

const EMPTY_METRICS: CanonicalMetrics = computeMetrics({
  trades: [], positions: [], equityCurve: [], walletEquity: 0,
});

export async function safeGetMetrics(adapter: BotAdapter, instanceId: string): Promise<{ data: CanonicalMetrics; notReady: boolean }> {
  try {
    return { data: await adapter.getMetrics(instanceId), notReady: false };
  } catch (err) {
    if (err instanceof AdapterNotReadyError) return { data: EMPTY_METRICS, notReady: true };
    throw err; // re-throw non-adapter errors (network, DB)
  }
}

export async function safeGetPositions(adapter: BotAdapter, instanceId: string): Promise<{ data: CanonicalPosition[]; notReady: boolean }> {
  try {
    return { data: await adapter.getPositions(instanceId), notReady: false };
  } catch (err) {
    if (err instanceof AdapterNotReadyError) return { data: [], notReady: true };
    throw err;
  }
}

export async function safeGetTrades(adapter: BotAdapter, instanceId: string): Promise<{ data: CanonicalTrade[]; notReady: boolean }> {
  try {
    return { data: await adapter.getTrades(instanceId), notReady: false };
  } catch (err) {
    if (err instanceof AdapterNotReadyError) return { data: [], notReady: true };
    throw err;
  }
}
```

When `notReady: true`, the page renders a `RiskWarningBanner` with severity `'warning'`,
title `'Live data not yet available'`, detail `'The adapter mapping for this endpoint is not yet
confirmed. Mock data is shown. See docs/CONTRACTS/tortila-adapter.md.'`. Empty arrays (positions, trades)
and empty metrics are safe to render because all existing UI has `EmptyState` components for zero-item
cases (positions/page.tsx:34-36, trades/page.tsx:49-55, equity/page.tsx:47-49).

The `getConfig` call at `[bot]/page.tsx:40` also throws `AdapterNotReadyError` — the same wrapper
pattern applies; on `notReady`, fall back to rendering `config.raw = {}` with an appropriate notice.

**Owned by:** `apps/web/src/features/bots/data.tsx` (extend) or new
`apps/web/src/features/bots/adapter-safe.ts`
**Target Workstream:** B/C (runtime + product surfaces)

---

### Finding 5 — MEDIUM: Safety page is missing the mock-data warning banner that all other sub-pages have

**Severity:** MEDIUM
**Evidence:** `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx` — no `adapter.mode === 'mock'`
check and no `RiskWarningBanner` for simulated data. By contrast:
- `positions/page.tsx:25-30` — has the mock banner.
- `trades/page.tsx:32-38` — has the mock banner.
- `equity/page.tsx:31-37` — has the mock banner.
- `[bot]/page.tsx:66-71` — has the mock banner.
The safety page renders `health.warnings` and process status sourced from the adapter, but the
user has no indication those values are mock when `BOT_ADAPTER_MODE=mock`.

**Recommendation:** Add the same pattern to `safety/page.tsx` after the `BotSubNav`:

```tsx
{adapter.mode === 'mock' && (
  <RiskWarningBanner
    severity="warning"
    title="Simulated data — not a live account"
    detail="BOT_ADAPTER_MODE=mock: warning events and health status below are illustrative sample data."
  />
)}
```

**Owned by:** `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
**Target Workstream:** C (product surfaces)

---

### Finding 6 — MEDIUM: BotMetricSnapshotInput expects `snapshotAt: Date` but the worker's tick
function works in epoch-ms; a type mismatch exists at the future call site

**Severity:** MEDIUM
**Evidence:** `packages/db/src/repositories.ts:580-584` — `BotMetricSnapshotInput.snapshotAt` is
typed as `Date`. `apps/worker/src/index.ts:17` — `const now = Date.now()` gives epoch-ms (number).
The worker's `dbTick` currently passes `now` only to `recordHealthCheck` (which does not accept a
timestamp — it uses the DB default `createdAt`). When the snapshot job is added, the implementer
must pass `new Date(now)` not `now` to `insertBotMetricSnapshot`. This is a trivial type error that
will be caught by TypeScript but is worth flagging explicitly.

**Recommendation:** In the snapshot job implementation, always use `snapshotAt: new Date(now)` where
`now = Date.now()`. Document this in the function signature with a JSDoc comment.

**Target Workstream:** B (worker/runtime)

---

### Finding 7 — LOW: integration_health_checks has no index on (target, checkedAt DESC); the admin
page query for last successful snapshot will do a full table scan

**Severity:** LOW
**Evidence:** `packages/db/src/schema.ts:243-249` — the `integrationHealthChecks` table has no
secondary index; only the `id` PK exists. The admin page query pattern will be:
`SELECT * FROM integration_health_checks WHERE target = 'tortila-journal' AND status = 'ok'
ORDER BY checked_at DESC LIMIT 1`. Without an index on `(target, checked_at)` this is a full
table scan. At current cadence (60 s tick) the table grows by ~2 rows/minute. At one year that is
~1 M rows — still fast for a full scan on Postgres, but undesirable.

**Recommendation:** Migration 0003 (or a separate migration) should add:
`CREATE INDEX ihc_target_checked_at_idx ON integration_health_checks(target, checked_at DESC);`
This is additive and safe. The Drizzle schema equivalent is:
```typescript
(t) => ({ targetCheckedAtIdx: index('ihc_target_checked_at_idx').on(t.target, t.checkedAt) }),
```
Flag for the db-architect in the migration 0003 design.

**Target Workstream:** B (runtime/schema)

---

### Finding 8 — LOW: The worker's `tick-once.ts` uses only in-memory path; it cannot be used to
verify DB snapshot jobs in a smoke test

**Severity:** LOW
**Evidence:** `apps/worker/src/tick-once.ts:1-24` — imports only from `@wtc/tradingview-access`
and `@wtc/audit`; uses `reconcileEntitlements` with a hardcoded in-memory entitlement array. No DB
path. Once the bot-snapshot job is added, `tick-once.ts` should have a `--db` mode that exercises
the full `dbTick` path against PGlite so the snapshot repos can be smoke-tested without a real
Tortila instance.

**Recommendation:** This is a Phase 2.4 test-infrastructure item. Not a runtime blocker.
**Target Workstream:** B (worker test coverage)

---

### Finding 9 — LOW: Confirmed — legacy adapter stays BLOCKED; all five gates remain NOT STARTED

**Severity:** LOW (status confirmation, not a new defect)
**Evidence:** `packages/bot-adapters/src/http.ts:94-96` — `createHttpLegacyAdapter` comment:
"WARNING: legacy API returns plaintext keys — never proxy them."
`packages/bot-adapters/src/http.ts:111-113` — `getConfig()` throws `AdapterNotReadyError('legacy', 'getConfig')`
with comment "must strip plaintext keys before mapping."
`packages/bot-adapters/src/warnings.ts:59-67` — `LEGACY_WARNINGS` contains `legacy_plaintext_keys`
at severity `'error'`. This warning is included in every mock legacy health response.
`docs/handoffs/20260530-1145-ecosystem-bot-integration-auditor.md:195-209` — F-07 documents that
all five gates (service account, vault, firewall, key redaction, security acceptance) remain NOT
STARTED.

No Phase 2.4 work should loosen these gates. The `legacy_plaintext_keys` error warning must remain
on every legacy adapter response in every mode until the service-account + vault gates pass a
separate security audit.

**Target Workstream:** B/C (safety boundary confirmation)

---

### Finding 10 — LOW: Mock-data warning banner missing from safety page is the only adapter-mode
disclosure gap; all other sub-pages are consistent

**Severity:** LOW (duplicate of Finding 5, summarized here for completeness)
**Evidence:** Cross-checked all six bot sub-pages. Mock-data banner exists on: `page.tsx:66`,
`positions/page.tsx:25`, `trades/page.tsx:32`, `equity/page.tsx:31`. Missing on: `safety/page.tsx`
(no adapter.mode check present).

---

## Decisions

### D-01: BOT_ADAPTER_MODE selection is safe — confirmed double-guard is sufficient

The factory at `packages/bot-adapters/src/factory.ts:24-28` already implements the required
double-guard:
- `useReal = opts.mode === 'read-only' || opts.mode === 'audited'`
- `return useReal && opts.tortilaBaseUrl ? createHttpTortilaAdapter(opts.tortilaBaseUrl) : createMockTortilaAdapter()`

Neither the `mode` alone nor the `tortilaBaseUrl` alone is sufficient to activate the real adapter.
Both must be set. The web app's `server-config.ts:6-8` fails to `'mock'` for any unknown string.
The test at `adapters.test.ts:14-15` confirms `mode: 'read-only'` without a base URL returns
`mode: 'mock'`. This guard is correct and sufficient. No change needed.

### D-02: Control methods are unconditionally throwing — confirmed at all three layers

`control.ts:16-18` — `assertBotControlAllowed` throws `BotControlDisabledError` when either
`flagEnabled` or `auditApproved` is false. All three adapters (mock-tortila.ts:106-117,
mock-legacy.ts:73-84, http.ts:33-47) call this with `(action, false, false)`. The test at
`adapters.test.ts:26-31` confirms. The UI renders start/stop as `disabled` HTML buttons
(`[bot]/page.tsx:126-127`). No admin route calls any control method. This is correct.

### D-03: The 'tortila-journal' snapshot worker job is the primary implementation target for Phase 2.4

Based on Findings 1 and 2, the worker has no bot-snapshot job at all. The DB repos
(`insertBotMetricSnapshot`, `recordHealthCheck`) are complete and tested. The adapter factory is
correct. The only missing piece is the worker job wiring. This is the highest-priority
implementation item for Workstream B.

The job must:
- Be called from `dbTick()` in `apps/worker/src/index.ts` (every 60 s tick).
- Create or reuse a system-owned bot instance via `ensureBotInstance`.
- Call `adapter.getHealth()` (always safe — does not throw).
- Call `adapter.getMetrics()` inside a try/catch that catches `AdapterNotReadyError`; on catch,
  write a partial snapshot with only health data, no metrics.
- Write `insertBotMetricSnapshot(db, {...})` with `sourceAdapter: 'tortila-mock'` (mock mode) or
  `'tortila'` (read-only/audited mode).
- Write `recordHealthCheck(db, 'tortila-journal', status, detail)`.
- On any error (network, DB), write `recordHealthCheck(db, 'tortila-journal', 'error', {error: msg})`
  and return without crashing the tick.

### D-04: /admin/bots must be a real server component in Phase 2.4, not a Placeholder

The Placeholder provides no operational value. The admin page is the only place an operator can
verify at a glance that: (a) the adapter mode is what was intended, (b) the Tortila journal is
reachable, (c) the last snapshot was recent, (d) the legacy bot is explicitly blocked (not just
absent), (e) live control is not enabled. These are all read-only DB queries + env reads — no
security concern. The page must be admin-RBAC-gated.

### D-05: AdapterNotReadyError must be caught at every UI call site before Phase 2.4 enables
read-only mode in any environment

Until these try/catch wrappers are in place (Finding 4), setting `BOT_ADAPTER_MODE=read-only` with
a base URL will cause 500 errors on all bot overview and sub-pages that call data methods. The
wrapper functions described in Finding 4 must land before any read-only deployment.

---

## Risks

### R-01 (HIGH) — No worker snapshot job means integration_health_checks for 'tortila-journal' is
never written; admin observability is entirely absent until Finding 1 is addressed

The admin has no machine-written record of whether the Tortila journal is reachable, what the last
snapshot was, or what error last occurred. This is the single highest-risk gap for production
observability of the bot integration.

### R-02 (HIGH) — All bot data-method call sites will 500-crash on read-only mode switch; no
graceful degradation exists today

Finding 4 documents that `getMetrics`, `getPositions`, `getTrades`, `getConfig` throw
`AdapterNotReadyError` from the real HTTP adapter, and none of the six call sites have try/catch.
This must be fixed before any non-mock deployment.

### R-03 (MEDIUM) — /admin/bots Placeholder gives operators no visibility into adapter state or
snapshot health; operational blindness until Finding 3 is addressed

An admin cannot tell from the UI whether the worker has run, whether the Tortila journal is
reachable, or whether the legacy adapter is blocked vs merely unset. This is a pure observability
gap — no security risk, but significant operational risk.

### R-04 (LOW) — integration_health_checks table has no (target, checkedAt) index; admin page
queries will degrade as the table grows

Finding 7. Low risk at current data volumes but should be in migration 0003.

### R-05 (LOW) — The safety sub-page is the only bot page missing the mock-data warning banner;
minor UX inconsistency that could mislead a user into treating mock warning data as real safety
events

Finding 5. Low severity but easy to fix.

---

## Verification/tests

**Existing tests that confirm safety gates (pass today):**
- `packages/bot-adapters/src/adapters.test.ts` — 5 test cases:
  - Mock mode returns `mode: 'mock'` (factory.ts double-guard confirmed).
  - `read-only` without base URL stays mock (accidental connection prevented).
  - Real adapter data methods throw `AdapterNotReadyError` for all non-health methods.
  - Real adapter control methods throw `BotControlDisabledError`.
  - Mock control methods throw `BotControlDisabledError`.
  - P0/P1 warnings present in both mock and real health responses.
  - All warning codes are canonical members of `CANONICAL_WARNING_CODES`.

**Tests that must be added for Phase 2.4 (implementation prerequisites):**

1. Worker snapshot job unit test (`apps/worker/src/jobs.test.ts`):
   - `snapshotTortilaJournal` with a mock adapter that returns known health + metrics: verifies
     `insertBotMetricSnapshot` is called with correct field mapping (sourceAdapter, walletEquityUsd).
   - `snapshotTortilaJournal` with a real HTTP adapter stub that throws `AdapterNotReadyError` from
     `getMetrics`: verifies snapshot is still written (health-only, no metrics), no crash.
   - `snapshotTortilaJournal` when the adapter's `getHealth()` throws: verifies
     `recordHealthCheck('tortila-journal', 'error', ...)` is called, no crash.

2. Bot page error-boundary test (Vitest or Playwright):
   - Confirm `safeGetMetrics` returns `{ data: EMPTY_METRICS, notReady: true }` when adapter
     throws `AdapterNotReadyError`.
   - Confirm `safeGetMetrics` re-throws non-`AdapterNotReadyError` errors (network errors).

3. Admin bots page test (Playwright e2e):
   - `/admin/bots` renders the adapter mode badge (mock/read-only/audited).
   - Legacy blocked notice is visible.
   - Live-control disabled notice is visible.

4. Safety page mock-banner test (Playwright):
   - `/app/bots/tortila/safety` shows mock-data warning banner when `BOT_ADAPTER_MODE=mock`.

**Gates not yet passing (blockers for read-only activation):**
- Schema files `packages/bot-adapters/src/tortila/tortila.schemas.ts` do not exist (F-05 from
  prior audit 20260530-1145-ecosystem-bot-integration-auditor.md persists).
- Fixture files `packages/bot-adapters/src/__fixtures__/tortila.ts` do not exist.
- `AdapterNotReadyError` catch wrappers in UI call sites do not exist.
- Worker snapshot job does not exist.

---

## Next actions

**Implementation-ready items for Phase 2.4 (in priority order):**

1. **[B — HIGH]** Add `snapshotTortilaJournal` job to `apps/worker/src/jobs.ts` with the exact
   signature and logic described in Finding 1. Wire it into `dbTick()` in
   `apps/worker/src/index.ts`. The function must read `BOT_ADAPTER_MODE` and `TORTILA_JOURNAL_BASE_URL`
   from env directly (not from `apps/web/src/lib/server-config.ts`) and call `getBotAdapter`
   from `@wtc/bot-adapters`.

2. **[B — HIGH]** Add `AdapterNotReadyError` catch wrappers to bot page call sites.
   Create `apps/web/src/features/bots/adapter-safe.ts` with `safeGetMetrics`,
   `safeGetPositions`, `safeGetTrades`. Update `[bot]/page.tsx`, `positions/page.tsx`,
   `trades/page.tsx`, `equity/page.tsx` to use these wrappers, rendering a `RiskWarningBanner`
   (severity `'warning'`) on `notReady: true`.

3. **[C — HIGH]** Replace Placeholder at `apps/web/src/app/admin/bots/page.tsx` with the
   real server component described in Finding 3. Requires: `requireRole(user, 'admin')`,
   query `integration_health_checks` for `target = 'tortila-journal'` (last ok + last error),
   query `bot_metric_snapshots` for latest row, env-read for adapter mode, fixed notices for
   disabled control and blocked legacy.

4. **[C — MEDIUM]** Add mock-data warning banner to `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
   (Finding 5, one-line addition after BotSubNav).

5. **[B — LOW]** Migration 0003 additive index on `integration_health_checks(target, checkedAt DESC)`
   (Finding 7, for db-architect).

6. **[B — LOW]** Update `apps/worker/src/tick-once.ts` to support a `--db` flag that exercises
   the DB path with PGlite for smoke testing the snapshot job (Finding 8).

**Blocked (do NOT do in Phase 2.4 without separate gates):**
- Do not implement Tortila `getMetrics`/`getTrades`/`getPositions`/`getConfig` real mappings until
  schema files exist and endpoint shapes are confirmed against the live journal.
- Do not set `BOT_ADAPTER_MODE=read-only` in any environment until Finding 4 wrappers are in place.
- Do not unblock the legacy real adapter under any circumstances until all five security gates pass
  a separate audit (service account, vault, firewall, key redaction, written security acceptance).
- Do not add any route, button, or server action that calls `startBot`/`stopBot`/`applyConfig`.
