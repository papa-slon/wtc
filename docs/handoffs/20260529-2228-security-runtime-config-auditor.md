# security-runtime-config-auditor handoff

_2026-05-29 22:28. Phase 1.6.1 Task D — "Security/runtime config follow-up". READ-ONLY audit. No
code modified except this one handoff. No live servers, bots, secrets, npm, tests, builds, or git
touched. All findings below were VERIFIED by reading the named files in full this session and by a
repo-wide `loadEnv` grep + `instrumentation`/`middleware`/`next.config` globs._

## Scope

Phase 1.6.1 Task D items 1-5:
1. Specify EXACT direct unit tests for `isBase64Key(value, bytes)` (impl in
   `packages/shared/src/env-guards.ts`, exported from `packages/shared/src/index.ts`), to be added to
   `packages/shared/src/env-guards.test.ts`.
2. Audit every `loadEnv(` caller across `apps/` + `packages/`; conclude whether the all-environment
   base64-32 `SECRET_VAULT_KEK` refinement in `packages/config/src/env.ts` `loadEnv()` is reached at
   real server runtime, or only in tests.
3. Recommend the SAFEST boot-time wiring to make that validation real WITHOUT breaking `next build`
   (which runs with no runtime secrets and MUST NOT fail).
4. Confirm `apps/web/src/lib/vault.ts` + `@wtc/crypto` `parseKek` still fail closed (throw) on a
   bad/missing KEK, and that nothing recommended weakens that.
5. Cross-check whether `next build` invokes instrumentation; report the Next.js version.

## Files inspected

All read in full this session:
- `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`
- `docs/handoffs/20260529-2052-phase-1-6-enforcement-persistence-truth.md` (Phase 1.6 aggregate)
- `docs/handoffs/20260529-2052-security-config-auditor.md` (prior Task-D auditor)
- `docs/SECRET_VAULT_DESIGN.md`
- `packages/shared/src/env-guards.ts` (the `isBase64Key` impl, lines 1-71)
- `packages/shared/src/env-guards.test.ts` (existing test style/imports)
- `packages/shared/src/index.ts` (the `isBase64Key` export)
- `packages/config/src/env.ts` (the `loadEnv` + all-env KEK refinement)
- `packages/config/src/env.test.ts` (the `loadEnv` test suite)
- `packages/config/src/index.ts` (re-export)
- `apps/web/src/lib/vault.ts` (web vault — direct `process.env` reader)
- `packages/crypto/src/vault.ts` (`parseKek`, `createSecretVault`)
- `apps/web/package.json` (Next.js version), `apps/web/next.config.ts`
- `apps/worker/src/index.ts`, `apps/worker/src/tick-once.ts`, `apps/worker/package.json`
- `.github/workflows/ci.yml`, root `package.json`
- Repo-wide grep `loadEnv(` (excluding node_modules); globs for `apps/**/instrumentation*`,
  `apps/web/**/middleware.*`, `apps/web/next.config.*`

## Files changed

None — read-only audit

## Findings

### Finding 1 — INFO/LOW: `isBase64Key` is already implemented and well-formed; it has NO direct unit tests. Add them.
**Severity:** LOW (test-coverage gap, not a defect)
**Evidence:** `packages/shared/src/env-guards.ts:45-53` (verified):
```ts
export function isBase64Key(value: string, bytes: number): boolean {
  const v = value.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(v)) return false;
  try {
    return Buffer.from(v, 'base64').length === bytes;
  } catch {
    return false;
  }
}
```
Exported at `packages/shared/src/index.ts:7`
(`export { assertNotProduction, requiredSecret, isPlaceholderSecret, isLowEntropySecret, isWeakSecret, isBase64Key } from './env-guards.ts';`).
The existing test file `packages/shared/src/env-guards.test.ts` currently tests only `assertNotProduction`
and `requiredSecret` — there is NO `describe('isBase64Key')` block. Its import line is
`import { assertNotProduction, requiredSecret } from './env-guards.ts';` (line 2) — note the explicit
`.ts` extension (this repo is strip-friendly per AGENTS.md "Conventions"); it does NOT yet import
`randomBytes`.

Implementation correctness facts I confirmed by reading the impl (these drive the test matrix):
- `trim()` first, then a STRICT base64-alphabet regex `^[A-Za-z0-9+/]+={0,2}$` BEFORE decoding. So:
  - empty string → regex `+` requires ≥1 char → `false` (Task-D "empty → false" satisfied);
  - `'!!!'`, spaces, `'===='` (no payload before padding) → regex fails → `false` (Task-D "non-base64 → false");
  - hex `randomBytes(24).toString('hex')` (48 lowercase hex chars, all in `[A-Za-z0-9]`) PASSES the
    regex, then decodes to 36 bytes → `!== 32` → `false`. `'a'.repeat(48)` is likewise 48 base64
    chars = 36 bytes → `false` for bytes=32 (Task-D "36-byte → false");
  - a 32-char ad-hoc base64 string decodes to 24 bytes → `false` for bytes=32 (Task-D "24-byte → false");
  - `randomBytes(32).toString('base64')` (44 chars incl. trailing `=`) → regex OK (`={0,2}`), decodes
    to 32 bytes → `true` (Task-D "valid 32-byte → true");
  - `randomBytes(16).toString('base64')` (24 chars, `==` pad) → `true` for bytes=16 (Task-D "other byte length").
- NOTE the regex also rejects base64 WITH internal whitespace/newlines (PEM wrapping). That is fine
  and intended (env KEKs are single-line); a test asserting a space-containing string is `false` is
  valid and meaningful.
**Recommendation:** Add a `describe('isBase64Key')` block to `packages/shared/src/env-guards.test.ts`.
Generate all "valid" vectors at runtime with `randomBytes(...).toString('base64')` so `npm run secret:scan`
(secretlint) cannot flag a hardcoded 32-byte base64 literal (the prompt's explicit constraint).
**Concrete target fix:** exact code in `## Verification/tests` below.
**Target part:** Phase 1.6.1 Task D item 1 — `packages/shared/src/env-guards.test.ts`.

---

### Finding 2 — HIGH: the all-environment base64-32 `SECRET_VAULT_KEK` config-load validation is NOT reached on ANY real server runtime path — it is exercised ONLY by `packages/config/src/env.test.ts`. The validation is currently theoretical for the deployed app. **[VERIFIED THIS SESSION via repo-wide grep]**
**Severity:** HIGH (a config-load defence that never executes in the running app is a false sense of
security — a misconfigured KEK still slips past boot and only fails lazily on first vault use)
**Evidence — every `loadEnv`-related hit in the repo (grep `loadEnv`, excluding node_modules; the
only NON-doc, NON-coverage matches are):**
- `packages/config/src/env.ts:73` — the `loadEnv` DEFINITION.
- `packages/config/src/index.ts:1` — `export { loadEnv, __resetEnvCache } from './env.ts';` (re-export only).
- `packages/config/src/env.test.ts:3,22,26,31,40,44,50,54,60,71,78,83,91` — the unit-test CALLERS.
- Everything else is `docs/**` prose or `coverage/**` HTML.
**No `apps/web/**` file, no `apps/worker/**` file, and no other `packages/**` runtime file calls
`loadEnv()`.** Cross-checks I ran this session:
- `apps/web/src/lib/vault.ts:14` reads `process.env.SECRET_VAULT_KEK` DIRECTLY via
  `requiredSecret('SECRET_VAULT_KEK', process.env.SECRET_VAULT_KEK, DEV_ONLY_KEK)` then
  `parseKek(kekB64)` (line 16) — it never calls `loadEnv` (confirms prior auditor Finding 4).
- `apps/worker/src/index.ts` (full read): imports `@wtc/tradingview-access`, `@wtc/audit`,
  `./jobs.ts`; reads `process.env.DATABASE_URL` directly; **never imports `@wtc/config` / `loadEnv`**.
- There is **no** `apps/web/instrumentation.ts` / `apps/web/src/instrumentation.ts` (glob:
  "No files found"), and **no** `apps/web/middleware.*` (glob: "No files found"). So there is no
  Next.js boot hook or middleware that could be calling `loadEnv` either.
**Conclusion (stated clearly, as required):** The `SECRET_VAULT_KEK` base64-32 refinement in
`loadEnv()` is **reached only in `packages/config/src/env.test.ts` (Vitest), NOT on any real server
runtime path** (no instrumentation `register()`, no middleware, no server component/route/action, and
not the worker entry). **The config-load validation is currently test-only — theoretical for the
deployed web app and the worker process.**
**Recommendation:** Make the validation real at runtime via a build-safe boot hook (Finding 3). The
web app continues to fail CLOSED today via the lazy `parseKek`/`requiredSecret` throw (Finding 4), so
this is a fail-FAST upgrade (boot vs first-use), not a fix to an open hole.
**Target part:** Phase 1.6.1 Task D item 2.

---

### Finding 3 — MEDIUM: boot-time wiring — recommend `apps/web/instrumentation.ts` calling `loadEnv()` in `register()` as the PRIMARY fix (Next 15.1.3 is build-safe for this), with the worker entry as a complementary second call. Both are additive. **[VERIFIED: Next 15.1.3; minimal next.config; no existing instrumentation]**
**Severity:** MEDIUM
**Verified facts that make this confident:**
- `apps/web/package.json:14` → `"next": "^15.1.3"`. **Next 15** → `instrumentation.ts` is STABLE; the
  old `experimental.instrumentationHook` flag is NOT required (and is absent — see next bullet).
- `apps/web/next.config.ts` (full read): only `reactStrictMode`, `transpilePackages` (lists
  `@wtc/config` among them, line 9, so importing it from instrumentation is already supported by the
  build), and `eslint.ignoreDuringBuilds`. **No `output: 'export'`, no `output: 'standalone'` quirk,
  no `experimental` block, nothing that changes instrumentation/runtime-secret behavior.**
- No `apps/web/instrumentation.ts` exists yet (glob "No files found") → adding one clobbers nothing.

**Why this is build-safe (Task D's critical constraint "must NOT break `next build`"):** In Next.js
13.4+ through 15, `instrumentation.ts`'s `register()` runs once when a SERVER INSTANCE boots
(runtime: `next start`, or the dev server), and is NOT invoked as part of `next build`'s
page-data/SSG collection. `next build` BUNDLES the file but does not CALL `register()` to render. So
adding a `register()` that calls `loadEnv()` does NOT make the build require `SECRET_VAULT_KEK` (which
is absent at build). This is corroborated by the existing repo reality: `npm run build -w @wtc/web` is
green today (STATUS.md "31/31 pages") and the web app already fails closed lazily without boot env —
i.e. the build path deliberately avoids touching runtime secrets.

**Honest confidence:** HIGH that option (a) is build-safe on this exact setup (Next 15.1.3 + the
minimal next.config + no `output: export`). The ONE residual unknown is environment-specific Next
behavior I cannot execute in a read-only audit; therefore the implementer MUST run the cheap
acceptance check below (no-secrets `next build`) before relying on it. If that build stays green,
option (a) is proven; if it ever fails on the KEK, revert and keep only option (b)+(c).

**Options weighed:**
- **(a) `apps/web/instrumentation.ts` calling `loadEnv()` in `register()`** — RECOMMENDED PRIMARY.
  Covers the web runtime (the path the prompt cares about). Runtime-only on Next 15; not build.
- **(b) `loadEnv()` in `apps/worker/src/index.ts`** — RECOMMENDED COMPLEMENT. The worker is a plain
  Node process (`tsx src/index.ts`) with NO `next build` phase, so a `loadEnv()` at the top of `main()`
  cannot break any web build and makes the KEK check real for the worker too. CAVEAT verified this
  session: `apps/worker/package.json` does NOT currently list `@wtc/config` as a dependency (its deps
  are `@wtc/entitlements`, `@wtc/tradingview-access`, `@wtc/audit`, `@wtc/db`). The implementer must
  ADD `"@wtc/config": "*"` to `apps/worker/package.json` before importing `loadEnv` there.
- **(c) leave lazy + document** — the Task-D-item-4-sanctioned fallback. Always safe; the vault already
  fails closed lazily (Finding 4). Use only if (a) cannot be certified by the no-secrets build.

**Recommendation (do both additive calls):**
1. Add `apps/web/instrumentation.ts` with EXACTLY this content, then run the acceptance check:
   ```ts
   // apps/web/instrumentation.ts
   // Next.js calls register() once when a SERVER instance boots (runtime: `next start` / dev),
   // NOT during `next build`'s page-data collection. Importing @wtc/config here (lazily, inside the
   // nodejs-runtime branch) makes the env — including the base64-32 SECRET_VAULT_KEK shape check —
   // fail FAST at server boot instead of lazily on first vault use. The nodejs guard keeps Node-only
   // config (Buffer/process.env) off the edge runtime.
   export async function register(): Promise<void> {
     if (process.env.NEXT_RUNTIME === 'nodejs') {
       const { loadEnv } = await import('@wtc/config');
       loadEnv();
     }
   }
   ```
   **Acceptance check (the real proof — not doc memory):** run `npm run build -w @wtc/web` in a shell
   with NO `SECRET_VAULT_KEK` set. It MUST still pass (proves `register()` is not invoked at build).
   If it fails on the KEK, revert this file and use (b)+(c).
2. Add `"@wtc/config": "*"` to `apps/worker/package.json` deps, then at the top of `main()` in
   `apps/worker/src/index.ts` call `loadEnv()` BEFORE the loop starts (so a misconfigured KEK aborts
   worker boot). Example placement (illustrative — match the file's import style, `from '@wtc/config'`):
   `const { loadEnv } = await import('@wtc/config'); loadEnv();` as the first line of `main()`.
**Do NOT** call `loadEnv()` from a module imported during `next build`'s render/SSG (e.g. a top-level
import in a shared `layout.tsx`/server component) — THAT would break the build. The instrumentation
`register()` hook is specifically the build-safe seam.
**Target part:** Phase 1.6.1 Task D item 3 — new `apps/web/instrumentation.ts`; `apps/worker/src/index.ts`
+ `apps/worker/package.json`.

---

### Finding 4 — INFO: lazy fail-closed vault behavior is intact; NOTHING recommended weakens it. **[VERIFIED THIS SESSION]**
**Severity:** INFO (confirmation)
**Evidence:**
- `packages/crypto/src/vault.ts:50-61` `parseKek()` (verified): `Buffer.from(base64,'base64')` then
  `if (buf.length !== KEY_LEN) throw new VaultError('KEK must decode to 32 bytes, got ...')`, with
  `KEY_LEN = 32` (`vault.ts:19`). `createSecretVault` re-asserts at `vault.ts:102`
  (`if (active.kek.length !== KEY_LEN) throw new VaultError('active KEK must be 32 bytes')`).
- `apps/web/src/lib/vault.ts` (verified): `getVault()` is LAZY (`if (cached) return cached;`), uses
  `requiredSecret('SECRET_VAULT_KEK', process.env.SECRET_VAULT_KEK, DEV_ONLY_KEK)` (line 14) then
  `parseKek(kekB64)` (line 16). `requiredSecret` (`packages/shared/src/env-guards.ts:55-70`, verified)
  THROWS in production when the value is missing (no dev fallback outside development) and throws on
  weak values in production; `parseKek` throws on any non-32-byte decode. So a missing/malformed KEK
  fails CLOSED on first `getVault()` use even with NO boot wiring. `DEV_ONLY_KEK = Buffer.alloc(32,7)
  .toString('base64')` is returned by `requiredSecret` ONLY in non-production.
- My recommendations are PURELY ADDITIVE (an extra early `loadEnv()` call at boot). None remove
  `requiredSecret`, none remove `parseKek`'s byte-length throw, none add a fallback KEK on a server
  path. Option (a) imports `@wtc/config` only inside `NEXT_RUNTIME === 'nodejs'` and never touches the
  vault module.
**Recommendation:** Keep the lazy fail-closed vault exactly as-is; add boot validation ON TOP, never
INSTEAD.
**Target part:** Phase 1.6.1 Task D item 4.

---

### Finding 5 — INFO: does `next build` invoke instrumentation `register()`? No (Next 15.1.3) — confirm with a no-secrets build. Next.js version reported. **[VERIFIED: version + config; build-not-invoking is Next-documented behavior to confirm by the acceptance build]**
**Severity:** INFO
**Evidence / answer:** **Next.js version = `^15.1.3`** (`apps/web/package.json:14`). Per Next.js
documented behavior (13.4+ through 15), `next build` BUNDLES `instrumentation.ts` but does NOT CALL
`register()` as part of building/SSG — `register()` runs at server-instance startup (runtime). The
repo's `apps/web/next.config.ts` has no setting that changes this (no `output: 'export'`, no
`experimental.instrumentationHook` needed in 15, `@wtc/config` already in `transpilePackages`). So
adding `apps/web/instrumentation.ts` should NOT make `next build` require runtime secrets.
**The single decisive verification (cheap, do it before relying on (a)):** add the
`apps/web/instrumentation.ts` from Finding 3, then run `npm run build -w @wtc/web` with NO
`SECRET_VAULT_KEK` in env. If the build still passes (STATUS.md baseline: green, 31/31 pages), then
`register()` is confirmed NOT invoked at build and option (a) is safe. If it fails on the KEK, revert.
**Recommendation:** Report the no-secrets-build result in the implementing handoff; do not claim
build-safety without that one observation. (CI note: `.github/workflows/ci.yml:65` already exports a
valid `SECRET_VAULT_KEK=$(openssl rand -base64 32)` and the build step runs AFTER that, so CI would
pass regardless — the no-secrets LOCAL build is the meaningful test of build-invocation.)
**Target part:** Phase 1.6.1 Task D item 5.

---

### Finding 6 — LOW: stale `docs/SECRET_VAULT_DESIGN.md` KEK encoding lines persist (hex) and can mislead an operator into a hex KEK. **[VERIFIED THIS SESSION]**
**Severity:** LOW (docs hygiene; adjacent to scope; a real foot-gun)
**Evidence:** `docs/SECRET_VAULT_DESIGN.md:138` shows `WTC_VAULT_KEK_<keyId>=<hex-64-chars>` and
`:191` "Generate new KEK: `openssl rand -hex 32`". The implemented contract is **base64 / 32 bytes**
(`parseKek`); `:67` of the same doc was already corrected to "base64-encoded 44 chars", but the
KEK naming/rotation lines (:138, :191) still say hex. A contributor copying `openssl rand -hex 32`
(64 hex chars) produces a 48-byte base64 decode that both `isBase64Key(...,32)` AND `parseKek`
correctly REJECT — fail-closed, but a confusing boot/first-use failure.
**Recommendation:** In a docs-only follow-up, change `:138` to `WTC_VAULT_KEK_<keyId>=<base64-44-chars>`
and `:191` to "Generate new KEK: `openssl rand -base64 32`". Out of strict Task-D code scope; flag to
orchestrator.
**Target part:** docs hygiene (flag to orchestrator).

## Decisions

- **`isBase64Key` is already implemented and correct** (`packages/shared/src/env-guards.ts:45-53`,
  verified); Task-D item 1 reduces to ADDING direct unit tests. The impl is STRICTER than the prior
  auditor's byte-length-only sketch (it pre-validates the base64 alphabet with a regex), so
  empty/`'!!!'`/space/`'===='` inputs are rejected by the regex branch — the tests assert the
  observable `false`, which holds.
- **All "valid KEK" test vectors MUST be generated at runtime** via `randomBytes(n).toString('base64')`
  (never a hardcoded 32-byte base64 literal) to keep `npm run secret:scan` green (prompt constraint).
  The existing `packages/config/src/env.test.ts` already follows exactly this pattern (line 7:
  `const VALID_KEK_B64 = randomBytes(32).toString('base64');`), so the style is established.
- **The base64-32 config validation is test-only-reached** — VERIFIED by the repo-wide grep: the only
  `loadEnv` callers are the definition, the re-export, and `env.test.ts`. No runtime path calls it.
- **Boot wiring:** recommend **(a) `apps/web/instrumentation.ts` as the primary** (Next 15.1.3 +
  minimal next.config → build-safe; HIGH confidence, gated by a no-secrets `next build`) and
  **(b) `loadEnv()` in the worker entry as a complementary call** (unconditionally build-safe; requires
  adding `@wtc/config` to `apps/worker/package.json`). **(c) document-only** is the sanctioned fallback
  if the no-secrets build ever fails.
- **Nothing recommended weakens lazy fail-closed** (`requiredSecret` + `parseKek` both still throw);
  all recommendations are additive boot checks.
- **CI is already KEK-safe**: `ci.yml:65` uses `openssl rand -base64 32` (the prior phase's fix landed).

## Risks

1. **Build-break risk of option (a) — the constraint the prompt flagged:** if some
   environment-specific Next behavior (which I cannot execute in a read-only audit) DID call
   `register()` during build, adding `apps/web/instrumentation.ts` that calls `loadEnv()` would make
   `next build` require `SECRET_VAULT_KEK` (absent at build) → red. MITIGATION (mandatory): run
   `npm run build -w @wtc/web` with NO `SECRET_VAULT_KEK` and confirm green BEFORE relying on (a).
   Confidence it will pass: HIGH (Next 15.1.3, minimal next.config, build already green today).
2. **Edge-runtime risk of option (a):** without the `NEXT_RUNTIME === 'nodejs'` guard, `@wtc/config`
   (Node `Buffer`/`process.env`) could be pulled into an edge runtime. The provided file content
   guards against this with the `nodejs` check + dynamic `import`.
3. **Option (b) dependency gap:** `apps/worker/package.json` does NOT currently depend on `@wtc/config`.
   Importing `loadEnv` there without first adding the dep would break the worker typecheck/runtime. Add
   `"@wtc/config": "*"` in the same change.
4. **No new test-fixture breakage:** the strict base64-32 KEK check already SHIPPED in Phase 1.6;
   `packages/config/src/env.test.ts` already uses a runtime-generated 32-byte base64 KEK (line 7) and
   `ci.yml` already uses `openssl rand -base64 32` — so adding the `isBase64Key` unit tests + the boot
   wiring does NOT require re-fixing any fixture. (The Phase-1.6 "must fix CI/fixtures in the same
   commit" risk is already resolved.)
5. No live-secret/server/bot exposure from this audit — read-only; no value quoted above is a real
   secret (all KEK-shaped strings are placeholders or `randomBytes`/`Buffer.alloc` sketches).

## Verification/tests

**Tests to ADD (none run during this read-only audit):**

EXACT direct unit tests for `isBase64Key`, appended to `packages/shared/src/env-guards.test.ts`. The
existing file imports `from './env-guards.ts'` (verified, line 2) — add `isBase64Key` to a sibling
import and add `randomBytes` from `node:crypto`:

```ts
// at top of packages/shared/src/env-guards.test.ts, alongside the existing imports:
import { randomBytes } from 'node:crypto';
// extend the existing import line to include isBase64Key:
import { assertNotProduction, requiredSecret, isBase64Key } from './env-guards.ts';

describe('isBase64Key', () => {
  it('accepts a real 32-byte base64 key (bytes=32)', () => {
    // generated at runtime so secret:scan / secretlint cannot flag a hardcoded 32-byte literal
    expect(isBase64Key(randomBytes(32).toString('base64'), 32)).toBe(true);
  });

  it('rejects a 24-byte value (32 base64 chars) for bytes=32', () => {
    expect(isBase64Key(randomBytes(24).toString('base64'), 32)).toBe(false); // 32 base64 chars -> 24 bytes
  });

  it('rejects a 36-byte value for bytes=32 (e.g. a 48-char hex string)', () => {
    // hex(24 bytes) = 48 lowercase hex chars; passes the base64 regex but decodes to 36 bytes.
    expect(isBase64Key(randomBytes(24).toString('hex'), 32)).toBe(false);
    expect(isBase64Key('a'.repeat(48), 32)).toBe(false); // 48 base64 chars = 36 bytes
  });

  it('rejects non-base64 characters', () => {
    expect(isBase64Key('!!!', 32)).toBe(false);
    expect(isBase64Key('not valid base64 with spaces', 32)).toBe(false);
    expect(isBase64Key('====', 32)).toBe(false); // no payload chars before padding
  });

  it('rejects the empty string', () => {
    expect(isBase64Key('', 32)).toBe(false);
  });

  it('is correct for other byte lengths (bytes=16)', () => {
    expect(isBase64Key(randomBytes(16).toString('base64'), 16)).toBe(true);  // 24 chars, '==' pad
    expect(isBase64Key(randomBytes(32).toString('base64'), 16)).toBe(false); // 32 bytes != 16
  });
});
```
Why each assertion holds (per the verified impl at `env-guards.ts:45-53`):
- `'!!!'`, the spaces case, `''`, and `'===='` all fail the `^[A-Za-z0-9+/]+={0,2}$` regex → `false`.
- `randomBytes(24).toString('hex')` and `'a'.repeat(48)` pass the regex but decode to 36 bytes → `false`.
- `randomBytes(24).toString('base64')` decodes to 24 bytes → `false` for bytes=32.
- `randomBytes(32).toString('base64')` → 32 bytes → `true` for 32, `false` for 16.
- `randomBytes(16).toString('base64')` → 16 bytes → `true` for 16.

These belong in `packages/shared/src/env-guards.test.ts` (same file as the sibling guards), NOT a new
file. After adding, run `npm test` (the count rises from 72) and `npm run secret:scan` (stays clean —
no literal base64 KEK appears).

**Implementer must ALSO run, in this order:**
1. (Already done by me; re-run to be safe) `rg -n "loadEnv\(" --glob '!**/node_modules/**'` → expect
   only `packages/config/src/{env.ts,index.ts,env.test.ts}` (Finding 2 — the test-only verdict).
2. If pursuing option (a): add `apps/web/instrumentation.ts` (exact content in Finding 3), then
   `npm run build -w @wtc/web` with NO `SECRET_VAULT_KEK` in env; confirm the build stays green
   (proves `register()` is not called at build — Finding 5).
3. If pursuing option (b): add `"@wtc/config": "*"` to `apps/worker/package.json`, call `loadEnv()` at
   the top of `apps/worker/src/index.ts` `main()`, then `npm run typecheck` (worker) + `npm test`.
4. After all changes: `npm run ci:local` (check:core → governance:check → lint → typecheck ×2 →
   secret:scan → test → build) to confirm nothing regressed.

**Gates RUN this session:** NONE (read-only audit; no `npm`/test/build/git executed).
**Gates NOT RUN and why:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`,
`npm run secret:scan`, `npm run governance:check` — not run: this is a read-only specification pass.
The implementing agent must run them after landing the tests + wiring.

## Next actions

1. **Add the `isBase64Key` direct unit tests** to `packages/shared/src/env-guards.test.ts` exactly as
   sketched (runtime-generated vectors; extend the existing `./env-guards.ts` import; add `randomBytes`
   from `node:crypto`). Run `npm test` + `npm run secret:scan`.
2. **Make the validation real at runtime (build-safe), both additive calls:**
   - (a) PRIMARY: add `apps/web/instrumentation.ts` (exact content in Finding 3), then run
     `npm run build -w @wtc/web` with NO `SECRET_VAULT_KEK` and confirm it stays green. Keep (a) only
     if that build passes; otherwise revert and rely on (b)+(c).
   - (b) COMPLEMENT: add `"@wtc/config": "*"` to `apps/worker/package.json`; call `loadEnv()` at the
     top of `apps/worker/src/index.ts` `main()` (worker has no `next build` phase → always safe).
   - (c) FALLBACK (Task D item 4 sanctioned): if (a) cannot be certified by the no-secrets build,
     document in `docs/STATUS.md`/`docs/NEXT_ACTIONS.md` that the web runtime relies on the lazy
     fail-closed vault and the config-load shape check is enforced for the worker + tests only, with
     the explicit reason (avoid build-time secret coupling).
3. **Do NOT weaken** `apps/web/src/lib/vault.ts` `requiredSecret`/`parseKek` fail-closed behavior; all
   wiring is additive (Finding 4).
4. **Report the Next.js version (`^15.1.3`) and the no-secrets `next build` result** in the
   implementing handoff (Finding 5).
5. **(Docs hygiene, optional)** fix `docs/SECRET_VAULT_DESIGN.md:138` (`<hex-64-chars>` →
   `<base64-44-chars>`) and `:191` (`openssl rand -hex 32` → `openssl rand -base64 32`) to match the
   implemented base64-32 contract (Finding 6).
6. **Do NOT implement ES256/JWKS** — remains a separate session per `docs/NEXT_ACTIONS.md` (unchanged;
   the Axioma HS256 prod-fence is already verified by the prior phase and is out of this task's scope).
