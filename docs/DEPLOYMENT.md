# Deployment

> Owner: ecosystem-devops-implementer. Phased, approval-gated. No live server is touched without
> explicit operator approval. Never copy server secrets. Never edit live nginx/systemd/.env.

## Local development

> The running app uses an **in-memory demo backend by default (no DB needed)** so it boots instantly;
> `copy .env.example .env`, `npm install`, `npm run dev` is enough. The `docker compose` / `db:*` steps
> below are **optional вЂ” only for the real Postgres path** (when `DATABASE_URL` is set). Docker is **not
> installed on this host**; a native **PostgreSQL 17** on `127.0.0.1:5432` also works via `DATABASE_URL`
> (skip the `docker compose` line then).

```powershell
cd "C:\Users\maxib\GTE BOT\wtc_ecosystem_platform"
copy .env.example .env        # fill SESSION_SECRET + SECRET_VAULT_KEK (see below)
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"   # SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # SECRET_VAULT_KEK
docker compose up -d          # OPTIONAL (Postgres path only) вЂ” local Postgres on :5432; Docker not installed here, native PostgreSQL 17 via DATABASE_URL also works
npm install
npm run db:generate -w @wtc/db   # generate SQL migration from Drizzle schema
npm run db:migrate  -w @wtc/db   # apply
npm run db:seed     -w @wtc/db   # demo products/plans/users
npm run dev          # Next.js on http://localhost:3000
npm run dev:worker   # background jobs (separate terminal)
```

Quality gates:

```powershell
npm run check:core   # zero-install smokes: entitlements, crypto, analytics, audit, auth, axioma, billing
npm test             # Vitest unit suite
npm run typecheck    # tsc --noEmit (packages)
npm run build -w @wtc/web   # Next production build (also typechecks the app)
npx playwright install chromium && npm run e2e   # smoke + screenshots (desktop + mobile)
```

> The running app uses an in-memory demo backend by default (no DB needed) so it boots instantly.
> The backend selector `apps/web/src/lib/backend.ts` ALREADY exists and is production-fenced:
> it switches to `@wtc/db` repositories automatically when `DATABASE_URL` is set, and fails closed
> in production if `DATABASE_URL` is absent. Do NOT swap `demo.ts` accessors manually вЂ”
> going live means: set `DATABASE_URL`, run `npm run db:migrate -w @wtc/db`, run `npm run db:seed -w @wtc/db`.

### Preflight Evidence Roots

All `*_PREFLIGHT_LOG_ROOT` overrides must be relative repo-local `logs/...` paths. Absolute paths, UNC paths, URL-shaped
values, parent traversal (`..`), and non-`logs/` roots are refused before summary files are written. Preflight commands print
normalized relative `summary=logs/.../summary-*.json` paths; do not archive absolute temp directories or off-repo evidence
roots as acceptance evidence.

Physical filesystem confinement is also required. Existing path components under these roots must be plain local directories,
not symlinks, Windows junctions, or other reparse points. The preflight helper rejects linked components before summary writes,
verifies the created root with `realpath`, and creates summary files exclusively. If a preflight or scanner refuses a linked
root, remove/recreate it as a plain local directory before rerunning; do not treat the linked target as acceptance evidence.

### Stripe webhook replay preflight (local, no provider network)

The Stripe replay preflight is separate from Stripe CLI/Dashboard replay, checkout creation, production key provisioning,
endpoint registration, and default gates:

```powershell
# Dry-run: signs fake Stripe fixtures, replays them through the extracted webhook handler against disposable PGlite,
# performs no Stripe network I/O, and writes only redacted summary evidence.
npm run accept:billing:stripe-webhook -- --dry-run

# Before archiving evidence, scan the retained summary directory.
node scripts/scan-lms-db-e2e-artifacts.mjs logs/billing-stripe-webhook-preflight
```

Guardrails:

- This command must not be run with `APP_ENV=production`; it refuses that environment.
- It does not read `STRIPE_SECRET_KEY`, does not create Checkout Sessions, and does not call Stripe APIs.
- Retained summaries must not include webhook secrets, secret keys, signature headers/values, raw Stripe event bodies,
  Checkout Session IDs, customer IDs, raw request headers, or provider response bodies.
- A green local replay preflight is **not** Stripe CLI/Dashboard acceptance. Real test-mode Stripe acceptance remains
  **NOT RUN** until an operator supplies scoped test `sk_test`, `whsec`, and `price_` values and the retained evidence scans
  green.

### Stripe checkout request preflight (local, no provider network)

The checkout request preflight is separate from Checkout Session creation, Stripe CLI/Dashboard replay, production key
provisioning, endpoint registration, and default gates:

```powershell
# Dry-run: validates generated test-mode checkout config, builds Checkout request bodies in memory,
# performs no Stripe network I/O, writes no pending-payment rows, and stores only redacted summary evidence.
npm run accept:billing:stripe-checkout -- --dry-run

# Before archiving evidence, scan the retained summary directory.
node scripts/scan-lms-db-e2e-artifacts.mjs logs/billing-stripe-checkout-preflight
```

Guardrails:

- This command must not be run with `APP_ENV=production`; it refuses that environment.
- It refuses a live `sk_live_` key if one is present in the process environment.
- It does not call `createStripeCheckout`, does not invoke `createStripeProvider().createCheckout()`, does not write
  `pending_payment` rows, and does not call Stripe APIs.
- Retained summaries must not include secret keys, webhook secrets, price IDs, Checkout endpoints, raw request field names,
  Checkout Session IDs, raw request bodies, customer emails, or authorization headers.
- A green local checkout request preflight is **not** real Stripe Checkout acceptance. Real test-mode Stripe acceptance remains
  **NOT RUN** until an operator supplies scoped test `sk_test`, `whsec`, and `price_` values, creates an actual test Checkout
  Session, replays the webhook, and scans retained evidence.

### Axioma handoff preflight (local, no Axioma network)

The Axioma handoff preflight is separate from production P-256 key provisioning, live JWKS fetches, Axioma endpoint-shape
acceptance, live installer streaming, account-link acceptance, browser CTA enablement, and default gates:

```powershell
# Dry-run: generates ephemeral P-256 key material, exercises ES256/JWKS plus local journal-handoff/JTI handlers
# against disposable PGlite, performs no Axioma network I/O, and writes only redacted summary evidence.
npm run accept:axioma:handoff-preflight -- --dry-run

# Before archiving evidence, scan the retained summary directory.
node scripts/scan-lms-db-e2e-artifacts.mjs logs/axioma-handoff-preflight
```

Guardrails:

- This command must not be run with `APP_ENV=production`; it refuses that environment.
- It refuses pre-existing `AXIOMA_HANDOFF_SIGNING_KEY` or `AXIOMA_BRIDGE_API_TOKEN` values so the dry-run cannot accidentally
  use live signing key or service-token material. It always generates disposable key material in process.
- It does not call `axi-o.ma`, does not fetch installers, does not enable terminal CTAs, and does not mutate any live server.
- Retained summaries must not include PEM key material, Axioma service tokens, Authorization headers, compact JWTs, raw
  handoff route bodies, raw single-use/CSRF claims, linked user identifiers, download tokens, cookies, or raw Axioma provider
  responses.
- A green local handoff preflight is **not** live Axioma acceptance. Real B4 acceptance remains **NOT RUN** until the operator
  supplies staging/production P-256 key material, Axioma confirms endpoint shapes and replay model, live installer/account-link
  checks pass, browser CTA activation is verified, and retained evidence scans green.

### LMS upload deployment boundary

LMS file uploads are local/DB-backed by default. Migration `0012` adds non-public storage keys, scan/quarantine state,
retention timestamps, and soft-delete metadata; migration `0013` allows non-`db-local` rows to omit inline DB bytes so the
app can use a provider boundary. Supported providers are:

- `LMS_FILE_STORAGE_PROVIDER=db-local` - stores file bytes in the material row for local/dev acceptance.
- `LMS_FILE_STORAGE_PROVIDER=fs-local` - writes bytes under `LMS_FILE_STORAGE_ROOT` and stores provider/key metadata in
  Postgres; this is local object-style storage, not S3/R2.
- `LMS_FILE_STORAGE_PROVIDER=s3-r2` - writes to a private S3/R2-compatible path-style object endpoint and serves clean
  downloads through short-lived signed redirects. Required envs: `LMS_OBJECT_STORAGE_ENDPOINT` (HTTPS origin),
  `LMS_OBJECT_STORAGE_BUCKET`, `LMS_OBJECT_STORAGE_REGION`, `LMS_OBJECT_STORAGE_ACCESS_KEY_ID`, and
  `LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY`.

When `LMS_FILE_SCANNER_MODE=external`, the upload path POSTs the raw bytes server-side to
`LMS_FILE_SCANNER_ENDPOINT` with `Authorization: Bearer <LMS_FILE_SCANNER_TOKEN>`, `content-type:
application/octet-stream`, `x-wtc-lms-mime-type`, and `x-wtc-lms-size-bytes`. The scanner endpoint must be HTTPS and must not
embed credentials, query strings, or fragments. `LMS_FILE_SCANNER_TIMEOUT_MS` is optional and defaults to `5000`; scanner
timeouts, non-2xx responses, malformed responses, or unsupported statuses fail closed before storage writes. Accepted scanner
responses are JSON: `{ "status": "clean" }` or `{ "status": "quarantined", "reason": "<safe-code>" }`.

### LMS external scanner live preflight (opt-in scanner check)

The scanner preflight command is separate from default gates, object-store acceptance, DB-browser acceptance, and public
upload rollout:

```powershell
# Dry-run: validates configured external-scanner env, builds scanner requests, performs no network I/O,
# and writes only redacted summary evidence.
npm run accept:lms:external-scanner -- --dry-run

# Live mode: use only with an operator-approved scanner endpoint/token and approved quarantine corpus.
$env:LMS_FILE_SCANNER_MODE = "external"
$env:LMS_PUBLIC_UPLOADS_ENABLED = "false"
$env:LMS_FILE_SCANNER_LIVE_ACCEPTANCE = "1"
$env:LMS_FILE_SCANNER_LIVE_EICAR = "1"
npm run accept:lms:external-scanner -- --live
```

Guardrails:
- The script refuses missing/invalid `LMS_FILE_SCANNER_*` config, non-`external` scanner mode, public uploads enabled, or live
  mode without both consent flags.
- The script uses the shared `@wtc/lms` scanner helpers; it never prints raw endpoint URLs, bearer tokens, Authorization
  headers, MIME/size request headers, request bodies, exact corpus bytes, raw provider response bodies, or raw vendor reasons.
- Redacted summaries are written under `logs/lms-external-scanner-preflight` by default. Before archiving, run
  `node scripts/scan-lms-db-e2e-artifacts.mjs logs/lms-external-scanner-preflight`; any scanner hit is a failed evidence gate.
- A missing credential/consent run is **NOT RUN**, not PASS. A live attempt that starts but fails clean/quarantine observation
  or artifact scanning is **FAIL**.
- This scanner preflight does not prove live S3/R2 behavior, DB-backed browser acceptance, worker cleanup/reconciliation, or
  public upload rollout.

Downloads fail closed unless a file is active, published, clean, hash-valid, and resolvable by the configured storage boundary.
New local writes generate opaque single-segment keys under `lms/materials/`, successful downloads do not expose
`x-lms-sha256`, successful attachment filenames are generic MIME-derived names, and upload/download audit payloads do not
include original filenames or MIME field names. Raw content hashes and DB-private file metadata remain server-private for byte
integrity. Quarantined `s3-r2` uploads create non-downloadable metadata rows but do not write unsafe bytes to the standard
object bucket. The `s3-r2`, external scanner, and object cleanup adapters have local mocked coverage only in this repository
session: no live bucket or scanner credentials were used and no live upload/download/delete/reconcile/scanner acceptance was
run. Worker cleanup now has two local paths: expired `db-local` rows are purged only when already soft-deleted or unsafe, and
expired `s3-r2` rows are finalized only after clean object rows are deleted or already absent, while unsafe metadata-only rows
are purged without remote object calls. Cleanup logs, health details, and audits must stay count-only. The web upload path
also has a local compensation boundary for clean `s3-r2` object PUT followed by material DB creation failure: it creates a
private `lms_object_cleanup_tasks` row before object PUT, completes that row in the same DB transaction as successful material
creation, attempts a signed compensation `DELETE` on material creation failure, treats `404` as reconciled, skips quarantined
metadata-only inputs, and preserves the original DB error if cleanup fails. Failed compensation is retryable by the worker via
generic attempts/run-after/dead-letter state, and worker health/audit output remains count-only. `/admin/system-health` now
surfaces count-only dead-letter review metrics and guarded aggregate acknowledgement/retry controls; retry only requeues
reviewed dead letters for worker processing and does not perform object DELETE in the admin request. Shared `@wtc/lms`
object-store helpers now build signed S3/R2 PUT, DELETE, and read redirect requests for both web and worker. Keep
`LMS_PUBLIC_UPLOADS_ENABLED=false` until a separate operator-approved production upload phase lands with live object-store
acceptance, live external malware-scanner acceptance,
DB-backed browser evidence, and retained artifacts that pass the scanner.

### LMS S3/R2 live preflight (opt-in object-store check)

The object-store preflight command is separate from default gates, DB-browser acceptance, scanner acceptance, and public
upload rollout:

```powershell
# Dry-run: validates configured S3/R2 env, builds signed requests, performs no network I/O,
# and writes only redacted summary evidence.
npm run accept:lms:object-storage -- --dry-run

# Live mode: use only with operator-approved throwaway credentials and a disposable/private target.
$env:LMS_FILE_STORAGE_PROVIDER = "s3-r2"
$env:LMS_PUBLIC_UPLOADS_ENABLED = "false"
$env:LMS_OBJECT_STORAGE_LIVE_ACCEPTANCE = "1"
$env:LMS_OBJECT_STORAGE_LIVE_THROWAWAY = "1"
npm run accept:lms:object-storage -- --live
```

Guardrails:
- The script refuses missing/invalid `LMS_OBJECT_STORAGE_*` config, non-`s3-r2` storage provider, public uploads enabled, or
  live mode without both consent flags.
- The script uses the shared `@wtc/lms` builders for PUT, signed read, and DELETE; it never prints raw object URLs, keys,
  Authorization headers, signed query strings, access key IDs, secret keys, or provider response bodies.
- Redacted summaries are written under `logs/lms-s3-r2-preflight` by default. Before archiving, run
  `node scripts/scan-lms-db-e2e-artifacts.mjs logs/lms-s3-r2-preflight`; any scanner hit is a failed evidence gate.
- A missing credential/consent run is **NOT RUN**, not PASS. A live attempt that starts but fails upload/read/delete/cleanup or
  artifact scanning is **FAIL**.
- This object-store preflight does not prove live external scanner behavior, DB-backed browser acceptance, worker
  cleanup/reconciliation, or public upload rollout.

### LMS DB-backed browser acceptance (opt-in throwaway DB)

The default `npm run e2e` gate is a demo/in-memory browser smoke. LMS upload/download acceptance against Postgres is separate
and must be run only through `npm run e2e:lms:db`.

```powershell
# 1. Create a fresh empty throwaway DB. The name MUST be wtc_test or start with wtc_test_.
psql -h 127.0.0.1 -U <user> -c "CREATE DATABASE wtc_test_lms_YYYYMMDDHHMMSS"

# 2. Set the guarded browser-acceptance URL. Never point this at preview/prod.
$env:LMS_E2E_DATABASE_URL = "postgres://<user>:<password>@127.0.0.1:5432/wtc_test_lms_YYYYMMDDHHMMSS"

# 3. Run the single supported entry point. It applies migrations, seeds demo data, starts port 3101,
#    writes a transient dynamic-marker manifest, runs Playwright, and runs the generated-artifact no-leak scanner.
npm run e2e:lms:db

# 4. Archive evidence, then drop the throwaway DB from an operator/admin connection.
#    Keep only redacted command/stdout summary, test-results/ and playwright-report/ if generated.
#    Keep tests/e2e/screenshots/lms-db-material-lesson-*.png only after the text scanner and
#    retained visual-artifact review gate both pass.
#    Do not archive .next-e2e-db/lms-db-e2e-dynamic-markers.json; the runner deletes it.
psql -h 127.0.0.1 -U <user> -c "DROP DATABASE IF EXISTS wtc_test_lms_YYYYMMDDHHMMSS"
```

If `psql` is not installed but an operator-approved admin/maintenance Postgres URL is available, use the managed wrapper
instead. It creates a fresh `wtc_test_lms_*` database, delegates to the same guarded `npm run e2e:lms:db` runner, and drops the
throwaway database in `finally`. It never prints the admin or target URL.

```powershell
# The URL must point at a non-throwaway maintenance DB, for example postgres or wtc, and the role must
# be allowed to CREATE/DROP DATABASE. Never point this at preview/prod unless the operator explicitly
# intends that host for a disposable test DB.
$env:LMS_E2E_ADMIN_DATABASE_URL = "postgres://<user>:<password>@127.0.0.1:5432/postgres"
npm run e2e:lms:db:managed
```

Guardrails:
- The prep script refuses missing URLs, non-`wtc_test*` database names, and non-empty `public` schemas before applying SQL.
- `LMS_E2E_DATABASE_URL` is the only accepted URL variable. `REAL_POSTGRES_DATABASE_URL` is reserved for `tests/integration/db-real-postgres.test.ts`.
- Direct `npx playwright test -c playwright.lms-db.config.ts` is unsupported; the config requires the runner's prep marker.
- The managed wrapper refuses an admin URL that points at a `wtc_test*` database, creates a fresh target name itself, and drops
  only that generated target DB.
- The runner invokes `scripts/scan-lms-db-e2e-artifacts.mjs` after any Playwright attempt. The scanner checks generated text
  artifacts for LMS byte/base64/storage-key/raw-iframe markers, internal material metadata, session/auth markers, and
  secret-shaped values, including the deprecated `x-lms-sha256` header name and filename/MIME metadata markers, skips
  screenshot image bytes, rejects signed object URL query tokens such as `X-Amz-Signature`, rejects scanner endpoint/token
  assignments such as `LMS_FILE_SCANNER_TOKEN=...`, and fails closed on compressed/container artifacts. Screenshots remain
  visual evidence and need the retained visual-artifact review gate before archive.
- The DB browser spec writes per-run dynamic no-leak markers to `.next-e2e-db/lms-db-e2e-dynamic-markers.json`, and the
  scanner reads that path through `LMS_DB_E2E_DYNAMIC_MARKERS_PATH`. A configured marker manifest that is missing, malformed,
  too large, or invalid fails closed. The scanner reports marker labels only and never prints matched marker values.
- `npm run e2e:lms:db` is RUN only when the command exits 0 against a fresh throwaway DB and the artifact scanner exits 0.
  A skipped or unprovided URL is NOT RUN.
- This proves local DB-byte browser acceptance only. It is not live S3/R2 object storage, live external malware scanning,
  live object cleanup/reconciliation, or public upload rollout acceptance.

### Retained visual-artifact policy (screenshots/OCR/manual review)

Text artifact scanning and `secret:scan` do not inspect screenshot pixels. `scripts/scan-lms-db-e2e-artifacts.mjs` still skips
image bytes by design, so a text scanner PASS is not screenshot leak proof. Use the visual evidence command whenever PNG/JPG/
WebP/GIF/ICO artifacts are retained:

```powershell
# Inventory only. This counts retained images and is NOT acceptance.
npm run evidence:visual -- --inventory tests/e2e/screenshots

# Acceptance/review gate. The manifest must cover every retained image in the supplied roots.
npm run evidence:visual -- --manifest logs/retained-visual-artifacts/<run-id>/visual-review.json tests/e2e/screenshots
```

Manifest requirements:
- JSON shape: `version: 1`, `artifacts: [...]`.
- Each artifact entry must include a workspace-local `path`, `result: "pass"`, `method: "manual"` or `"ocr"`, safe `reviewer`,
  ISO `reviewedAt`, and `reviewedMarkerLabels` covering the required forbidden-marker classes.
- OCR entries must provide an `ocrTextPath` sidecar. The checker scans sidecar text for DB URLs, auth/cookie tokens, signed URL
  tokens, raw public-IP URLs, provider tokens, LMS internal metadata, and dynamic marker values without printing matched values.
- Manual entries are review evidence only; they do not create OCR proof. If OCR tooling is unavailable, report the gate as
  manual visual review, not OCR.
- `--inventory` output is useful for scope discovery but is **NOT RUN** for acceptance.
- Do not archive unreviewed screenshots, failure screenshots, videos, traces, compressed reports, or visual artifacts from real
  operator data. Keep visual review manifests under `logs/retained-visual-artifacts/` and archive only approved reviewed images
  plus the manifest.

### Retained child-process output policy

One-shot proof/evidence runners must not archive raw child stdout/stderr. `scripts/redacted-child-process.mjs` is the shared
script-local text redactor for retained console/log evidence. It covers Postgres URLs/DSNs, DB/env secret assignments,
password fragments, auth headers, cookies, bearer/basic/JWT-like values, provider tokens, signed URL parameters,
provider/preview URL assignments, raw public-IP preview URLs, and private-key blocks.

Covered one-shot entry points:
- `npm run e2e:lms:db`
- `npm run e2e:lms:db:managed`
- `npm run accept:real-pg:managed`
- `npm run worker:smoke`
- `node scripts/gates.mjs <mode>` for retained `logs/gates/*.log`

Do not paste or archive raw terminal buffers from failed child processes. Retain only redacted command output, compact gate
summaries, relative `logs/...` summary paths, pass/fail/refused codes, counts, and elapsed time. Full Playwright traces,
screenshots, compressed artifacts, and binary files are still separate artifact/OCR evidence and are not proven safe by
stdout/stderr redaction.

For `node scripts/gates.mjs <mode>`, passing gate logs retain only compact status, elapsed time, and metric lines. Full child
output is discarded after redacted metric extraction. Failing gate logs retain full redacted child output for diagnostics and
must be scanned before archiving.

`npm run preview:safe` is a long-running interactive dev-server stream, not a one-shot acceptance gate. Its wrapper now pipes
stdout/stderr through the shared redaction corpus before forwarding, but raw copied terminal buffers and legacy redirected logs
remain non-archiveable. Do not archive `dev-server.log`, `logs/preview-safe*.log`, raw terminal buffers, or screenshots of raw
terminal output; `scripts/scan-lms-db-e2e-artifacts.mjs` refuses those raw log paths as retained evidence. Retain only a
separate compact operator summary such as "safe preview started locally" plus separately scanned/reviewed artifacts when a
preview evidence package is required. This does not prove live preview smoke unless `npm run preview:safe` or an approved
preview smoke gate was actually run in that session.

## Real-Postgres integration harness (opt-in throwaway DB)

The test suite runs against PGlite (in-process, no server) by default. A real-engine complement
(`tests/integration/db-real-postgres.test.ts`) is opt-in via `REAL_POSTGRES_DATABASE_URL` and is
skipped in all other runs (`npm test` stays green with no DB).

**PGlite is NOT a substitute for real-PG acceptance.** PGlite (used by `db-persistence.test.ts`
and `db-0002.test.ts`) is an in-process engine used for fast unit-level DB tests. It is NOT a
substitute for real-PG acceptance. Only a passing run of
`tests/integration/db-real-postgres.test.ts` with `REAL_POSTGRES_DATABASE_URL` set to a
`wtc_test` database constitutes real-Postgres acceptance. PGlite differences that matter:
single-connection only (no true concurrent isolation), no TCP pool overhead, SQLSTATE codes may
differ for some constraint violations, no `pg_dump`/`pg_restore` capability.

**Hard guard вЂ” MUST be satisfied before running the harness:** the DB name in
`REAL_POSTGRES_DATABASE_URL` must be `wtc_test` or start with `wtc_test_`. Any other name means the
harness may be pointed at a live or populated database, which is never acceptable. Verify the URL
before proceeding.

Phase 2.4 adds a machine-enforced version of this guard inside the test file's `beforeAll` block
(URL pathname check). If you are running an older version of the harness that lacks this guard,
manually verify the URL pathname before proceeding.

Throwaway-DB flow (local PostgreSQL 16+ / 17, credentials known to the operator):

Managed throwaway runner (preferred when the operator has an admin/maintenance URL):

```powershell
# Admin URL must point at a non-throwaway maintenance DB such as postgres.
# Never archive this URL or its password.
$env:REAL_POSTGRES_ADMIN_DATABASE_URL = "postgres://<user>:<password>@127.0.0.1:5432/postgres"

npm run accept:real-pg:managed
```

The managed runner creates a fresh database named `wtc_test_<suffix>`, sets the child process
`REAL_POSTGRES_DATABASE_URL` and `DATABASE_URL` to that throwaway DB, generates ephemeral
`SESSION_SECRET` and `SECRET_VAULT_KEK` if absent, runs only
`npm test -- tests/integration/db-real-postgres.test.ts`, and drops the throwaway DB in `finally`.
It prints the generated DB name and command shape, but not the full URL, password, session secret, KEK,
cookies, or raw environment. This command is still NOT RUN unless `REAL_POSTGRES_ADMIN_DATABASE_URL`
is supplied and the active real-PG tests pass without skips.

```powershell
# 1. Create the throwaway DB (drop first for idempotency).
#    Replace <user>/<password> with your local Postgres credentials.
#    DB name MUST be wtc_test or start with wtc_test_.
psql -h 127.0.0.1 -U <user> -c "DROP DATABASE IF EXISTS wtc_test"
psql -h 127.0.0.1 -U <user> -c "CREATE DATABASE wtc_test"

# 2. Set the opt-in env var (PowerShell session вЂ” never commit this).
$env:REAL_POSTGRES_DATABASE_URL = "postgres://<user>:<password>@127.0.0.1:5432/wtc_test"

# 3. Ensure DATABASE_URL is also set (required by loadEnv; may point at a different local DB).
$env:DATABASE_URL = "postgres://<user>:<password>@127.0.0.1:5432/wtc"

# 4. Ensure SESSION_SECRET and SECRET_VAULT_KEK are set (required by loadEnv in non-test paths).
$env:SESSION_SECRET = "$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")"
$env:SECRET_VAULT_KEK = "$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"

# 5. Run only the real-PG harness.
npm test -- tests/integration/db-real-postgres.test.ts

# 6. To run a second time: drop and recreate first (migrations are not idempotent re-run safe).
psql -h 127.0.0.1 -U <user> -c "DROP DATABASE IF EXISTS wtc_test"
psql -h 127.0.0.1 -U <user> -c "CREATE DATABASE wtc_test"
# Then repeat step 5.
```

The harness applies raw migrations (not idempotent re-run safe) so each run needs a fresh
`wtc_test`. Drop and recreate before a second run.

**`db:seed` and `db:migrate` separation:** `db:seed` targets `DATABASE_URL` (the `wtc` DB); the
real-PG harness self-seeds `wtc_test` via `seedDatabase(db)` inside `beforeAll`. Running `db:seed`
against `wtc_test` before the harness is harmless but unnecessary вЂ” do not include it in the
throwaway-DB operator procedure.

**`db:seed` idempotency:** Phase 3.5 hardened `seedDatabase()` for repeated preview/deploy runs.
The real-PG harness self-seeds its throwaway database; do not run `db:seed` as part of the harness
unless you are explicitly testing the deploy seed command.

**Real-PG gate condition:** The gate is RUN (and may be reported as such) only when ALL of:
- `REAL_POSTGRES_DATABASE_URL` was set to a `wtc_test` or `wtc_test_*` URL
- `npm test -- tests/integration/db-real-postgres.test.ts` exited 0
- All active real-PG tests reported PASS (not skip, not fail)
- The run was against a fresh empty `wtc_test` database

If `REAL_POSTGRES_DATABASE_URL` is absent, `describe.skipIf(!run)` makes the DB-mutating real-PG block
inert while the no-DB availability, DB-name guard, and schema table-list helper tests still run. A default
`npm test -- tests/integration/db-real-postgres.test.ts` pass with skipped real-PG tests is NOT an active
real-PG pass вЂ” the gate is NOT RUN (honest state).

## CI status

CI (`ci.yml`) is active for this repository. Phase 4.61 observed PR #1 merge and the post-merge `main` push run:
pre-merge PR run `27015532545` passed `gates` and `e2e`, and post-merge `main` run `27016644974` passed `gates` and
`e2e` for merge commit `ed31aaaf89ebc4920a13887542fa3bb0bbd99545`. Phase 4.62 then merged PR #3, and post-merge
`main` run `27021006853` passed `gates` and `e2e` for merge commit
`35115df3caf21034d2b4a3d5bffb71ab5a7dfdab`.

Phase 4.63 migrates the active workflow's official JavaScript actions from Node 20-runtime majors to Node 24-runtime
majors: `actions/checkout@v6`, `actions/setup-node@v6`, and `actions/upload-artifact@v7`. This addresses GitHub's
Node.js 20 action-runtime deprecation warning; the project runtime remains `node-version: 24`. Phase 4.64 proves that
migration on GitHub: PR #4 CI run `27022463493` passed `gates` and `e2e`, PR #4 merged at
`787443d8ca040cf94d001f79d1a28bbdc0d84bd3`, and post-merge `main` run `27023047118` passed `gates` and `e2e`.

The local equivalent remains:

```powershell
npm run ci:local
```

`ci:local` is still the fast local release gate. GitHub Actions adds a `postgres:17-alpine` service, runs
`db:migrate`/`db:seed`, validates production-like adapter env fences with ephemeral values, runs root tests/coverage,
builds `@wtc/web`, and runs Playwright `e2e` plus visual evidence inventory/manifest validation.

Do NOT treat green CI as production deployment. It proves repository gates for a commit only; server rollout, production
DB changes, firewall/proxy checks, live provider probes, and monitoring remain separate approved gates.

## Audit append-only role acceptance

Production must enforce `audit_logs` append-only behavior at the PostgreSQL privilege layer, not only
by application convention. The restricted application role must have `SELECT` and `INSERT` on
`public.audit_logs`, and must not have `UPDATE`, `DELETE`, or `TRUNCATE`.

The local acceptance command is opt-in and writes exactly one safe `system.health_check` row after
privilege checks pass:

```powershell
$env:AUDIT_APPEND_ONLY_DATABASE_URL = "postgres://wtc_app_role:<password>@127.0.0.1:5432/wtc_test_audit_role"
$env:AUDIT_APPEND_ONLY_EXPECTED_ROLE = "wtc_app_role"
$env:AUDIT_APPEND_ONLY_PREFLIGHT_ACCEPT = "1"
npm run accept:audit:append-only-role
```

Default safety: the database name must be `wtc_test` or start with `wtc_test_`. For a separately
approved preview/staging/production check, set this only for the approved run:

```powershell
$env:AUDIT_APPEND_ONLY_PREFLIGHT_NON_THROWAWAY_APPROVED = "1"
```

The command connects as the restricted app role, confirms `current_user` matches
`AUDIT_APPEND_ONLY_EXPECTED_ROLE`, checks `has_table_privilege()` for `SELECT`, `INSERT`, `UPDATE`,
`DELETE`, and `TRUNCATE`, confirms the role is not superuser/createdb/createrole/replication/bypassrls
and does not own `audit_logs`, performs a read probe, and inserts one `system.health_check` audit row
with count-only metadata. It does not print full URLs, passwords, cookies, raw env dumps, or server
secrets.

Do NOT report append-only audit role acceptance as RUN unless this command has completed against the
intended database role and target database in the current session. A dry docs update is not proof.

## Phased server rollout (each phase requires explicit approval)

| Phase | Action | Guardrail |
|------|--------|-----------|
| 1 | Local only; no live bot control | Default; nothing on the server changes |
| 2 | Deploy to `/home/ubuntu/apps/wtc_ecosystem_platform`, run on `127.0.0.1:8300` | Internal port only; firewall closed; no nginx yet |
| 3 | Add nginx server block for the WTC domain | Only after approval; TLS; HSTS; `__Host-` session cookie active in prod |
| 4 | Connect Axioma bridge to `axi-o.ma` (read-only metadata + signed handoff) | journal_server keeps its own auth; WTC never proxies exchange keys |
| 5 | Enable read-only bot adapters (`BOT_ADAPTER_MODE=read-only`) | Confirm endpoint shapes per CONTRACTS; legacy plaintext-key issue fixed first |
| 6 | Audited live bot controls | Only after security + bot-integration + exchange audits pass; "stop" never closes positions |

## Migrations & rollback

- Migrations are generated by drizzle-kit into `packages/db/migrations` and applied with `db:migrate`.
- Before any prod migration: `pg_dump` backup. Roll back by restoring the dump + redeploying the prior build.
- `audit_logs` is append-only (enforce via a restricted DB role in prod).
- Before applying migration 0003 (Phase 2.4): `pg_dump` backup. Confirm 0003 is purely additive
  (CREATE TABLE / ADD COLUMN / CREATE INDEX only вЂ” no DROP, no RENAME). Apply against `wtc_test`
  throwaway first; review output; then apply against the target database with a prior dump.
- `db:seed` is idempotent for users, roles, products, plans, entitlements, and the demo teacher course (Phase 3.5 hardened repeated preview/deploy seed runs).

## Environment

See [`.env.example`](../.env.example). **Required in production** (the app fails closed without them):
`DATABASE_URL`, `SESSION_SECRET`, and `SECRET_VAULT_KEK` (+ `SECRET_VAULT_KEY_ID`). If Axioma is in scope and
`AXIOMA_ROUTE_SKELETON_ENABLED=true`, also provision `AXIOMA_BRIDGE_API_TOKEN`, `AXIOMA_HANDOFF_SIGNING_KEY`, and
`AXIOMA_HANDOFF_KEY_ID`. `AXIOMA_HANDOFF_SIGNING_SECRET` is an optional HS256 dev/test stub only and is not a production
handoff signer. If Axioma is out of scope, keep `AXIOMA_ROUTE_SKELETON_ENABLED=false`; Axioma routes remain fail-closed.
Safe defaults: `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`, `BOT_ADAPTER_MODE=mock`.
If `BOT_ADAPTER_MODE` is promoted to `read-only` or `audited` in `NODE_ENV=production` or
`APP_ENV=staging|production`, set `TORTILA_JOURNAL_URL` explicitly, provision `JOURNAL_READ_TOKEN` as a deployment secret,
and verify the Tortila journal rejects missing/wrong tokens before exposing the worker to the endpoint.

## Wave-2 devops checklist

Items to verify before any production deployment (each requires operator sign-off). A safe raw-IP preview has been deployed
separately to `/home/ubuntu/apps/wtc_ecosystem_platform` behind nginx at the operator-only `<raw-preview-url>`; as of
2026-06-01 it was backed by the server Postgres database `<preview-db-name>` with live controls off,
`BOT_ADAPTER_MODE=mock`, and TV automation off. It is still not production.

**What to verify locally (can be done now):**

- [ ] `npm run ci:local` exits 0 (check:core, governance:check, lint, typecheck, typecheck web, secret:scan, test, build)
- [ ] `npm run e2e` passes (requires `npx playwright install chromium` first run)
- [ ] `GET /api/health` returns only the non-secret liveness payload `{ ok: true, status: "ok", service: "wtc-web" }`
      with `cache-control: no-store`; detailed DB/worker/bot evidence stays on authenticated admin pages and persisted health rows
- [ ] `docker-compose.yml` Postgres image is compatible with the target Postgres major (server observed as PG16; CI image may still be PG17)
- [ ] `.env.example` is up-to-date and contains no real secrets
- [ ] `apps/web/src/lib/backend.ts` selector is present (it is вЂ” Phase 1.7 shipped)
- [ ] Auth middleware 429 proof remains green locally: `npm test -- packages/auth/src/rate-limit.test.ts tests/integration/auth-rate-limit-middleware.test.ts tests/integration/auth-error-copy.test.ts`
- [ ] `tests/integration/db-real-postgres.test.ts` opt-in harness passes against a local `wtc_test` DB when operator provides `REAL_POSTGRES_DATABASE_URL` (see real-PG section above)

**What stays NOT RUN until the operator explicitly approves:**

- `db:migrate` / `db:seed` against the raw-IP preview database (RUN on 2026-06-01 against `<preview-db-name>`; not a production deploy)
- `db:migrate` / `db:seed` against any production database (NOT RUN)
- CI via GitHub Actions for the Phase 4.60 merge commit is RUN/PASS in Phase 4.61; future release commits must be watched
  on both PR and post-merge `main` runs before deployment
- Production server deployment with `DATABASE_URL`, real secrets, migrations, seed, rollback, and production start path (NOT RUN)
- Production nginx/domain/TLS cutover (NOT RUN). The current raw-IP nginx route is only a Postgres-backed safe preview.
- Production auth `limit_req` / trusted proxy header verification (NOT RUN). The app middleware is per instance; production must prove nginx/shared-store throttling and trusted `X-Forwarded-For`/`X-Real-IP` handling separately.
- Axioma bridge production handoff (NOT RUN вЂ” local ES256/JWKS dry-run exists; production key provisioning and live Axioma
  endpoint acceptance remain pending)
- Real bot adapters (`BOT_ADAPTER_MODE=read-only`) (local Tortila fixture/auth proof exists; production journal secret,
  firewall, endpoint-shape, and monitoring proof remain NOT RUN)
- Any live bot/exchange systemd/process-control from the WTC package (hard rule вЂ” never)

## Hard rules

- Discovery is read-only; the live trading server (old bot :8000, Tortila :8080, journal_server :8123) is never stopped/edited.
- No `.env`/secret copying. No ssh/tmux/systemd/process control from WTC. No `.env` mutation on the server.
- Exchange keys only in the encrypted vault. Entitlements fail closed. TradingView access stays a manual admin queue by default.
