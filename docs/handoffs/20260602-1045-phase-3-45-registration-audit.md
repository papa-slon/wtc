# Phase 3.45 Registration audit handoff
## Scope
Implement and verify the next local auth audit slice after Phase 3.44 admin account unlock: successful public DB-backed registration now writes `auth.register` in the same DB transaction that creates the user and roles, with demo-mode parity and neutral public auth copy preserved. This phase did not mutate live servers, preview services, production databases, bot services, Stripe, Axioma, LMS object stores, scanner endpoints, nginx, systemd, or GitHub CI. The workspace is not currently git-backed (`git status` reports `fatal: not a git repository`), so no commit/PR was created.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-1045-ecosystem-security-auditor.md](20260602-1045-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-1045-ecosystem-db-architect.md](20260602-1045-ecosystem-db-architect.md)
- [docs/handoffs/20260602-1045-ecosystem-backend-implementer.md](20260602-1045-ecosystem-backend-implementer.md)
- [docs/handoffs/20260602-1045-ecosystem-frontend-implementer.md](20260602-1045-ecosystem-frontend-implementer.md)
- [docs/handoffs/20260602-1045-ecosystem-tests-runner.md](20260602-1045-ecosystem-tests-runner.md)
- [docs/handoffs/20260602-1045-ecosystem-platform-architect.md](20260602-1045-ecosystem-platform-architect.md)
- [docs/handoffs/20260602-1045-ecosystem-devops-implementer.md](20260602-1045-ecosystem-devops-implementer.md)

All seven background agents completed; the agent threads that remained addressable from this session were closed after their results were collected.
## Files inspected
- `packages/audit/src/audit.ts`
- `packages/audit/src/audit.test.ts`
- `packages/audit/src/__smoke__.ts`
- `packages/db/src/repositories.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `tests/integration/db-persistence.test.ts`
- `tests/integration/auth-error-copy.test.ts`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/RBAC_MATRIX.md`
- `docs/SECURITY_MODEL.md`
- `docs/SITEMAP.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
## Files changed
- `packages/audit/src/audit.ts`
- `packages/audit/src/audit.test.ts`
- `packages/audit/src/__smoke__.ts`
- `packages/db/src/repositories.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `tests/integration/db-persistence.test.ts`
- `tests/integration/auth-error-copy.test.ts`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/RBAC_MATRIX.md`
- `docs/SECURITY_MODEL.md`
- `docs/SITEMAP.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260602-1045-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-1045-ecosystem-db-architect.md`
- `docs/handoffs/20260602-1045-ecosystem-backend-implementer.md`
- `docs/handoffs/20260602-1045-ecosystem-frontend-implementer.md`
- `docs/handoffs/20260602-1045-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-1045-ecosystem-platform-architect.md`
- `docs/handoffs/20260602-1045-ecosystem-devops-implementer.md`
- this aggregate handoff.
## Findings
1. High - Registration lacked a durable success audit before this phase. Implemented: `auth.register` is now a typed audit action, and DB-backed public registration passes `auditRegistration: true` into `createUser()`. Target part: auth audit trail.
2. High - Registration audit must be atomic with account creation. Implemented: `createUser()` inserts the user, inserts roles, and only then writes `auth.register` in the same DB transaction when `auditRegistration` is set. Target part: identity repository.
3. High - Public registration copy must remain neutral. Implemented: public register/login action redirects and copy remain on stable generic codes; static tests assert the action does not hardcode `auth.register` or expose duplicate-account text. Target part: public auth UX.
4. High - Registration audit payload must not retain credentials or account identifiers beyond the target id. Implemented: audit payload contains `roles` and `hasDisplayName` only; focused tests assert no password hash or submitted email in the event. Target part: audit payload.
5. Medium - Demo mode needs parity for local preview behavior. Implemented: `apps/web/src/lib/demo.ts` writes the same `auth.register` event after creating the user. Target part: memory-mode parity.
6. Medium - No migration was needed. Verified: `npm run db:generate -w @wtc/db` reported 43 tables and no schema changes. Target part: migrations.
7. Medium - Review notification workflow remains separate. Decision: do not bundle account-review in-app/email notifications into this phase because notification recipient/idempotency semantics need a dedicated slice. Target part: next phase planning.
## Decisions
- Use `auth.register` for successful public registration only.
- Keep invalid-form and duplicate-email registration outcomes on generic browser copy and do not add failure audit in this slice.
- Keep audit metadata minimal: `roles` and `hasDisplayName`; no email, password, password hash, display name, session token, CSRF token, or raw request body.
- Keep registration audit opt-in in the generic `createUser()` repository so fixture/seed callers do not inflate audit logs unintentionally; the public DB-backed registration adapter opts in.
- Do not add a schema migration or env variable.
## Risks
- Active real-Postgres auth race proof was not run because no `REAL_POSTGRES_DATABASE_URL` was supplied.
- The opt-in real-Postgres test harness still has stale table-count proof text/assertion that should be fixed before relying on it for an active auth race gate.
- Email/in-app review notification workflow remains unimplemented.
- Production nginx/shared-store throttling, trusted proxy proof, append-only audit DB role verification, production DB rollout, live deploy, monitoring, and GitHub CI are still not run.
## Verification/tests
- Focused registration/auth Vitest:
  `npm test -- packages/audit/src/audit.test.ts tests/integration/db-persistence.test.ts tests/integration/auth-error-copy.test.ts` - PASS (`27` passed).
- `npm run check:core` - PASS.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run lint` - PASS.
- `npm run db:generate -w @wtc/db` - PASS, 43 tables, no schema drift.
- `node scripts/gates.mjs full` - PASS (9/9 gates).
- `node scripts/gates.mjs e2e` - PASS (`44` passed).
- `npm run worker:smoke` - PASS.
- Final `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS (`2` text files, `68` images, `0` blocked containers, `2`
  missing roots, `70` total artifact files, `0` dynamic markers).
- Final `npm run secret:scan` - PASS.
- Final `npm run governance:check` - PASS (current phase `20260602-1045`, 7 cited per-agent handoffs all present, 0 errors
  / 1 known historical warning).
- NOT RUN: active `REAL_POSTGRES_DATABASE_URL` auth race proof, production nginx/shared-store throttling proof, production DB rollout/live deploy, email notification/review workflow, password reset/change/verify-email route lockout, append-only audit DB role verification, GitHub Actions CI, live server mutation, live bot mutation, Stripe live/test-provider acceptance, Axioma live acceptance, LMS live object-store or scanner acceptance.
## Next actions
1. Fix the stale real-Postgres table-count assertion before using the opt-in real-PG auth race gate as acceptance evidence.
2. Add local account-review in-app notification workflow in a separate phase: first-transition idempotency, admin/affected-user recipient policy, and no external delivery credentials.
3. Verify production nginx/shared-store auth throttling and trusted proxy header normalization only with explicit operator approval and redacted evidence.
4. Prove append-only audit DB role permissions, production DB rollout, live deploy, GitHub CI, and production monitoring in separate phases.
