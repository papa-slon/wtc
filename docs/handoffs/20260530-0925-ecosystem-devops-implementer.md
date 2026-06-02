# ecosystem-devops-implementer handoff

_Epoch 20260530-0925. Phase 2.1 read-only audit — environment declarations, local run story,
migration 0002 backup/rollback, and CI status for the Stripe + Axioma ES256 additions._

## Scope

Phase 2.1 introduces two new provider integrations:

- `@wtc/billing` Stripe adapter: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Axioma ES256/JWKS signer (`packages/axioma-bridge/src/signer.ts` TARGET — not yet built):
  `AXIOMA_HANDOFF_SIGNING_KEY`, `AXIOMA_HANDOFF_KEY_ID`

Tasks (read-only verification):

1. Enumerate Phase 2.1 env vars and specify how each must be declared in `packages/config/src/env.ts`
   loadEnv (optional/fail-closed dev vs required prod).
2. Confirm local run story (in-memory dev, PGlite test, real-Postgres path) is unaffected.
3. Provide migration 0002 backup/rollback note for a real DB.
4. Confirm CI workflow stays inert; ci:local is the local equivalent.

## Files inspected

- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260530-0126-ecosystem-devops-implementer.md` (prior Phase 2 devops handoff)
- `docs/DEPLOYMENT.md`
- `.env.example`
- `docker-compose.yml`
- `packages/config/src/env.ts` (loadEnv schema — lines 13-66)
- `packages/config/src/env.test.ts`
- `packages/config/src/index.ts`
- `apps/web/instrumentation.ts`
- `packages/db/drizzle.config.ts`
- `packages/db/migrations/meta/_journal.json`
- `package.json` (root scripts)
- `packages/billing/src/provider.ts`
- `packages/billing/src/webhook.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/bridge.ts`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/handoffs/20260530-0126-ecosystem-platform-architect.md` (S-8 spine spec, line 296)
- `docs/handoffs/20260530-0126-ecosystem-security-auditor.md`
- `docs/handoffs/20260530-0126-ecosystem-billing-access-auditor.md`
- `docs/handoffs/20260530-0126-ecosystem-axioma-bridge-auditor.md`
- `docs/handoffs/20260530-0126-phase-2-full-platform-buildout.md`

## Files changed

None — read-only audit (this handoff only).

## Findings

### 1. INFO — STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET already declared in loadEnv as optional

**Evidence:** `packages/config/src/env.ts:37-38`:

```typescript
STRIPE_SECRET_KEY: z.string().optional(),
STRIPE_WEBHOOK_SECRET: z.string().optional(),
```

Both vars are already in the Zod schema as `z.string().optional()`, with no production
guard that requires them when `BILLING_PROVIDER=stripe`. This is correct for fail-closed
dev behaviour (mock provider is the default; `BILLING_PROVIDER=mock` is the schema default
at `env.ts:36`). However, there is a gap: if an operator sets `BILLING_PROVIDER=stripe` in
production without setting these two vars, `loadEnv` will pass validation (both optional)
and the Stripe provider will fail at runtime when it attempts to use a missing secret rather
than at boot. A production guard analogous to the `AXIOMA_HANDOFF_SIGNING_SECRET` pattern
should be added when the Stripe adapter is implemented.

**Recommendation (TARGET, not this wave):** Add a `superRefine` rule:
```typescript
if (data.NODE_ENV === 'production' && data.BILLING_PROVIDER === 'stripe') {
  if (!data.STRIPE_SECRET_KEY) ctx.addIssue({ ... 'STRIPE_SECRET_KEY required when BILLING_PROVIDER=stripe in production' });
  if (!data.STRIPE_WEBHOOK_SECRET) ctx.addIssue({ ... 'STRIPE_WEBHOOK_SECRET required ...' });
}
```
This must be added alongside the Stripe `BillingProvider` implementation (Phase 2.2 per the
platform-architect serial spine). It is NOT required today because the Stripe adapter does not
exist yet (`createBillingProvider('stripe', ...)` throws "not implemented yet" at
`packages/billing/src/provider.ts:71`).

### 2. INFO — AXIOMA_HANDOFF_SIGNING_KEY and AXIOMA_HANDOFF_KEY_ID are NOT yet in loadEnv

**Evidence:** `packages/config/src/env.ts` — no entry for `AXIOMA_HANDOFF_SIGNING_KEY` or
`AXIOMA_HANDOFF_KEY_ID`. These vars are specified as the implementation target in
`docs/handoffs/20260530-0126-ecosystem-platform-architect.md:296`:

> `AXIOMA_HANDOFF_SIGNING_KEY` env var (PEM or JWK private key); `AXIOMA_HANDOFF_KEY_ID` env var

The consuming file `packages/axioma-bridge/src/signer.ts` does not exist yet (TARGET).
The existing HS256 dev-stub in `handoff.ts` reads `AXIOMA_HANDOFF_SIGNING_SECRET` (the
existing symmetric secret). The ES256 signer is a separate implementation that will require
its own env vars.

**Required declarations when S-8 is implemented:**

```typescript
// In packages/config/src/env.ts envSchema:
AXIOMA_HANDOFF_SIGNING_KEY: z.string().optional(),
  // P-256 private key — PEM (multi-line, base64-encoded for env safety) or JWK JSON string.
  // Optional in dev: HS256 dev-stub is used when absent; production throws at signHandoffToken().
AXIOMA_HANDOFF_KEY_ID: z.string().default('wtc-axioma-sign-2026-01'),
  // kid for the JWKS endpoint; matches the 'kid' in token headers; rotated out-of-band.
```

Production guard (add in `superRefine`):
```typescript
if (data.NODE_ENV === 'production' && !data.AXIOMA_HANDOFF_SIGNING_KEY) {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['AXIOMA_HANDOFF_SIGNING_KEY'],
    message: 'AXIOMA_HANDOFF_SIGNING_KEY (ES256 P-256 private key) is required in production' });
}
```

Note: `AXIOMA_HANDOFF_SIGNING_SECRET` (existing, symmetric HS256 secret) remains in the schema
for the dev-stub path. The ES256 vars are additions, not replacements of the existing var.

### 3. INFO — .env.example already has STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET as empty placeholders

**Evidence:** `.env.example:41-42`:

```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

These are already present as blank placeholders. No addition needed. The placeholders correctly
convey that these keys must be filled by the operator when enabling Stripe; they contain no real
values.

### 4. INFO — .env.example needs two new placeholder entries for Axioma ES256 vars

**Evidence:** `.env.example` does not contain `AXIOMA_HANDOFF_SIGNING_KEY` or
`AXIOMA_HANDOFF_KEY_ID`. These must be added when the loadEnv schema gains them (S-8).

**Required additions to .env.example (TARGET — add at S-8 time, not this wave):**

```
# --- Axioma ES256 handoff signing (P-256 private key; dev uses HS256 stub) ---
# Generate: openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt
# Base64-encode the PEM for env safety: openssl ecparam ... | base64 -w 0
# OR provide as a JWK JSON string (single line, base64url-encoded components).
AXIOMA_HANDOFF_SIGNING_KEY=
# kid must match the 'kid' field in the JWKS endpoint response at /api/axioma/.well-known/jwks.json
AXIOMA_HANDOFF_KEY_ID=wtc-axioma-sign-2026-01
```

The existing `AXIOMA_HANDOFF_SIGNING_SECRET` entry stays for the dev HS256 stub. Operators
must not confuse the two: the ES256 key is an asymmetric private key, not a shared secret.

### 5. INFO — No production guard for STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET when BILLING_PROVIDER=stripe

**Severity:** medium (runtime-failure risk; boot-time validation preferred per project pattern).

**Evidence:** `env.ts:47-48` — the only billing-related production check is
`BILLING_PROVIDER=mock` being disallowed. If `BILLING_PROVIDER=stripe` is set in production
without the Stripe keys, `loadEnv` currently succeeds (both are `optional()`), and the error
surfaces at runtime (first webhook or checkout attempt) rather than at boot. This diverges
from the project's "fail fast at config load" pattern established for `AXIOMA_HANDOFF_SIGNING_SECRET`.

**Recommendation:** Add the production guard described in Finding 1 as part of the Phase 2.2
Stripe adapter implementation, before the webhook route `apps/web/src/app/api/billing/webhook/route.ts`
is created. The guard is not needed today because the Stripe adapter throws immediately on any call.

### 6. INFO — docker-compose.yml is correct and requires no changes

**Evidence:** `docker-compose.yml:4` — image is `postgres:17-alpine`. Phase 2.1 adds no new
services (Stripe is a remote API; Axioma ES256 signing is in-process). No docker-compose edit needed.

### 7. INFO — DATABASE_URL in loadEnv is required (no default), no change from Phase 2

**Evidence:** `env.ts:17` — `DATABASE_URL: z.string().min(1)`. No default. This means
`loadEnv()` fails if `DATABASE_URL` is absent. The app boots under `npm run dev` ONLY because
`instrumentation.ts` calls `loadEnv()` lazily at server start (not during `next build`), and
the in-memory path in `backend.ts` is selected before any DB call. However, if `DATABASE_URL`
is missing when `loadEnv` executes, the server will throw.

This is a pre-existing behaviour, not introduced by Phase 2.1. The local dev story documented
in `DEPLOYMENT.md` requires the operator to set `DATABASE_URL` even for in-memory mode (the
`.env.example` provides a default `postgres://wtc:wtc@localhost:5432/wtc`). This is NOT changed
by Phase 2.1. No action required.

## Decisions

1. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are already in `env.ts` as `optional()`.
   No schema edit is required this phase. The Stripe production guard (Finding 5) is deferred to
   Phase 2.2 alongside the actual Stripe provider implementation.

2. `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` are NOT yet in `env.ts` or
   `.env.example`. They must be added as part of S-8 (Axioma ES256 implementation). They are
   TARGET entries for this phase; adding them now without the consuming signer would be premature.

3. `.env.example` requires no edit this wave. The two Stripe placeholders already exist. The two
   Axioma ES256 placeholders are deferred to S-8.

4. No deployment, no server-side edits, no `.env` mutation. This is a read-only audit wave.

## Env var declaration specification (Phase 2.1 complete picture)

The following is the authoritative declaration spec for the four Phase 2.1 vars:

### STRIPE_SECRET_KEY

- **Declared in `env.ts`:** already present — `z.string().optional()`
- **Dev behaviour:** absent = ignored; `BILLING_PROVIDER` defaults to `mock`; app boots without it
- **Prod requirement:** required when `BILLING_PROVIDER=stripe`; production guard TARGET (Phase 2.2)
- **Fail-closed:** Stripe provider is not yet implemented; any call throws; no silent degradation
- **`.env.example`:** already present as empty placeholder (`STRIPE_SECRET_KEY=`)
- **How to generate:** Stripe Dashboard → Developers → API keys → Secret key (`sk_live_...`)
- **Never log, never in API responses, never in audit payload**

### STRIPE_WEBHOOK_SECRET

- **Declared in `env.ts`:** already present — `z.string().optional()`
- **Dev behaviour:** absent = ignored; mock webhook forge/verify uses `SESSION_SECRET` or a test value
- **Prod requirement:** required when `BILLING_PROVIDER=stripe`; production guard TARGET (Phase 2.2)
- **Fail-closed:** webhook route does not exist yet; no production traffic can reach it
- **`.env.example`:** already present as empty placeholder (`STRIPE_WEBHOOK_SECRET=`)
- **How to generate:** Stripe Dashboard → Webhooks → endpoint → Signing secret (`whsec_...`)
- **Never log, never in API responses, never in audit payload**

### AXIOMA_HANDOFF_SIGNING_KEY (P-256 private key PEM or JWK)

- **Declared in `env.ts`:** NOT YET — must be added as `z.string().optional()` at S-8
- **Dev behaviour:** absent = HS256 dev-stub path in `handoff.ts` is used; dev builds work without it
- **Prod requirement:** required in production; production guard must throw if absent (see Finding 2)
- **Fail-closed:** in production, `signHandoffToken()` already throws if `NODE_ENV === 'production'`
  (guard at `handoff.ts:62-64`), so even without a loadEnv guard the production path fails closed.
  The loadEnv guard is defence-in-depth (fail at boot rather than at first "Open Journal" click).
- **`.env.example`:** NOT YET — placeholder to be added at S-8 (format guidance in Finding 4)
- **How to generate:** `openssl ecparam -name prime256v1 -genkey -noout -out key.pem`
  then base64-encode for env: `openssl base64 -in key.pem` (or provide as JWK JSON one-liner)
- **Never log, never in API responses, never in audit payload. Never store public half in env.**

### AXIOMA_HANDOFF_KEY_ID

- **Declared in `env.ts`:** NOT YET — must be added as `z.string().default('wtc-axioma-sign-2026-01')` at S-8
- **Dev behaviour:** default value is safe to use; it is a non-secret identifier, not a credential
- **Prod requirement:** must match the `kid` field in the JWKS endpoint response; not sensitive
- **Fail-closed:** wrong or missing `kid` causes Axioma to reject the token (signature mismatch)
- **`.env.example`:** NOT YET — add with default value at S-8 (see Finding 4)
- **How to generate:** choose a stable string per key rotation cycle (e.g. `wtc-axioma-sign-2026-07`)

## Local run story (Phase 2.1)

### npm run dev (in-memory, no DB, no new secrets)

No change from Phase 2. The four new vars are all absent by default:

- `BILLING_PROVIDER` defaults to `mock` — `createMockBillingProvider` is used; no Stripe key needed
- `AXIOMA_HANDOFF_SIGNING_KEY` is not yet in the schema — no loadEnv check fires
- `AXIOMA_HANDOFF_SIGNING_SECRET` (existing HS256 secret) is `optional()` in the schema; the
  dev-stub `signHandoffToken` is only called in dev mode and only if the user actually triggers
  the "Open Journal" flow, so absence causes a runtime error at that specific action, not at boot

The app boots and serves all pages in dev mode without any of the four Phase 2.1 vars present.

### PGlite test path (no DB creds)

`npm test` runs Vitest. The PGlite harness in the DB tests uses `@electric-sql/pglite` (in-process,
no server). Phase 2.1 adds no new DB tests; the billing and axioma packages have no DB dependency
in their smoke or unit tests. Gate stays green with no `DATABASE_URL`.

### Real-Postgres path (db:migrate / db:seed)

Hard rule (unchanged from Phase 2): `db:migrate` and `db:seed` are NOT RUN without an explicit
`DATABASE_URL` pointing at a throwaway database whose name is `wtc_test` or starts with `wtc_test_`.

These commands are NOT RUN this wave. No `DATABASE_URL` is provided; Docker is absent on this host.
Native PostgreSQL 17 credentials are unknown to this agent. The operator must follow the throwaway-DB
flow in `docs/DEPLOYMENT.md` ("Real-Postgres integration harness") before running these commands.

## Migration 0002 backup/rollback note

### What migration 0002 contains

Migration 0002 is additive only (18 new tables + 1 ALTER adding columns — per
`docs/handoffs/20260530-0126-ecosystem-db-architect.md`). It never drops tables, never drops
columns, and never modifies the 0000/0001 schema. The tables it adds are all in the Phase 2 design
(`bot_config_versions`, `bot_metric_snapshots`, `bot_position_snapshots`, `bot_trade_imports`,
`bot_safety_events`, `teacher_profiles`, `enrollments`, `lesson_progress`, `pinned_links`,
`tradingview_profiles`, `tradingview_access_grants`, `product_access_events`,
`terminal_release_cache`, `terminal_download_events`, `terminal_license_events`,
`notifications`, `support_tickets`, and the ALTER adding `revoked_at`/`revoked_by` to
`tradingview_access_requests`).

### Pre-migration checklist (operator)

Before running `db:generate` and `db:migrate` against any non-throwaway database:

1. Confirm `DATABASE_URL` points to the correct database — never `wtc` (prod) without a prior dump.
2. Run `pg_dump -Fc -h <host> -U <user> <dbname> -f /path/to/backup-$(date +%Y%m%d-%H%M%S).dump`
3. Record the dump path and timestamp in the operator run log.
4. Confirm migrations 0000 and 0001 are already applied (`SELECT * FROM drizzle.__drizzle_migrations`).
5. Review the generated SQL file in `packages/db/migrations/` before applying.

### Applying migration 0002

```powershell
# Only against throwaway (wtc_test) or with a prior pg_dump of the target:
$env:DATABASE_URL = "postgres://<user>:<password>@127.0.0.1:5432/<dbname>"
npm run db:generate -w @wtc/db   # produce the SQL file
# Review packages/db/migrations/0002_*.sql before continuing
npm run db:migrate -w @wtc/db    # apply
npm run db:seed   -w @wtc/db    # optional: populate demo data
```

### Rollback procedure

Because 0002 is additive only, rollback does not require a destructive migration:

1. Stop the application server.
2. Restore the pre-migration dump:
   `pg_restore -Fc -h <host> -U <user> -d <dbname> --clean /path/to/backup.dump`
3. Redeploy the prior build (the one that was running against 0001).
4. The 0001 schema is intact; the application resumes normally.

Never write a "down" migration that drops tables or columns — the restore-from-dump procedure
is the only approved rollback path. Never run any destructive command against 0000 or 0001 data.

## CI workflow status

The repository has no `.git` directory and no GitHub remote. The `.github/workflows/ci.yml` file
exists and is correct but has never executed. This is unchanged from Phase 2.

The local equivalent is:

```powershell
npm run ci:local
```

`ci:local` runs: `check:core`, `governance:check`, `lint`, `typecheck` (packages),
`typecheck -w @wtc/web`, `secret:scan`, `npm test`, `build -w @wtc/web`.

Phase 2.1 introduces no new CI requirement. The governance check (`governance:check`) will
require this handoff file to be present and cited in the next aggregate phase handoff. No new
workflow steps, no new Docker services, and no new npm scripts are needed for the four env vars.

When the Axioma ES256 signer (S-8) is implemented, `npm run check:core` must include a smoke
for `packages/axioma-bridge` that exercises both the HS256 dev-stub path and the ES256 path
(with a freshly-generated test key pair). This is a Phase 2.2/S-8 task, not Phase 2.1.

Gates NOT RUN this wave:

| Gate | Reason |
|---|---|
| `db:migrate` / `db:seed` | No `DATABASE_URL` / no throwaway DB provided |
| Real-PG harness (`REAL_POSTGRES_DATABASE_URL`) | No throwaway DB credentials provided |
| `npm run ci:local` | Read-only audit; no code changed; gates not re-run |
| CI (GitHub Actions) | Not a git repo / no remote — permanently inert until activation |
| `npm run dev` boot test | Read-only audit wave |

## Risks

1. **Stripe boot-fail risk (medium):** If an operator sets `BILLING_PROVIDER=stripe` in production
   without setting `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`, `loadEnv` currently passes and the
   error surfaces at runtime. Mitigated by the deferred production guard (Finding 5). Operator
   procedure: always test `loadEnv` in staging before deploying with a real provider.

2. **ES256 key not in env.ts yet (low, by design):** `AXIOMA_HANDOFF_SIGNING_KEY` and
   `AXIOMA_HANDOFF_KEY_ID` cannot be added to `env.ts` before the consuming signer exists (S-8).
   In production, `signHandoffToken()` already throws (HS256 guard), so there is no silent
   degradation. The "Open Journal" button is correctly disabled in production until ES256 is live.

3. **Migration 0002 not yet generated (low, by design):** `db:generate` has not been run for
   the Phase 2.1 schema additions. No SQL file exists for 0002. This is expected: the schema.ts
   additions are a Phase 2.1 implementer task (serial spine S-1 through S-8). Do not run
   `db:migrate` until `db:generate` has produced and the operator has reviewed the SQL file.

4. **P-256 key material must never appear in `.env.example`, logs, or docs.** The placeholder
   entry for `AXIOMA_HANDOFF_SIGNING_KEY` must be an empty value or a comment — not even a
   sample key. A sample P-256 key is indistinguishable from a real one to secret scanners and
   could cause false positives or operator confusion. The generation command is documented
   in-line (Finding 4) rather than via an example value.

## Verification/tests

Gates RUN this session:

| Gate | Result |
|---|---|
| All mandatory files read (AGENTS.md, seed, protocol, prior handoff, DEPLOYMENT.md, .env.example, docker-compose.yml, env.ts, env.test.ts, instrumentation.ts, drizzle.config.ts, package.json, billing/provider.ts, billing/webhook.ts, axioma-bridge/handoff.ts, axioma-bridge/bridge.ts, AXIOMA_HANDOFF_TOKEN_SPEC.md, platform-architect handoff S-8 spec, billing-access-auditor handoff, security-auditor handoff, axioma-bridge-auditor handoff, phase-2 aggregate handoff) | PASS — all files read; facts cited by file:line in Findings |
| STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET in env.ts schema | CONFIRMED — `env.ts:37-38`, both `z.string().optional()` |
| STRIPE placeholders in .env.example | CONFIRMED — `.env.example:41-42`, empty placeholders |
| AXIOMA_HANDOFF_SIGNING_KEY / AXIOMA_HANDOFF_KEY_ID absent from env.ts | CONFIRMED — not in schema; TARGET for S-8 |
| handoffToken.ts (ES256 signer) absent | CONFIRMED — file does not exist; TARGET |
| Stripe BillingProvider not yet implemented | CONFIRMED — `provider.ts:71` throws "not implemented yet" |
| HS256 production guard in place | CONFIRMED — `handoff.ts:62-64` throws in production |
| Migration journal: 0000 + 0001 only | CONFIRMED — `_journal.json` has idx 0 and 1; no 0002 entry |
| docker-compose.yml image is postgres:17-alpine | CONFIRMED — `docker-compose.yml:4` |
| .env.example contains no real secrets | CONFIRMED — all sensitive fields are placeholders or empty |

Gates NOT RUN:

| Gate | Reason |
|---|---|
| `npm run ci:local` | Read-only audit; no code changes this wave |
| `db:generate` / `db:migrate` / `db:seed` | No `DATABASE_URL` provided; no throwaway DB available |
| Real-PG harness | No `REAL_POSTGRES_DATABASE_URL` provided |
| CI (GitHub Actions) | Not a git repo |

## Next actions

1. **Phase 2.1 S-1 through S-7 (db-architect + implementer):** generate and apply migration 0002
   (additive schema additions); create repos for new tables. Follow pre-migration checklist above.
   Only against a throwaway `wtc_test` database; pg_dump first on any populated DB.

2. **Phase 2.1 S-8 (axioma-bridge implementer):** implement `packages/axioma-bridge/src/signer.ts`
   (ES256/JWKS). When complete:
   - Add `AXIOMA_HANDOFF_SIGNING_KEY: z.string().optional()` and
     `AXIOMA_HANDOFF_KEY_ID: z.string().default('wtc-axioma-sign-2026-01')` to `env.ts` schema.
   - Add production `superRefine` guard for `AXIOMA_HANDOFF_SIGNING_KEY` (see Finding 2).
   - Add placeholder entries to `.env.example` (see Finding 4).
   - Add smoke test to `check:core` for the ES256 sign + verify round-trip.

3. **Phase 2.2 (billing implementer):** implement Stripe `BillingProvider` and webhook route.
   When complete:
   - Add production `superRefine` guard for `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
     when `BILLING_PROVIDER=stripe` (see Findings 1 and 5).
   - STRIPE placeholders in `.env.example` are already correct; no edit needed at that time.

4. **Operator (migration 0002 on real DB):** follow the pre-migration checklist (backup/rollback
   section above) before running `db:migrate` against any non-throwaway database. Rollback = restore
   from pg_dump + redeploy prior build. Never touch 0000/0001 tables destructively.

5. **Operator (CI activation):** when ready to activate GitHub Actions CI, run `git init`, add
   a remote, and push. First CI run will exercise the full gate set. Do not claim CI is green
   until that run completes successfully.
