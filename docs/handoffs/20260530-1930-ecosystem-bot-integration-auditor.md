# ecosystem-bot-integration-auditor handoff

## Scope

Phase 2.7 read-only audit of the Tortila adapter read-only health state design (PG2).
Focused on: the 4 health states (not_configured / unreachable / malformed / stale), a
getWarnings() surface design, and JOURNAL_READ_TOKEN placement. Read-only; no edits made.

---

## Files inspected

- packages/bot-adapters/src/types.ts
- packages/bot-adapters/src/http.ts
- packages/bot-adapters/src/mock-tortila.ts
- packages/bot-adapters/src/mock-legacy.ts
- packages/bot-adapters/src/warnings.ts
- packages/bot-adapters/src/factory.ts
- packages/bot-adapters/src/index.ts
- packages/bot-adapters/src/control.ts
- packages/bot-adapters/src/tortila/tortila.mapping.ts
- packages/bot-adapters/src/tortila/tortila.schemas.ts
- packages/bot-adapters/src/adapters.test.ts
- packages/bot-adapters/src/__tests__/tortila-mapping.test.ts
- packages/bot-adapters/src/__fixtures__/tortila/health.valid.json
- apps/worker/src/jobs.ts
- apps/worker/src/index.ts
- apps/web/src/app/(app)/app/bots/[bot]/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx
- apps/web/src/features/bots/meta.ts
- apps/web/src/features/bots/data.tsx
- apps/web/src/lib/server-config.ts
- packages/db/src/schema.ts (lines 257-263, 295-370)
- packages/db/src/repositories.ts (lines 517-519)
- docs/CANONICAL_ANALYTICS_MODEL.md
- docs/BOT_INTEGRATION_PLAN.md
- docs/BOT_CONTROL_SAFETY_MODEL.md
- docs/CONTRACTS/tortila-adapter.md
- .env.example (lines 25-55)
- docs/ACCEPTANCE_MATRIX_MASTER.md (PG2/PG5)

---

## Files changed

None — read-only audit.

---

## Findings

### Finding 1 — HIGH — PG2
**All errors collapse to a single degraded status; not_configured / unreachable / malformed / stale are indistinguishable**

Evidence: `packages/bot-adapters/src/http.ts:115-139`

`getHealth()` catches both a network error and a Zod schema failure and falls through to the same
`{ processAlive: false, status: 'degraded', ... }` object. `healthToCanonical`
(`tortila.mapping.ts:40-51`) also always returns `status: 'degraded'` regardless of the actual
process liveness or the source of the failure.

The result: the worker writes `status='ok'|'down'|'error'` to `integration_health_checks`
(`jobs.ts:128`) but has no way to distinguish:
- the adapter was never configured (no `TORTILA_JOURNAL_URL`)
- the journal is unreachable (network timeout or non-2xx)
- the journal returned 200 but the body failed Zod validation
- the journal returned a valid 200 but the `ts` field indicates stale data

The `integration_health_checks` table's `detail` jsonb column gets `{ error: 'not_configured: ...' }`
only on the specific `dbTick` early-exit path (`apps/worker/src/index.ts:54`) — but that uses
`status='error'` (which looks like an alarm) rather than a neutral status.

**Recommendation — add `readState` to `BotHealth` (do NOT widen `HealthStatus`):**

Add one optional field to `BotHealth` in `types.ts`:

```typescript
export type ReadState = 'ok' | 'not_configured' | 'unreachable' | 'malformed' | 'stale';

export interface BotHealth {
  // ... existing fields unchanged ...
  /** Precise read-path state for display and worker mapping. Never thrown — always returned. */
  readState?: ReadState;
  /** Human-readable detail for the readState (e.g. 'no TORTILA_JOURNAL_URL', 'Zod: missing ts field'). */
  readStateDetail?: string;
}
```

Rationale for extending BotHealth rather than a new `getHealthState()` method or widening
`HealthStatus`:
- `HealthStatus` is the user-facing coarse state (`healthy | degraded | stale | down`). Widening it
  with `not_configured | unreachable | malformed` would break every consumer that switches on the
  four existing values. It also conflates operational state (is the process alive?) with
  read-path state (can WTC read it?).
- A separate `getHealthState()` method would require a second async call from the worker and every
  page that already calls `getHealth()`. The worker depends on `getHealth()` never throwing — that
  contract must be preserved. Adding the read state to the return value preserves that contract.
- `readState` is optional (backward-compat: existing consumers that only read `status` continue
  to work unchanged).

The `readState` field does not replace `status`. The P0/P1 constraints keep `status` non-healthy
regardless of `readState`.

**The four states, exactly where they should be produced:**

| State | Where produced | Condition |
|---|---|---|
| `not_configured` | `getHealth()` in `http.ts` (new guard at top) | `mode === 'read-only'` or `'audited'` AND (`baseUrl` is empty OR `JOURNAL_READ_TOKEN` absent in the token-guarded variant). In mock mode, never produced — mock data is always available. |
| `unreachable` | `getHealth()` catch block (`http.ts:125`) | `fetch()` throws (network error, DNS failure, timeout, or non-2xx HTTP status). |
| `malformed` | `getHealth()` after `safeParse` fails (`http.ts:119-124`) | `TortilaHealthSchema.safeParse(raw).success === false` on a valid 200 body. |
| `stale` | `getHealth()` after successful `safeParse` | `raw.ts` parses to a timestamp and `Date.now() - new Date(raw.ts).getTime() > STALE_THRESHOLD_MS`. Proposed threshold: `300_000` (5 minutes). Source field: `TortilaHealth.ts` (ISO 8601 string from `/api/health`). |

The `stale` HealthStatus value already exists in the `HealthStatus` union (`types.ts:20`). The
read-only HTTP adapter for Tortila currently never produces it. After this change, `getHealth()`
should set `status: 'stale'` (in addition to `readState: 'stale'`) when the `ts` field is beyond
the threshold, so the existing UI tone logic (`health.status === 'stale'` → `warn` tone) fires
correctly.

---

### Finding 2 — HIGH — PG2
**`getHealth()` in `http.ts` has no auth header — JOURNAL_READ_TOKEN is not attached**

Evidence: `packages/bot-adapters/src/http.ts:40-50`

The `getJson` helper sends `{ accept: 'application/json' }` only. There is no `Authorization`
header. The contract (`docs/CONTRACTS/tortila-adapter.md:35-44`) documents that
`JOURNAL_READ_TOKEN` is required before production and must be sent as `Authorization: Bearer
<token>`, but the implementation has not added this path.

**Recommendation (placement only; secret-handling deferred to security auditor):**

Extend `getJson` to accept an optional `token` parameter:

```typescript
async function getJson(url: string, timeoutMs = 4000, token?: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const headers: Record<string, string> = { accept: 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal, headers });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
```

The token must only be attached when `url.startsWith(base)` (i.e., only to the configured
journal base URL — never forwarded to any other host). `createHttpTortilaAdapter` must accept the
token as a second parameter and pass it to every `getJson` call it makes:

```typescript
export function createHttpTortilaAdapter(baseUrl: string, token?: string): BotAdapter {
  // token used in every getJson(url, ..., token) call
}
```

The factory (`factory.ts`) and `botAdapterOptions()` in `server-config.ts` must read the token
from env and forward it. The token MUST NOT appear in any log line, error message string, or
`AdapterNotReadyError` detail. The security auditor owns the vault-storage design.

The `not_configured` state (Finding 1) must additionally trigger when `mode === 'read-only'` or
`'audited'` and no token is present AND the contract requires a token. Concretely: if the
journal's `/api/health` returns 401 (once auth middleware is deployed on the journal side), the
adapter should classify that as `unreachable` (non-2xx). A missing token locally that would
cause a 401 can be pre-detected: `not_configured` if the token env var is absent in
`read-only`/`audited` mode.

---

### Finding 3 — MEDIUM — PG2
**Worker `not_configured` path uses `status='error'` — generates false alarms in monitoring**

Evidence: `apps/worker/src/index.ts:53-56`

```typescript
await recordHealthCheck(db, 'tortila-journal', 'error', {
  error: 'not_configured: set SYSTEM_BOT_INSTANCE_ID or SYSTEM_BOT_OWNER_ID to enable snapshots',
  adapterMode: botAdapterMode,
});
```

`status='error'` in `integration_health_checks` is the same string used for genuine failures
(network errors, DB errors). An unconfigured environment (dev/staging with no
`SYSTEM_BOT_INSTANCE_ID`) produces the same DB row as a real runtime fault, making it impossible
to distinguish "not yet configured" from "was configured and broke."

**Recommendation:**

Keep the `integration_health_checks.status` column as a coarse text field (no migration needed;
it's `text NOT NULL` in `schema.ts:260`). Map each adapter state to a specific status string and
keep the precise state in `detail`:

| Adapter state | DB `status` string | `detail.readState` |
|---|---|---|
| `not_configured` | `not_configured` | `{ readState: 'not_configured', reason: '...' }` |
| `unreachable` (network error) | `down` | `{ readState: 'unreachable', error: '...' }` |
| `malformed` (Zod failure on 200) | `error` | `{ readState: 'malformed', detail: '...' }` |
| `stale` (valid 200, old ts) | `ok` | `{ readState: 'stale', ageSeconds: N }` |
| alive + degraded (P0/P1 present) | `ok` | `{ readState: 'ok', healthStatus: 'degraded' }` |
| alive + healthy (future) | `ok` | `{ readState: 'ok', healthStatus: 'healthy' }` |

`not_configured` MUST NOT be written as `status='error'`. It is an expected setup state,
not a runtime failure. Dashboards / admin alerts that page on `status='error'` would otherwise
generate noise in every new development environment.

No schema migration is required — `status text NOT NULL` already accepts any string.

---

### Finding 4 — MEDIUM — PG2
**`getWarnings()` is absent from `BotAdapter`; `health.warnings` is the only surface; mock and real drift risk**

Evidence: `packages/bot-adapters/src/types.ts:52-69` (no `getWarnings` method);
`packages/bot-adapters/src/adapters.test.ts:51-57` (the canonical-code invariant tests
`TORTILA_WARNINGS` and `LEGACY_WARNINGS` but has no surface to test a `getWarnings()` return).

The signal warnings (`TORTILA_SIGNAL_WARNINGS`: `tp_rejection_101211`, `rate_limit_100410`,
`exchange_flat_mismatch`, `fill_lookup_109421`) are currently baked statically into
`TORTILA_WARNINGS` and always returned even from the real adapter
(`tortila.mapping.ts:48` uses `TORTILA_PERSISTENT_WARNINGS` only; `http.ts:136` uses
`TORTILA_PERSISTENT_WARNINGS` only in the fallback; but mock returns all `TORTILA_WARNINGS`
including signal warnings via `mock-tortila.ts:67`).

The real adapter's `getHealth()` returns only `TORTILA_PERSISTENT_WARNINGS` (`http.ts:137`,
`mapping.ts:48`), not the signal warnings. The mock returns all warnings. This is an intentional
asymmetry (signal warnings are supposed to be derived from `/api/activity` safety events in the
real adapter), but it is undocumented and untested. A consuming page comparing
`health.warnings.length` between mock and real will see different counts with no explanation.

**Recommendation:**

Add `getWarnings(): Promise<RiskWarning[]>` to `BotAdapter`:

```typescript
export interface BotAdapter {
  // ... existing fields ...
  /** All currently active risk warnings. Includes persistent P0/P1 and any derived signal
   *  warnings. Codes must be a subset of CANONICAL_WARNING_CODES (invariant in adapters.test.ts). */
  getWarnings(): Promise<RiskWarning[]>;
}
```

Mock returns `TORTILA_WARNINGS` (persistent + all signal warnings — already done implicitly).
Real adapter returns `TORTILA_PERSISTENT_WARNINGS` always, plus any signal warnings derivable from
the journal (initially none until `/api/activity` parsing is wired; that is a future step).

**Deduplication rule:** `health.warnings` should become a delegate to `getWarnings()`. Both the
mock and real `getHealth()` implementations should call `await this.getWarnings()` and embed the
result as `health.warnings`. This eliminates the drift risk: there is one path, not two.

The existing test in `adapters.test.ts:51-57` (canonical-code invariant) continues to work —
extend it to also run against `getWarnings()` return values:

```typescript
it('every code returned by getWarnings is canonical', async () => {
  const warnings = await adapter.getWarnings();
  for (const w of warnings) {
    expect(CANONICAL_WARNING_CODES).toContain(w.code);
  }
});
```

This is the single place where new warning codes will surface — any new code added to the
adapter without a corresponding entry in `CANONICAL_WARNING_CODES` will break this test.
The invariant is already in `adapters.test.ts:51-57` for the static arrays; `getWarnings()` must
be covered by the same test.

**Dashboard consumption distinction:**

- `[bot]/page.tsx:58-64` renders `health.warnings` in a "Risk & audit warnings" card.
- `safety/page.tsx:37-44` also renders `health.warnings` in its own "Risk & audit warnings" card.
- When `getWarnings()` exists, both pages should call it directly once and use the result both for
  `health.warnings` and for the `active = warnings.filter(...)` count. They should NOT call
  `getHealth()` and `getWarnings()` separately (two round-trips). Preferred: get `health` from
  `getHealth()` (which delegates `warnings` to `getWarnings()` internally), so callers stay
  unchanged.

---

### Finding 5 — MEDIUM — PG2
**StatusPill in `[bot]/page.tsx` and `safety/page.tsx` renders the raw `health.status` string — user sees a bare "degraded" with no context**

Evidence: `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:43,50`;
`apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx:17,25`

```typescript
// page.tsx:43
const tone: Tone = health.status === 'healthy' ? 'ok' : health.status === 'down' ? 'bad' : 'warn';
// page.tsx:50
<StatusPill tone={tone}>{health.status}</StatusPill>
```

With the current code, a user whose adapter is `not_configured` sees a `warn`-tone StatusPill
containing the text "degraded". A user whose journal is unreachable also sees "degraded". A user
whose data is stale sees "stale" which is slightly better, but the copy is raw and unhelpful.

The `readState` field (Finding 1) provides the signal; the UI must map it to honest, specific
short copy.

**Recommendation — exact StatusPill tone and copy per readState:**

| `readState` | `HealthStatus` | Tone | Short copy for StatusPill |
|---|---|---|---|
| `not_configured` | `degraded` | `neutral` (info, not alarm) | "Setup needed" |
| `unreachable` | `down` | `bad` | "Journal unreachable" |
| `malformed` | `degraded` | `bad` | "Response malformed" |
| `stale` | `stale` | `warn` | "Data stale" |
| `ok` + `status: 'degraded'` | `degraded` | `warn` | "Running (warnings)" |
| `ok` + `status: 'healthy'` | `healthy` | `ok` | "Healthy" |

Replace the current raw `{health.status}` in the StatusPill with a helper:

```typescript
function readStatePill(health: BotHealth): { tone: Tone; label: string } {
  switch (health.readState) {
    case 'not_configured': return { tone: 'neutral', label: 'Setup needed' };
    case 'unreachable':    return { tone: 'bad',     label: 'Journal unreachable' };
    case 'malformed':      return { tone: 'bad',     label: 'Response malformed' };
    case 'stale':          return { tone: 'warn',    label: 'Data stale' };
    default:
      return health.status === 'healthy'
        ? { tone: 'ok',   label: 'Healthy' }
        : health.status === 'down'
          ? { tone: 'bad',  label: 'Down' }
          : { tone: 'warn', label: 'Running (warnings)' };
  }
}
```

The `not_configured` state MUST use a neutral/info tone (not `warn`), so operators setting up a
new environment are not alarmed.

---

### Finding 6 — LOW — PG2
**Stale threshold and source field are unspecified in code; only CANONICAL_ANALYTICS_MODEL.md §7 mentions 10 minutes**

Evidence: `docs/CANONICAL_ANALYTICS_MODEL.md` §7 ("if most recent health check is older than 10
minutes…stale banner"); no corresponding constant in `types.ts`, `http.ts`, or `jobs.ts`.

`CANONICAL_ANALYTICS_MODEL.md:§7` references 10 minutes for the UI staleness banner (based on
`integration_health_checks.checked_at`). But the adapter-level `stale` state (based on the
journal's own `ts` field in the `/api/health` response) has no documented threshold.

Two staleness signals exist at different layers:
1. **Adapter-level stale** (`readState: 'stale'`): the journal `/api/health` `ts` field is older
   than a threshold. Source: `TortilaHealth.ts` (ISO 8601). Proposed threshold: 300 seconds
   (5 minutes). Rationale: the journal is a local process; if its own timestamp is 5 minutes old,
   the SQLite reads are stale regardless of network connectivity.
2. **UI-level stale** (existing, CANONICAL_ANALYTICS_MODEL.md §7): `integration_health_checks.checked_at`
   is older than 10 minutes. This is the worker's last successful write, not the adapter's view.

**Recommendation:** Define a constant in `types.ts` or `http.ts`:

```typescript
export const ADAPTER_STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
```

Document in `tortila-adapter.md` that:
- Adapter-level stale threshold = 5 minutes (based on `/api/health` `ts`).
- UI-level stale threshold = 10 minutes (based on `integration_health_checks.checked_at`).
- The two thresholds are independent and serve different purposes.

---

### Finding 7 — LOW — PG2
**`server-config.ts` uses `TORTILA_JOURNAL_BASE_URL`; worker uses `TORTILA_JOURNAL_URL`; env.example documents both but factory only reads from `botAdapterOptions()`**

Evidence: `apps/web/src/lib/server-config.ts:13`
(`tortilaBaseUrl: process.env.TORTILA_JOURNAL_BASE_URL`);
`apps/worker/src/index.ts:42`
(`const tortilaBaseUrl = process.env.TORTILA_JOURNAL_URL`);
`.env.example:34-37` (both documented as supported).

The web app reads `TORTILA_JOURNAL_BASE_URL`. The worker reads `TORTILA_JOURNAL_URL`.
If an operator sets only one, the web app and worker diverge (one uses real adapter, one uses
mock). Neither path warns the user about this divergence.

**Recommendation:** Normalize to a single canonical var `TORTILA_JOURNAL_URL` in both the web
`server-config.ts` and the worker. Keep `TORTILA_JOURNAL_BASE_URL` as a fallback for backward
compatibility with a console warn if only the legacy name is found. The `not_configured`
`readState` should also be triggered when `read-only`/`audited` mode is active but neither var
is set, providing a clear diagnostic.

---

### Finding 8 — INFO — PG2
**`healthToCanonical` hard-codes `status: 'degraded'` regardless of whether `ok` is true or false**

Evidence: `packages/bot-adapters/src/tortila/tortila.mapping.ts:45`

This is architecturally correct today (P0/P1 unresolved → never healthy). However, when P0/P1
are eventually resolved and the journal begins reporting `tp_reconcile_ok`, the mapping function
must be updated in a single place. The constraint is documented in code comments but is not
enforced by a test that would fail if `status: 'healthy'` were returned while P0/P1 are still
in `TORTILA_PERSISTENT_WARNINGS`.

**Recommendation:** Add a test (in `tortila-mapping.test.ts` or a new W-07) that asserts:
"if `TORTILA_PERSISTENT_WARNINGS` contains any `severity: 'error'` entry, `healthToCanonical`
must not return `status: 'healthy'`." This makes the constraint machine-verified rather than
documentation-only.

---

## Decisions

1. **Extend `BotHealth` with optional `readState: ReadState` and `readStateDetail: string`** rather
   than widening `HealthStatus` or adding a new `getHealthState()` method. Backward-compat: optional
   field; existing consumers unchanged.

2. **Four states defined as returned values, never thrown.** `getHealth()` must never throw
   (current contract preserved). All four states are expressed as `readState` field values in the
   returned `BotHealth` object.

3. **Stale threshold: 5 minutes** for adapter-level stale (based on `/api/health` `ts` field).
   Distinct from the 10-minute UI-level stale (based on `integration_health_checks.checked_at`).
   Source field: `TortilaHealth.ts` (ISO 8601 string already in the validated schema).

4. **`not_configured` maps to DB status string `'not_configured'`, not `'error'`** to prevent
   monitoring false alarms. No DB migration required — `status` column is `text`.

5. **`getWarnings(): Promise<RiskWarning[]>` added to `BotAdapter`** interface. `health.warnings`
   delegates to it. The canonical-code test invariant (`adapters.test.ts:51-57`) is extended to
   cover the `getWarnings()` return. All codes returned must be in `CANONICAL_WARNING_CODES`.

6. **`JOURNAL_READ_TOKEN` is passed through `createHttpTortilaAdapter(baseUrl, token)` and
   attached only to requests targeting the configured `base` URL.** Security auditor owns
   vault-storage design. Token must not appear in any log or error string.

---

## Risks

1. **Widening `HealthStatus` union would break existing tone-mapping switches** in `[bot]/page.tsx`
   and `safety/page.tsx`. Adding `readState` as optional avoids this — but callers must be updated
   to prefer `readState` over the raw `status` string for the StatusPill label.

2. **`getWarnings()` refactor requires updating both mock adapters, the real HTTP adapter, and both
   dashboard pages.** If only some are updated, the duplicate-warning risk increases rather than
   decreases. Implement atomically or not at all.

3. **Two env var names (`TORTILA_JOURNAL_URL` vs `TORTILA_JOURNAL_BASE_URL`) can silently diverge
   between web and worker in a multi-service deployment.** Normalizing requires updating
   `server-config.ts` and `packages/config/src/env.ts` (which has `TORTILA_JOURNAL_BASE_URL` with
   a default of `http://127.0.0.1:8080`). The default in `env.ts` means `read-only` mode with no
   explicit URL will silently try to connect to localhost.

4. **The `not_configured` early-exit in `apps/worker/src/index.ts:49-59` runs only in the branch
   where both `SYSTEM_BOT_INSTANCE_ID` and `SYSTEM_BOT_OWNER_ID` are absent.** If these are set
   but `TORTILA_JOURNAL_URL` is absent and mode is mock, the worker proceeds with the mock adapter
   and writes `status='ok'` with `adapterMode: 'mock'` — which is correct, but the `not_configured`
   state (from Finding 1) should also be surfaced by the adapter's `getHealth()` return rather than
   only in the outer worker guard, so the bot dashboard page shows "Setup needed" rather than
   "Running (warnings)" when the user navigates there directly.

5. **Stale detection from `TortilaHealth.ts` requires the journal's own clock to be accurate.**
   If the journal server's clock drifts or the TZ offset is non-UTC, the comparison against
   `Date.now()` may produce false-positive staleness. A safe guard: treat any `ts` parse failure
   as `malformed` rather than `stale`.

---

## Verification / tests

The following tests must be added or updated by the implementer. These are the
directly needed verifications for Finding 1–8 above:

**New unit tests in `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts`:**

- `T-21`: `getHealth()` on real adapter with `fetch` stubbed to network-error returns
  `{ readState: 'unreachable', status: 'degraded', processAlive: false }`. No throw.
- `T-22`: `getHealth()` on real adapter with `fetch` stubbed to return 200 + `{ unexpected: 1 }`
  (Zod fail) returns `{ readState: 'malformed', processAlive: false }`. No throw.
- `T-23`: `getHealth()` on real adapter with valid `{ ok: true, ts: '<5 min ago>' }` returns
  `{ readState: 'ok', processAlive: true }`.
- `T-24`: `getHealth()` on real adapter with valid `{ ok: true, ts: '<6 min ago>' }` returns
  `{ readState: 'stale', status: 'stale' }`.
- `T-25`: `createHttpTortilaAdapter('', undefined)` (empty URL or no token) returns
  `{ readState: 'not_configured' }` from `getHealth()`.
- `W-07`: `healthToCanonical` must not return `status: 'healthy'` when any
  `TORTILA_PERSISTENT_WARNINGS` entry has `severity: 'error'`.

**Extended invariant test in `adapters.test.ts`:**

- Extend the canonical-code invariant test to cover `getWarnings()` return values from both mock
  and (no-network) real adapter.

**Worker snapshot tests (in `apps/worker/src/jobs.test.ts` or similar):**

- Assert that when `adapter.getHealth()` returns `readState: 'not_configured'`, `recordHealthCheck`
  is called with `status: 'not_configured'`, not `'error'`.
- Assert that `readState: 'unreachable'` writes `status: 'down'`.
- Assert that `readState: 'malformed'` writes `status: 'error'`.
- Assert that `readState: 'stale'` writes `status: 'ok'` with `detail.readState: 'stale'`.

**E2E (Playwright) per ACCEPTANCE_MATRIX_MASTER.md §PG2:**

- `/admin/system-health` shows all 4 health states. This is currently listed as a gate but is
  blocked by the implementation gap identified in Finding 1.
- `safety/page.tsx` StatusPill shows "Setup needed" (neutral) in not_configured mode, not "degraded".
- `[bot]/page.tsx` StatusPill shows "Journal unreachable" (bad) in unreachable mode.

---

## Next actions

1. **Implementer: add `ReadState` type and `readState?/readStateDetail?` to `BotHealth` in
   `packages/bot-adapters/src/types.ts`.** Export from `index.ts`. (PG2 gate blocker)

2. **Implementer: update `getHealth()` in `http.ts`** to produce the correct `readState` in the
   three failure cases (not_configured / unreachable / malformed) and the stale success case.
   Add `ADAPTER_STALE_THRESHOLD_MS = 5 * 60 * 1000` constant. Never throw; always return.

3. **Implementer: update `healthToCanonical` in `tortila.mapping.ts`** to accept and forward the
   `readState` and to set `status: 'stale'` when `readState === 'stale'` (so the existing
   `HealthStatus` union is correctly used without widening).

4. **Implementer: add `getWarnings(): Promise<RiskWarning[]>` to `BotAdapter` interface** and
   implement in both mock and real adapters. Update `getHealth()` in both to delegate
   `warnings` to `this.getWarnings()`.

5. **Implementer: extend `adapters.test.ts` canonical-code invariant** to cover `getWarnings()`
   return values. Add `W-07` to `tortila-mapping.test.ts`.

6. **Implementer: update `snapshotTortilaJournal` in `apps/worker/src/jobs.ts`** to read
   `health.readState` and map to the correct `integration_health_checks.status` string per the
   table in Finding 3. Update the early-exit path in `index.ts:53-56` to write
   `status: 'not_configured'` rather than `'error'`.

7. **Implementer: update `[bot]/page.tsx:43,50` and `safety/page.tsx:17,25`** to use the
   `readStatePill()` helper (or equivalent inline logic) producing correct tone and copy per
   Finding 5.

8. **Security auditor (parallel): design `JOURNAL_READ_TOKEN` vault storage** and wiring.
   The placement in `getJson` is specified in Finding 2; the secret-storage design is deferred.

9. **Implementer: normalize env var** `TORTILA_JOURNAL_URL` as the canonical name in both
   `server-config.ts` and worker `index.ts`, with fallback to `TORTILA_JOURNAL_BASE_URL`.
   Update `packages/config/src/env.ts` and `.env.example`.

10. **Add T-21 through T-25 unit tests and worker snapshot tests** (see Verification section).
    These are required gates for the PG2 e2e smoke per ACCEPTANCE_MATRIX_MASTER.md.
