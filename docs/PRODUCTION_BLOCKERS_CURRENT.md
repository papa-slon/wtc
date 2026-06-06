# Current Production Blockers

Last updated: 2026-06-06, Phase 4.74 exact-main canary deploy/burn-in.

Phase 4.74 clears the existing WTC HTTPS canary app/worker rollout for GitHub `main`
`abe6784518abcbebe38368f3cef05039d55c520f`: the server release
`/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260606-0213-abe6784-phase474-main` is mounted into
`wtc-ecosystem-canary` and `wtc-ecosystem-worker`, server build passed, `db:migrate` passed with no DB migration diff in the
release delta, local/public smoke passed, and five short burn-in cycles showed WTC health `200`, `bot_continuity ok`,
`tortila ok`, and `legacy ok`. Live bot services and Legacy tmux stayed running and were not restarted. Phase 4.70 clears
the canonical git-backed Tortila source landing/verifier gate with private repo `papa-slon/tortila-canonical-source`,
branch `main`, commit `f53a774c3bc4c14653906bd2f778a515c565cf12`. Phase 4.71 clears the strict WTC managed proof against
that canonical source with a disposable local PostgreSQL lane. Phase 4.72 clears the Tortila canary runtime auth/firewall
gate: the canonical source is deployed to `turtle-journal.service` as
`/home/ubuntu/apps/turtle_bingx_releases/20260606-0728-f53a774-journal-auth`, missing/wrong token probes return `401`,
valid bearer/header probes return `200`, worker continuity remains green, public TCP negative probes are green from the
workstation vantage, and `turtle-bot.service` was not restarted. Phase 4.73 adds a repeatable Legacy closed-trade source
audit gate and reconfirms the live Legacy runtime is `blocked_no_source`, not mapper-ready. Remaining production blockers
are full branded-domain rollout/burn-in/provider-console perimeter proof, Legacy realized closed-trade source/import proof,
live-control audit, and other credentialed provider gates. Do not substitute local UI polish, active orders/slots, or green
GitHub CI for those remaining gates.

Phase 4.69 adds WTC tooling for the Tortila source gate. Phase 4.70 uses it against a clean private git-backed source
packet and passes: export forbidden-artifact scan PASS, export secret scan PASS, bot `pytest` PASS, bot `ruff` PASS, and
WTC `npm run verify:tortila:canonical-source` PASS. `accept:tortila:real-read:managed` can require that verifier with
`TORTILA_CANONICAL_SOURCE_REQUIRED=1`. Phase 4.71 ran that strict proof on a separate disposable local PostgreSQL 17
cluster and verified `sourceAdapter=tortila`, `readState=ok`, `tradesImported=2`, `positionsSnapshotted=1`, and
`marksRequests=0`, with cleanup checks proving no leftover throwaway DB/temp cluster. Server read-only Legacy audit also
confirmed no durable closed-trade source table/API/artifact exists, so Legacy realized analytics/import remains blocked.
Phase 4.72 then deployed that canonical source to the live journal runtime and proved the live journal auth matrix without
printing the real token.

Phase 4.61 clears the GitHub CI blocker for the current merged WTC repo tree, not production deployment. PR #1 merged to
`main` at `ed31aaaf89ebc4920a13887542fa3bb0bbd99545`; pre-merge PR CI run `27015532545` and post-merge `main` push CI
run `27016644974` both passed `gates` and `e2e`. Remaining production blockers are now production deploy/canary,
production DB/secret/firewall/proxy/monitoring proof, canonical Tortila source and production journal auth/firewall probes,
Legacy closed-trade source/import proof, live-control audit, and other credentialed provider gates.

Phase 3.68 deploys Legacy Bot read-only live visibility to the WTC HTTPS canary as release
`20260603-0724-0eb22a2-legacy-live-read`. Legacy live-read now flows through:
provider Postgres safe columns -> WTC worker snapshot -> WTC Postgres -> WTC web/admin UI.
The path uses the existing provider `pub_id` runtime and does not collect, store, render, or proxy Legacy exchange keys
inside WTC. The deploy replaced only `wtc-ecosystem-canary` and `wtc-ecosystem-worker`, kept existing bot services active,
kept live controls disabled, and kept external bot API ports closed.

This does **not** clear full production readiness. Legacy direct HTTP/control adapter and live apply remain blocked by
live-control safety gates; the new Legacy UI is read-only snapshot/config visibility. Remaining blockers also include
provider-side journal bearer-auth proof, any live bot control, Stripe checkout/webhook acceptance, Axioma live
bridge/download/account-link, live LMS object-store/scanner, branded-domain DNS/TLS, long-running burn-in/alerting, and
direct intended production append-only audit-role proof.

Phase 3.65 clears the Tortila mock-only blocker for the production canary. Tortila real read-only data now flows through
WTC DB snapshots/imports: Tortila journal -> `wtc-ecosystem-worker` -> WTC Postgres -> web/admin UI. The accepted release is
commit `4487b3d`, deployed as server release `20260602-1816-4487b3d`. Browser checks passed for the public Tortila product
page, authenticated Tortila dashboard, positions, trades, equity, journal, statistics, admin bots, and admin system-health.
The worker wrote `worker` and `tortila-journal` health rows, metric snapshots, position snapshots, and `13` imported trades.
Existing bot services remained active, and live controls remained disabled.

This does **not** clear full production readiness. Remaining blockers include provider-side journal bearer-auth proof, any
live bot control, Legacy non-mock integration, Tortila `/api/marks` / `/api/overview` consumption, Stripe self-serve
billing acceptance, Axioma live bridge/download/account-link, live LMS object-store/scanner, branded-domain DNS/TLS,
long-running burn-in/alerting, and direct intended production append-only audit-role proof.

Phase 3.64 changed the current production status: WTC is now publicly live as an HTTPS production canary at
the operator-known `https://<wtc-canary-host>`, backed by release `5522900`, canary DB `wtc_platform_canary_20260602_1412`, nginx/TLS,
and a secure-cookie browser registration/login smoke. Both existing bots remained running, and the bot API ports are now
firewalled from the public internet while still open locally on the server. This clears the "no public deployed site" blocker
for canary review.

It does **not** clear full production readiness. The canary intentionally runs `BOT_ADAPTER_MODE=mock` and
`FEATURE_LIVE_BOT_CONTROL=false`. Real Tortila/Legacy adapter acceptance, any live bot control, Stripe self-serve billing,
Axioma live bridge, live LMS object-store/scanner, branded-domain DNS/TLS, production worker rollout, and long-running
monitoring remain blockers.

Phase 3.6 made the local product preview and e2e harness stricter. The 2026-06-01 continuation cleared the real-Postgres acceptance blocker for the raw-IP preview host and moved the preview off in-memory storage.

## Cleared for raw-IP preview
- B1 real Postgres acceptance: RUN / PASS on the server against a fresh throwaway `wtc_test_*` database (`tests/integration/db-real-postgres.test.ts` -> 11/11). A persistent `<preview-db-name>` database was created, migrations through `0006` were applied, seed succeeded, and `wtc-ecosystem-preview` now runs with `DATABASE_URL` set. Bot services were not touched.
- B5 auth rate-limiting and login lockout: current app middleware enforces 10 requests / 60s per client IP on the real server-action POST paths `/login` and `/register`, returns `429` + `Retry-After` with generic JSON, and has deterministic middleware integration coverage. `/login` now also has DB-backed account-specific failed-login counters, 15-minute/60-minute lockout windows, reset-on-success behavior, generic locked-account browser copy, and PGlite coverage. Admin unlock is now a local DB-backed admin server action: it clears lockout/review state in one transaction with an `auth.account_unlock` audit row and a validated reason, and `/admin/users` exposes only admin-safe lockout state. Successful DB-backed registration now writes an in-transaction `auth.register` audit row with non-secret metadata only, and demo mode mirrors the event. Registration/login browser error copy is code-mapped and neutral. Production nginx/shared-store throttling, active real-Postgres account-lockout/admin-unlock race proof, email notification/review workflow, production append-only audit DB role proof, and production rollout remain separate hardening items, not raw-IP preview blockers. Phase 3.49 added `npm run accept:audit:append-only-role` as the opt-in permission preflight for the restricted `wtc_app_role`; Phase 3.61 added and ran a local managed throwaway proof with a generated temporary restricted role, but the real production/preview intended-role proof is still NOT RUN until operator credentials are supplied and the direct command passes against the intended target.

Phase 3.46 clarification updated by Phase 3.60: the old raw-IP preview B1 evidence is not the current active auth/account
race proof. The current `tests/integration/db-real-postgres.test.ts` harness now uses a dynamic Drizzle schema table-set
proof through migration `0016_colorful_lyja`. Phase 3.60 supplied an operator-approved existing-bot Postgres source only
in-process to `npm run accept:real-pg:managed`; the final run created `wtc_test_realpg20260602105824d18bef`, ran the active
real-PG harness (`14 passed`), and dropped the throwaway DB. This clears the current local active managed real-PG proof, but
does not replace preview/prod DB rollout, append-only audit-role proof, deploy, CI, or production monitoring.

Phase 3.50-3.63 clarification: the recent runner/evidence work hardened local operator proof paths and then cleared the local
managed LMS DB browser gate, local active managed real-PG proof, local generated-role append-only audit proof, and local
site-readiness plus local production-readiness harness gaps, not production
acceptance. Runner typo/help handling is safer, LMS/real-PG managed wrappers no longer echo URL-shaped unknown args, active
durable docs no longer retain raw preview coordinates, preflight summary roots are confined to relative repo-local `logs/...`
paths, one-shot child stdout/stderr plus passing `logs/gates/*.log` retained logs are redacted/compacted, and retained
screenshots/images now require a separate visual review/OCR manifest before they can be treated as reviewed evidence.
`safe-preview` stdout/stderr is redacted before forwarding, and raw `dev-server.log` / `preview-safe*.log` files are refused
as archive evidence. Phase 3.57 also makes these retained-evidence paths symlink-hard: preflight roots, fixed `logs/gates`,
LMS retained artifact roots, visual artifact roots, dynamic marker manifests, visual review manifests, and OCR sidecars now
reject symlink, junction, and reparse-point components before writes or reads. Phase 3.59 used the operator-identified local
existing-bot Postgres settings to run `npm run e2e:lms:db:managed` successfully against a fresh throwaway
`wtc_test_lms_20260602101117_cc7889`; Playwright passed desktop/mobile, retained text artifacts scanned clean, the retained
mobile lesson screenshot passed manual visual review, and the generated DB was dropped. These changes reduce
evidence-retention risk and clear local managed LMS DB browser acceptance. Phase 3.60 used the same operator-identified local
existing-bot Postgres source to run `npm run accept:real-pg:managed` successfully against fresh throwaway
`wtc_test_realpg20260602105824d18bef`; the active real-PG harness passed (`14 passed`) and the generated DB was dropped.
These local DB acceptance and site-readiness runs do **not** replace production/preview append-only audit-role proof,
live object-store/scanner/provider preflights, live/server preview smoke,
SSH/nginx/systemd checks, production deploy, or production monitoring. The current operator packet for
the remaining blocked credential/live gates is `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`. The next-session prompt is
`docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_62_20260602.md`.

Phase 3.62 local site-readiness details: root `npm test` passed (`921` passed, `10` skipped), `npm run build -w @wtc/web`
passed, default `npm run e2e` passed on rerun (`44` passed, `8` skipped), `npm run check:core` passed,
`npm run db:generate -w @wtc/db` reported `43` tables with no schema changes, visual inventory reported `69` images and
`0` blocked containers, and the workspace `preview:safe` process responded at `http://127.0.0.1:3000` with HTTP `200`.
This clears local manual demo/mock website review, not production readiness.

Phase 3.63 production-readiness gap-closure details: six read-only agents were dispatched before edits and closed. The staged
CI workflow now generates production-like Stripe and ES256 Axioma material and validates config loading, but GitHub CI remains
NOT RUN because the folder is not git-backed. Config now requires Stripe secret/webhook/price-map values when
`BILLING_PROVIDER=stripe` in production-like environments. Real-form auth Playwright now exists separately from default
e2e; DB-backed auth acceptance passed against a throwaway Postgres database created from the operator-approved existing-bot
Postgres source (`wtc_test_auth_20260602130742_099899`, 17 migrations plus seed, `2` Playwright tests passed, DB dropped).
Default e2e moved from Windows-reserved ports `3100-3103` to `3410-3413` defaults and passed (`44` passed, `6` skipped).
No-network Stripe/Axioma/LMS preflight dry-runs passed with scanner-clean retained summaries. These local and dry-run gates do
not replace the still-missing intended audit-role, live provider, server/deploy, CI, monitoring, or live bot gates.

## Still blocking production
- B2 Stripe acceptance: Stripe test checkout exists, and a local no-network Stripe webhook replay preflight now exercises
  signed fake checkout events through the extracted handler against disposable PGlite with redacted evidence. A separate
  local no-network checkout request preflight now validates shared request construction and redacted evidence without calling
  Stripe or writing pending-payment rows. Real Stripe CLI/Dashboard replay, real Stripe test checkout acceptance with
  operator-provided `sk_test`/`whsec`/`price_` values, production key provisioning, production webhook endpoint registration,
  and live/staging route replay are still NOT RUN.
- B3 Legacy bot direct HTTP/control adapter: still blocked for HTTP management endpoints, start/stop, retest, and live
  apply. The accepted canary read surface is the worker DB snapshot by provider `pub_id` with safe-column SQL only.
- B4 Axioma terminal: JWKS route, local WTC-side JTI consume route, route-level journal handoff acceptance, a local one-time download token/proxy handler, local account-link hash/active-link persistence, local account-link init/complete/unlink routes, parse-verified route readiness, an opt-in no-network Axioma handoff preflight, and Axioma-specific retained-artifact deny rules now exist and fail closed when prerequisites are absent. The runtime download adapter still has no live installer fetcher, and no live Axioma endpoint-shape/account-link/download acceptance has been run, so real download/open-journal/OTC activation remains blocked on endpoint shapes, OP ES256 key provisioning, live Axioma consume/download/account-link acceptance, installer streaming/security acceptance, real-Postgres JTI race proof, and enabled browser CTA acceptance.
- TradingView private invite automation: still manual/admin-state only.
- TradingView real-Postgres race acceptance: local PGlite and migration checks cover unique manual task identity, but a fresh throwaway real-Postgres cross-connection race remains recommended when credentials are provided.
- LMS uploads and embeds: local DB-backed file byte storage, binary MIME sniffing, storage-provider/key metadata, scan/quarantine state, retention timestamps, soft-delete visibility, entitlement-checked fail-closed downloads, stored iframe sanitizer, an opt-in DB-backed browser acceptance harness, role-specific material DTO projection boundaries, an optional managed throwaway-DB runner, a `db-local` worker cleanup for expired soft-deleted/unsafe file rows, a local storage adapter boundary (`db-local` plus explicit `fs-local`), opaque new local storage keys, no successful `x-lms-sha256` download header, generic success download filenames, filename-free LMS upload/download audit payloads, filename-free teacher material DTO/UI, a transient dynamic marker manifest for DB-browser artifact scanning, an `s3-r2` S3/R2-compatible adapter boundary with mocked SigV4 upload plus short-lived signed redirect coverage, a mocked external malware-scanner adapter boundary, a local mocked `s3-r2` object-store cleanup/reconciliation worker boundary, a local best-effort upload compensation boundary for clean `s3-r2` object PUT followed by material DB failure, a private durable pending-upload cleanup table/worker retry boundary, a count-only admin dead-letter review surface, shared `@wtc/lms` object-store request builders, guarded aggregate dead-letter acknowledgement/retry operations, deterministic exact SigV4 vector tests, a dry-run-first/live-opt-in object-store preflight command, shared `@wtc/lms` external scanner helpers, and a dry-run-first/live-opt-in external scanner preflight command are built and locally gate-verified. The scanner boundary requires HTTPS endpoint/token config, bounded timeout, fail-closed scanner errors before storage writes, scanner-before-object-write ordering, no filename/hash scanner envelope, no standard object-bucket write for quarantined `s3-r2` verdicts, scanner endpoint/token artifact deny rules, and scanner request/header/provider-body evidence deny rules. The object cleanup boundary selects expired `s3-r2` rows, deletes clean object rows before DB hard-delete, treats `404` as already reconciled, purges unsafe metadata-only rows without remote object calls, retains rows on delete failure, and emits count-only health/audit payloads. The upload compensation boundary attempts signed DELETE only for actually-written clean `s3-r2` file inputs, treats `404` as reconciled, skips quarantined metadata-only rows, and preserves the original DB/material creation error if compensation fails. The durable pending-upload cleanup boundary creates a private `lms_object_cleanup_tasks` row before clean object PUT, completes it atomically with successful material creation or confirmed compensation/worker DELETE, retries failed DELETEs with generic error code/backoff, and dead-letters after max attempts while keeping health/audit/artifacts count-only. The dead-letter ops boundary exposes only counts, timestamps, generic error code, acknowledgement counts, and guarded aggregate ack/retry controls on `/admin/system-health`; it does not expose cleanup task IDs, object keys, filenames, hashes, signed URLs, scanner details, or provider bodies. Retry requeues reviewed dead letters for worker processing without admin-side object DELETE and without resetting attempts. The shared object-store boundary centralizes S3/R2 config validation and signed PUT/DELETE/read URL request construction in `@wtc/lms` for both web and worker while keeping fetch/error handling app-local. The object-store preflight command refuses live mode without explicit consent and throwaway-target confirmation, writes only redacted summary evidence, and the generated-artifact scanner now rejects object-store env assignments, signed object headers, provider body markers, and request IDs. The external scanner preflight command refuses live mode without explicit consent and quarantine-corpus confirmation, writes only redacted summary evidence, and the generated-artifact scanner now rejects scanner live env assignments, request headers, octet-stream markers, and raw provider verdict JSON. The harness now includes unauthenticated/non-entitled denial, quarantined no-download UI, sanitized embed rendering, expanded failed-response/header no-leak assertions, admin/material metadata no-leak assertions, and a generated-artifact scanner wired into the opt-in runner, including deny rules for the deprecated hash header, filename/MIME metadata markers, signed URL tokens, scanner endpoint/token assignments, cleanup object-key/auth-token evidence, pending-upload cleanup evidence, cleanup task identifier field names, object-store preflight evidence leaks, scanner preflight evidence leaks, and per-run dynamic marker values/base64 forms when a manifest is configured. Phase 3.59 ran the managed throwaway-Postgres browser acceptance successfully with `npm run e2e:lms:db:managed`; final Playwright desktop/mobile passed, retained text artifacts scanned clean, the retained mobile lesson screenshot passed manual visual review, and the generated DB was dropped. Live S3/R2 upload/download/delete/reconcile acceptance is still NOT RUN because no operator-approved throwaway object-store credentials were supplied. Live external malware-scanner acceptance is still NOT RUN because no operator-approved endpoint/token was supplied. Public upload rollout remains open.
- Worker service: Tortila snapshot/import code exists and now has a local safe one-shot smoke command plus an admin heartbeat surface. Phase 3.65 deployed managed Docker worker `wtc-ecosystem-worker` for the Tortila read-only canary, and it is writing WTC DB health, metric, position, and trade-import evidence. This clears the worker rollout gate for the Tortila read-only canary only. Production burn-in, alerting, worker freshness monitoring, provider-side journal bearer-auth acceptance, and broader platform worker/provider gates are still open.

## Clarification
`/admin/terminal` is a terminal release metadata room. It is not installer hosting, not real Axioma activation, and not local terminal execution gating.
