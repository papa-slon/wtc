# Agent Handoff - deploy-production-readiness-auditor

## Scope
Read-only audit of production-readiness, LAN preview safety, real-Postgres blockers, and live-bot boundaries.

## Findings
- Local preview is safe only as short-lived dev/LAN preview with `BOT_ADAPTER_MODE=mock`; not production.
- Real Postgres acceptance remains the main blocker: `db:migrate`, `db:seed`, and `tests/integration/db-real-postgres.test.ts` are still NOT RUN without a throwaway `REAL_POSTGRES_DATABASE_URL`.
- `db:seed` course idempotency remains a deploy-runbook risk.
- No live server, SSH, bot, exchange, worker, or live adapter was touched.

## Recommendation
After the commercial checkout slice, run a PG production-readiness pass: seed idempotency, throwaway real-PG acceptance, and a safe IP-preview script/profile.

## Files inspected
- `docs/PRODUCTION_BLOCKERS.md`
- `docs/STATUS.md`
- `docs/DEPLOYMENT.md`
- `tests/integration/db-real-postgres.test.ts`
- `packages/db/src/seed.ts`

## Files changed
- None by this auditor.

## Decisions
- Treat IP preview as dev/LAN-only until production blockers clear.

## Risks
- Real-PG and seed idempotency remain unresolved.

## Verification/tests
- Read-only inspection; governance was also checked by the main operator flow.

## Next actions
- Run a production-readiness pass after the billing checkout slice.
