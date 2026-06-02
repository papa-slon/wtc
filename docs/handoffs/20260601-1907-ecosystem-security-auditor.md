# ecosystem-security-auditor handoff
## Scope
Read-only security planning lane for epoch 20260601-1907. Scope was WTC-side Axioma consume/replay/download boundaries that can be advanced locally without live Axioma, plus security risks in adding Axioma routes or tests while terminal CTAs stay disabled. No source code, docs, live services, servers, external calls, or production systems were changed.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260601-1841-phase-3-9-route-repair-config-readiness.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `.env.example`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/axioma-jwks-readiness.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/lib/backend.ts`
- `packages/axioma-bridge/src/bridge.ts`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/signer.ts`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/audit/src/audit.ts`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/axioma-jwks-readiness.test.ts`
- `tests/integration/axioma-handoff-snapshot.test.ts`
- `tests/integration/db-axioma-jti.test.ts`
- `tests/integration/phase23-visible-progress.test.ts`
- `tests/integration/db-0002.test.ts`
- `package.json`

## Files changed
None - read-only audit

## Findings
1. HIGH - JTI consume/replay has tested repository primitives but no WTC route boundary yet. Evidence: Phase 3.9 still lists "consume/replay route" under incomplete Axioma B4 work at `docs/handoffs/20260601-1841-phase-3-9-route-repair-config-readiness.md:45-47`; the spec says consume/Open-Journal/Download routes are still TARGET/B4 at `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:14-16`; Q-15 says the consume route is unbuilt until the Axioma replay model is chosen at `docs/OPEN_QUESTIONS.md:326-336`; the repo primitive already does the atomic `UPDATE ... used_at IS NULL ... expires_at > now` at `packages/db/src/repositories.ts:1175-1209`. Recommendation: if Option A is selected, add a local-only testable `POST /api/axioma/jti/consume` handler with explicit DB/env/clock/audit injection, bearer service-token auth, zod UUID body validation, and no CSRF/session dependency because the caller is Axioma server-to-server. Target part: Axioma replay boundary.

2. HIGH - Handoff JTI issuance and issuance audit are not atomic today. Evidence: `POST /api/axioma/journal-handoff` builds a handoff at `apps/web/src/app/api/axioma/journal-handoff/route.ts:73-78`, then inserts the JTI at `apps/web/src/app/api/axioma/journal-handoff/route.ts:79-84`, then writes audit at `apps/web/src/app/api/axioma/journal-handoff/route.ts:85-92`; the JTI repository function is a pure insert and explicitly leaves audit to the issuing route at `packages/db/src/repositories.ts:1160-1173`; the backend audit writer is selected separately from the route's `db` at `apps/web/src/lib/backend.ts:44-47` and `apps/web/src/lib/backend.ts:63`. Recommendation: before enabling journal handoff CTAs, extract route logic and make JTI insert plus audit a single DB transaction or a repository-level issue-with-audit helper; add a failure-injection test proving no orphan un-audited JTI is left if audit write fails. Target part: Axioma handoff issuance audit/replay truth.

3. HIGH - Journal handoff has static source checks but no dynamic Request-level harness for CSRF, entitlement, readiness, DB writes, and response secrecy. Evidence: the route is inline app code from `apps/web/src/app/api/axioma/journal-handoff/route.ts:44-104`; current skeleton coverage reads source text and regexes expected strings at `tests/integration/axioma-skeleton-static.test.ts:39-56`; package-level payload coverage verifies signed claims but not route behavior at `tests/integration/axioma-handoff-snapshot.test.ts:17-52`. Recommendation: extract `handleAxiomaJournalHandoffRequest()` with injected user/access/db/audit/env/csrf/clock, then add PGlite Request tests for POST-only, CSRF-before-user failure, unauthenticated, entitlement denied, readiness 503, successful ES256 token issuance, JTI row insertion, audit payload allowlist, no `?token=`, no secrets, and no JTI row on failed audit. Target part: Axioma open-journal route acceptance.

4. HIGH - Download is still fail-closed after readiness, and the existing download-event primitive can record `entitlementVerified` from a caller-supplied boolean. Evidence: download route checks auth and entitlement at `apps/web/src/app/api/axioma/download/route.ts:16-33`, then always returns `bridge_not_implemented` 501 at `apps/web/src/app/api/axioma/download/route.ts:35-41`; `recordDownloadEvent()` writes both `terminal_download_events` and `terminal.download` audit using its input boolean at `packages/db/src/repositories.ts:1126-1130`; current tests cover the happy repository event path at `tests/integration/phase23-visible-progress.test.ts:188-213` and `tests/integration/db-0002.test.ts:190-197`, not route enforcement. Recommendation: next local slice should add an extracted download handler that never calls live Axioma, selects a current release from DB, rejects missing/non-https `downloadUrlTemplate`, records the event only after a real entitlement decision, and proves denied users create no download event. Target part: Axioma download route boundary.

5. MEDIUM - Axioma route readiness is still presence-based for bridge token and signer material, while JWKS readiness already validates the private key parse. Evidence: `axiomaRouteReadiness()` treats `AXIOMA_BRIDGE_API_TOKEN` as present if the string is truthy and treats ES256 key material as present without parsing at `apps/web/src/features/terminal/axioma-routes.ts:23-35`; the JWKS helper parses the P-256 key and returns `signing_key_invalid` at `apps/web/src/features/terminal/axioma-jwks-readiness.ts:19-23`; `.env.example` leaves `AXIOMA_BRIDGE_API_TOKEN=` blank and the route flag false at `.env.example:49-51`. Recommendation: share parse-verified JWKS readiness in route readiness and require trimmed non-empty bridge token before any route reports configured; add tests for whitespace token, invalid PEM, missing kid, and valid P-256 key. Target part: Axioma route activation safety.

6. MEDIUM - Audit action naming remains split across implemented package codes and older docs, which is risky when adding consume/download routes. Evidence: implemented audit constants include `axioma.handoff_jti_consume`, `_replay`, `_revoke`, plus `terminal.download` at `packages/audit/src/audit.ts:68-83`; `docs/AUDIT_LOG_SCHEMA.md:196-204` lists Axioma account-link/download actions but not the jti lifecycle codes; `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:280-289` still shows multi-dot jti action names. Recommendation: route implementation should use the package constants that already pass gates, and the same phase should update the security-owned audit docs to the underscore names before claiming audit-schema readiness. Target part: audit trail consistency.

7. LOW - One ES256 source comment still says durable JTI persistence is absent, although the DB table and repositories exist. Evidence: `packages/axioma-bridge/src/es256.ts:9-12` states there is no jti store table yet; the current schema defines `axioma_handoff_jti_revocations` at `packages/db/src/schema.ts:629-653`; repositories expose record/consume/revoke/purge at `packages/db/src/repositories.ts:1139-1247`. Recommendation: fix the stale comment in the implementation phase to prevent reviewers from treating replay protection as package-local or missing. Target part: source honesty.

## Decisions
- No live Axioma, Stripe, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, server start, or external endpoint was touched.
- Keep Axioma CTAs disabled until route-level consume/replay/download behavior is implemented and tested. Evidence: `bridgeActionsEnabled` still requires `terminalData.bridgeActionsImplemented`, and the loader hardcodes that false at `apps/web/src/features/terminal/loader.ts:116-123`; the terminal buttons are disabled when `bridgeActionsEnabled` is false at `apps/web/src/app/(app)/app/terminal/page.tsx:166-174` and `apps/web/src/app/(app)/app/terminal/page.tsx:193-204`.
- Prefer extracted handler modules for local route advancement so tests can inject DB/env/clock/audit/auth without importing `server-only` app plumbing.
- Do not add a live Axioma HTTP client in this phase. The locally advanceable work is WTC-side auth, replay, audit, readiness, and download-metadata boundaries.
- Do not treat Q-15 as resolved in code. If a consume route is added before external confirmation, keep it separately flagged and disabled by default.

## Risks
- Enabling `AXIOMA_ROUTE_SKELETON_ENABLED=true` plus bridge token and key material before `bridgeActionsImplemented` flips would still leave UI CTAs disabled, but direct API callers could exercise `/api/axioma/journal-handoff`; route-level dynamic tests must precede any environment rollout.
- A non-atomic JTI insert plus audit sequence can leave replay-state rows that have no issuance audit if audit fails after insert.
- A consume route without a dedicated service-token verifier would risk converting a browser session route into an Axioma server-to-server trust boundary.
- Download-route implementation could accidentally log signed URLs, raw templates, bridge tokens, or user agents in audit payloads unless tests assert an allowlist.
- Real replay concurrency is only fully proven on real Postgres; PGlite covers the repository behavior but the current real-PG race block is opt-in at `tests/integration/db-axioma-jti.test.ts:132-157`.

## Verification/tests
Not run in this read-only lane: lint, typecheck, Vitest, Playwright, full gates, servers, live endpoints, and external services.

Exact suggested local tests/gates for the implementation lane:
- Add `tests/integration/axioma-jti-consume-route.test.ts`; run `npm test -- tests/integration/axioma-jti-consume-route.test.ts tests/integration/db-axioma-jti.test.ts`.
- Add `tests/integration/axioma-journal-handoff-route-handler.test.ts`; run `npm test -- tests/integration/axioma-journal-handoff-route-handler.test.ts tests/integration/axioma-skeleton-static.test.ts tests/integration/axioma-handoff-snapshot.test.ts tests/integration/axioma-jwks-readiness.test.ts`.
- Add `tests/integration/axioma-download-route-handler.test.ts`; run `npm test -- tests/integration/axioma-download-route-handler.test.ts tests/integration/phase23-visible-progress.test.ts tests/integration/db-0002.test.ts`.
- Run `npm run typecheck`.
- Run `npm run typecheck -w @wtc/web`.
- Run `node scripts/gates.mjs full`.
- Run `Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; Remove-Item Env:REAL_POSTGRES_DATABASE_URL -ErrorAction SilentlyContinue; npm run e2e` only after implementation, to verify CTAs remain disabled in demo/e2e mode.
- Do not run live Axioma, Stripe, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or production operations for this local WTC-side slice.

## Next actions
1. Implement a local-only Axioma route-handler extraction phase: `journal-handoff`, `download`, and optional disabled `jti/consume`, all with injected DB/env/clock/audit/auth and no live Axioma client.
2. Make JTI issuance plus audit atomic before any CTA or environment flag can expose a usable handoff response.
3. Add a server-to-server service-token verifier for the optional consume route; do not reuse browser CSRF/session auth for Axioma-to-WTC replay checks.
4. Harden route readiness by reusing parse-verified JWKS readiness and trimmed non-empty bridge-token checks.
5. Reconcile Axioma audit docs with implemented package action names in the same implementation phase, then run governance/full gates.
