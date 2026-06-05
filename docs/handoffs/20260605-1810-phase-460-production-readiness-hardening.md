# Phase 4.60 production-readiness hardening handoff
## Scope
Phase 4.60 reconciles the latest local Tortila proof with production-readiness blockers without enabling live control or
pretending that local loopback evidence is production. The phase used four read-only agent handoffs before implementation:

- [docs/handoffs/20260605-1810-tortila-canonical-source-auditor.md](20260605-1810-tortila-canonical-source-auditor.md)
- [docs/handoffs/20260605-1810-production-deploy-readiness-auditor.md](20260605-1810-production-deploy-readiness-auditor.md)
- [docs/handoffs/20260605-1810-legacy-source-final-auditor.md](20260605-1810-legacy-source-final-auditor.md)
- [docs/handoffs/20260605-1810-final-gate-gap-auditor.md](20260605-1810-final-gate-gap-auditor.md)

Boundaries honored: no production DB mutation, no live deploy, no SSH/systemd/tmux/process control, no live exchange or
provider probes, no live bot start/stop/apply-config/test-connection, no `/api/marks`, no `/api/overview` ingestion, and no
raw secret/DSN/token/password output.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/DEPLOYMENT.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `.env.example`
- `.github/workflows/ci.yml`
- `package.json`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/tortila-real-read-managed-runner.test.ts`
- `tests/integration/web-health-route.test.ts`
- `apps/web/src/app/api/health/route.ts`
- Four Phase 4.60 read-only handoffs linked above

## Files changed
- `.env.example`
- `.github/workflows/ci.yml`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/DEPLOYMENT.md`
- `apps/web/src/app/api/health/route.ts`
- `tests/integration/web-health-route.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-1810-phase-460-production-readiness-hardening.md`

## Findings
1. Severity P0 - Full production-ready status is still not claimable. Evidence: the production auditor keeps CI/deploy,
   production journal secret provisioning, firewall/network proof, authorized probes, monitoring/burn-in, and exact-tree
   release proof NOT RUN; the Legacy auditor keeps Legacy realized analytics/import blocked by missing source proof; the
   canonical Tortila auditor found no git-backed local canonical bot repo. Recommendation: keep local gates, production
   deploy gates, canonical source landing, and Legacy source proof as separate named gates.

2. Severity P0 - Production-like real adapter mode needed a stronger fail-closed fence. Evidence: WTC already required
   `JOURNAL_READ_TOKEN` for production non-mock mode, but production-like staging could still rely on a default loopback
   journal URL. Resolution: `packages/config/src/env.ts` now treats `NODE_ENV=production` or `APP_ENV=staging|production`
   as production-like and requires both `JOURNAL_READ_TOKEN` and explicit `TORTILA_JOURNAL_URL` whenever
   `BOT_ADAPTER_MODE` is not `mock`; `packages/config/src/env.test.ts` pins positive and negative cases.

3. Severity P0 - Worker wrong-token behavior needed explicit proof. Resolution:
   `tests/integration/worker-tortila-snapshot.test.ts` now stubs a `401` journal response in read-only mode and proves the
   worker reports error, performs no metric/position/trade imports, records fail-closed health detail, and does not leak the
   configured token.

4. Severity P1 - WTC contract docs still risked over- or under-claiming Tortila auth. Resolution:
   `docs/CONTRACTS/tortila-adapter.md` now states local adjacent `../bot_tortila` token proof exists, but canonical
   git-backed source landing plus production secret/firewall/deploy proof remain required before production read-only mode.
   The same contract keeps WTC ingestion on `/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list`; it keeps
   `/api/overview` and `/api/marks` excluded.

5. Severity P1 - Hosting needed a minimal non-secret liveness surface. Resolution:
   `apps/web/src/app/api/health/route.ts` adds `GET` and `HEAD` liveness responses with `cache-control: no-store`. Static
   tests prove the route does not read env, DB, adapter, token, authorization, bearer, or raw health details.

## Decisions
1. Local production-readiness hardening can advance, but production deployment cannot be claimed until exact-tree local
   gates, CI/PR or branch Actions, canary/deploy, journal secret/firewall probes, and monitoring are observed.
2. The adjacent `../bot_tortila` token patch is valid local proof, not canonical source-control landing. Canonical landing
   remains blocked until the real git repo/path/remote/branch/source bundle is provided.
3. Legacy closed-trade importer, realized PnL, win rate, profit factor, fee/funding attribution, and equity curve stay
   blocked by source proof. Active orders, slots, open positions, FILLED reconciliation, Tortila rows, GTE journals, and
   test fixtures remain invalid substitutes.
4. Live controls, exchange/provider probes, test-connection, `/api/marks`, and `/api/overview` are not local completion
   shortcuts and remain out of scope.

## Risks
1. A future release could overclaim Phase 4.60 local hardening as production proof. Keep RUN/NOT RUN gates explicit.
2. The broad dirty tree means every release must stage intentionally and verify the exact tree, not rely on prior phase
   summaries.
3. If a deploy sets real adapter mode without the canonical Tortila source/auth/firewall proof, WTC may point at an
   unapproved journal service.
4. If Legacy source proof is bypassed, the product could show fabricated realized analytics from active-state snapshots.

## Verification/tests
RUN before this aggregate was written:
1. `npx vitest run packages/config/src/env.test.ts` - PASS (`41` tests).
2. `npx vitest run tests/integration/worker-tortila-snapshot.test.ts` - PASS (`8` tests).
3. `npx vitest run tests/integration/tortila-real-read-managed-runner.test.ts` - PASS (`4` tests).
4. `npx vitest run packages/bot-adapters/src/adapters.test.ts packages/bot-adapters/src/__tests__/legacy-blocked.test.ts` - PASS (`54` tests).
5. Manual production-like config probe with `BOT_ADAPTER_MODE=read-only`, explicit `TORTILA_JOURNAL_URL`, and token - PASS.
6. Manual production-like missing-journal-url probe - PASS, refused.
7. Manual production-like missing-token probe - PASS, refused.
8. `npx vitest run tests/integration/web-health-route.test.ts` - PASS (`3` tests).
9. Focused Phase 4.60 pack - PASS (`92` tests across config, worker Tortila snapshot, runner static, web health route,
   two-bot continuity contract, and bot read-safety static suites).

RUN after this aggregate was created and before phase close:
1. `npm run typecheck -w @wtc/web` - PASS.
2. `npm run typecheck -w @wtc/worker` - PASS.
3. `npm run typecheck` - PASS.
4. `npm run build -w @wtc/web` - PASS; Next build includes `/api/health`.
5. `npm run lint` - PASS.
6. `npm run secret:scan` - PASS before and after generated acceptance-log redaction.
7. `npm run governance:check` - PASS with `0` errors, `1` known historical warning; current aggregate cites all four Phase 4.60 per-agent handoffs.
8. `git diff --check` - PASS.
9. `npm run ci:local` - completed through check/core, governance, lint, root/web/worker typecheck, secret scan, root Vitest (`133` files passed, `1134` tests passed, `10` skipped), and web build. The direct `accept:bots:local` run below also records `ci:local exit=0`.
10. `npm run accept:bots:local` - PASS (`5` gates, `0` failing): `ci:local exit=0`, `worker-smoke exit=0`, `worker-continuity-fixture exit=0`, `bot-admin-e2e exit=0` with `65` rendered tests passed on `E2E_PORT=3470`, and `visual-inventory exit=0` with `117` image files and no blocked binary/container artifacts.
11. `npm run accept:tortila:real-read:managed` - first refused safely without `TORTILA_REAL_READ_ADMIN_DATABASE_URL`; then PASS against a disposable local Postgres lane on `127.0.0.1:55439`. Proof values: `missingToken=401`, `wrongToken=401`, `bearerAllowedEndpoints=4`, `tokenHeader=ok`, `sourceAdapter=tortila`, `readState=ok`, `tradesImported=2`, `positionsSnapshotted=1`, `marksRequests=0`; throwaway DB was dropped and temporary Tortila files were cleaned. The temporary Postgres server was stopped and its PGDATA directory under `.codex-logs` was removed.
12. Phase 4.60 background/read-only agents were closed after their handoffs were integrated. Closed IDs:
    `019e9787-378f-7cf2-833f-077d7a6fe514`, `019e9787-8ca7-74a2-88d3-1a269df6bb48`,
    `019e9787-de5e-7b83-b873-dc4ca7656236`, and `019e9788-2b32-7c93-8d8f-a4184480abb1`.

NOT RUN and not claimable in this phase yet:
1. GitHub Actions for a committed exact tree.
2. Production DB migration/seed, production deploy, canary switch, nginx/TLS/firewall checks, monitoring burn-in.
3. Production Tortila journal secret provisioning and authorized positive/negative network probes.
4. Canonical git-backed Tortila source landing and bot-side pytest/ruff from that canonical repo.
5. Legacy closed-trade source proof/import implementation.
6. Live bot controls, exchange/provider probes, test-connection, `/api/marks`, and `/api/overview`.

## Next actions
1. Continue to the next non-looping slice: exact-tree release/CI proof, canonical Tortila
   source landing, or production auth/firewall/deploy proof. Do not add another local Legacy source-proof polish pass.
