# ACCEPTANCE_MATRIX_MASTER — WTC Ecosystem Platform

_What counts as "done" per phase group, and the exact gate that proves it. Created 2026-05-30, epoch
`20260530-1625`, from the planning fan-out acceptance findings. "Done" always also requires:
`governance:check` PASS and no false gate-green claim ([`SESSION_PROTOCOL.md`](SESSION_PROTOCOL.md) §6)._

Current credentialed/live blockers are indexed in
[`CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`](CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md). That packet is a blocker map, not an
acceptance gate. Phase 3.59 cleared the local managed LMS DB browser gate with `npm run e2e:lms:db:managed`; remaining
credentialed/live gates are still listed in that blocker packet. Phase 3.60 cleared the local active managed real-PG proof
with `npm run accept:real-pg:managed` against a fresh generated `wtc_test_realpg*` database.
Phase 3.61 cleared local generated-role append-only audit proof with `npm run accept:audit:append-only-role:managed`; direct
production/preview intended-role proof remains a separate gate.
Phase 3.62 cleared local site-readiness with root `npm test`, web build, default `npm run e2e`, local safe-preview HTTP
smoke, core smoke, DB generate, and visual inventory. This is local demo/mock readiness, not production readiness or live
provider acceptance.
Phase 3.63 cleared local production-readiness harness gaps: production-like Stripe/Axioma CI env validation, production-like
Stripe config enforcement, real-form auth production-profile e2e, managed DB-backed auth e2e, and e2e port resilience on
Windows. It does not clear live provider, server/deploy, GitHub CI, intended audit-role, or production monitoring gates.

## Global gate suite (run per batch / final)
| Gate | Command | What it proves |
|---|---|---|
| governance | `npm run governance:check` | every per-agent handoff cited; N-agent claim backed by files |
| smokes | `npm run check:core` | entitlements/crypto/analytics/audit/auth/axioma/billing pure logic |
| lint | `npm run lint` | ESLint 9, `--max-warnings 0` |
| typecheck | `npm run typecheck` + `-w @wtc/web` | packages + app types |
| secrets | `npm run secret:scan` | secretlint clean for text/config/source artifacts; screenshots/images are a separate visual-evidence gate |
| unit+integration | `npm test` | Vitest (PGlite DB integration included) |
| coverage | `npm run coverage` | branch ≥ ~70% is the reliable gate; statements diluted by UI/e2e-covered routes |
| migrations | `npm run db:generate -w @wtc/db` | "No schema changes" (in sync) + table count |
| build | `npm run build -w @wtc/web` | all routes compile |
| compact full runner | `node scripts/gates.mjs full` | sequential local full gate runner; passing gate logs retain compact status/metric only, failing gate logs retain redacted child output |
| retained gate logs | `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates` | generated `logs/gates` evidence is scanner-clean before archiving |
| retained evidence paths | path guard in preflight/scanner/gate scripts | retained evidence roots are repo-local plain paths; symlinks, junctions, and reparse-point components are refused |
| retained preview output | `node scripts/scan-lms-db-e2e-artifacts.mjs <artifact-roots>` | raw `dev-server.log` / `preview-safe*.log` are refused as archive evidence; safe-preview stream redaction is not live preview acceptance |
| e2e | `CI=1 npm run e2e` | Playwright desktop+mobile smokes + generated screenshots; screenshot safety is not proven by this gate alone |
| auth production-profile e2e | `npm run e2e:auth:production-profile` | real register/login forms work without `/api/e2e/login`; local dev profile only |
| auth DB browser | `npm run e2e:auth:db` or `npm run e2e:auth:db:managed` | real register/login forms against a fresh guarded `wtc_test_auth_*` Postgres DB; not a production DB/server proof |
| retained visual artifacts | `npm run evidence:visual -- --manifest <visual-review.json> <artifact-roots>` | retained screenshots/images have explicit OCR/manual review evidence; `--inventory` is counting only and is not acceptance |
| **real-PG** | `npm test -- tests/integration/db-real-postgres.test.ts` | **only with `REAL_POSTGRES_DATABASE_URL` pointing at a fresh `wtc_test*`; harness self-migrates/self-seeds; PGlite is NOT a substitute** |
| **LMS DB browser** | `npm run e2e:lms:db` or `npm run e2e:lms:db:managed` | **only with `LMS_E2E_DATABASE_URL` pointing at a fresh empty `wtc_test_lms_*`, or `LMS_E2E_ADMIN_DATABASE_URL` that creates/drops one; default e2e is NOT a substitute** |

## Per-phase-group definition of done

### PG1 — Foundation / Real-DB / Truth (CURRENT)
- Current docs say the local schema has **43 tables** through migration `0016_colorful_lyja`; fixture counts read **11**
  in STATUS/NEXT_ACTIONS/IMPLEMENTED_FILES; billing-webhooks §1 names `billing_webhook_events`;
  DATA_MODEL §13 0003 column lists match the DDL; §5.3 `ip_address` = TEXT.
- Real-PG harness has a **DB-name guard** (`^wtc_test(_[a-z0-9]+)?$`, unit-tested without a DB),
  a current schema-derived **table-set proof** test, and cross-connection race tests for concurrent grant, webhook
  idempotency, failed-login lockout, and duplicate admin unlock (all DB-mutating tests skipped without creds).
- **Gate:** governance + full suite green; guard/schema helper tests pass; real-PG run = DONE only when all active
  real-PG tests pass against a fresh `wtc_test*` database with `REAL_POSTGRES_DATABASE_URL` set (else **NOT RUN**, recorded
  honestly).

### PG2 — Tortila productization
- `BOT_ADAPTER_MODE=read-only` returns real journal data on all 4 methods; sub-tab pages show real data
  when `TORTILA_JOURNAL_URL` set and honest stale/not_configured/unreachable when not; no "simulated data"
  banner in read-only mode; all 5 risk-signal codes surfaced as non-dismissible P0/P1 warnings; controls disabled.
- **Gate:** e2e smoke per sub-tab state; `/admin/system-health` shows all 4 health states; fixtures-only tests.

### PG3 — Legacy bot boundary
- `LegacyBlockedAdapter` throws on every method (5 gate names as comments); factory returns it
  unconditionally for `legacy_bot`; `/app/bots/legacy` shows "live adapter unavailable" (no metric/position/
  trade cards that look real); no code path activates the real adapter.
- **Gate:** test asserts the blocked adapter throws on `getMetrics`; e2e confirms no metric cards; typecheck.

### PG4 — Billing / Stripe
- If provider selected: test-mode checkout behind `STRIPE_SECRET_KEY` flag, **no live charge**; pricing
  shows real test checkout OR explicit "contact us"; manual_review handles missing-userId with admin notify;
  every webhook grant writes a `billing_webhook_events` row first.
- **Local replay preflight gate:** `accept:billing:stripe-webhook` may be considered locally implemented only when it signs
  deterministic fake Stripe fixtures through shared `@wtc/billing` helpers, invokes the extracted webhook handler against a
  disposable DB, proves valid checkout application, terminal duplicate no-op, bad-signature rejection, and manual-review
  paths, writes only redacted count/status evidence, is excluded from default gates, and retained-artifact scanning rejects
  Stripe secrets, signatures, raw event bodies, and checkout IDs. This is not Stripe CLI/Dashboard acceptance.
- **Local checkout request preflight gate:** `accept:billing:stripe-checkout` may be considered locally implemented only when
  Stripe price-map parsing, test-mode config validation, and Checkout request/body construction live in `@wtc/billing`, the
  real provider and web checkout path use those helpers, dry-run builds generated fake test-mode requests in memory without
  provider network I/O or pending-payment writes, production/live-key environments are refused, retained evidence is redacted,
  and artifact scanning rejects Stripe price IDs, Checkout endpoints, raw request fields, secret keys, and Checkout Session IDs.
  This is not real Checkout Session creation.
- **Live/test Stripe gate:** Stripe test-mode checkout integration and Stripe CLI/Dashboard webhook replay are DONE only when
  observed with operator-provided test `sk_test`, `whsec`, and `price_` IDs and redacted evidence scans green. Production
  key provisioning and endpoint registration remain separate gates.

### PG5 — TradingView access
- `sweepTvExpiry` calls `atomicRevokeTv` (reason `expired_by_worker`); admin queue uses
  `listUsersWithEmailByIds` (no N+1); `revokeReason` shown per-row; <14-day expiry banner on `/app/indicators`; manual-first.
- **Gate:** integration test for sweep→atomic; e2e smoke for revokeReason + expiry banner.

### PG6 — Axioma / terminal
- ES256 signer wired to a provisioned P-256 key + staging-fenced; `axioma_handoff_jti_revocations`
  table + `consumeJti` replay store; Download/Open-Journal/OTC implemented **only** against confirmed
  `journal_server` shapes (else disabled + documented blocker); hard "WTC never gates local execution" callout stays.
- **Local handoff preflight gate:** `accept:axioma:handoff-preflight` may be considered locally implemented only when generated
  ephemeral P-256 material is used in process, `@wtc/axioma-bridge` proves ES256/JWKS/token-shape verification without
  returning raw token/key material, local journal-handoff and JTI consume handlers run against disposable PGlite, no Axioma
  network I/O occurs, production/configured-live-key environments are refused, the command is excluded from default gates, and
  retained-artifact scanning rejects Axioma PEM keys, service tokens, compact JWTs, raw handoff route evidence, raw single-use
  or CSRF claims, and linked user identifiers. This is not production key provisioning or live Axioma endpoint acceptance.
- **Gate:** endpoint-shape confirmation on file; ES256 round-trip + jti-replay tests; e2e for CTA states.

### PG7 — Education / LMS
- Rich migration (slug/level/tags/content_type/embed/file-meta/global-pinned/progress state) lands **only if
  bounded+tested**; video-embed/PDF/link materials render; club `pinned_links` admin UI wired; file upload stays
  a locked card (not a stub); LMS RBAC failure throws + audits (no silent return); CSRF is the first gate.
- **Gate:** PGlite integration test for the migration + rich repos; e2e for embed + pinned_links; RBAC-throw test.
- **DB upload/download gate:** `npm run e2e:lms:db` is RUN only after a fresh empty `wtc_test_lms_*` database is created,
  `LMS_E2E_DATABASE_URL` is set, Playwright exits 0, `scripts/scan-lms-db-e2e-artifacts.mjs` exits 0 on generated
  artifacts with no raw bytes/base64/storage keys/raw iframe, internal material metadata, session/auth markers, or
  secret-shaped values, failed response assertions prove no byte/hash/storage/header leak, the scanner consumes the transient
  dynamic marker manifest from `LMS_DB_E2E_DYNAMIC_MARKERS_PATH`, evidence is archived only after the scanner passes, retained
  screenshots pass the separate visual-artifact review gate, and the throwaway database is dropped. The transient marker
  manifest itself must not be archived. Without that observed run, this gate is **NOT RUN** even if default `npm run e2e`,
  visual inventory, and all PGlite tests are green.
- The managed wrapper `npm run e2e:lms:db:managed` is an equivalent way to satisfy the gate only when
  `LMS_E2E_ADMIN_DATABASE_URL` creates a fresh `wtc_test_lms_*` database, delegates to `npm run e2e:lms:db`, and drops that
  generated database after the scanner passes.
- **Material DTO boundary:** student material projections must stay allowlisted to display/download/embed fields only and
  must not carry filename/MIME or storage/hash/quarantine/retention/delete internals. Teacher material projections may add
  display-only filename/MIME, but admin audit rendering stays summary-only and payload-free.
- **Local material cleanup:** DB-local cleanup may hard-delete only expired file rows with `storage_provider = 'db-local'`,
  a local `lms/materials/` storage-key prefix, and either `deleted_at IS NOT NULL` or an unsafe scan state. It must emit only
  aggregate counts in worker health/logs and a summary-only cleanup audit event with no material IDs, filenames, hashes,
  bytes/base64, storage keys, or quarantine details. This is not production object-storage cleanup.
- **Storage adapter boundary:** local storage adapters must preserve `db-local` byte behavior, allow explicit `fs-local`
  object-style rows without inline DB bytes, validate storage keys under `lms/materials/`, generate new local keys as opaque
  single-segment values that do not contain filenames or content hashes, fail closed for unsupported providers before
  audit/streaming, and keep client DTOs on the app download route only. Successful downloads must not expose `x-lms-sha256`,
  must use generic MIME-derived attachment filenames, and generated artifact scanning must reject that deprecated header name
  plus filename/MIME metadata markers. Upload/download audit payloads and teacher material DTOs must stay filename-free.
- **S3/R2 adapter boundary:** `s3-r2` may be considered locally implemented only when typed config requires HTTPS endpoint,
  bucket, region, access key id, and secret access key; uploads are mocked at the object-store HTTP boundary and persist no
  inline DB bytes; downloads use a short-lived signed redirect after auth/entitlement/clean-row/storage resolution; upload
  actions prove ownership before external writes; unknown providers fail closed; and generated-artifact scanning rejects
  signed URL tokens such as `X-Amz-Signature`. This is not live object-store acceptance: real S3/R2 credentials, external
  malware scanning, object-store delete/reconciliation cleanup, retained network artifact policy, and public upload rollout
  need separate observed gates.
- **External scanner boundary:** `LMS_FILE_SCANNER_MODE=external` may be considered locally implemented only when typed config
  requires an HTTPS scanner endpoint and bearer token, scanner calls are bounded by timeout, uploads call the scanner before
  storage writes, scanner failures/malformed responses fail closed before object writes, clean verdicts may store, quarantined
  `s3-r2` verdicts do not write unsafe bytes to the standard object bucket, audit payloads avoid raw scanner reason text, and
  generated-artifact scanning rejects scanner endpoint/token assignments. This is not live malware-engine acceptance; a real
  scanner endpoint/token, safe test corpus, live clean/quarantine/failure/timeout observations, object cleanup/reconciliation,
  and public upload rollout need separate observed gates.
- **Live external scanner preflight boundary:** the scanner preflight is locally ready only when the external scanner
  request/response contract is shared through `@wtc/lms`, the web upload path consumes the shared helper, dry-run
  `accept:lms:external-scanner` writes redacted scanner-safe evidence without network I/O, live mode is excluded from default
  gates and refuses to run without explicit live consent, quarantine-corpus confirmation, `LMS_FILE_SCANNER_MODE=external`,
  valid HTTPS scanner config, and `LMS_PUBLIC_UPLOADS_ENABLED=false`, and generated-artifact scanning rejects scanner endpoint
  assignments, tokens, request headers, octet-stream request markers, exact corpus markers, and raw provider JSON verdicts.
  This is still not live scanner acceptance unless the live command exits 0 against an operator-approved scanner endpoint/token
  and its retained evidence scans green; live object-store acceptance, DB-backed browser acceptance, cleanup/reconcile
  acceptance, and public upload rollout remain separate observed gates.
- **Object-store cleanup/reconciliation boundary:** local `s3-r2` cleanup may be considered locally implemented only when DB
  selection is bounded to expired file rows under opaque `lms/materials/` keys with `deleted_at IS NOT NULL` or unsafe scan
  status, clean object rows are hard-deleted from DB only after SigV4 `DELETE` returns success or already-absent `404`,
  non-clean metadata-only rows are purged without remote object calls under the Phase 3.30 no-standard-object-write invariant,
  failed object deletes retain retryable DB rows, worker health/logs/audits remain count-only, and generated-artifact scanning
  rejects cleanup evidence containing raw object keys, auth headers, or signed URL/query tokens. This is not live object-store
  acceptance; throwaway bucket credentials, live upload/download/delete/reconcile observations, compensating delete/outbox
  behavior for object PUT followed by DB insert failure, and public upload rollout need separate observed gates.
- **Upload compensation boundary:** local `s3-r2` upload compensation may be considered locally implemented only when the web
  material creation path delegates through a testable orchestrator, clean file inputs whose object PUT already succeeded
  attempt a signed object `DELETE` if repository material creation fails, `404` is treated as already reconciled, quarantined
  metadata-only inputs do not delete remote objects, compensation failure does not replace the original material creation
  error, and focused tests prove the action/helper wiring plus helper behavior. This is not durable retry or live object-store
  acceptance; pending-row/outbox/staging-key semantics for failed compensation or process interruption, throwaway bucket
  observations, DB browser acceptance, and public upload rollout need separate observed gates.
- **Durable pending-upload cleanup boundary:** local durable upload cleanup may be considered locally implemented only when a
  private DB row is created before clean `s3-r2` object PUT, successful material creation completes that row in the same DB
  transaction as the material insert/audit, failed material creation attempts immediate compensation, failed compensation
  records generic retry state with backoff/max-attempt dead-letter, the worker processes pending cleanup rows that have no
  material row, DELETE 2xx/404 marks cleanup complete, health/logs/audits stay count-only, and generated-artifact scanning
  rejects pending cleanup evidence containing object keys, signed URL/query tokens, authorization headers, filenames, hashes,
  bytes/base64, scanner details, or raw provider errors. This is not live object-store acceptance, DB browser acceptance,
  dead-letter acknowledgement/retry, live scanner acceptance, or public upload rollout; those need separate observed gates.
- **Cleanup dead-letter ops review boundary:** admin operational review for LMS pending upload cleanup may be considered
  locally implemented only when `/admin/system-health` exposes count-only dead-letter, due retry, scheduled retry, latest
  dead-letter timestamp, and generic error-code fields; the DB summary projection does not select task IDs or storage keys;
  health projection and audit events stay summary-only; and tests prove admin output cannot include cleanup task IDs, object
  keys, filenames, hashes, signed URL tokens, auth headers, scanner details, provider bodies, or raw errors. This is not
  acknowledgement, assignment, retry-from-dead-letter, live object-store acceptance, live scanner acceptance, DB-backed
  browser acceptance, or public upload rollout.
- **Cleanup dead-letter acknowledgement/retry boundary:** local admin dead-letter ack/retry may be considered implemented
  only when acknowledgement metadata is durable and distinct from confirmed cleanup completion; `/admin/system-health` uses
  aggregate CSRF-protected actions that submit no task IDs or object locators; repository mutations reselect guarded cohorts
  by expected count/latest timestamp and abort stale snapshots; ack/retry audit payloads are summary-only with `targetId =
  null`; retry requeues reviewed dead letters for the worker without admin-side object DELETE and without resetting attempts;
  the worker proves retried rows complete on 2xx/404; and artifact/source tests reject cleanup task ID field names, storage
  keys, filenames, hashes, signed URL tokens, auth headers, scanner details, provider bodies, and raw errors. This is not live
  object-store acceptance, live scanner acceptance, DB-backed browser acceptance, assignment/workflow ownership, or public
  upload rollout.
- **Shared object-store primitives boundary:** local `s3-r2` object-store request construction may be considered locally
  implemented only when web and worker both consume shared `@wtc/lms` helpers for object-store config validation and signed
  PUT/DELETE/read URL construction, app files keep fetch/error handling but no SigV4/HMAC implementation, package-level tests
  cover config validation, request headers, bounded read URL expiry, and invalid-key rejection, and static tests prevent
  duplicated signing/config code from returning to app files. This is not live object-store acceptance, signed redirect
  artifact retention acceptance, live scanner acceptance, DB-backed browser acceptance, or public upload rollout.
- **Live object-store preflight boundary:** the LMS S3/R2 preflight is locally ready only when deterministic SigV4 golden tests
  pin exact PUT, DELETE, and signed-read request values; `accept:lms:object-storage` dry-run writes redacted, scanner-safe
  evidence without network I/O; live mode is excluded from default gates and refuses to run without explicit live consent,
  throwaway-target confirmation, `LMS_FILE_STORAGE_PROVIDER=s3-r2`, valid HTTPS object-store config, and
  `LMS_PUBLIC_UPLOADS_ENABLED=false`; and generated-artifact scanning rejects object-store env assignments, signed request
  headers/query tokens, raw object keys, provider body markers, and request IDs. This is still not live acceptance unless the
  live command exits 0 against operator-approved throwaway S3/R2 credentials and its retained evidence scans green; live
  scanner acceptance, DB-backed browser acceptance, cleanup/reconcile acceptance, and public upload rollout remain separate
  observed gates.

### PG8 — Admin console
- All admin pages render mobile-readable cards (no 375px horizontal scroll); TV queue N+1 fixed; review
  queue approve/reject/dismiss operational; `/admin/bots` shows Tortila status + legacy BLOCKED honestly;
  system-health shows honest "unknown" for never-run checks.
- **Gate:** e2e mobile smoke for `/admin/*`; N+1 integration test.

### PG9 — User cabinet
- Every `/app/products` card shows name + entitlement state + plan code + expiry + correct next-action CTA;
  mobile-first (no 375px horizontal scroll); no fake availability claims.
- **Gate:** e2e per product card state (active/expired/none) desktop+mobile.

### PG10 — Backtester
- Operator decision implemented: **(A)** real runner — `backtest_jobs`/`backtest_artifacts` tables, job CRUD
  routes, runner ZIP at signed URL, artifact upload+Zod; **OR (B)** permanent locked card (no form, no
  download button). **No half-state.** No fabricated results.
- **Gate:** decision in ARCHITECTURE_DECISIONS; A: job-CRUD+artifact integration test; B: e2e confirms no form.

### PG11 — Security / rate-limiting / observability
- `apps/web/src/middleware.ts`: IP-keyed rate-limit on auth routes (429 + Retry-After on breach) + security
  headers (CSP/HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy/Permissions-Policy/COOP/CORP);
  `redact.ts` value-pattern guard (PHC/Bearer/64-hex); structured logger; `audit_logs` append-only role.
- **Gate:** pure limiter unit test + deterministic middleware integration 429 (`Retry-After` and generic body) + e2e security-header smoke; `secret:scan` PASS; build green (billing-webhook test still passes). Normal-suite Playwright 429 burst is intentionally not the default gate because it destabilizes the shared dev server.

### PG12 — CI / deployment readiness
- Repo is a git repo with a remote; `ci.yml` has had ≥1 green run; DEPLOYMENT.md covers
  env/migrate/seed/rollback/secrets/nginx/systemd verified against a real (approved) deploy; `db:seed`
  idempotent; production-readiness checklist complete (all Phase-2.4 blockers cleared).
- **Gate:** CI green on GitHub; real-PG migrate/seed confirmed; production-readiness checklist signed off.

## "Production-ready" is claimable only when
Real-PG run DONE · git+CI green · secrets provisioned (KEK/SESSION/Axioma) · Stripe checkout decided ·
Axioma CTAs real-or-honestly-disabled · legacy honestly blocked · auth rate-limit live · all per-group gates green.
Until then, **NOT production-ready** is the standing truth.
