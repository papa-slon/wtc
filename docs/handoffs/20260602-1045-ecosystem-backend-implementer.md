# ecosystem-backend-implementer handoff
## Scope
Read-only Phase 3.45 backend audit after admin account unlock. Scope compared registration audit logging versus review notification workflow and identified the smallest safe backend/auth slice without production credentials.
## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/SECURITY_MODEL.md`
- `docs/RBAC_MATRIX.md`
- `packages/audit/src/audit.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/features/billing/webhook-handler.ts`
- `tests/integration/auth-error-copy.test.ts`
- `tests/integration/csrf-coverage.test.ts`
## Files changed
None - read-only audit
## Findings
1. High - Registration audit logging is the smallest safe Phase 3.45 backend slice. Evidence: docs left registration audit open and `registerAction()` validated, created a user, set session, and redirected without a success audit. Recommendation: implement success-only `auth.register`. Target part: public registration.
2. High - Durable registration audit belongs in `@wtc/db`, not React or a post-commit web action. Evidence: `createUser()` already owns duplicate check, user insert, and role insert in one transaction. Recommendation: insert audit after roles and before transaction return. Target part: repository.
3. High - `auth.register` must be registered before writing. Evidence: audit docs require new actions in `AUDIT_ACTIONS` before use. Recommendation: update `@wtc/audit` and docs. Target part: audit registry.
4. Medium - Public auth boundaries must remain neutral. Evidence: `/register` is public and rate-limited, and CSRF tests intentionally exempt pre-session login/register. Recommendation: keep `registerAction()` thin and avoid account-specific copy. Target part: server action.
5. Medium - Review notification workflow is larger and riskier. Evidence: notification rows do not have target/idempotency keys. Recommendation: defer notifications unless dedupe semantics are in scope. Target part: notifications.
6. Medium - Tests should filter by action rather than total audit counts. Evidence: many tests create users. Recommendation: add focused registration audit assertions and adjust brittle total-count tests only if needed. Target part: test suite.
## Decisions
- Use action code `auth.register`.
- Audit only successful account creation in this slice.
- Keep payload minimal: actor/target user id, role, result, and non-secret metadata.
- No migration expected.
## Risks
- Post-commit audit can leave unaudited users.
- Including email/password/displayName unnecessarily expands audit PII surface.
- Bundling review notification can create duplicate/storm behavior.
- Workspace is not git-backed, so no branch/commit readiness can be claimed.
## Verification/tests
RUN by this auditor: read-only source/doc inspection and `git status` check.

NOT RUN by this auditor: tests, typecheck, lint, secret scan, `db:generate`, full gates, Playwright, real Postgres, live preview, production deploy, or CI.
## Next actions
1. Add `auth.register`.
2. Add in-transaction registration audit in `createUser()`.
3. Add PGlite coverage and neutral-copy tests.
4. Reconcile audit/status docs.
