# ecosystem-tests-runner handoff
## Scope
Read-only verification planning lane for phase epoch `20260601-1907`. Scope: exact local-only test plan for TradingView task uniqueness and Axioma consume/replay/download readiness while avoiding live services. No source code, migrations, fixtures, focused tests, full gates, e2e, live Axioma, live TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or production operations were run. The only write from this lane is this canonical handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260601-1841-phase-3-9-route-repair-config-readiness.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `package.json`
- `scripts/gates.mjs`
- `vitest.config.ts`
- `playwright.config.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/axioma-jwks-readiness.ts`
- `apps/web/src/features/terminal/loader.ts`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `packages/axioma-bridge/src/bridge.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/handoff.test.ts`
- `packages/axioma-bridge/src/es256.test.ts`
- `packages/axioma-bridge/src/signer.test.ts`
- `tests/integration/tv-access-hardening.test.ts`
- `tests/integration/db-tv-expiring.test.ts`
- `tests/integration/db-axioma-jti.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/axioma-jwks-readiness.test.ts`
- `tests/integration/axioma-handoff-snapshot.test.ts`

## Files changed
None - read-only audit

## Findings
1. HIGH - Evidence: phase 3.9 explicitly leaves TradingView task uniqueness open (`docs/handoffs/20260601-1841-phase-3-9-route-repair-config-readiness.md:47`); the task table definition has no `(request_id, kind)` unique index (`packages/db/src/schema.ts:172`); the repair path still performs a read-then-insert guard (`packages/db/src/repositories.ts:375` to `packages/db/src/repositories.ts:380`); current tests prove sequential idempotency only (`tests/integration/tv-access-hardening.test.ts:127` to `tests/integration/tv-access-hardening.test.ts:134`). Recommendation: before claiming task uniqueness, add a DB-level unique guard for one task per `(request_id, kind)` and add a PGlite test that attempts a duplicate revoke task insert for the same request. Target part: TradingView task uniqueness.
2. HIGH - Evidence: current worker wiring reports repaired TV tasks (`apps/worker/src/index.ts:52` and `apps/worker/src/index.ts:59`), but there is no test that a worker tick against a historical partial row returns `tvTasksRepaired === 1` and leaves exactly one revoke task. Recommendation: add a focused worker-tick integration case seeded with `atomicRevokeTv(..., { queueExternalRevokeTask: false })`, then run `runDbWorkerTick(db, now, { BOT_ADAPTER_MODE: 'mock' })` and assert both the return payload and task count. Target part: TradingView task uniqueness through the real worker path.
3. HIGH - Evidence: the only Axioma API route files under `apps/web/src/app/api/axioma` are `download/route.ts` and `journal-handoff/route.ts`; the token spec defines an optional production consume endpoint `POST /api/axioma/jti/consume` (`docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:220` to `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:232`); repository tests cover `consumeHandoffJti` first-use, replay, expired, unknown, and revoked cases (`tests/integration/db-axioma-jti.test.ts:63` to `tests/integration/db-axioma-jti.test.ts:99`) but no local route/helper harness exists. Recommendation: if the next phase implements the consume route, add a no-live route-handler test for service-token auth, malformed JSON, first consume `200`, replay `409`, unknown `404`, expired/revoked denial, audit action naming, and no raw JWT in logs or responses. Target part: Axioma consume/replay readiness.
4. HIGH - Evidence: Axioma download currently fails closed after auth, entitlement, DB, flag, bridge token, and ES256 readiness (`apps/web/src/app/api/axioma/download/route.ts:19` to `apps/web/src/app/api/axioma/download/route.ts:37`) and intentionally does not fetch live Axioma (`tests/integration/axioma-skeleton-static.test.ts:29` to `tests/integration/axioma-skeleton-static.test.ts:36`). The contract still requires a single-use download token/proxy lifecycle before production wiring (`docs/CONTRACTS/axioma-bridge.md:230` to `docs/CONTRACTS/axioma-bridge.md:247`). Recommendation: keep the current fail-closed test, then add local handler tests for a mock streamed installer path only after a token model exists: issue token, stream with mocked fetch, mark consumed, reject reuse/expiry with `410`, and verify audit redaction. Target part: Axioma download readiness.
5. MEDIUM - Evidence: local Axioma signing/JWKS coverage is strong for primitives (`tests/integration/axioma-jwks-readiness.test.ts:30` to `tests/integration/axioma-jwks-readiness.test.ts:78`, `packages/axioma-bridge/src/signer.test.ts:88` to `packages/axioma-bridge/src/signer.test.ts:103`, `tests/integration/axioma-handoff-snapshot.test.ts:15` to `tests/integration/axioma-handoff-snapshot.test.ts:48`), but CTAs remain disabled by design (`apps/web/src/features/terminal/loader.ts:108`, `apps/web/src/features/terminal/loader.ts:122`) and phase 3.9 leaves B4 activation incomplete (`docs/handoffs/20260601-1841-phase-3-9-route-repair-config-readiness.md:46`). Recommendation: do not flip `bridgeActionsImplemented` or claim B4 until consume/replay/download route tests pass locally and endpoint-shape/key provisioning are separately scoped. Target part: Axioma CTA activation gates.
6. MEDIUM - Evidence: `scripts/gates.mjs` defines `full` without e2e and defines `e2e` as a separate plan (`scripts/gates.mjs:43` to `scripts/gates.mjs:52`); phase 3.9 already observed `node scripts/gates.mjs full` PASS and a separate e2e PASS (`docs/handoffs/20260601-1841-phase-3-9-route-repair-config-readiness.md:71` to `docs/handoffs/20260601-1841-phase-3-9-route-repair-config-readiness.md:73`). Recommendation: final verification for the next write phase should run `node scripts/gates.mjs full` and then a separate env-cleared e2e command; this read-only lane should not rerun them. Target part: gate discipline.

## Decisions
- This lane stays planning-only. No tests or gates were run because the user scoped this as a read-only verification planning lane and prohibited full/e2e from this agent unless already run in prior evidence.
- Keep all planned checks local-only: PGlite, generated P-256 keys, direct route/helper calls, static no-live guards, and mocked fetch only after a download proxy implementation exists.
- Do not use live TradingView, browser automation, live Axioma endpoints, real Stripe, bot/exchange, SSH, tmux, systemd, preview-worker, or production services for this plan.
- Treat real Postgres race acceptance as optional follow-up only when the operator provides a throwaway `REAL_POSTGRES_DATABASE_URL`; PGlite is enough for local regression shape but not a substitute for cross-connection race proof.

## Risks
- Repository-level TV idempotency can still duplicate revoke tasks under concurrent workers until a DB uniqueness constraint or equivalent atomic insert is implemented.
- Static Axioma skeleton tests can prove fail-closed source shape, but they do not prove route runtime behavior for consume/replay/download once those routes are activated.
- A local mocked download stream can prove WTC token/consume/audit behavior, but it cannot prove compatibility with the real `axi-o.ma` installer endpoint without a separately scoped live endpoint-shape phase.
- A consume route can make replay semantics clearer, but it also creates a service-token boundary that must be tested for fail-closed auth and secret redaction.

## Verification/tests
Tests/gates run by this lane:
- NOT RUN - focused Vitest commands; this was a read-only planning lane.
- NOT RUN - `node scripts/gates.mjs full`; phase 3.9 already observed it green, and this lane made no source changes.
- NOT RUN - e2e; phase 3.9 already observed an env-cleared e2e pass, and this lane made no source changes.
- NOT RUN - live services; prohibited by scope.

Prior evidence inspected:
- PASS - `node scripts/gates.mjs full` in `docs/handoffs/20260601-1841-phase-3-9-route-repair-config-readiness.md:72`.
- PASS - env-cleared Playwright e2e, 44 passed / 6 skipped, in `docs/handoffs/20260601-1841-phase-3-9-route-repair-config-readiness.md:73`.

Focused commands for the next write phase after implementing the planned tests:
```powershell
npm test -- tests/integration/tv-access-hardening.test.ts tests/integration/db-tv-expiring.test.ts tests/integration/tv-task-uniqueness.test.ts
npm test -- packages/config/src/env.test.ts packages/axioma-bridge/src/handoff.test.ts packages/axioma-bridge/src/es256.test.ts packages/axioma-bridge/src/signer.test.ts tests/integration/db-axioma-jti.test.ts tests/integration/axioma-skeleton-static.test.ts tests/integration/axioma-jwks-readiness.test.ts tests/integration/axioma-handoff-snapshot.test.ts tests/integration/axioma-jti-consume-route.test.ts tests/integration/axioma-download-route-handler.test.ts
npm run typecheck
npm run typecheck -w @wtc/web
```

Final local-only commands for the next write phase after focused commands pass:
```powershell
node scripts/gates.mjs full
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:REAL_POSTGRES_DATABASE_URL -ErrorAction SilentlyContinue
node scripts/gates.mjs e2e
```

Optional throwaway real-Postgres command only if the operator explicitly provides `REAL_POSTGRES_DATABASE_URL`:
```powershell
npm test -- tests/integration/db-axioma-jti.test.ts tests/integration/tv-task-uniqueness.test.ts
```

## Next actions
1. Assign a write lane to implement TradingView task uniqueness with a DB-level guard and add `tests/integration/tv-task-uniqueness.test.ts`.
2. Assign an Axioma backend/security lane to choose the local consume-route contract, add the route/helper, and add `tests/integration/axioma-jti-consume-route.test.ts`.
3. Keep Axioma download fail-closed until a single-use token/proxy model exists; then add `tests/integration/axioma-download-route-handler.test.ts` with mocked streaming and no live Axioma calls.
4. After the write lanes land, run the focused commands above, then `node scripts/gates.mjs full`, then env-cleared `node scripts/gates.mjs e2e`.
