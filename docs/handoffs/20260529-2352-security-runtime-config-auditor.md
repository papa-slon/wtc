# security-runtime-config-auditor — Phase 1.7 (Part E)

Date: 2026-05-29 23:52
Auditor: security-runtime-config-auditor (READ-ONLY)
Working dir: C:\Users\maxib\GTE BOT\wtc_ecosystem_platform

## Scope
Ensure the planned DB-wiring of the EXISTING TradingView web UI (and optional LMS) stays fail-closed and leaks no secrets, and confirm runtime-config truth for Part A. Specifically:
1. The EXACT fail-closed guard the new DB-backed `tvService`/`lmsService` selector must use (mirror the core `guard()`), and the precise current gap.
2. Audit-row content rules for TV submit/grant/revoke: confirm no TradingView credentials/secrets are written (and that the TV *username* is not a secret), and the `redact()` + in-transaction audit pattern to follow.
3. Part A runtime truth: that `instrumentation.ts` calls `loadEnv()` at boot; that `SECRET_VAULT_KEK` is base64-32 (not hex); and whether `vault.ts` reads env directly vs receives the KEK as an argument (so the `SECRET_VAULT_DESIGN.md` wording can be corrected truthfully).
4. Confirm no NEW env var is introduced without `loadEnv` validation.

This is read-only. No npm/tests/builds/git were run.

## Files inspected
- apps/web/src/lib/backend.ts (lines 1-78) — selector + `guard()`/`denied` pattern; `tvService`/`lmsService` at 48-51.
- apps/web/src/lib/db-store.ts (lines 1-108) — DB core accessors; vault seal at 91; keyId env at 99.
- apps/web/src/lib/vault.ts (lines 1-18) — lazy vault; `parseKek(kekB64)` at 16.
- apps/web/instrumentation.ts (lines 1-15) — boot `loadEnv()` under `NEXT_RUNTIME === 'nodejs'`.
- packages/crypto/src/vault.ts (lines 1-157) — `parseKek(base64)` at 50-61 (takes KEK as ARGUMENT); `createSecretVault` 101; `maskSecret` 154.
- packages/config/src/env.ts (lines 1-87) — `loadEnv` 73; `SECRET_VAULT_KEK` min(16) at 20 + base64-32 superRefine 43-45.
- packages/audit/src/audit.ts (lines 1-109) — `AUDIT_ACTIONS` (incl. `tradingview.grant`/`.revoke` 19-20); `buildEvent` redacts before/after 73-74; console writer fail-closed in prod 99.
- packages/audit/src/redact.ts (lines 1-38) — `SECRET_HINTS` 5-19; `isSecretKey` 23; `redact` 29.
- packages/shared/src/env-guards.ts (lines 35-70) — `isWeakSecret` 35, `isBase64Key` 45, `requiredSecret` 55.
- packages/db/src/repositories.ts (lines 120-254) — `grantProduct`/`revokeProduct` write audit in-txn 143/153; `auditRowValues` 193-210; `createDbAuditWriter` 212; **TV repo 224-254: `submitTvRequest` 228, `grantTv` 239, `revokeTv` 242 write NO audit row.**
- packages/db/src/schema.ts (lines 10-12, 145-165) — `createdAt()` = `timestamp(...).defaultNow().notNull()` (Date) 11; `tradingviewAccessRequests.requestedAt = createdAt()` 153.
- packages/tradingview-access/src/index.ts (lines 1-107) — `TvAccessRequest.requestedAt: number` 13; `TvAccessService.submitRequest/grant/revoke` 58/71/79.
- apps/web/src/lib/demo.ts (lines 15, 46-75, 180-212) — memory tv/lms services; exemplar audit calls; exchange-key audit writes only `{exchange, keyMask}` at 210.
- apps/web/src/app/admin/tradingview-access/page.tsx (lines 1-68) — `grantAction`/`revokeAction` call `tvService` with NO `audit.write` 16/24.
- apps/web/src/app/(app)/app/indicators/page.tsx (lines 18, 31-58) — `tvService.submitRequest` with NO `audit.write` 18; UI renders `fmtDate(r.requestedAt)` 58.
- docs/SECRET_VAULT_DESIGN.md (lines 1-252) — design doc; stale env-var-keyed-KEK wording 44-72, 133-205.
- (grep) apps/web/src/** for `process.env.` — full env-var inventory; `tradingview.grant|revoke` app-code search returned only the enum + build artifacts (no writer).

## Files changed
None — read-only audit

## Findings

### 1. [HIGH] DB-backed tvService/lmsService selector MUST use the same fail-closed `guard()` as core — current selector is unconditionally memory (the gap)
Evidence: apps/web/src/lib/backend.ts:48-51 —
```ts
export const tvService = memory.tvService;
export const tvStore = memory.tvStore;
export const lmsService = memory.lmsService;
export const lmsStore = memory.lmsStore;
```
These bind to `memory` UNCONDITIONALLY, bypassing `useDb`/`denied`/`guard()` (defined 16-27). Core accessors are each wrapped: `export const grantProduct = guard(core.grantProduct)` (32-45) and `core = useDb ? dbStore : memory` (20). So once the TV/LMS web UI is moved onto the DB repos, production-without-DATABASE_URL would still silently serve the in-memory store for TV/LMS — the exact failure the core guard exists to prevent (5, 17-19, 25).

Note the shape obstacle the operator must solve: `tvService` is a *class instance* (`new TvAccessService(store)`, demo.ts:73) with methods, and `tvStore` is an object of methods (index.ts:30-37). `guard()` wraps a single function `(...args) => R` (22). You cannot wrap an instance by passing it to `guard()`. Two correct options:

- Option A (preferred — mirror core exactly): introduce a DB-backed module (e.g. `tv-store.ts`) exposing the SAME function surface as the memory `tvService`/`tvStore`, then select + guard each function individually, exactly like core (20, 32-45):
  ```ts
  // backend.ts — mirrors the core pattern
  import * as tvMemory from './tv-memory';   // wraps memory.tvService/tvStore as flat fns
  import * as tvDb from './tv-store';         // new: backed by @wtc/db submitTvRequest/grantTv/revokeTv/listTv...
  const tv = useDb ? tvDb : tvMemory;
  export const tvSubmitRequest = guard(tv.submitRequest);
  export const tvGrant         = guard(tv.grant);
  export const tvRevoke        = guard(tv.revoke);
  export const tvList          = guard(tv.list);
  // identical treatment for LMS if LMS is wired this phase
  ```
- Option B (minimal, if call sites must keep `tvService.method(...)`/`tvStore.list(...)`): keep the object/instance shape but make the *production-without-DB* binding a denied stub that throws on every method, and otherwise select the DB- or memory-backed object:
  ```ts
  const DENIED_TV = new Proxy({}, { get() { return () => { throw new Error('[backend] DATABASE_URL is required in production — refusing to use the in-memory store'); }; } });
  export const tvService = denied ? (DENIED_TV as typeof memory.tvService) : (useDb ? dbStore.tvService : memory.tvService);
  export const tvStore   = denied ? (DENIED_TV as typeof memory.tvStore)   : (useDb ? dbStore.tvStore   : memory.tvStore);
  ```
  The throw message MUST be byte-identical to the core guard string (backend.ts:25) so behaviour/observability match. The `audit` export already demonstrates the denied-stub idiom for a non-function export (45).

Recommendation: Adopt Option A (flat guarded functions) to mirror core precisely; this is the lowest-ambiguity fail-closed contract. If the team keeps the object shape, Option B is acceptable but the denied stub MUST throw the same message. Either way, the post-wiring invariant is: production && !DATABASE_URL ⇒ every TV/LMS mutation and read throws, never touches memory. Target Part: B (TV wiring), and G if LMS is wired the same phase.

### 2. [HIGH] DB TV repos do NOT write an audit row — submit/grant/revoke must audit in the SAME transaction (mirror grantProduct/revokeProduct)
Evidence: packages/db/src/repositories.ts —
- `submitTvRequest` 228-232, `grantTv` 239-241, `revokeTv` 242-244 each perform a bare `insert`/`update` with NO `auditLogs` write and NO `db.transaction`.
- Contrast `grantProduct` 127-145 and `revokeProduct` 147-155, which wrap the mutation AND `tx.insert(s.auditLogs).values(auditRowValues({...}))` in ONE `db.transaction` (comment 124-126: "the entitlement mutation AND the audit row are written in ONE transaction"). `auditRowValues` 193-210 runs `buildEvent` (redacts before/after) and maps to the row.
- The audit enum already reserves `tradingview.grant` and `tradingview.revoke` (audit.ts:19-20) but a project-wide search for those action strings in app code found only the enum definition (build artifacts aside) — i.e. they are currently UNUSED; no TV event is ever audited today.
- The current memory web UI also writes no TV audit: admin/tradingview-access/page.tsx grantAction/revokeAction 11-26 and indicators/page.tsx:18 call `tvService.*` with no `audit.write`. (This is a pre-existing gap, not introduced by the wiring — but the DB wiring is the moment to fix it because the in-txn pattern is only available in the repo.)

Recommendation: When DB-wiring TV, add the audit insert INSIDE the repo transaction, exactly like grant/revokeProduct. Suggested actions/targets (`tradingview.submit` is NOT yet in the enum — either add it, or record submit under `admin.action`/skip; grant/revoke already exist):
```ts
export async function grantTv(db, requestId, adminId, now, durationMs) {
  await db.transaction(async (tx) => {
    await tx.update(s.tradingviewAccessRequests).set({ status:'granted', grantedAt:new Date(now), grantedBy:adminId, expiresAt:new Date(now+durationMs) }).where(eq(s.tradingviewAccessRequests.id, requestId));
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: adminId, actorRole:'admin', action:'tradingview.grant', targetType:'tradingview_access_request', targetId: requestId, after:{ status:'granted' } }));
  });
}
// revokeTv: same shape, action:'tradingview.revoke', after:{ status:'revoked' }; and _adminId/_now (currently unused, 242) become used.
```
Note `revokeTv` currently ignores `_adminId`/`_now` (242) — auditing requires capturing the admin actor, so those params must become live. Target Part: B (and G for LMS material changes via `education.material_change`, audit.ts:21).

### 3. [INFO/LOW] Audit-row content rules: no TV credential/secret is written; the TV username is NOT a secret; redact() is a backstop only
Evidence:
- A TradingView access request stores only `userId`, `tradingViewUsername`, `status`, timestamps, `grantedBy` (schema.ts:148-157; repo 228-244). There is NO TradingView password/API token in the model — TV access is an admin grant queue keyed by the user's public TradingView handle (design doc 16, index.ts header 2-4). The username is a public identifier, not a secret; it is the legitimate target identity of the grant and is fine to store and to reference in audit (analogous to recording an email as `targetId`, e.g. login_failed actions.ts:28).
- `redact()` would NOT redact a field literally named `username`/`tradingViewUsername` (SECRET_HINTS 5-19 has no "user"/"name" entry; `isSecretKey` 23 substring match), which is correct — the username should remain visible in the audit `after`/target.
- The established secret-safety pattern to follow is exchange keys: demo.ts:208-210 deliberately puts only `{ exchange, keyMask }` into the audit `after` ("never put raw key material into the audit input … redaction is a backstop, not the primary control"); the DB path constructs the sealed blob and persists only `keyMask`+sealed (db-store.ts:91-100; repo 167-181 never returns sealed material; listExchangeKeys never joins secrets, repo 186). `buildEvent` redacts before/after on the way in (audit.ts:73-74) as defence-in-depth.

Recommendation: For TV audit rows write only non-secret fields — `targetId = requestId` (a UUID) and `after = { status }` (and optionally the non-secret `tradingViewUsername`). Do NOT invent any secret-bearing field. Keep the "minimal explicit payload + redact() backstop" discipline. This matches design doc 240 ("Audit log — NEVER include any key field — audit entries reference secret_id (UUID) only"). Target Part: B, G.

### 4. [INFO] Part A confirmed: instrumentation.ts calls loadEnv() at boot (Node runtime only)
Evidence: apps/web/instrumentation.ts:10-14 — `register()` does `if (process.env.NEXT_RUNTIME === 'nodejs') { const { loadEnv } = await import('@wtc/config'); loadEnv(); }`. `loadEnv` (env.ts:73-82) safe-parses the schema and throws a redacted, key-name-only error on failure (77-78). This is Phase-1.6.1 boot validation; the lazy vault (`parseKek` + `requiredSecret`, vault.ts:14-16) remains the runtime backstop (instrumentation.ts:6-8). Accurate for Part A.
Recommendation: Part A wording may state, truthfully: "the typed env is validated at server boot via `instrumentation.ts` → `loadEnv()` (Node runtime only); the lazy vault is defence-in-depth." Target Part: A.

### 5. [INFO] Part A confirmed: SECRET_VAULT_KEK is base64-32 (NOT hex), enforced at both config-load and vault parse
Evidence:
- env.ts:20 declares `SECRET_VAULT_KEK: z.string().min(16, '… base64 32-byte key')`, and the superRefine 43-45 calls `isBase64Key(data.SECRET_VAULT_KEK, 32)` rejecting anything that does not decode to exactly 32 bytes (comment 40-42: "a hex KEK or any wrong-length key is rejected here, at boot").
- `isBase64Key` (env-guards.ts:45-53) requires canonical base64 charset and `Buffer.from(v,'base64').length === bytes`. Its doc (40-44) explicitly notes a hex KEK of wrong decoded length is rejected and that it mirrors `parseKek`.
- `parseKek` (crypto/vault.ts:50-61) decodes base64 and throws unless `buf.length === 32`. So a 64-char hex string (decodes to 48 bytes under base64) fails at both layers.
Recommendation: Part A may assert: "SECRET_VAULT_KEK MUST be a base64-encoded 32-byte key (44 chars), validated identically by `@wtc/shared isBase64Key` at config load and `@wtc/crypto parseKek` at vault use. Hex is rejected." Target Part: A.

### 6. [INFO/LOW] Part A correction: parseKek takes the KEK as an ARGUMENT; it does NOT read env. SECRET_VAULT_DESIGN.md wording is stale on this point.
Evidence:
- `parseKek(base64: string): Buffer` (crypto/vault.ts:50) and `createSecretVault(active: VaultKey, ...)` (101) take the key material as parameters — `@wtc/crypto` reads NO env var. Env reading happens in the app layer: apps/web/src/lib/vault.ts:14 `requiredSecret('SECRET_VAULT_KEK', process.env.SECRET_VAULT_KEK, DEV_ONLY_KEK)` then `parseKek(kekB64)` (16) and `keyId = process.env.SECRET_VAULT_KEY_ID || 'kek-dev'` (15).
- docs/SECRET_VAULT_DESIGN.md is INCONSISTENT with the implementation: it says the KEK is "stored in env var WTC_VAULT_KEK_{keyId}" (44-45, 138, 145-147), that the module "reads a second env var WTC_VAULT_ACTIVE_KEY_ID" (153-157), and the VaultRecord uses hex iv/tag/wrappedDek/ciphertext fields (78-90). The real env var is `SECRET_VAULT_KEK` (+ `SECRET_VAULT_KEY_ID`), the vault takes the KEK as an argument, and the real `SealedSecret` uses base64 `wrappedDek`/`payload` (crypto/vault.ts:31-42) — not hex `ciphertext`/`iv`/`tag`. (The doc already carries partial corrections at 67 and 141-143 acknowledging base64-32, but the env-var-keyed-KEK + "module reads env" + hex-record claims remain.)
Recommendation (Part A wording, truthful): "`@wtc/crypto`'s `parseKek`/`createSecretVault` receive the KEK as a function ARGUMENT and read no environment; the app's `apps/web/src/lib/vault.ts` is the only place that reads `SECRET_VAULT_KEK`/`SECRET_VAULT_KEY_ID` from env and injects the parsed KEK." The design doc's `WTC_VAULT_KEK_*`/`WTC_VAULT_ACTIVE_KEY_ID` naming and hex `VaultRecord` are outdated and should be reconciled to `SECRET_VAULT_KEK` + base64 `SealedSecret` in a docs pass (out of scope for this read-only audit; flag for the doc owner). Target Part: A.

### 7. [INFO] No NEW env var is introduced; every env var the web app reads is covered by loadEnv (except two intentional non-secret runtime knobs)
Evidence: grep of `process.env.` across apps/web/src found exactly: `DATABASE_URL` (backend.ts:16, db-store.ts:35), `NODE_ENV` (backend.ts:19, actions.ts:16, session.ts:9, login/page.tsx:10), `SECRET_VAULT_KEK`/`SECRET_VAULT_KEY_ID` (vault.ts:14-15, db-store.ts:99), `SESSION_SECRET` (csrf.tsx:11), `AXIOMA_*` (terminal/page.tsx:14-16), `BOT_ADAPTER_MODE`/`TORTILA_*`/`LEGACY_*`/`AXIOMA_BRIDGE_API_TOKEN` (server-config.ts:6-20). All of these are declared in `envSchema` (env.ts:13-38). No TV/LMS-specific env var exists, and the planned wiring needs none (TV/LMS config is data, not env). `SECRET_VAULT_KEY_ID` is read directly with an `|| 'kek-dev'` default (vault.ts:15, db-store.ts:99) but it IS in the schema (env.ts:21, default 'kek-dev') so loadEnv validates it; it is a non-secret identifier.
Recommendation: Maintain the invariant — if the TV/LMS wiring ever needs a new env var (it should not), add it to `envSchema` (env.ts:13-38) FIRST so `loadEnv` validates it at boot; never read a raw `process.env.X` that the schema does not know. No action needed for the current plan. Target Part: A (with B/G as the surface to keep clean).

## Decisions
- LMS approach is the operator's Option-1/Option-2 call; from a security/runtime standpoint, IF LMS is DB-wired this phase it MUST receive the SAME guarded fail-closed selector as TV (Finding 1) and its material-change mutations SHOULD audit via `education.material_change` (audit.ts:21) in-txn (Finding 2/3). IF LMS stays in-memory, it must NOT be presented as DB-backed and the admin/education pages should keep the explicit "in-memory (demo)" badge (as the TV page does, admin/tradingview-access/page.tsx:40-41) so the runtime-config truth is not overstated.

## Risks
- R1 (HIGH, fail-closed regression): Wiring TV/LMS to the DB while leaving backend.ts:48-51 as unconditional `memory.*` would make a production-without-DATABASE_URL deployment silently serve the in-memory TV/LMS store — defeating the core guard. Must land the guard in the SAME change as the wiring (Finding 1).
- R2 (HIGH, accountability): TV grant/revoke currently produce NO audit trail (Finding 2). If wired without the in-txn audit insert, admin grant/revoke of indicator access remains unauditable in Postgres — a compliance gap for the highest-trust admin action in this feature.
- R3 (LOW, type mismatch — same class the prior 1921 handoff flagged): in-memory `TvAccessRequest.requestedAt: number` (tradingview-access/index.ts:13) vs DB `tradingviewAccessRequests.requestedAt = createdAt()` which Drizzle types as `Date` (schema.ts:11,153). UI consumes a number (`fmtDate(r.requestedAt)`, indicators/page.tsx:58; `fmtDate(r.expiresAt ?? null)`, admin/tradingview-access/page.tsx:53). The DB-backed adapter MUST normalize `Date → number` (`.getTime()`) at the boundary — exactly as `recentAuditEvents` already does for audit rows (`r.ts.getTime()`, backend.ts:71). This is a correctness risk, not a security one, but a botched normalization would surface as NaN/Invalid Date in the admin queue. (Confirmed against the live files — the prior handoff's claim is accurate here.)
- R4 (LOW, security-adjacent): `submitTvRequest` does not enforce the entitlement gate; the memory `TvAccessService.submitRequest` does (throws if `!hasIndicatorEntitlement`, index.ts:58-59) and the web UI passes `access.allowed` (indicators/page.tsx:18). When wiring, the fail-closed entitlement check MUST remain at the call site (or be added to the repo); do not lose it by calling the bare repo `submitTvRequest` directly without the gate.

## Verification/tests
- No tests/builds/git were run (read-only mandate). All claims verified by reading the cited file:line.
- Cross-checks performed: (a) `guard()`/`denied`/`core` selection (backend.ts:16-45) vs the unconditional TV/LMS exports (48-51); (b) in-txn audit in grant/revokeProduct (repositories.ts:124-155) vs its absence in submitTvRequest/grantTv/revokeTv (228-244); (c) `tradingview.grant|revoke` action strings appear only in the enum (audit.ts:19-20) — no writer in app code; (d) `createdAt()` resolves to a `Date` column (schema.ts:11) consumed as a number in the UI (indicators/page.tsx:58); (e) `parseKek` signature takes a base64 string argument (crypto/vault.ts:50) and the app injects env (vault.ts:14-16); (f) env-var inventory in apps/web/src all present in `envSchema` (env.ts:13-38).
- Suggested gates for the operator AFTER implementing (not run here): a unit/contract test asserting that with `NODE_ENV=production` and no `DATABASE_URL`, every `tv*`/`lms*` export throws the core guard message; and an integration test asserting `grantTv`/`revokeTv` produce a `tradingview.grant`/`.revoke` audit row in the same transaction and contain no secret fields.

## Next actions
1. (Part B, HIGH) In apps/web/src/lib/backend.ts, replace the unconditional `tvService/tvStore/lmsService/lmsStore = memory.*` (48-51) with the guarded selector from Finding 1 (Option A preferred: flat `guard()`-wrapped functions backed by `useDb ? tvDb : tvMemory`). Post-condition: production && !DATABASE_URL ⇒ every TV/LMS call throws the exact core message (backend.ts:25).
2. (Part B, HIGH) In packages/db/src/repositories.ts, wrap `grantTv`/`revokeTv` (and `submitTvRequest` if a submit event is desired) in `db.transaction` and add `tx.insert(s.auditLogs).values(auditRowValues({...}))` with actions `tradingview.grant`/`tradingview.revoke` (already in the enum), `targetId = requestId`, `after = { status }`. Make `revokeTv`'s currently-unused `_adminId`/`_now` (242) live so the admin actor is captured. Add `tradingview.submit` to `AUDIT_ACTIONS` (audit.ts:8-23) ONLY if submit should be audited.
3. (Part B, LOW) In the DB-backed TV adapter, normalize `requestedAt`/`grantedAt`/`expiresAt` from `Date` → number (`.getTime()`) at the boundary so the existing UI (`fmtDate`, indicators/page.tsx:58 + admin/tradingview-access/page.tsx:53) keeps working — mirror `recentAuditEvents` (backend.ts:71).
4. (Part B, LOW) Preserve the fail-closed entitlement gate at the submit call site (indicators/page.tsx:18 passes `access.allowed`); do not bypass it by calling the bare repo `submitTvRequest`.
5. (Part G) If LMS is DB-wired this phase, apply 1-2 to LMS (guarded selector + `education.material_change` in-txn audit). If LMS stays in-memory, keep the explicit "in-memory (demo)" UI badge and do not describe it as persisted.
6. (Part A, docs) Correct Part A runtime-config wording per Findings 4-6: boot `loadEnv()` is real (instrumentation.ts:10-14); `SECRET_VAULT_KEK` is base64-32 not hex (env.ts:20,43-45); `parseKek` takes the KEK as an ARGUMENT and `@wtc/crypto` reads no env (crypto/vault.ts:50; vault.ts:14-16). Separately flag to the SECRET_VAULT_DESIGN.md owner that its `WTC_VAULT_KEK_*`/`WTC_VAULT_ACTIVE_KEY_ID` env naming and hex `VaultRecord` (doc 44-90,138-205) are stale vs the implemented `SECRET_VAULT_KEK` + base64 `SealedSecret`.
7. (Part A, invariant) Do not add any new env var for TV/LMS. If one becomes unavoidable, add it to `envSchema` (env.ts:13-38) before any `process.env` read, so `loadEnv` validates it at boot.
