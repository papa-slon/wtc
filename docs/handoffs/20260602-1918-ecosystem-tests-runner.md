# ecosystem-tests-runner handoff
## Scope
Read-only Phase 3.63 production-readiness acceptance audit. Static inspection only: no long tests, no live/provider calls, no DB mutation, no deploy/server commands, no bot service control. Objective was to identify current acceptance coverage and the exact remaining gates needed before production readiness can be claimed.

## Files inspected
`AGENTS.md`; `.claude/agents/ecosystem-tests-runner.md`; `docs/handoffs/0000-orchestrator-seed.md`; `docs/SESSION_PROTOCOL.md`; `docs/handoffs/20260602-1856-phase-3-62-local-site-readiness.md`; `docs/STATUS.md`; `docs/NEXT_ACTIONS.md`; `docs/ACCEPTANCE_MATRIX_MASTER.md`; `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`; `docs/PRODUCTION_BLOCKERS_CURRENT.md`; root `package.json`; `apps/web/package.json`; `apps/worker/package.json`; `packages/db/package.json`; `vitest.config.ts`; `playwright.config.ts`; `playwright.lms-db.config.ts`; `eslint.config.js`; `tsconfig.json`; `tsconfig.base.json`; `.github/workflows/ci.yml`; `scripts/gates.mjs`; managed DB runners; live/provider preflight scripts; and focused acceptance-harness tests under `tests/integration/*preflight*.test.ts`, `tests/integration/db-real-postgres.test.ts`, `tests/integration/lms-db-e2e-harness.test.ts`, and managed-runner safety tests.

## Files changed
None - read-only audit of repo artifacts. Required handoff write only: `docs/handoffs/20260602-1918-ecosystem-tests-runner.md`.

## Findings
1. Severity: High. Evidence: `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:6`-`7` says local managed DB, local audit-role, and local site-readiness proofs are RUN/PASS but remaining live/credentialed gates are NOT RUN; `docs/ACCEPTANCE_MATRIX_MASTER.md:236`-`239` says production-ready is claimable only after Real-PG, git/CI, secrets, Stripe, Axioma, auth-rate-limit, and all per-group gates are green. Recommendation: keep WTC marked not production-ready until the intended-environment gates below are observed green. Target part: production readiness claim.
2. Severity: High. Evidence: Phase 3.62 explicitly did not attempt production deployment or live provider acceptance (`docs/handoffs/20260602-1856-phase-3-62-local-site-readiness.md:6`) and treats local site-readiness as separate from production readiness, live provider acceptance, server deployment, and CI (`docs/handoffs/20260602-1856-phase-3-62-local-site-readiness.md:60`). Recommendation: count Phase 3.62 only as local demo/mock site readiness. Target part: local-vs-production gate boundary.
3. Severity: High. Evidence: current blocker table lists production/preview intended audit-role proof, LMS object-store live preflight, LMS external scanner live preflight, Stripe acceptance, Axioma live acceptance, live/server preview smoke, GitHub CI, and deploy/server checks as NOT RUN (`docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:81`-`89`). Recommendation: run one of these gates per new session when prerequisites are present; do not substitute local dry-runs. Target part: remaining acceptance gates.
4. Severity: High. Evidence: `.github/workflows/ci.yml:1` says CI is staged because this repo is not yet a git repo or remote; local docs also state the folder is still NOT GIT-BACKED so GitHub CI is unavailable (`docs/STATUS.md:13`). Recommendation: production readiness needs a real git-backed branch/PR and a green GitHub Actions run, not only local gates. Target part: CI/deployment readiness.
5. Severity: Medium. Evidence: root scripts expose guarded acceptance commands for LMS DB, managed real-PG, audit-role, LMS object storage/scanner, Stripe, Axioma, and visual evidence (`package.json:28`-`38`), while `ci:local` omits the credential/live gates (`package.json:41`). Recommendation: treat those scripts as operator-invoked acceptance gates, not automatic local or CI coverage. Target part: gate orchestration.
6. Severity: Medium. Evidence: default Playwright is deterministic and isolated to port 3100 with `reuseExistingServer:false` (`playwright.config.ts:15`-`29`), while LMS DB Playwright requires `LMS_DB_E2E=1`, `LMS_E2E_DATABASE_URL`, a `wtc_test*` database, and a prep marker (`playwright.lms-db.config.ts:14`-`24`). Recommendation: do not count default e2e as LMS DB browser acceptance. Target part: browser acceptance coverage.
7. Severity: Medium. Evidence: live/provider preflights are intentionally guarded: object storage requires live acceptance and throwaway flags (`scripts/lms-s3-r2-live-preflight.mjs:68`-`72`), scanner requires live and quarantine-corpus flags (`scripts/lms-external-scanner-live-preflight.mjs:65`-`69`), Stripe checkout refuses production/live-key environments (`scripts/billing-stripe-checkout-preflight.mjs:77`-`78`), and Axioma refuses production or configured live material during the no-network preflight (`scripts/axioma-handoff-preflight.mjs:120`-`122`). Recommendation: keep dry-run/preflight coverage separate from live acceptance. Target part: provider gate safety.
8. Severity: Medium. Evidence: local preflight tests assert opt-in/no-network behavior and retained-evidence scans for Stripe, Axioma, object storage, and scanner (`tests/integration/billing-stripe-webhook-replay-preflight.test.ts:47`-`88`, `tests/integration/billing-stripe-checkout-preflight.test.ts:47`-`88`, `tests/integration/axioma-handoff-preflight.test.ts:54`-`96`, `tests/integration/lms-object-storage-live-preflight.test.ts:57`-`101`, `tests/integration/lms-external-scanner-live-preflight.test.ts:55`-`100`). Recommendation: accept this as static/local harness coverage only; live provider observations still need credentials and retained clean evidence. Target part: acceptance coverage quality.
9. Severity: Medium. Evidence: screenshot inventory passed in Phase 3.62, but the same handoff labels it inventory-only (`docs/handoffs/20260602-1856-phase-3-62-local-site-readiness.md:79`), and the matrix states screenshots need a visual review manifest for retained evidence (`docs/ACCEPTANCE_MATRIX_MASTER.md:34`-`35`). Recommendation: require reviewed visual manifests for any retained production evidence. Target part: visual evidence acceptance.
10. Severity: Low. Evidence: `docs/PRODUCTION_BLOCKERS_CURRENT.md:8` still carries older raw-IP preview B1 wording with an `11/11` real-PG claim, while the current blocker packet says Phase 3.60 local managed real-PG proof was `14 passed` and does not replace remaining live/production gates (`docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:79`, `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:101`-`104`). Recommendation: reconcile wording before final production signoff so the current blocker packet remains the unambiguous source of truth. Target part: docs truth.

## Decisions
- Did not run lint, typecheck, Vitest, Playwright, coverage, preview, DB, live/provider, CI, deploy, SSH, nginx, systemd, or bot commands because the Phase 3.63 prompt limited this lane to static/read-only inspection.
- Did not update `docs/STATUS.md`, even though the generic tests-runner agent definition mentions it, because the operator instruction allowed exactly one file write: this handoff.
- Treated `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md` as the current Phase 3.62+ blocker packet, with `docs/ACCEPTANCE_MATRIX_MASTER.md` as the production-readiness definition.
- No background agents were spawned from this tests-runner lane; none were left running.

## Risks
- Current acceptance proof is partly historical, not freshly rerun in this Phase 3.63 tests-runner audit.
- The workspace is not git-backed, so no branch, commit, PR, or GitHub Actions evidence can be claimed from this folder.
- Dry-run preflight coverage reduces harness risk but does not prove real Stripe, Axioma, S3/R2, malware-scanner, or server behavior.
- Local demo/mock preview and visual inventory can be mistaken for production readiness unless blocker docs stay explicit.
- Documentation drift in `docs/PRODUCTION_BLOCKERS_CURRENT.md` could confuse final readiness signoff if it is not reconciled with the current credential blocker packet.

## Verification/tests
RUN in this Phase 3.63 audit:
- Static file/config inspection with `Get-Content`, `rg`, `Get-ChildItem`, and `Test-Path` - PASS.
- `git status --short` - observed NOT GIT-BACKED (`fatal: not a git repository`).
- Target handoff pre-existence check - PASS; `docs/handoffs/20260602-1918-ecosystem-tests-runner.md` did not exist before this write.

Previously observed RUN/PASS evidence, not rerun here:
- Phase 3.59 LMS DB browser managed acceptance - RUN/PASS per `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:78`.
- Phase 3.60 active managed real-PG proof - RUN/PASS per `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:79`.
- Phase 3.61 local managed append-only audit DB-role proof - RUN/PASS per `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:80`.
- Phase 3.62 local site-readiness - RUN/PASS for root tests, web build, default e2e, local preview smoke, core smoke, DB generate, and visual inventory per `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:86`.

NOT RUN in this Phase 3.63 audit:
- `npm run governance:check`, `npm run check:core`, `npm run lint`, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run secret:scan`, `npm test`, `npm run coverage`, `npm run db:generate -w @wtc/db`, `npm run build -w @wtc/web`, `npm run e2e`, and `node scripts/gates.mjs full` - not run by operator scope.
- `npm run e2e:lms:db:managed`, `npm run accept:real-pg:managed`, and `npm run accept:audit:append-only-role:managed` - not rerun because current docs mark them previously cleared locally and this audit was static.
- `npm run accept:audit:append-only-role` against the intended production/preview restricted role - NOT RUN; intended restricted role URL/consent absent.
- `npm run accept:lms:object-storage -- --live` - NOT RUN; live S3/R2 throwaway credentials and consent absent.
- `npm run accept:lms:external-scanner -- --live` - NOT RUN; live scanner endpoint/token and quarantine-corpus consent absent.
- Real Stripe test checkout and Stripe CLI/Dashboard webhook replay - NOT RUN; provider decision/test keys/webhook secret/price map and replay setup absent.
- Axioma live bridge, endpoint-shape, account-link, download, and enabled CTA acceptance - NOT RUN; endpoint confirmation, ES256 key/kid, and bridge token absent.
- Live/server preview smoke, preview/prod DB rollout, SSH/nginx/systemd checks, deploy, production monitoring, bot services/control, and GitHub CI - NOT RUN; outside scope and/or missing approved targets, credentials, git remote, and operator approval.

## Next actions
1. Reconcile blocker docs before final readiness signoff: make `docs/PRODUCTION_BLOCKERS_CURRENT.md` match the current Phase 3.62+ credential blocker packet and remove ambiguous old B1/server wording.
2. Establish a git-backed repo and remote, then run a real GitHub Actions CI pass; local `ci:local` and staged `.github/workflows/ci.yml` are not CI evidence.
3. Run the direct intended production/preview audit-role proof: `npm run accept:audit:append-only-role` with `AUDIT_APPEND_ONLY_DATABASE_URL`, `AUDIT_APPEND_ONLY_EXPECTED_ROLE`, and `AUDIT_APPEND_ONLY_PREFLIGHT_ACCEPT=1`; use non-throwaway approval only if the operator explicitly approves the intended target.
4. Run approved live/server preview smoke and production/preview DB rollout checks, including server target, rollback plan, SSH/nginx/systemd evidence, and production nginx/shared-store auth-rate-limit proof.
5. Run LMS live storage gates in separate sessions: `npm run accept:lms:object-storage -- --live`, then `npm run accept:lms:external-scanner -- --live`, each with throwaway targets, consent flags, redacted summaries, artifact scans, and reviewed screenshots only if retained.
6. Run Stripe test-mode acceptance: real Checkout Session creation plus Stripe CLI/Dashboard webhook replay using `sk_test`, `whsec`, and `price_` values; retain only redacted scanner-clean evidence.
7. Run Axioma live acceptance: confirm endpoint shapes, provision ES256 key/kid, run handoff/JWKS/JTI/account-link/download checks, and only then enable any browser CTAs.
8. Re-run the final local gate stack after any code/config changes and before release signoff: governance, check:core, lint, typechecks, secret scan, Vitest, coverage, DB generate, web build, default e2e, retained evidence scans, and visual review manifests where applicable.
9. Complete deploy/server checks and production monitoring only after the provider/DB/CI gates above are green; keep bot control disabled unless separately audited.
