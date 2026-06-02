# Phase 2.9 / Phase Group 6 — Axioma non-blocked surface: ES256-into-bridge wiring + staging/prod fence + jti replay store (aggregate handoff)

_2026-05-30, epoch `20260530-2230`. Operator-authored aggregate per [`SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md) §4.
Driven by a **5 read-only auditor fan-out (agents-before-edits, Rule 1)** via one Workflow run (`wf_0515a123-c96`)
→ operator-orchestrated **serial** implementation (not a git repo, no worktrees, no parallel writers). **5 per-agent
handoff files** at this epoch, every one cited below. No SSH / live server / live bot / live exchange / Stripe charge /
TradingView automation / **Axioma production handoff**. **Not production-ready.** Fifth phase-group window in the operator's
continuous program (follows Phase 2.8 / PG3+PG4+PG5-followup, epoch `20260530-2100`)._

## Scope

PG6 (Axioma non-blocked surface) from [`EXECUTION_PLAN_MASTER.md`](../EXECUTION_PLAN_MASTER.md) W7 / [`ROADMAP_MASTER.md`](../ROADMAP_MASTER.md) §6 —
the **UNBLOCKED** Axioma work only; the three terminal CTAs stay disabled (B4):

- **DB wave first — migration 0004 (`axioma_handoff_jti_revocations`).** A single db-architect migration wave on
  `packages/db`, BEFORE its consumers, adding exactly one additive table (the durable jti replay store from
  [`AXIOMA_HANDOFF_TOKEN_SPEC.md`](../AXIOMA_HANDOFF_TOKEN_SPEC.md) §Replay Prevention). 0000–0003 untouched.
- **`consumeJti` replay store.** Pure repository primitives in `repositories.ts` — `recordHandoffJti` (issuance),
  `consumeHandoffJti` (atomic single-use), `revokeHandoffJtisByUser` (entitlement/account-delete sweep),
  `purgeExpiredHandoffJtis` (worker cleanup). Worker `dbTick` runs the purge after the TV sweep.
- **ES256 wired into the bridge behind a STAGING+PROD fence (not only prod-fenced).** A new pure `resolveHandoffSigner`
  (the fence) + a `createAxiomaBridge` factory that signs with an INJECTED `HandoffSigner`. `@wtc/config` gains
  `APP_ENV` + the ES256 key vars + a staging/prod superRefine. The fence: ES256 when keyed (any env); staging|production
  with no key → **throw** (HS256 dev stub forbidden); dev/test → HS256 stub.
- **jti-replay + ES256/fence tests** (PGlite integration + pure unit, generated P-256 key).

**B4 stays open:** the real EC P-256 key is **not provisioned** (OP) and `journal_server` endpoint shapes are
**unconfirmed** (EXT), so the three CTAs (Download / Open-Journal / OTC account-link) remain **disabled dev-placeholders**,
the ES256 *activation* is **NOT RUN/TARGET** (wired + unit-tested with a generated key only), and the web-layer signer
resolver + Open-Journal/consume routes are **not built** (would be dead code until B4). The
`axioma_account_links` plaintext-OTC → `link_nonce_hash` refactor stays **TARGET/B4** — deliberately NOT in 0004.

**Migration:** 0004 (one table; 40 → **41 tables**).

## Agents launched (5 per-agent handoffs — all closed; every one cited)

Read-only audit fan-out (one Workflow run `wf_0515a123-c96`; all 5 returned, none left running):
1. `ecosystem-axioma-bridge-auditor` → [`…-ecosystem-axioma-bridge-auditor.md`](20260530-2230-ecosystem-axioma-bridge-auditor.md) — fence is prod-only today (F1), `createEs256Signer` unwired (F2), no jti table/repos (F3), keys not in env.ts (F4), missing jti audit codes (F5), stale INTEGRATION_MAP path/var (F6/F7), CTA + hard-boundary confirmed intact (F8/F9), contract doc bump (F10), account_links OTC stays TARGET (F11). Design: pure `resolveHandoffSigner` + injected signer; package stays pure.
2. `ecosystem-security-auditor` → [`…-ecosystem-security-auditor.md`](20260530-2230-ecosystem-security-auditor.md) — **staging fence absent (F-01 CRITICAL)**, ES256 keys not in env.ts (F-02), no replay store + missing audit codes (F-03), bridge unwired (F-04), key-exposure paths safe (F-05), alg-confusion preserved (F-06), HS256-secret prod requirement now internally inconsistent (F-07), consume+audit in-txn at the route (F-08), async-isReplayed footgun (F-10), atomic env.ts change (F-11), audit naming (F-12).
3. `ecosystem-db-architect` → [`…-ecosystem-db-architect.md`](20260530-2230-ecosystem-db-architect.md) — 40→41 (F-01), jti uuid PK caller-supplied (F-02), **no FK on sub** (F-03), two indexes (F-04), full Drizzle DDL (F-05), four repo signatures (F-06), single-atomic-UPDATE consume no-txn-wrapper (F-07), audit codes underscore convention (F-08), record = pure no-audit (F-09), 0004 jti-only (F-11), purge in worker (F-12).
4. `ecosystem-platform-architect` → [`…-ecosystem-platform-architect.md`](20260530-2230-ecosystem-platform-architect.md) — APP_ENV (ADR-016) (F1), keys in env.ts (F2), signer-resolution placement (F3), audit codes (F4), 0004 scope (F5), INTEGRATION_MAP fix (F6), worker purge (F7), handoff.ts purity (F8), CTA constraint (F9), DB-wave-first ordering + spine-file list.
5. `ecosystem-tests-runner` → [`…-ecosystem-tests-runner.md`](20260530-2230-ecosystem-tests-runner.md) — table/repos/fence/wiring/codes/keys findings (F-01..F-06), **PGlite cross-connection limitation → skipIf (F-07)**, exact test-file placement, full gate sequence, `retries:2` carry-forward, CTAs-stay-disabled-in-e2e, NOT-RUN ledger.

## Cross-auditor conflicts resolved (operator decisions)

1. **Audit-code naming.** Spec uses multi-dot `axioma.account_link.jti.consume`; db-architect (D-6) wants underscore
   consistency with the existing `axioma.*` codes. **Decision: underscore — `axioma.handoff_jti_consume` /
   `_replay` / `_revoke`** (consistency with every existing `axioma.*` code; `handoff_jti` is also more accurate than
   `account_link.jti` since the jti serves both open_journal and account_link). Spec divergence noted for a Phase-3 cleanup.
2. **Does `consumeHandoffJti` write its own audit?** security (F-08) wants atomic consume+audit; db-architect (F-09)
   wants a pure primitive (route writes audit). **Decision: pure primitives, no inline audit** — matches the closest
   precedent (`insertWebhookEventOnce`, a consume-once primitive that does NOT audit; the billing *route* audits). There
   is **no live caller yet** (consume/issue/revoke routes are B4/TARGET), so inventing actor semantics now would be
   premature. The audit *codes* are pre-registered; the **route-level in-txn audit (security F-08) is the binding
   requirement for the B4 consume route**. `consumeHandoffJti` still returns `sub` so the future route can audit truthfully.
3. **`APP_ENV` value set / name.** security `[dev,staging,prod]`; platform `[dev,test,staging,prod]`. **Decision:
   `APP_ENV: enum(['development','test','staging','production']).default('development')`** (name = platform-architect
   ADR-016; includes `test` to mirror NODE_ENV's axis). Fence = `APP_ENV ∈ {staging, production}`.
4. **F-07 (remove the HS256-secret production requirement).** security wants it removed (it's required-but-unused once
   ES256 is active). **Decision: KEEP it for now** (defense-in-depth; `signHandoffToken` still prod-throws; removing it
   churns `env.test.ts` and risks a fail-closed regression if `APP_ENV` is unset in a `NODE_ENV=production` deploy).
   Tracked as a Phase-3 cleanup once `APP_ENV` is the established deploy axis.
5. **JWKS route → `loadEnv()`?** auditors suggested routing the keys through `loadEnv()`. **Decision: KEEP the JWKS route
   + loader on raw `process.env`** — `loadEnv()` requires `DATABASE_URL`/`SESSION_SECRET`/`KEK`, so calling it from the
   public JWKS route would 500 in dev/demo (no DB). The env.ts additions are still validated at **boot** (instrumentation
   `loadEnv()`), which is the real consumer. No route regression.
6. **Web-layer signer resolver (`getAxiomaSigner`).** **Decision: NOT built** (dead-code-avoidance — the PG4/PG11
   precedent). It lands with the B4 Open-Journal/consume route. PG6 delivers the *fence + bridge wiring* (the unblocked,
   testable core) and the *boot-time config validation*.

## Files changed

**DB wave (single-writer on `packages/db`; migration 0004):**
- `packages/audit/src/audit.ts` — `AUDIT_ACTIONS` += `axioma.handoff_jti_consume`, `axioma.handoff_jti_replay`, `axioma.handoff_jti_revoke` (underscore convention; comment explains the spec dot-form divergence). For the future B4 routes; the jti repos are pure (no inline audit).
- `packages/db/src/schema.ts` — new `axiomaHandoffJtiRevocations` table (after `terminalLicenseEvents`): `jti uuid PK` (caller-supplied, no `defaultRandom`), `sub uuid NOT NULL` (NO FK — survives user deletion), `issued_at`/`expires_at` notNull, `used_at`/`revoked_at` nullable, `revoke_reason text`; indexes `ahjr_expires_at_idx`, `ahjr_sub_idx`.
- `packages/db/migrations/0004_overconfident_frightful_four.sql` (generated) — one `CREATE TABLE` + 2 `CREATE INDEX`. 0000–0003 untouched. `db:generate` → **41 tables**, "No schema changes".
- `packages/db/src/repositories.ts` — `lt` added to the drizzle import; new Axioma jti section: `recordHandoffJti` (pure insert), `consumeHandoffJti` (single atomic conditional `UPDATE … WHERE jti=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now RETURNING {sub}`; 0 rows → follow-up SELECT categorizes `not_found`/`already_used`/`revoked`/`expired`), `revokeHandoffJtisByUser` (sweeps only live rows), `purgeExpiredHandoffJtis` (delete `expires_at < now − bufferMs`, default 1h). Exported via the `export *` barrel.
- `apps/worker/src/index.ts` — `dbTick` destructures + calls `purgeExpiredHandoffJtis(db, now)` after `sweepTvExpiry`; `handoffJtisPurged` added to the worker health-check detail + log line.

**Bridge wave (`packages/axioma-bridge` — stays a zero-dependency pure package):**
- `packages/axioma-bridge/src/signer.ts` (new) — `HandoffSigner` abstraction + pure `resolveHandoffSigner({deploymentEnv, es256KeyPem?, es256KeyId?, hs256Secret?})` (the fence: ES256 when keyed; staging|production no-key → throw; dev/test → HS256 stub; none → throw) + `isRealDeployment`. NEVER reads `process.env`.
- `packages/axioma-bridge/src/bridge.ts` — `AxiomaBridgeOptions` (injected `signer: HandoffSigner` + optional `recordJti`); new `createAxiomaBridge(opts)` (signs via the injected signer, records the jti BEFORE handing out the token); `createMockAxiomaBridge` is now a thin dev wrapper (HS256 signer via `resolveHandoffSigner`). `getProductState`/`beginAccountLink` unchanged (honest placeholder; real journal data is B4).
- `packages/axioma-bridge/src/index.ts` — barrel exports `resolveHandoffSigner`, `isRealDeployment`, `createAxiomaBridge`, `HandoffSigner`, `DeploymentEnv`, `ResolveHandoffSignerOptions`, `AxiomaBridgeOptions`.

**Config wave (spine, serialized):**
- `packages/config/src/env.ts` — `APP_ENV: enum(['development','test','staging','production']).default('development')`; `AXIOMA_HANDOFF_SIGNING_KEY`/`AXIOMA_HANDOFF_KEY_ID` optional; superRefine: `APP_ENV ∈ {staging,production}` ⇒ both ES256 vars required (config-load half of the fence; bridge enforces again at sign-time). HS256-secret production requirement KEPT (defense-in-depth; F-07 deferred).
- `.env.example` — `APP_ENV` documented; ES256 key vars documented (secret:scan-safe, no literal PEM markers).

**Tests:**
- `packages/axioma-bridge/src/signer.test.ts` (new, **12**) — fence (dev/test→HS256 ok; staging/prod no-key→throw; keyed→ES256 any env; no-material→throw; `isRealDeployment`); `createAxiomaBridge` ES256 round-trip (token verifies against `publicJwk`; jti recorded before issuance; no-entitlement→throw+no-record); HS256→ES256-verifier `wrong_alg`.
- `tests/integration/db-axioma-jti.test.ts` (new, **9** + 1 real-PG skip) — record/consume-once/replay/expired/not_found/revoked; `revokeHandoffJtisByUser` (live-only); `purgeExpiredHandoffJtis` (buffered); `describe.skipIf(!REAL_POSTGRES_DATABASE_URL)` cross-connection consume race (PGlite is single-connection — honest gap).
- `packages/config/src/env.test.ts` (+**4**) — APP_ENV staging/prod requires the ES256 key pair (throws without; passes with both; dev default doesn't require).

**Docs (owned-doc truth):**
- `docs/INTEGRATION_MAP.md` §6.2 — JWKS path `/api/axioma/.well-known/jwks.json` → `/.well-known/axioma-jwks.json`; env var `AXIOMA_BRIDGE_URL` → `AXIOMA_BRIDGE_API_TOKEN` (third-cycle fix, F6/F7).
- `docs/CONTRACTS/axioma-bridge.md` — status header + version → 1.2.0 (ES256 wired into bridge, staging/prod-fenced; jti store landed 0004; activation TARGET).
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md` — note: jti store landed (migration 0004); audit codes use the underscore convention.
- `docs/PRODUCTION_BLOCKERS.md` B4 — the 3 WTC-side items (ES256 wire + jti table + consumeJti) marked DONE; CTAs + P-256 key + endpoint shapes stay open.
- `docs/OPEN_QUESTIONS.md` — Q-15 (Axioma replay-check Option A vs B) + Q-16 (HS256-secret deprecation once APP_ENV is the deploy axis).
- `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md` — operator truth (serialize-last).

## Findings → fixes (summary)

- **F-01 (CRITICAL, staging fence absent).** The old `NODE_ENV==='production'` guard let a staging deployment at
  `NODE_ENV=development` silently sign with the unverifiable HS256 stub. **Fixed** by `resolveHandoffSigner` keyed on
  `APP_ENV` (deployment axis): staging|production with no ES256 key now **throws** at signer resolution AND at config
  boot (env.ts superRefine). Defense-in-depth: `signHandoffToken` keeps its `NODE_ENV=production` throw.
- **F-02/F-03/F-04 (no wiring / no store).** `createEs256Signer` is now reachable via `createAxiomaBridge` (injected
  signer); the durable `axioma_handoff_jti_revocations` store + 4 repos land in migration 0004; keys formalized in env.ts.
- **Package purity preserved.** `@wtc/axioma-bridge` stays zero-dep: the fence takes `deploymentEnv`/keys as params; the
  web/server layer is the only place that would read env (deferred with the B4 route).
- **CTAs stay disabled (B4); hard boundary intact.** No CTA enabled; `getProductState`/account-link unchanged; the token
  claim set still carries no exchange keys / password / raw Axioma JWT (the `handoff.test.ts` regression guard stays green).

## Decisions

1. Migration 0004 = `axioma_handoff_jti_revocations` ONLY (additive; 40→41). `axioma_account_links` OTC refactor stays TARGET/B4.
2. jti repos are **pure primitives** (no inline audit); route-level in-txn audit is the binding requirement for the B4 consume/issue/revoke routes (codes pre-registered, underscore convention).
3. `sub` is `uuid NOT NULL` with **no FK** — rows survive user deletion (audit/replay evidence); the app sweeps via `revokeHandoffJtisByUser`.
4. `consumeHandoffJti` is a single atomic conditional UPDATE (TOCTOU-free); a follow-up SELECT only *categorizes* a failure (does not change the decision).
5. Fence axis = new `APP_ENV` (distinct from NODE_ENV); ES256 required in staging|production at both signer-resolution and config-boot. `@wtc/axioma-bridge` stays pure.
6. HS256-secret production requirement KEPT (defense-in-depth; F-07 deferred to Phase 3). JWKS route stays on raw `process.env` (no dev/demo boot-throw). Web signer resolver NOT built (dead-code-avoidance; B4).
7. B4 real activation (P-256 key + endpoint shapes + CTAs + consume/Open-Journal routes) stays NOT RUN/TARGET. **No migration beyond 0004.**

## Risks

- **`APP_ENV` defaults to `development`** — a real deploy that forgets `APP_ENV=production` would not trigger the ES256
  requirement (but `signHandoffToken` still prod-throws, and there is no live signing caller yet). Mitigation: documented
  in `.env.example`; the deploy runbook must set `APP_ENV`. Tracked.
- **PGlite cannot prove cross-connection consume atomicity** — the serial PGlite tests prove the rejection logic; the
  true two-pool race is `skipIf(!REAL_POSTGRES_DATABASE_URL)` (TARGET; B1). Honest gap.
- **`consumeHandoffJti` has no live caller yet** (the consume route is B4) — it exists as the tested unblocked primitive;
  its route-level audit lands with B4. The audit codes are registered but unemitted until then (near-100% repo coverage
  keeps the primitive from being silently dead).
- **HS256-secret required-but-unused in production** (F-07, accepted) — harmless; deferred cleanup.
- All surfaces still render the honest labelled demo state here (no `DATABASE_URL`); **PGlite is not a substitute for
  real-PG acceptance (B1)** — unchanged.

## Verification/tests — gates RUN vs NOT RUN (per SESSION_PROTOCOL.md §6)

| # | Gate | Result |
|---|------|--------|
| 1 | `npm run check:core` | **PASS** (7 smokes; incl. `@wtc/axioma-bridge handoff: 7 checks`) |
| 2 | `npm run lint` | **PASS** (`--max-warnings 0`, exit 0) |
| 3 | `npm run typecheck` (packages) | **PASS** |
| 4 | `npm run typecheck -w @wtc/web` | **PASS** |
| 5 | `npm run secret:scan` | **PASS** (clean — after rewording the `.env.example` ES256 example to drop the literal PEM markers) |
| 6 | `npm test` (Vitest) | **PASS — 394 passed / 8 skipped (402)** across 37 files (+24 vs 2.8's 370: signer 12, db-axioma-jti 9, env +4 — 1 of the 25 new is the real-PG skip) |
| 7 | `npm run coverage` | **PASS — 27.2% stmts / 74.32% branch** (↑ from 26.21 / 73.49) |
| 8 | `npm run db:generate -w @wtc/db` | **PASS — 41 tables (`axioma_handoff_jti_revocations` 7 cols / 2 idx / 0 fk); "No schema changes"** (0004 in sync) |
| 9 | `npm run build -w @wtc/web` | **PASS — app routes compile; `/.well-known/axioma-jwks.json` intact; `ƒ Middleware 35.2 kB`** |
| 10 | `npm run e2e` (Playwright) | **PASS — 36/36** (4.9 min; the terminal `smoke.spec.ts:198` "hard-boundary callout + DISABLED dev-placeholder buttons" test passed — CTAs confirmed still disabled; `retries:2` carried for the known dev-only Server-Action recompilation race; trailing `[WebServer]` lines are benign dev-server teardown, exit 0) |
| 11 | `npm run governance:check` | **PASS — 0 errors, 1 allowlisted historical warning** (current phase `20260530-2230`; 5 cited per-agent handoffs all present; max 5 ≤ 5; 147 handoff files / 14 aggregates) |
| — | `db:migrate` / `db:seed` / real-PG harness (incl. the jti cross-connection race) | **NOT RUN** — no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; Docker absent (B1). |
| — | **B4 Axioma real activation** (provisioned EC P-256 key, confirmed `journal_server` endpoint shapes, Download/Open-Journal/OTC routes, CTA enable, `account_links` OTC→hash migration) | **NOT RUN / TARGET** — OP+EXT blocked. ES256 path wired + unit-tested with a GENERATED key only. |
| — | **B2 Stripe test-mode checkout** | **NOT RUN** — Q-2 undecided + no Stripe test keys (unchanged from 2.8). |
| — | `npm ci` | **NOT RE-RUN** — `node_modules` present; not a git repo. |

Not touched (safety): SSH/live servers, live bot control, real adapters/exchange, real Stripe charge, **Axioma production
handoff / journal_server**, TradingView automation, plaintext exchange keys, the EC P-256 private key (not provisioned).
`BOT_ADAPTER_MODE=mock` default preserved; legacy real adapter stays deleted + factory-blocked (B3); **all three Axioma
terminal CTAs stay disabled dev-placeholders (B4)**.

## Background agents — closed

All 5 per-agent runs in the audit fan-out (Workflow `wf_0515a123-c96`) **completed**. **No agents remain running.**

## Next actions (continuous program — each its own epoch + aggregate)

- **PG7 LMS** — rich migration (if bounded) + LMS RBAC-throw + CSRF-first ordering.
- **PG8 Admin console** — mobile cards + honest state pills consuming PG2/PG5 real state.
- **B4 (when OP+EXT clear it):** provision the EC P-256 key + confirm `journal_server` endpoint shapes → wire the web
  signer resolver (`getAxiomaSigner` reading `loadEnv()` → `resolveHandoffSigner`), the Open-Journal/consume/Download
  routes (with route-level in-txn jti audit — security F-08), `revokeHandoffJtisByUser` on entitlement-revoke, and the
  `axioma_account_links` OTC→`link_nonce_hash` migration (0005). Then enable the CTAs.
- **Operator-gated (BLOCKED until provided):** real-PG `wtc_test` URL (B1 — also runs the jti cross-connection race);
  Stripe provider + test keys (B2); Axioma endpoint shapes + P-256 key (B4); legacy plaintext-key upstream fix (B3);
  git init + remote (B6).
- **Carried:** F-03 structured logger (PG12); CSP per-request nonce; move static headers to `next.config.ts`;
  F-07 HS256-secret deprecation (once APP_ENV is the deploy axis); Q-14 SECRET_HINTS coordination; the spec audit-code
  dot→underscore reconciliation (Phase 3).
- Full register: [`PRODUCTION_BLOCKERS.md`](../PRODUCTION_BLOCKERS.md); ordering: [`EXECUTION_PLAN_MASTER.md`](../EXECUTION_PLAN_MASTER.md).
