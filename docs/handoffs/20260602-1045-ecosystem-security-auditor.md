# ecosystem-security-auditor handoff
## Scope
Read-only Phase 3.45 security audit for local registration audit logging after Phase 3.44 admin account unlock. Scope covered auth audit semantics, CSRF/RBAC boundaries, forbidden audit payload leaks, and whether account-review notification should be bundled. No live services, production credentials, Stripe, Axioma, bot, object-store, scanner, nginx, systemd, or CI were touched.
## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260602-0940-phase-3-44-admin-account-unlock.md`
- `docs/SECURITY_MODEL.md`
- `docs/RBAC_MATRIX.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/app/admin/users/page.tsx`
- `tests/integration/db-persistence.test.ts`
- `tests/integration/auth-error-copy.test.ts`
## Files changed
None - read-only audit
## Findings
1. High - Registration audit is the correct next local auth/security slice. Evidence: Phase 3.44 still carried registration audit as a next action, while current code now includes `auth.register` in `packages/audit/src/audit.ts`, an in-transaction DB audit insert in `packages/db/src/repositories.ts`, DB web opt-in in `apps/web/src/lib/db-store.ts`, and demo parity in `apps/web/src/lib/demo.ts`. Recommendation: accept this as Phase 3.45 only after gates and docs truth reconciliation. Target part: auth/register audit trail.
2. Medium - Documentation was stale relative to code. Evidence: `docs/AUDIT_LOG_SCHEMA.md` listed login/login_failed/logout but not register, and `docs/STATUS.md`/`docs/NEXT_ACTIONS.md` still listed registration audit as open. Recommendation: update docs only after current-session gates pass. Target part: docs truth.
3. High - Account-review notification is a valid next slice but should not be bundled. Evidence: review marker policy exists in `docs/SECURITY_MODEL.md`, notifications table/repository exist, and admin users already project review state, but email/review workflow remains target-only. Recommendation: separate local in-app notification/idempotency phase. Target part: account-review workflow.
4. Medium - Public login/register CSRF policy should stay stable. Evidence: pre-session `loginAction` and `registerAction` are intentionally CSRF-exempt while authenticated admin actions use RBAC + CSRF + Zod. Recommendation: do not change CSRF semantics for registration audit. Target part: auth forms.
5. High - Registration audit payload must stay non-secret. Evidence: current payload is only `roles` and `hasDisplayName`; redaction catches secret-looking keys/values; tests assert no password hash or submitted email. Recommendation: never log password, password hash, session token, duplicate submitted email, raw identifiers, or notification credentials. Target part: audit payload.
## Decisions
- Keep Phase 3.45 limited to registration audit acceptance and docs reconciliation.
- Do not start account-review notifications until registration audit is accepted green.
- Keep pre-session auth CSRF exemption unchanged.
## Risks
- Code/docs disagreement can produce false open or false green claims if docs are not reconciled.
- Notification workflow needs idempotency and failure semantics; it must not block durable review-marker state.
- Workspace is not git-backed, so no branch, commit, PR, or CI status can be claimed.
## Verification/tests
RUN by this auditor: read-only source/doc inspection and targeted searches.

NOT RUN by this auditor: `npm test`, `npm run check:core`, typecheck, lint, `db:generate`, full/e2e gates, secret scan, governance check, real-Postgres proof, live server mutation, and external provider gates.
## Next actions
1. Update audit/security/status docs after gates.
2. Run focused registration/auth tests plus local full gates.
3. Plan account-review notification as a separate phase with first-transition idempotency.
