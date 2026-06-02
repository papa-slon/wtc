# ecosystem-axioma-bridge-auditor handoff

**Epoch:** 20260530-2230
**Agent:** ecosystem-axioma-bridge-auditor
**Workstream:** W7 — PG6 Axioma non-blocked surface (read-only audit; agents-before-edits)

---

## Scope

Read-only audit for PG6 focused on:
- ES256 signer wiring design: how `createEs256Signer` enters `bridge.ts` without making the package
  impure (no `@wtc/config`, no `process.env` inside the package).
- Precise factory shape: `resolveHandoffSigner` / `createAxiomaBridge(opts)` design proposal.
- STAGING+PROD fence semantics (not only prod-fenced — the current HS256 fence is production-only).
- CTA/hard-boundary discipline (all three CTAs stay disabled; no live consumer exists today).
- jti store seam: mapping `consumeJti`/`recordJti` onto the existing `isReplayed` callback in es256.ts,
  and onto `AXIOMA_HANDOFF_TOKEN_SPEC.md §Replay Prevention`.
- Contract doc / INTEGRATION_MAP truth fixes needed.
- Audit action codes: missing jti lifecycle codes in `@wtc/audit`.

---

## Files inspected

| File | Lines |
|------|-------|
| `docs/handoffs/0000-orchestrator-seed.md` | all |
| `docs/SESSION_PROTOCOL.md` | all |
| `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md` | all |
| `docs/CONTRACTS/axioma-bridge.md` | all (v1.1.0) |
| `docs/PRODUCTION_BLOCKERS.md` | B4 row |
| `docs/EXECUTION_PLAN_MASTER.md` | W7 / PG6 row |
| `docs/ROADMAP_MASTER.md` | §6 Axioma/Terminal |
| `docs/INTEGRATION_MAP.md` | §6.2 + §7.1 table |
| `docs/handoffs/20260530-2100-phase-2-8-legacy-gate-billing-scaffold-tv-expiring.md` | latest aggregate |
| `docs/handoffs/20260530-1355-ecosystem-axioma-bridge-auditor.md` | previous bridge audit |
| `packages/axioma-bridge/src/bridge.ts` | 1–100 |
| `packages/axioma-bridge/src/handoff.ts` | 1–99 |
| `packages/axioma-bridge/src/es256.ts` | 1–90 |
| `packages/axioma-bridge/src/jwks.ts` | 1–14 |
| `packages/axioma-bridge/src/index.ts` | 1–22 |
| `packages/axioma-bridge/src/__smoke__.ts` | 1–39 |
| `packages/axioma-bridge/src/es256.test.ts` | 1–83 |
| `packages/axioma-bridge/src/handoff.test.ts` | 1–50 |
| `packages/axioma-bridge/package.json` | all |
| `packages/config/src/env.ts` | all |
| `packages/db/src/schema.ts` | 1–15, 146–155, 529–620+ |
| `packages/db/src/repositories.ts` | 871–908 (Axioma section) |
| `packages/db/migrations/0003_fresh_blockbuster.sql` | all |
| `packages/audit/src/audit.ts` | axioma lines |
| `apps/web/src/app/(app)/app/terminal/page.tsx` | 1–224 |
| `apps/web/src/features/terminal/loader.ts` | 1–114 |
| `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` | 1–26 |
| `apps/web/src/lib/server-config.ts` | all |

---

## Files changed

None — read-only audit

---

## Findings

### Finding 1 — HIGH — HS256 fence is production-only; STAGING also requires ES256 per PG6 goal

**Evidence:** `packages/axioma-bridge/src/handoff.ts:62`

```typescript
if (process.env.NODE_ENV === 'production') {
  throw new Error('[axioma-handoff] HS256 dev-stub signer is disabled in production; ...');
}
```

The fence only guards `NODE_ENV === 'production'`. The PG6 goal and `PRODUCTION_BLOCKERS.md` B4 item 3
explicitly state: "staging+prod fenced — NOT only prod-fenced." There is no `staging` value in the
`NODE_ENV` enum (`packages/config/src/env.ts:14`: enum is `'development' | 'test' | 'production'`).
This means there is no mechanism today to detect a staging deployment and enforce ES256.

The correct solution is NOT to add a `staging` value to `NODE_ENV` (that would break the config schema
and env.ts superRefine logic). Instead, the fence should be resolved via the `deploymentEnv` parameter
passed into the bridge factory — see the Design Recommendation below for the exact approach.

The current test at `handoff.test.ts:39–48` asserts the guard throws for `NODE_ENV==='production'` which
is correct as a unit test. The gap is that a staging deployment (`NODE_ENV=production` is customary for
staging, OR staging runs with `NODE_ENV=development`) may bypass the guard unless the factory explicitly
enforces it.

**Recommendation:** Replace the `process.env.NODE_ENV` check inside `handoff.ts` with a parameter-driven
fence. The `signHandoffToken` function should accept (or the bridge factory should enforce) a
`deploymentEnv: 'development' | 'staging' | 'production'` value that is resolved at the web/server layer
and injected. This value is separate from `NODE_ENV` — it represents the deployment environment, not
Node's runtime mode. In both staging and production, the HS256 stub must throw and the ES256 path must
be used. See Design Recommendation for the `resolveHandoffSigner` factory shape.

**Target Workstream:** W7 / PG6

---

### Finding 2 — HIGH — No `resolveHandoffSigner` factory; `createEs256Signer` is NOT wired into bridge.ts

**Evidence:** `packages/axioma-bridge/src/bridge.ts:6` imports `signHandoffToken` from `./handoff.ts`
(the HS256 dev-stub). `createEs256Signer` from `./es256.ts` is exported from `index.ts` but is never
imported or called inside `bridge.ts`. The `createMockAxiomaBridge` factory at line 71 takes
`signingSecret: string` (an HS256 secret) in its `MockBridgeOptions`. There is no
`createAxiomaBridge(opts)` or any overload that accepts an ES256 signer.

The `es256.ts` module is well-written and ready; the gap is entirely in the wiring layer (bridge.ts +
a factory that selects the correct signer). The web layer (`loader.ts`, `server-config.ts`) reads
`AXIOMA_HANDOFF_SIGNING_KEY` from `process.env` directly (correctly — the web layer is allowed to read
env), but there is no code path that passes a resolved signer from the web layer into the bridge.

This is the primary PG6 code gap. The design below specifies the exact fix.

**Target Workstream:** W7 / PG6

---

### Finding 3 — HIGH — No `axioma_handoff_jti_revocations` table; no migration 0004; no `consumeJti`/`recordJti` repository functions

**Evidence:** `packages/db/migrations/` contains 0000–0003 only. `packages/db/src/schema.ts` has no
`axiomaHandoffJtiRevocations` export. `packages/db/src/repositories.ts` axioma section (lines 871–908)
has `getCurrentTerminalRelease`, `upsertTerminalRelease`, `recordDownloadEvent`, `recordLicenseEvent`
— no jti functions.

`AXIOMA_HANDOFF_TOKEN_SPEC.md §Replay Prevention` specifies the DDL and the consume semantics
(atomic UPDATE WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at > now(); 0 rows → reject).
The spec also lists a worker cleanup job (delete rows where expires_at < now() - 1 hour).

The `es256.ts` `isReplayed?: (jti: string) => boolean` callback seam exists and is ready. It needs to
be backed by the durable store once the table lands in migration 0004.

This is a DB-wave prerequisite for PG6 and must be the first step of the serial implementation.

**Target Workstream:** W7 / PG6 — DB wave first

---

### Finding 4 — MEDIUM — `packages/config/src/env.ts` has `AXIOMA_HANDOFF_SIGNING_SECRET` (HS256) but not `AXIOMA_HANDOFF_SIGNING_KEY` / `AXIOMA_HANDOFF_KEY_ID` (ES256)

**Evidence:** `packages/config/src/env.ts:36–37` defines:
```typescript
AXIOMA_HANDOFF_SIGNING_SECRET: z.string().min(16).optional(),
AXIOMA_HANDOFF_AUDIENCE: z.string().default('axi-o.ma'),
```
and the production `superRefine` at line 68–73 enforces `AXIOMA_HANDOFF_SIGNING_SECRET` is present and
strong in production.

By contrast, `AXIOMA_HANDOFF_SIGNING_KEY` (the ES256 private key PEM) and `AXIOMA_HANDOFF_KEY_ID`
(the kid string) are read directly from `process.env` in:
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts:13–14`
- `apps/web/src/features/terminal/loader.ts:93`

These two env vars are NOT in the `@wtc/config` schema, so they receive no production validation
(no `isWeakSecret` check, no required-in-prod guard). When the ES256 path is activated in staging/prod,
both `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` must be treated as required secrets.

Additionally, `AXIOMA_HANDOFF_SIGNING_SECRET` (HS256) should become explicitly disallowed in production
once the ES256 path is wired — the two vars represent competing signing paths and only one should be
active in a given deployment environment.

**Recommendation:** When migration 0004 lands and the signer factory is built, add
`AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` to the `env.ts` schema (optional overall,
required in `deploymentEnv !== 'development'`). The `@wtc/config` package must NOT be imported from
inside `packages/axioma-bridge` (purity rule); env resolution remains the web/server layer's
responsibility. The factory receives already-resolved values.

**Target Workstream:** W7 / PG6

---

### Finding 5 — MEDIUM — Missing jti lifecycle audit action codes in `@wtc/audit`

**Evidence:** `packages/audit/src/audit.ts` lines 65–70 define:
```
'axioma.account_link_init'
'axioma.account_link_complete'
'axioma.account_link_revoke'
'axioma.download_request'
'axioma.release_publish'
```

`AXIOMA_HANDOFF_TOKEN_SPEC.md §Audit Events Emitted` specifies three additional lifecycle codes:
```
'axioma.account_link.jti.consume'  — token consumed at WTC (Option A)
'axioma.account_link.jti.replay'   — replay attempt detected
'axioma.account_link.jti.revoke'   — token revoked (admin or entitlement revoke)
```

These codes do NOT exist in the audit module. The `consumeJti` repository function (Finding 3) will
need to emit `axioma.account_link.jti.consume` and `axioma.account_link.jti.replay` audit rows.
The admin revoke path needs `axioma.account_link.jti.revoke`.

Note: The spec also mentions `axioma.account_link.complete` (confirmed by Axioma callback); this is
covered by the existing `axioma.account_link_complete` code with a minor name difference (underscore
vs dot separator). Both should be reconciled to one canonical separator style (dots recommended for
consistency with the spec).

**Recommendation:** Add the three missing jti audit codes when the `consumeJti` repository is built.
This is additive to the audit codes array and does not require a schema migration.

**Target Workstream:** W7 / PG6

---

### Finding 6 — MEDIUM — `INTEGRATION_MAP.md §6.2` JWKS path is still stale

**Evidence:** `docs/INTEGRATION_MAP.md:319` (confirmed still present):
```
JWKS public endpoint published at `/api/axioma/.well-known/jwks.json`
```

The actual route is at `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`, resolving to
`/.well-known/axioma-jwks.json`. This stale reference was flagged in the previous two bridge-auditor
handoffs (20260530-0925 and 20260530-1355) and has not been corrected. It is purely a doc error but
represents a risk during Axioma integration if the wrong URL is communicated to the Axioma team.

**Recommendation:** Update `docs/INTEGRATION_MAP.md §6.2` row "Handoff signer" to replace
`/api/axioma/.well-known/jwks.json` with `/.well-known/axioma-jwks.json`. This is the third time
this finding has been raised; it should be fixed in the PG6 documentation pass.

**Target Workstream:** W7 / PG6

---

### Finding 7 — MEDIUM — `INTEGRATION_MAP.md §6.2` uses stale env var name `AXIOMA_BRIDGE_URL` for bridge activation

**Evidence:** `docs/INTEGRATION_MAP.md:321–322`:
```
Bridge activation: `AxiomaBridgeAdapter` promoted from mock to real when `AXIOMA_BRIDGE_URL` is set
Mock-vs-real: `AXIOMA_BRIDGE_URL` absent → `MockAxiomaBridge`; present → real HTTPS calls to `axi-o.ma`
```

The actual env var in `packages/config/src/env.ts:35–36` is `AXIOMA_BRIDGE_API_TOKEN` (not
`AXIOMA_BRIDGE_URL`). The `axiomaBridgeIsDev()` function in
`apps/web/src/lib/server-config.ts:22` also uses `AXIOMA_BRIDGE_API_TOKEN`. The INTEGRATION_MAP §6.2
was written at an earlier phase and was never updated to reflect the final env var name.

**Recommendation:** Update `docs/INTEGRATION_MAP.md §6.2` "Bridge activation" and "Mock-vs-real" rows
to use `AXIOMA_BRIDGE_API_TOKEN` (not `AXIOMA_BRIDGE_URL`).

**Target Workstream:** W7 / PG6

---

### Finding 8 — LOW — CTA discipline confirmed: all three CTAs remain disabled dev-placeholders; no live consumer

**Evidence:** `apps/web/src/app/(app)/app/terminal/page.tsx`

- Download button (line 162–172): `disabled={isDev}` when `access.allowed`, ghost-disabled `"Download
  (needs license)"` when not. Never enabled in dev mode.
- "Open Axioma Journal" button (lines 188–199): `disabled={!access.allowed || isDev}`. Disabled in dev.
- "Connect Axioma account" button (line 119–126): `disabled` unconditionally with title
  `"Connect Axioma account flow is not yet implemented (dev placeholder)"`.

`createMockAxiomaBridge` has no live web consumer for the journal handoff path. The terminal page
derives license status from `accessFor()` (entitlement service, fail-closed), NOT from
`getProductState()` or `createJournalHandoff()` from the mock bridge. The mock bridge's
`createJournalHandoff` exists but is never called from any page or route handler.

This confirms the hard-boundary discipline is intact: no live Axioma calls can be triggered from the
current UI. The `isDev` flag (`axiomaBridgeIsDev() = !process.env.AXIOMA_BRIDGE_API_TOKEN`) correctly
gates all CTAs.

**Recommendation:** No action needed. Confirm in any future page refactor that the `isDev` gate is
preserved for all three CTA paths.

**Target Workstream:** W7 / PG6

---

### Finding 9 — LOW — Hard boundary is confirmed intact; entitlement is the only access source of truth

**Evidence:** `apps/web/src/app/(app)/app/terminal/page.tsx:33–41`

The `licStatus` derivation uses `access.allowed` / `access.reason` from `accessFor(user.id, 'axioma_terminal')` — the entitlement service. The mock bridge's `getProductState()` is NOT called on the terminal page. The bridge has no code path that could gate or read local exchange keys (confirmed: `bridge.ts` has no imports from `@wtc/crypto` or any vault module; `handoff.ts` and `es256.ts` carry only WTC-user-identity claims, never exchange credentials).

The non-dismissible hard-boundary callout ("WTC never gates your local Axioma order execution") is
rendered at the top of the component tree (line 45–59) regardless of entitlement state.

The `AXIOMA_HANDOFF_TOKEN_SPEC.md §What WTC never does` is architecturally enforced:
- `HandoffClaims` interface has no `exchangeKey`, `password`, `axiomaJwt` field.
- `handoff.test.ts:13–20` asserts the token claim set excludes forbidden keys.
- `bridge.ts` `beginAccountLink` never receives exchange keys (it returns a code to the UI, not a
  credential from Axioma).

**Recommendation:** No change. Hard boundary is correctly enforced at both the UI and token payload layers.

---

### Finding 10 — LOW — `contracts/axioma-bridge.md` status header and version remain at pre-PG6 state

**Evidence:** `docs/CONTRACTS/axioma-bridge.md:3–4`:
```
Status: Phase 2 — Part 6 product-area design added; mock bridge + HS256 dev-stub handoff implemented;
        ES256/JWKS production signer and real read-only endpoints pending.
Version: 1.1.0 (2026-05-30)
```

This was flagged as Finding 8 (LOW) in the 20260530-1355 bridge-auditor handoff. The ES256 signer
(`es256.ts`) and JWKS route exist; the header should reflect that. The version has not been bumped
since Phase 2 even though the contract has received §17 additions.

**Recommendation:** After PG6 implementation, bump to version 1.2.0 and update the status header to:
"Phase 2.8 / PG6 — ES256 signer + JWKS route implemented; ES256 wired into bridge (staging+prod
fenced); jti table migration 0004 added; production activation (key provisioning + Axioma team
confirmation + Download proxy + OTC account-link) remains TARGET."

**Target Workstream:** W7 / PG6 (doc pass)

---

### Finding 11 — LOW — `axioma_account_links.one_time_code` remains plaintext; OTC schema refactor still TARGET

**Evidence:** `packages/db/src/schema.ts:152`: `oneTimeCode: text('one_time_code')`.
The contract §7.1 requires `link_nonce_hash` (hash of OTC) — never the raw token. This was flagged as
Finding 4 (MEDIUM) in the 20260530-1355 handoff.

The OTC plaintext refactor (`one_time_code` → `link_nonce_hash` + add `axioma_username`, `linked_at`,
`last_verified_at`) stays in the BLOCKED OTC account-link workstream (B4) and MUST NOT be folded into
migration 0004. Migration 0004 is strictly scoped to `axioma_handoff_jti_revocations` only per the
PG6 hard constraint on scope discipline. The OTC fix belongs to the B4 OTC flow workstream.

**Recommendation:** Confirm in the db-architect migration 0004 spec that it adds ONLY
`axioma_handoff_jti_revocations`. The `axioma_account_links` refactor remains TARGET/B4. Track in
OPEN_QUESTIONS.

**Target Workstream:** B4 (blocked); migration 0004 must NOT include it.

---

## Decisions

1. The three CTAs (Download / Open-Journal / OTC link) MUST remain disabled dev-placeholders (B4).
   Nothing in PG6 wiring enables them. The ES256 signer wiring is an internal plumbing change — it
   does not change the `isDev` gate logic or make any CTA functional from the user's perspective.

2. `packages/axioma-bridge` must remain a pure package (zero dependencies, no `@wtc/config`, no
   `process.env`). All env resolution happens at the web/server layer and is injected as typed values
   into the bridge factory.

3. Migration 0004 is tightly scoped: `axioma_handoff_jti_revocations` table only. The
   `axioma_account_links` OTC plaintext → hash refactor stays TARGET/B4.

4. The STAGING+PROD fence uses a `deploymentEnv` parameter (not `NODE_ENV` directly) because
   `NODE_ENV` has only three values (`development | test | production`) and staging conventionally runs
   with `NODE_ENV=production`. The factory at the web layer resolves `deploymentEnv` from a dedicated
   env var (e.g. `APP_DEPLOYMENT_ENV`) or falls back to `NODE_ENV`. The bridge package never reads env.

5. `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` should be added to `packages/config/src/env.ts`
   as optional in dev, required in staging/production. The `AXIOMA_HANDOFF_SIGNING_SECRET` (HS256)
   production requirement should remain until the ES256 path is live, then be replaced.

6. The `consumeJti` repository function must be atomic (single UPDATE WHERE, 0-rows = replay)
   and must emit the `axioma.account_link.jti.consume` / `axioma.account_link.jti.replay` audit rows
   inside the same transaction.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| HS256 dev-stub can be used in a staging deployment if `NODE_ENV` is not `production` there — allows a production-grade handoff token path to ship to Axioma's staging environment with a weak, unauthenticated signer | HIGH | Use `deploymentEnv` parameter (not `NODE_ENV`) in the fence; web layer resolves and injects it |
| `AXIOMA_HANDOFF_SIGNING_KEY` / `AXIOMA_HANDOFF_KEY_ID` are not validated by `@wtc/config` — a misconfigured or empty key silently falls back to an empty JWKS | MEDIUM | Add to env.ts schema with required-in-staging/prod guard |
| Folding `axioma_account_links` OTC refactor into migration 0004 would violate scope discipline and risk coupling two unrelated workstreams | MEDIUM | Operator and db-architect must enforce 0004 = jti table only |
| jti replay store absent until migration 0004 lands — 5-minute replay window on the HS256 dev-stub (low impact in dev, unacceptable in prod | MEDIUM | Migration 0004 is the PG6 prerequisite; the wiring is blocked on the table landing |
| Missing jti audit codes — replay attempts would not be audited | MEDIUM | Add codes when consumeJti is built |
| INTEGRATION_MAP §6.2 still references wrong JWKS path and wrong env var name (third audit cycle) — risk of wrong URL communicated to Axioma team | LOW (doc only) | Fix in PG6 doc pass; this is the third time it has been flagged |
| `axioma_account_links.one_time_code` remains plaintext — exploitable if OTC flow is built before the refactor | HIGH (latent; B4 blocked) | OTC flow MUST NOT be built before `link_nonce_hash` migration; this is a B4 activation prereq |

---

## Design Recommendation

### `resolveHandoffSigner` — pure factory (packages/axioma-bridge/src/signer.ts)

The bridge package exposes a new pure function `resolveHandoffSigner` that accepts already-resolved,
env-layer values and returns a unified signer:

```typescript
// packages/axioma-bridge/src/signer.ts
// PURE — no process.env, no @wtc/config imports.

import { createEs256Signer, type Es256Signer } from './es256.ts';
import type { HandoffClaims } from './handoff.ts';

export type DeploymentEnv = 'development' | 'staging' | 'production';

export interface HandoffSignerOpts {
  /**
   * The deployment environment resolved by the web/server layer.
   * In staging or production, an ES256 key is required — the HS256 stub is forbidden.
   * In development / test, an HS256 secret is accepted.
   * The web layer resolves this from e.g. APP_DEPLOYMENT_ENV (not NODE_ENV).
   */
  deploymentEnv: DeploymentEnv;
  /**
   * ES256 private key PEM + key ID — required when deploymentEnv is 'staging' or 'production'.
   * Resolved from AXIOMA_HANDOFF_SIGNING_KEY + AXIOMA_HANDOFF_KEY_ID at the web layer.
   */
  es256Key?: string;       // PEM
  es256KeyId?: string;     // kid
  /**
   * HS256 secret — allowed ONLY when deploymentEnv is 'development'.
   * Resolved from AXIOMA_HANDOFF_SIGNING_SECRET at the web layer.
   */
  hs256Secret?: string;
}

export interface ResolvedHandoffSigner {
  /** Sign claims. Throws if called in staging/prod without an ES256 key configured. */
  sign(claims: HandoffClaims): string;
  /** 'es256' | 'hs256' — for diagnostics only; never exposed to the browser. */
  readonly algorithm: 'es256' | 'hs256';
}

export function resolveHandoffSigner(opts: HandoffSignerOpts): ResolvedHandoffSigner {
  const isReal = opts.deploymentEnv === 'staging' || opts.deploymentEnv === 'production';

  if (isReal) {
    if (!opts.es256Key || !opts.es256KeyId) {
      throw new Error(
        `[axioma-handoff] ES256 key is required in ${opts.deploymentEnv}. ` +
        'Provide AXIOMA_HANDOFF_SIGNING_KEY + AXIOMA_HANDOFF_KEY_ID.'
      );
    }
    const signer: Es256Signer = createEs256Signer(opts.es256Key, opts.es256KeyId);
    return {
      sign: (claims) => signer.sign(claims),
      algorithm: 'es256',
    };
  }

  // development — HS256 stub is allowed
  if (!opts.hs256Secret) {
    throw new Error('[axioma-handoff] HS256 secret is required in development mode.');
  }
  // Inline HS256 sign (mirrors handoff.ts signHandoffToken without the NODE_ENV check —
  // the env-layer check is now the deploymentEnv parameter above).
  return {
    sign: (claims) => {
      const { createHmac } = require('node:crypto');
      const enc = (v: string) => Buffer.from(v).toString('base64url');
      const header = enc(JSON.stringify({ alg: 'HS256', typ: 'WTC-HANDOFF' }));
      const payload = enc(JSON.stringify(claims));
      const sig = enc(createHmac('sha256', opts.hs256Secret!).update(`${header}.${payload}`).digest());
      return `${header}.${payload}.${sig}`;
    },
    algorithm: 'hs256',
  };
}
```

### `createAxiomaBridge(opts)` — replaces `createMockAxiomaBridge` for the real+staging path

```typescript
// packages/axioma-bridge/src/bridge.ts — proposed extension

export interface AxiomaBridgeOpts {
  baseUrl: string;
  audience: string;
  signer: ResolvedHandoffSigner;           // injected from resolveHandoffSigner()
  now?: () => number;
  /** Durable jti replay check — backed by axioma_handoff_jti_revocations (migration 0004). */
  isReplayed?: (jti: string) => Promise<boolean>;
  /** Record jti at issuance — atomic INSERT into axioma_handoff_jti_revocations. */
  recordJti?: (jti: string, sub: string, issuedAt: number, expiresAt: number) => Promise<void>;
}

export function createAxiomaBridge(opts: AxiomaBridgeOpts): AxiomaBridge {
  // signs via opts.signer.sign(claims) — ES256 in staging/prod, HS256 in dev.
  // createJournalHandoff and beginAccountLink both call opts.recordJti at issuance.
  // ...
}
```

The existing `createMockAxiomaBridge(opts: MockBridgeOptions)` is retained for unit tests that test
the mock data shape. In the web layer, the factory to use becomes:

```typescript
// apps/web/src/lib/server-config.ts (web layer, allowed to read process.env)
export function resolveAxiomaBridgeOpts() {
  const deploymentEnv: DeploymentEnv =
    (process.env.APP_DEPLOYMENT_ENV as DeploymentEnv) ??
    (process.env.NODE_ENV === 'production' ? 'production' : 'development');

  return resolveHandoffSigner({
    deploymentEnv,
    es256Key: process.env.AXIOMA_HANDOFF_SIGNING_KEY,
    es256KeyId: process.env.AXIOMA_HANDOFF_KEY_ID,
    hs256Secret: process.env.AXIOMA_HANDOFF_SIGNING_SECRET,
  });
}
```

### STAGING+PROD fence semantics (precise)

| deploymentEnv | es256Key present? | hs256Secret present? | Outcome |
|---------------|------------------|---------------------|---------|
| development | no | no | throws — neither key provided |
| development | no | yes | HS256 stub; token NOT accepted by Axioma production verifier |
| development | yes | any | ES256 (preferred for local testing against Axioma staging) |
| staging | no | any | throws — ES256 required |
| staging | yes | any | ES256; full signer active |
| production | no | any | throws — ES256 required |
| production | yes | any | ES256; full signer active |

### DDL for migration 0004 (`axioma_handoff_jti_revocations` only)

```sql
-- migration 0004 (additive only; 0000-0003 untouched)
CREATE TABLE "axioma_handoff_jti_revocations" (
  "jti"           uuid PRIMARY KEY,
  "sub"           uuid NOT NULL,       -- WTC user id; NOT a FK (no cascade on user delete; row stays for audit)
  "issued_at"     timestamptz NOT NULL,
  "expires_at"    timestamptz NOT NULL,
  "used_at"       timestamptz,         -- NULL = not yet consumed
  "revoked_at"    timestamptz,         -- NULL = not revoked
  "revoke_reason" text
);
-- Cleanup index for worker purge (delete WHERE expires_at < now() - interval '1 hour')
CREATE INDEX "jti_expires_at_idx" ON "axioma_handoff_jti_revocations" ("expires_at");
-- Sub-index for admin revoke-all-for-user (mark all pending JTIs revoked when entitlement revoked)
CREATE INDEX "jti_sub_idx" ON "axioma_handoff_jti_revocations" ("sub") WHERE "used_at" IS NULL AND "revoked_at" IS NULL;
```

Note: `sub` has no FK to `users` (the row is an audit record and must survive user deletion).

### `consumeJti` repository signature

```typescript
// packages/db/src/repositories.ts
export type ConsumeJtiResult =
  | { consumed: true }
  | { consumed: false; reason: 'not_found' | 'already_used' | 'revoked' | 'expired' };

export async function consumeJti(
  db: Db,
  jti: string,
  actor: { userId: string; role: ActorRole },
  now?: Date
): Promise<ConsumeJtiResult>

export async function recordJti(
  db: Db,
  input: { jti: string; sub: string; issuedAt: Date; expiresAt: Date }
): Promise<void>

export async function revokeJtiForUser(
  db: Db,
  sub: string,
  reason: string,
  actor: { userId: string | null; role: ActorRole },
  now?: Date
): Promise<number> // rows revoked
```

`consumeJti` uses an atomic `UPDATE ... WHERE jti = $jti AND used_at IS NULL AND revoked_at IS NULL
AND expires_at > $now RETURNING jti`. Zero rows → `{ consumed: false, reason: ... }`. Emits
`axioma.account_link.jti.consume` on success or `axioma.account_link.jti.replay` on failure — both
inside the same transaction.

### Test file placement

```
packages/axioma-bridge/src/signer.test.ts      — resolveHandoffSigner unit (dev/staging/prod fence)
packages/axioma-bridge/src/bridge-signer.test.ts — createAxiomaBridge with injected signer round-trip
tests/integration/axioma-jti.integration.ts    — PGlite: recordJti + consumeJti atomicity,
                                                  cross-call replay, purge of expired rows
```

---

## Verification/tests

### What is tested and green today

- `packages/axioma-bridge/src/handoff.test.ts` (6 tests): HS256 sign/verify, expiry, audience, replay,
  production guard, claim set exclusion. Included in the Phase 2.8 gate count.
- `packages/axioma-bridge/src/es256.test.ts` (7 tests): round-trip sign/verify, ES256 header+kid,
  JWKS private scalar absence, wrong-key rejection, expired/aud/replay rejection, HS256 downgrade
  rejection, empty-key/empty-kid constructor guard.
- Gate count (Phase 2.8): 370/7 unit, cov 26.21/73.49, e2e 36/36.

### What is NOT tested (PG6 must-add)

- `resolveHandoffSigner` fence behavior (dev allowed, staging/prod requires ES256).
- `createAxiomaBridge` with injected `ResolvedHandoffSigner` — ES256 round-trip through the bridge.
- `recordJti` insert → `consumeJti` atomic consume — success path.
- `consumeJti` replay detection: second call returns `{ consumed: false, reason: 'already_used' }`.
- `consumeJti` revoked-jti path: `revoked_at IS NOT NULL` returns `{ consumed: false, reason: 'revoked' }`.
- `consumeJti` expired path: `expires_at < now` returns `{ consumed: false, reason: 'expired' }`.
- Worker purge: rows with `expires_at < now - 1 hour` are deleted.
- JWKS route handler under Vitest (currently untested).
- `revokeJtiForUser` (bulk revoke on entitlement revoke).
- Audit rows emitted correctly: `axioma.account_link.jti.consume` and `.replay` codes.

### Gates NOT RUN (remain NOT RUN this audit phase)

- Real-PG (no `DATABASE_URL`): migration 0004 DDL correctness cannot be proven against real Postgres.
- ES256 key provisioning (OP): `AXIOMA_HANDOFF_SIGNING_KEY` not set; `isDev=true` in any live deployment.
- CTA activation: B4 remains open; no Axioma endpoint shapes confirmed.

---

## Next actions

1. **db-architect (PG6 DB wave first):**
   - Add migration 0004 (`axioma_handoff_jti_revocations` table ONLY — see DDL above).
   - Add `axiomaHandoffJtiRevocations` to `packages/db/src/schema.ts`.
   - Add `consumeJti`, `recordJti`, `revokeJtiForUser` to `packages/db/src/repositories.ts`.
   - Worker: add `axioma-jti-cleanup` job to `apps/worker/src/index.ts` (delete WHERE
     `expires_at < now() - interval '1 hour'`).

2. **audit maintainer (packages/audit/src/audit.ts):**
   - Add `'axioma.account_link.jti.consume'`, `'axioma.account_link.jti.replay'`,
     `'axioma.account_link.jti.revoke'` to the AUDIT_ACTIONS array.

3. **backend-implementer (packages/axioma-bridge):**
   - Create `packages/axioma-bridge/src/signer.ts` with `resolveHandoffSigner` as designed above.
   - Extend `bridge.ts`: add `createAxiomaBridge(opts: AxiomaBridgeOpts)` accepting `signer`
     (injected `ResolvedHandoffSigner`) + `isReplayed?` + `recordJti?`.
   - Update `index.ts` barrel to export `resolveHandoffSigner`, `ResolvedHandoffSigner`,
     `DeploymentEnv`, `AxiomaBridgeOpts`, `createAxiomaBridge`.

4. **backend-implementer (packages/config):**
   - Add `AXIOMA_HANDOFF_SIGNING_KEY` (optional string, required in non-dev deploymentEnv) and
     `AXIOMA_HANDOFF_KEY_ID` (optional string) to `env.ts` schema.
   - Add `APP_DEPLOYMENT_ENV` optional field to `env.ts` with allowed values
     `'development' | 'staging' | 'production'`, defaulting to `NODE_ENV`.

5. **backend-implementer (apps/web):**
   - Update `apps/web/src/lib/server-config.ts` to export `resolveAxiomaBridgeOpts()` as described.
   - DO NOT change `axiomaBridgeIsDev()` — it remains the CTA gate; CTAs stay disabled.

6. **tests-runner:**
   - Add `packages/axioma-bridge/src/signer.test.ts` (fence behavior unit).
   - Add `packages/axioma-bridge/src/bridge-signer.test.ts` (ES256 round-trip through bridge).
   - Add `tests/integration/axioma-jti.integration.ts` (PGlite jti lifecycle).

7. **docs owner:**
   - Update `docs/INTEGRATION_MAP.md §6.2`: JWKS path → `/.well-known/axioma-jwks.json`
     (third request); env var → `AXIOMA_BRIDGE_API_TOKEN` (not `AXIOMA_BRIDGE_URL`).
   - After PG6 implementation: bump `docs/CONTRACTS/axioma-bridge.md` to v1.2.0 + update status header.

8. **scope discipline (operator):**
   - Confirm migration 0004 contains ONLY `axioma_handoff_jti_revocations`.
   - Confirm `axioma_account_links` OTC refactor stays TARGET/B4.
   - Confirm CTAs remain disabled dev-placeholders until B4 is cleared.
