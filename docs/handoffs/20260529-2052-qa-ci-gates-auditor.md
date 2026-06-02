# qa-ci-gates-auditor handoff

_2026-05-29 20:52. Phase 1.6 Task G read-only audit: gate inventory + environment-readiness prediction
for the orchestrator's final gate run. No code, scripts, builds, installs, tests, migrations, or git were
run; this is inventory + prediction only. The orchestrator runs the gates later and fills in actuals._

## Scope

Inventory the exact Phase 1.6 Task G gate list, map each gate to the command it actually runs and its
dependencies, and predict **RUN vs likely-NOT-RUN** in THIS environment (Windows 11, Node v24.15.0,
npm 11.x, NOT a git repo, Docker absent, local PostgreSQL 17 on :5432 with credentials unknown to the
agent, Playwright chromium installed). Flag secret/KEK env requirements (`SESSION_SECRET`,
`SECRET_VAULT_KEK`, `AXIOMA_HANDOFF_SIGNING_SECRET`) and the Phase 1.6 STRICT base64-32-byte
`SECRET_VAULT_KEK` validation's effect on test/build fixtures. Confirm `governance:check` does not exist
and recommend where it slots. Provide the RUN/NOT-RUN table format for the aggregate handoff.

## Files inspected

- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260529-1921-phase-1-5-governance-persistence-hardening.md`
- `docs/handoffs/20260529-1921-qa-ci-e2e-auditor.md`
- `docs/handoffs/20260529-1921-ci-devops-implementer.md`
- `docs/handoffs/20260529-1921-security-auth-secrets-auditor.md`
- `package.json` (root)
- `apps/web/package.json`
- `apps/worker/package.json`
- `packages/db/package.json`
- `packages/config/package.json`
- `.github/workflows/ci.yml`
- `vitest.config.ts`
- `playwright.config.ts`
- `tsconfig.json`, `tsconfig.base.json`
- `eslint.config.js`
- `.secretlintrc.json`, `.secretlintignore`
- `.env.example`
- `docker-compose.yml`
- `.gitignore`
- `packages/config/src/env.ts`, `packages/config/src/env.test.ts`, `packages/config/src/index.ts`
- `packages/shared/src/env-guards.ts`, `packages/shared/src/env-guards.test.ts`
- `packages/crypto/src/vault.ts`, `packages/crypto/src/vault.test.ts`, `packages/crypto/src/__smoke__.ts`
- `apps/web/src/lib/vault.ts`, `apps/web/src/lib/backend.ts`
- `apps/web/next.config.ts`
- `packages/db/drizzle.config.ts`, `packages/db/src/seed-cli.ts`
- `apps/worker/src/index.ts`, `apps/worker/src/tick-once.ts`
- `tests/integration/db-persistence.test.ts`, `tests/integration/csrf-coverage.test.ts`
- `tests/e2e/smoke.spec.ts`
- Glob: `packages/*/src/**/*.test.ts` (10 unit test files), `tests/**` (2 integration + e2e + 16 screenshots + `.gitkeep`), `scripts/**` (none)
- Read-only Bash (listing only): `node_modules/.bin` (bins present), Playwright browser cache, `.git` absent, `docker` not on PATH, base64-decode byte-length computation of KEK/secret fixtures.

## Files changed

None — read-only audit.

## Findings

Severity legend: CRITICAL (will break the orchestrator's run if not handled this phase) / HIGH / MEDIUM / LOW / INFO.

### Finding 1 — CRITICAL: the NEW strict base64-32-byte `SECRET_VAULT_KEK` check breaks `npm test` fixtures (env.test.ts), and the CI `openssl rand -hex 24` KEK is also not 32 bytes

- **Severity:** CRITICAL
- **Evidence:**
  - `packages/config/src/env.ts:20` — `SECRET_VAULT_KEK: z.string().min(16, 'SECRET_VAULT_KEK must be a base64 32-byte key')`. The **message already claims** base64-32-byte, but the rule only enforces `min(16)` length. Phase 1.6 adds the real check (base64-decode → exactly 32 bytes).
  - `packages/config/src/env.test.ts:9` — the production-valid base fixture is `SECRET_VAULT_KEK: 'aF3kQ9zW7pX2mR8tV5yB1nC4dH6jL0sE'`. **Computed:** that 32-char string base64-decodes to **24 bytes**, not 32. So the tests that expect `loadEnv` to **succeed** — `env.test.ts:20-23` (production + stripe) and `env.test.ts:48-52` ("accepts strong secrets + stripe in production") — will **throw** once the strict check lands. `npm test` and `npm run coverage` go RED.
  - `packages/config/src/env.test.ts:10` — `AXIOMA_HANDOFF_SIGNING_SECRET: 'Zx9V1eXR8MS3kQ7pW2tJ5yB4nC6dH0j'` decodes to **23 bytes**, and `SESSION_SECRET` (line 8) to **18 bytes** — fine for those (no 32-byte rule), but the same fixture style means if the orchestrator copies a "valid KEK" by char-length it will still be wrong. A correct 32-byte base64 KEK is **44 chars** (padded) / 43 unpadded, e.g. `Buffer.from(crypto.randomBytes(32)).toString('base64')`.
  - `.github/workflows/ci.yml:62` — `echo "SECRET_VAULT_KEK=$(openssl rand -hex 24)"`. **Computed:** `openssl rand -hex 24` emits a 48-char hex string; interpreted as base64 it decodes to ~36 bytes, NOT 32. If the strict check ever runs in the `gates` job env (it loads env for migrate/seed/test), CI breaks too. (CI is inert here — not a git repo — but must be fixed for parity.)
  - `apps/web/src/lib/vault.ts:8` — `DEV_ONLY_KEK = Buffer.alloc(32, 7).toString('base64')` → **44 chars, decodes to exactly 32 bytes** (the only correctly-sized KEK fixture in the repo). It is all-same-byte (low entropy) but `parseKek` accepts it and `requiredSecret` returns it only in non-production.
- **Impact:** When Phase 1.6 adds the strict KEK check at config load, the existing `env.test.ts` "happy-path" fixtures become invalid 24-byte keys → `npm test`/`coverage` fail unless the fixtures are updated **in the same change**. This is the single highest-risk coupling for Task G.
- **Recommendation:** When the strict check is added to `env.ts`, in the SAME change update every KEK fixture to a real 32-byte base64 value, e.g. replace `env.test.ts:9` with a 44-char base64 string such as `crypto.randomBytes(32).toString('base64')` (a literal like `'qPv3K9mLrT2wY8xN5bC7dF1gH4jS6aZ0eU3iO9pR2tw='`-style — 44 chars). Add an explicit negative test asserting a 24-byte base64 KEK is rejected. Fix `ci.yml:62` to `SECRET_VAULT_KEK=$(openssl rand -base64 32)` (44 chars → 32 bytes) so CI parity holds. Decide and document **ordering**: run the strict length/base64 check, then `isWeakSecret`, so error messages stay meaningful (the existing `'k'.repeat(24)` low-entropy test at `env.test.ts:39` decodes to 18 bytes and would now fail on length first, not entropy — keep a separate, correctly-sized low-entropy vector like a 32-byte base64 of a repeated byte to still exercise the entropy path).
- **Target part:** G

---

### Finding 2 — HIGH: the strict KEK check at config load affects `npm test` ONLY — NOT `npm run build -w @wtc/web` (build never calls `loadEnv`; the vault is lazy)

- **Severity:** HIGH (scoping clarity — prevents the orchestrator from chasing a build failure that won't happen, or missing that the *test* path is the real exposure)
- **Evidence:**
  - `loadEnv` (`packages/config/src/env.ts:67`) is imported by **exactly one** non-node_modules file: `packages/config/src/env.test.ts:2`. Grep for `loadEnv` across `**/*.{ts,tsx}` returns only `env.ts`, `env.test.ts`, `index.ts` (the re-export). **No `apps/web` or `apps/worker` runtime file calls `loadEnv`.**
  - The web app reads KEK directly, lazily: `apps/web/src/lib/vault.ts:12-17` `getVault()` is created on first use, calling `requiredSecret('SECRET_VAULT_KEK', process.env.SECRET_VAULT_KEK, DEV_ONLY_KEK)` then `parseKek(kekB64)`. `parseKek` (`packages/crypto/src/vault.ts:50-61`) already enforces base64→32 bytes at the crypto layer. `apps/web/src/lib/backend.ts:17-19` documents the same lazy fail-closed pattern for `DATABASE_URL` so `next build` (production-mode, no runtime secrets) is not broken at module load.
- **Impact:** `npm run build -w @wtc/web` does NOT exercise `loadEnv`, so the new strict config check cannot fail the build. The build's only env touchpoints are lazy and already 32-byte-strict via `parseKek`. The exposure surface of the new check is the Vitest `env.test.ts` fixtures (Finding 1) — plus any NEW test the orchestrator adds for the strict rule.
- **Recommendation:** Treat `npm test` as the gate that must be re-greened alongside the strict-KEK change; do not expect a build break. If Phase 1.6 wires `loadEnv` into an app boot path, re-evaluate — but as of this audit it is test-only.
- **Target part:** G

---

### Finding 3 — HIGH: `governance:check` does not exist anywhere; recommend slotting it FIRST in `ci:local` and as the first gate after `secret:scan` in `ci.yml`

- **Severity:** HIGH
- **Evidence:** Grep `governance:check|check-governance|governance-check` across the repo → **No matches** (0). `package.json:11-26` scripts: `build, typecheck, test, test:watch, coverage, secret:scan, lint, dev, dev:worker, db:generate, db:migrate, db:seed, e2e, check:core, ci:local` — **no `governance:check`**. `package.json:26` `ci:local` chains: `check:core && lint && typecheck && typecheck -w @wtc/web && secret:scan && test && build -w @wtc/web` (no governance, no coverage, no e2e — intentionally offline-fast per the ci-devops handoff). No `scripts/` directory exists (Glob `scripts/**` → none); the orchestrator will create `scripts/check-governance.mjs`.
- **Impact:** The Task G list puts `governance:check` first, but it is unrunnable until the script + npm script are added this phase.
- **Recommendation:**
  1. Add to root `package.json`: `"governance:check": "node scripts/check-governance.mjs"` (`.mjs`, zero-dep, like `check:core`'s zero-install ethos — must run before `npm ci` ideally, certainly without workspace symlinks).
  2. Slot it **first** in `ci:local`: `"ci:local": "npm run governance:check && npm run check:core && npm run lint && ..."` so the cheapest, no-install gate fails fastest.
  3. In `.github/workflows/ci.yml`, add a `Governance check` step in the `gates` job — natural position is **right after `Secret scan`** (`ci.yml:56-57`) and before the ephemeral-secrets/migrate steps, since it needs neither a DB nor secrets. Mirror the comment style.
  4. Because it is a NEW script, the orchestrator must observe it green this session before claiming it (SESSION_PROTOCOL §6).
- **Target part:** G

---

### Finding 4 — INFO: environment is READY for the offline gate set — deps installed, chromium present, prior build/coverage artifacts exist

- **Severity:** INFO (readiness confirmation)
- **Evidence (read-only listing):**
  - `node_modules/` present; `node_modules/.bin` contains `vitest, eslint, playwright, playwright-core, secretlint, tsc, tsx, drizzle-kit, next` (+ `.cmd`/`.ps1` shims) → no `npm ci`/install required to RUN the gates (lockfile reproducibility is a separate concern; STATUS records a clean `npm ci`).
  - Playwright browser cache (`%LOCALAPPDATA%/ms-playwright`) lists `chromium-1140, chromium-1208, chromium-1223, chromium_headless_shell-1208/1223, ffmpeg, winldd` → chromium installed (matches host fact); `npx playwright install chromium` not strictly needed but harmless.
  - `apps/web/.next` exists (prior build) and `coverage/` exists (prior coverage run) — consistent with the Phase 1.5 green run; not blockers.
  - `node --version` → `v24.15.0`. `.git` ABSENT (not a git repo). `docker` NOT on PATH. 12 Vitest files total (10 `packages/*/src/*.test.ts` + 2 `tests/integration/*.test.ts`) — matches STATUS's "12 files / 64 tests".
- **Impact:** Every gate except those needing a real Postgres `DATABASE_URL` (NOT in the Task G list) can RUN here.
- **Recommendation:** None — informational baseline for the prediction table below.
- **Target part:** G

---

### Finding 5 — MEDIUM: `npm test` (Vitest) does NOT require any secret/KEK env to load; it only fails on the env.test.ts fixtures once the strict rule lands

- **Severity:** MEDIUM
- **Evidence:** `vitest.config.ts:8` includes `packages/**/*.test.ts` + `tests/integration/**/*.test.ts`, env `node`, no global setup, no env-injection. The only secret-aware tests construct env inline: `env.test.ts` passes a literal `base` object to `loadEnv({...})` (does not read `process.env`); `env-guards.test.ts` calls `requiredSecret(...)` with explicit `nodeEnv` args; `vault.test.ts`/`crypto __smoke__` generate KEKs via `randomBytes(32).toString('base64')` (always valid 32 bytes). `db-persistence.test.ts` uses a hard-coded `SealedSecret` literal and PGlite — no KEK, no `DATABASE_URL`. So Vitest needs **no** `SESSION_SECRET`/`SECRET_VAULT_KEK`/`AXIOMA_HANDOFF_SIGNING_SECRET` in the ambient environment to run.
- **Impact:** The orchestrator does NOT need to export secrets to run `npm test`. The ONLY way the new strict KEK rule breaks tests is via the in-file `env.test.ts` fixtures (Finding 1), which are under the orchestrator's control in the same change.
- **Recommendation:** Run `npm test` with no special env; expect green once `env.test.ts` KEK fixtures are corrected to 32-byte base64. The `crypto` vault tests and smokes are already strict-clean (use `randomBytes(32)`), so they need no change.
- **Target part:** G

---

### Finding 6 — MEDIUM: `npm run build -w @wtc/web` needs NO runtime secrets and is all-dynamic; main risk is time/flakiness on Windows, not env

- **Severity:** MEDIUM
- **Evidence:** `apps/web/package.json:8` `build = next build`. `apps/web/next.config.ts:6-23` `transpilePackages` lists all 15 `@wtc/*` workspace packages + `eslint.ignoreDuringBuilds: true` (so a lint error cannot fail the build — lint is a separate gate). `backend.ts:17-19` and `vault.ts:6-8` document the **lazy fail-closed** pattern precisely so `next build` (production NODE_ENV, no runtime `DATABASE_URL`/KEK) compiles. STATUS confirms the prior build PASS and that the app is all-dynamic (every route server-rendered on demand except `/_not-found`) — not a regression.
- **Impact:** Build will RUN. Risk is duration (Next 15 + React 19 + 15 transpiled TS packages) and occasional Windows `.next` file-lock/EPERM if a dev server or prior build holds handles.
- **Recommendation:** Ensure no `next dev` (port 3000) or e2e dev server (port 3100) is running against `apps/web/.next` during the build. Budget ~1-3 min cold. No secrets needed.
- **Target part:** G

---

### Finding 7 — MEDIUM: `npm run e2e` (Playwright) self-starts a dev server on :3100 and needs chromium + a free port; it does NOT run the production build

- **Severity:** MEDIUM
- **Evidence:** `playwright.config.ts:20-26` `webServer.command = 'npm run dev:e2e -w @wtc/web'` (`apps/web/package.json:7` = `next dev --port 3100`), `url = http://localhost:3100`, `timeout: 150_000`, `reuseExistingServer: !process.env.CI`. Tests: `tests/e2e/smoke.spec.ts` — 6 specs × 2 projects (desktop+mobile) = 10 cases (matches STATUS "10/10"); per-test `timeout: 90_000`, `expect timeout: 15_000`. Login uses in-memory demo creds (`user@wtc.local` / `wtc-demo-pass-123`) → no `DATABASE_URL`/secrets needed (in-memory backend is the default when `DATABASE_URL` is unset). chromium is installed (Finding 4). Because it runs `next dev` (not `build && start`), production code paths are NOT exercised (carried over from the prior qa handoff Finding 8).
- **Impact:** e2e will RUN here. Risks: (a) port 3100 already occupied → server start fails; (b) `reuseExistingServer` is true locally (CI unset), so a STALE :3100 dev server could mask a code change — start from clean; (c) first compile of dev routes can be slow → the 150s server timeout is the guard; (d) Windows cold Next dev compile can approach the per-test 90s on the heaviest route.
- **Recommendation:** Before e2e, confirm nothing is already serving :3100 (and that you WANT a fresh server — kill any stale one so `reuseExistingServer` doesn't reuse stale code). Run after the build gate so source is warm-ish. Budget ~1-2 min. No secrets needed.
- **Target part:** G

---

### Finding 8 — LOW: `secret:scan` globs `**/*` and may be slow / may scan build+coverage artifacts; `lint` and `typecheck` are env-free and fast

- **Severity:** LOW
- **Evidence:** `package.json:17` `secret:scan = secretlint "**/*"`. `.secretlintignore` excludes `node_modules, .next, dist, out, build, coverage, pgdata, test-results, playwright-report, package-lock.json, *.png, *.ico, *.tsbuildinfo` — so the heavy artifact dirs ARE excluded; scan stays clean per STATUS. `lint` (`package.json:18`) = `eslint . --max-warnings 0`, ESLint 9 flat config, **not** type-aware (`eslint.config.js:1-3` deliberately omits `parserOptions.project`) → fast, env-free; ignores migrations + artifact dirs (`eslint.config.js:10-22`). `typecheck` (`package.json:13`) = `tsc --noEmit -p tsconfig.json` over `packages/*/src` + `tests` (excludes `apps/web`); `typecheck -w @wtc/web` = `tsc --noEmit` in the app. All three need no secrets/DB.
- **Impact:** RUN, fast. Only watch item: a fresh untracked file containing a high-entropy string could trip `secret:scan` (e.g. a new 32-byte base64 KEK literal added to `env.test.ts` per Finding 1). The recommend-recommend literal is a test fixture, not a real secret, but secretlint's preset may still flag a base64 blob.
- **Recommendation:** If the strict-KEK fixture literal (Finding 1) trips `secret:scan`, either generate it at test time (`crypto.randomBytes(32).toString('base64')` inside the test, as `vault.test.ts` already does) — preferred, avoids a static secret-looking literal entirely — or add a narrow `.secretlintignore`/inline allow. Prefer the runtime-generated approach so no secret-shaped literal is committed.
- **Target part:** G

---

### Finding 9 — INFO: `check:core` is zero-install and env-free; `db:migrate`/`db:seed` against real Postgres remain NOT RUN but are NOT in the Task G list

- **Severity:** INFO
- **Evidence:** `package.json:25` `check:core` runs 7 `node --experimental-strip-types packages/*/src/__smoke__.ts` smokes (entitlements, crypto, analytics, audit, auth, axioma-bridge, billing) — no install, no env, no DB; the crypto smoke generates valid 32-byte KEKs via `randomBytes(32)` so it is strict-clean. `packages/db/package.json:9-13`: `db:migrate = drizzle-kit migrate`, `db:seed = tsx src/seed-cli.ts`; `seed-cli.ts:5-7` throws if `DATABASE_URL` unset; `drizzle.config.ts:7` deliberately has **no localhost fallback** (`process.env.DATABASE_URL ?? ''`) so migrate won't touch the unknown-cred PG17. These two are **NOT** in the Task G gate list (consistent with STATUS "real db = NOT RUN, creds unknown; Docker absent").
- **Impact:** `check:core` RUN. `db:migrate`/`db:seed` correctly out of scope for Task G; the PGlite integration test in `npm test` covers the equivalent SQL.
- **Recommendation:** Do not add real-Postgres migrate/seed to the Task G run (no creds, Docker absent). If desired later, follow `NEXT_ACTIONS.md` Part C with an operator-provided `DATABASE_URL`.
- **Target part:** G

## Decisions

1. Predict RUN for all 9 Task G gates that have a script today, plus `governance:check` (RUN only **after** the orchestrator adds `scripts/check-governance.mjs` + the npm script this phase). No Task G gate is inherently NOT-RUN in this environment — the only NOT-RUN items (real `db:migrate`/`db:seed`) are explicitly **outside** the Task G list.
2. The strict `SECRET_VAULT_KEK` base64-32-byte validation is a **`npm test` concern, not a build concern** (Finding 2): the build never calls `loadEnv`; the lazy vault path is already 32-byte-strict via `parseKek`. The orchestrator must update `env.test.ts` KEK fixtures in the same change (Finding 1) and re-green `npm test` + `coverage`.
3. `governance:check` slots first in `ci:local` and immediately after `secret:scan` in `ci.yml` (no DB/secret dependency) (Finding 3).
4. No secrets need to be exported to run `npm test`/`build`/`e2e`/`coverage` locally — all secret-aware tests construct values inline; the web build + e2e use lazy fail-closed env + the in-memory demo backend (Findings 5-7).

## Risks

1. **KEK fixture drift (CRITICAL, Finding 1):** if the strict check lands without fixing `env.test.ts:9` (24-byte fixture) and `ci.yml:62` (`openssl rand -hex 24` → 36 bytes), `npm test`/`coverage` (and CI parity) break. Mitigation: fix fixtures in the same change; prefer runtime-generated KEKs in tests.
2. **secret:scan vs new fixture (LOW, Finding 8):** a committed 32-byte base64 KEK literal may trip secretlint; generate it at test time instead.
3. **e2e port/stale-server (MEDIUM, Finding 7):** `reuseExistingServer` is true locally; a stale :3100 server can mask code or a busy port can fail startup. Start clean.
4. **Windows build/e2e timing (MEDIUM, Findings 6-7):** cold Next 15 compile of 15 transpiled packages; `.next` file locks if a dev server is running. Ensure no concurrent server.
5. **CI is inert (INFO):** `.github/workflows/ci.yml` does not run (not a git repo, no remote). `npm run ci:local` is the local equivalent and does NOT currently include `governance:check`, `coverage`, or `e2e` — the orchestrator runs those gates individually for Task G.

## Verification/tests

No commands were run (read-only audit). All predictions are from file inspection (Read/Grep/Glob) + read-only
listing (Bash `ls`/`node -e` byte-length math). Predicted per-gate RUN/NOT-RUN for the orchestrator's Task G run:

| Gate (Task G order) | Command actually run | Depends on | Needs secrets? | Needs DB? | Predicted | Reason / note |
|---|---|---|---|---|---|---|
| `npm run governance:check` | `node scripts/check-governance.mjs` (NEW — does not exist yet) | the new `.mjs` + npm script being added this phase | No | No | **RUN (after add)** | 0 matches in repo today (Finding 3). Will RUN once script + `"governance:check"` are added; slot first in `ci:local`, after `secret:scan` in `ci.yml`. |
| `npm run check:core` | 7× `node --experimental-strip-types packages/*/src/__smoke__.ts` | Node 24 type-stripping only | No | No | **RUN** | Zero-install, env-free; crypto smoke uses `randomBytes(32)` (strict-clean). |
| `npm run lint` | `eslint . --max-warnings 0` (ESLint 9 flat, not type-aware) | `node_modules` (present) | No | No | **RUN** | Fast; artifacts + migrations ignored. |
| `npm run typecheck` | `tsc --noEmit -p tsconfig.json` (packages + tests, excl. apps/web) | `node_modules`, tsc | No | No | **RUN** | Env-free. |
| `npm run typecheck -w @wtc/web` | `tsc --noEmit` in `apps/web` | `node_modules`, tsc | No | No | **RUN** | Env-free. |
| `npm test` | `vitest run` (10 unit + 2 integration files = 12; PGlite integration) | `node_modules`, PGlite (WASM, no Docker) | No (inline) | No (PGlite) | **RUN — but expect RED until KEK fixtures fixed** | env.test.ts base KEK = 24 bytes; strict check makes the success-path tests throw (Findings 1, 5). Fix fixtures in same change. |
| `npm run secret:scan` | `secretlint "**/*"` | `node_modules`, `.secretlintignore` | No | No | **RUN** | Clean per STATUS; watch for a new base64 KEK literal (Finding 8). |
| `npm run build -w @wtc/web` | `next build` | `node_modules`, transpilePackages | No (lazy) | No (lazy) | **RUN** | All-dynamic; lazy fail-closed env; NOT affected by the strict KEK check (Finding 2). Windows timing risk. |
| `npm run coverage` | `vitest run --coverage` (`@vitest/coverage-v8`) | same as `npm test` | No (inline) | No (PGlite) | **RUN — same RED risk as `npm test`** | v8 provider; no thresholds enforced (baseline ~25% stmts / 61% branch). Fails iff `npm test` fails (KEK fixtures). |
| `npm run e2e` | `playwright test` → self-starts `next dev --port 3100` | `node_modules`, chromium (installed), free :3100 | No | No (in-memory demo) | **RUN** | 6 specs × 2 projects = 10. Start clean (stale-:3100/`reuseExistingServer` + Windows compile timing — Finding 7). |
| _(not in Task G)_ `db:migrate`/`db:seed` real PG | `drizzle-kit migrate` / `tsx seed-cli.ts` | real `DATABASE_URL` | — | Yes | **NOT RUN** | PG17 creds unknown to agent; Docker absent; no localhost fallback by design. Equivalent SQL covered by PGlite integration test. Out of Task G scope. |

**Recommended RUN/NOT-RUN table for the aggregate phase handoff** (per SESSION_PROTOCOL §6 — pre-filled
prediction; orchestrator overwrites the Result column with observed actuals, and must NOT mark green unless
observed green this session):

| Gate | Predicted (this audit) | Result (orchestrator fills in) |
|---|---|---|
| `npm run governance:check` | RUN after script added | _TBD_ |
| `npm run check:core` | PASS | _TBD_ |
| `npm run lint` | PASS | _TBD_ |
| `npm run typecheck` | PASS | _TBD_ |
| `npm run typecheck -w @wtc/web` | PASS | _TBD_ |
| `npm test` | PASS only after KEK fixtures fixed | _TBD_ |
| `npm run secret:scan` | PASS | _TBD_ |
| `npm run build -w @wtc/web` | PASS | _TBD_ |
| `npm run coverage` | PASS only after KEK fixtures fixed | _TBD_ |
| `npm run e2e` | PASS (10/10) | _TBD_ |
| `db:migrate`/`db:seed` (real Postgres) | NOT RUN — creds unknown, Docker absent (out of Task G scope) | NOT RUN (reason) |

## Next actions

1. (CRITICAL) When adding the strict `SECRET_VAULT_KEK` base64-32-byte check to `packages/config/src/env.ts:20`,
   update the KEK fixtures in `packages/config/src/env.test.ts:9` (and align `.github/workflows/ci.yml:62` to
   `openssl rand -base64 32`) in the SAME change; prefer runtime-generated 32-byte base64 in tests. Add a
   negative test for a 24-byte base64 KEK. Define check ordering (length/base64 then `isWeakSecret`).
2. (HIGH) Add `"governance:check": "node scripts/check-governance.mjs"` to root `package.json`; prepend it to
   `ci:local`; add a `Governance check` step after `Secret scan` in `ci.yml`. Observe it green this session.
3. (HIGH) Run gates in the offline-fast order: governance:check → check:core → lint → typecheck (×2) →
   secret:scan → test → build -w @wtc/web → coverage → e2e. Build before e2e (warm source); ensure no
   server holds :3000/:3100 or `.next`.
4. (MEDIUM) Re-green `npm test` + `npm run coverage` after the KEK fixture fix; expect NO build break from the
   strict check (build never calls `loadEnv`).
5. (INFO) Do NOT add real-Postgres `db:migrate`/`db:seed` to the Task G run (no creds, Docker absent); mark them
   NOT RUN with reason in the aggregate handoff.
