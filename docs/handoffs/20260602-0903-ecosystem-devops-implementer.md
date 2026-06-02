# ecosystem-devops-implementer handoff
## Scope
Phase 3.43 / epoch 20260602-0903 read-only devops lane for deployment/runbook implications of DB-backed account-specific login lockout. Scope covered migration and rollout ordering, raw-IP preview safety, env/config implications, no-live-mutation constraints, CI/current not-git limitation, and final gate reporting. No product code, existing docs, env files, preview server, production server, nginx, systemd, database, bot service, Stripe, Axioma, LMS object store, or scanner was mutated.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260602-0834-phase-3-42-auth-rate-limit-truth.md`
- `docs/handoffs/20260602-0834-ecosystem-devops-implementer.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `.env.example`
- `package.json`
- `packages/db/package.json`
- `scripts/gates.mjs`
- `packages/config/src/env.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/seed-cli.ts`
- `packages/db/migrations/`
- `apps/web/src/middleware.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `tests/integration/auth-rate-limit-middleware.test.ts`
- `.github/workflows/ci.yml`

## Files changed
None - read-only audit. Handoff written: `docs/handoffs/20260602-0903-ecosystem-devops-implementer.md`.

## Findings
1. Severity: High. DB-backed account-specific login lockout requires a real schema/repository/auth-action phase and a new migration before any production rollout. Evidence: `docs/handoffs/20260602-0834-phase-3-42-auth-rate-limit-truth.md:6-7` explicitly excludes DB-backed account lockout from Phase 3.42; `docs/handoffs/20260602-0834-phase-3-42-auth-rate-limit-truth.md:90` classifies it as a future backend + DB + security phase; current identity schema has `users` and `sessions` but no account-lockout fields/table in `packages/db/src/schema.ts:15-50`; `apps/web/src/lib/db-store.ts:78-82` only finds the user and verifies the password hash. Recommendation: implement as an additive migration plus repository functions with race-safe updates and tests before wiring `loginAction`; do not treat it as a deployment/env-only change. Target part: DB schema, repositories, auth action rollout.

2. Severity: High. Production rollout ordering must apply and verify migrations before deploying a build that depends on lockout persistence. Evidence: `docs/DEPLOYMENT.md:378-386` requires generated migrations, `db:migrate`, `pg_dump` backup before prod migration, and rollback by restoring dump plus redeploying prior build; `packages/db/package.json:10-12` maps `db:generate`, `db:migrate`, and `db:seed`; existing migrations currently run through `0015_wet_cobalt_man.sql` in `packages/db/migrations/`; `docs/DEPLOYMENT.md:415-418` marks production `db:migrate` / `db:seed` and production deploy as NOT RUN. Recommendation: rollout sequence should be: generate/review additive migration, run full local gates, run real-PG throwaway migration/race acceptance, backup target DB, apply migration to preview, deploy lockout-aware preview build, run preview auth acceptance with redacted evidence, then repeat backup/migrate/deploy for production only with operator approval. Target part: deployment runbook and release checklist.

3. Severity: High. Preview validation is possible only as an approved DB-backed preview exercise, not during discovery and not by local `preview:safe`. Evidence: `docs/DEPLOYMENT.md:398-401` says raw-IP preview is DB-backed but not production; `docs/DEPLOYMENT.md:413-420` says preview DB commands are explicit-approval items and production nginx/shared-store auth throttling remains NOT RUN; `docs/DEPLOYMENT.md:426-430` forbids live server mutation, secret copying, SSH/tmux/systemd/process control, and server `.env` mutation during discovery; `package.json:26` exposes `preview:safe` as a local script only. Recommendation: keep this lane read-only; future preview lockout acceptance needs explicit operator approval, a disposable/non-sensitive test account, no secret capture, and evidence that does not print passwords, session cookies, email enumeration details, or server env. Target part: preview safety and no-live-mutation procedure.

4. Severity: Medium. No new env/config knob appears necessary for the core account-lockout state, but production config must already force the DB path. Evidence: `apps/web/src/lib/backend.ts:20-35` selects Postgres when `DATABASE_URL` is set and reports `backendMode`; `apps/web/src/lib/backend.ts:21-26` fails closed in production without `DATABASE_URL`; `.env.example:11-17` documents `DATABASE_URL` and the opt-in real-PG harness; `packages/config/src/env.ts:27-31` requires `DATABASE_URL`, `SESSION_SECRET`, and vault keys for config consumers. Recommendation: keep lockout thresholds as code constants or typed bounded config only if product/security requests tunability; do not add a disable switch. Production readiness still depends on real `DATABASE_URL` and migrated schema, not a lockout env flag. Target part: env/config boundary.

5. Severity: Medium. Current IP throttling and future account lockout must be reported as separate gates. Evidence: `apps/web/src/middleware.ts:28-43` uses a per-instance `Map` for IP-keyed throttling; `apps/web/src/middleware.ts:77-100` limits `POST /login` and `POST /register`; `tests/integration/auth-rate-limit-middleware.test.ts:33-71` verifies 429 behavior and production no-IP fail-closed behavior; `docs/PRODUCTION_BLOCKERS_CURRENT.md:7-10` says DB-backed account lockout remains separate hardening, not a raw-IP preview blocker. Recommendation: final phase reporting should keep "IP middleware 429 proof" distinct from "DB-backed account lockout migration/race/preview/prod proof"; do not mark account lockout green because the middleware gate is green. Target part: gate reporting.

6. Severity: Medium. CI cannot currently be treated as proof for this change. Evidence: `docs/DEPLOYMENT.md:351-365` says CI is staged but NOT RUN because the repository has no `.git` directory and no GitHub remote; `.github/workflows/ci.yml:1` repeats that CI is staged; `git status --short` from this workspace returned `fatal: not a git repository (or any of the parent directories): .git`; `package.json:37` defines local `ci:local`, which omits DB migrate/seed and e2e. Recommendation: for a lockout phase, report local gates and real-PG throwaway acceptance honestly; keep GitHub Actions CI as NOT RUN until the repo is initialized and a remote workflow has actually executed. Target part: CI/current workspace limitation.

7. Severity: Medium. The local gate runner is useful but insufficient for DB-backed lockout acceptance by itself. Evidence: `scripts/gates.mjs:13-18` documents `quick|core|full|build|e2e`; `scripts/gates.mjs:50-53` defines `full` as governance, smokes, lint, typecheck, secret scan, tests, `db:generate`, and build, with e2e separate; `docs/DEPLOYMENT.md:342-349` says the real-PG gate is RUN only when `REAL_POSTGRES_DATABASE_URL` points at a fresh `wtc_test*` DB and active tests pass. Recommendation: add/require focused lockout unit/integration tests plus a real-Postgres race test for concurrent failed login updates before acceptance; report `node scripts/gates.mjs full` separately from real-PG lockout proof. Target part: verification matrix.

## Decisions
- Treated this as a single read-only `ecosystem-devops-implementer` lane, not a broad multi-agent phase and not an N-agent audit claim.
- Wrote only the requested handoff file; did not edit product code, env templates, deployment docs, tests, middleware, package config, migrations, or CI config.
- Classified DB-backed account-specific login lockout as a future additive DB + backend + security implementation requiring migration, race-safe repository logic, generic user-facing responses, audit-safe events, and real-Postgres proof.
- Classified raw-IP preview validation, production migration/deploy, nginx/shared-store checks, and GitHub Actions CI as NOT RUN in this lane.
- Treated the workspace as not git-backed from this path after `git status --short` returned "not a git repository"; no git operations were attempted beyond that read-only check.

## Risks
- A build that expects new lockout columns/tables will fail or silently skip the intended control if deployed before `db:migrate` is applied to the active `DATABASE_URL`.
- Race-prone failed-login counters can undercount or over-lock without a real Postgres concurrency proof; PGlite-only coverage is not enough for production acceptance.
- Preview acceptance can leak sensitive auth details if evidence captures raw passwords, cookies, request bodies, or account-existence differences; evidence must be redacted and account-neutral.
- Nginx/IP middleware throttling can still be green while distributed attacks rotate IPs; account lockout must be tracked as its own gate.
- GitHub Actions CI remains unobserved until the workspace becomes a git repo with a remote and a real workflow run.

## Verification/tests
- RUN: read-only source/doc inspection of the requested files and related DB/auth selector files.
- RUN: `git status --short` only to verify current workspace git limitation; result was not a git repository.
- NOT RUN: `npm run ci:local` because this was a read-only devops lane and the task requested no product code edits or live mutation.
- NOT RUN: `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, Playwright, focused Vitest, `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`.
- NOT RUN: DB-backed account-lockout implementation, migration generation/application, real-Postgres throwaway lockout race proof, raw-IP preview auth lockout exercise, production migration/deploy, production nginx/domain/TLS cutover, nginx/shared-store auth throttling validation, GitHub Actions CI, live bot/exchange controls, Stripe/Axioma/LMS live preflights.

## Next actions
1. Backend + DB + security phase: add an additive lockout schema and repository API, implement generic login behavior, write audit-safe events, and include deterministic unit/integration coverage.
2. Add real-Postgres throwaway acceptance for account lockout race behavior using a `wtc_test*` database; do not report PGlite-only tests as real-PG proof.
3. Update deployment docs in a docs/devops lane with explicit lockout rollout ordering: backup, migrate, deploy, preview acceptance, rollback, and gate reporting.
4. Before any raw-IP preview or production exercise, get explicit operator approval and retain only redacted evidence with exact RUN/NOT RUN gate status.
