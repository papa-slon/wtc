# Phase 3.63 production-readiness gap closure handoff
## Scope
Phase 3.63 responded to the production-readiness order by first dispatching the required read-only audit agents, then closing local production-readiness gaps that were actionable without server/provider credentials. This phase did not deploy, mutate a live server, start/stop bot services, run SSH/nginx/systemd commands, or call live providers.

The phase improved production-like env fences, CI env material generation, real-form auth browser coverage, DB-backed auth browser acceptance against a throwaway Postgres database, and Playwright port resilience on the current Windows host.

Per-agent handoffs created before edits:
- `docs/handoffs/20260602-1918-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-1918-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260602-1918-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-1918-ecosystem-backend-implementer.md`
- `docs/handoffs/20260602-1918-ecosystem-frontend-implementer.md`
- `docs/handoffs/20260602-1918-ecosystem-tests-runner.md`

All six background agents were closed before this aggregate report.

## Files inspected
`AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, Phase 3.62 status/handoff docs, the six Phase 3.63 per-agent handoffs, root and web package scripts, Playwright configs, CI workflow, config env loader/tests, billing/Axioma/LMS preflight scripts, auth routes/actions, DB migrations, generated evidence logs, and current TCP/process state.

Existing bot Postgres settings were read from `C:\Users\maxib\GTE BOT\bot\.env` only inside the PowerShell process to build the managed auth DB acceptance URL. Credential values were not printed or persisted.

## Files changed
- `.github/workflows/ci.yml` - CI now generates production-like Stripe test env values and ES256 Axioma signing material, then validates config loading under `APP_ENV=staging` / `NODE_ENV=production`.
- `.gitignore` - ignores generated auth e2e Next outputs.
- `eslint.config.js` - ignores generated `.next-e2e-auth` and `.next-e2e-auth-db` outputs.
- `apps/web/package.json` - moves dedicated e2e helper ports out of the Windows-excluded `3100-3103` range.
- `package.json` - adds auth production-profile and auth DB-backed e2e scripts.
- `packages/config/src/env.ts` - requires Stripe secret/webhook/price-map config when `BILLING_PROVIDER=stripe` in production-like environments.
- `packages/config/src/env.test.ts` - covers the new Stripe production-like requirements.
- `playwright.config.ts` - moves default e2e to env-overridable port `3410` and excludes opt-in auth/LMS DB browser specs from the default demo e2e gate.
- `playwright.auth.config.ts` - adds the real-form auth production profile on env-overridable port `3412`.
- `playwright.auth-db.config.ts` - adds guarded DB-backed auth browser acceptance on env-overridable port `3413`.
- `playwright.lms-db.config.ts` - moves the LMS DB browser harness to env-overridable port `3411`.
- `scripts/prepare-auth-db-e2e.ts` - prepares a fresh guarded `wtc_test_auth_*` DB with migrations and seed for auth browser acceptance.
- `scripts/run-auth-db-e2e.mjs` - guarded child runner for DB-backed auth browser acceptance.
- `scripts/run-auth-db-e2e-managed.mjs` - managed runner that creates/drops a throwaway auth DB from an admin maintenance URL.
- `tests/e2e/auth-production-profile.spec.ts` - proves real register/login forms work without `/api/e2e/login`.
- `tests/integration/auth-db-e2e-harness.test.ts` - static/safety coverage for the auth DB browser harness.
- `tests/integration/ci-production-env.test.ts` - static CI workflow coverage for production-like env material and removal of obsolete Axioma signing-secret usage.
- `tests/integration/lms-db-e2e-harness.test.ts` - updated to assert the new LMS DB e2e port/config guard.
- This aggregate handoff plus status/blocker/next-action docs for Phase 3.63.

## Findings
1. Severity: High. Local production-readiness coverage improved, but WTC is still not production-ready. The following are still NOT RUN: direct intended production/preview append-only audit role proof, live LMS object-store/scanner acceptance, real Stripe test checkout/webhook replay, Axioma live endpoint/account-link/download acceptance, GitHub CI, approved server deploy/SSH/nginx/systemd checks, preview/prod DB rollout, production monitoring, and live bot integration/control.
2. Severity: High. The repo root is still not git-backed. `git status --short` / `git rev-parse --show-toplevel` fail with `fatal: not a git repository`, so no branch, commit, PR, or GitHub Actions run can be claimed.
3. Severity: High. Auth registration/login browser acceptance is now stronger locally: real forms pass without e2e auth bypass in both in-memory dev mode and DB-backed throwaway Postgres mode.
4. Severity: Medium. Windows currently reserves TCP ports `3001-3400`, so the old Playwright ports `3100-3103` are unusable (`EACCES`). The e2e configs now default to `3410-3413` and can be overridden with env vars.
5. Severity: Medium. CI env generation previously drifted from production-like config: it generated obsolete Axioma secret material and did not prove Stripe env requirements. The staged workflow now validates the expected ES256 and Stripe config shape locally, but it is still not a real CI run until the repo is git-backed and pushed.
6. Severity: Medium. Dry-run provider preflights for Stripe, Axioma, LMS object storage, and LMS scanner pass locally and retain scanner-clean summaries, but they are no-network dry-runs only.

## Decisions
- Used the existing local bot Postgres source exactly as the operator requested, but only through managed throwaway databases and without printing secrets.
- Kept default `npm run e2e` as demo/mock browser smoke and excluded opt-in DB/auth production-profile specs from that default gate.
- Did not run any live provider, server, deploy, SSH, nginx, systemd, production DB migration, or bot-control command because the required target credentials/approval were unavailable and the session protocol forbids uncontrolled live mutation.
- Treated all previous and current local gates as local evidence only, not production acceptance.

## Risks
- Production readiness can still be overstated if local throwaway DB proof, dry-run provider proof, or local preview is treated as live acceptance.
- GitHub CI and deployment remain structurally blocked while this folder is not a git repository.
- Axioma and Stripe CTAs must remain disabled/fail-closed until live provider gates pass.
- LMS public uploads must remain disabled until live object-store and scanner gates pass.
- Live bot control/start/stop/apply-config remains forbidden until bot integration and security gates pass on the intended adapters.

## Verification/tests
RUN/PASS in Phase 3.63:
- Six read-only agents dispatched before edits; six per-agent handoffs exist and are cited above; all agents closed.
- Env presence check: production credential variables for audit DB, LMS object-store/scanner, Stripe, Axioma, app DB/session/vault were not set in the current shell.
- `npm run accept:billing:stripe-webhook -- --dry-run` - PASS; retained summary `logs/billing-stripe-webhook-preflight/summary-27d5a2cbeef19e70.json`.
- `npm run accept:billing:stripe-checkout -- --dry-run` - PASS; retained summary `logs/billing-stripe-checkout-preflight/summary-d972d4842018f69b.json`.
- `npm run accept:axioma:handoff-preflight -- --dry-run` - PASS; retained summary `logs/axioma-handoff-preflight/summary-5e6d2a4e87fa7bd1.json`.
- LMS S3/R2 dry-run preflight with generated in-process fake env - PASS; retained summary `logs/lms-s3-r2-preflight/summary-83e6edd2b17396af.json`.
- LMS external scanner dry-run preflight with generated in-process fake env - PASS; retained summary `logs/lms-external-scanner-preflight/summary-caae65a36434663e.json`.
- `node scripts\scan-lms-db-e2e-artifacts.mjs logs\billing-stripe-webhook-preflight logs\billing-stripe-checkout-preflight logs\axioma-handoff-preflight logs\lms-s3-r2-preflight logs\lms-external-scanner-preflight` - PASS; 5 text files, 0 images, 0 blocked containers, 0 missing roots.
- Focused CI/config/auth harness Vitest - PASS; final focused harness run: `62` passed across auth DB, LMS DB, CI env, and config env tests.
- `npm test` - PASS; `105` files, `934` passed, `10` skipped.
- `npm run build -w @wtc/web` - PASS; Next `15.5.18`, 35 static pages.
- `npm run check:core` - PASS.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run lint` - PASS after generated auth e2e outputs were ignored.
- `npm run secret:scan` - PASS after preflight logs and DB-backed auth acceptance.
- `npm run e2e:auth:production-profile` - PASS; `2` passed on real register/login forms without e2e auth bypass.
- `npm run e2e` - PASS after excluding opt-in specs; `44` passed, `6` skipped on port `3410`.
- `npm run e2e:auth:db:managed` using the existing bot Postgres source in-process - PASS; created `wtc_test_auth_20260602130742_099899`, applied 17 migrations plus seed, ran DB-backed real-form auth Playwright (`2` passed), cleaned marker, and dropped the throwaway DB.
- Teardown check - no listener remained on ports `3410`, `3412`, or `3413`; port `3000` remains the existing local preview listener and was not touched.

Observed but not counted green:
- First default e2e rerun attempt timed out at the outer tool limit; no PASS claim was made from that attempt.
- A default e2e run before excluding the opt-in auth spec produced `44` passed, `8` skipped, and `2` expected-routing failures because the production-profile auth spec was incorrectly included under `E2E_AUTH_BYPASS=1`. The routing/config bug was fixed and the final run passed.
- Initial Playwright attempts on old ports `3100`/`3102` failed with Windows `EACCES` because the current host reserves `3001-3400`.

NOT RUN in Phase 3.63:
- `npm run coverage`.
- Direct intended production/preview append-only audit role proof: `npm run accept:audit:append-only-role`.
- Live LMS object-store preflight: `npm run accept:lms:object-storage -- --live`.
- Live LMS external scanner preflight: `npm run accept:lms:external-scanner -- --live`.
- Real Stripe test checkout and Stripe CLI/Dashboard webhook replay.
- Axioma live bridge, endpoint-shape, account-link, download, and enabled CTA acceptance.
- Preview/prod DB migration/seed rollout, restricted target-role proof, and production smoke.
- SSH, nginx, systemd, deploy, domain/TLS, server monitoring, production worker service, live bot services/control, and exchange integration.
- GitHub Actions CI, because the current folder is not git-backed.

## Next actions
1. Make the workspace git-backed and run a real GitHub Actions CI pass on a pushed branch/PR.
2. Run the direct intended append-only audit role proof against the real preview/prod restricted role.
3. Run live LMS object-store and scanner preflights with approved throwaway targets and consent flags.
4. Run Stripe test-mode checkout plus real webhook replay with approved test credentials.
5. Run Axioma live endpoint/account-link/download acceptance after endpoint shapes and ES256 key/kid are confirmed.
6. Prepare an approved deploy runbook for preview/prod DB backup, migration/seed, restricted role proof, web/worker process management, nginx/TLS, smoke checks, monitoring, and rollback.
