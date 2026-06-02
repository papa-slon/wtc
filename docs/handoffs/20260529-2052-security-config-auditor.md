# security-config-auditor handoff

_2026-05-29. Phase 1.6 Task D — read-only security-config audit. No live servers, bots, or secrets
touched. No code modified. Findings are specifications for a follow-up implementer._

## Scope

Phase 1.6 Task D: harden security configuration around `SECRET_VAULT_KEK`. Specifically:
1. Confirm the `SECRET_VAULT_KEK` validation gap in `packages/config/src/env.ts` (message promises a
   base64 32-byte key; validation only checks `min(16)`).
2. Determine the EXACT encoding + length the vault actually requires today (base64 vs hex; 32 bytes vs
   other) with file:line, and whether a strict "base64 32-byte" check at config load would PASS or FAIL
   `ci.yml`'s ephemeral KEK and the existing green tests — and how to avoid breaking them.
3. Recommend a reusable `@wtc/shared` helper + a concrete zod refinement that fails fast in `loadEnv`,
   in ALL environments, composing with the existing production weak-secret checks.
4. Spec the production tests to add.
5. Confirm the Axioma HS256 signer throws in production and that ES256/JWKS remains a hard blocker NOT
   forced into this phase.
6. Cross-check every reader of `SECRET_VAULT_KEK` for `loadEnv` bypass.

## Files inspected

- `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`,
  `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260529-1921-phase-1-5-governance-persistence-hardening.md`
- `docs/handoffs/20260529-1921-security-auth-secrets-auditor.md`
- `docs/SECRET_VAULT_DESIGN.md`, `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`, `docs/ARCHITECTURE_DECISIONS.md` (KEK lines)
- `packages/config/src/env.ts`, `packages/config/src/env.test.ts`
- `packages/shared/src/env-guards.ts`, `packages/shared/src/env-guards.test.ts`, `packages/shared/src/index.ts`
- `packages/crypto/src/vault.ts`, `packages/crypto/src/vault.test.ts`, `packages/crypto/src/__smoke__.ts`, `packages/crypto/src/index.ts`
- `apps/web/src/lib/vault.ts`, `apps/web/src/lib/csrf.tsx`
- `packages/axioma-bridge/src/handoff.ts`
- `.env.example`, `.github/workflows/ci.yml`
- Repo-wide grep for `SECRET_VAULT_KEK`, `parseKek`, `createSecretVault`, `KEY_LEN`

## Files changed

None — read-only audit.

## Findings

### Finding 1 — HIGH: `SECRET_VAULT_KEK` config validation does not match the vault's real contract (the gap is CONFIRMED)
**Severity:** HIGH
**Evidence:**
- `packages/config/src/env.ts:20` — `SECRET_VAULT_KEK: z.string().min(16, 'SECRET_VAULT_KEK must be a base64 32-byte key')`. The **message** promises a base64 32-byte key; the **validation** only asserts string length ≥ 16. No base64 decode, no byte-length assertion.
- The only shape check happens **lazily inside the vault, at first use** — `packages/crypto/src/vault.ts:50-61` `parseKek()`: `Buffer.from(base64,'base64')` then `if (buf.length !== KEY_LEN) throw new VaultError(...)`, where `KEY_LEN = 32` (`vault.ts:19`). `createSecretVault` re-asserts at `vault.ts:102` (`active.kek.length !== KEY_LEN → throw 'active KEK must be 32 bytes'`).
- That lazy validation is reached only via `apps/web/src/lib/vault.ts:16` (`createSecretVault({ keyId, kek: parseKek(kekB64) })`) on the FIRST exchange-key seal/open — i.e. a malformed KEK passes `loadEnv` at boot and only explodes later, on a user action, in `getVault()`. Fail-late, not fail-fast.

**Recommendation:** Validate `SECRET_VAULT_KEK` as a base64-encoded 32-byte (256-bit) key AT CONFIG LOAD, in ALL environments (not just production), so a misconfigured KEK fails fast in `loadEnv` rather than on first vault use.

**Concrete target fix:**
- Add a reusable helper in `packages/shared/src/env-guards.ts` (exported from `packages/shared/src/index.ts`):
  ```ts
  /** True iff `value` is base64 that decodes to exactly `bytes` bytes. */
  export function isBase64Key(value: string, bytes: number): boolean {
    let buf: Buffer;
    try { buf = Buffer.from(value, 'base64'); } catch { return false; }
    return buf.length === bytes;
  }
  /** Decode a base64 key and assert its decoded byte length, or throw. */
  export function decodeBase64Key(value: string, bytes: number): Buffer {
    const buf = Buffer.from(value, 'base64');
    if (buf.length !== bytes) {
      throw new Error(`expected a base64 ${bytes}-byte key, got ${buf.length} bytes`);
    }
    return buf;
  }
  ```
  Note: `Buffer.from(x,'base64')` never throws (it silently drops invalid chars), so `isBase64Key`'s correctness rests on the byte-length assertion — that is sufficient here because the vault uses exactly the same `Buffer.from(...,'base64')` decode (`vault.ts:52`), so config and vault agree by construction. (Optionally also strict-check the base64 alphabet with a regex if you want to reject "looks-like-base64-but-isn't" inputs, but do not diverge from the vault decoder.)
- In `packages/config/src/env.ts`, change line 20 to keep the `min(16)` for a friendly short-input message, then add a base64-32 refinement that runs in EVERY environment. Put it OUTSIDE the `NODE_ENV === 'production'` block in the existing `superRefine`:
  ```ts
  // runs in all environments — shape must always match the vault (parseKek → 32 bytes base64)
  if (!isBase64Key(data.SECRET_VAULT_KEK, 32)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SECRET_VAULT_KEK'],
      message: 'SECRET_VAULT_KEK must be a base64-encoded 32-byte key (e.g. `openssl rand -base64 32`)' });
  }
  ```
  This composes cleanly with the existing prod-only `isWeakSecret(data.SECRET_VAULT_KEK)` check at `env.ts:49-51` (shape always; weak-secret only in prod). Import `isBase64Key` alongside the existing `isWeakSecret` import at `env.ts:5`.
- **Target part:** Phase 1.6 Task D — `packages/config/src/env.ts`, `packages/shared/src/env-guards.ts`, `packages/shared/src/index.ts`.

---

### Finding 2 — CRITICAL (for the rollout): a strict "base64 32-byte" config check will TURN GREEN GATES RED unless `ci.yml` and `env.test.ts` are fixed in the SAME change
**Severity:** HIGH (process/regression risk — this is the must-not-break item the prompt flagged)
**Evidence (exact decoded byte lengths, computed with Node `Buffer.from`):**

| Source | Value | Encoding intent | base64-decoded bytes | hex-decoded bytes | Passes strict base64-32? |
|---|---|---|---|---|---|
| `ci.yml:62` ephemeral KEK | `openssl rand -hex 24` → 48 hex chars | hex, 24 bytes | **36** | 24 | **NO** |
| `env.test.ts:9` base `SECRET_VAULT_KEK` | `aF3kQ9zW7pX2mR8tV5yB1nC4dH6jL0sE` (32 chars) | (ad-hoc) | **24** | 1 | **NO** |
| `vault.test.ts` / `__smoke__.ts` KEKs | `randomBytes(32).toString('base64')` (44 chars) | base64, 32 bytes | **32** | n/a | **YES** |
| `.env.example:15` | `replace-with-random-32-bytes-base64` | placeholder | 26 | 0 | NO (intended — placeholder) |
| `apps/web/src/lib/vault.ts:8` DEV_ONLY_KEK | `Buffer.alloc(32,7).toString('base64')` (44 chars) | base64, 32 bytes | **32** | 0 | **YES** |

Key consequences:
1. **CI would break.** `ci.yml:62` sets `SECRET_VAULT_KEK=$(openssl rand -hex 24)` (a 48-char HEX string — wrong encoding AND wrong length: 36 bytes as base64, 24 as hex). Under a strict base64-32 check at config load, the CI `Test`/`Coverage`/`Build @wtc/web` steps that hit `loadEnv` would throw "Invalid environment configuration. Check these keys: SECRET_VAULT_KEK". (CI is currently INERT — repo is not a git repo, no remote — but it is a staged green gate and must not be silently broken; STATUS.md/IMPLEMENTED_FILES.md treat it as the future gate. Lines 61, 63, 64 use `openssl rand -hex 24` for `SESSION_SECRET`/`AXIOMA_HANDOFF_SIGNING_SECRET`/`CSRF_SECRET` too; those are only min-length-checked so they survive, but the KEK does not.)
2. **The existing config unit test would break.** `packages/config/src/env.test.ts:9` base vector `aF3kQ9zW7pX2mR8tV5yB1nC4dH6jL0sE` base64-decodes to only **24 bytes**. Every test that calls `loadEnv({...base})` (the BILLING_PROVIDER suite at lines 16-28 and the secret-quality suite at lines 34-57) would start throwing on the KEK shape instead of for the reason under test — `npm test` (currently 64/64) would go red.
3. **The crypto/vault tests are already safe** — they construct KEKs via `randomBytes(32).toString('base64')` (exactly 32 bytes), so a strict check does not touch them. No change needed in `packages/crypto`.

**EXACT current vault expectation (the prompt's critical question):** **base64-encoded, decoding to exactly 32 bytes (256-bit).** NOT hex. Evidence: `packages/crypto/src/vault.ts:50-61` (`parseKek`: `Buffer.from(base64,'base64')` + `buf.length !== 32 → throw`) and `vault.ts:102` (`createSecretVault` re-asserts 32). The doc `docs/SECRET_VAULT_DESIGN.md:67` says "hex-encoded 64 chars", but that is a **stale design-doc divergence** — the implemented `parseKek` is base64, and `docs/ARCHITECTURE_DECISIONS.md:32` ("`SECRET_VAULT_KEK`, base64 32 bytes"), `.env.example:14-15`, and `docs/DEPLOYMENT.md:18` (`randomBytes(32).toString('base64')`) all agree on base64. **The new config check MUST be base64-32 to match the code (the authority), not hex.**

**Recommendation / concrete target fix (do these in the SAME commit as Finding 1, or CI/tests go red):**
- `.github/workflows/ci.yml:62` — change `SECRET_VAULT_KEK=$(openssl rand -hex 24)` to **`SECRET_VAULT_KEK=$(openssl rand -base64 32)`** (44 base64 chars → exactly 32 bytes; high entropy, so it also clears the prod weak-secret check if CI ever runs with `NODE_ENV=production`). Leave 61/63/64 as-is or, for consistency, switch them to `openssl rand -base64 48` (they only need min-length + entropy).
- `packages/config/src/env.test.ts:9` — replace the base `SECRET_VAULT_KEK` with a real 44-char/32-byte base64 value, e.g. a fixed `'NhrzsR35xwtgZ58wGsew17lqDqRH4cOPh6gBfWVMs8g='` (or any `randomBytes(32).toString('base64')`). Then the existing prod-suite assertions still pass for the reasons they intend.
- **Target part:** Phase 1.6 Task D — `.github/workflows/ci.yml`, `packages/config/src/env.test.ts`. (Optional consistency-only: `.env.example` could note `openssl rand -base64 32` next to the existing Node one-liner; not required.)

---

### Finding 3 — MEDIUM: the low-entropy heuristic does NOT catch a wrong-encoding/short KEK; the base64-32 shape check is the real guard
**Severity:** MEDIUM
**Evidence:** `packages/shared/src/env-guards.ts:28-37` — `isLowEntropySecret` only flags strings with `< 6` distinct chars (and only at length ≥ 12); `isPlaceholderSecret` (`:17-21`) only matches a fixed prefix list. A KEK like `openssl rand -hex 24` (48 distinct-ish hex chars) or any 16–31-char random string sails through `min(16)` + `isWeakSecret` yet is the wrong encoding/length for the vault. So the prod-only weak-secret checks at `env.ts:49-51` are necessary but NOT sufficient for the KEK — they catch `kkkk…` (test at `env.test.ts:38-40`) but not a structurally invalid KEK. The base64-32 shape check (Finding 1) is what actually enforces the vault contract.
**Recommendation:** Keep the existing prod weak-secret check AND add the all-environments base64-32 shape check; they are complementary. Do NOT replace one with the other.
**Concrete target fix:** as in Finding 1 (shape check is unconditional; `isWeakSecret` stays prod-only). No change to `isLowEntropySecret`/`isPlaceholderSecret` semantics is required for this task.
**Target part:** Phase 1.6 Task D.

---

### Finding 4 — LOW: `apps/web/src/lib/vault.ts` reads `process.env.SECRET_VAULT_KEK` directly instead of through `loadEnv`
**Severity:** LOW
**Evidence:** `apps/web/src/lib/vault.ts:14` — `requiredSecret('SECRET_VAULT_KEK', process.env.SECRET_VAULT_KEK, DEV_ONLY_KEK)`, then `parseKek(kekB64)` at line 16. It reads `process.env` directly and re-derives `SECRET_VAULT_KEY_ID` at line 15, rather than consuming the validated `loadEnv()` result. This is the same pattern as `apps/web/src/lib/csrf.tsx:11` (`process.env.SESSION_SECRET`). Today this is the ONLY runtime reader of the raw KEK env var, and it still fails closed in production via `requiredSecret` (`packages/shared/src/env-guards.ts:39-54`) + `parseKek`. But because it bypasses `loadEnv`, the new config-load shape check would NOT protect this path on its own if `loadEnv` is never called at boot — they are decoupled.
**Recommendation:** Two acceptable options: (a) keep the lazy `getVault()` but ALSO ensure `loadEnv()` runs at server startup so the base64-32 shape error surfaces at boot (recommended — fail-fast); or (b) have `getVault()` consume `loadEnv().SECRET_VAULT_KEK` so the single validated value flows through. Minimum: confirm an app-boot path calls `loadEnv()` so Finding 1's check is actually exercised in the web app, not just in unit tests.
**Concrete target fix:** add a startup `loadEnv()` invocation (e.g. in the app's server bootstrap / a `register`/instrumentation hook), or refactor `getVault()` to source the KEK from `loadEnv()`. Out of strict Task-D config scope but should be noted to the orchestrator.
**Target part:** Phase 1.6 (web wiring) — flag to orchestrator; not required to land the env.ts change.

---

### Finding 5 — INFO: Axioma HS256 signer DOES throw in production (CONFIRMED); ES256/JWKS remains a HARD BLOCKER, NOT in scope this phase
**Severity:** INFO (confirmation)
**Evidence:**
- `packages/axioma-bridge/src/handoff.ts:62-64` — `signHandoffToken()` begins with `if (process.env.NODE_ENV === 'production') { throw new Error('[axioma-handoff] HS256 dev-stub signer is disabled in production; implement the ES256/JWKS signer first'); }`. The HS256 header (`{ alg: 'HS256', typ: 'WTC-HANDOFF' }`) is only built AFTER that guard (line 65). So no HS256 token can be issued in production. Confirmed.
- Spec authority: `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:34` ("signed JWT using the ES256 algorithm"), `:46` ("`alg`: always `ES256`. Axioma MUST reject … including `HS256`"), `:254` (Axioma "reject if `alg` … is not exactly `ES256`"). ES256/JWKS signer does not exist (no ES256 file, no `jose` dep — `node:crypto` only).
- **Nothing forces ES256 now.** The prod guard throws rather than silently degrading; `env.ts:33` keeps `AXIOMA_HANDOFF_SIGNING_SECRET` `.optional()` but `env.ts:54-58` REQUIRES it (and rejects weak values) in production. No code path in env.ts/handoff.ts/vault wiring depends on ES256 being implemented to pass the current gates. `NEXT_ACTIONS.md` item 4 and STATUS.md already track ES256/JWKS as a separate session. So ES256/JWKS is a clean, documented hard blocker that stays OUT of Phase 1.6 Task D.
**Recommendation:** No change in this phase. Keep the prod-fence and the `handoff.test.ts` `alg === 'HS256'` regression assertion (per prior auditor). Do NOT attempt ES256 here.
**Target part:** out of scope (tracked separately).

---

### Finding 6 — INFO: cross-check of every `SECRET_VAULT_KEK` reader — no dangerous `loadEnv` bypass beyond Finding 4
**Severity:** INFO
**Evidence (grep `SECRET_VAULT_KEK` across repo, excluding `node_modules`, `coverage/`, `apps/web/.next/`):**
- `packages/config/src/env.ts:20,49-51` — schema declaration + prod weak-secret check (the intended validator).
- `apps/web/src/lib/vault.ts:14` — the ONE runtime reader of `process.env.SECRET_VAULT_KEK`; routes through `requiredSecret` → `parseKek` (see Finding 4).
- `packages/crypto/*` — never reads the env var; receives the KEK only as a function argument (`createSecretVault({ kek })`, `parseKek(value)`). Correct (the vault is env-agnostic).
- `packages/shared/src/env-guards.test.ts:22-23` — test-only references.
- `.env.example:15`, `.github/workflows/ci.yml:62`, `docs/*` (`SECRET_VAULT_DESIGN.md`, `ARCHITECTURE.md`, `ARCHITECTURE_DECISIONS.md`, `DEPLOYMENT.md`, `README.md`, prior handoffs) — config/docs, not runtime readers.
No code reads the KEK in a way that would seal/open secrets while bypassing `parseKek`'s 32-byte assertion. The only "bypass" is that `apps/web/src/lib/vault.ts` reads `process.env` rather than `loadEnv()` (Finding 4), which means the new config check must be backed by an actual boot-time `loadEnv()` call to protect the web path.
**Recommendation:** none beyond Findings 1, 2, 4.
**Target part:** Phase 1.6 Task D (informational).

## Decisions

- The authoritative KEK contract is the **code** (`parseKek` → base64, 32 bytes), not `docs/SECRET_VAULT_DESIGN.md:67` ("hex-encoded 64 chars"), which is stale. The new config validation MUST be **base64-32** to match the vault and the majority of docs (`ARCHITECTURE_DECISIONS.md`, `.env.example`, `DEPLOYMENT.md`). (A separate docs-drift fix to `SECRET_VAULT_DESIGN.md:67` would be good hygiene but is outside Task D.)
- The base64-32 shape check belongs in `loadEnv` for **all** environments (fail-fast at boot everywhere); the existing `isWeakSecret` check stays **production-only**. They compose, not replace.
- Because `loadEnv` and `parseKek` are decoupled today, the config check and the CI/test fixtures must change together (Finding 2) — otherwise the new check turns the currently-green `npm test` and the staged CI red.
- ES256/JWKS stays out of scope; HS256 prod-fence is verified and sufficient for now.

## Risks

1. **Regression risk (highest):** shipping the strict base64-32 check WITHOUT fixing `ci.yml:62` (`openssl rand -hex 24` → 36 bytes as base64) and `env.test.ts:9` (24 bytes) breaks `npm test` (64/64 → red) and the staged CI gate. Both must change in the same commit. Verified by decoding each value with `Buffer.from`.
2. **Decoupling risk:** `apps/web/src/lib/vault.ts` reads `process.env` directly; if no boot path calls `loadEnv()`, the new check only fires in unit tests, not in the running web app (Finding 4). Confirm/add a startup `loadEnv()`.
3. **Encoding-mismatch trap:** a future contributor copying `docs/SECRET_VAULT_DESIGN.md:67` ("hex-encoded 64 chars") could set a hex KEK; `openssl rand -hex 32` (64 chars) base64-decodes to 48 bytes and would (correctly) be REJECTED by both the new check and `parseKek`. The error message in the fix must name base64 explicitly (`openssl rand -base64 32`) to steer operators right.
4. No live-secret, server, or bot exposure from this audit — read-only; no value above was a real secret.

## Verification/tests

Tests to ADD (none run during this read-only audit; all are config/crypto, no DB/network):

| # | Test | File | Sketch |
|---|------|------|--------|
| (a) | Invalid KEK shape rejected at config load — all envs | `packages/config/src/env.test.ts` | `it('rejects a non-32-byte / non-base64 SECRET_VAULT_KEK at config load (dev and prod)')`: for `NODE_ENV` in `['development','test','production']`, `expect(() => loadEnv({ ...base, NODE_ENV, BILLING_PROVIDER: NODE_ENV==='production'?'stripe':'mock', SECRET_VAULT_KEK: 'aF3kQ9zW7pX2mR8tV5yB1nC4dH6jL0sE' /*24B*/ })).toThrow()`. Also assert the CI-style hex value `'a'.repeat(48)`-type input via `randomBytes(24).toString('hex')` throws. (Remember `__resetEnvCache()` in `beforeEach`.) |
| (a′) | Valid base64-32 KEK accepted | `packages/config/src/env.test.ts` | `expect(loadEnv({ ...base, BILLING_PROVIDER:'stripe', SECRET_VAULT_KEK: 'NhrzsR35xwtgZ58wGsew17lqDqRH4cOPh6gBfWVMs8g=' }).SECRET_VAULT_KEK).toBeDefined()` and assert it decodes to 32 bytes via the new `decodeBase64Key`. |
| (a″) | Helper unit tests | `packages/shared/src/env-guards.test.ts` | `expect(isBase64Key(randomBytes(32).toString('base64'),32)).toBe(true)`; `expect(isBase64Key('aF3kQ9zW7pX2mR8tV5yB1nC4dH6jL0sE',32)).toBe(false)` (24B); `expect(isBase64Key(randomBytes(24).toString('hex'),32)).toBe(false)` (36B); `expect(() => decodeBase64Key('xx',32)).toThrow()`. |
| (b) | Placeholder / low-entropy KEK rejected in PRODUCTION | `packages/config/src/env.test.ts` (already partly present at :38-40) | Keep `SECRET_VAULT_KEK: 'k'.repeat(24)` → throws; ADD a placeholder case `SECRET_VAULT_KEK: 'replace-with-random-32-bytes-base64'` → throws in production. (Note: once Finding 1 lands, a placeholder also fails the shape check, which is fine — it must still throw.) |
| (c) | Axioma HS256 signer throws in production | `packages/axioma-bridge/src/handoff.test.ts` | `it('refuses to sign in production (HS256 dev-stub disabled)')`: set `process.env.NODE_ENV='production'` (save/restore), `expect(() => signHandoffToken(buildHandoffClaims('u','axioma_terminal','open_journal',Date.now(),'axi-o.ma'),'secret')).toThrow(/disabled in production/)`. Keep the existing dev-path `alg==='HS256'` assertion as a regression guard. |

Placement: (a)/(a′)/(b) in `packages/config/src/env.test.ts`; (a″) in `packages/shared/src/env-guards.test.ts`; (c) in `packages/axioma-bridge/src/handoff.test.ts` (crypto vault tests already cover the byte-length reject at `vault.test.ts:43` and `__smoke__.ts:41`).

Gates RUN this session: NONE (read-only audit; no `npm`/test/build/git executed). Gates NOT RUN and why: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `ci:local` — not run because this is a read-only specification pass; the implementer that lands Findings 1–2 must run `npm test` + `npm run typecheck` + `npm run build -w @wtc/web` and confirm 64+ tests stay green AFTER the `ci.yml`/`env.test.ts` fixture fixes.

## Next actions

1. Implement Finding 1: add `isBase64Key`/`decodeBase64Key` to `packages/shared/src/env-guards.ts` (+ export in `index.ts`); add the all-env base64-32 refinement to `packages/config/src/env.ts` (import `isBase64Key` at line 5; refine outside the prod block).
2. Implement Finding 2 IN THE SAME CHANGE: `.github/workflows/ci.yml:62` → `openssl rand -base64 32`; `packages/config/src/env.test.ts:9` base `SECRET_VAULT_KEK` → a real 44-char/32-byte base64 value. Run `npm test` to confirm green.
3. Add tests (a)/(a′)/(a″)/(b)/(c) per the table.
4. Address Finding 4: ensure a boot-time `loadEnv()` runs (or have `getVault()` consume `loadEnv()`), so the new check protects the web runtime, not only unit tests.
5. (Hygiene, optional, out of Task D) fix the stale `docs/SECRET_VAULT_DESIGN.md:67` "hex-encoded 64 chars" → base64 32 bytes to match the implemented `parseKek`.
6. Do NOT implement ES256/JWKS (Finding 5) — remains a separate session per `NEXT_ACTIONS.md` item 4.
