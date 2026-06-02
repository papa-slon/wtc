# TEST_PLAN_PHASE2.md — WTC Ecosystem Platform Phase 2

_Unowned planning document. Authoritative detail is in
`docs/handoffs/20260530-0126-ecosystem-tests-runner.md`._

## Baseline (Phase 1.7)

- Vitest: 93 pass / 5 skip across 14 files
- E2E: 14/14 (desktop + mobile, Chromium)
- Coverage: 26.92% stmt / 64.67% branch
- Build: 31/31 pages

## Phase 2 target additions

### New integration test files (all in `tests/integration/`)

| File | Area | Blocked on |
|------|------|-----------|
| `bot-config-ownership.test.ts` | Bot-config cross-user isolation, exchange-key ownership | nothing |
| `exchange-key-vault.test.ts` | Vault: ciphertext only in DB, no plaintext column | nothing |
| `tortila-config.test.ts` | Tortila config save/load round-trip, ownership | nothing |
| `legacy-config.test.ts` | Legacy config save/load round-trip, ownership | nothing |
| `analytics-aggregation.test.ts` | computeMetrics, computeDrawdown, combined bot aggregation | nothing |
| `tv-access-full.test.ts` | TV submit/grant/revoke audit trail, edge cases | nothing |
| `lms-full.test.ts` | LMS full contract (thin cases now; enrollment/progress skipIf pending 0002) | Phase 1.8 migration `0002` for 7/15 cases |
| `billing-entitlement-states.test.ts` | DB-layer entitlement transitions, reconcile, bundle | nothing |
| `rbac-matrix.test.ts` | RBAC matrix completeness for Phase-2 resources | nothing |
| `csrf-new-actions.test.ts` | CSRF coverage for all new Phase-2 server actions | nothing |

### Real-PG harness fix (existing file)

`tests/integration/db-real-postgres.test.ts` — add DB-name safety guard in `beforeAll` before any
migration SQL: reject any database name that does not match `wtc_test` or `wtc_test_*`.

### New e2e spec files (all in `tests/e2e/`)

| File | Coverage |
|------|---------|
| `tests/e2e/smoke.spec.ts` (extend) | Product pages (tortila/terminal/indicators/education/list), all bot sub-pages, billing, support |
| `tests/e2e/tv-access.spec.ts` (new) | User TV request form, admin grant, admin revoke |
| `tests/e2e/education.spec.ts` (new) | Student view, teacher dashboard, teacher course create, admin panel, student cannot reach /teacher |
| `tests/e2e/billing-entitlement.spec.ts` (new) | User billing page, admin grant/revoke actions |
| `tests/e2e/bot-config.spec.ts` (new) | Settings save/load, simulated-data banner, risk warnings |

## Gate sequence (Wave 2)

```
1.  npm run governance:check          RUN
2.  npm run check:core                RUN
3.  npm run lint                      RUN
4.  npm run typecheck                 RUN
5.  npm run typecheck -w @wtc/web     RUN
6.  npm run secret:scan               RUN
7.  npm test                          RUN  (PGlite — no DB creds needed)
8.  npm run coverage                  RUN
9.  npm run build -w @wtc/web         RUN
10. npm run e2e                       RUN  (Chromium; in-memory dev server :3100)
11. npm run db:generate -w @wtc/db    RUN  (after schema changes; no DB creds needed)
12. npm run db:migrate -w @wtc/db     NOT RUN  (no DATABASE_URL / Postgres credentials)
13. npm run db:seed   -w @wtc/db      NOT RUN  (no DATABASE_URL)
14. real-PG harness (REAL_POSTGRES_DATABASE_URL=...) NOT RUN  (no credentials)
```

## Coverage risk summary

| Path | Risk | Mitigation |
|------|------|-----------|
| Billing webhook route handler (`apps/web`, excluded from Vitest) | HIGH | Playwright smoke + extract handler logic to package |
| `reconcileAllEntitlements` worker path | MEDIUM | Add to `billing-entitlement-states.test.ts` |
| `sweepTvExpiry` concurrent safety | MEDIUM | Only provable under real Postgres (real-PG harness) |
| LMS `markComplete`/`enrollUser` (Phase 1.8) | MEDIUM | Skipif until migration `0002` |
| Exchange key vault → app route binding | MEDIUM | `exchange-key-vault.test.ts` covers the chain |
| RBAC teacher ownership at route layer | LOW | E2e cross-teacher mutation test (requires two seeded teacher accounts) |
