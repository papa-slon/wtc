# ecosystem-devops-implementer handoff

## Scope
Read-only Phase 3.47 local infrastructure feasibility audit for active real-Postgres proof. No file edits and no database
mutation by this auditor.

## Files inspected
`package.json`; `packages/db/package.json`; `docs/DEPLOYMENT.md`; `docker-compose.yml`; `.github/workflows/ci.yml`;
`.env.example`; `tests/integration/db-real-postgres.test.ts`; `packages/db/drizzle.config.ts`.

## Files changed
None - read-only audit.

## Findings
1. HIGH - Active real-Postgres proof cannot proceed without operator credentials or an operator-created throwaway DB URL.
   Local env presence check found `DATABASE_URL`, `REAL_POSTGRES_DATABASE_URL`, `SESSION_SECRET`, and `SECRET_VAULT_KEK`
   unset. Default `wtc:wtc` auth against native PG failed.
2. MEDIUM - Local native PostgreSQL 17 is feasible but not PATH-ready: TCP `127.0.0.1:5432` is open, and
   `C:\Program Files\PostgreSQL\17\bin\psql.exe --version` returned PostgreSQL 17.4. `psql`, Docker, and Docker Compose are
   not on PATH.
3. MEDIUM - Docker path is unavailable locally. Compose credentials do not authenticate to the existing native server.
4. MEDIUM - `ci:local` is not active real-PG proof; it omits deploy DB gates and skipped real-PG output is not acceptance.
5. LOW - DB command safety is mostly correct: Drizzle has no localhost fallback and requires explicit `DATABASE_URL`.

## Decisions
Do not run `db:migrate`, `db:seed`, create/drop database, Docker Compose, or the active real-PG harness in this read-only
audit. Use native PostgreSQL 17 by full binary path unless the operator adds it to PATH. Active proof needs credentials or a
precreated fresh `wtc_test*` URL.

## Risks
Existing local PG may be a non-WTC native instance. Raw migrations are not safe to rerun on a reused DB. Default no-env
harness output is NOT active proof.

## Verification/tests
RUN: repo orientation; package/doc/script inspection; Node `v24.15.0`; npm `11.12.1`; native PG client version;
TCP `127.0.0.1:5432`; env presence booleans; read-only auth attempts.

NOT RUN: `npm run db:migrate`, `npm run db:seed`, active real-PG harness, `docker compose up -d`, `npm run ci:local`.

## Next actions
1. Prefer a managed runner that accepts a maintenance/admin URL and creates/drops a generated `wtc_test*` DB.
2. Keep operator evidence redacted and command-focused.
