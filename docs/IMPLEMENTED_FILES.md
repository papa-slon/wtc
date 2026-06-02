# Implemented files (current code vs. target contracts)

## 2026-06-03 Phase 3.65 additions (Tortila DB-backed read-only canary)
- `apps/web/src/features/bots/data.tsx` - production Tortila reads are DB-first: health, metric snapshots, position snapshots,
  closed-trade imports, equity curve reconstruction, and persistent Tortila warnings come from WTC DB instead of direct
  journal fetches from user page renders.
- `apps/web/src/features/bots/journal.ts` - Postgres journal mode is DB-only and no longer falls back to the live adapter
  when imports are empty.
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` - runtime config read unavailability no longer creates a false top-level
  adapter-unavailable banner for the DB-backed canary.
- `apps/web/src/lib/product-status.ts`, `apps/web/src/app/(public)/products/page.tsx`,
  `apps/web/src/app/(public)/products/[slug]/page.tsx`, `apps/web/src/features/cabinet/loader.ts`, and
  `apps/web/src/features/admin/queries.ts` - Tortila availability now reflects the live read-only monitoring canary when
  adapter mode is non-mock.
- `tests/integration/bot-read-safety-static.test.ts` and `tests/integration/admin-responsive.test.ts` - static/integration
  coverage for the production Tortila DB-backed path and availability helper.
- `docs/handoffs/20260603-0052-ecosystem-bot-integration-auditor.md`,
  `docs/handoffs/20260603-0053-ecosystem-security-auditor.md`,
  `docs/handoffs/20260603-0056-ecosystem-tests-runner.md`, and
  `docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md` - three per-agent handoffs plus aggregate Phase
  3.65 handoff.
- Verified: local `npm run ci:local` PASS; root `npm test` PASS (`105` files, `936` passed, `10` skipped);
  `npm run build -w @wtc/web` PASS; `npm run secret:scan` PASS; GitHub Actions CI PASS for commit `4487b3d`; server release
  `20260602-1816-4487b3d` built/deployed; managed worker `wtc-ecosystem-worker` wrote Tortila health/snapshot/import rows;
  browser checks passed for public Tortila, authenticated Tortila bot pages, statistics, admin bots, and admin system-health.
  NOT RUN / NOT GREEN: provider-side journal bearer-auth proof, live bot control, Legacy non-mock, Stripe, Axioma live,
  live LMS object-store/scanner, branded-domain DNS/TLS, production burn-in/alerting, and direct intended append-only
  audit-role proof.

## 2026-06-02 Phase 3.63 additions (production-readiness gap closure)
- `.github/workflows/ci.yml` - staged CI now generates production-like Stripe test env and ES256 Axioma key/kid material and
  validates config loading under staging/production-like env. This is still not GitHub CI evidence until the repo is
  git-backed and pushed.
- `packages/config/src/env.ts` and `packages/config/src/env.test.ts` - production-like Stripe config now requires
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_MAP` when `BILLING_PROVIDER=stripe`.
- `playwright.config.ts`, `playwright.auth.config.ts`, `playwright.auth-db.config.ts`, `playwright.lms-db.config.ts`, and
  `apps/web/package.json` - Playwright ports moved from the Windows-reserved `3100-3103` range to env-overridable
  `3410-3413`; default e2e excludes opt-in auth/LMS DB specs.
- `scripts/prepare-auth-db-e2e.ts`, `scripts/run-auth-db-e2e.mjs`, `scripts/run-auth-db-e2e-managed.mjs`,
  `tests/e2e/auth-production-profile.spec.ts`, and `tests/integration/auth-db-e2e-harness.test.ts` - add guarded real-form
  auth browser acceptance without `/api/e2e/login`, including a managed throwaway Postgres path.
- `tests/integration/ci-production-env.test.ts` and `tests/integration/lms-db-e2e-harness.test.ts` - static guards for CI
  production-like env generation and e2e port/config boundaries.
- `.gitignore` and `eslint.config.js` - ignore generated auth e2e Next outputs.
- `docs/handoffs/20260602-1918-*.md` and
  `docs/handoffs/20260602-2009-phase-3-63-production-readiness-gap-closure.md` - six per-agent read-only handoffs plus the
  aggregate Phase 3.63 handoff.
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_63_20260602.md` - durable prompt for the next external/live production gate.
- Verified: no-network Stripe webhook/checkout, Axioma, LMS object-store, and LMS scanner dry-runs PASS with retained evidence
  scan PASS; root `npm test` PASS (`105` files, `934` passed, `10` skipped); `npm run build -w @wtc/web` PASS;
  `npm run check:core` PASS; root/web typecheck PASS; lint PASS; `npm run secret:scan` PASS; default `npm run e2e` PASS
  (`44` passed, `6` skipped); `npm run e2e:auth:production-profile` PASS (`2` passed); managed auth DB e2e PASS against a
  throwaway DB `wtc_test_auth_20260602130742_099899` created from the existing-bot Postgres source and dropped after
  Playwright (`2` passed). NOT RUN: production/preview intended audit-role proof, live object-store/scanner, real Stripe,
  Axioma live acceptance, GitHub CI, deploy/server checks, production monitoring, live bot services/control, and coverage.

## 2026-06-02 Phase 3.62 additions (local site-readiness)
- No product code changed in this phase.
- `docs/handoffs/20260602-1842-ecosystem-tests-runner.md`,
  `docs/handoffs/20260602-1842-ecosystem-frontend-implementer.md`,
  `docs/handoffs/20260602-1842-ecosystem-devops-implementer.md`, and
  `docs/handoffs/20260602-1856-phase-3-62-local-site-readiness.md` - three read-only per-agent handoffs plus aggregate
  Phase 3.62 handoff.
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_62_20260602.md` - durable copy-paste prompt for continuing into the next
  credentialed/live gate without reconstructing Phase 3.62 from chat.
- `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`,
  `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, and this file - record that local
  site-readiness is now RUN/PASS while production/live gates remain NOT RUN.
- Verified: root `npm test` PASS (`103` files, `921` passed, `10` skipped), `npm run build -w @wtc/web` PASS,
  default `npm run e2e` PASS on rerun (`44` passed, `8` skipped), `http://127.0.0.1:3000` local preview HTTP smoke PASS
  (`200`, title contains `WTC Ecosystem` and `World Trader Club`), `npm run check:core` PASS, `npm run db:generate -w @wtc/db` PASS
  (`43` tables, no schema changes), and visual inventory PASS inventory-only (`69` images, `0` blocked containers).
  NOT RUN: production/preview intended audit-role proof, live object-store/scanner, Stripe, Axioma, server/deploy checks,
  GitHub CI, production monitoring, coverage, and screenshot acceptance beyond inventory.

## 2026-06-02 Phase 3.61 additions (audit append-only managed acceptance)
- `scripts/run-audit-append-only-role-managed.mjs` - creates a fresh `wtc_test_audit_*` database, applies repo migrations,
  creates a temporary restricted `wtc_app_role_*`, grants only `SELECT`/`INSERT` on `public.audit_logs`, delegates to the
  existing direct audit-role preflight through the redacted child-process helper, and drops both generated resources.
- `package.json` - adds `npm run accept:audit:append-only-role:managed`.
- `tests/integration/audit-append-only-role-managed-runner-safety.test.ts` - covers script registration, default-gate
  exclusion, safe help, unknown-arg refusal, missing/invalid/throwaway admin URL refusal without leaking full URLs, and static
  guards for generated SQL quoting, grant shape, delegation, and cleanup commands.
- `docs/handoffs/20260602-1830-ecosystem-security-auditor.md`,
  `docs/handoffs/20260602-1829-ecosystem-tests-runner.md`,
  `docs/handoffs/20260602-1831-ecosystem-devops-implementer.md`, and
  `docs/handoffs/20260602-1834-phase-3-61-audit-append-only-managed-acceptance.md` - three per-agent read-only handoffs
  plus aggregate Phase 3.61 handoff.
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_61_20260602.md` - durable copy-paste prompt for the next required new session.
- `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`,
  `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, and this file - record that local generated-role
  audit append-only proof is now RUN/PASS while production/preview intended-role proof and provider/server gates remain NOT RUN.
- Verified: first `npm run accept:audit:append-only-role:managed` created/dropped `wtc_test_audit_20260602113036_6c10be`
  but failed before preflight on PostgreSQL utility placeholder syntax. Final managed run PASS created
  `wtc_test_audit_20260602113142_0aa15f`, applied `17` migrations, created `wtc_app_role_20260602113142_97bf21`, proved
  `select=true insert=true update=false delete=false truncate=false probe=inserted`, and dropped both generated resources.
  Focused audit runner Vitest PASS (`16` passed), root `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS,
  `npm run lint` PASS, and `npm run secret:scan` PASS.
  NOT RUN: direct production/preview intended-role proof, root `npm test`, web build, live object-store/scanner, Stripe,
  Axioma, preview/live smoke, SSH/nginx/systemd, GitHub CI, deploy, and production monitoring.

## 2026-06-02 Phase 3.60 additions (existing-bot real-PG managed acceptance)
- `tests/integration/db-real-postgres.test.ts` - accepts either a valid `Date` or parseable timestamp string for raw
  `postgres-js` `account_locked_until` query output, fixing the active real-PG lockout race assertion discovered by the
  first managed run.
- `docs/handoffs/20260602-1757-ecosystem-security-auditor.md`,
  `docs/handoffs/20260602-1757-ecosystem-tests-runner.md`,
  `docs/handoffs/20260602-1758-ecosystem-devops-implementer.md`, and
  `docs/handoffs/20260602-1802-phase-3-60-existing-bot-real-pg-managed-acceptance.md` - three per-agent read-only handoffs
  plus aggregate Phase 3.60 handoff.
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_60_20260602.md` - durable copy-paste prompt for the next required new session.
- `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`,
  `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, and this file - record that active managed
  real-PG proof is now RUN/PASS while other credentialed/live gates remain NOT RUN.
- Verified: existing-bot Postgres source was used without printing values. First `npm run accept:real-pg:managed` created
  and dropped `wtc_test_realpg20260602105728361315` but failed on the raw timestamp type assertion (`13` passed, `1`
  failed). Final `npm run accept:real-pg:managed` PASS created and dropped `wtc_test_realpg20260602105824d18bef` and ran
  active real-PG tests (`14` passed). Focused safety/helper Vitest PASS (`13` passed, `9` skipped inactive DB block), root
  `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS, `npm run secret:scan` PASS, and
  `npm run governance:check` PASS.
  NOT RUN: root `npm test`, web build, append-only audit DB-role proof, live object-store/scanner, Stripe, Axioma,
  preview/live smoke, SSH/nginx/systemd, GitHub CI, deploy, and production monitoring.

## 2026-06-02 Phase 3.59 additions (existing-bot LMS DB browser acceptance)
- `scripts/redacted-child-process.mjs` - on Windows, `.cmd`/`.bat` child shims now run through `cmd.exe /d /s /c` inside
  the redacted child-process helper, fixing `spawnSync npm.cmd EINVAL` while preserving redacted stdout/stderr handling.
- `tests/integration/child-output-redaction.test.ts` - adds a Windows-only `npm.cmd --version` regression through the
  redacted helper.
- `packages/lms/src/index.ts` and `packages/tradingview-access/src/index.ts` - replace TypeScript constructor parameter
  properties with explicit private fields so Node 24 strip-only imports do not fail.
- `tests/e2e/lms-db-materials.spec.ts` - fixes strict lesson-title selection, avoids false leak failures from Next dev
  `page.content()` source/RSC payload by checking visible text for UI leaks, and returns to the actual lesson URL before
  capturing the retained mobile screenshot after auth session switches.
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx` - stacks embed materials below their title/action
  row and constrains iframes to the card width, fixing the mobile horizontal-scroll failure discovered by the corrected
  LMS DB screenshot.
- `eslint.config.js` - ignores generated `.next-e2e-db` output so root lint checks source files instead of Next e2e build
  artifacts.
- `logs/retained-visual-artifacts/20260602-1713-lms-db/visual-review.json` - manual review manifest for the retained
  mobile LMS lesson screenshot.
- `docs/handoffs/20260602-1714-*.md` - three per-agent read-only handoffs plus aggregate Phase 3.59 handoff.
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_59_20260602.md` - durable copy-paste prompt for the next required new session.
- `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`,
  `docs/PRODUCTION_BLOCKERS_CURRENT.md`, and this file - record that LMS DB browser managed acceptance is now RUN/PASS while
  other credentialed/live gates remain NOT RUN.
- Verified: existing-bot Postgres source was checked without printing values; final `npm run e2e:lms:db:managed` PASS
  created `wtc_test_lms_20260602101117_cc7889`, applied 17 migrations plus seed data, ran LMS DB Playwright desktop/mobile
  (`2` passed), ran LMS DB artifact scanner PASS, and dropped the throwaway DB. Retained visual gate PASS for
  `tests/e2e/screenshots/lms-db-material-lesson-lms-db-mobile.png`. Focused Vitest PASS (`29` passed, then `21` passed),
  `npm run typecheck -w @wtc/web` PASS, root `npm run typecheck` PASS, `npm run lint` PASS, `npm run secret:scan` PASS,
  `npm run governance:check` PASS, and strip-only import smoke PASS.
  NOT RUN: root `npm test`, web build, active real-PG managed proof, append-only audit DB-role proof, live
  object-store/scanner, Stripe, Axioma, preview/live smoke, SSH/nginx/systemd, GitHub CI, deploy, and production monitoring.

## 2026-06-02 Phase 3.58 additions (credentialed acceptance blocker packet - docs only, no live acceptance)
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md` - durable operator-facing packet listing each blocked credential/live gate,
  exact command, required env/consent names, current `NOT_SET` evidence from the shell, and evidence required to clear. It
  covers LMS DB browser, active real-Postgres, append-only audit DB role, LMS object storage, LMS external scanner, Stripe,
  Axioma, preview/live smoke, GitHub CI, and deploy/server checks.
- `docs/handoffs/20260602-1626-*.md` - four per-agent read-only handoffs plus aggregate Phase 3.58 handoff.
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_58_20260602.md` - durable copy-paste prompt for the next required new session after
  Phase 3.58.
- `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`,
  `docs/ACCEPTANCE_MATRIX_MASTER.md`, and this file - link the blocker packet and preserve the standing truth that
  credentialed/live acceptance remains NOT RUN until operator credentials and consent are supplied.
- Verified: required docs/protocol reads PASS, values-hidden env presence check PASS as blocker evidence, current root
  still NOT GIT-BACKED, `npm run secret:scan` PASS, and `npm run governance:check` PASS.
  No product code, package scripts, migrations, route handlers, adapters, preview, Playwright/e2e, live acceptance, SSH,
  nginx, systemd, database mutation, provider call, GitHub CI, deploy, or production monitoring was performed.

## 2026-06-02 Phase 3.57 additions (symlink-hard preflight root confinement - no live acceptance, no DB mutation)
- `scripts/workspace-path-guard.mjs` and `scripts/workspace-path-guard.d.mts` - add script-local path confinement helpers:
  real workspace root anchoring, segment-by-segment `lstat`, symlink/junction/reparse-point rejection, post-create
  realpath validation, plain workspace file/root assertions, and exclusive plain workspace file creation.
- `scripts/preflight-log-root.mjs` - keeps the relative repo-local `logs/...` policy, but now rejects linked existing
  components during log-root resolution and summary writes. Preflight summaries are created through the verified real root and
  refuse overwriting an existing `summary-<runId>.json`.
- `scripts/gates.mjs` - verifies the fixed `logs/gates` retained-log root through the workspace path guard before writing
  per-gate logs and `summary.txt`.
- `scripts/scan-lms-db-e2e-artifacts.mjs` - refuses linked explicit artifact roots, nested linked descendants, and linked
  dynamic marker manifests. Explicit file artifacts remain supported so raw `dev-server.log` / `preview-safe*.log` paths can
  still be scanned and refused as archive evidence. Failure labels are redacted when path labels are secret-shaped.
- `scripts/check-retained-visual-artifacts.mjs` - refuses linked artifact roots, nested linked descendants, linked dynamic
  marker manifests, linked visual review manifests, linked manifest artifact paths, and linked OCR sidecars before inventory,
  manifest validation, or sidecar reads.
- `tests/integration/preflight-log-root.test.ts` and `tests/integration/preflight-log-root-wiring.test.ts` - add workspace-local
  directory link/junction regression coverage for root helper and process-level preflight refusal, plus exclusive summary
  no-overwrite coverage.
- `tests/integration/lms-db-e2e-artifact-scan.test.ts` and `tests/integration/retained-visual-artifacts.test.ts` - add linked
  root, nested linked descendant, linked dynamic marker manifest, linked visual manifest, and linked OCR sidecar refusal
  coverage.
- `docs/handoffs/20260602-1557-*.md` - four per-agent read-only handoffs plus aggregate Phase 3.57 handoff.
- `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/DEPLOYMENT.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `.env.example`,
  and this file - record the physical realpath/no-link evidence-root rule while keeping live acceptance gates NOT RUN.
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_57_20260602.md` - durable copy-paste prompt for the next required new session after
  Phase 3.57.
- Verified: syntax checks PASS for `scripts/workspace-path-guard.mjs`, `scripts/preflight-log-root.mjs`,
  `scripts/scan-lms-db-e2e-artifacts.mjs`, `scripts/check-retained-visual-artifacts.mjs`, and `scripts/gates.mjs`; focused
  Vitest PASS (`61` passed); `npm run secret:scan` PASS; `npm run typecheck` PASS; `node scripts/gates.mjs full` PASS
  (9/9); `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates` PASS; `npm run evidence:visual -- --inventory
  tests/e2e/screenshots` PASS inventory only (`68` image files; not acceptance); and final `npm run governance:check` PASS.
  No `npm run preview:safe`, Playwright/e2e, live acceptance, SSH, nginx, systemd, database mutation, provider call,
  CI execution, preview/prod rollout, or production monitoring was performed.

## 2026-06-02 Phase 3.56 additions (safe-preview retained output policy - no live preview run)
- `scripts/safe-preview.mjs` - replaces raw inherited stdout/stderr with piped redacted stream forwarding while preserving
  direct Next CLI execution, `shell:false`, `--hostname 0.0.0.0`, `--port 3000`, and forced development/mock/no-live flags.
  The stream forwarder buffers incomplete lines and private-key blocks before redaction so split chunks do not leak retained
  output.
- `scripts/safe-preview.d.mts` - exposes the script-local safe-preview helpers to TypeScript tests without implicit `any`.
- `scripts/scan-lms-db-e2e-artifacts.mjs` - refuses raw `dev-server.log` and `preview-safe*.log` paths as retained archive
  evidence. These files may exist as local diagnostics, but scanner-clean or ignore status does not make them archive-safe.
- `tests/integration/safe-preview-retained-output.test.ts` - covers safe-preview stream redaction, split-token buffering, and
  static safe wrapper shape without starting Next.
- `tests/integration/child-output-redaction.test.ts`, `tests/integration/db-seed-preview-hardening.test.ts`, and
  `tests/integration/lms-db-e2e-artifact-scan.test.ts` - add wiring/static guards and raw preview/dev-server log refusal
  coverage.
- `docs/handoffs/20260602-1531-*.md` - four per-agent read-only handoffs plus aggregate Phase 3.56 handoff.
- `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/DEPLOYMENT.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`,
  `docs/PRODUCTION_BLOCKERS_CURRENT.md`, and this file - record that safe-preview output is now redacted before forwarding
  but live preview/Playwright/acceptance remain NOT RUN.
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_56_20260602.md` - durable copy-paste prompt for the next required new session after
  Phase 3.56.
- Verified: syntax checks PASS for `scripts/safe-preview.mjs` and `scripts/scan-lms-db-e2e-artifacts.mjs`, focused Vitest
  PASS (`32` passed), raw preview-log retained-evidence refusal PASS, `npm run secret:scan` PASS, `npm run typecheck` PASS,
  `node scripts/gates.mjs full` PASS (9/9), `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates` PASS, and final
  `npm run governance:check` PASS. No `npm run preview:safe`, Playwright/e2e, live acceptance, SSH, nginx, systemd,
  database mutation, provider call, CI execution, preview/prod rollout, or production monitoring was performed.

## 2026-06-02 Phase 3.55 additions (retained visual artifact policy - no live acceptance, no OCR run)
- `scripts/check-retained-visual-artifacts.mjs` - adds the retained screenshot/image evidence gate. Inventory mode counts
  image artifacts only; acceptance mode requires a review manifest covering every retained image in the supplied roots.
  OCR sidecar text is scanned for secret/internal marker classes and dynamic marker values without printing matched values.
- `tests/integration/retained-visual-artifacts.test.ts` - covers no-manifest fail-closed behavior, inventory mode, passing
  manual review manifests, missing-image manifest failures, OCR sidecar forbidden text without value echo, dynamic marker
  label requirements, supplied-manifest validation even for empty image roots, unsafe root refusal, root package script wiring,
  and CI upload guard wiring.
- `package.json` - adds `npm run evidence:visual`.
- `.github/workflows/ci.yml` - stops directly uploading raw `tests/e2e/screenshots/**` from staged CI; CI inventories visual
  artifacts, validates any `logs/retained-visual-artifacts/**/visual-review*.json` upload candidate with `--manifest`, and
  uploads only matching manifest files with short retention.
- `.gitignore` - ignores generated `logs/retained-visual-artifacts/` evidence manifests.
- `scripts/run-lms-db-e2e.mjs` and `docs/DEPLOYMENT.md` - require both text artifact scanning and retained visual review
  before archiving LMS DB screenshots.
- `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/RISK_REGISTER_MASTER.md`,
  `docs/SECRET_VAULT_DESIGN.md`, `docs/DEPLOYMENT.md`, `README.md`, and this file - separate text secret/artifact scanning
  from screenshot/image evidence, record inventory as not acceptance, remove stale CI-green wording, avoid overbroad
  production-ready wording, and point continuation to the Phase 3.55 restart prompt.
- `docs/handoffs/20260602-1444-*.md` - four per-agent read-only handoffs plus aggregate Phase 3.55 handoff.
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_55_20260602.md` - durable copy-paste prompt for the next required new session after
  Phase 3.55.
- Verified: syntax checks PASS for `scripts/check-retained-visual-artifacts.mjs` and `scripts/run-lms-db-e2e.mjs`, focused
  Vitest PASS (`10` passed), visual inventory PASS (`68` image files), expected no-manifest refusal PASS, `npm run secret:scan`
  PASS, `node scripts/gates.mjs full` PASS (9/9), `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates` PASS, and final
  `npm run governance:check` PASS. No OCR review of current screenshots, live acceptance, SSH, nginx, systemd, database
  mutation, network provider call, CI execution, preview/prod rollout, or production monitoring was performed.

## 2026-06-02 Phase 3.54 additions (child-process output redaction - no live acceptance, no DB mutation)
- `scripts/redacted-child-process.mjs` and `scripts/redacted-child-process.d.mts` - add the shared text-only child output
  redactor and runner wrapper for retained console/log evidence.
- `scripts/run-lms-db-e2e.mjs`, `scripts/run-lms-db-e2e-managed.mjs`, and `scripts/run-real-pg-harness-managed.mjs` - replace
  raw inherited child stdout/stderr with redacted forwarding while preserving existing throwaway DB and scanner behavior.
- `scripts/gates.mjs` - captures each gate's child output, redacts it, extracts metrics, discards full output for passing
  gates, retains full redacted output only for failing gates, and keeps the compact summary output.
- `scripts/safe-worker-tick.mjs` - routes the short worker smoke command through the shared redacted child-process helper.
  `scripts/safe-preview.mjs` remains a long-running interactive dev-server stream and is not retained evidence.
- `tests/integration/child-output-redaction.test.ts` - adds a fixture child process that emits leak-shaped stdout/stderr and
  asserts retained output is redacted.
- `tests/integration/lms-db-e2e-harness.test.ts`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`,
  `tests/integration/real-pg-managed-runner-safety.test.ts`, and `tests/integration/db-seed-preview-hardening.test.ts` -
  update static wiring guards for redacted child output.
- `docs/DEPLOYMENT.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and this file - record that Phase 3.54 is child stdout/stderr
  and retained gate-log hygiene, not live acceptance or OCR.
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_54_20260602.md` - durable copy-paste prompt for the required new session after
  Phase 3.54, including read order, required agents, credentialed acceptance options, local safety fallback slices, forbidden
  actions, stop conditions, and required gates reporting.
- `docs/NEXT_SESSION_PROMPT_FULL_PLATFORM_20260601.md` and `docs/PROJECT_CHAT_HANDOFF_20260601.md` - marked historical for
  current continuation, pointing new sessions to the Phase 3.54 restart prompt first.
- `README.md` and `docs/ACCEPTANCE_MATRIX_MASTER.md` - current entry points now reference the Phase 3.54 restart prompt,
  compact full gate runner, and retained `logs/gates` scanner-clean evidence policy.
- Verified: syntax checks PASS for six changed scripts, focused Vitest PASS (`56` passed), regression focused Vitest PASS
  (`6` passed), `npm run secret:scan` PASS, `node scripts/gates.mjs full` PASS (9/9),
  `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates` PASS, post-cleanup `npm run governance:check` PASS, and
  post-cleanup `npm run secret:scan` PASS. No live acceptance, SSH, nginx, systemd, database mutation, network provider call,
  CI, screenshot OCR, or production monitoring was performed.

## 2026-06-02 Phase 3.53 additions (preflight log-root confinement - no live acceptance, no DB mutation)
- `scripts/preflight-log-root.mjs` and `scripts/preflight-log-root.mjs.d.ts` - add the shared operator evidence-root policy:
  `*_PREFLIGHT_LOG_ROOT` overrides must be relative repo-local `logs/...` paths. Absolute, UNC, URL-shaped, parent-traversal,
  and non-`logs/` roots are refused; summary writes return normalized relative `logs/.../summary-*.json` display paths.
- `scripts/lms-s3-r2-live-preflight.mjs`, `scripts/lms-external-scanner-live-preflight.mjs`,
  `scripts/billing-stripe-webhook-replay-preflight.mjs`, `scripts/billing-stripe-checkout-preflight.mjs`, and
  `scripts/axioma-handoff-preflight.mjs` - use the shared helper and validate log-root overrides before heavy dry-run/live
  work or summary writes.
- `scripts/scan-lms-db-e2e-artifacts.mjs` - confines explicit scan roots and dynamic marker manifests to workspace-local
  paths, refuses URL/traversal/off-workspace roots, refuses missing explicit roots, and prints repo-relative labels.
- `tests/integration/preflight-log-root.test.ts` and `tests/integration/preflight-log-root-wiring.test.ts` - cover helper
  policy, normalized relative summary paths, hostile roots, no summary writes on refusal, and no raw-root echo.
- `tests/integration/lms-object-storage-live-preflight.test.ts`,
  `tests/integration/lms-external-scanner-live-preflight.test.ts`,
  `tests/integration/billing-stripe-checkout-preflight.test.ts`,
  `tests/integration/billing-stripe-webhook-replay-preflight.test.ts`,
  `tests/integration/axioma-handoff-preflight.test.ts`, and `tests/integration/lms-db-e2e-artifact-scan.test.ts` - align
  success paths to repo-local `logs/test-*` roots and add unsafe scanner-root coverage.
- `.env.example` and `docs/DEPLOYMENT.md` - document the relative `logs/...` override rule and normalized summary output.
- Verified: syntax checks PASS for helper/five preflight scripts/scanner, focused Vitest PASS (`55` passed),
  `npm run governance:check` PASS (0 errors / 1 known warning; 4 cited per-agent handoffs all present),
  `npm run secret:scan` PASS, `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), `npm run typecheck` PASS,
  and `node scripts/gates.mjs full` PASS (9/9). No live acceptance, SSH, nginx, systemd, database mutation, network provider
  call, CI, or production monitoring was performed.

## 2026-06-02 Phase 3.52 additions (raw preview URL hygiene - no live preview, no DB mutation)
- `apps/web/next.config.ts` - replaces the hardcoded raw preview dev origin with `WTC_DEV_ALLOWED_ORIGINS`, so network dev
  origins are operator-configured rather than retained in source.
- `scripts/scan-lms-db-e2e-artifacts.mjs` - rejects raw public IPv4 URLs, public-IP SSH targets, preview/base URL
  assignments, raw app redirect URL fields, DB/admin URL or DSN assignments, and generic token/API-key assignments in
  generated text artifacts.
- `tests/integration/lms-db-e2e-artifact-scan.test.ts` - adds no-value-echo regression coverage for raw preview URLs,
  public-IP SSH targets, DB/admin URL or DSN assignments, app redirect URL fields, and generic token/API-key assignments.
- `tests/integration/preview-url-hygiene.test.ts` - guards selected active source docs/config from reintroducing the old raw
  preview host, raw SSH target, demo password, or preview DB name.
- `.gitignore` and `.secretlintignore` - exclude `.runtime/`, preview stdout logs, `dev-server.log`, and `.next-e2e*`
  generated browser build outputs from accidental retention/export.
- `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/INTEGRATION_MAP.md`, `docs/PROJECT_CHAT_HANDOFF_20260601.md`,
  `docs/NEXT_SESSION_PROMPT_FULL_PLATFORM_20260601.md`, `docs/OPEN_QUESTIONS.md`, `docs/STATUS.md`,
  `docs/NEXT_ACTIONS.md`, and this file - replace durable raw preview/access coordinates with operator-only placeholders
  while keeping live preview and credentialed acceptance gates NOT RUN. No live preview, SSH, nginx, systemd, database
  mutation, CI, or production monitoring was performed.
- Verified: focused Vitest PASS (`21` passed), active docs/config old-coordinate search PASS (no matches in active docs
  outside historical handoffs), `npm run governance:check` PASS (0 errors / 1 known warning; 4 cited per-agent handoffs all
  present), `npm run secret:scan` PASS, `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), and
  `node scripts/gates.mjs full` PASS (9/9).

## 2026-06-02 Phase 3.51 additions (LMS DB wrapper redaction - no migration, no DB mutation)
- `scripts/run-lms-db-e2e-managed.mjs` - adds a guarded/exported `safeMessage()` sanitizer, refuses unknown CLI arguments
  without echoing the argument value, and redacts raw Postgres URLs plus `password=` fragments in parse/create/drop error
  paths.
- `scripts/run-lms-db-e2e.mjs` - redacts raw Postgres URLs and `password=` fragments in runner/scanner catch paths before
  inherited stderr can become retained evidence.
- `scripts/prepare-lms-db-e2e.ts` - redacts raw Postgres URLs and `password=` fragments before printing prep failures.
- `scripts/run-real-pg-harness-managed.mjs` - refuses unknown CLI arguments without echoing the argument value and extends
  error redaction to `password=` fragments.
- `tests/integration/lms-db-e2e-harness.test.ts` and `tests/integration/real-pg-managed-runner-safety.test.ts` - add focused
  no-DB coverage for URL-shaped unknown args, direct sanitizer redaction, credential-present unknown args, and child/prep
  static redaction guards.
- `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and this file - record Phase 3.51 while keeping actual LMS DB browser
  acceptance, active real-Postgres proof, production/preview append-only role proof, production DB rollout, GitHub CI, and
  monitoring open.
- Verified: syntax checks PASS, direct URL-shaped unknown-arg refusals PASS for LMS and real-PG managed wrappers, and
  focused Vitest PASS (`42` passed), `npm run governance:check` PASS (0 errors / 1 known warning; 3 cited per-agent handoffs
  all present), `npm run secret:scan` PASS, `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), and
  `node scripts/gates.mjs full` PASS (9/9). No live DB mutation was performed.

## 2026-06-02 Phase 3.50 additions (runner/gate help safety - no migration, no DB mutation)
- `scripts/run-real-pg-harness-managed.mjs` - adds allowed-argument handling and refuses unknown args like `--dry-run` before
  parsing `REAL_POSTGRES_ADMIN_DATABASE_URL`, constructing a Postgres client, or creating/dropping a throwaway DB.
- `scripts/gates.mjs` - derives invalid-mode help from `Object.keys(PLANS)` and moves `logs/gates` directory creation until
  after valid-mode selection, keeping typo refusals artifact-free.
- `tests/integration/real-pg-managed-runner-safety.test.ts` - adds focused safety coverage for opt-in script registration,
  safe help, unknown-arg refusal without credentials, unknown-arg refusal with a dummy admin URL present, missing admin URL
  refusal, invalid/throwaway URL redaction, and invalid gate-mode help listing all modes.
- `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and this file - record Phase 3.50 while keeping active real-Postgres proof,
  production/preview append-only audit role proof, production DB rollout, GitHub CI, and monitoring open.
- Verified: `node --check scripts/run-real-pg-harness-managed.mjs` PASS, `node --check scripts/gates.mjs` PASS,
  focused Vitest PASS (`7` passed), `npm run accept:real-pg:managed -- --dry-run` refusal PASS, credential-present unknown-arg
  refusal PASS via focused test, `node scripts/gates.mjs nope` refusal PASS, `npm run governance:check` PASS (0 errors /
  1 known warning; 3 cited per-agent handoffs all present), `npm run secret:scan` PASS,
  `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), and `node scripts/gates.mjs full` PASS (9/9).
  No live DB mutation was performed.

## 2026-06-02 Phase 3.49 additions (audit append-only role preflight - no migration, 43 tables)
- `scripts/audit-append-only-role-preflight.mjs` - adds an opt-in acceptance command for PostgreSQL-level
  `public.audit_logs` append-only enforcement. It requires `AUDIT_APPEND_ONLY_PREFLIGHT_ACCEPT=1`, connects as the restricted
  app role (`wtc_app_role` by default), rejects missing/invalid URLs, admin-looking URL users, and non-`wtc_test*` DB names by
  default, verifies the role is not elevated and does not own `audit_logs`, proves `SELECT`/`INSERT` allowed and
  `UPDATE`/`DELETE`/`TRUNCATE` denied, and writes one safe `system.health_check` probe row only after those checks pass.
- `package.json` - adds `npm run accept:audit:append-only-role`; the command remains outside `ci:local` and
  `scripts/gates.mjs` because it needs operator credentials and writes one audit row.
- `.env.example`, `docs/DEPLOYMENT.md`, `docs/AUDIT_LOG_SCHEMA.md`, `docs/DATA_MODEL.md`, and `docs/SECURITY_MODEL.md` -
  document the `AUDIT_APPEND_ONLY_*` operator envs, standardize examples on `wtc_app_role`, and keep production append-only
  role proof **NOT RUN** until the command passes against the intended restricted role/database.
- `tests/integration/audit-append-only-role-preflight.test.ts` - adds focused coverage for opt-in script registration,
  default-gate exclusion, safe help, unknown-argument refusal, missing-accept refusal, missing/invalid URL refusal,
  admin-looking URL user refusal, non-throwaway target refusal without leaking the URL, and static checks for elevated-role
  and table-owner protections.
- `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, and this file - record Phase 3.49 while
  keeping active real-Postgres proof, production/preview append-only role proof, production DB rollout, GitHub CI, and
  monitoring open.
- Verified: `node --check scripts/audit-append-only-role-preflight.mjs` PASS, `npm run accept:audit:append-only-role -- --help`
  PASS, missing-accept refusal PASS, invalid-URL refusal PASS, admin-looking URL user refusal PASS, non-throwaway DB refusal
  PASS, focused Vitest PASS (`9` passed), `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift),
  `npm run governance:check` PASS (0 errors / 1 known warning; 5 cited per-agent handoffs all present),
  `npm run secret:scan` PASS, and `node scripts/gates.mjs full` PASS (9/9). No live DB mutation was performed.

## 2026-06-02 Phase 3.48 additions (auth lockout docs truth - docs only, no migration)
- `docs/DATA_MODEL.md` - moves the eight migration `0016_colorful_lyja` auth lockout columns into the active `users` table
  as REAL-in-0016 fields, keeps richer identity fields as TARGET-only unless a later migration adds them, and aligns current
  email index wording with `users_email_idx` on `email`.
- `docs/AUDIT_LOG_SCHEMA.md` - marks `auth.account_unlock` implemented, removes it from the target-only auth additions table,
  and documents the allowed `auth.account_unlock` before/after lockout snapshot fields plus forbidden secret/public-leak
  fields.
- `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and this file - record Phase 3.48 docs truth while keeping active real-Postgres
  proof NOT RUN without credentials.
- Verified: `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), `npm run governance:check` PASS (0 errors /
  1 known warning; 4 cited per-agent handoffs all present), `npm run secret:scan` PASS, and `node scripts/gates.mjs full`
  PASS (9/9).

## 2026-06-02 Phase 3.47 additions (managed real-PG proof runner - no migration, 43 tables)
- `scripts/run-real-pg-harness-managed.mjs` - adds a managed active real-Postgres proof runner. It requires
  `REAL_POSTGRES_ADMIN_DATABASE_URL` pointed at a non-throwaway maintenance database, creates a fresh `wtc_test_<suffix>`,
  runs only `npm test -- tests/integration/db-real-postgres.test.ts` with generated ephemeral secrets if needed, and drops
  the throwaway DB in `finally`. It prints the DB name and command shape, not the full URL or password.
- `package.json` - adds `npm run accept:real-pg:managed`.
- `docs/DEPLOYMENT.md`, `docs/NEXT_ACTIONS.md`, `docs/STATUS.md`, and this file - document the managed runner as the
  preferred next operator path while keeping active real-PG auth/account proof **NOT RUN** until credentials are supplied and
  active tests pass without skips.
- Local discovery found PostgreSQL 17 running on `127.0.0.1:5432` and `psql.exe` available by full path, but no usable
  credentials in the current shell; Docker is unavailable. No DB mutation was performed.
- Verified: `node --check scripts/run-real-pg-harness-managed.mjs` PASS, `npm run accept:real-pg:managed -- --help` PASS,
  missing-admin-url refusal PASS (expected exit 2 before DB mutation), focused default real-PG harness PASS (`5` passed /
  `9` skipped), and `node scripts/gates.mjs full` PASS (9/9). Active managed run remains NOT RUN without
  `REAL_POSTGRES_ADMIN_DATABASE_URL`.

## 2026-06-02 Phase 3.46 additions (real-PG harness table-set truth - no migration, 43 tables)
- `tests/integration/db-real-postgres.test.ts` - replaces the stale hardcoded real-Postgres table-count assertion with a
  dynamic proof: derive the current Drizzle schema table names via `isTable()`/`getTableName()`, then compare the migrated
  real-Postgres `information_schema` base table set to that schema-derived set. This keeps the harness aligned with future
  schema growth without reintroducing a fixed `40`/`41` count.
- `tests/integration/db-real-postgres.test.ts` - adds an always-run schema table-list helper test, so the no-credential
  default run still proves the table-set source is coherent while the DB-mutating real-PG block remains skipped without
  `REAL_POSTGRES_DATABASE_URL`.
- `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/ROADMAP_MASTER.md`,
  `docs/RISK_REGISTER_MASTER.md`, `docs/PRODUCTION_BLOCKERS.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`,
  `docs/DEPLOYMENT.md`, `docs/DATA_MODEL.md`, and this file - reconcile current schema/proof wording: 43 current tables,
  dynamic table-set proof, self-migrating/self-seeding throwaway harness, and active real-Postgres proof still NOT RUN without
  operator credentials.
- Verified: focused default real-PG harness Vitest PASS (`5` passed / `9` skipped). The skipped tests are the DB-mutating
  real-Postgres block because `REAL_POSTGRES_DATABASE_URL` was not supplied. `npm run db:generate -w @wtc/db` PASS (43
  tables, no schema drift), `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS,
  `npm run secret:scan` PASS, `npm run governance:check` PASS (0 errors / 1 known warning; 5 cited per-agent handoffs all
  present), and `node scripts/gates.mjs full` PASS (9/9). No migration was needed.
- Still open after this phase: active real-Postgres auth/account race proof with operator credentials, production
  nginx/shared-store auth throttling and trusted proxy proof, production DB rollout/live deploy, email notification/review
  workflow, password reset/change/verify-email route lockout, append-only audit DB role, GitHub CI, and production monitoring.

## 2026-06-02 Phase 3.45 additions (registration audit - no migration, 43 tables)
- `packages/audit/src/audit.ts`, `packages/audit/src/audit.test.ts`, and `packages/audit/src/__smoke__.ts` - add and smoke
  `auth.register` as the typed audit action for successful account registration.
- `packages/db/src/repositories.ts` - adds opt-in `auditRegistration` support to `createUser()`: after user and role inserts
  succeed, the same transaction writes `auth.register` with `actorUserId`/`targetId` set to the new user and only
  non-secret metadata (`roles`, `hasDisplayName`) in the audit payload.
- `apps/web/src/lib/db-store.ts` and `apps/web/src/lib/demo.ts` - DB-backed public registration opts into the transactional
  audit path, while demo mode writes the same event for local parity.
- `tests/integration/db-persistence.test.ts` and `tests/integration/auth-error-copy.test.ts` - add PGlite coverage for the
  registration audit row, no submitted email/password-hash retention, duplicate-email no-success-audit behavior, and static
  public auth copy guardrails.
- `docs/AUDIT_LOG_SCHEMA.md`, `docs/RBAC_MATRIX.md`, `docs/SECURITY_MODEL.md`, `docs/SITEMAP.md`,
  `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `docs/NEXT_ACTIONS.md`, `docs/STATUS.md`, and this file - reconcile registration
  audit as local implementation while keeping production/live gates open.
- Verified: focused registration/auth Vitest PASS (`27` passed), `npm run check:core` PASS, `npm run typecheck` PASS,
  `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS, `npm run db:generate -w @wtc/db` PASS (43 tables, no schema
  drift), `node scripts/gates.mjs full` PASS (9/9), `node scripts/gates.mjs e2e` PASS (`44` passed),
  `npm run worker:smoke` PASS, final artifact scan PASS, final `npm run secret:scan` PASS, and final
  `npm run governance:check` PASS (0 errors / 1 known warning; 7 cited per-agent handoffs all present).
- Still open after this phase: active real-Postgres auth race proof with operator credentials, production nginx/shared-store
  auth throttling and trusted proxy proof, production DB rollout/live deploy, email notification/review workflow,
  password reset/change/verify-email route lockout, append-only audit DB role, GitHub CI, and production monitoring. The stale
  real-Postgres table-set assertion cleanup landed locally in Phase 3.46.

## 2026-06-02 Phase 3.44 additions (admin account unlock - no migration, 43 tables)
- `packages/auth/src/login-lockout.ts`, `packages/auth/src/login-lockout.test.ts`, and `packages/auth/src/index.ts` - add
  `nextAdminUnlockState()` and pure coverage proving admin unlock clears all failed-login, lockout, and review state.
- `packages/db/src/repositories.ts` - adds `unlockUserLoginLockout()` with a target-user row lock, full lockout-state clear,
  and in-transaction `auth.account_unlock` audit row containing safe before/after lockout state plus the validated admin
  reason. `listUsersWithCreatedAt()` now projects safe lockout display fields for admin DTO mapping.
- `apps/web/src/features/admin/schemas.ts`, `apps/web/src/features/admin/actions.ts`,
  `apps/web/src/features/admin/queries.ts`, and `apps/web/src/features/admin/types.ts` - add the admin unlock schema,
  server action guard stack, DB repo call, admin-safe lockout DTO projection, and `/admin/users` plus `/admin/audit-log`
  revalidation.
- `apps/web/src/app/admin/users/page.tsx` - renders account-security state and per-user CSRF-protected clear-lockout forms
  only when an account is locked or review-required.
- `tests/integration/admin-account-unlock-db.test.ts`, `tests/integration/admin-account-unlock-static.test.ts`,
  `tests/integration/db-real-postgres.test.ts`, `tests/integration/auth-error-copy.test.ts`, and
  `tests/integration/admin-responsive.test.ts` - add PGlite state/audit/login-after-unlock coverage, static RBAC/CSRF/Zod/UI
  guardrails, an opt-in real-Postgres duplicate-unlock race case, generic public-auth copy guardrails, and responsive-table
  coverage for the new admin action column.
- `docs/SECURITY_MODEL.md`, `docs/RBAC_MATRIX.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `docs/NEXT_ACTIONS.md`,
  `docs/STATUS.md`, and this file - reconcile admin unlock as local implementation while keeping production rollout and
  live proof gates open.
- Verified: focused admin-unlock/auth Vitest PASS (`82` passed / `9` skipped), `npm run check:core` PASS,
  `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS,
  `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), `node scripts/gates.mjs full` PASS (9/9),
  `node scripts/gates.mjs e2e` PASS (`44` passed), `npm run worker:smoke` PASS, final artifact scan PASS, final
  `npm run secret:scan` PASS, and final `npm run governance:check` PASS.
- Still open after this phase: active real-Postgres admin-unlock race proof with operator credentials, production
  nginx/shared-store auth throttling and trusted proxy proof, production DB rollout/live deploy, email notification/review
  workflow, password reset/change/verify-email route lockout, append-only audit DB role, GitHub CI, and production monitoring.
  Registration audit landed locally in Phase 3.45.

## 2026-06-02 Phase 3.43 additions (DB-backed account login lockout - migration 0016, 43 tables)
- `packages/auth/src/login-lockout.ts`, `packages/auth/src/login-lockout.test.ts`, `packages/auth/src/index.ts`, and
  `packages/auth/src/__smoke__.ts` - add pure login-lockout policy, thresholds, state transitions, success reset, and
  smoke coverage.
- `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`, `packages/db/migrations/0016_colorful_lyja.sql`, and
  `packages/db/migrations/meta/0016_snapshot.json` - add durable failed-login/account-lockout columns and transactional
  `attemptUserLogin()` with row lock, generic failed/locked results, reset-on-success, and safe `auth.login_failed` audit
  rows.
- `apps/web/src/lib/demo.ts`, `apps/web/src/lib/db-store.ts`, `apps/web/src/lib/backend.ts`, and
  `apps/web/src/app/(auth)/actions.ts` - wire memory/DB parity through `attemptLogin()` while keeping public login redirects
  on stable generic codes.
- `tests/integration/auth-login-lockout-db.test.ts`, `tests/integration/auth-error-copy.test.ts`, and
  `tests/integration/db-real-postgres.test.ts` - add PGlite lockout integration coverage, static no-duplicate-failure-audit
  guardrails, and an opt-in throwaway real-Postgres cross-connection failed-login race test.
- `docs/SECURITY_MODEL.md`, `docs/SITEMAP.md`, `docs/RBAC_MATRIX.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`,
  `docs/NEXT_ACTIONS.md`, `docs/STATUS.md`, and this file - reconcile account-lockout status and remaining production
  blockers.
- Verified: focused lockout/auth Vitest PASS (`17` passed / `8` skipped), real-Postgres harness default PASS
  (`4` passed / `8` skipped), `npm run check:core` PASS, `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS,
  `npm run lint` PASS, `node --check scripts/gates.mjs` PASS, `npm run db:generate -w @wtc/db` PASS (43 tables, no schema
  drift), `node scripts/gates.mjs full` PASS (9/9; Vitest `824` passed / `9` skipped), `node scripts/gates.mjs e2e` PASS
  (`44` passed), `npm run worker:smoke` PASS, final artifact scan PASS, final `npm run secret:scan` PASS, and final
  `npm run governance:check` PASS.
- Still open after this phase: production nginx/shared-store auth throttling and trusted proxy proof, real-Postgres active
  lockout race run with operator credentials, email notification/review workflow, append-only audit DB role, live production
  deploy, and CI. Admin unlock UI/action landed locally in Phase 3.44; registration audit landed locally in Phase 3.45.

## 2026-06-02 Phase 3.42 additions (auth rate-limit truth - no migration, 43 tables)
- `tests/integration/auth-rate-limit-middleware.test.ts` - deterministic middleware integration coverage for matcher scope,
  `POST /login`, `POST /register`, `429`, `Retry-After`, rate-limit headers, generic response body, Edge-safe subpath imports,
  and production no-IP fail-closed behavior.
- `apps/web/src/features/auth/error-copy.ts`, `apps/web/src/app/(auth)/login/page.tsx`, and
  `apps/web/src/app/(auth)/register/page.tsx` - map only stable auth error codes to neutral browser copy; hostile or stale
  query-string text falls back to generic copy; registration no longer exposes the hashing algorithm in public copy.
- `apps/web/src/app/(auth)/actions.ts` - login/register actions redirect with stable error codes only; duplicate-email and
  transient registration failures no longer display account-specific text.
- `tests/integration/auth-error-copy.test.ts` - covers known code mapping, hostile/duplicate fallback, and static page/action
  guardrails for neutral copy.
- `packages/auth/src/csrf.ts` and `packages/auth/src/__smoke__.ts` - comments aligned with the current session-bound CSRF
  helper path while retaining legacy helper coverage.
- `scripts/gates.mjs` - usage comment corrected so `full` is documented as core + build, with `e2e` as a separate plan.
- `docs/SECURITY_MODEL.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/ARCHITECTURE_DECISIONS.md`, `docs/SITEMAP.md`,
  `docs/PRODUCTION_BLOCKERS.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `docs/DEPLOYMENT.md`, and `docs/NEXT_ACTIONS.md`
  - reconciled current auth route truth, CSRF model, middleware 429 acceptance, production proxy caveats, and account-lockout
  deferral.
- Verified: focused auth Vitest PASS (`25` passed), `npm run check:core` PASS, `npm run typecheck` PASS,
  `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS, `node --check scripts/gates.mjs` PASS, `npm run worker:smoke`
  PASS, `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), `node scripts/gates.mjs full` PASS (9/9;
  Vitest `814` passed / `8` skipped), `node scripts/gates.mjs e2e` PASS (`44` passed), final artifact scan PASS, final
  `npm run secret:scan` PASS, and final `npm run governance:check` PASS.
- Still open after Phase 3.42 at the time: account-specific login lockout (landed locally in Phase 3.43), production
  nginx/shared-store auth throttling and trusted proxy proof, append-only audit DB role, live production deploy, and CI.
  Registration audit landed locally in Phase 3.45.

## 2026-06-02 Phase 3.41 additions (Axioma handoff preflight - no migration, 43 tables)
- `packages/axioma-bridge/src/preflight.ts`, `packages/axioma-bridge/src/preflight.test.ts`, and
  `packages/axioma-bridge/src/index.ts` - add generated ephemeral P-256 preflight fixtures and redacted ES256/JWKS/token-shape
  summaries without returning raw token or key material.
- `scripts/axioma-handoff-preflight.mjs`, `package.json`, and `.env.example` - add the guarded
  `accept:axioma:handoff-preflight` command. Dry-run uses generated key material, disposable PGlite, and extracted
  journal-handoff/JTI consume handlers; it performs no Axioma network I/O, refuses `APP_ENV=production`, refuses pre-existing
  Axioma signing-key or bridge-token env values, and stores redacted evidence only.
- `apps/web/src/features/terminal/axioma-route-core.ts` - route readiness now parses ES256 key material through
  `createEs256Signer()` and reports `es256_key_invalid` before signing or recording state.
- `packages/axioma-bridge/src/__smoke__.ts` - `check:core` now proves generated ES256/JWKS readiness in addition to the HS256
  dev-stub checks.
- `scripts/scan-lms-db-e2e-artifacts.mjs` and `tests/integration/lms-db-e2e-artifact-scan.test.ts` - extend retained-artifact
  deny rules to Axioma signing key/API token assignments, private key blocks, compact JWTs, raw handoff route evidence, raw
  single-use/CSRF claims, and linked account identifiers.
- `tests/integration/axioma-handoff-preflight.test.ts`, `tests/integration/axioma-jwks-readiness.test.ts`,
  `tests/integration/axioma-journal-handoff-handler.test.ts`, `tests/integration/axioma-download-handler.test.ts`,
  `tests/integration/axioma-account-link-handler.test.ts`, and `tests/integration/axioma-skeleton-static.test.ts` - cover
  opt-in command exclusion, redacted evidence, configured-key refusal, parse-verified readiness, and generated P-256 fixtures.
- Verified: focused Axioma/scanner Vitest PASS (`72` passed), script syntax PASS, `npm run check:core` PASS, dry-run Axioma
  handoff preflight plus temp artifact scan PASS, `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS,
  `npm run lint` PASS, `npm run worker:smoke` PASS, `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift),
  `node scripts/gates.mjs full` PASS (9/9; Vitest `806` passed / `8` skipped), and `node scripts/gates.mjs e2e` PASS
  (`44` passed), final artifact scan PASS, final `npm run secret:scan` PASS, and final `npm run governance:check` PASS.
- Still open after this phase: live Axioma endpoint-shape/JWKS/handoff/download/account-link acceptance, production P-256 key
  provisioning, service-token provisioning, live installer streaming/security acceptance, real-Postgres JTI race proof, browser
  CTA enablement, and CI.

## 2026-06-02 Phase 3.40 additions (Stripe checkout request preflight - no migration, 43 tables)
- `packages/billing/src/stripe-checkout.ts`, `packages/billing/src/stripe-checkout.test.ts`, and `packages/billing/src/index.ts`
  - add shared Stripe price-map parsing, test-mode config validation, Checkout request/body construction, and redacted request
  summaries.
- `packages/billing/src/stripe.ts` and `apps/web/src/features/billing/checkout.ts` - reuse the shared checkout helpers in the
  real Stripe provider and web checkout config path.
- `scripts/billing-stripe-checkout-preflight.mjs`, `package.json`, and `.env.example` - add the guarded
  `accept:billing:stripe-checkout` command. Dry-run builds generated fake test-mode Checkout requests in memory only, performs
  no Stripe network I/O, writes no pending-payment rows, refuses `APP_ENV=production` or live `sk_live_` keys, and stores
  redacted evidence.
- `scripts/scan-lms-db-e2e-artifacts.mjs`, `tests/integration/billing-stripe-checkout-preflight.test.ts`, and
  `tests/integration/lms-db-e2e-artifact-scan.test.ts` - extend retained-artifact deny rules to Stripe price IDs, Checkout
  endpoint paths, raw request field names, secret keys, and Checkout Session IDs.
- Verified: focused billing/checkout Vitest PASS (`48` passed), `node --check
  scripts/billing-stripe-checkout-preflight.mjs` PASS, dry-run Stripe checkout preflight plus temp artifact scan PASS,
  `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS, `npm run worker:smoke` PASS, and
  `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), `node scripts/gates.mjs full` PASS (9/9),
  `node scripts/gates.mjs e2e` PASS (`44` passed), final artifact scan PASS, final `npm run secret:scan` PASS, and final
  `npm run governance:check` PASS.
- Still open after this phase: real Stripe Checkout Session creation, Stripe CLI/Dashboard replay, Stripe test price
  verification, pending-payment to active with provider events, production key provisioning, production endpoint registration,
  live/staging route replay, real-Postgres Stripe route acceptance, and CI.

## 2026-06-02 Phase 3.39 additions (Stripe webhook replay preflight - no migration, 43 tables)
- `packages/billing/src/stripe-replay.ts`, `packages/billing/src/stripe-replay.test.ts`, and `packages/billing/src/index.ts`
  - add shared Stripe replay fixture construction, signed `Request` creation, webhook-secret shape checks, and sanitized
  case summaries.
- `scripts/billing-stripe-webhook-replay-preflight.mjs`, `package.json`, and `.env.example` - add the guarded
  `accept:billing:stripe-webhook` command. Dry-run uses disposable PGlite, generated fake signed fixtures, and the extracted
  webhook handler; it performs no Stripe network I/O, does not call checkout creation, refuses `APP_ENV=production`, and
  writes redacted evidence.
- `scripts/scan-lms-db-e2e-artifacts.mjs`, `tests/integration/billing-stripe-webhook-replay-preflight.test.ts`, and
  `tests/integration/lms-db-e2e-artifact-scan.test.ts` - extend retained-artifact deny rules to Stripe secret assignments,
  webhook-secret/signature material, raw provider event bodies, and checkout session identifiers.
- Verified: focused billing/replay Vitest PASS (`55` passed), `node --check
  scripts/billing-stripe-webhook-replay-preflight.mjs` PASS, dry-run Stripe replay plus temp artifact scan PASS,
  `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS, `npm run worker:smoke` PASS, and
  `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), `node scripts/gates.mjs full` PASS (9/9),
  `node scripts/gates.mjs e2e` PASS (`44` passed), final artifact scan PASS, final `npm run secret:scan` PASS, and final
  `npm run governance:check` PASS.
- Still open after this phase: Stripe CLI/Dashboard replay, real Stripe test checkout acceptance, production key
  provisioning, production webhook endpoint registration, live/staging route replay, real-Postgres Stripe route acceptance,
  and CI.

## 2026-06-02 Phase 3.38 additions (LMS live external scanner acceptance preflight - no migration, 43 tables)
- `packages/lms/src/external-scanner.ts`, `packages/lms/src/external-scanner.test.ts`, and `packages/lms/src/index.ts` - add
  shared external scanner config parsing, request construction, response parsing, normalized quarantine reason handling, and
  injected-fetch scan execution.
- `apps/web/src/features/lms/material-storage.ts` - replaces app-local scanner parsing/fetch code with shared `@wtc/lms`
  helpers while preserving scanner-before-storage ordering and generic fail-closed errors.
- `scripts/lms-external-scanner-live-preflight.mjs`, `package.json`, and `.env.example` - add the guarded
  `accept:lms:external-scanner` command. Dry-run builds scanner requests and writes redacted evidence without network I/O;
  live mode requires explicit live consent plus quarantine-corpus confirmation and refuses public-upload enablement.
- `scripts/scan-lms-db-e2e-artifacts.mjs`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`, and
  `tests/integration/lms-db-e2e-harness.test.ts` - extend retained-artifact deny rules to external scanner request headers,
  live scanner consent envs, octet-stream request markers, and raw provider verdict JSON.
- `tests/integration/lms-external-scanner-live-preflight.test.ts` - proves the new scanner command is opt-in, excluded from
  default gates, dry-run evidence is redacted/scanner-safe, and live mode refuses missing consent.
- Verified: focused scanner/preflight Vitest PASS (`44` passed), `node --check
  scripts/lms-external-scanner-live-preflight.mjs` PASS, dry-run scanner preflight plus temp artifact scan PASS,
  `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS, `npm run worker:smoke` PASS,
  `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), initial `npm run governance:check` PASS, initial
  `npm run secret:scan` PASS, initial artifact scan PASS, `node scripts/gates.mjs full` PASS (9/9),
  `node scripts/gates.mjs e2e` PASS (`44` passed), final artifact scan PASS, final `npm run secret:scan` PASS, and final
  `npm run governance:check` PASS.
- Still open after this phase: live external scanner acceptance with operator endpoint/token, live S3/R2 acceptance,
  DB browser acceptance, cleanup/reconcile live acceptance, and public upload rollout.

## 2026-06-02 Phase 3.37 additions (LMS live S3/R2 acceptance preflight - no migration, 43 tables)
- `packages/lms/src/object-storage.test.ts` - upgrades shared object-store coverage from signature-shape checks to exact
  deterministic SigV4 golden assertions for PUT, DELETE, and signed read URL construction.
- `scripts/lms-s3-r2-live-preflight.mjs`, `package.json`, and `.env.example` - add the guarded
  `accept:lms:object-storage` command. Dry-run builds signed requests and writes redacted evidence without network I/O; live
  mode requires explicit live consent plus throwaway-target confirmation and refuses public-upload enablement.
- `scripts/scan-lms-db-e2e-artifacts.mjs`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`, and
  `tests/integration/lms-db-e2e-harness.test.ts` - extend generated-artifact deny rules to object-store env assignments,
  signed object auth/header material, and S3/R2 provider body/request-id markers.
- `tests/integration/lms-object-storage-live-preflight.test.ts` - proves the new command is opt-in, excluded from default
  gates, dry-run evidence is redacted/scanner-safe, and live mode refuses missing consent.
- Verified: focused LMS/storage/preflight Vitest PASS (`103` passed), `node --check
  scripts/lms-s3-r2-live-preflight.mjs` PASS, `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS,
  `npm run lint` PASS, `npm run worker:smoke` PASS, `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), and
  initial `npm run secret:scan` PASS, initial `npm run governance:check` PASS, initial artifact scan PASS,
  `node scripts/gates.mjs full` PASS (9/9), `node scripts/gates.mjs e2e` PASS (`44` passed), final artifact scan PASS,
  final `npm run secret:scan` PASS, and final `npm run governance:check` PASS.
- Still open after this phase: live S3/R2 acceptance with operator-approved throwaway credentials, live scanner acceptance,
  DB browser acceptance, and public upload rollout.

## 2026-06-02 Phase 3.36 additions (LMS cleanup dead-letter acknowledgement/retry - migration 0015, 43 tables)
- `packages/db/src/schema.ts`, `packages/db/migrations/0015_wet_cobalt_man.sql`, and migration metadata - add nullable
  `acknowledged_at` / `acknowledged_by` metadata plus a dead-letter acknowledgement index to private
  `lms_object_cleanup_tasks`. No object locator, file, scanner, provider-body, or signed-request columns are added.
- `packages/db/src/repositories.ts` - adds guarded aggregate acknowledgement and retry APIs, extends count-only summaries
  with acknowledged/unacknowledged counts and timestamps, preserves attempts on retry, keeps object DELETE worker-owned, and
  makes cleanup failure transition/audit transactional and status-guarded.
- `packages/audit/src/audit.ts` and `docs/AUDIT_LOG_SCHEMA.md` - register `education.material_cleanup_ack` and
  `education.material_cleanup_retry` as summary-only audit actions.
- `apps/web/src/features/admin/{schemas.ts,actions.ts,queries.ts,types.ts}` and
  `apps/web/src/app/admin/system-health/page.tsx` - wire aggregate CSRF-protected admin controls on the existing system-health
  card. Forms submit only operation intent plus count/timestamp snapshot guards; they do not submit cleanup task IDs, storage
  keys, filenames, hashes, signed URL tokens, scanner details, provider bodies, or auth headers.
- `scripts/scan-lms-db-e2e-artifacts.mjs` plus integration tests - reject cleanup task identifier field names in retained
  text artifacts and cover ack/retry DB transitions, stale guard behavior, worker retry pickup, summary-only audit payloads,
  and admin static no-leak constraints.
- Verified: focused Phase 3.36 Vitest PASS (`28` passed), `npm run typecheck` PASS,
  `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS, `npm run worker:smoke` PASS, and
  `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), initial `npm run governance:check` PASS,
  initial `npm run secret:scan` PASS, `node scripts/gates.mjs full` PASS (9/9), `node scripts/gates.mjs e2e` PASS
  (`44` passed), `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS, final `npm run secret:scan` PASS, and final
  `npm run governance:check` PASS.
- Still open after this phase: live S3/R2 acceptance, live scanner acceptance, DB browser acceptance, and public upload rollout.

## 2026-06-02 Phase 3.35 additions (LMS shared object-storage primitives - no migration, 43 tables)
- `packages/lms/src/object-storage.ts` and `packages/lms/src/index.ts` - add exported shared S3/R2 config validation and
  signed PUT, DELETE, and read URL request builders. Helpers accept explicit env/config input and return URL/header values
  only; they do not read DB, audit, logs, React, Next, or `@wtc/config`.
- `apps/web/src/features/lms/material-storage.ts` - uses shared object-store builders for clean object PUT, compensation
  DELETE, and signed download redirects while keeping web-owned fetch/error behavior.
- `apps/worker/src/lms-object-cleanup.ts` - uses shared object-store config validation and DELETE request construction for
  expired object-row cleanup and pending upload cleanup.
- `packages/lms/src/object-storage.test.ts` and `tests/integration/lms-object-storage-shared-static.test.ts` - cover config
  validation, signed request/header construction, bounded read URL expiry, invalid-key rejection, and static guards that keep
  SigV4 implementation out of app files.
- Verified: focused Phase 3.35 Vitest PASS (`24` passed), broader focused LMS/config/worker/scanner Vitest PASS
  (`73` passed), `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS,
  `npm run worker:smoke` PASS, `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), initial
  `npm run governance:check` PASS, initial `npm run secret:scan` PASS, `node scripts/gates.mjs full` PASS (9/9),
  `node scripts/gates.mjs e2e` PASS (`44` passed), `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS, final
  `npm run secret:scan` PASS, and final `npm run governance:check` PASS.
- Still open after this phase: live S3/R2 acceptance, live scanner acceptance, DB browser acceptance, dead-letter
  acknowledgement/retry workflow, and public upload rollout.

## 2026-06-02 Phase 3.34 additions (LMS cleanup dead-letter ops review - no migration, 43 tables)
- `packages/db/src/repositories.ts` - adds a count-only LMS cleanup operations summary that does not select cleanup task IDs
  or storage keys, and writes summary-only cleanup audit events when pending upload cleanup tasks dead-letter.
- `apps/web/src/features/admin/health-detail.ts`, `apps/web/src/features/admin/types.ts`, and
  `apps/web/src/features/admin/queries.ts` - project LMS pending cleanup count fields into admin health and expose a safe
  `lmsObjectCleanup` DTO with counts, timestamps, and generic error code only.
- `apps/web/src/app/admin/system-health/page.tsx` - adds the count-only LMS upload cleanup review card and renders worker
  `error` as a bad heartbeat state.
- `tests/integration/lms-object-cleanup-tasks.test.ts`, `tests/integration/admin-health-detail.test.ts`, and
  `tests/integration/admin-lms-cleanup-review.test.ts` - cover summary-only dead-letter audit, safe DB summary projection,
  admin health projection, and static no-leak guards for task IDs, storage keys, filenames, hashes, signed URL tokens, auth
  headers, scanner details, and provider bodies.
- Verified: focused Phase 3.34 Vitest PASS (`51` passed), broader focused LMS/admin/worker/scanner Vitest PASS
  (`94` passed), `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run lint` PASS,
  `npm run worker:smoke` PASS, `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift),
  `node scripts/gates.mjs full` PASS (9/9), `node scripts/gates.mjs e2e` PASS (`44` passed),
  `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS, final `npm run secret:scan` PASS, and final
  `npm run governance:check` PASS (0 errors / 1 known warning).
- Still open after this phase: dead-letter acknowledgement/retry workflow, shared object-store primitives, live S3/R2
  acceptance, live scanner acceptance, DB browser acceptance, and public upload rollout.

## 2026-06-02 Phase 3.33 additions (LMS durable upload cleanup boundary - migration 0014, 43 tables)
- `packages/db/src/schema.ts`, `packages/db/migrations/0014_lazy_puff_adder.sql`, and migration metadata - add the private
  `lms_object_cleanup_tasks` table. It stores provider `s3-r2`, opaque storage key, reason, status, attempts, max attempts,
  run-after, generic last error code, and timestamps only; no filename, MIME, content hash, bytes/base64, label, lesson,
  course, user, scanner, signed URL, header, or raw provider error columns exist.
- `packages/db/src/repositories.ts` - adds repository APIs to create pending cleanup before object PUT, complete cleanup rows,
  atomically create material and complete the pending cleanup task, list due pending cleanup rows, and record retry/dead-letter
  failures with generic error codes.
- `apps/web/src/features/lms/material-storage.ts`, `apps/web/src/features/lms/actions.ts`, and
  `apps/web/src/features/lms/material-create-compensation.ts` - clean `s3-r2` uploads now register pending cleanup before PUT;
  successful material creation completes the task in the material-create transaction; failed material creation still attempts
  immediate compensation and records retry state if DELETE fails.
- `apps/worker/src/lms-object-cleanup.ts`, `apps/worker/src/index.ts`, and `apps/worker/src/tick-once.ts` - add the pending
  upload cleanup worker pass for objects without material rows. DELETE 2xx/404 completes tasks; failures increment attempts,
  schedule retry, or dead-letter after max attempts; worker health and one-shot output add count-only pending-cleanup fields.
- `tests/integration/lms-object-cleanup-tasks.test.ts`, `tests/integration/lms-material-storage.test.ts`,
  `tests/integration/lms-material-create-compensation.test.ts`, `tests/integration/worker-tortila-snapshot.test.ts`,
  `tests/integration/lms-db-e2e-artifact-scan.test.ts`, and `tests/integration/lms-ph3-1-static.test.ts` - cover the migration
  columns/no raw payload fields, pending task lifecycle, atomic material-create completion, retry/dead-letter behavior,
  pre-PUT registration ordering, fail-closed no-PUT registration failure, worker pending cleanup, count-only health/audit, and
  artifact scanner rejection for pending cleanup evidence with raw object material.
- Verified: focused Phase 3.33 Vitest PASS (`68` passed), broader focused LMS/config/worker/scanner Vitest PASS
  (`134` passed), `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run worker:smoke` PASS, and
  `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift), `node scripts/gates.mjs full` PASS (9/9),
  `node scripts/gates.mjs e2e` PASS (`44` passed), `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS, final
  `npm run secret:scan` PASS, and final `npm run governance:check` PASS (0 errors / 1 known warning).
- Still open after this phase: shared object-store primitives, dead-letter operational review/alerting, live S3/R2 acceptance,
  live scanner acceptance, DB browser acceptance, and public upload rollout.

## 2026-06-02 Phase 3.32 additions (LMS upload compensation boundary - no migration, 42 tables)
- `apps/web/src/features/lms/material-storage.ts` - adds signed `DELETE` support for `s3-r2` objects through
  `deleteLmsObjectStorageFile()` and a clean-object-only `compensateLmsUploadedFile()` helper. Compensation is limited to
  provider `s3-r2`, `scanStatus='clean'`, and a storage key; 2xx and `404` are treated as reconciled, while non-clean
  metadata-only rows are no-op.
- `apps/web/src/features/lms/material-create-compensation.ts` and `apps/web/src/features/lms/actions.ts` - route material
  creation through a testable orchestrator. If a file material repository write fails after upload preparation, the
  orchestrator attempts compensation and rethrows the original DB/material creation error even if cleanup fails.
- `tests/integration/lms-material-create-compensation.test.ts`, `tests/integration/lms-material-storage.test.ts`, and
  `tests/integration/lms-ph3-1-static.test.ts` - cover action-level delegation, original-error preservation, failed
  compensation swallowing, non-file no-op behavior, signed object DELETE, `404` reconciliation, quarantined metadata no-op,
  and static action/helper wiring.
- Verified: focused helper/storage/static Vitest PASS (`42` passed), broader focused LMS/config/worker/scanner Vitest PASS
  (`123` passed), `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS, `npm run worker:smoke` PASS,
  `node scripts/gates.mjs full` PASS (9/9), env-cleared `node scripts/gates.mjs e2e` PASS (`40` passed),
  `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current generated roots, final `npm run secret:scan` PASS, and final
  `npm run governance:check` PASS. Durable pending-row/outbox/staging-key retry, live S3/R2 acceptance, live scanner
  acceptance, DB browser acceptance, and public upload rollout remain open.

## 2026-06-02 Phase 3.31 additions (LMS object-store cleanup/reconciliation boundary - no migration, 42 tables)
- `packages/db/src/repositories.ts` - adds bounded `s3-r2` cleanup candidate selection and finalize-after-confirmed-cleanup
  APIs. Finalization keeps DB-local cleanup separate, deletes only still-eligible expired object rows, and writes
  summary-only `education.material_cleanup` audit payloads with provider/cutoff/scope/counts only.
- `apps/worker/src/lms-object-cleanup.ts`, `apps/worker/src/index.ts`, and `apps/worker/src/tick-once.ts` - add the worker
  object cleanup pass. Clean expired object rows require SigV4 `DELETE` success or already-absent `404` before DB hard-delete;
  non-clean metadata-only rows are purged without remote object calls; failed object deletes retain retryable DB rows and
  surface count-only worker health.
- `apps/worker/package.json` and `package-lock.json` - add the local workspace dependency needed for worker-side LMS key/hash
  helpers.
- `apps/web/src/features/lms/material-storage.ts` and `tests/integration/lms-material-storage.test.ts` - align the runtime
  local-storage rejection guard with typed config by treating `APP_ENV=staging` as a public-upload deployment axis.
- `tests/integration/db-lms-ph3-1.test.ts` and `tests/integration/worker-tortila-snapshot.test.ts` - cover candidate
  selection, finalize-after-confirmed-cleanup, clean object DELETE success, clean object `404` reconciliation, metadata-only
  unsafe purge, delete failure retention, and count-only health/audit payloads.
- `tests/integration/lms-db-e2e-artifact-scan.test.ts` - adds cleanup-log fixtures proving retained artifacts fail when they
  contain raw object keys, request headers, or signed query tokens.
- Verified: focused LMS/config/worker/scanner Vitest PASS (`91` passed), `npm run typecheck` PASS,
  `npm run typecheck -w @wtc/web` PASS, `npm run worker:smoke` PASS, `node scripts/gates.mjs full` PASS (9/9),
  env-cleared `node scripts/gates.mjs e2e` PASS (`44` passed), `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current
  generated roots, final `npm run secret:scan` PASS, and final `npm run governance:check` PASS. Live S3/R2
  upload/download/delete/reconcile acceptance, live scanner acceptance, DB browser acceptance, object PUT compensating
  delete/outbox behavior, and public upload rollout remain open.

## 2026-06-02 Phase 3.30 additions (LMS external malware scanner boundary - no migration, 42 tables)
- `packages/config/src/env.ts`, `packages/config/src/env.test.ts`, and `.env.example` - add typed/documented external scanner
  config: `LMS_FILE_SCANNER_ENDPOINT`, `LMS_FILE_SCANNER_TOKEN`, and optional `LMS_FILE_SCANNER_TIMEOUT_MS`. External scanner
  mode requires HTTPS endpoint/token, rejects endpoint credentials/query/fragment, and public-upload fences apply to
  `NODE_ENV=production` plus `APP_ENV=staging|production`.
- `apps/web/src/features/lms/material-storage.ts` - adds the fail-closed external scanner runtime. Uploads validate provider
  config, call the scanner before any storage write, send only bytes plus MIME/size headers, timeout scanner calls, accept
  only `clean`/`quarantined`, and collapse scanner failures to `lms_file_scan_failed`. Clean `s3-r2` verdicts may write to the
  standard object bucket; quarantined `s3-r2` verdicts create non-downloadable metadata rows without writing unsafe bytes to
  that bucket.
- `packages/db/src/repositories.ts` and `docs/AUDIT_LOG_SCHEMA.md` - upload audit payloads now use `hasQuarantineReason`
  instead of raw `quarantineReason`, keeping scanner/vendor reason text out of audit metadata.
- `scripts/scan-lms-db-e2e-artifacts.mjs`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`, and
  `tests/integration/lms-db-e2e-harness.test.ts` - generated-artifact scanning now rejects scanner endpoint/token assignments
  such as `LMS_FILE_SCANNER_TOKEN=...`.
- `tests/integration/lms-material-storage.test.ts` - covers external scanner clean, quarantined, non-2xx, malformed, and
  timeout behavior; scanner-before-object-write ordering; no filename/hash scanner envelope; scanner token containment; and
  skipped standard object write for quarantined `s3-r2` uploads.
- Verified: focused LMS/config/scanner Vitest PASS (`76` passed), `npm run typecheck` PASS,
  `npm run typecheck -w @wtc/web` PASS, `node scripts/gates.mjs full` PASS (9/9), env-cleared
  `node scripts/gates.mjs e2e` PASS (`44` passed), `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current
  generated roots, final `npm run secret:scan` PASS, and final `npm run governance:check` PASS. Live external scanner
  acceptance, live S3/R2 acceptance, object-store cleanup/reconciliation, DB browser acceptance, and public upload rollout
  remain open.

## 2026-06-02 Phase 3.29 additions (LMS S3/R2 object-storage adapter boundary - no migration, 42 tables)
- `packages/lms/src/materials.ts` - adds `LMS_OBJECT_STORAGE_PROVIDER = 's3-r2'`, includes it in the supported provider
  list, and adds `isOpaqueLmsMaterialStorageKey()` for production-style single-segment object keys.
- `packages/config/src/env.ts`, `packages/config/src/env.test.ts`, and `.env.example` - add typed/documented
  `s3-r2` config: HTTPS endpoint, bucket, region, access key id, secret access key, and public-upload fencing that still
  requires external scanning before production public uploads.
- `apps/web/src/features/lms/material-storage.ts` - adds a path-style S3/R2-compatible SigV4 adapter using built-in crypto
  and `fetch`, persists no inline DB bytes for `s3-r2`, signs short-lived read redirects, and keeps generic errors that do
  not expose object-store secrets or signed URLs.
- `apps/web/src/features/lms/material-download.ts` - changes download resolution to a bytes-or-redirect delivery union.
  Local providers stream bytes as before; `s3-r2` returns a no-body `302` with `private, no-store` and `no-referrer` only
  after auth, entitlement, clean-row lookup, and storage resolution pass.
- `apps/web/src/features/lms/actions.ts` - proves lesson/course ownership before file storage is prepared, preventing
  external object writes before authorization.
- `packages/db/src/repositories.ts` - rejects unknown storage providers on material insert and requires opaque keys for
  non-local object-style providers.
- `scripts/scan-lms-db-e2e-artifacts.mjs`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`, and
  `tests/integration/lms-db-e2e-harness.test.ts` - generated-artifact scanning now rejects signed object URL query tokens
  such as `X-Amz-Signature`.
- Tests updated/added: `packages/lms/src/materials.test.ts`, `tests/integration/lms-material-storage.test.ts`,
  `tests/integration/lms-material-download-handler.test.ts`, `tests/integration/db-lms-ph3-1.test.ts`,
  and `packages/config/src/env.test.ts`.
- Verified: focused LMS/config/scanner Vitest PASS (`82` passed), `npm run typecheck` PASS,
  `npm run typecheck -w @wtc/web` PASS, `node scripts/gates.mjs full` PASS (9/9), env-cleared
  `node scripts/gates.mjs e2e` PASS (`44` passed), and `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current
  generated roots. Actual `npm run e2e:lms:db` / `npm run e2e:lms:db:managed` NOT RUN because no valid throwaway/admin DB
  URL is available. Live S3/R2 upload/download acceptance, external scanner acceptance, object-store cleanup/reconciliation,
  and public upload rollout remain open.

## 2026-06-02 Phase 3.28 additions (LMS DB dynamic artifact markers - no migration, 42 tables)
- `scripts/run-lms-db-e2e.mjs` - creates `.next-e2e-db/lms-db-e2e-dynamic-markers.json` before the guarded DB browser run,
  passes it as `LMS_DB_E2E_DYNAMIC_MARKERS_PATH`, and deletes it in `finally` so raw marker values are not archive artifacts.
- `tests/e2e/lms-db-materials.spec.ts` - appends per-project dynamic leak markers to the transient manifest: uploaded file
  body, quarantined body, uploaded filename, file SHA-256, and raw embed HTML.
- `scripts/scan-lms-db-e2e-artifacts.mjs` - reads the optional dynamic marker manifest, fails closed on missing/malformed
  configured manifests, scans marker values and base64 encodings, and reports only safe labels/categories without printing
  matched marker values.
- `tests/integration/lms-db-e2e-artifact-scan.test.ts` and `tests/integration/lms-db-e2e-harness.test.ts` - cover dynamic
  marker failure behavior, malformed manifest rejection, no matched-value output, runner env/path wiring, spec marker writer,
  and scanner static wiring.
- Verified: focused scanner/harness Vitest PASS (`17` passed), `npm run typecheck` PASS,
  `npm run typecheck -w @wtc/web` PASS, `node scripts/gates.mjs full` PASS (9/9), env-cleared
  `node scripts/gates.mjs e2e` PASS (`44` passed), and `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current
  generated roots.
- Still open after this phase: actual `npm run e2e:lms:db` / `npm run e2e:lms:db:managed` because no valid throwaway/admin DB
  URL is available, plus real S3/R2 object storage, signed redirects, external malware scanning, object-store cleanup, and
  public upload rollout.

## 2026-06-02 Phase 3.27 additions (LMS filename minimization - no migration, 42 tables)
- `apps/web/src/features/lms/material-download.ts` - successful LMS file responses now use MIME-derived generic attachment
  names (`lesson-material.pdf`, `.png`, `.jpg`, `.txt`, or `.bin`) instead of the uploaded filename.
- `packages/db/src/repositories.ts` - LMS material upload/download audit payloads no longer include `fileName` or `mimeType`;
  DB-private file name/MIME columns remain for storage and download validation.
- `packages/lms/src/types.ts`, `apps/web/src/features/lms/queries.ts`, and
  `apps/web/src/app/teacher/courses/[id]/page.tsx` - `TeacherMaterialView` no longer adds filename/MIME metadata,
  `toTeacherMaterialView()` stays filename-free, and teacher course material rows render generic file labels with size and
  scan state.
- `scripts/scan-lms-db-e2e-artifacts.mjs`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`,
  `tests/integration/lms-db-e2e-harness.test.ts`, `tests/integration/lms-ph3-1-static.test.ts`,
  `tests/integration/lms-material-download-handler.test.ts`, `tests/integration/db-lms-ph3-1.test.ts`, and
  `tests/e2e/lms-db-materials.spec.ts` - cover generic success filenames, no original filename in download headers/audit,
  filename-free teacher DTO mapping, and generated-artifact rejection for `fileName` / `mimeType`.
- Verified: focused LMS/scanner Vitest PASS (`66` passed), `npm run typecheck` PASS,
  `npm run typecheck -w @wtc/web` PASS, `node scripts/gates.mjs full` PASS (9/9), env-cleared
  `node scripts/gates.mjs e2e` PASS (`44` passed), and `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current
  generated roots. Actual `npm run e2e:lms:db` / `npm run e2e:lms:db:managed` NOT RUN because no valid throwaway/admin DB
  URL is available.
- Still open after this phase: real S3/R2 object storage, signed redirects, external malware scanning, object-store cleanup,
  DB-backed browser acceptance, and public upload rollout.

## 2026-06-02 Phase 3.26 additions (LMS opaque keys and no hash header - no migration, 42 tables)
- `packages/lms/src/materials.ts` - new local LMS material storage keys now use `node:crypto.randomUUID()` as a single
  opaque segment under `lms/materials/`; runtime callers do not pass filename or hash input into key construction.
- `apps/web/src/features/lms/material-storage.ts` and `tests/integration/lms-material-storage.test.ts` - upload storage
  keeps `db-local`/`fs-local` behavior while tests prove identical names/bytes produce different opaque keys and that
  fs-local keys do not contain the filename stem or content hash.
- `apps/web/src/features/lms/material-download.ts`, `tests/integration/lms-material-download-handler.test.ts`, and
  `tests/e2e/lms-db-materials.spec.ts` - successful LMS material downloads no longer expose `x-lms-sha256`; byte integrity
  remains proven by server-side validation plus exact response body assertions.
- `packages/db/src/repositories.ts` - upload/download audit payloads keep raw content digests out of audit metadata by using
  `hasContentHash`; server-private `contentSha256` remains in DB/download rows for local byte integrity checks.
- `scripts/scan-lms-db-e2e-artifacts.mjs`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`, and
  `tests/integration/lms-db-e2e-harness.test.ts` - generated-artifact scanning now rejects the deprecated `x-lms-sha256`
  header name and statically guards the DB browser spec against success hash-header assertions.
- Verified: focused LMS/scanner Vitest PASS (`49` passed), `npm run typecheck` PASS,
  `npm run typecheck -w @wtc/web` PASS, `node scripts/gates.mjs full` PASS (9/9), env-cleared
  `node scripts/gates.mjs e2e` PASS (`44` passed), and `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current
  generated roots. Actual `npm run e2e:lms:db` / `npm run e2e:lms:db:managed` NOT RUN because no valid throwaway/admin DB
  URL is available.
- Still open after this phase: real S3/R2 object storage, signed redirects, external malware scanning, object-store cleanup,
  DB-backed browser acceptance, and public upload rollout.

## 2026-06-02 Phase 3.25 additions (LMS storage adapter boundary - migration 0013, 42 tables)
- `packages/db/src/schema.ts` and `packages/db/migrations/0013_young_martin_li.sql` - relax the `materials_payload_check` so
  `kind='file'` requires inline `file_bytes_base64` only when `storage_provider = 'db-local'`; non-`db-local` rows must keep
  provider/key/hash/size metadata and omit inline DB bytes.
- `packages/lms/src/materials.ts` - adds explicit provider/key constants and validators for `db-local`, `fs-local`, and the
  `lms/materials/` storage-key prefix.
- `apps/web/src/features/lms/material-storage.ts` - new server-side storage boundary. It preserves `db-local` behavior, adds
  an explicit `fs-local` adapter rooted at `LMS_FILE_STORAGE_ROOT`, validates jailed storage keys, verifies file integrity on
  read, and rejects local-only upload providers in production.
- `apps/web/src/features/lms/actions.ts` and `apps/web/src/features/lms/material-download.ts` - teacher uploads now call the
  storage boundary instead of preparing DB-local rows inline; downloads resolve bytes through provider-gated storage resolution
  and fail closed without audit if storage cannot provide bytes.
- `packages/config/src/env.ts`, `packages/config/src/env.test.ts`, and `.env.example` - add typed/documented local LMS storage
  knobs: `LMS_FILE_STORAGE_PROVIDER`, `LMS_FILE_STORAGE_ROOT`, `LMS_FILE_SCANNER_MODE`, and `LMS_PUBLIC_UPLOADS_ENABLED`.
- Tests updated/added: `packages/lms/src/materials.test.ts`, `tests/integration/lms-material-storage.test.ts`,
  `tests/integration/db-lms-ph3-1.test.ts`, `tests/integration/lms-material-download-handler.test.ts`,
  `tests/integration/lms-ph3-1-static.test.ts`, and `packages/config/src/env.test.ts`.
- Verified: focused LMS/config Vitest PASS (`80` passed), `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS,
  `node scripts/gates.mjs full` PASS (9/9), env-cleared `node scripts/gates.mjs e2e` PASS (`44` passed), and
  `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current generated roots. Actual `npm run e2e:lms:db` /
  `npm run e2e:lms:db:managed` NOT RUN because no valid throwaway/admin DB URL is available.

## 2026-06-02 Phase 3.24 additions (LMS local material cleanup worker - no migration, 42 tables)
- `packages/db/src/repositories.ts` - adds `purgeExpiredLmsMaterialFiles()`, a local cleanup primitive that hard-deletes only
  expired file rows where `storage_provider = 'db-local'`, `storage_key LIKE 'lms/materials/%'`, and the row is already
  soft-deleted or has an unsafe scan state (`pending`, `quarantined`, or `failed`). Active clean rows, within-retention rows,
  non-local storage providers, and unexpected local key prefixes are kept.
- `packages/audit/src/audit.ts` and `docs/AUDIT_LOG_SCHEMA.md` - add `education.material_cleanup` as a summary-only system
  audit event. The cleanup audit records count, cutoff, provider, and coarse scope only; it intentionally omits material IDs,
  filenames, MIME values, hashes, bytes/base64, storage keys, and quarantine details.
- `apps/worker/src/index.ts` and `apps/worker/src/tick-once.ts` - wire LMS cleanup into the DB worker tick after existing
  entitlement/TV/JTI maintenance, expose `lmsMaterialsPurged` in `DbWorkerTickResult`, worker health detail, DB tick logs, and
  one-shot output.
- `tests/integration/db-lms-ph3-1.test.ts` and `tests/integration/worker-tortila-snapshot.test.ts` - cover cleanup selection,
  db-local/key-prefix scoping, summary audit no-leak shape, and worker tick reporting.
- Verified: focused LMS/worker Vitest PASS (`34` passed), `npm run worker:smoke` PASS, `node scripts/gates.mjs full` PASS
  (9/9), env-cleared `node scripts/gates.mjs e2e` PASS (`44` passed), and `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS
  on current generated roots. Actual `npm run e2e:lms:db` / `npm run e2e:lms:db:managed` NOT RUN because no valid
  throwaway/admin DB URL is available.

## 2026-06-02 Phase 3.23 additions (LMS DB browser managed runner - no migration, 42 tables)
- `scripts/run-lms-db-e2e-managed.mjs` - new optional wrapper for hosts without `psql`. It requires
  `LMS_E2E_ADMIN_DATABASE_URL`, refuses admin URLs that point at a throwaway DB, creates a generated `wtc_test_lms_*`
  database, runs the existing `npm run e2e:lms:db` harness with `LMS_E2E_DATABASE_URL` set internally, and drops the generated
  database in `finally` without logging URLs.
- Root `package.json` - adds `npm run e2e:lms:db:managed`.
- `tests/integration/lms-db-e2e-harness.test.ts` - static coverage for managed-runner wiring, throwaway naming, create/drop
  behavior, URL logging guards, and continued exclusion from default gates.
- `scripts/prepare-lms-db-e2e.ts` and `playwright.lms-db.config.ts` - the throwaway DB-name guard now accepts documented
  multi-segment LMS names such as `wtc_test_lms_<timestamp>` while still rejecting non-`wtc_test*` databases.
- `.env.example` - documents the manual `LMS_E2E_DATABASE_URL` and managed `LMS_E2E_ADMIN_DATABASE_URL` opt-in variables with
  throwaway-only warnings.
- Docs updated so far: `docs/DEPLOYMENT.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/STATUS.md`,
  `docs/NEXT_ACTIONS.md`, and `docs/IMPLEMENTED_FILES.md`.
- Verified: focused harness/scanner Vitest PASS (`15` passed), `node --check scripts/run-lms-db-e2e-managed.mjs` PASS,
  `node scripts/gates.mjs full` PASS (9/9), env-cleared `node scripts/gates.mjs e2e` PASS (`44` passed), and
  `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current generated roots. Actual `npm run e2e:lms:db` /
  `npm run e2e:lms:db:managed` NOT RUN because no valid throwaway/admin DB URL is available.

## 2026-06-02 Phase 3.22 additions (LMS material DTO boundary hardening - local projection split, no migration, 42 tables)
- `packages/lms/src/types.ts` - `MaterialView` is now the student-safe view and excludes `fileName`, `mimeType`,
  `contentSha256`, `storageProvider`, `quarantineReason`, `retainedUntil`, `deletedAt`, `storageKey`, and
  `fileBytesBase64`. Later Phase 3.27 made `TeacherMaterialView` filename-free as well.
- `apps/web/src/features/lms/queries.ts` - student lesson loading maps rows through the student-safe material projection;
  teacher course/material list loading maps rows through `toTeacherMaterialView()` and returns `TeacherMaterialView`.
- `apps/web/src/app/teacher/courses/[id]/page.tsx` and `apps/web/src/app/teacher/materials/page.tsx` - teacher material UI
  imports the teacher material DTO explicitly before reading filename/scan display fields.
- `tests/integration/lms-ph3-1-static.test.ts` - static guards now pin the student DTO shape, teacher-only filename/MIME
  projection, student-vs-teacher mapper usage, and summary-only admin audit projection.
- Docs updated: `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`,
  `docs/ACCEPTANCE_MATRIX_MASTER.md`, and `docs/PRODUCTION_BLOCKERS_CURRENT.md`.
- Verified: focused Vitest PASS (`66` passed), `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS,
  `node scripts/gates.mjs full` PASS (9/9), env-cleared `node scripts/gates.mjs e2e` PASS (`44` passed), and
  `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current generated roots. Final governance after the aggregate exists
  PASSed (0 errors / 1 known historical warning). `npm run e2e:lms:db` NOT RUN because no fresh throwaway DB URL was supplied.

## 2026-06-02 Phase 3.21 additions (LMS DB no-leak assertion hardening - local harness, no migration, 42 tables)
- `tests/e2e/lms-db-materials.spec.ts` - expanded opt-in DB browser assertions. Failed download responses now check body and
  headers for no uploaded bytes/base64, concrete filename/hash, internal material metadata, success-only headers, `set-cookie`,
  and non-JSON content type. Rendered/admin page checks now reject internal material metadata. Sanitized Vimeo iframe checks
  now pin `sandbox`, `referrerpolicy`, `loading`, `allow`, `allowFullscreen`, and absent `srcdoc`.
- `scripts/scan-lms-db-e2e-artifacts.mjs` - scanner denylist now includes internal material metadata markers
  (`contentSha256`, `storageProvider`, `db-local`, `retainedUntil`, `quarantineReason`, `deletedAt`, `hasStorageKey`) plus
  session-cookie names, JSON/lowercase cookie or authorization headers, and session-token-shaped cookie values.
- `tests/integration/lms-material-download-handler.test.ts` - failed handler paths now assert no file/body/hash/storage leak,
  no success-only headers, no `set-cookie`, JSON content type, no pre-auth DB lookup, and no failure audit.
- `tests/integration/lms-db-e2e-harness.test.ts` and `tests/integration/lms-db-e2e-artifact-scan.test.ts` - static/functional
  coverage for the expanded browser helper and scanner marker set.
- Verified: focused Vitest PASS (`61` passed), `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS,
  `node scripts/gates.mjs full` PASS (9/9), env-cleared `node scripts/gates.mjs e2e` PASS (`44` passed), and
  `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current generated roots. `npm run e2e:lms:db` NOT RUN because no
  fresh throwaway DB URL was supplied.

## 2026-06-02 Phase 3.20 additions (LMS DB e2e artifact no-leak scanner - local harness, no migration, 42 tables)
- `scripts/scan-lms-db-e2e-artifacts.mjs` - new generated-artifact scanner for the opt-in LMS DB browser run. It scans only
  generated artifact roots (`test-results`, `playwright-report`, `tests/e2e/screenshots`, and `logs/lms-db-e2e`), fails on
  LMS raw file-byte/base64/storage-key/raw-iframe markers and secret-shaped runtime values, skips screenshot image bytes,
  fails closed on compressed/container artifacts, and reports only file/category summaries without matched secret text.
- `scripts/run-lms-db-e2e.mjs` - now runs the scanner after any guarded Playwright attempt, including failed attempts, while
  preserving the Playwright failure status and still cleaning `.next-e2e-db/lms-db-e2e-prepared.json`.
- `tests/integration/lms-db-e2e-artifact-scan.test.ts` and `tests/integration/lms-db-e2e-harness.test.ts` - cover clean and
  leaking text artifacts, screenshot-image skip behavior, fail-closed trace/archive handling, no matched-value output, runner
  wiring, scanner markers, and continued exclusion from default gates.
- Docs updated: `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/DEPLOYMENT.md`,
  `docs/ACCEPTANCE_MATRIX_MASTER.md`, and `docs/PRODUCTION_BLOCKERS_CURRENT.md`.
- Verified: focused Vitest PASS (`60` passed), `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS,
  `node scripts/gates.mjs full` PASS (9/9), env-cleared `node scripts/gates.mjs e2e` PASS (`44` passed), and
  `node scripts/scan-lms-db-e2e-artifacts.mjs` PASS on current generated roots. `npm run e2e:lms:db` NOT RUN because no
  fresh throwaway DB URL was supplied.

## 2026-06-01 Phase 3.18 additions (LMS DB browser acceptance harness - local harness, no migration, 42 tables)
- `scripts/prepare-lms-db-e2e.ts`, `scripts/run-lms-db-e2e.mjs`, `playwright.lms-db.config.ts`, root `package.json`, and
  `apps/web/package.json` - add the opt-in `npm run e2e:lms:db` harness. It requires a fresh throwaway
  `LMS_E2E_DATABASE_URL` (`REAL_POSTGRES_DATABASE_URL` is reserved for the non-browser real-PG Vitest harness), refuses non-`wtc_test*` or non-empty DBs, applies committed migrations,
  seeds demo data, writes a prep marker, and runs a dedicated Playwright server on port 3101 with mock/off safety flags.
  Direct config invocation fails closed unless the prep marker matches the guarded URL; the runner cleans that prep marker after the run.
- `tests/e2e/lms-db-materials.spec.ts` - DB-backed browser flow creates teacher course/lesson/file material through the UI,
  adds a quarantined EICAR-signature text file and sanitized Vimeo embed, publishes it, verifies unauthenticated `401` and
  non-entitled `403` download denials, verifies quarantined no-download UI, checks sanitized iframe rendering, verifies the
  entitled student download response (`no-store`, MIME, disposition, `nosniff`, SHA-256, body), checks no rendered file
  bytes/base64/storage keys/raw embed leak, asserts malformed material IDs return no-store `400`, captures mobile layout
  artifacts when run, and verifies admin audit visibility.
- `apps/web/src/features/lms/actions.ts` and `tests/integration/lms-ph3-1-static.test.ts` - teacher file uploads now preflight
  `file.size > LMS_MAX_FILE_BYTES` before reading `arrayBuffer()`, keeping the package byte-size check as defense in depth.
- `apps/web/src/features/lms/material-download.ts` and `tests/integration/lms-material-download-handler.test.ts` - material
  downloads validate UUID syntax before DB lookup and return no-store `400` for malformed IDs.
- `packages/auth/src/security-headers.ts` and `packages/auth/src/security-headers.test.ts` - CSP now has explicit
  `frame-src` entries for the LMS sanitized embed allowlist while preserving `frame-ancestors 'none'`.
- `apps/web/src/app/api/e2e/login/route.ts` and `tests/integration/lms-db-e2e-harness.test.ts` - e2e login bypass remains
  non-production, opt-in, and now localhost-only.
- Verified: focused Vitest PASS (`54` passed), `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS,
  `node scripts/gates.mjs full` PASS (9/9), and env-cleared `node scripts/gates.mjs e2e` PASS (`44` passed).
  `npm run e2e:lms:db` NOT RUN because no fresh throwaway DB URL was supplied.

## 2026-06-01 Phase 3.17 additions (LMS storage scan retention metadata - REAL local, migration 0012, 42 tables)
- `packages/lms/src/materials.ts` and `packages/lms/src/materials.test.ts` - file preparation now adds deterministic
  `db-local` storage keys, 365-day retention timestamps, scan timestamps, and local signature quarantine for EICAR and
  executable-looking text uploads. Binary MIME sniffing rejects fake PDF/PNG/JPEG payloads before storage.
- `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`, and
  `packages/db/migrations/0012_old_maelstrom.sql` - `materials` now has `storage_provider`, `storage_key`,
  `scan_status`, `scan_checked_at`, `quarantine_reason`, `retained_until`, and `deleted_at`. Migration `0012` backfills
  existing file rows before adding scan/lifecycle checks; material deletes are soft deletes; list/download paths ignore
  deleted rows.
- `apps/web/src/features/lms/actions.ts`, `apps/web/src/features/lms/queries.ts`, and
  `apps/web/src/app/{teacher/materials,teacher/courses/[id],(app)/app/education/[courseId]/[lessonId]}/page.tsx` -
  teacher uploads persist prepared scan/storage metadata, file download URLs are exposed only for clean files, and
  teacher/student surfaces show scan state without exposing storage keys.
- Tests updated/added: `packages/lms/src/materials.test.ts`, `tests/integration/db-lms-ph3-1.test.ts`,
  `tests/integration/lms-material-download-handler.test.ts`, and `tests/integration/lms-ph3-1-static.test.ts`.
- Verified: focused Vitest PASS (`55` passed), `npm run typecheck` PASS, `npm run typecheck -w @wtc/web` PASS,
  `node scripts/gates.mjs full` PASS (9/9), env-cleared `node scripts/gates.mjs e2e` PASS (`44` passed), and
  final governance PASS (0 errors / 1 known historical warning).

## 2026-06-01 Phase 3.16 additions (worker local smoke + heartbeat monitoring - REAL local; no migration)
- `scripts/safe-worker-tick.mjs` and root `worker:smoke` / `worker:tick` scripts - safe one-shot worker smoke command. It
  forces `APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, and live-control/TV-automation flags off, then runs the DB tick when
  `DATABASE_URL` is set or memory-demo tick otherwise.
- `apps/worker/src/index.ts` and `apps/worker/src/tick-once.ts` - worker heartbeat rows now include adapter mode and safety
  flags; unsafe flags mark the `worker` heartbeat `misconfigured`; core tick failures attempt a redacted `worker` error row
  before rethrowing, and long-running intervals catch/log tick failures.
- `apps/web/src/features/admin/health-detail.ts`, `apps/web/src/features/admin/{queries.ts,types.ts}`, and
  `apps/web/src/app/admin/system-health/page.tsx` - admin system health shows latest worker heartbeat, projects/redacts
  health-check details before rendering, and lists newest integration checks first.
- `packages/config/src/env.ts`, `packages/config/src/env.test.ts`, and `.env.example` - canonical `TORTILA_JOURNAL_URL` and
  optional worker bot binding vars are part of the typed/template env surface.
- Tests updated/added: `tests/integration/admin-health-detail.test.ts`, `tests/integration/worker-health-mapping.test.ts`,
  `tests/integration/worker-tortila-snapshot.test.ts`, and `tests/integration/db-seed-preview-hardening.test.ts`.
- Verified: focused Vitest PASS (`36` passed), `npm run worker:smoke` PASS, `npm run typecheck` PASS,
  `npm run typecheck -w @wtc/web` PASS, `node scripts/gates.mjs full` PASS (9/9), and env-cleared
  `node scripts/gates.mjs e2e` PASS (`44` passed); final governance PASS (0 errors / 1 known historical warning).

## 2026-06-01 Phase 3.15 additions (LMS local file/embed storage - REAL local, migration 0011, 42 tables)
- `packages/lms/src/materials.ts` and `packages/lms/src/materials.test.ts` - pure LMS upload/embed primitives: 5 MB
  PDF/PNG/JPEG/TXT file policy, filename normalization, SHA-256/base64 byte normalization, allowlisted YouTube/Vimeo iframe
  sanitizer, canonical sanitized HTML detection, and malicious-input tests.
- `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`, and
  `packages/db/migrations/0011_late_madelyne_pryor.sql` - adds `lessons.embed_html`, nullable material URL semantics,
  local DB-backed file byte fields, material embed HTML, lesson/material payload checks, and a material kind index.
- `apps/web/src/features/lms/actions.ts`, `apps/web/src/features/lms/queries.ts`,
  `apps/web/src/features/lms/material-download.ts`, and
  `apps/web/src/app/api/education/materials/[materialId]/download/route.ts` - teacher write paths now sanitize embeds and
  normalize file bytes; student file downloads are session/entitlement/published-content gated, strict-headered, and audited.
- `apps/web/src/app/teacher/courses/[id]/page.tsx`, `apps/web/src/app/teacher/materials/page.tsx`, and
  `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx` - surfaces link/file/embed materials, sanitized embed
  lessons, and file downloads without `dangerouslySetInnerHTML`.
- Tests updated/added: `tests/integration/db-lms-ph3-1.test.ts`,
  `tests/integration/lms-material-download-handler.test.ts`, and `tests/integration/lms-ph3-1-static.test.ts`.
- Verified: focused Vitest PASS (`49` passed), `npm run typecheck` PASS,
  `npm run typecheck -w @wtc/web` PASS, `npm run db:generate -w @wtc/db` PASS (`42` tables, no schema changes),
  `node scripts/gates.mjs full` PASS (9/9), env-cleared `node scripts/gates.mjs e2e` PASS (`44` passed), and final
  governance PASS (0 errors / 1 known historical warning).

## 2026-06-01 Phase 3.14 additions (Axioma account-link route handlers - REAL local, gate-verified; no migration, 42 tables)
- `apps/web/src/features/terminal/axioma-account-link.ts` - new framework-neutral handlers for account-link init, service
  completion, and unlink. Init is POST-only with CSRF-before-user, session auth, entitlement, shared Axioma readiness,
  already-linked guard, five-minute raw OTC disclosure, SHA-256 `link_nonce_hash` persistence, and no-store responses. Complete
  is POST-only, bearer-authenticated with `AXIOMA_BRIDGE_API_TOKEN`, JSON-body only, rejects all query strings, accepts
  `axiomaUserId`/`axioma_user_id`, re-checks current entitlement for the pending row owner, consumes once, and redacts raw
  OTC/hash from audit/responses. DELETE is CSRF/session/entitlement/readiness gated and revokes pending/linked rows.
- `apps/web/src/app/api/axioma/account-link/init/route.ts`,
  `apps/web/src/app/api/axioma/account-link/complete/route.ts`, and
  `apps/web/src/app/api/axioma/account-link/route.ts` - thin Next adapters for `POST /init`, `POST /complete`, and `DELETE`
  that inject DB/env/session/CSRF/access dependencies into the extracted handlers.
- `packages/db/src/repositories.ts` - adds `getAxiomaAccountLinkByNonceHash()`,
  `recordAxiomaAccountLinkCompleteFailureWithAudit()`, and `revokeAxiomaAccountLinksForUserWithAudit()` so completion can
  fail closed on current entitlement loss and unlink can audit revokes in the data layer.
- `tests/integration/axioma-account-link-handler.test.ts` - PGlite route-handler acceptance for method gates, CSRF ordering,
  auth/access/config failures, hash-only issue, prior pending revoke, service bearer auth, no-query completion, JSON schema,
  current-entitlement re-check, once-only consume, expired/revoked/duplicate mappings, unlink/revoke audit, and redaction.
- `tests/integration/axioma-skeleton-static.test.ts` - static guards extended for account-link route adapter wiring, service
  bearer boundary, no direct live fetch, no query-token completion, no `oneTimeCode` writes, and disabled terminal CTAs.
- Docs updated: `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`,
  `docs/CONTRACTS/axioma-bridge.md`, `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`, and
  `docs/PRODUCTION_BLOCKERS_CURRENT.md`.
- Verified: focused Vitest PASS (`52` passed / `1` skipped), `npm run typecheck` PASS,
  `npm run typecheck -w @wtc/web` PASS, `npm run db:generate -w @wtc/db` PASS (`42` tables, no schema changes),
  `node scripts/gates.mjs full` PASS (9/9), env-cleared `node scripts/gates.mjs e2e` PASS (`44` passed), and final
  governance PASS.

## 2026-06-01 Phase 3.13 additions (Axioma account-link hash/uniqueness persistence - REAL local, gate-verified; migration 0010, 42 tables)
- `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`, and
  `packages/db/migrations/0010_axioma_account_link_hash.sql` - `axioma_account_links` now has hash-only account-link OTC
  fields (`link_nonce_hash`, consume/revoke/link/verify timestamps, `updated_at`, error metadata), partial unique indexes for
  active WTC-user and Axioma-user mappings, and a unique hash index. Migration `0010` clears legacy plaintext
  `one_time_code` values and revokes pending legacy rows.
- `packages/db/src/repositories.ts` - adds account-link primitives:
  `issueAxiomaAccountLinkNonceWithAudit()`, `consumeAxiomaAccountLinkNonceWithAudit()`, and
  `getLinkedAxiomaAccountForUser()`. Issuance requires a canonical SHA-256 hex hash, revokes previous pending nonces for the
  user, never writes raw OTC, and writes redacted audit rows. Consume is single-use and rejects replay, expiry, revoked rows,
  invalid Axioma user ids, existing active user links, and existing active Axioma-user links.
- `apps/web/src/features/terminal/axioma-journal-handoff.ts` - Open Journal linked-account lookup now uses the repository
  helper so it observes the same non-revoked active-link definition as account-link consume.
- `tests/integration/db-axioma-account-link.test.ts` - PGlite migration/repository acceptance for migration shape, legacy
  plaintext clearing, hash-only issuance, canonical hash validation, first consume, replay/expired/revoked/invalid failures,
  active-link uniqueness, deterministic linked reads, and audit redaction.
- `tests/integration/axioma-skeleton-static.test.ts` - static guards updated for hash-only account-link persistence,
  repository helper usage, and disabled terminal CTAs.
- Docs updated: `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`,
  `docs/CONTRACTS/axioma-bridge.md`, `docs/DATA_MODEL.md`, `docs/AUDIT_LOG_SCHEMA.md`, and
  `docs/PRODUCTION_BLOCKERS_CURRENT.md`.
- Verified: focused Vitest PASS (`20` passed), `npm run typecheck` PASS,
  `npm run typecheck -w @wtc/web` PASS, and `npm run db:generate -w @wtc/db` PASS (`42` tables, no schema changes).
  `node scripts/gates.mjs full` PASS (9/9; full Vitest `67` files, `657` passed / `8` skipped), env-cleared
  `node scripts/gates.mjs e2e` PASS (`44` passed), and final governance PASS.

## 2026-06-01 Phase 3.12 additions (Axioma download token/proxy local acceptance - REAL local, gate-verified; migration 0009, 42 tables)
- `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`, and
  `packages/db/migrations/0009_wide_orphan.sql` - `terminal_download_events` now carries the local one-time download token
  lifecycle: `token_hash`, `expires_at`, `consumed_at`, `revoked_at`, `axioma_user_id`, a unique token-hash index, and an
  expiry index. Repository helpers issue hash-only tokens and consume them with an atomic conditional update plus audit writes.
- `apps/web/src/features/terminal/axioma-download.ts` - new framework-neutral Request handler for Axioma downloads. It enforces
  CSRF-before-auth on token issuance, session auth, entitlement fail-closed, route readiness, current release lookup, HTTPS
  release URL templates, hash-only token storage, replay/expiry/wrong-user rejection, no-store responses, strict download
  headers, and injected installer streaming only.
- `apps/web/src/app/api/axioma/download/route.ts` and
  `apps/web/src/app/api/axioma/download/terminal/route.ts` - thin Next adapters. The runtime adapter has no live installer
  fetcher yet, so proxy GET returns fail-closed `501` without consuming tokens until a future live provider is deliberately
  wired.
- `tests/integration/axioma-download-handler.test.ts` - PGlite route-handler acceptance for CSRF ordering, auth/access/config
  failures, token issue response shape, hash-only persistence, mocked fixture streaming, strict headers, forbidden upstream
  header stripping, token replay, and entitlement-denied no-consume behavior.
- `tests/integration/db-axioma-download-token.test.ts` - PGlite repository tests for hash-only issue, first consume, replay,
  expiry, wrong-user rejection, and token/audit redaction.
- `tests/integration/axioma-skeleton-static.test.ts` - static guards updated for the extracted download handler, terminal proxy
  route, injected fetcher boundary, fail-closed `bridge_not_implemented`, no direct live fetch, and token lifecycle schema.
- Docs updated: `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`,
  `docs/CONTRACTS/axioma-bridge.md`, `docs/DATA_MODEL.md`, `docs/AUDIT_LOG_SCHEMA.md`, and
  `docs/PRODUCTION_BLOCKERS_CURRENT.md`.
- Verified: focused Vitest PASS (`35` passed / `1` skipped), `npm run typecheck` PASS,
  `npm run typecheck -w @wtc/web` PASS, `npm run db:generate -w @wtc/db` PASS (`42` tables, no schema changes),
  `node scripts/gates.mjs full` PASS (9/9; full Vitest `66` files, `649` passed / `8` skipped), env-cleared
  `node scripts/gates.mjs e2e` PASS (`44` passed), and final governance PASS.

## 2026-06-01 Phase 3.11 additions (journal handoff route acceptance - REAL local, gate-verified; NO migration, 42 tables)
- `apps/web/src/features/terminal/axioma-journal-handoff.ts` - new framework-neutral Request handler for
  `POST /api/axioma/journal-handoff`. It enforces POST-only, CSRF-before-auth, session auth, entitlement fail-closed,
  route readiness, linked Axioma account presence, POST-body handoff output, no-store responses, and no token-bearing URL.
- `apps/web/src/app/api/axioma/journal-handoff/route.ts` - now a thin Next adapter that wires real DB/session/CSRF/access/env
  dependencies into the extracted handler. `GET` remains 405/no-store.
- `apps/web/src/features/terminal/axioma-route-core.ts` and `apps/web/src/features/terminal/axioma-routes.ts` - shared
  Axioma readiness/signing/handoff helpers are importable from tests without `server-only`; the server-only facade remains for
  runtime code.
- `packages/db/src/repositories.ts` - adds `issueHandoffJtiWithAudit()`, which inserts the handoff JTI replay row and
  `axioma.account_link_init` audit row in one DB transaction.
- `tests/integration/axioma-journal-handoff-handler.test.ts` - PGlite + generated P-256 route-level acceptance for method/CSRF,
  unauthenticated/denied/unconfigured failures, invalid key failure, linked-account success, no-link `409`, grace snapshot
  semantics, token/JTI/audit consistency, and rollback/no orphan JTI on audit failure.
- `tests/integration/axioma-skeleton-static.test.ts` - static guards updated for the extracted handler, account-link-required
  behavior, atomic issuance helper, no redirect, no `?token=`, and no live fetch boundary.
- Docs updated: `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`,
  `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`, `docs/CONTRACTS/axioma-bridge.md`, and `docs/PRODUCTION_BLOCKERS_CURRENT.md`.
- Verified: focused Vitest PASS (`29` passed / `1` skipped), `node scripts/gates.mjs full` PASS (9/9), env-cleared
  Playwright e2e PASS (`44` passed / `6` skipped), `npm run db:generate -w @wtc/db` PASS (`42` tables, no schema changes),
  and final governance PASS.

## 2026-06-01 Phase 3.10 additions (local B4 consume + TV task uniqueness - REAL local, gate-verified; migration 0008, 42 tables)
- `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`, and
  `packages/db/migrations/0008_eminent_tattoo.sql` - `tradingview_access_tasks` now has a unique logical identity
  on `(request_id, kind)`. The migration dedupes historical rows before creating `tvat_request_kind_idx`, preserving an
  unfinished task first; `atomicRevokeTv(... queueExternalRevokeTask)` and `repairMissingTvRevokeTasks()` both use
  `onConflictDoNothing` and count only newly inserted task rows.
- `apps/web/src/features/terminal/axioma-jti-consume.ts` and
  `apps/web/src/app/api/axioma/jti/consume/route.ts` - local fail-closed WTC-side Option A consume route for
  Axioma handoff JTIs. It requires POST, DB, `AXIOMA_ROUTE_SKELETON_ENABLED=true`, a trimmed non-empty
  `AXIOMA_BRIDGE_API_TOKEN`, bearer auth, UUID body validation, and writes `axioma.handoff_jti_consume` /
  `axioma.handoff_jti_replay` audit events. It does not call live Axioma and returns no-store responses.
- `apps/web/src/features/terminal/axioma-routes.ts` - route readiness now treats whitespace bridge tokens as missing.
- `packages/axioma-bridge/src/es256.ts` - stale source comment corrected: durable JTI persistence lives in `@wtc/db`;
  this pure package verifies/signs tokens while routes own replay checks and audit writes.
- Tests updated: `tests/integration/tv-access-hardening.test.ts`,
  `tests/integration/axioma-jti-consume-handler.test.ts`, and `tests/integration/axioma-skeleton-static.test.ts`.
- Docs updated: `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`, `docs/CONTRACTS/axioma-bridge.md`,
  `docs/CONTRACTS/tradingview-access.md`, `docs/TRADINGVIEW_ACCESS_PLAN.md`, `docs/INTEGRATION_MAP.md`,
  `docs/AUDIT_LOG_SCHEMA.md`, `docs/OPEN_QUESTIONS.md`, and `docs/ARCHITECTURE.md`.
- Verified: targeted Vitest PASS (`38` passed / `1` skipped), `node scripts/gates.mjs full` PASS (9/9), env-cleared
  Playwright e2e rerun PASS (`44` passed / `6` skipped) after one transient `ECONNRESET` in the first e2e run, and
  `npm run db:generate -w @wtc/db` PASS (`42` tables, no schema changes).

## 2026-06-01 Phase 3.9 additions (route harness + repair/config readiness - REAL, gate-verified; NO migration)
- `apps/web/src/features/billing/webhook-handler.ts` and `apps/web/src/app/api/billing/webhook/route.ts` - Stripe webhook
  orchestration is extracted behind explicit DB/env/clock injection; the Next route is now a thin adapter.
- `tests/integration/billing-webhook-route-handler.test.ts` and `tests/integration/billing-webhook-hardening.test.ts` - signed
  Request harness covers missing/bad signatures, valid apply, terminal duplicate 200, fresh processing duplicate 500, stale
  processing cleanup, missing user manual review, and unknown-plan manual review.
- `packages/db/src/repositories.ts`, `apps/worker/src/index.ts`, `apps/worker/src/tick-once.ts`, and
  `tests/integration/tv-access-hardening.test.ts` - `repairMissingTvRevokeTasks()` repairs historical worker-expiry revokes
  that lack manual external revoke tasks, is idempotent, excludes manual revokes, and is reported by worker health/log output.
- `packages/config/src/env.ts` and `packages/config/src/env.test.ts` - production no longer requires the unused HS256
  `AXIOMA_HANDOFF_SIGNING_SECRET`; the Axioma bridge token plus ES256 key/kid are required only when
  `AXIOMA_ROUTE_SKELETON_ENABLED=true` in `APP_ENV=staging|production`, and weak optional HS256 values are still rejected
  in production.
- `apps/web/src/features/terminal/axioma-jwks-readiness.ts`,
  `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`, `apps/web/src/features/terminal/loader.ts`,
  `tests/integration/axioma-jwks-readiness.test.ts`, and `tests/integration/axioma-skeleton-static.test.ts` - one JWKS
  readiness helper now covers missing key, missing kid, invalid key, valid public JWKS, no-store 503, and cacheable 200.
- `apps/web/src/features/terminal/axioma-routes.ts`, `apps/web/src/app/api/axioma/journal-handoff/route.ts`, and
  `tests/integration/axioma-handoff-snapshot.test.ts` - Axioma handoff issuance now passes the real entitlement snapshot and
  linked Axioma user id into signed claims when present; CTAs remain disabled.
- Verified: targeted sweeps PASS, `node scripts/gates.mjs full` PASS, and `npm run e2e` PASS (`44 passed / 6 skipped`).

## 2026-06-01 Phase 3.8 additions (integration safety + bridge honesty - REAL, gate-verified; NO migration)
- `apps/web/src/app/api/billing/webhook/route.ts`, `packages/db/src/repositories.ts`, and
  `packages/db/src/schema.ts` - webhook ledger processing is now non-terminal first (`processing`), with status-aware
  duplicate handling that only acknowledges terminal rows as successful.
- `packages/db/src/repositories.ts` and `tests/integration/tv-access-hardening.test.ts` - TradingView expiry sweeps queue
  the external manual revoke task inside the same `atomicRevokeTv` transaction.
- `packages/axioma-bridge/src/{handoff,es256,bridge,index}.ts` plus package tests - Axioma handoff output is POST-body,
  not query-token; JWT headers use `typ: JWT`; claims use Unix-second times, `nbf`, `wtc_flow`, `wtc_entitlement`,
  `wtc_axioma_user_id`, and a 32-byte nonce.
- `apps/web/src/features/terminal/{axioma-routes,loader}.ts`, `apps/web/src/app/(app)/app/terminal/page.tsx`,
  `tests/integration/axioma-skeleton-static.test.ts`, `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`, and
  `docs/CONTRACTS/axioma-bridge.md` - terminal bridge readiness stays fail-closed; CTAs require an explicit implementation
  gate and JWKS readiness requires key plus key id.
- `apps/web/src/features/admin/{types,queries}.ts`, `apps/web/src/app/admin/bots/page.tsx`,
  `apps/web/src/features/bots/journal.ts`, and `tests/integration/bot-read-safety-static.test.ts` - admin bot health
  preserves `tortila-journal/not_configured` as setup-needed, and bot journal checks DB imports before adapter fallback.
- Verified: targeted sweep PASS (`13` files, `90` tests passed, `1` skipped), `node scripts/gates.mjs full` PASS, and
  `npm run e2e` PASS (`44 passed / 6 skipped`).

## 2026-06-01 continuation additions (bot trade journal + config export - REAL, gate-verified; migration 0007, 42 tables)
- `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`, and
  `packages/db/migrations/0007_romantic_mulholland_black.sql` - new `bot_trade_reviews` table and audited upsert repo for
  WTC-owned trade reviews. Imported facts in `bot_trade_imports` remain immutable; review status, tags, setup/mistake notes,
  R-multiple, MAE, and MFE live in the editable overlay.
- `apps/web/src/features/bots/journal.ts` and `apps/web/src/app/(app)/app/bots/[bot]/journal/page.tsx` - DB-first bot
  journal page with adapter fallback, per-trade review forms, and honest demo/Postgres storage states.
- `apps/web/src/components/BotSubNav.tsx` - Journal tab added to the bot section navigation.
- `apps/web/src/features/bots/config.ts` and `apps/web/src/app/api/bots/[bot]/config-export/route.ts` - safe config export:
  Tortila `.env`/`SYMBOL_CONFIGS` and Legacy reference JSON, gated by session + entitlement and containing no exchange keys.
- `apps/web/src/app/(app)/app/bots/[bot]/{settings,backtester}/page.tsx` - download links for config export surfaced where users
  configure bots and download the local backtester runner.
- Tests updated: `tests/integration/bot-journal-review.test.ts`, `tests/integration/bot-config-export-static.test.ts`,
  `tests/integration/bot-statistics-static.test.ts`, `tests/e2e/smoke.spec.ts`, and
  `tests/e2e/backtester-pg10-mobile.spec.ts`.
- Verified: `node scripts/gates.mjs full` PASS; `npm run e2e` PASS (`44 passed / 6 skipped`).

## 2026-06-01 continuation additions (statistics + TV task ops + Axioma JWKS - REAL, gate-verified; NO migration, 41 tables)
- `apps/web/src/features/bots/statistics-panels.tsx` plus
  `apps/web/src/app/(app)/app/bots/statistics/page.tsx` - journal-grade statistics panels for drawdown profile, open risk,
  monthly returns, symbol performance, exit reasons, and activity feed. Legacy still shows honest unavailable states where it
  has no equity/trade history.
- `packages/bot-adapters/src/mock-tortila.ts` - richer mock closed trades with exit reasons/hold hours so the journal panels
  can be visually reviewed without live data.
- `packages/db/src/repositories.ts`, `apps/web/src/features/tv/{queries,actions}.ts`, and
  `apps/web/src/app/admin/tradingview-access/page.tsx` - manual TradingView external task list and mark-done action over
  `tradingview_access_tasks`, audited as `tv_access.task_done`. No automation adapter is enabled.
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` - public fail-closed JWKS endpoint; emits only public ES256 JWKs
  when `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` are configured.
- Tests updated: `tests/integration/bot-statistics-static.test.ts`, `tests/integration/tv-access-hardening.test.ts`,
  `tests/integration/axioma-skeleton-static.test.ts`, and `tests/e2e/smoke.spec.ts`.
- Verified: `node scripts/gates.mjs full` PASS; `npm run e2e` PASS (`44 passed / 6 skipped`).

## 2026-06-01 worker durable journal additions (REAL, gate-verified; NO migration, 41 tables)
- `packages/analytics/src/metrics.ts` and `packages/bot-adapters/src/tortila/tortila.mapping.ts` - canonical Tortila closed
  trades now preserve source `entryPrice` and `exitPrice`, allowing durable trade imports without losing the bot journal fields.
- `apps/worker/src/jobs.ts` - `snapshotTortilaJournal()` now reads positions and trades in addition to metrics, writes
  `bot_position_snapshots`, and imports closed trades into `bot_trade_imports` idempotently. It remains read-only, never calls
  `/api/marks`, and treats adapter data failures as non-fatal health/snapshot issues.
- `tests/integration/worker-tortila-snapshot.test.ts` - PGlite integration coverage proving snapshots are written and duplicate
  trade imports are not created on repeated worker ticks.
- Verified: targeted typecheck/tests PASS and `node scripts/gates.mjs full` PASS.

## Phase 3.6 additions (Strict e2e + IP-safe preview + admin terminal room - REAL, gate-verified; NO migration, 41 tables)
- `apps/web/src/app/api/e2e/login/route.ts` - guarded e2e-only login endpoint, enabled only by `E2E_AUTH_BYPASS=1` outside
  production; sets the normal session cookie through the normal auth/session path.
- `tests/e2e/helpers/auth.ts` plus updated e2e specs - shared `loginUser`/`loginAdmin`/`loginTeacher` helpers replace direct
  Server Action login posts that caused the previous dev-server flake.
- `playwright.config.ts` and `apps/web/next.config.ts` - Playwright retries are `0`; the e2e server uses isolated
  `NEXT_DIST_DIR=.next-e2e` and explicitly enables only the non-production auth bypass.
- `eslint.config.js` - ignores `.next-e2e` so generated Playwright/Next output cannot break lint after an e2e run.
- `scripts/gates.mjs` - e2e gate fails on any nonzero flaky count instead of accepting retry-green runs.
- `scripts/safe-preview.mjs` and `tests/integration/db-seed-preview-hardening.test.ts` - safe preview starts Next directly
  through `node` with `shell:false` and binds `--hostname 0.0.0.0 --port 3000` for local-IP visual review.
- `apps/web/src/app/admin/terminal/page.tsx` - admin terminal release metadata/history room with CSRF-protected publish/update;
  demo mode is read-only/disabled. No installer bytes, no real Axioma endpoint calls, no local execution gating.
- `packages/db/src/repositories.ts` - terminal release publish now accepts an actor for in-transaction audit, updates all release
  metadata fields on conflict, and exposes release listing.
- `apps/web/src/lib/nav.ts` - admin navigation includes Terminal and no longer marks Products as soon.
- Tests updated: `tests/integration/admin-responsive.test.ts`, `tests/e2e/admin-mobile-pg8.spec.ts`, plus strict e2e helper
  migration across the existing smoke/mobile specs. Aggregate:
  `docs/handoffs/20260531-1600-phase-3-6-strict-e2e-ip-preview-admin-terminal.md`.

_Verified against the repo with `rg --files` / `find` on 2026-05-29 (Phase 1)._ This doc exists so the
contracts in `docs/CONTRACTS/` are not read as "already built". Where a contract describes endpoints or
files that do not exist yet, treat the contract as the **target**, not current code.

## Phase 3.5 additions (Integration hardening + safe preview readiness - REAL, gate-verified; NO migration, 41 tables)
- `packages/db/src/seed.ts` - seed is idempotent for repeated deploy/preview runs; existing demo users are resolved by email
  and the seeded teacher course is not duplicated.
- `scripts/safe-preview.mjs` + `package.json` - `npm run preview:safe` starts the local browser preview with deployment-unsafe
  features forced off (`APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, live bot control off, TV automation off).
- `apps/web/src/app/api/billing/webhook/route.ts` - missing user and missing/unknown plan metadata now create durable manual
  review items and admin notifications; manual-review creation failure removes the webhook ledger row and returns 500 for retry.
- `apps/web/src/features/terminal/axioma-routes.ts`, `apps/web/src/features/terminal/loader.ts`,
  `apps/web/src/app/api/axioma/download/route.ts`, `apps/web/src/app/api/axioma/journal-handoff/route.ts`,
  `apps/web/src/app/(app)/app/terminal/page.tsx`, `.env.example` - fail-closed Axioma route-readiness skeletons for download
  and journal handoff; CTAs stay disabled until entitlement, DB, route flag, bridge token, ES256 key/key id, and valid URL are configured.
- `apps/web/src/features/bots/data.tsx` and `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx` - bot safety views degrade
  blocked/not-ready adapters into warnings instead of route crashes.
- `apps/web/src/features/admin/queries.ts`, `apps/web/src/features/admin/types.ts`,
  `apps/web/src/app/admin/products/page.tsx` - `/admin/products` is now a real read-only product/admin overview over registry,
  seeded catalog, plan coverage, and entitlement counts when a DB is available.
- Tests: `tests/integration/db-seed-preview-hardening.test.ts`, `tests/integration/billing-webhook-hardening.test.ts`,
  `tests/integration/axioma-skeleton-static.test.ts`, `tests/integration/bot-read-safety-static.test.ts`,
  `tests/integration/admin-responsive.test.ts`. Aggregate:
  `docs/handoffs/20260531-1500-phase-3-5-integration-hardening.md`.

## Phase 3.4 additions (Stripe test checkout + pending-payment chain - REAL test-mode, gate-verified; NO migration, 41 tables)
- `packages/billing/src/provider.ts` - `CheckoutInput` shape, `checkoutAvailability()` true branch gated by Stripe provider,
  test secret, webhook secret, and `STRIPE_PRICE_MAP`.
- `packages/billing/src/stripe.ts` - real Stripe Checkout Session REST call; sends WTC `userId`, `planCode`,
  `client_reference_id`, and subscription/payment metadata; no fake sessions.
- `packages/billing/src/index.ts` - exports the checkout input/mode types.
- `packages/audit/src/audit.ts` - adds `billing.checkout_created`.
- `packages/db/src/repositories.ts` - `createPendingPaymentForPlan()` writes pending-payment entitlements, audit, and
  product-access events in one transaction; does not downgrade active/manual grants.
- `apps/web/src/features/billing/checkout.ts` - server-only Stripe price-map parsing, plan mode/source helpers, configured
  checkout CTA, and checkout session creation wrapper.
- `apps/web/src/features/billing/plans.ts` - optional display price labels without exposing raw Stripe price IDs.
- `apps/web/src/app/(app)/app/billing/page.tsx` - Start checkout section and CSRF-protected server action; redirects only after
  Stripe session creation and pending-payment write.
- `.env.example` - documents `STRIPE_PRICE_MAP`.
- Tests: `packages/billing/src/provider.test.ts`, `packages/billing/src/stripe.test.ts`,
  `tests/integration/billing-checkout-phase34.test.ts`, updated `tests/e2e/smoke.spec.ts`. Aggregate:
  `docs/handoffs/20260531-1426-phase-3-4-stripe-test-checkout.md`.

## Phase 3.3 additions (Bot rooms + education rooms - REAL, gate-verified; NO migration, 41 tables)
- `apps/web/src/features/bots/config.ts` - product-specific Tortila and Legacy schemas/defaults/fields plus reference profiles;
  demo-only config persistence via `globalThis.__WTC_DEMO_BOT_CONFIGS__`.
- `apps/web/src/app/(app)/app/bots/page.tsx` - entitlement-first bot list; read adapters are called only when access is allowed,
  so locked users do not see adapter health/process metadata.
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` - WTC config summary (mode/storage/live-apply-disabled) added to bot detail.
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` and `setup/page.tsx` - reference profile apply actions and
  manual/auto WTC-side intent.
- `apps/web/src/features/lms/actions.ts` - teacher profile save action, teacher/course pinned-link create/delete actions, all
  CSRF-first and `https://`-only at the schema boundary.
- `apps/web/src/features/lms/queries.ts` - teacher profile/pinned-link/material loaders and student catalogue community links;
  demo teacher workspace maps the seeded in-memory course for browser preview.
- `apps/web/src/app/teacher/layout.tsx` + `apps/web/src/lib/nav.ts` - teacher room uses the canonical teacher navigation,
  including Materials and Community.
- `apps/web/src/app/teacher/page.tsx` - teacher overview with profile, metrics, and seeded demo course visibility.
- `apps/web/src/app/teacher/materials/page.tsx` - real material list and delete flow; no file byte upload.
- `apps/web/src/app/teacher/community/page.tsx` - teacher profile/social-link editor and teacher-profile pinned-link manager.
- `apps/web/src/app/teacher/courses/[id]/page.tsx` - course pinned-link manager plus per-lesson material listing/deletion.
- `apps/web/src/app/(app)/app/education/page.tsx` - student community card now uses `loadStudentCatalogue` teacher profiles and
  pinned links; hardcoded Telegram/Instagram/Private Club "soon" links removed.
- Tests: `tests/integration/lms-community-static.test.ts` (new), updated `tests/integration/lms-rbac-pipeline.test.ts`, updated
  `tests/integration/bot-read-safety-static.test.ts`. Aggregate:
  `docs/handoffs/20260531-1310-phase-3-3-bot-education-rooms.md`.

## Phase 3.2 additions (Backtester local-runner MVP + bot product surfaces + product directory - REAL, gate-verified; NO migration, 41 tables)
- `packages/backtester/src/derive.ts` - `BACKTESTER_RUNNER_DISTRIBUTED=true`; release metadata for
  `wtc-backtester-0.1.0.zip`; `deriveBacktesterView` returns an entitled Tortila `runner_available` view; Legacy remains a
  permanent boundary; no server result payload.
- `packages/backtester/runners/wtc-backtester-0.1.0.zip` + `packages/backtester/runner-src/wtc-backtester-0.1.0/*` - local
  Python runner package (CSV input, simple Turtle-like research engine, local JSON output, no exchange-key handling).
- `apps/web/src/app/api/bots/[bot]/backtest/runner-download/route.ts` - entitlement-gated ZIP download route (Tortila only).
- `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` - download-only Tortila page with version/Python/size/checksum
  and local workflow; Legacy still locked.
- `apps/web/src/features/bots/config.ts` - product-specific config schemas/defaults/fields for Tortila and Legacy; manual
  operation is the default.
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx` -
  product-specific forms; Legacy live setup blocked while B3 is open.
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` and `positions/page.tsx` - Tortila real-read unavailable mark/uPnL renders
  `N/A`, not `0`.
- `apps/web/src/app/(app)/app/products/page.tsx` - real entitlement-aware product directory over `loadCabinet()` instead of a
  placeholder.
- Tests: `packages/backtester/src/runner-release.test.ts`, updated `packages/backtester/src/derive.test.ts`,
  `tests/integration/backtester-pg10.test.ts`, `tests/integration/bot-read-safety-static.test.ts`,
  `tests/integration/product-directory-static.test.ts`, updated PG9/PG10 mobile e2e specs. Aggregate:
  `docs/handoffs/20260531-1220-phase-3-2-backtester-product-surfaces.md`.

## 2026-06-01 continuation additions (server Postgres preview + Tortila per-coin settings)
- `apps/web/src/features/bots/config.ts` - Tortila per-symbol config schema, presets, `SYMBOL_CONFIGS` serializer, and portfolio/safety reference fields.
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx` - per-coin Tortila editor used by setup/settings; mobile-safe generated `SYMBOL_CONFIGS` display.
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` and `setup/page.tsx` - render the per-coin editor for Tortila while keeping Legacy reference config blocked from live adapter use.
- `packages/db/migrations/0006_minor_slipstream.sql` + schema/meta - fixes real-Postgres FK behavior for `product_access_events` (`ON DELETE CASCADE` for owner/entitlement, `SET NULL` for actor).
- Server preview: `<preview-db-name>` DB created, migrations through `0006` applied, seed succeeded, `wtc-ecosystem-preview` runs with `DATABASE_URL` set and safe flags still off for live control/TV automation.

## Phase 3.1 additions (LMS rich — first bounded slice; migration 0005, 4 additive columns — REAL, gate-verified; 41 tables)
- `packages/db/src/schema.ts` — `courses` += `level` (text NOT NULL default 'beginner') + `tags` (text[] NOT NULL default
  `'{}'`) with a `courses_level_check` CHECK; `lessons` += `content_type` (text NOT NULL default 'video') + `external_url`
  (text) with a `lessons_content_type_check` CHECK (video|embed|article|link). `check` added to the `drizzle-orm/pg-core` import.
- `packages/db/migrations/0005_noisy_supreme_intelligence.sql` (**new**) — drizzle-generated ADD COLUMN + ADD CONSTRAINT, with a
  **hand-appended** `UPDATE "lessons" SET content_type='article' WHERE video_url IS NULL` backfill (drizzle-kit can't emit UPDATE).
- `packages/db/src/repositories.ts` — `CourseDTO` += `level`/`tags`; `LessonDTO` += `contentType`/`externalUrl` (+ mappers
  `rowToCourseDto`/`rowToLessonDto`); `createCourse`/`updateCourse` accept `level`/`tags`; `createLesson`/`updateLesson` accept
  `contentType`/`externalUrl` (createLesson derives `video`/`article` from videoUrl when omitted — backward-compatible). In-txn
  audit unchanged (now also records level/tags/contentType in `after`).
- `packages/lms/src/types.ts` — `ContentType` widened to `video|embed|article|link`; `CourseView` += `level`/`tags`;
  `LessonView` += `externalUrl` (contentType now read from the column, not derived).
- `packages/lms/src/completion.ts` — **removed `deriveContentType`** (dual-truth retired); **added `levelTone(level)`** (pure pill
  tone, keeps the React pages logic-free).
- `packages/lms/src/urls.ts` (**new**) — pure `isHttpsUrl()` / `safeHttpsUrl()` render-time https guards (defence-in-depth XSS).
- `packages/lms/src/index.ts` — exports `./urls`. `packages/lms/src/lms.test.ts` — dropped the deriveContentType test; +levelTone +url-safety tests.
- `apps/web/src/features/lms/queries.ts` — mappers read `c.level`/`c.tags`/`l.contentType`/`l.externalUrl`; all 3
  `deriveContentType` callsites retired (single source of truth = the column).
- `apps/web/src/features/lms/actions.ts` — `createCourseSchema` += `level` enum + `tags` array (`parseTags` comma-split);
  `lessonSchema` += `contentType` enum (`video|article|link` — **no embed**) + `externalUrl`, `videoUrl`/`externalUrl`/material
  `url` all now `.url().startsWith('https://')` (**M-1 fix** of a pre-existing javascript:/data: href gap); **new
  `updateLessonAction`** (CSRF-first pipeline); `lessonUrls()` keeps only the URL matching the chosen content type.
- `apps/web/src/lib/demo.ts` — in-memory `courseMemToView`/`lessonMemToView` map the new DTO fields (level 'beginner', tags [],
  contentType from videoUrl) so the demo backend still typechecks against the widened DTO.
- Pages: `teacher/courses/page.tsx` + `teacher/courses/[id]/page.tsx` (level/tags inputs, content_type select + external_url, a
  per-lesson **edit** form via updateLessonAction, level/tags pills); `(app)/app/education/page.tsx` + `[courseId]/page.tsx`
  (level badge + tag chips); `[courseId]/[lessonId]/page.tsx` (content_type-aware render: guarded https video/link, safe embed
  placeholder, material hrefs guarded by `safeHttpsUrl`); `admin/education/page.tsx` (Level column with `data-label`).
- Tests (**new**): `tests/integration/db-lms-ph3-1.test.ts` (PGlite repo round-trips + the 0005 backfill on the real generated SQL),
  `tests/integration/lms-ph3-1-static.test.ts` (deriveContentType retired, https-only writes, no embed write path, no raw-HTML
  render, UI wired), `tests/e2e/education-ph3-1-mobile.spec.ts` (375px catalogue level badge). Updated:
  `tests/integration/lms-rbac-pipeline.test.ts` (now 11 actions incl. updateLessonAction).
- Tooling (**new**): `scripts/gates.mjs` — sequential single-process gate runner (summary-only output to avoid the Windows
  tool-result late-flush). Docs: `docs/ARCHITECTURE_DECISIONS.md` **ADR-021**, `docs/EDUCATION_LMS_PLAN.md` status banner.
  **41 tables** (additive columns; `db:generate` = "No schema changes" after generate). Aggregate:
  `docs/handoffs/20260531-0130-phase-3-1-lms-rich.md`.

## Phase 2.13 / PG10 additions (Backtester — honest permanently-locked card, option b — REAL, gate-verified; NO migration, 41 tables)
- `packages/backtester/src/derive.ts` (**new**) — pure `deriveBacktesterView(slug, access?)` (3 honest `BacktesterView` kinds:
  legacy_boundary / access_required / not_yet_available; FAIL CLOSED; **carries no numeric/equity/metric/result field** =
  no-fake-results invariant) + `backtesterPill(slug)` + `botHasBacktester(slug)` + `BACKTESTER_RUNNER_DISTRIBUTED = false`
  (single flip-point for option a). Zero runtime deps (type-only `AccessReason`/`Tone`).
- `packages/backtester/src/index.ts` — rewritten to `export * from './derive'` (removed the unused, 0%-coverage, spec-drifted
  in-memory `BacktestService`/`createMemoryBacktestStore` + `BacktestJob`/`BacktestParams`/`BacktestStatus` stub).
- `packages/backtester/src/derive.test.ts` (**new**, 10 unit tests) — per-state routing + fail-closed default + `backtesterPill`
  + the `BACKTESTER_RUNNER_DISTRIBUTED` guard + the no-fake-results invariant (closes the package's prior 0% coverage).
- `packages/backtester/package.json` — `+ scripts.test`.
- `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` — rewritten thin shell over the deriver; removed the dead
  config form + disabled "Queue run"/"Download local runner (soon)" teasers + "coming soon"/"future release" copy.
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` — bot-overview capability-table backtester pill now uses the shared
  `backtesterPill` (no more false green "Available"; tortila → neutral "Not yet available", legacy → "Not available").
- Tests (**new**): `tests/integration/backtester-pg10.test.ts` (12 static guards) + `tests/e2e/backtester-pg10-mobile.spec.ts`
  (375px nav-only). Docs: `docs/ARCHITECTURE_DECISIONS.md` **ADR-020**, `docs/ROADMAP_MASTER.md` §10, `docs/PRODUCTION_BLOCKERS.md`
  (PG10 checked), `docs/BACKTESTER_DISTRIBUTION_PLAN.md` + `docs/CONTRACTS/backtester-runner.md` (status → option b shipped;
  option a deferred). **No migration** (41 tables). Aggregate: `docs/handoffs/20260531-0030-phase-2-13-backtester-locked-card.md`.

## Phase 2.12 / PG9 additions (User cabinet + product UX — per-product cards + mobile-first setup wizard — REAL, gate-verified; NO migration, 41 tables)
- `packages/cabinet/` (**new pure package `@wtc/cabinet`**) — `src/derive.ts` (`deriveProductCard()` + `ACCESS_REASON_COPY`
  for all 10 reasons + `reasonTone`/`reasonLabel` + static blocker-text registry; zero runtime deps, type-only imports of
  `AccessReason`/`ProductCode`/`Tone`), `src/index.ts`, `src/derive.test.ts` (**26 unit tests** incl. 5 fail-closed
  invariants U-FC-01..05). Wired: `tsconfig.base.json` path, `apps/web/package.json` dep + `next.config.ts` transpile
  (`npm install` symlinked it).
- `apps/web/src/features/cabinet/loader.ts` (**new**, server-only) — per-product access decision + fail-closed signal
  fan-out (gathers setup/activity ONLY when `access.allowed`; static B3/B4 blockers regardless) → `deriveProductCard`.
- `apps/web/src/features/cabinet/CabinetProductCard.tsx` (**new**, RSC) — presentational 5-zone card; composes `@wtc/ui`
  primitives; consumes the `CabinetCardView` type (in `features/cabinet`, not `packages/ui`, to avoid a `@wtc/ui`→`@wtc/cabinet` cycle).
- `apps/web/src/app/(app)/app/page.tsx` — rewritten thin: `loadCabinet()` → `CabinetProductCard` per product; removed the
  unconditional Tortila notices card (now per-card + entitlement-gated, security F-04); `export const dynamic = 'force-dynamic'`.
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx` (**new**) — 3-step (`?step=key|strategy|review`) mobile-first
  wizard; 2 **CSRF-first, fail-closed** server actions reusing the vault (`addExchangeKey`) + bot-config (`persistBotConfig`) pipelines.
- `apps/web/src/app/(app)/app/indicators/page.tsx` — **F-01**: `loadTvUserData` gated on `access.allowed` (data minimisation).
- `apps/web/src/app/(app)/app/security/page.tsx` — **F-02**: `addKeyAction` reordered CSRF-first.
- `packages/ui/src/theme.css` — `.wtc-btn min-height:44px` moved to the base rule (F-04); new `.wtc-wizard-steps`/`.wtc-step`
  stepper (§15) + `.wtc-card-row`; **`.wtc-shell` grid → `minmax(0,1fr)` + content `min-width:0`** (fixes a CSS-grid
  min-content blowout that h-scrolled the wizard at 375px — caught by the new e2e; hardens every app page).
- Tests (**new**): `tests/integration/cabinet-pg9.test.ts` (15 static source-guards) + `tests/e2e/cabinet-pg9-mobile.spec.ts`
  (375px, mobile-scoped, navigation-only — honest per-product state + wizard stepper, no h-scroll).
- Docs: `docs/DESIGN_SYSTEM.md` §15, `docs/ARCHITECTURE_DECISIONS.md` **ADR-019**, `docs/ROADMAP_MASTER.md` §9. **No migration**
  (`db:generate` = "No schema changes", 41 tables). Aggregate: `docs/handoffs/20260531-0005-phase-2-12-user-cabinet-product-ux.md`.

## Phase 2.11 / PG8 additions (Admin console — mobile-readable cards + honest state pills — REAL, gate-verified; NO migration, 41 tables)
- `packages/ui/src/theme.css` — **new `.wtc-table-wrap` responsive card-stack** (DESIGN_SYSTEM §14.1): below 640px each
  `<table className="wtc-table">` row becomes a labelled card (`thead` hidden; `td::before { content: attr(data-label) }`;
  `.wtc-td-action` makes the TV grant/revoke forms full-width). + `@media (max-width:640px)` 44px tap targets on
  `.wtc-input`/`.wtc-btn` and `min-width:0 !important` so fixed-`minWidth` inline form inputs shrink to fit 375px.
- `apps/web/src/app/admin/layout.tsx` — renders `<MobileNav items={ADMIN_NAV} />` **inside** the admin tree (after the
  `isAdmin` gate) — the admin console previously had **no navigation below 900px** (the sidenav is `display:none`).
- `apps/web/src/features/admin/queries.ts` — `pickSafeSnapshot()` render-time allowlist (`{id,type,planCode}`) applied to
  `loadManualReviewItems` eventSnapshot (defence-in-depth, lossless for every call site); **new `loadAdminOverview()`**
  (DB-backed user/pending-TV/audit counts; honest demo→0, replacing the stale in-memory `tvService` count on the overview).
- The 8 named admin pages + overview + audit-log (10 total) — every `.wtc-table` wrapped in `.wtc-table-wrap` with
  per-`<td>` `data-label`: `users`, `entitlements` (6-col review preview + 7-col timeline), `tradingview-access`
  (**10-col** queue with `wtc-td-action` + 6-col grant history), `bots` (bot.* health), `education` (courses),
  `system-health` (integration health), `audit-log` (5-col). `entitlements/review` + `support` are card-based (no table).
- `apps/web/src/app/admin/page.tsx` (overview) — per-page `requireUser`+`assertAdmin`, canonical storage `StatusPill`,
  DB-backed counts via `loadAdminOverview`; stale "In-memory (dev)" label fixed.
- `apps/web/src/app/admin/bots/page.tsx` — **derived journal read-state pill** (`journalReadStatePill`, PG2 readState at the
  ops layer from the last persisted health check — no live probe) + table wrap.
- `apps/web/src/app/admin/tradingview-access/page.tsx` — **expiring-soon `RiskWarningBanner`** (PG5; shown when any grant is
  `expiring_soon`) + both tables wrapped; admin-only `revokeReason` column preserved (never user-facing).
- `apps/web/src/app/admin/education/page.tsx` — migrated to canonical `requireUser`+`assertAdmin` (was
  `getCurrentUser`+`roles.includes`); root `<main className="wtc-container">` → `<div className="wtc-stack">` (kills the
  nested-`<main>` invalid HTML); courses table wrapped.
- `apps/web/src/app/admin/support/page.tsx` — status filters restyled as 44px tap-target chips (`filterChipStyle`);
  `buttonClasses('secondary')` replaces a raw class string.
- `apps/web/src/app/admin/audit-log/page.tsx` — per-page `requireUser`+`assertAdmin` + canonical storage pill + table wrap.
- `apps/web/src/app/admin/entitlements/review/page.tsx` — traceability comment on the (now loader-allowlisted) eventSnapshot render.
- Tests (**new**): `tests/integration/admin-responsive.test.ts` (35 — static guards: every admin table wrapped + has
  `data-label`, MobileNav in layout, education canonical-RBAC + no nested `<main>`, overview RBAC + storage pill, every page
  has a `StatusPill`) + `tests/e2e/admin-mobile-pg8.spec.ts` (375px: no horizontal scroll + MobileNav visible + storage pill
  across all 10 admin pages; scoped to the mobile project).
- Test hygiene (fixes a **red gate inherited from PG7**): `packages/audit/src/audit.test.ts` + `tests/integration/lms-rbac-pipeline.test.ts`
  — 5 `noUncheckedIndexedAccess` non-null fixes (`npm run typecheck` was exit 2 on the PG7 tree); `tests/integration/db-pg5.test.ts`
  — `beforeAll` 30s timeout (PGlite-under-load hookTimeout flake).
- Docs: `docs/DESIGN_SYSTEM.md` §14 (ux-ui-designer — responsive spec + pill taxonomy + per-page state map), `docs/ARCHITECTURE_DECISIONS.md`
  **ADR-018**, `docs/ROADMAP_MASTER.md` §8. **No migration** (`db:generate` = "No schema changes", 41 tables).

## Phase 2.10 / PG7 additions (LMS authorization hardening — denial → audit+throw; CSRF-first — REAL, gate-verified; NO migration, 41 tables)
- `apps/web/src/features/lms/guard.ts` (**new**, server-only) — the LMS authz gates for the server-action mutation pipeline:
  `lmsRoles`, the shared `auditDenied` (writes `result:'failure'`, `after:{reason,attempted}`, no secrets), and
  `requireTeacher`/`requireAdmin`/`requireCourseOwnership`/`requireEducationAccess` — each **audits then throws** `AppError`
  (`forbidden`/`entitlement_denied`) on denial. Reuses the pure `@wtc/lms` `assertTeacherOwns`; a missing course is a denial.
- `apps/web/src/features/lms/actions.ts` — all 10 actions reordered to **assertCsrf-first**; every silent authz `return`
  replaced with a guard call; `roles()`/`ownsCourse()` removed; docstring updated to the canonical pipeline. Zod/not-found/demo
  branches stay graceful.
- `packages/audit/src/audit.ts` — `AUDIT_ACTIONS` += `education.rbac_denied`, `education.entitlement_denied` (two-code
  denial convention; `AuditResult` unchanged — denials use `'failure'`).
- Tests (**new**): `tests/integration/lms-rbac-pipeline.test.ts` (8 — static CSRF-first/no-silent-return/guard-audit+throw
  guarantees; vitest excludes `apps/web/**` so server actions are asserted by source analysis) +
  `packages/audit/src/audit.test.ts` (4 — denial codes + `buildEvent` round-trip + memory writer). **No migration** (41 tables).
- **Deferred to Phase-3 (unanimous, no consumer this phase):** the rich LMS migration 0005 (slug/level/tags/content_type/
  embed_html/file-meta/global-pinned/progress-state) + pinned-link/teacher-profile web surfaces. Spec in
  `docs/EDUCATION_LMS_PLAN.md` + the `20260530-2330-ecosystem-db-architect.md` / `-education-implementer.md` handoffs.

## Phase 2.9 / PG6 additions (Axioma ES256-into-bridge + staging/prod fence + jti replay store — REAL, gate-verified; migration 0004, 40→41 tables)
- `packages/db/migrations/0004_overconfident_frightful_four.sql` (**new**) — **migration 0004** (additive; 40→**41 tables**):
  `axioma_handoff_jti_revocations` (`jti uuid PK` caller-supplied, `sub uuid NOT NULL` **no FK**, `issued_at`/`expires_at`/`used_at`/
  `revoked_at`/`revoke_reason`, indexes `ahjr_expires_at_idx` + `ahjr_sub_idx`). 0000–0003 untouched. `db:generate` → "No schema changes".
- `packages/db/src/schema.ts` — `axiomaHandoffJtiRevocations` table (after `terminalLicenseEvents`).
- `packages/db/src/repositories.ts` — `lt` import; jti store section (pure primitives): `recordHandoffJti`, `consumeHandoffJti`
  (atomic conditional `UPDATE … RETURNING {sub}`; 0 rows → SELECT categorizes `not_found`/`already_used`/`revoked`/`expired`),
  `revokeHandoffJtisByUser`, `purgeExpiredHandoffJtis` + `HandoffJtiRow`/`ConsumeJtiResult`/`ConsumeJtiReason` types.
- `packages/audit/src/audit.ts` — `AUDIT_ACTIONS` += `axioma.handoff_jti_consume`/`_replay`/`_revoke` (for the future B4 routes).
- `apps/worker/src/index.ts` — `dbTick` calls `purgeExpiredHandoffJtis` after `sweepTvExpiry`; `handoffJtisPurged` in health/log.
- `packages/axioma-bridge/src/signer.ts` (**new**) — `HandoffSigner` + pure `resolveHandoffSigner` (the staging+prod fence) +
  `isRealDeployment`. Zero-dep/pure (no `process.env`).
- `packages/axioma-bridge/src/bridge.ts` — `AxiomaBridgeOptions` (injected `signer` + `recordJti`); new `createAxiomaBridge`
  (signs via the injected signer, records jti at issuance); `createMockAxiomaBridge` now a thin HS256 wrapper. `index.ts` exports the new symbols.
- `packages/config/src/env.ts` — `APP_ENV` (dev/test/staging/production) + `AXIOMA_HANDOFF_SIGNING_KEY`/`_KEY_ID` + staging/prod
  superRefine (validated at boot via instrumentation `loadEnv`). HS256-secret prod requirement KEPT (F-07 deferred). `.env.example` documents both.
- Tests (**new/updated**): `packages/axioma-bridge/src/signer.test.ts` (**12** — fence + ES256-bridge round-trip + alg-confusion),
  `tests/integration/db-axioma-jti.test.ts` (**9** + 1 real-PG cross-connection skip), `packages/config/src/env.test.ts` (+**4**).
- Docs (owned): `INTEGRATION_MAP.md §6.2` (JWKS path + `AXIOMA_BRIDGE_API_TOKEN` fix), `ARCHITECTURE.md §13` + `ARCHITECTURE_DECISIONS.md`
  ADR-016 (platform-architect, with an as-shipped reconciliation note), `CONTRACTS/axioma-bridge.md` v1.2.0, `PRODUCTION_BLOCKERS.md`
  B4 (WTC items DONE), `AXIOMA_HANDOFF_TOKEN_SPEC.md` (jti store landed), `OPEN_QUESTIONS.md` (Q-15/Q-16). 5 audit handoffs at epoch
  `20260530-2230`; aggregate `docs/handoffs/20260530-2230-phase-2-9-axioma-es256-jti-store.md`. **CTAs stay disabled (B4); ES256
  activation NOT RUN (no provisioned P-256 key).**

## Phase 2.8 / PG3 + PG4(unblocked) + PG5-follow-up additions (Legacy hard gate · Billing scaffold · markExpiringSoon — REAL, gate-verified; no migration)
- `packages/bot-adapters/src/legacy/legacy-blocked.ts` (**new**) — `LegacyAdapterBlockedError` (readonly `blockerRef='B3'`) +
  `createLegacyBlockedAdapter()`: data/health-read methods throw the blocked error, control throws `BotControlDisabledError`,
  `getHealth()` returns a deterministic blocked state (`readState='not_configured'`, B3 detail) with **no network call**,
  `getWarnings()` returns `LEGACY_WARNINGS`.
- `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts` (**new**) — `LegacyApiSafeBodySchema` (Zod transform) +
  `isLegacySecretField` + `LEGACY_SECRET_FIELD_NAMES` (superset of redact.ts SECRET_HINTS) + recursive `stripSecretFields`.
- `packages/bot-adapters/src/factory.ts` — legacy non-mock ⇒ `createLegacyBlockedAdapter()` (ignores `legacyBaseUrl`); mock ⇒
  `createMockLegacyAdapter()`. `http.ts` — **`createHttpLegacyAdapter` DELETED** (the `/api_management/` probe); unused
  `LEGACY_WARNINGS` import dropped. `index.ts` — barrel drops `createHttpLegacyAdapter`; adds the blocked adapter + exclusion exports.
- `apps/web/src/features/bots/meta.ts` — `BotCapabilities.liveAdapterBlocked` (+ reason); `legacy_bot:true` (B3), `tortila_bot:false`.
  `app/(app)/app/bots/[bot]/page.tsx` + `app/(app)/app/bots/page.tsx` — honest "Live adapter unavailable — blocked (B3)" banner
  (data-driven), distinct from the mock "simulated data" banner.
- `packages/db/src/repositories.ts` — `gt`/`isNotNull` import; `TV_EXPIRING_SOON_WINDOW_MS=7d`; **`markExpiringSoon(db, now?, windowMs?)`**
  (`granted → expiring_soon`, `> now` lower bound, idempotent, `.returning({id})` count, no per-row audit); **`sweepTvExpiry`
  predicate widened** to `inArray(status,['granted','expiring_soon'])` (co-land). `apps/worker/src/index.ts` — `dbTick` calls
  `markExpiringSoon` before `sweepTvExpiry`; `tvExpiringSoon` in the health-check detail/log.
- `packages/billing/src/provider.ts` — pure `checkoutAvailability(opts)` + `CheckoutAvailability` (3 honest `false` branches;
  **no `available:true` branch** until B2). `index.ts` exports both. `apps/web/src/features/billing/plans.ts` (**new**, pure
  `buildPricingCards()` view-model) + `checkout.ts` (**new**, server-only `checkoutCta()`). `app/(public)/pricing/page.tsx` +
  `app/(app)/app/billing/page.tsx` consume them (honest CTA pill; dev-only mock-checkout behind a `NODE_ENV!=='production'` guard).
- Tests (**new/updated**): `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts` (**42**),
  `tests/integration/db-tv-expiring.test.ts` (**7**), `packages/billing/src/provider.test.ts` (+**4**),
  `tests/e2e/smoke.spec.ts` (+ legacy blocked-banner content assertion). 5 audit handoffs at epoch `20260530-2100`; aggregate
  `docs/handoffs/20260530-2100-phase-2-8-legacy-gate-billing-scaffold-tv-expiring.md`. **No migration** (40 tables).
  **B2 (Stripe test-mode checkout) NOT RUN** (Q-2 open + no test keys); legacy real adapter **deleted + factory-blocked (B3)**.

## Phase 2.7 / PG2 + PG5 additions (Tortila read-only states + TV bounded fixes — REAL, gate-verified; no migration)
- `packages/bot-adapters/src/types.ts` — `ReadState` union + `ADAPTER_STALE_THRESHOLD_MS` (5 min); optional
  `readState?`/`readStateDetail?` on `BotHealth` (back-compat, never widens `HealthStatus`); `getWarnings(): Promise<RiskWarning[]>`
  on `BotAdapter`. `index.ts` exports `ReadState` + `ADAPTER_STALE_THRESHOLD_MS`.
- `packages/bot-adapters/src/http.ts` — `createHttpTortilaAdapter(baseUrl, token?)`; `getJson(url, timeoutMs, token?)` →
  `Authorization: Bearer` (only when set; never logged/in errors); `getHealth()` = 4-state machine (never throws):
  `not_configured`/`unreachable`/`malformed`/`stale`/`ok`; `getWarnings()` added (real = persistent P0/P1). Legacy HTTP adapter
  gets `getWarnings()` + `readState`. `mock-tortila.ts`/`mock-legacy.ts` — `getWarnings()` + `readState:'ok'`; warnings delegate.
  `tortila/tortila.mapping.ts` — `healthToCanonical` forwards `readState:'ok'`. `factory.ts` — `AdapterOptions.tortilaReadToken?`.
- `apps/worker/src/jobs.ts` — `healthCheckStatusFor(readState, processAlive)` (→ `not_configured`/`down`/`error`/`ok`);
  `snapshotTortilaJournal` records the precise status + `readState` in `detail`. `apps/worker/src/index.ts` — no-instance
  early-exit records `status='not_configured'`; reads + passes `JOURNAL_READ_TOKEN`.
- `packages/config/src/env.ts` — `JOURNAL_READ_TOKEN` optional + prod+non-mock `superRefine` guard. `apps/web/src/lib/server-config.ts`
  — `tortilaReadToken` + canonical `TORTILA_JOURNAL_URL` (fallback `_BASE_URL`). `.env.example` — `JOURNAL_READ_TOKEN=` placeholder.
- `apps/web/src/features/bots/meta.ts` — `botHealthPill(health)` (honest tone+label; `not_configured`="Setup needed"). Bot
  `[bot]/page.tsx` + `[bot]/safety/page.tsx` use it; safety calls `getWarnings()` first-class; both surface `readStateDetail`.
- `packages/db/src/repositories.ts` — `atomicRevokeTv` **actor descriptor** `{id:string|null;role:'admin'|'system'}` (`TvRevokeActor`);
  `sweepTvExpiry` delegates to it (`{id:null,role:'system'}`, `TV_EXPIRED_BY_WORKER_REASON='expired_by_worker'`, keeps task row);
  `listUsersWithEmailByIds(db, ids)` (single `inArray`, empty-ids short-circuit, email-only). `inArray` import added.
- `apps/web/src/features/tv/{actions.ts,queries.ts}` — revoke caller passes `{id:actor.id,role:'admin'}`; `loadTvAdminData`
  batched (N+1 removed). `apps/web/src/app/admin/tradingview-access/page.tsx` — admin-only "Revoke reason" column.
  `apps/web/src/app/(app)/app/indicators/page.tsx` — `<14-day` expiry banner.
- Tests (**new**): `packages/bot-adapters/src/__tests__/getHealth-states.test.ts` (9), `tests/integration/db-pg5.test.ts` (5),
  `tests/integration/worker-health-mapping.test.ts` (6); `adapters.test.ts` (+2), `tortila-mapping.test.ts` (+1 W-07);
  `db-persistence.test.ts`/`db-0003.test.ts` updated for the new revoke semantics + actor descriptor. 4 audit handoffs at epoch
  `20260530-1930`; aggregate `docs/handoffs/20260530-1930-phase-2-7-tortila-states-tv-bounded-fixes.md`. **No migration** (40 tables).

## Phase 2.6 / PG11 additions (security middleware spine + redact value-guard — REAL, gate-verified)
- `apps/web/src/middleware.ts` (**new, greenfield**) — Edge middleware: IP-keyed auth rate-limit (10/60s) on the real
  server-action POST paths `/login`+`/register` (429 + `Retry-After`, no enumeration; enforcement skipped only for an
  unidentifiable client in non-prod, fail-closed in prod); SECURITY_MODEL §6 security headers on **document GET**
  responses only (POSTs/RSC untouched); `/api/billing/webhook` excluded (matcher + early return). Build: `ƒ Middleware 35.2 kB`.
- `packages/auth/src/rate-limit.ts` (**new**) — pure, dependency-free sliding-window `checkRateLimit` + `getClientIp`
  (Edge-safe; NOT exported from the `@wtc/auth` barrel, which pulls `@node-rs/argon2`). +14 unit tests.
- `packages/auth/src/security-headers.ts` (**new**) — pure `buildSecurityHeaders` + `buildContentSecurityPolicy`
  (env-aware: HSTS prod-only; dev CSP relaxes `script-src` for HMR; nonce supported but unused at MVP). +21 unit tests.
- `packages/auth/package.json` — `exports`: `./rate-limit` + `./security-headers` subpaths. `tsconfig.base.json` —
  matching `@wtc/auth/rate-limit` + `@wtc/auth/security-headers` path aliases (middleware imports the subpaths only).
- `packages/audit/src/redact.ts` — **F-07 value-pattern guard:** `isSecretValue()` (PHC/bcrypt, `Bearer `/`Basic `,
  64+-hex) now redacts secret-looking string VALUES at any depth, not just keys. `index.ts` exports it. +18 unit tests
  (`packages/audit/src/redact.test.ts`, **new** — redaction previously had no co-located test).
- `tests/e2e/security-headers.spec.ts` (**new**) — asserts the header suite on `GET /`. `playwright.config.ts` —
  `retries: 2` (dev-only Next Server-Action recompilation race; production is pre-compiled). 4 audit handoffs at epoch
  `20260530-1815`; aggregate `docs/handoffs/20260530-1815-phase-2-6-middleware-security-spine.md`.

## Phase 2.4 additions (real bot read-only + access ops + production spine — REAL, gate-verified)
- `packages/db/migrations/0003_fresh_blockbuster.sql` — **migration 0003** (additive; 38→**40 tables**): `billing_webhook_events`
  (UNIQUE provider+event_id durable idempotency), `billing_manual_review_items` (admin review queue), `subscriptions`
  UNIQUE(user_id,provider,provider_ref), `audit_action_target_idx`.
- `packages/db/src/repositories.ts` — `insertWebhookEventOnce`/`updateWebhookEventStatus` (INSERT-on-conflict idempotency,
  concurrent-safe), `createManualReviewItem`/`listManualReviewItems`/`resolveManualReviewItem`/`flagProductForReview`,
  `atomicGrantTv`/`atomicRevokeTv`/`revokeTv(+reason)`, `upsertSubscription` (ON CONFLICT DO UPDATE), `listUsersWithCreatedAt`.
  `packages/audit/src/audit.ts` — 6 new action codes.
- `packages/bot-adapters/src/tortila/{tortila.schemas.ts,tortila.mapping.ts}` (**new**) + `__fixtures__/tortila/*` (11 **new** — 3 health, 3 summary, 3 equity, 2 trades_list) +
  `http.ts` (real `getMetrics`/`getPositions`/`getTrades`/`getEquityCurve`, Zod-validated; fees sign-inversion `Math.abs`; mark
  price honestly unavailable; never `/api/marks`) + `__tests__/tortila-mapping.test.ts` (35 fixture-only). `apps/worker/src/{jobs.ts,index.ts}`
  — read-only `tortila-journal` health collector (env-guarded by `TORTILA_JOURNAL_URL`). Control disabled; legacy adapter BLOCKED.
- `packages/billing/src/{provider,stripe,webhook}.ts` + `apps/web/src/app/api/billing/webhook/route.ts` — durable
  `insertWebhookEventOnce` idempotency gate, `upsertSubscription` wiring, missing-userId → `createManualReviewItem` + admin
  notify (never auto-grant), `charge.dispute.closed` handling, delete-ledger-row-on-error retry. Still verify-first + no secret/body logging.
- `apps/web/src/features/tv/actions.ts` — `atomicGrantTv`/`atomicRevokeTv` wiring (one transaction; reason persisted).
- `apps/web/src/features/admin/*` + `apps/web/src/app/admin/{entitlements,entitlements/review (NEW),bots (placeholder→real),system-health}/**`
  — N+1 fix (`listUsersWithCreatedAt`), manual-review queue + approve/reject/dismiss actions, `/admin/bots` (Tortila status,
  legacy BLOCKED, last snapshot/error, disabled control, demo-vs-Postgres).
- Tests: `tests/integration/{db-0003,billing-webhook-phase24,admin-ops-rbac}.test.ts` (**new**) + tortila-mapping (35) +
  `tests/e2e/smoke.spec.ts` (28→34). Docs truth: contracts/DATA_MODEL (40 tables)/PAYMENT_WEBHOOK_STATE_MACHINE/INTEGRATION_MAP/.env.example/DEPLOYMENT.
- **NOT RUN / TARGET / BLOCKED (honest):** real-PG `db:migrate`/`db:seed`/harness (no DATABASE_URL/Docker; PGlite not a substitute);
  real Stripe test checkout/replay acceptance and production keys (NOT RUN); Axioma ES256 prod signer + OTC link (TARGET);
  legacy bot adapter (BLOCKED, plaintext keys); CI (inert).

## Phase 2.3 additions (commercial access & operations — REAL, gate-verified)
- `apps/web/src/app/api/billing/webhook/route.ts` — **new** `POST /api/billing/webhook` (raw body, Stripe-Signature
  verify-first via `@wtc/billing` `createStripeProvider().parseWebhook`, idempotent via the `audit_logs` ledger,
  CSRF-exempt, fail-closed, no secret/body logging, no live Stripe calls). **First real API mutation route.**
- `apps/web/src/features/billing/timeline.ts` — **new** product-access timeline loaders (`loadUserTimeline` omits actor;
  `loadAdminTimeline` includes actor).
- `apps/web/src/features/tv/{queries.ts,actions.ts}` — **new** TV user/admin loaders + `enhancedGrantAction`/`enhancedRevokeAction`
  (assertCsrf+assertAdmin+Zod+state-guard+fail-closed entitlement re-check; `grantTv`+`createTvGrant`). Manual-first.
- `apps/web/src/features/terminal/loader.ts` — **new** DB-backed terminal release loader (`getCurrentTerminalRelease`; mock fallback when no DB).
- `apps/web/src/features/admin/{types,queries,schemas,actions}.ts` — **new** admin console glue (`AdminUserView` strips `passwordHash`;
  system-health reads; support triage + grant/revoke-with-reason actions).
- `packages/db/src/repositories.ts` — backward-compatible edits: `createCourse(+teacherProfileId?)`, `upsertEnrollment(+actorUserId?)`,
  `markEnrollmentComplete` (audit `targetId`=enrollment.id), `grantProduct(+reason?,+validUntil?)`, `revokeProduct(+reason?)`. **No schema change.**
- `apps/web/src/features/lms/{queries.ts,actions.ts}` — 4 LMS correctness fixes (teacher read-isolation, admin-enroll actor, course `teacherProfileId`).
- `packages/axioma-bridge/src/bridge.ts` — `LicenseStatus` extended (+grace/revoked/unknown, backward-compatible).
- UI promoted/enriched: `app/admin/{users,system-health,support,entitlements}/page.tsx` (support is **new**), `app/(app)/app/{billing,terminal,indicators,bots,bots/[bot]}/page.tsx`, `app/admin/tradingview-access/page.tsx`, `app/(public)/pricing/page.tsx`.
- Docs/nav truth: `apps/web/src/lib/{nav.ts,product-status.ts}`, `docs/CONTRACTS/{billing-webhooks.md,tradingview-access.md}`, `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md`, `docs/INTEGRATION_MAP.md`, `.env.example`.
- Tests: `tests/integration/{billing-webhook,lms-fixes,phase23-visible-progress}.test.ts` (**new**, +17), `tests/e2e/smoke.spec.ts` (18→28). **No migration 0003.**

## Phase 2.2 additions (full LMS vertical — REAL, gate-verified)
- `packages/lms/src/` — **new** `errors.ts` / `types.ts` (LEAN view types) / `guards.ts` (pure ownership + fail-closed
  entitlement) / `completion.ts` (progress math) + `lms.test.ts` (7 pure tests); barrel extended (thin class kept).
- `packages/db/src/repositories.ts` — LMS-UI repos (`getCourseById`/`listAllCourses`/`listLessonsForCourse`/`getCourseCounts`/
  `updateCourse`/`setCoursePublished`/`createLesson`/`updateLesson`/`createMaterial`/`listMaterials`/`deleteMaterial`/
  `listTeacherProfiles`/`getCourseStudentList`), in-txn audit (codes already shipped 2.1).
- `apps/web/src/features/lms/{queries.ts,actions.ts}` — **new** service glue (getServerDb + repos + mappers; CSRF/RBAC/
  ownership/entitlement/audit server actions).
- `apps/web/src/app/teacher/{courses,courses/[id],students}/page.tsx` + `admin/education/page.tsx` — placeholder → **real**.
- `apps/web/src/app/(app)/app/education/[courseId]/page.tsx` + `[courseId]/[lessonId]/page.tsx` — **new** student routes;
  `(app)/app/education/page.tsx` catalogue links into them.
- `tests/integration/lms-service.test.ts` (**new**, 7 PGlite) + `tests/e2e/smoke.spec.ts` (+1 LMS spec).
- **Architecture:** the LMS surfaces use `getServerDb()` + `features/lms` (consistent with the Phase-2.1 bot-config/support
  surfaces), not an expansion of the 4-method `lmsService` 3-adapter. **Staged → Phase 3:** rich LMS columns (migration `0003`).

## Phase 2.1 additions (data/crypto spine + 2 surfaces — REAL, gate-verified)
- `packages/db/src/schema.ts` — **17 new tables** (migration `0002`) + 1 ALTER (`tradingview_access_requests` revoke cols) + `courses.teacher_profile_id`.
- `packages/db/migrations/0002_sour_paibok.sql` (+ regenerated `meta/`) — additive; backfill + CHECK hand-added at end.
- `packages/db/src/repositories.ts` — **~40 new repos** (bots/education/TV/products/terminal/ops/billing), in-txn audit;
  `grantProduct`/`revokeProduct` write `product_access_events` (+`actorUserId`); `addExchangeKey` audit + `revokeTv`
  revoke-metadata debts cleared; `applyStripeEvent` idempotent (audit-ledgered).
- `packages/audit/src/{audit.ts,redact.ts}`, `packages/auth/src/rbac.ts` — Phase-2.1 audit codes, SECRET_HINTS, RBAC resources.
- `packages/billing/src/stripe.ts` (new) + `provider.ts`/`index.ts` — real Stripe webhook adapter (+`stripe.test.ts`, 8).
- `packages/axioma-bridge/src/{es256.ts,jwks.ts}` (new) + `index.ts` — ES256/JWKS (+`es256.test.ts`, 7). HS256 stub unchanged.
- `apps/web/src/lib/{db-store.ts,backend.ts}` — `getDb()` / `getServerDb()` accessor (real DB / labelled demo / fail-closed prod).
- `apps/web/src/features/bots/config.ts` (new) + `app/(app)/app/bots/[bot]/settings/page.tsx` — **real** config surface.
- `apps/web/src/features/support/data.ts` (new) + `app/(app)/app/support/page.tsx` — **real** tickets + notifications.
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` (new) — first real route handler (public JWKS).
- `tests/integration/db-0002.test.ts` (new) — 19 PGlite cases (idempotency, isolation, in-txn audit, billing replay).
- **Staged (Rule 7, repo-backed, UI not built):** full LMS (S-4/P-A), billing UI/webhook route (P-B), TV grants UI (P-E),
  admin panels (P-F admin), terminal DB-wiring (P-D). See `docs/handoffs/20260530-0925-phase-2-1-platform-spine-product-surfaces.md`.

## Phase 2 additions (analytics + read-only bot dashboards — REAL, gate-verified)
- `packages/analytics/src/metrics.ts` — **GAP-F fix** (`filterZeroEquity` applied before `computeDrawdown`) + additive
  fields/functions: `netPnlWithFees`, `firstEquity`/`roiPctSinceStart`, `avgWin`/`avgLoss`/`expectancy`,
  `safetyEventCount`, extended optional `CanonicalPosition`/`CanonicalTrade` fields, `combineMetrics`+`CombinedMetrics`,
  `mergedProfitFactor`, `isDataStale`. All additive (no field/semantic change). +`metrics.test.ts` (13 unit tests).
- `packages/bot-adapters/src/types.ts` — optional `getEquityCurve?` on `BotAdapter`; implemented in `mock-tortila.ts`
  (real curve) and `mock-legacy.ts` (honest `[]`). Real HTTP adapter unaffected (optional).
- `apps/web/src/app/(app)/app/bots/[bot]/{positions,trades,equity,safety}/page.tsx` — **real read-only dashboards**
  (were `BotSubPagePlaceholder`); capability-aware via `BOT_CAPS` (Legacy → honest "not available", never fabricated).
- `apps/web/src/app/(app)/app/bots/page.tsx` — unified combined-portfolio card (`combineMetrics`, entitled-bots only).
- `apps/web/src/features/bots/{meta.ts,data.tsx}` (new), `apps/web/src/components/BotSubNav.tsx` (new).
- Still **mock** (`BOT_ADAPTER_MODE=mock`): every bot page shows the "Simulated data" banner; real adapters stubbed.
- **NOT in this slice (designed, staged):** migration `0002` (18 tables), full LMS, billing repos, terminal/Axioma pages,
  TV grants/profiles UI — see `docs/handoffs/20260530-0126-phase-2-full-platform-buildout.md`.

## API surface — mostly TARGET
As of **Phase 2.3** the `apps/web/src/app/api/**` directory exists with the **first real API mutation route**:
`apps/web/src/app/api/billing/webhook/route.ts` (`POST /api/billing/webhook` — signature-verified, idempotent, CSRF-exempt).
The first route handler overall was `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` (Phase 2.1, public JWKS).
Other `/api/...` namespaces in `ARCHITECTURE.md`/`INTEGRATION_MAP.md` (Axioma download proxy, OTC link, education progress)
remain **planned**. Otherwise the app uses **server actions** + the `apps/web/src/lib/backend.ts` selector / `getServerDb()` accessor.

## Persistence — current
| Concern | Implemented file(s) | State |
|---|---|---|
| Drizzle schema (41 tables) | `packages/db/src/schema.ts` | real (21 base + 17 from `0002` + 2 from `0003` + 1 from `0004`; `0005` adds LMS columns only, so table count stays 41) |
| Migration SQL | `0000_broken_jack_murdock.sql`, `0001_early_toad_men.sql`, **`0002_sour_paibok.sql`** (17 tables + 1 ALTER + backfill + CHECK), **`0003_fresh_blockbuster.sql`** (`billing_webhook_events`, `billing_manual_review_items`, subscriptions unique index, audit composite index), **`0004_overconfident_frightful_four.sql`** (`axioma_handoff_jti_revocations` + 2 indexes), **`0005_noisy_supreme_intelligence.sql`** (LMS rich columns + CHECK/backfill) (+ `meta/`) | generated (6 migrations, 41 tables); `0002`+`0003`+`0004`+`0005` PGlite-tested |
| Repositories (users, sessions, entitlements, audit, exchange-keys, TradingView, **Education**, worker jobs) | `packages/db/src/repositories.ts` | real, PGlite-integration-tested; grant/revoke/createUser/addExchangeKey **transactional**; `grantProduct` is a DB-level **upsert** (`onConflictDoUpdate`); `createUser` maps SQLSTATE 23505 → friendly error; `destroySession` async + awaited. **Phase 1.7:** `submitTvRequest`/`grantTv`/`revokeTv` now transactional + write `audit_logs` in-txn (`tradingview.submit`/`.grant`/`.revoke`) with `rowToTvDto` epoch-ms DTOs; new Education repos `createCourse` (txn+audit) / `listCoursesForTeacher` / `listPublishedCourses` / `listLessonsForStudent` (+ `CourseDTO`/`LessonDTO`) |
| Seed (from empty DB) | `packages/db/src/seed.ts`, `seed-cli.ts` | real |
| Production backend selector (fail-closed) | `apps/web/src/lib/backend.ts`, `db-store.ts` | real |
| In-memory dev backend | `apps/web/src/lib/demo.ts` | dev only |
| Integration test (real Postgres engine, no Docker) | `tests/integration/db-persistence.test.ts` | passing (PGlite) |

**Phase 1 persists:** users, sessions, entitlements, audit logs, exchange-key sealed secrets (web + worker).
**Phase 1.7 (Part E) adds:** the **TradingView access web UI** and the **LMS thin model** (courses/lessons) now
go through async DB-backed services (`apps/web/src/lib/tv-types.ts` + `lms-types.ts` interfaces; DB adapters in
`db-store.ts`, in-memory dev adapters in `demo.ts`; fail-closed selectors in `backend.ts`). TV
submit/grant/revoke + course-create write `audit_logs` in-txn. The `storage:` badges are now driven by
`backendMode` (Postgres vs in-memory dev). **Update:** the full LMS DB contract
(`teacher_profiles`/`enrollments`/`lesson_progress`/`pinned_links` + progress/completion repos) and the
`revoked_at`/`revoked_by` columns **landed in Phase 2.1**; the full LMS teacher/student/admin UI is **Phase 2.2**.
Still deferred: a TradingView task-runner executor.

## Adapter mode — `BOT_ADAPTER_MODE` (no `=real`)
The flag is `BOT_ADAPTER_MODE = mock | read-only | audited` (`packages/config/src/env.ts`,
`packages/bot-adapters/src/factory.ts`). There is no `=real` value. Default `mock`. Real adapters stay
stubbed (`packages/bot-adapters/src/http.ts` → `AdapterNotReadyError`); control always throws.

## Contracts → current implementing files
| Contract (`docs/CONTRACTS/`) | Current implementing files |
|---|---|
| `tortila-adapter.md` / `legacy-bot-adapter.md` | `packages/bot-adapters/src/{types,factory,http,mock-tortila,mock-legacy,control,warnings}.ts` (mock + stubbed real) |
| `axioma-bridge.md` | `packages/axioma-bridge/src/{bridge,handoff,es256,jwks,signer}.ts` — `createAxiomaBridge` signs via an injected `HandoffSigner`; `resolveHandoffSigner` fence (ES256 keyed / staging+prod-required / HS256 dev stub); jti replay store in `@wtc/db` (migration 0004). Real activation TARGET/B4 (no P-256 key; CTAs disabled) |
| `billing-webhooks.md` | `packages/billing/src/{webhook,provider,stripe,stripe-replay}.ts` + `apps/web/src/app/api/billing/webhook/route.ts` (signature-verified; durable `billing_webhook_events` idempotency gate; fail-closed `manual_review`; test-mode checkout creation and local replay preflight CURRENT; Stripe CLI/Dashboard replay NOT RUN) |
| `tradingview-access.md` | `packages/tradingview-access/src/index.ts` (in-memory worker model) + `packages/db/src/repositories.ts` (DB repos, audited) + `apps/web/src/lib/{tv-types,db-store,demo,backend}.ts` (async `TvService` selector — web UI DB-backed in Phase 1.7) |
| `backtester-runner.md` | `packages/backtester/src/{derive,index}.ts` + `packages/backtester/runners/wtc-backtester-0.1.0.zip` + `/api/bots/[bot]/backtest/runner-download` (Tortila download MVP real; server-side job/result/artifact upload still TARGET) |

## Worker — current
`apps/worker/src/index.ts`: DB jobs when `DATABASE_URL` set (entitlement reconcile, TV revoke sweep +
task queue, integration-health snapshot via `@wtc/db`); in-memory demo loop otherwise. The `job_queue`
table is **RESERVED / not yet consumed** — no code enqueues or dequeues it; the worker uses cron-style
direct calls + `tradingview_access_tasks`. Do not present `job_queue` as a working durable queue.

## Governance checker — real (strengthened Phase 1.6.1)
`scripts/check-governance.mjs` (zero-dep Node ESM, fs-only) backs `npm run governance:check`. Pure logic is
exported as `evaluateGovernance({files, readFile, phaseArg})` (CLI wrapper guarded by `import.meta.url`), with
**fixture self-tests** in `tests/integration/check-governance.test.ts` (7 cases). Validates: the current
aggregate's cited per-agent files exist; the numeric "N-agent" claim is backed by **per-agent handoff links
ACTUALLY CITED in the aggregate** (not merely epoch files on disk); every current-epoch per-agent handoff is
cited (unlinked participant → fail, unless `NON_PARTICIPANT_ALLOWLIST` / `KNOWN_HISTORICAL_DRIFT` / a
line-scoped "superseded/non-participant" marker); canonical headings (normalised, required-subset). STRICT
current-phase, INFORMATIONAL historical. Wired into `ci:local` + `ci.yml`.

## Runtime config validation — real (Phase 1.6.1)
`apps/web/instrumentation.ts` calls `@wtc/config` `loadEnv()` in `register()` under `NEXT_RUNTIME==='nodejs'`,
so the typed-env + base64-32 `SECRET_VAULT_KEK` check runs at server **boot** (Next 15 does NOT call
`register()` during `next build` — verified: secret-less build stays green). The lazy fail-closed vault
(`@wtc/crypto` `parseKek` + `requiredSecret`) remains the backstop. `isBase64Key` has direct unit tests in
`packages/shared/src/env-guards.test.ts`.

## Real-Postgres integration harness — opt-in (Phase 1.6.1)
`tests/integration/db-real-postgres.test.ts` runs ONLY when `REAL_POSTGRES_DATABASE_URL` is set
(`describe.skipIf`), so `npm test` stays green with no DB. Covers (against postgres-js, real engine): migrate +
idempotent seed, unique entitlement, **true cross-connection concurrent `grantProduct`** (second pool),
session create/resolve/destroy, FK cascade, pool teardown. The PGlite `db-persistence.test.ts` remains the
default (no-DB) integration path. Real `db:migrate`/`db:seed` still NOT RUN (no DB URL provided).

## CI — staged, inert
`.github/workflows/ci.yml` exists (two jobs: gates with a `postgres:17-alpine` service + ephemeral
runtime secrets; e2e with `playwright install --with-deps chromium`). It does **not** run: this is **not a
git repo** and there is no GitHub remote. Local equivalent: `npm run ci:local` (root `package.json`).
"CI exists" must not be claimed until git + a remote are set up.
