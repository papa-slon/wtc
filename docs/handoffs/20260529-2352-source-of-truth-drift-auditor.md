# source-of-truth-drift-auditor handoff

_2026-05-29 23:52. READ-ONLY audit for Phase 1.7 (Part E prep). No code run, no files modified except this handoff. Every claim cited file:line and confirmed by reading the live file._

## Scope

Find ALL remaining source-of-truth drift so the operator's **Part A** cleanup is exact and minimal. Five sub-targets, each verified against the live tree (not trusted from prior handoffs):

1. `docs/MVP_SCOPE.md` — must not claim the TradingView web UI is DB-backed, nor that backtester jobs / the current scheduler really use `job_queue`.
2. `docs/NEXT_ACTIONS.md` — flag items already closed by Phase 1.6.1 (boot-time `loadEnv`, real-PG harness) and the stale "Vitest 64" + coverage numbers.
3. `docs/SECRET_VAULT_DESIGN.md` — align env names to reality (`SECRET_VAULT_KEK`, `SECRET_VAULT_KEY_ID`); do not claim `packages/crypto/src/vault.ts` reads env if it takes the KEK as an argument; base64-32 not hex.
4. `apps/worker/src/index.ts` + `jobs.ts` header comments — confirm the Phase-1.6.1 corrections landed (cron-style direct calls; `job_queue` RESERVED/unconsumed; not a durable queue).
5. Repo-wide grep with a verdict for each hit: `Vitest 64`, `25.07`, `61.26`, `boot-time loadEnv` near `pending`, `WTC_VAULT`, `schema/ops.ts`, `job_queue` near `production`, `TV web` near `DB-backed`.

Ground truth re-verified: TV/LMS web UI still in-memory + synchronous (`apps/web/src/app/(app)/app/indicators/page.tsx:18,32,39` — no `await`, "storage: in-memory (demo)" badge); DB TV repo `submitTvRequest` exists and stores a real `Date` (`packages/db/src/repositories.ts:229` `requestedAt: new Date(now)`); the memory TV service still uses `requestedAt: number` (`packages/tradingview-access/src/index.ts:13,65`); `job_queue` RESERVED/unconsumed (`packages/db/src/schema.ts:220-233`).

## Files inspected

- `docs/MVP_SCOPE.md` (full)
- `docs/NEXT_ACTIONS.md` (full)
- `docs/SECRET_VAULT_DESIGN.md` (full)
- `docs/STATUS.md` (full — for the authoritative current test/coverage counts)
- `docs/DATA_MODEL.md:1-12, 838-849` (§8 Ops header `schema/ops.ts` pointer)
- `apps/worker/src/index.ts` (full)
- `apps/worker/src/jobs.ts` (full)
- `packages/crypto/src/vault.ts` (full — `parseKek` / `createSecretVault` signatures)
- `apps/web/src/lib/vault.ts` (full — the real env reader)
- `packages/config/src/env.ts` (full — the canonical env schema)
- `apps/web/instrumentation.ts` (full — boot-time `loadEnv`)
- `tests/integration/db-real-postgres.test.ts:1-40` (opt-in real-PG harness header)
- `packages/db/src/repositories.ts` (`submitTvRequest` / `requestedAt`)
- `packages/tradingview-access/src/index.ts:11-67` (memory TV service `requestedAt: number`)
- `apps/web/src/app/(app)/app/indicators/page.tsx:1-40` (live sync TV call sites + badge)
- `packages/shared/src/env-guards.ts:45-48`, `packages/shared/src/index.ts:7` (`isBase64Key`)
- `docs/handoffs/20260529-1921-integration-risk-auditor.md:1-60` (the 10 sync call sites + Date-vs-number claim)
- Greps (repo-wide, `.next`/`coverage` excluded where noted): `Vitest 64`, `25.07`, `61.26`, `WTC_VAULT`, `schema/ops.ts`, `job_queue`, `boot-time loadEnv`, `SECRET_VAULT_KEK`/`SECRET_VAULT_KEY_ID`, TV-web/DB-backed family.

## Files changed

None — read-only audit

## Findings

### 1. [MEDIUM] (Part A) SECRET_VAULT_DESIGN.md uses non-existent env-var names `WTC_VAULT_KEK_<keyId>` / `WTC_VAULT_ACTIVE_KEY_ID`

The implemented env names are **`SECRET_VAULT_KEK`** and **`SECRET_VAULT_KEY_ID`**, confirmed in `packages/config/src/env.ts:20-21`, `apps/web/src/lib/vault.ts:14-15`, `apps/web/src/lib/db-store.ts:99`, `.env.example:15-16`, and `docs/DEPLOYMENT.md:61`. The design doc still names a per-keyId scheme that exists nowhere in code.

- **Evidence:** `docs/SECRET_VAULT_DESIGN.md:45` `└─ stored in env var WTC_VAULT_KEK_{keyId}`; `:138` `WTC_VAULT_KEK_<keyId>=<base64-32-bytes>`; `:146-147` `WTC_VAULT_KEK_kek-2026-01` / `WTC_VAULT_KEK_kek-2026-07`; `:156` `WTC_VAULT_ACTIVE_KEY_ID=kek-2026-01`; `:196,197,198,204` (rotation procedure reuses `WTC_VAULT_KEK_kek-2026-07` / `WTC_VAULT_ACTIVE_KEY_ID`).
- **Verdict:** MUST-FIX (drifted env names; an operator following this doc sets variables the app never reads, and the vault fails closed).
- **Recommendation:** Reconcile to the single-active-key reality. The current code holds **one** active KEK (`SECRET_VAULT_KEK`) + its id (`SECRET_VAULT_KEY_ID`); retired keys are passed in code via `createSecretVault(active, previous[])`, not via per-keyId env vars. Proposed text:
  - `:45` → `└─ provided to the vault as the active KEK (env: SECRET_VAULT_KEK; its id: SECRET_VAULT_KEY_ID)`
  - `:138` → `SECRET_VAULT_KEK=<base64-32-bytes>   # the active KEK; SECRET_VAULT_KEY_ID=<keyId> names it`
  - Either keep the multi-version `WTC_VAULT_KEK_<keyId>` scheme **explicitly labelled `TARGET — not implemented`** (current = single active `SECRET_VAULT_KEK` + `SECRET_VAULT_KEY_ID`; retired keys supplied in-code as `previous`), or rewrite §"KEK Key Management"/§"Key Rotation Procedure" to the single-active-key model. A TARGET banner is the minimal honest fix.

### 2. [MEDIUM] (Part A) SECRET_VAULT_DESIGN.md falsely states `packages/crypto/src/vault.ts` reads env itself

`packages/crypto/src/vault.ts` reads **no** environment variable. `parseKek(base64: string): Buffer` takes the KEK as a **string argument** (`vault.ts:50`); `createSecretVault(active: VaultKey, previous: VaultKey[] = [])` takes a **`VaultKey` argument** (`vault.ts:101`). The ONLY env reader is `apps/web/src/lib/vault.ts:14-15` (`process.env.SECRET_VAULT_KEK` / `process.env.SECRET_VAULT_KEY_ID`), which then calls `parseKek` + `createSecretVault`.

- **Evidence:** `docs/SECRET_VAULT_DESIGN.md:153` `\`packages/crypto/src/vault.ts\` reads a second env var:` followed by `:156` `WTC_VAULT_ACTIVE_KEY_ID=kek-2026-01`; contrast with `packages/crypto/src/vault.ts:50` `export function parseKek(base64: string): Buffer` and `:101` `export function createSecretVault(active: VaultKey, previous: VaultKey[] = [])` — both pure, env-free (only `node:crypto`, per the `:13` header "Zero dependencies").
- **Verdict:** MUST-FIX (false attribution of env reads to the crypto package).
- **Recommendation:** Replace `:153` with: `The active KEK and its id are read from the environment by the app boundary (\`apps/web/src/lib/vault.ts\`: \`SECRET_VAULT_KEK\` + \`SECRET_VAULT_KEY_ID\`) and passed to \`createSecretVault({ keyId, kek })\`. \`packages/crypto/src/vault.ts\` is pure: \`parseKek(base64)\` and \`createSecretVault(active, previous)\` take the KEK as arguments and read no env.` Update the "Active key selection" example to use `SECRET_VAULT_KEY_ID`.

### 3. [MEDIUM] (Part A) SECRET_VAULT_DESIGN.md still carries hex KEK residue (must be base64-32, not hex)

The doc was partly corrected (the NOTE at `:141-143` and the `VaultRecord` field comments already say base64 / "base64-encoded 44 chars" at `:67`), but three hex-flavoured lines remain. The implementation is strictly base64→32-byte: `parseKek` does `Buffer.from(base64,'base64')` and rejects length ≠ 32 (`packages/crypto/src/vault.ts:50-61`); `isBase64Key` mirrors it (`packages/shared/src/env-guards.ts:45-48`); `env.ts:43` enforces `isBase64Key(SECRET_VAULT_KEK, 32)`.

- **Evidence:** `docs/SECRET_VAULT_DESIGN.md:197` `3. Keep old env var: WTC_VAULT_KEK_kek-2026-01=<old hex>` — explicit "hex". Also the residual `VaultRecord` field comments `:82-84` describe `iv`/`tag`/`wrappedDek`/`ciphertext` as `hex:` whereas the implemented `SealedSecret` uses **base64** blobs (`packages/crypto/src/vault.ts:36-41,69` `.toString('base64')`); and the doc's `VaultRecord` interface (`:78-89`) does not match the implemented `SealedSecret` shape (`v, keyId, wrappedDek, payload, aad?` — no separate `iv`/`tag`/`ciphertext` fields).
- **Verdict:** MUST-FIX for `:197` (hex). LOW/INFO for the `VaultRecord`-vs-`SealedSecret` interface drift at `:78-89`/`:82-84` (design-doc interface predates the implementation; recommend a TARGET/"implemented shape differs" note).
- **Recommendation:** `:197` → `3. Keep old env var (previous KEK), still base64-32` (drop "hex"; and if the single-active-key rewrite of Finding 1 is taken, this whole step becomes "supply the retired key as a \`previous\` VaultKey"). For `:78-89`, add one line: `Implemented shape: see \`SealedSecret\` in \`packages/crypto/src/vault.ts\` (\`{ v, keyId, wrappedDek, payload, aad? }\`, base64 blobs with iv|tag|ciphertext concatenated inside \`wrappedDek\`/\`payload\`). The hex/4-field \`VaultRecord\` above is the original design sketch.` Note `2228-security-runtime-config-auditor.md:240-246` already recommended the `:138` hex→base64 fix; `:138` currently reads base64 (corrected), but `:197` and the field comments were missed.

### 4. [MEDIUM] (Part A) NEXT_ACTIONS.md stale test/coverage counts ("Vitest 64", "25.07% / 61.26%")

Authoritative current counts (per `docs/STATUS.md:30,32`, Phase 1.6.1) are **84 passed / 5 skipped** and coverage **26.96% stmts / 63.77% branch**. NEXT_ACTIONS.md still shows the Phase-1.5 baseline.

- **Evidence:** `docs/NEXT_ACTIONS.md:20` `npm test                         # Vitest 64 (incl. PGlite DB integration: transactions + unique index)`; `:23` `npm run coverage                 # coverage baseline (25.07% stmts / 61.26% branch)`. Current truth: `docs/STATUS.md:30` `npm test (Vitest) → 84 passed / 5 skipped (89) across 14 files`; `:32` `npm run coverage → 26.96% stmts / 63.77% branch`.
- **Verdict:** MUST-FIX (stale). The assignment's stated "actual 84/5" matches STATUS.md; "Vitest 64" is wrong.
- **Recommendation:** Either update `:20` → `# Vitest 84 passed / 5 skipped (incl. PGlite DB integration + opt-in real-PG harness, skipped without REAL_POSTGRES_DATABASE_URL)` and `:23` → `# coverage baseline (26.96% stmts / 63.77% branch)`, OR (preferred, lower-maintenance) make the counts non-authoritative: replace the hard numbers with `# see docs/STATUS.md for current pass/skip + coverage numbers`. STATUS.md is already the single source for these.

### 5. [LOW] (Part A) NEXT_ACTIONS.md lists already-closed Phase-1.6.1 items without a "done" marker

Two follow-ups under "Phase 1.6 follow-ups" / Part C are now **done** and should be struck or annotated; otherwise the operator re-does completed work. (The Part C **real-Postgres gate itself stays NOT RUN — correct — only the prerequisite harness/boot work is done.**)

- **Evidence:**
  - `docs/NEXT_ACTIONS.md:65-67` "Boot-time `loadEnv()` so the new base64-32 `SECRET_VAULT_KEK` config check protects the web runtime, not just unit tests (today `apps/web/src/lib/vault.ts` reads `process.env` directly…)". **CLOSED:** `apps/web/instrumentation.ts:10-14` now calls `loadEnv()` at server boot (Node runtime guard), confirmed by `docs/STATUS.md:13-16`. (The parenthetical "today … reads `process.env` directly" is still literally true for the lazy `getVault()` path, but the headline ask — boot-time `loadEnv` — is done; it is now defence-in-depth, not pending.)
  - `docs/NEXT_ACTIONS.md:30-41` "Real Postgres DB gate (Part C — the one gate NOT run; needs credentials)" + `:40` "then add a postgres-js-backed integration test (the CI workflow already stages this step)". **PARTIALLY CLOSED:** the opt-in harness already exists — `tests/integration/db-real-postgres.test.ts:1-15,37-38` (`const run = !!process.env.REAL_POSTGRES_DATABASE_URL`; skipped without it), covering migrate/seed/FK-cascade/unique-entitlement/cross-connection concurrent `grantProduct`/pool-teardown (`docs/STATUS.md:22-24`). The "add a postgres-js test" action is done; only **running it against real Postgres** remains (NOT RUN, no creds).
- **Verdict:** stale (items closed). Keep the real-Postgres **gate** as NOT RUN until credentials (correct as written at `:30-41` and `docs/STATUS.md:35`).
- **Recommendation:** Annotate `:65-67` as `DONE in 1.6.1 (apps/web/instrumentation.ts); lazy getVault() retained as fail-closed backstop` and reword `:40` to `the postgres-js harness already exists (tests/integration/db-real-postgres.test.ts, opt-in via REAL_POSTGRES_DATABASE_URL); only running it against real PG remains`. Do NOT delete the Part E item at `:45-50` — it is still open (see Finding 6).

### 6. [INFO] (Part A / context for Part E) NEXT_ACTIONS.md Part E item is still ACCURATE — the 10 sync call sites are genuinely open

The 1921 handoff's "10 synchronous TV/LMS call sites" claim is **still true** on the live tree (Part E not done), so `docs/NEXT_ACTIONS.md:45-50` must NOT be struck. Spot-checked: `apps/web/src/app/(app)/app/indicators/page.tsx:18` `tvService.submitRequest(user.id, parsed.data.username, access.allowed, Date.now());` — **no `await`** — and `:32` `const requests = tvStore.list()...` — no `await`; the page still shows the in-memory badge (`:39` `storage: in-memory (demo)`, `:40` "not yet DB-persisted … TV/LMS DB wiring is Phase 1.5").

- **Evidence:** `docs/NEXT_ACTIONS.md:45-50` (Part E) vs live `apps/web/src/app/(app)/app/indicators/page.tsx:18,32,39-40`; the call-site table in `docs/handoffs/20260529-1921-integration-risk-auditor.md:48-60`.
- **Note on the `requestedAt` type mismatch (assignment caveat — verified):** the **DB repo is already correct** (`packages/db/src/repositories.ts:229` writes `requestedAt: new Date(now)`); the **memory service** is the one with `requestedAt: number` (`packages/tradingview-access/src/index.ts:13,65`). So the Part E refactor must normalise the memory `number` to the DB `Date`, not the reverse. NEXT_ACTIONS.md:48 phrases this as "`requestedAt` Date-vs-number normalisation" — accurate.
- **Verdict:** already-correct (leave as-is). INFO only.

### 7. [MEDIUM] (Part A) DATA_MODEL.md §8 header still asserts the non-existent `packages/db/src/schema/ops.ts` as a bare (un-TARGET'd) claim

The §8.5 body and §11 lines were TARGET-labelled in prior passes, but the **§8 Ops-context header pointer** at `:843` is a bare "Package file:" claim with no TARGET banner. There is no `schema/ops.ts` file — the whole schema is the single `packages/db/src/schema.ts` (confirmed: `job_queue` is defined there at `schema.ts:220-233`).

- **Evidence:** `docs/DATA_MODEL.md:843` `**Package file**: \`packages/db/src/schema/ops.ts\`` (header for §8 Ops Context, which then documents `audit_logs`, `job_queue`, etc. — all of which live in the single `schema.ts`). Contrast `:1232` which IS correctly TARGET-labelled ("today both belong to the single `packages/db/src/schema.ts`…"). The `2228-docs-contract-drift-auditor.md:199` Finding 6 family flagged `schema/ops.ts` as recurring residual drift across DATA_MODEL.md.
- **Verdict:** MUST-FIX (`schema/ops.ts` does not exist; bare claim, not TARGET-labelled).
- **Recommendation:** `:843` → `**Package file**: \`packages/db/src/schema.ts\` (single schema file today; a future per-context split could introduce \`packages/db/src/schema/ops.ts\` — TARGET, not implemented).` This was flagged for sub-target (5) `schema/ops.ts`; it is the one current-doc `schema/ops.ts` hit not yet labelled (the `docs/STATUS.md:20`, `BACKTESTER_DISTRIBUTION_PLAN.md:414`, and `DATA_MODEL.md:1232` hits are already TARGET-labelled; handoff hits are historical).

### 8. [LOW] (Part A) MVP_SCOPE.md says backtester/scheduler jobs are "stored in `job_queue`" — `job_queue` is RESERVED/unconsumed

Two cells imply work is persisted to `job_queue`, but nothing enqueues/dequeues it (the worker uses cron-style direct repo calls + `tradingview_access_tasks`). These are MOCK/deferred-labelled cells (not a hard "wired NOW" claim), which is why the prior docs-contract-drift auditor classified them as borderline, not NEEDS-FIX — but for source-of-truth exactness they should carry a RESERVED note.

- **Evidence:** `docs/MVP_SCOPE.md:124` `| \`/app/bots/:bot/backtester\` — Tortila | Real UI (job form) / **MOCK** runner | Job stored in \`job_queue\`; runner not wired until \`BACKTESTER_DISTRIBUTION_PLAN.md\` approved |`; `:156` `| Expiry scheduler task design | Real (job defined) / **MOCK** execution | Job type exists in \`job_queue\`; worker cron not running at MVP |`. Truth: `packages/db/src/schema.ts:220` "no code enqueues or dequeues job_queue rows yet"; `docs/INTEGRATION_MAP.md:285`, `docs/DATA_MODEL.md:928`, `docs/IMPLEMENTED_FILES.md:45-47` all say RESERVED/unconsumed. (Prior verdict that these are not false-CURRENT: `docs/handoffs/20260529-2228-docs-contract-drift-auditor.md:255-256`.)
- **Verdict:** LOW — TARGET-adjacent; recommend adding "(RESERVED/unconsumed)" for full honesty, but not a false current claim.
- **Recommendation:** `:124` → append `… runner not wired (the \`job_queue\` table is RESERVED/unconsumed) until BACKTESTER_DISTRIBUTION_PLAN.md approved`; `:156` → `Job type defined; \`job_queue\` is RESERVED/unconsumed and the worker cron is not running at MVP`. Also note `:233` "Worker cron | Skeleton | Job queue table and type definitions; actual cron loop not running in dev" is acceptable as-is (says "table … definitions", not "consumed"). NOTE: backtester being a **type/memory model only** is already correctly stated (MVP_SCOPE.md:203,232 "no runner"; `docs/BACKTESTER_DISTRIBUTION_PLAN.md:414` "type/job model only"; no `backtest_jobs` table) — no MVP_SCOPE drift on that point.

### 9. [INFO] (Part A) MVP_SCOPE.md does NOT over-claim TV web UI as DB-backed — already correct

The assignment's hypothesis was that MVP_SCOPE.md might say the TV web UI is DB-backed. It does not. §2.6 TradingView (`:147-158`) describes the manual queue/grants as "Real" UI without claiming DB persistence, and there is no "DB-backed" cell for the TV web UI anywhere in the file.

- **Evidence:** `docs/MVP_SCOPE.md:147-158` (TradingView Indicators table — UI "Real", no persistence claim); repo-wide TV-web/DB-backed grep returns no current-doc over-claim (the only "DB-backed; fully implemented" string lives in `docs/STATUS.md:57` inside a **historical changelog of things that were corrected**, and in handoffs — both allowed/historical). `docs/handoffs/20260529-2228-docs-contract-drift-auditor.md:195` confirms "No `| Real | DB-backed; fully implemented |` cell remains."
- **Verdict:** already-correct (no change to MVP_SCOPE.md for this point).

### 10. [INFO] (Part A) Worker header comments (index.ts + jobs.ts) — Phase-1.6.1 corrections LANDED, no drift

Both worker file headers are now truthful. Quoted current text:

- `apps/worker/src/index.ts:1-7`: "WTC worker — cron-style scheduler (setInterval). When DATABASE_URL is set it makes direct DB repository calls (entitlement expiry reconciliation, TradingView revoke sweep + task queue, integration-health snapshot) via the @wtc/db repositories. Without DATABASE_URL it runs the in-memory demo loop (dev only). **The `job_queue` table is RESERVED / not yet consumed (nothing enqueues or dequeues it) — a durable queue is a future/TARGET design, not the current mechanism.**"
- `apps/worker/src/jobs.ts:1-8`: "… The current worker is a cron-style setInterval scheduler (apps/worker/src/index.ts) that makes direct repository calls (reconcileAllEntitlements / sweepTvExpiry / recordHealthCheck); these pure helpers back the in-memory demo path. **The `job_queue` table is RESERVED / not yet consumed — nothing enqueues or dequeues it; a durable queue is a future/TARGET design, not the current mechanism.**"

No "durable queue replaces the in-memory demo loop in production" text remains (the false phrasing the 1921/2228 worker auditors flagged is gone — see `docs/handoffs/20260529-2228-phase-1-6-1-gate-truth-governance-drift.md:75-77`).

- **Evidence:** `apps/worker/src/index.ts:1-7`, `apps/worker/src/jobs.ts:1-8` (read in full).
- **Verdict:** already-correct (no change).

### 11. [INFO] (Part A) Grep sub-target results — full table with verdicts

`Vitest 64`:
- `docs/NEXT_ACTIONS.md:20` — **MUST-FIX** (stale; Finding 4). Only current-doc hit.

`25.07` / `61.26`:
- `docs/NEXT_ACTIONS.md:23` — **MUST-FIX** (stale current claim; Finding 4).
- `docs/STATUS.md:68` — historical (Phase 1.6 changelog explaining the dip; keep).
- `docs/STATUS.md:73` — **MUST-FIX-adjacent**: line is labelled "Phase 1.5 baseline (prior session)" so it is historical-by-context, BUT it states `npm test 64/64 … Coverage 25.07 / 61.26` as a bare baseline. Verdict: historical (allowed) — it is explicitly a prior-session baseline; leave unless the operator wants every count to defer to the top-of-file current numbers.
- `docs/handoffs/20260529-2052-*.md:147`, `20260529-1921-*.md:92` — historical handoffs (allowed).

`WTC_VAULT`:
- `docs/SECRET_VAULT_DESIGN.md:45,138,146,147,156,196,197,198,204` — **MUST-FIX** (drifted env names; Findings 1-3). These are the only current-doc hits.
- `docs/OPEN_QUESTIONS.md:245,267` — inspected indirectly; treat as TARGET/historical only if they reference the design doc's scheme (recommend the operator skim; not load-bearing for Part E).
- `docs/handoffs/20260529-phase0-ecosystem-security-auditor.md:112`, `20260529-2228-security-runtime-config-auditor.md:240,246` — historical handoffs (the 2228 one is the auditor that *recommended* the base64 fix; allowed).

`schema/ops.ts`:
- `docs/DATA_MODEL.md:843` — **MUST-FIX** (bare claim, not TARGET-labelled; Finding 7).
- `docs/DATA_MODEL.md:1232`, `docs/BACKTESTER_DISTRIBUTION_PLAN.md:414`, `docs/STATUS.md:20` — already TARGET-labelled (allowed).
- `docs/handoffs/20260529-2228-*.md` (many lines) — historical (allowed).

`job_queue` near `production`:
- `apps/worker/src/index.ts:5`, `apps/worker/src/jobs.ts:5` — RESERVED/unconsumed phrasing, correct (Finding 10).
- `docs/ARCHITECTURE.md:283,296`, `docs/INTEGRATION_MAP.md:285`, `docs/DATA_MODEL.md:928,950`, `docs/IMPLEMENTED_FILES.md:45-47`, `docs/STATUS.md:82`, `packages/db/src/schema.ts:220` — all explicitly say RESERVED / "does NOT poll" / "not yet consumed" (allowed/correct).
- `docs/MVP_SCOPE.md:124,156` — **LOW** (borderline; Finding 8).
- `docs/handoffs/*` + `docs/handoffs/20260529-phase0-*.md` (SKIP LOCKED / "replaces in-memory demo loop in production") — historical handoffs / superseded phase-0 design (allowed; the false "replaces … in production" lives only in 1921/2228 *quotes of the old code*, not in current source).

`TV web` near `DB-backed`:
- `docs/STATUS.md:57` — historical changelog of corrections (allowed; Finding 9).
- `docs/CONTRACTS/tradingview-access.md` (per `2228-docs-contract-drift-auditor.md:195`: now reads "Mock/in-memory (web) … NOT DB-backed yet") — already corrected (allowed).
- `docs/OPEN_QUESTIONS.md:72` "TradingView web UI" — describes the *manual TradingView.com invite-only page*, not the WTC web UI; not a persistence claim (allowed).
- All other hits — historical handoffs (allowed).

`boot-time loadEnv` near `pending`:
- **No current-doc hit pairs the phrase with "pending."** The literal phrase appears only as `` `loadEnv()` `` in `docs/NEXT_ACTIONS.md:65` (a follow-up bullet) and `docs/STATUS.md:13` / `docs/IMPLEMENTED_FILES.md:61` (describing it as DONE). The NEXT_ACTIONS.md:65 bullet is the stale "still pending"-framed item — see Finding 5. Verdict: the bullet's framing is stale (boot-time `loadEnv` is DONE via `apps/web/instrumentation.ts`), but it is not literally next to the word "pending."

## Decisions

No LMS Option-1/Option-2 decision is in this auditor's scope (that is the integration/decision auditor's call). Audit decisions taken here:

- Treated `docs/STATUS.md` as the **single authoritative source** for current test/coverage counts (84/5; 26.96/63.77) — NEXT_ACTIONS.md must defer to it (Finding 4).
- Classified MVP_SCOPE.md `job_queue` cells as **LOW/borderline**, not MUST-FIX, consistent with the prior docs-contract-drift auditor (`2228-docs-contract-drift-auditor.md:255-256`): they are MOCK/deferred-labelled, not false-CURRENT — but recommended a RESERVED annotation for exactness.
- Confirmed the **DB TV repo is already type-correct** (`new Date(now)`); the Part E normalisation burden is on the **memory service** (`requestedAt: number`), not the DB — so NEXT_ACTIONS.md Part E stays open and its wording is accurate (Finding 6).

## Risks

- **Crypto-config drift is the highest-impact item (Findings 1-3):** an operator who follows SECRET_VAULT_DESIGN.md sets `WTC_VAULT_KEK_*`/`WTC_VAULT_ACTIVE_KEY_ID`, leaves `SECRET_VAULT_KEK` unset, and the app fails closed in production (or silently uses the dev fallback in non-prod). This is a deployment-time foot-gun masquerading as a docs nit.
- **Stale counts (Finding 4)** erode trust in the gate record; a reviewer who runs `npm test` and sees 84/5 against a doc claiming 64 may assume the suite is broken or the doc is unmaintained.
- **No risk from the worker headers or MVP_SCOPE TV claims** — those are already truthful (Findings 9, 10).
- **Out-of-scope but adjacent:** the `VaultRecord`-vs-`SealedSecret` interface drift (Finding 3, LOW) is design-doc-vs-implementation; not load-bearing for Part E but will confuse a future crypto maintainer.

## Verification/tests

Read-only audit — **no** npm/test/build/git commands were run (per HARD RULES). Every finding was confirmed by reading the cited file:line directly:
- Env-name truth: `packages/config/src/env.ts:20-21`, `apps/web/src/lib/vault.ts:14-16`, `.env.example:15-16` (via grep), `docs/DEPLOYMENT.md:61`.
- Crypto signatures (no env read): `packages/crypto/src/vault.ts:13,50,101`.
- Current counts: `docs/STATUS.md:30,32` (84/5; 26.96/63.77).
- Boot-time loadEnv landed: `apps/web/instrumentation.ts:10-14`.
- Real-PG harness exists + opt-in: `tests/integration/db-real-postgres.test.ts:1-15,37-38`.
- Sync TV call sites still open: `apps/web/src/app/(app)/app/indicators/page.tsx:18,32,39-40`.
- DB repo `requestedAt` is a Date: `packages/db/src/repositories.ts:229`; memory service is number: `packages/tradingview-access/src/index.ts:13,65`.
- Worker headers truthful: `apps/worker/src/index.ts:1-7`, `apps/worker/src/jobs.ts:1-8`.
- `job_queue` RESERVED in source: `packages/db/src/schema.ts:220-233`.
- `schema/ops.ts` non-existent (single `schema.ts`): `docs/DATA_MODEL.md:843` claim vs `packages/db/src/schema.ts:220` reality.

The real-Postgres gate remains **NOT RUN** (no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; Docker absent) — unchanged and correct.

## Next actions

Operator Part A cleanup, in priority order (all docs-only; no code change implied by these findings):

1. **SECRET_VAULT_DESIGN.md** (Findings 1-3, MUST-FIX): replace `WTC_VAULT_KEK_<keyId>`/`WTC_VAULT_ACTIVE_KEY_ID` with `SECRET_VAULT_KEK`/`SECRET_VAULT_KEY_ID` (single active key; retired keys as in-code `previous`, or label the multi-version scheme `TARGET — not implemented`); fix `:153` to say the **app boundary** (`apps/web/src/lib/vault.ts`) reads env and `packages/crypto/src/vault.ts` is pure (KEK passed as arg); drop "hex" at `:197` and add an "implemented shape = `SealedSecret`, base64" note near `:78-89`.
2. **NEXT_ACTIONS.md counts** (Finding 4, MUST-FIX): set `:20` to 84 passed / 5 skipped and `:23` to 26.96% / 63.77%, OR make both defer to `docs/STATUS.md` (preferred).
3. **DATA_MODEL.md:843** (Finding 7, MUST-FIX): change the §8 "Package file" pointer from `schema/ops.ts` to `schema.ts` with a `schema/ops.ts = TARGET, not implemented` note.
4. **NEXT_ACTIONS.md stale closed items** (Finding 5): annotate the boot-time `loadEnv` bullet (`:65-67`) as DONE in 1.6.1 (`apps/web/instrumentation.ts`), and reword `:40` so "add a postgres-js test" reads as already-done (harness exists; only running it against real PG remains). Keep the real-Postgres gate NOT RUN and keep the Part E item (`:45-50`) — both still accurate.
5. **MVP_SCOPE.md:124,156** (Finding 8, LOW): append "(`job_queue` RESERVED/unconsumed)" to the two backtester/scheduler cells for full source-of-truth exactness.
6. **No change** to worker headers, MVP_SCOPE TV-UI claims, or the DB TV repo — verified truthful/correct (Findings 6, 9, 10).
