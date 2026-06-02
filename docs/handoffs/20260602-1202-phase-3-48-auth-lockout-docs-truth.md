# Phase 3.48 auth lockout docs truth handoff

## Scope
Closed docs-truth drift around migration `0016_colorful_lyja` auth lockout fields and the implemented
`auth.account_unlock` audit action. This was a docs-only phase: no schema/runtime changes, no DB mutation, no active real-PG
proof.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-1202-ecosystem-db-architect.md](20260602-1202-ecosystem-db-architect.md)
- [docs/handoffs/20260602-1202-ecosystem-security-auditor.md](20260602-1202-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-1202-ecosystem-tests-runner.md](20260602-1202-ecosystem-tests-runner.md)
- [docs/handoffs/20260602-1202-ecosystem-platform-architect.md](20260602-1202-ecosystem-platform-architect.md)

All four background agents completed and were closed after their results were collected.

## Files inspected
`AGENTS.md`; `docs/SESSION_PROTOCOL.md`; `docs/DATA_MODEL.md`; `docs/AUDIT_LOG_SCHEMA.md`; `docs/SECURITY_MODEL.md`;
`docs/RBAC_MATRIX.md`; `docs/DOMAIN_MODEL.md`; `docs/STATUS.md`; `docs/NEXT_ACTIONS.md`; `docs/IMPLEMENTED_FILES.md`;
`packages/db/src/schema.ts`; `packages/db/src/repositories.ts`; `packages/db/migrations/0016_colorful_lyja.sql`;
`packages/db/migrations/meta/0016_snapshot.json`; `packages/audit/src/audit.ts`; focused auth/admin tests; prior Phase 3.43,
3.44, 3.46, and 3.47 handoffs.

## Files changed
- `docs/DATA_MODEL.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260602-1202-ecosystem-db-architect.md`
- `docs/handoffs/20260602-1202-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-1202-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-1202-ecosystem-platform-architect.md`
- `docs/handoffs/20260602-1202-phase-3-48-auth-lockout-docs-truth.md`

## Findings
1. MEDIUM - `DATA_MODEL.md` active `users` table omitted the eight REAL-in-0016 lockout columns while schema/migration already
   contained them.
2. LOW - `DATA_MODEL.md` email unique/index notes were target-era and contradicted current `users_email_idx` on `email`.
3. MEDIUM - `AUDIT_LOG_SCHEMA.md` still listed implemented `auth.account_unlock` under target-only auth additions.
4. MEDIUM - `auth.account_unlock` needed an explicit before/after snapshot allowlist to prevent future full user-row or
   public-auth leak drift.
5. HIGH - Active real-PG proof remains NOT RUN without operator credentials; this docs phase does not change that state.

## Decisions
- Treat `failed_login_15m_count`, `failed_login_15m_reset_at`, `failed_login_60m_count`,
  `failed_login_60m_reset_at`, `failed_login_total_count`, `last_failed_login_at`, `account_locked_until`, and
  `account_lockout_review_required_at` as REAL-in-0016 `users` columns.
- Keep richer identity fields such as `email_confirmed`, `locale`, `updated_at`, `last_login_at`, and `deleted_at` as
  TARGET-only unless a later migration adds them.
- Mark `auth.account_unlock` implemented in audit docs.
- Audit unlock snapshots may include only lockout state fields, `after.unlocked = true`, and the validated admin reason.
- Do not claim real-PG, production, CI, or deploy readiness.

## Risks
Future routes that expose DB user rows directly could leak `passwordHash` plus lockout internals. The docs now state the
intended boundary, but code review discipline still has to enforce it.

## Verification/tests
RUN:
- `npm run db:generate -w @wtc/db` - PASS, 43 tables, no schema changes.
- `npm run governance:check` - PASS (current phase `20260602-1202`, 4 cited per-agent handoffs all present, 0 errors / 1
  known historical warning).
- `npm run secret:scan` - PASS.
- `node scripts/gates.mjs full` - PASS (9/9: governance, check:core, lint, typecheck, typecheck-web, secret:scan, test,
  db:generate, build).

NOT RUN:
- Active real-PG managed proof - no `REAL_POSTGRES_ADMIN_DATABASE_URL`.
- Manual `REAL_POSTGRES_DATABASE_URL` harness - no throwaway DB credentials.
- `node scripts/gates.mjs e2e` - docs-only phase with no UI/browser code change.
- Preview/prod DB rollout, live server mutation, live bot mutation, live provider acceptance, GitHub Actions CI.

## Next actions
1. Next production-readiness proof remains active real-PG managed run with operator credentials.
