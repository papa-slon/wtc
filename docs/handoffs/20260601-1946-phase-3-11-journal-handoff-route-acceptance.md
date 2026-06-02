# Phase 3.11 journal handoff route acceptance handoff
## Scope
Local-only Axioma B4 readiness slice for epoch `20260601-1946`. The phase extracted `POST /api/axioma/journal-handoff`
into a Request-level handler, proved active/grace signed-token issuance with generated P-256 keys and PGlite, made JTI
issuance plus `axioma.account_link_init` audit atomic, required a linked Axioma user id before `open_journal` signing, and
kept terminal CTAs disabled. No live Axioma, Stripe, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or
production service was touched.

Read-only phase lanes dispatched before edits:
- [`docs/handoffs/20260601-1946-ecosystem-security-auditor.md`](20260601-1946-ecosystem-security-auditor.md)
- [`docs/handoffs/20260601-1946-ecosystem-axioma-bridge-auditor.md`](20260601-1946-ecosystem-axioma-bridge-auditor.md)
- [`docs/handoffs/20260601-1946-ecosystem-db-architect.md`](20260601-1946-ecosystem-db-architect.md)
- [`docs/handoffs/20260601-1946-ecosystem-tests-runner.md`](20260601-1946-ecosystem-tests-runner.md)

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260601-1907-phase-3-10-local-b4-consume-tv-uniqueness.md`
- `docs/handoffs/20260601-1946-ecosystem-security-auditor.md`
- `docs/handoffs/20260601-1946-ecosystem-axioma-bridge-auditor.md`
- `docs/handoffs/20260601-1946-ecosystem-db-architect.md`
- `docs/handoffs/20260601-1946-ecosystem-tests-runner.md`
- `packages/db/src/repositories.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/axioma-route-core.ts`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/signer.ts`
- `packages/entitlements/src/engine.ts`
- `packages/db/src/schema.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-handoff-snapshot.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`
- `tests/integration/db-axioma-jti.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`

## Files changed
- `packages/db/src/repositories.ts`
- `apps/web/src/features/terminal/axioma-route-core.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `docs/handoffs/20260601-1946-phase-3-11-journal-handoff-route-acceptance.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`

## Findings
1. HIGH - Journal-handoff issuance now has dynamic route-level proof instead of static source checks only. The Next route is a thin adapter, while `handleAxiomaJournalHandoffRequest` is framework-neutral and accepts injected DB, env, clock, CSRF, auth, entitlement, and issuance dependencies. Target part: local route acceptance.
2. HIGH - `open_journal` now requires a linked Axioma account with a non-empty `axiomaUserId` before signing or recording a JTI. Missing links return `409 account_link_required` with `Cache-Control: no-store` and no token/JTI/audit side effects. Target part: linked-account safety.
3. HIGH - JTI issuance and `axioma.account_link_init` audit now commit in one DB transaction through `issueHandoffJtiWithAudit`. Failure injection proves audit/JTI errors do not leave orphan JTI rows. Target part: replay/audit atomicity.
4. MEDIUM - Grace entitlement snapshots now use `graceUntil` as the effective access end for grace access instead of emitting a past paid-period end. Active access continues to use the minimum of `currentPeriodEnd` and `expiresAt` when present. Target part: signed entitlement claim honesty.
5. MEDIUM - Invalid ES256 key material and route unconfiguration fail closed before JTI/audit side effects. The handler still maps success-path signing/readiness failures to `503 not_configured`, keeping operator diagnostics conservative. Target part: signer readiness.
6. MEDIUM - POST-body/no-query-token behavior remains intact. Successful responses return `{ postUrl, token, expiresAt, method: 'POST' }`; no redirect or `?token=` URL is introduced, and audit payloads do not contain the JWT. Target part: response secrecy.

## Decisions
- Keep terminal `bridgeActionsImplemented: false`; this phase does not enable browser Open Journal or Download CTAs.
- Do not add a migration. The account-link OTC hash migration, account-link uniqueness, and download-token/proxy model remain separate B4 phases.
- Keep the lower-level `recordHandoffJti` primitive unchanged and add `issueHandoffJtiWithAudit` as the route issuance helper.
- Treat a missing linked Axioma account as a route-level product state problem (`409 account_link_required`), not as a signed no-link journal handoff.
- Use generated test P-256 keys only; no provisioned OP production key material is required for local acceptance.

## Risks
- Local WTC handler tests do not prove Axioma's live `/wtc-handoff` endpoint, JWKS cache behavior, Option A consume usage, or service-token envelope.
- `axioma_account_links` still has the older plaintext OTC-shaped schema and no active-link uniqueness constraint; that remains a B4 account-link activation blocker.
- Download remains fail-closed; this phase does not implement installer proxying, one-time download tokens, or live release streaming.
- The handler still uses a coarse `503 not_configured` for success-path exceptions. This is safer than leaking signer/config details, but less diagnostic for operators.
- Real Postgres cross-connection behavior was not proven for this route because no `REAL_POSTGRES_DATABASE_URL` was provided.

## Verification/tests
RUN:
- `npm test -- tests/integration/axioma-journal-handoff-handler.test.ts tests/integration/axioma-handoff-snapshot.test.ts tests/integration/axioma-skeleton-static.test.ts tests/integration/axioma-jti-consume-handler.test.ts tests/integration/db-axioma-jti.test.ts` - PASS, 29 passed / 1 skipped.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS after adding string-index env option types for `process.env` compatibility.
- `npm run db:generate -w @wtc/db` - PASS, 42 tables, no schema changes.
- `npm run governance:check` after creating this aggregate - PASS, current phase `20260601-1946`, 4 cited per-agent handoffs all present, 0 errors / 1 known historical warning.
- `node scripts/gates.mjs full` - PASS, 9 gates / 0 failing: governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, db:generate, build.
- Env-cleared `npm run e2e` - PASS, 44 passed / 6 skipped.
- Final `npm run governance:check` - PASS, current phase `20260601-1946`, 4 cited per-agent handoffs all present, 0 errors / 1 known historical warning.

NOT RUN:
- Real Stripe CLI/dashboard replay - no credentials and out of phase scope.
- Throwaway real-Postgres race acceptance - no `REAL_POSTGRES_DATABASE_URL` provided this phase.
- Live Axioma endpoint-shape/JWKS/consume/download checks - external B4 scope, not run.
- Live TradingView automation - intentionally not implemented/run.
- Live bot/exchange control - prohibited and not run.
- SSH, tmux, systemd, preview-worker, production service mutation - not run.

## Next actions
1. Implement the Axioma download route boundary in a separate phase with a local token/proxy model and mocked streaming.
2. Plan the account-link OTC hash migration and active-link uniqueness before enabling account-link or Open Journal CTAs.
3. Keep B4 blocked until Axioma endpoint shapes, OP key provisioning, replay model, download security, and browser CTA behavior are accepted in a separate session.
