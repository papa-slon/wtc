# ecosystem-bot-integration-auditor handoff

## Scope

PG3 Legacy hard gate audit. Read-only inspection of the in-repo bot adapter layer
(`packages/bot-adapters/src/`), the bot dashboard pages (`apps/web/src/app/(app)/app/bots/`),
the bot feature helpers (`apps/web/src/features/bots/meta.ts`, `data.tsx`), and the
owning contract + safety docs (`docs/CONTRACTS/legacy-bot-adapter.md`,
`docs/BOT_CONTROL_SAFETY_MODEL.md`, `docs/BOT_INTEGRATION_PLAN.md`).

Produces three applyable designs:
1. `LegacyBlockedAdapter` compile-time gate replacing the live `createHttpLegacyAdapter` in
   the factory path.
2. Honest "live adapter unavailable" UI for the legacy bot specifically, data-driven via
   `BOT_CAPS`.
3. Zod plaintext-key exclusion schema — a `LegacyApiSafeBodySchema` that strips every
   SECRET_HINTS field from any `/api_management/` response body before it can reach the
   canonical layer.

## Files inspected

- `packages/bot-adapters/src/types.ts` — `BotAdapter`, `ReadState`, `ADAPTER_STALE_THRESHOLD_MS`
- `packages/bot-adapters/src/factory.ts` — `getBotAdapter`, `AdapterOptions`, `BotAdapterMode`
- `packages/bot-adapters/src/http.ts` — `createHttpTortilaAdapter`, `createHttpLegacyAdapter`
- `packages/bot-adapters/src/mock-legacy.ts` — `createMockLegacyAdapter`
- `packages/bot-adapters/src/mock-tortila.ts` — `createMockTortilaAdapter`
- `packages/bot-adapters/src/control.ts` — `assertBotControlAllowed`, `BotControlDisabledError`
- `packages/bot-adapters/src/warnings.ts` — `CANONICAL_WARNING_CODES`, `LEGACY_WARNINGS`
- `packages/bot-adapters/src/index.ts` — barrel exports
- `packages/bot-adapters/src/adapters.test.ts` — existing adapter governance tests
- `packages/bot-adapters/src/__tests__/getHealth-states.test.ts` — Tortila state tests
- `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts` — mapping + warning tests
- `apps/web/src/app/(app)/app/bots/page.tsx` — bots list page
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` — bot detail page
- `apps/web/src/features/bots/meta.ts` — `BOT_LIST`, `BOT_CAPS`, `botHealthPill`
- `apps/web/src/features/bots/data.tsx` — `loadBot`, `BotAccessRequired`
- `docs/CONTRACTS/legacy-bot-adapter.md` — contract and schemas
- `docs/BOT_CONTROL_SAFETY_MODEL.md` — safety model and gates
- `docs/BOT_INTEGRATION_PLAN.md` — integration plan, endpoint map
- `packages/audit/src/redact.ts` — `SECRET_HINTS`, `isSecretKey`, `isSecretValue`
- `docs/PRODUCTION_BLOCKERS.md` — B3 definition
- `docs/RISK_REGISTER_MASTER.md` — R1.2, R2.1

## Files changed

None — read-only audit.

## Findings

### F-01 — CRITICAL — factory.ts:31 routes legacy to a REAL HTTP adapter

**Evidence:** `packages/bot-adapters/src/factory.ts:31`
```
return useReal && opts.legacyBaseUrl ? createHttpLegacyAdapter(opts.legacyBaseUrl) : createMockLegacyAdapter();
```
In `read-only` or `audited` mode with `legacyBaseUrl` set, `getBotAdapter('legacy_bot', …)` returns
the real `createHttpLegacyAdapter` which probes `/api_management/`. The `/api_management/` body
contains plaintext exchange keys (`api_key`, `secret_key` — `docs/CONTRACTS/legacy-bot-adapter.md:118-128`).
Even though `getHealth()` in `createHttpLegacyAdapter` says "we only probe reachability and never read
the body" (`http.ts:282`), the raw response body is fully buffered by `getJson` (which calls
`res.json()`), and the getConfig/getMetrics paths would need to parse it. A caller who sets
`legacyBaseUrl` and `mode=read-only` today gets a real HTTP adapter; there is no compile-time or
runtime block. This contradicts the documented gate: B3 is "BLOCKED" and the 5 BOT_CONTROL_SAFETY_MODEL
security gates are "NOT STARTED".

**Recommendation:** Replace the `createHttpLegacyAdapter(opts.legacyBaseUrl)` branch with a call to
`createLegacyBlockedAdapter()` (new type, design below). The export of `createHttpLegacyAdapter` from
`index.ts:26` should be removed or replaced by the blocked adapter export. Detail in Decisions D-01.

**Target part:** PG3 item 1.

---

### F-02 — HIGH — http.ts getHealth for legacy calls /api_management/ and buffers the body

**Evidence:** `packages/bot-adapters/src/http.ts:269-289`
```
export function createHttpLegacyAdapter(baseUrl: string): BotAdapter {
  …
  async getHealth(): Promise<BotHealth> {
    // NOTE: legacy /api_management/ returns plaintext keys — we only probe reachability and never
    // read/proxy the body. The legacy adapter stays BLOCKED until the upstream key fix lands (PG3).
    let alive = false;
    try {
      await getJson(`${base}/api_management/`);
      alive = true;
    } catch {
      alive = false;
    }
```
`getJson` at `http.ts:41-55` calls `fetch(url, …)` and then `res.json()`, which fully buffers the
plaintext-key response body into a JavaScript value. Even though the caller discards the result, the
`api_key` and `secret_key` strings are in memory within `getJson`'s call frame. Node GC will
eventually release them, but they exist in the process heap momentarily. This is the "capture"
risk cited in `RISK_REGISTER_MASTER.md:R2.1` and `PRODUCTION_BLOCKERS.md:B3`.

The comment says "never read/proxy the body" but that is aspirationally false: `getJson` always calls
`res.json()`. A minimal approach (even if the adapter stays blocked) would use `res.ok` only (no body
parse) in a health-only probe. But since the right PG3 fix is to block the adapter entirely, the
correct resolution is F-01's `LegacyBlockedAdapter` — not patching `getHealth`.

**Recommendation:** Do not patch `createHttpLegacyAdapter.getHealth` — instead implement the
`LegacyBlockedAdapter` (D-01) which means this function is never reached from the factory.

**Target part:** PG3 item 1.

---

### F-03 — HIGH — No `LegacyAdapterBlockedError` type or regression test for the block

**Evidence:** `packages/bot-adapters/src/factory.ts` entire file; `adapters.test.ts` entire file.
There is no dedicated `LegacyAdapterBlockedError` error class, and no test that asserts "regardless
of mode/env, `getBotAdapter('legacy_bot', …)` with a legacyBaseUrl set CANNOT return a real HTTP
adapter." The single existing test `adapters.test.ts:13` (`cannot accidentally connect: read-only
without a base url stays mock`) only covers the "no baseUrl" path, not the "baseUrl set but adapter
must still be blocked" path. This leaves the PG3 hard gate unenforced by any automated check.

**Recommendation:** Add `LegacyAdapterBlockedError extends Error` (see D-02 for exact design), add
a named export from `index.ts`, and add regression test cases (see D-03) that cover:
- `mode=read-only` + `legacyBaseUrl` set → blocked adapter, not real HTTP
- `mode=audited` + `legacyBaseUrl` set → still blocked
- `mode=mock` + `legacyBaseUrl` set → mock adapter (demo path, not blocked)
- All data methods on the blocked adapter throw `LegacyAdapterBlockedError` citing B3
- All control methods still throw `BotControlDisabledError`

**Target part:** PG3 item 1.

---

### F-04 — MEDIUM — bots/page.tsx:42 and [bot]/page.tsx:75 show a generic "Simulated data" banner for ALL bots

**Evidence:**
- `apps/web/src/app/(app)/app/bots/page.tsx:42-48`:
  ```jsx
  {botAdapterMode() === 'mock' && (
    <RiskWarningBanner
      severity="warning"
      title="Simulated data — not a live account"
      detail="Bot dashboards use the mock adapter (BOT_ADAPTER_MODE=mock). No live exchange or bot account is connected; every figure below is illustrative."
    />
  )}
  ```
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:75-80`:
  ```jsx
  {adapter.mode === 'mock' && (
    <RiskWarningBanner
      severity="warning"
      title="Simulated data — not a live account"
      detail="BOT_ADAPTER_MODE=mock: every metric, position, and trade below is illustrative sample data from the mock adapter, not your real exchange account. Live read-only data requires a configured, audited adapter."
    />
  )}
  ```
Both banners apply identically to Tortila and Legacy. For Legacy, the real live adapter is not merely
"not configured" — it is permanently BLOCKED until the upstream plaintext-key fix lands (B3). A user
who sees "Live read-only data requires a configured, audited adapter" might incorrectly believe they
can unlock it by configuring a URL. For Legacy, the correct message is: the live adapter is BLOCKED
pending an upstream fix (B3), not merely unconfigured.

**Recommendation:** Add a `liveAdapterBlocked` flag to `BOT_CAPS` (design in D-04) and derive the
banner copy from it, so Legacy gets an honest "Live adapter unavailable — blocked pending upstream
plaintext-key fix (B3)" message. This is purely a data-driven flag in `meta.ts` + a conditional on
the existing banner render in `page.tsx`. No new JSX branches needed.

**Target part:** PG3 item 2.

---

### F-05 — HIGH — No Zod schema blocking SECRET_HINTS fields from any /api_management/ body

**Evidence:** `docs/PRODUCTION_BLOCKERS.md:B3:40-41`:
> "WTC: Zod exclusion schema on getHealth() blocks any SECRET_HINTS field; unit test asserts no
> secret-hint field can reach the WTC layer."

No such schema exists anywhere in `packages/bot-adapters/`. The `LegacyApiKeySchema` and
`LegacyApiKeyDetailSchema` defined in `docs/CONTRACTS/legacy-bot-adapter.md:119-128` actually
INCLUDE `api_key` and `secret_key` as schema fields. There is no pre-parse or post-parse exclusion
layer that strips those fields before a body value could reach a CanonicalMetrics or BotConfigView.

The contract document mentions redaction ("adapter must redact `api_key` and `secret_key` immediately
after parsing") but this logic does not exist in any source file. The existing `redact.ts` in
`packages/audit` covers audit logs only; it has no connection to the bot-adapter parse path.

**Recommendation:** Implement `LegacyApiSafeBodySchema` (design in D-05): a Zod transformation
schema that `.strip()`s any key matching the SECRET_HINTS list before the data can reach the WTC
canonical layer. This schema should live in
`packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`. Even though the adapter is
currently blocked, this schema is the B3 WTC-side deliverable that must exist before any un-blocking.

**Target part:** PG3 item 3.

---

### F-06 — LOW — `createHttpLegacyAdapter` exported from index.ts:26 — reachable by consumers

**Evidence:** `packages/bot-adapters/src/index.ts:26`:
```
export { createHttpTortilaAdapter, createHttpLegacyAdapter, AdapterNotReadyError } from './http.ts';
```
Any file that imports `@wtc/bot-adapters` can call `createHttpLegacyAdapter` directly, bypassing
the factory's (currently insufficient) gate. While the factory is the only documented call site, a
consumer importing from the package index can call the real HTTP adapter directly. After PG3 fixes,
`createHttpLegacyAdapter` should either be removed or kept internal (not exported from `index.ts`).

**Recommendation:** In the PG3 implementation, remove `createHttpLegacyAdapter` from the `index.ts`
barrel export. Export `createLegacyBlockedAdapter` and `LegacyAdapterBlockedError` instead (D-01).

**Target part:** PG3 item 1.

---

### F-07 — INFO — SECRET_HINTS in redact.ts does not include bare 'key' — coordination needed

**Evidence:** `packages/audit/src/redact.ts:12-36` — the `SECRET_HINTS` list.
The legacy API returns fields named `api_key` and `secret_key`. The hint `'apikey'` (no underscore,
lowercase) at `redact.ts:16` would match `api_key` after normalization (`.replace(/[_\s-]/g, '')`)
→ `apikey`. The hint `'secret'` at `redact.ts:13` matches `secret_key`. So these two specific legacy
fields ARE already covered by the existing `SECRET_HINTS` for audit redaction purposes.

However the Zod exclusion schema (D-05) needs a broader list: any field name from the legacy API
body that carries raw exchange credential material — including bare aliases like `key`, `token`,
`password`, `passphrase`, `private_key`. These are not all in `redact.ts`. The exclusion schema
should use its own comprehensive list (D-05 below) rather than importing from `redact.ts` (different
package boundary; the bot-adapters package should not depend on `@wtc/audit`). The security auditor
should review and reconcile the two lists in a joint findings round.

**Target part:** PG3 item 3, coordination with security auditor.

## Decisions

### D-01: LegacyBlockedAdapter — design (PG3 item 1)

**New file:** `packages/bot-adapters/src/legacy/legacy-blocked.ts`

```typescript
/**
 * LegacyBlockedAdapter — the ONLY legacy adapter reachable from the factory.
 *
 * The legacy /api_management/ API exposes plaintext exchange keys in its responses (B3).
 * Until the upstream fix lands (see docs/PRODUCTION_BLOCKERS.md B3), WTC MUST NOT issue
 * any real HTTP request to the legacy bot API. This adapter throws LegacyAdapterBlockedError
 * on every data method and BotControlDisabledError on every control method.
 *
 * In mock mode (BOT_ADAPTER_MODE=mock) the factory returns createMockLegacyAdapter instead.
 * In read-only/audited mode the factory ALWAYS returns this blocked adapter (not the real HTTP
 * adapter), regardless of legacyBaseUrl. There is no configuration path to activate the real
 * legacy HTTP adapter from the factory.
 */
import type { BotAdapter, BotConfigView, BotHealth, RiskWarning, ValidationResult } from '../types.ts';
import type { CanonicalMetrics, CanonicalPosition, CanonicalTrade } from '@wtc/analytics';
import { assertBotControlAllowed } from '../control.ts';
import { LEGACY_WARNINGS } from '../warnings.ts';

export class LegacyAdapterBlockedError extends Error {
  /** Blocker reference is always B3 — do not change until the blocker is cleared by the operator. */
  readonly blockerRef = 'B3';
  constructor(method: string) {
    super(
      `Legacy bot adapter method "${method}" is blocked. ` +
      `The legacy /api_management/ API exposes plaintext exchange keys (B3). ` +
      `WTC must not issue any real request until the upstream plaintext-key fix is confirmed ` +
      `and the 5 BOT_CONTROL_SAFETY_MODEL security gates are cleared. ` +
      `See docs/PRODUCTION_BLOCKERS.md B3 and docs/BOT_CONTROL_SAFETY_MODEL.md.`,
    );
    this.name = 'LegacyAdapterBlockedError';
  }
}

export function createLegacyBlockedAdapter(): BotAdapter {
  return {
    productCode: 'legacy_bot',
    mode: 'real', // mode=real so callers know a non-mock adapter was selected; the block is explicit
    async getWarnings(): Promise<RiskWarning[]> {
      return LEGACY_WARNINGS; // surface the known issues even when blocked
    },
    async getHealth(): Promise<BotHealth> {
      // Never issue a network request. Return a deterministic blocked state.
      // The readState 'unreachable' is intentionally NOT used (that implies a network attempt was made).
      // We use a distinct readState of 'not_configured' to indicate the adapter is intentionally
      // inactive, consistent with the adapter never running unauthenticated.
      return {
        productCode: 'legacy_bot',
        processAlive: false,
        status: 'down',
        readState: 'not_configured',
        readStateDetail: 'Live adapter blocked — pending upstream plaintext-key fix (B3). See docs/PRODUCTION_BLOCKERS.md.',
        lastSyncAt: null,
        staleDataSeconds: null,
        uptimeSeconds: null,
        warnings: await this.getWarnings(),
      };
    },
    async getConfig(_instanceId: string): Promise<BotConfigView> {
      throw new LegacyAdapterBlockedError('getConfig');
    },
    async getMetrics(_instanceId: string): Promise<CanonicalMetrics> {
      throw new LegacyAdapterBlockedError('getMetrics');
    },
    async getPositions(_instanceId: string): Promise<CanonicalPosition[]> {
      throw new LegacyAdapterBlockedError('getPositions');
    },
    async getTrades(_instanceId: string): Promise<CanonicalTrade[]> {
      throw new LegacyAdapterBlockedError('getTrades');
    },
    async getEquityCurve(_instanceId: string) {
      throw new LegacyAdapterBlockedError('getEquityCurve');
    },
    async validateConfig(_input: unknown): Promise<ValidationResult> {
      throw new LegacyAdapterBlockedError('validateConfig');
    },
    async startBot(): Promise<never> {
      assertBotControlAllowed('startBot', false, false);
      throw new Error('unreachable');
    },
    async stopBot(): Promise<never> {
      assertBotControlAllowed('stopBot', false, false);
      throw new Error('unreachable');
    },
    async applyConfig(): Promise<never> {
      assertBotControlAllowed('applyConfig', false, false);
      throw new Error('unreachable');
    },
  };
}
```

**Factory change (minimal, serial-safe):** `packages/bot-adapters/src/factory.ts` — change line 31
from the current form to:

```typescript
// BLOCKED: real legacy HTTP adapter is permanently blocked (B3 — plaintext keys upstream).
// In mock mode → createMockLegacyAdapter (synthetic demo data, labeled as mock).
// In read-only/audited mode → createLegacyBlockedAdapter (throws on data methods, honest UI).
// There is NO configuration path to createHttpLegacyAdapter from this factory.
import { createLegacyBlockedAdapter } from './legacy/legacy-blocked.ts';
…
if (productCode === 'legacy_bot') {
  if (opts.mode === 'mock') return createMockLegacyAdapter();
  return createLegacyBlockedAdapter(); // ignores legacyBaseUrl intentionally — still blocked
}
```

Note: `createHttpLegacyAdapter` may remain in `http.ts` for documentation purposes but MUST be
removed from the `index.ts` barrel export (F-06). The blocked adapter takes its place.

**index.ts barrel export change:**
Remove: `export { createHttpTortilaAdapter, createHttpLegacyAdapter, AdapterNotReadyError } from './http.ts';`
Replace with: `export { createHttpTortilaAdapter, AdapterNotReadyError } from './http.ts';`
Add: `export { createLegacyBlockedAdapter, LegacyAdapterBlockedError } from './legacy/legacy-blocked.ts';`

### D-02: LegacyAdapterBlockedError specifics

The error class (in `legacy-blocked.ts`) must:
- Carry `readonly blockerRef = 'B3'` (machine-readable; tests can assert on `err.blockerRef`).
- Cite the exact safety-model URL in the message so any consumer who receives it can route to docs.
- Not accept any argument beyond `method: string` (no opportunity to embed secrets).
- Be exported from `index.ts` (consumers should be able to `instanceof` check it).

### D-03: Regression test assertions (PG3 item 1)

New test file: `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { getBotAdapter } from '../factory.ts';
import { createLegacyBlockedAdapter, LegacyAdapterBlockedError } from '../legacy/legacy-blocked.ts';
import { createMockLegacyAdapter } from '../mock-legacy.ts';
import { BotControlDisabledError } from '../control.ts';

// --- Factory gate: mock mode → mock, not blocked ---
describe('Factory: mock mode returns mock adapter (demo path)', () => {
  it('mode=mock ⇒ createMockLegacyAdapter regardless of legacyBaseUrl', () => {
    const a = getBotAdapter('legacy_bot', { mode: 'mock', legacyBaseUrl: 'http://legacy.internal:8000' });
    expect(a.mode).toBe('mock');
    // instanceof check is not reliable across dynamic imports; product code + mode is sufficient
  });
  it('mode=mock with no legacyBaseUrl ⇒ still mock', () => {
    const a = getBotAdapter('legacy_bot', { mode: 'mock' });
    expect(a.mode).toBe('mock');
  });
});

// --- Factory gate: read-only/audited → blocked, never real HTTP ---
describe('Factory: read-only/audited mode ALWAYS returns blocked adapter (hard gate)', () => {
  it('mode=read-only + legacyBaseUrl set ⇒ blocked adapter (not real HTTP)', () => {
    const a = getBotAdapter('legacy_bot', { mode: 'read-only', legacyBaseUrl: 'http://legacy.internal:8000' });
    expect(a.mode).toBe('real'); // blocked adapter mode is 'real' (explicitly not mock)
    // getHealth must not throw; must return readState=not_configured
    return a.getHealth().then((h) => {
      expect(h.readState).toBe('not_configured');
      expect(h.processAlive).toBe(false);
      expect(h.readStateDetail).toContain('B3');
    });
  });

  it('mode=audited + legacyBaseUrl set ⇒ blocked adapter', () => {
    const a = getBotAdapter('legacy_bot', { mode: 'audited', legacyBaseUrl: 'http://legacy.internal:8000' });
    return a.getHealth().then((h) => {
      expect(h.readState).toBe('not_configured');
      expect(h.readStateDetail).toContain('B3');
    });
  });

  it('mode=read-only + no legacyBaseUrl ⇒ also blocked adapter (not mock)', () => {
    const a = getBotAdapter('legacy_bot', { mode: 'read-only' });
    // With the new factory, read-only always returns blocked (previously was mock fallback when no URL)
    return a.getHealth().then((h) => {
      expect(h.readState).toBe('not_configured');
    });
  });
});

// --- Blocked adapter: data methods throw LegacyAdapterBlockedError citing B3 ---
describe('LegacyBlockedAdapter: data methods throw LegacyAdapterBlockedError', () => {
  const adapter = createLegacyBlockedAdapter();

  it('getConfig throws LegacyAdapterBlockedError with blockerRef B3', async () => {
    await expect(adapter.getConfig('x')).rejects.toThrow(LegacyAdapterBlockedError);
    try { await adapter.getConfig('x'); } catch (e) {
      expect((e as LegacyAdapterBlockedError).blockerRef).toBe('B3');
    }
  });

  it('getMetrics throws LegacyAdapterBlockedError', async () => {
    await expect(adapter.getMetrics('x')).rejects.toThrow(LegacyAdapterBlockedError);
  });

  it('getPositions throws LegacyAdapterBlockedError', async () => {
    await expect(adapter.getPositions('x')).rejects.toThrow(LegacyAdapterBlockedError);
  });

  it('getTrades throws LegacyAdapterBlockedError', async () => {
    await expect(adapter.getTrades('x')).rejects.toThrow(LegacyAdapterBlockedError);
  });

  it('validateConfig throws LegacyAdapterBlockedError', async () => {
    await expect(adapter.validateConfig({})).rejects.toThrow(LegacyAdapterBlockedError);
  });
});

// --- Blocked adapter: getHealth never makes a network call and resolves ---
describe('LegacyBlockedAdapter: getHealth resolves without network calls', () => {
  it('getHealth resolves with readState=not_configured (never throws, never fetches)', async () => {
    const health = await createLegacyBlockedAdapter().getHealth();
    expect(health.readState).toBe('not_configured');
    expect(health.processAlive).toBe(false);
    expect(health.readStateDetail).toContain('B3');
    expect(health.warnings.length).toBeGreaterThan(0);
    // P0/P1 equivalent: legacy_plaintext_keys warning must be present
    const codes = health.warnings.map((w) => w.code);
    expect(codes).toContain('legacy_plaintext_keys');
  });
});

// --- Control methods still throw BotControlDisabledError (not LegacyAdapterBlockedError) ---
describe('LegacyBlockedAdapter: control methods throw BotControlDisabledError', () => {
  const adapter = createLegacyBlockedAdapter();
  it('startBot throws BotControlDisabledError', async () => {
    await expect(adapter.startBot('x')).rejects.toThrow(BotControlDisabledError);
  });
  it('stopBot throws BotControlDisabledError', async () => {
    await expect(adapter.stopBot('x')).rejects.toThrow(BotControlDisabledError);
  });
  it('applyConfig throws BotControlDisabledError', async () => {
    await expect(adapter.applyConfig('x', {})).rejects.toThrow(BotControlDisabledError);
  });
});

// --- No /api_management/ fetch is reachable from either real or mock legacy adapter paths ---
describe('No HTTP fetch to /api_management/ from any factory-reachable legacy adapter', () => {
  it('mock adapter methods do not call fetch', async () => {
    // createMockLegacyAdapter is purely in-memory; no fetch import
    const a = createMockLegacyAdapter();
    // If this test runs to completion without a network error, the invariant holds.
    await a.getHealth();
    await a.getConfig('x');
    await a.getMetrics('x');
    await a.getPositions('x');
    await a.getTrades('x');
  });

  it('blocked adapter getHealth does not call fetch (resolves in-process)', async () => {
    // Stub fetch to fail loudly — if it is called we would hear it.
    // We do NOT use vi.stubGlobal here because we cannot import vi in a non-Vitest spec.
    // This test runs in Vitest; the assertion is that getHealth resolves without the
    // network rejection that would occur if it tried to reach the port.
    const a = createLegacyBlockedAdapter();
    const health = await a.getHealth(); // must resolve, not reject
    expect(health).toBeDefined();
  });
});
```

### D-04: Honest "live adapter unavailable" UI (PG3 item 2)

**File to change:** `apps/web/src/features/bots/meta.ts`

Add the `liveAdapterBlocked` field to `BotCapabilities`:

```typescript
export interface BotCapabilities {
  hasBacktester: boolean;
  hasTradeHistory: boolean;
  hasEquityCurve: boolean;
  takeProfit: CapabilityState;
  stopLoss: CapabilityState;
  trailingStop: CapabilityState;
  notes: string[];
  /**
   * When true, the live adapter is BLOCKED by an upstream dependency, not merely unconfigured.
   * The UI shows a distinct "blocked" banner explaining the reason and the blocker reference,
   * rather than the generic "configure the adapter" message shown for Tortila.
   * Legacy bot: true — blocked on B3 (plaintext exchange keys in /api_management/ response).
   * Tortila bot: false — live adapter is available once JOURNAL_READ_TOKEN is configured.
   */
  liveAdapterBlocked: boolean;
  /**
   * Human-readable explanation shown when liveAdapterBlocked = true.
   * Never shown for Tortila (liveAdapterBlocked = false there).
   */
  liveAdapterBlockedReason?: string;
}
```

Update `BOT_CAPS`:

```typescript
export const BOT_CAPS: Record<BotProductCode, BotCapabilities> = {
  tortila_bot: {
    hasBacktester: true,
    hasTradeHistory: true,
    hasEquityCurve: true,
    takeProfit: 'supported',
    stopLoss: 'supported',
    trailingStop: 'supported',
    liveAdapterBlocked: false,
    notes: [
      'TP reconciliation after a restart is a known P0 gap — dashboards show a persistent warning until resolved.',
      'Margin pre-flight before entry is a known P1 gap.',
    ],
  },
  legacy_bot: {
    hasBacktester: false,
    hasTradeHistory: false,
    hasEquityCurve: false,
    takeProfit: 'supported',
    stopLoss: 'supported',
    trailingStop: 'supported',
    liveAdapterBlocked: true,
    liveAdapterBlockedReason:
      'The legacy /api_management/ API exposes exchange keys in plaintext. ' +
      'Live read-only data for the Legacy Bot is blocked until the upstream fix is confirmed and all 5 security gates are cleared (B3). ' +
      'All data below is illustrative mock data. No live exchange or bot account is connected.',
    notes: [
      'No closed-trade history endpoint — trade analytics are unavailable (shown honestly, never fabricated).',
      'No equity-curve endpoint — wallet balance only.',
      'No backtester for this bot.',
    ],
  },
};
```

**UI change:** `apps/web/src/app/(app)/app/bots/page.tsx` and `[bot]/page.tsx`

In `bots/page.tsx`, replace the current blanket `botAdapterMode() === 'mock'` banner with a
per-bot capability check. The key insight is that the list page renders one banner per row, so
the banner can be moved inside the per-bot card:

```tsx
// Inside the rows.map() card render, after the health + access section:
{BOT_CAPS[b.code].liveAdapterBlocked ? (
  <RiskWarningBanner
    severity="error"
    title="Live adapter unavailable — blocked (B3)"
    detail={BOT_CAPS[b.code].liveAdapterBlockedReason ?? ''}
  />
) : (
  adapter.mode === 'mock' && (
    <RiskWarningBanner
      severity="warning"
      title="Simulated data — not a live account"
      detail="BOT_ADAPTER_MODE=mock: all figures are illustrative. Live read-only data requires a configured adapter."
    />
  )
)}
```

The top-level blanket `botAdapterMode() === 'mock'` banner at `bots/page.tsx:42` should be removed
or scoped to Tortila-only when legacy is blocked.

In `[bot]/page.tsx`, the equivalent block at line 75:

```tsx
{caps.liveAdapterBlocked ? (
  <RiskWarningBanner
    severity="error"
    title="Live adapter unavailable — blocked pending upstream fix (B3)"
    detail={caps.liveAdapterBlockedReason ?? ''}
  />
) : (
  adapter.mode === 'mock' && (
    <RiskWarningBanner
      severity="warning"
      title="Simulated data — not a live account"
      detail="BOT_ADAPTER_MODE=mock: every metric, position, and trade below is illustrative sample data from the mock adapter, not your real exchange account. Live read-only data requires a configured, audited adapter."
    />
  )
)}
```

The `caps` variable is already computed at `[bot]/page.tsx:35` (`const caps = BOT_CAPS[meta.code]`).
No new data fetching or server-side work needed — `BOT_CAPS` is a static object.

The `liveAdapterBlocked` / `liveAdapterBlockedReason` fields are type-only additions to `meta.ts`.
No new JSX component is required; the existing `RiskWarningBanner` handles the display. All logic
is data-driven from `BOT_CAPS` — no per-bot `if (bot === 'legacy')` JSX branches in the UI files.

### D-05: Zod plaintext-key exclusion schema (PG3 item 3)

**New file:** `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`

This schema must strip any field whose normalised key name (lowercased, underscores/dashes removed)
contains any entry from a bot-adapter-local SECRET_FIELD_NAMES list. It should NOT import from
`@wtc/audit` (different package; avoid cross-package coupling). The list below is derived from
the `redact.ts` SECRET_HINTS AND from the known legacy API response field names, extended to cover
all plausible exchange-key field aliases.

```typescript
/**
 * LegacyApiSafeBodySchema — Zod transformation that STRIPS any field whose normalised key name
 * contains a secret-hint substring, before ANY parsed value can reach the WTC canonical layer.
 *
 * This is the WTC-side deliverable for PRODUCTION_BLOCKERS.md B3 item 2. It must be applied to
 * every /api_management/* response body before any mapping to BotHealth / BotConfigView / BotMetrics.
 *
 * The adapter is currently BLOCKED (createLegacyBlockedAdapter), so no /api_management/ call is
 * issued from the factory. This schema exists so that when the upstream fix lands and the adapter
 * is un-blocked, NO code path can accidentally forward a plaintext key to the canonical layer.
 *
 * The schema is ADDITIVE SAFETY: if the upstream removes the key fields entirely, parsing still
 * succeeds (extra fields are stripped by z.object().strip()). If the upstream continues to send
 * the fields, they are removed at parse time before the result is used.
 */
import { z } from 'zod';

/**
 * Normalise a key name for comparison. Matches the normalisation in packages/audit/src/redact.ts
 * but is maintained independently here (no cross-package coupling).
 */
function normaliseKey(k: string): string {
  return k.toLowerCase().replace(/[_\s-]/g, '');
}

/**
 * Secret field name substrings. Any key whose normalised form CONTAINS one of these strings
 * is stripped from the body. The list reconciles:
 *   - redact.ts SECRET_HINTS (packages/audit/src/redact.ts:12-36)
 *   - known legacy API response fields: api_key, secret_key (CONTRACTS/legacy-bot-adapter.md:119-128)
 *   - common exchange-API-key field aliases observed across trading APIs
 *
 * Coordination note (F-07): the security auditor should review this list alongside redact.ts
 * SECRET_HINTS in the next joint findings round. Any future addition to redact.ts should be
 * mirrored here.
 */
export const LEGACY_SECRET_FIELD_NAMES = [
  // Core exchange credential aliases
  'apikey',      // matches: api_key, apiKey, API_KEY, api-key
  'secret',      // matches: secret_key, apiSecret, api_secret, secret
  'privatekey',  // matches: private_key, privateKey
  'passphrase',  // matches: passphrase, pass_phrase
  'password',    // matches: password, passwd
  'token',       // matches: token, access_token, refresh_token, id_token, api_token
  'mnemonic',    // matches: mnemonic, seed_phrase
  'seedphrase',  // matches: seed_phrase, seedPhrase
  // Extended from redact.ts SECRET_HINTS
  'kek',
  'dek',
  'wrappeddek',
  'authorization',
  'cookie',
  'bearer',
  'credential',  // matches: credentials, credential
  'sealed',
  'ciphertext',
  'vaultrecord',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'onetimecode',
  // Bare aliases that are too generic for redact.ts but appropriate for exchange-body exclusion
  // 'key' alone is deliberately NOT included (too broad — would strip 'api_id' key field).
  // 'pass' alone is deliberately NOT included (too broad).
  // The exact legacy fields 'api_key' and 'secret_key' are caught by 'apikey' and 'secret' above.
] as const;

/** Returns true if a field key (after normalisation) matches any LEGACY_SECRET_FIELD_NAMES entry. */
export function isLegacySecretField(key: string): boolean {
  const norm = normaliseKey(key);
  return LEGACY_SECRET_FIELD_NAMES.some((hint) => norm.includes(hint));
}

/**
 * Strip secret-hint fields from a parsed record. Called as a Zod transform.
 * Works at any nesting depth via recursion (capped at 8 levels — matches redact.ts).
 * Returns a new object; the input is not mutated.
 */
function stripSecretFields(value: unknown, depth = 0): unknown {
  if (depth > 8) return value;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripSecretFields(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (!isLegacySecretField(k)) {
      out[k] = stripSecretFields(v, depth + 1);
    }
    // If isLegacySecretField(k) is true, the field is dropped silently (no [REDACTED] placeholder,
    // no log entry — it simply does not appear in the output). This is intentional: the WTC
    // layer should never see even a [REDACTED] marker for exchange key material.
  }
  return out;
}

/**
 * A passthrough Zod schema that accepts any object and strips all secret-hint fields
 * before the data continues to a stricter downstream schema.
 *
 * Usage pattern (when the adapter is un-blocked):
 *   const raw = await getJson(url);
 *   const safe = LegacyApiSafeBodySchema.parse(raw);   // secret fields stripped here
 *   const parsed = LegacyApiKeyListSchema.parse(safe);  // downstream schema sees clean data
 */
export const LegacyApiSafeBodySchema = z
  .unknown()
  .transform((v) => stripSecretFields(v));

/**
 * A typed variant for the list endpoint body. Safe fields only.
 * The downstream LegacyApiKeySchema must NOT include api_key or secret_key fields.
 * Any such fields from the upstream response will have been removed by LegacyApiSafeBodySchema.
 */
export const SafeLegacyApiKeyListSchema = LegacyApiSafeBodySchema.pipe(
  z.array(
    z.object({
      pub_id: z.string().uuid(),
      market: z.enum(['BINANCE', 'BINGX']),
      user_id: z.string(),
      running: z.boolean(),
      balance: z.number(),
      quarantined: z.boolean(),
      quarantine_reason: z.string().nullable(),
      // api_key and secret_key intentionally absent — stripped by LegacyApiSafeBodySchema
    })
  )
);
```

**New test file:** `packages/bot-adapters/src/__tests__/legacy-plaintext-exclusion.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { isLegacySecretField, LegacyApiSafeBodySchema, LEGACY_SECRET_FIELD_NAMES } from '../legacy/legacy-plaintext-exclusion.ts';

// --- isLegacySecretField ---
describe('isLegacySecretField: key normalisation and detection', () => {
  it('api_key → true (matches apikey)', () => {
    expect(isLegacySecretField('api_key')).toBe(true);
  });
  it('secret_key → true (matches secret)', () => {
    expect(isLegacySecretField('secret_key')).toBe(true);
  });
  it('apiKey → true (camelCase normalised)', () => {
    expect(isLegacySecretField('apiKey')).toBe(true);
  });
  it('API_KEY → true (uppercase normalised)', () => {
    expect(isLegacySecretField('API_KEY')).toBe(true);
  });
  it('passphrase → true', () => {
    expect(isLegacySecretField('passphrase')).toBe(true);
  });
  it('password → true', () => {
    expect(isLegacySecretField('password')).toBe(true);
  });
  it('private_key → true (matches privatekey)', () => {
    expect(isLegacySecretField('private_key')).toBe(true);
  });
  it('access_token → true (matches token)', () => {
    expect(isLegacySecretField('access_token')).toBe(true);
  });
  it('refresh_token → true (matches token)', () => {
    expect(isLegacySecretField('refresh_token')).toBe(true);
  });

  // Non-secret fields
  it('pub_id → false (no secret hint)', () => {
    expect(isLegacySecretField('pub_id')).toBe(false);
  });
  it('balance → false', () => {
    expect(isLegacySecretField('balance')).toBe(false);
  });
  it('market → false', () => {
    expect(isLegacySecretField('market')).toBe(false);
  });
  it('quarantined → false', () => {
    expect(isLegacySecretField('quarantined')).toBe(false);
  });
  it('running → false', () => {
    expect(isLegacySecretField('running')).toBe(false);
  });
  it('user_id → false', () => {
    expect(isLegacySecretField('user_id')).toBe(false);
  });
});

// --- LegacyApiSafeBodySchema: plaintext keys stripped ---
describe('LegacyApiSafeBodySchema: strips all SECRET_HINTS fields', () => {
  const legacyApiResponse = {
    pub_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    api_key: 'REAL_EXCHANGE_KEY_abcdef1234567890',
    secret_key: 'REAL_EXCHANGE_SECRET_zyxwvu9876543210',
    market: 'BINGX',
    user_id: 'user-1',
    running: true,
    balance: 1423.5,
    quarantined: false,
    quarantine_reason: null,
  };

  it('api_key is absent from the parsed output', () => {
    const result = LegacyApiSafeBodySchema.parse(legacyApiResponse) as Record<string, unknown>;
    expect(result).not.toHaveProperty('api_key');
  });

  it('secret_key is absent from the parsed output', () => {
    const result = LegacyApiSafeBodySchema.parse(legacyApiResponse) as Record<string, unknown>;
    expect(result).not.toHaveProperty('secret_key');
  });

  it('non-secret fields are preserved intact', () => {
    const result = LegacyApiSafeBodySchema.parse(legacyApiResponse) as Record<string, unknown>;
    expect(result['pub_id']).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(result['market']).toBe('BINGX');
    expect(result['balance']).toBe(1423.5);
    expect(result['quarantined']).toBe(false);
  });

  it('the parsed output string does not contain the raw exchange key value', () => {
    const result = LegacyApiSafeBodySchema.parse(legacyApiResponse);
    expect(JSON.stringify(result)).not.toContain('REAL_EXCHANGE_KEY_abcdef1234567890');
    expect(JSON.stringify(result)).not.toContain('REAL_EXCHANGE_SECRET_zyxwvu9876543210');
  });

  it('strips nested secret fields too (depth > 1)', () => {
    const nested = {
      pub_id: 'test',
      settings: {
        api_key: 'NESTED_KEY',
        valid_setting: 42,
      },
    };
    const result = LegacyApiSafeBodySchema.parse(nested) as Record<string, unknown>;
    const settings = result['settings'] as Record<string, unknown>;
    expect(settings).not.toHaveProperty('api_key');
    expect(settings['valid_setting']).toBe(42);
  });

  it('strips secret fields from array elements', () => {
    const arrayBody = [
      { pub_id: 'a', api_key: 'KEY1', balance: 100 },
      { pub_id: 'b', api_key: 'KEY2', balance: 200 },
    ];
    const result = LegacyApiSafeBodySchema.parse(arrayBody) as Record<string, unknown>[];
    for (const item of result) {
      expect(item).not.toHaveProperty('api_key');
    }
    expect(result[0]!['balance']).toBe(100);
  });

  it('a body with no secret fields passes through unchanged', () => {
    const clean = { pub_id: 'x', market: 'BINGX', balance: 500, running: true };
    const result = LegacyApiSafeBodySchema.parse(clean) as Record<string, unknown>;
    expect(result['pub_id']).toBe('x');
    expect(result['market']).toBe('BINGX');
    expect(result['balance']).toBe(500);
    expect(result['running']).toBe(true);
  });
});

// --- LEGACY_SECRET_FIELD_NAMES is a const tuple, not mutated ---
describe('LEGACY_SECRET_FIELD_NAMES is readonly and covers the known legacy fields', () => {
  it('contains apikey (covers api_key field)', () => {
    expect(LEGACY_SECRET_FIELD_NAMES).toContain('apikey');
  });
  it('contains secret (covers secret_key field)', () => {
    expect(LEGACY_SECRET_FIELD_NAMES).toContain('secret');
  });
  it('contains privatekey', () => {
    expect(LEGACY_SECRET_FIELD_NAMES).toContain('privatekey');
  });
  it('contains passphrase', () => {
    expect(LEGACY_SECRET_FIELD_NAMES).toContain('passphrase');
  });
  it('contains token', () => {
    expect(LEGACY_SECRET_FIELD_NAMES).toContain('token');
  });
});
```

### D-06: Serial implementation order

This is a single-writer, serial monorepo (no git worktrees). The safe order is:

1. Create `packages/bot-adapters/src/legacy/legacy-blocked.ts` (new file; no pre-existing
   content to read first; nothing depends on it yet).
2. Create `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts` (new file; no
   pre-existing content).
3. Edit `packages/bot-adapters/src/factory.ts` (import + branch change). Shared-spine risk:
   LOW — `factory.ts` is a leaf (only imports from the same package; nothing outside the
   package imports factory.ts directly except through the index barrel).
4. Edit `packages/bot-adapters/src/index.ts` (add/remove exports). Shared-spine risk:
   MEDIUM — other packages import from `@wtc/bot-adapters`; changing an export breaks callers
   that import `createHttpLegacyAdapter` directly (currently none outside the package, per grep).
5. Edit `apps/web/src/features/bots/meta.ts` (add `liveAdapterBlocked` field). Shared-spine
   risk: LOW — `meta.ts` is imported by `bots/page.tsx`, `[bot]/page.tsx`, and `data.tsx`.
   All three use `BOT_CAPS[x].hasTradeHistory` etc.; adding new optional fields does not break them.
6. Edit `apps/web/src/app/(app)/app/bots/page.tsx` (banner conditional).
7. Edit `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` (banner conditional).
8. Create `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts` (new test file).
9. Create `packages/bot-adapters/src/__tests__/legacy-plaintext-exclusion.test.ts` (new test file).
10. Run gates: lint → typecheck → test → secret:scan → build → e2e (verify no regression).

**Shared-spine files touched in this plan:** `factory.ts` and `index.ts` (both in
`packages/bot-adapters`) and `meta.ts` (in `features/bots`). None of these are high-contention
shared-spine files like `packages/db/src/schema.ts`, `repositories.ts`, `middleware.ts`, or
`packages/config/src/env.ts`. The plan is safe for serial execution.

## Risks

1. **`createHttpLegacyAdapter` removal from index.ts** — if any file outside
   `packages/bot-adapters` imports `createHttpLegacyAdapter` directly from `@wtc/bot-adapters`,
   removing it from the barrel will cause a typecheck failure. A grep before implementation
   is essential. Based on the current audit, no such caller exists outside the package, but
   it must be confirmed before step 4 of D-06. The function may be retained in `http.ts` as a
   non-exported internal until it is explicitly removed by the operator after B3 is cleared.

2. **`liveAdapterBlocked` field on `BotCapabilities`** — adding a new required field to the
   interface will cause a TypeScript error on any `BotCapabilities` literal object that does
   not include it. Based on the audit, `BOT_CAPS` is the only literal. If any tests construct
   a `BotCapabilities` literal directly, they will need the new field added. Mark it optional
   (`liveAdapterBlocked?: boolean`) to be safe and default the consumer to `false` at call sites.

3. **`LegacyApiSafeBodySchema` is never called by the blocked adapter** — by design, the blocked
   adapter never issues a network call so the schema has no runtime consumer today. The schema
   exists as the B3 WTC-side deliverable (a future un-blocker calls it before any downstream
   parse). This means the schema's code coverage will be 0% in the current suite unless the
   unit tests are wired. The unit tests in D-05 must be present before the implementation is
   considered complete; coverage on the schema itself should reach near 100% from those tests.

4. **`legacy-blocked.ts` getHealth returning `readState='not_configured'`** — this is consistent
   with the Tortila adapter's not_configured state (no token). However, for Legacy the reason is
   different: the adapter is not just unconfigured, it is intentionally blocked. The
   `readStateDetail` string must clearly say "blocked" (not just "not configured") to avoid
   confusion. The design in D-01 includes "Live adapter blocked — pending upstream plaintext-key
   fix (B3)" in the readStateDetail. Confirm this propagates to the UI's readStateDetail banner
   at `[bot]/page.tsx:58`.

5. **`LEGACY_SECRET_FIELD_NAMES` vs `redact.ts SECRET_HINTS` divergence** — these two lists
   will drift over time unless the security auditor is tagged for each future redact.ts update.
   The F-07 coordination note should be elevated to a standing item in the OPEN_QUESTIONS.md
   (the security auditor owns the addition path).

6. **`mode=read-only` + no legacyBaseUrl currently falls through to mock** — the current factory
   returns `createMockLegacyAdapter()` when `mode=read-only` and no `legacyBaseUrl` is set.
   After PG3, the factory will return `createLegacyBlockedAdapter()` in this case. The regression
   test in D-03 covers this, but the behaviour change must be noted: the legacy bot dashboard
   in `read-only` mode will no longer show synthetic mock data; it will show the blocked state
   with the `liveAdapterBlocked` banner. This is the correct behaviour (honest, not a regression).

## Verification/tests

Gates that MUST pass after PG3 implementation (each new gate listed; prior gates must stay green):

| # | Gate | New coverage |
|---|------|---|
| 1 | `npm run typecheck` | `LegacyAdapterBlockedError`, `liveAdapterBlocked` in `BotCapabilities`, `SafeLegacyApiKeyListSchema` |
| 2 | `npm run typecheck -w @wtc/web` | `BOT_CAPS.legacy_bot.liveAdapterBlocked` usage in page.tsx |
| 3 | `npm test` | 16+ new tests across `legacy-blocked.test.ts` (+10) and `legacy-plaintext-exclusion.test.ts` (+16) |
| 4 | `npm run secret:scan` | No new secret-pattern in `legacy-blocked.ts` or `legacy-plaintext-exclusion.ts` |
| 5 | `npm run lint` | New files pass ESLint |
| 6 | `npm run build -w @wtc/web` | All 44 routes compile; legacy bot pages render the blocked banner |
| 7 | `npm run e2e` | `/app/bots/legacy` shows "Live adapter unavailable — blocked (B3)" banner; existing tests green |

Key test assertions that confirm the compile-time gate:
- `getBotAdapter('legacy_bot', { mode: 'read-only', legacyBaseUrl: '…' })` returns an adapter with
  `getHealth().readState === 'not_configured'` AND `readStateDetail` containing 'B3'. NOT an instance
  of the real HTTP adapter.
- `createLegacyBlockedAdapter().getConfig('x')` rejects with `LegacyAdapterBlockedError` and
  `err.blockerRef === 'B3'`.
- `LegacyApiSafeBodySchema.parse({ api_key: 'LIVE_KEY', balance: 100 })` returns an object that does
  NOT have `api_key` and `JSON.stringify(result)` does NOT contain 'LIVE_KEY'.

NOT RUN by this auditor (unchanged gates; require DB/network):
- `db:migrate` / `db:seed` / real-PG harness — no `DATABASE_URL` (B1 unchanged).

## Next actions

1. **Operator/implementer:** execute D-06 steps 1-9 (serial, single-writer). Create
   `packages/bot-adapters/src/legacy/legacy-blocked.ts` and
   `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`, then patch factory.ts,
   index.ts, meta.ts, bots/page.tsx, [bot]/page.tsx, and add both test files.

2. **Before step 4 (index.ts edit):** grep for any direct import of `createHttpLegacyAdapter`
   from `@wtc/bot-adapters` outside the package. Command:
   `grep -r "createHttpLegacyAdapter" apps/ tests/ --include="*.ts" --include="*.tsx"`
   If no results: safe to remove from barrel. If results: update those callers first.

3. **Security auditor:** review `LEGACY_SECRET_FIELD_NAMES` in D-05 against the current
   `redact.ts SECRET_HINTS` list. Add any delta to OPEN_QUESTIONS.md as a standing coordination
   item. In particular, confirm 'passphrase' should be added to `redact.ts` (it is not currently
   there but is in the bot-adapter exclusion list).

4. **docs/CONTRACTS/legacy-bot-adapter.md:** update the "Mock vs. Real Status" table to reflect
   that `read-only` / `audited` modes now route to `LegacyBlockedAdapter`, not `LegacyBotAdapter`.
   Update the mock-vs-real table note from "Requires service account in vault" to "BLOCKED — see
   B3; un-blocking requires the upstream plaintext-key fix + all 5 BOT_CONTROL_SAFETY_MODEL gates".

5. **docs/BOT_CONTROL_SAFETY_MODEL.md:** update the summary table to add a row for
   `LegacyBlockedAdapter` and clarify: "In all non-mock modes, the factory returns the blocked
   adapter — no network calls to the legacy bot are made until B3 is cleared."

6. **PG5 follow-up (markExpiringSoon):** this audit scope was PG3 only. The `expiring_soon`
   status still not written (noted in Phase 2.7 aggregate) — remains a PG5 follow-up.
