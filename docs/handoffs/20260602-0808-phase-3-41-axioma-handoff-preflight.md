# Phase 3.41 Axioma handoff preflight handoff
## Scope
Implement a local, no-Axioma-network readiness preflight for the Axioma ES256/JWKS/Open-Journal/JTI boundary after
Phase 3.40. This phase adds a generated-key dry-run command, hardens route readiness so configured ES256 material must be
parseable, and extends retained-artifact scanning for Axioma handoff evidence. It does not call `axi-o.ma`, fetch installers,
enable terminal CTAs, provision production P-256 keys, run live account-link/download acceptance, run the real-Postgres JTI
race gate, or touch any live server.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0808-ecosystem-axioma-bridge-auditor.md](20260602-0808-ecosystem-axioma-bridge-auditor.md)
- [docs/handoffs/20260602-0808-ecosystem-security-auditor.md](20260602-0808-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0808-ecosystem-backend-implementer.md](20260602-0808-ecosystem-backend-implementer.md)
- [docs/handoffs/20260602-0808-ecosystem-platform-architect.md](20260602-0808-ecosystem-platform-architect.md)
- [docs/handoffs/20260602-0808-ecosystem-tests-runner.md](20260602-0808-ecosystem-tests-runner.md)
- [docs/handoffs/20260602-0808-ecosystem-devops-implementer.md](20260602-0808-ecosystem-devops-implementer.md)

All six background agents completed and were closed after their handoffs were collected.
## Files inspected
- `packages/axioma-bridge/src/{handoff,es256,jwks,signer,bridge,index}.ts`
- `apps/web/src/features/terminal/{axioma-route-core,axioma-jwks-readiness,axioma-journal-handoff,axioma-jti-consume,axioma-download,axioma-account-link}.ts`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`
- `tests/integration/axioma-*.test.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/gates.mjs`
- `package.json`
- `.env.example`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
## Files changed
- `packages/axioma-bridge/src/preflight.ts`
- `packages/axioma-bridge/src/preflight.test.ts`
- `packages/axioma-bridge/src/index.ts`
- `packages/axioma-bridge/src/__smoke__.ts`
- `apps/web/src/features/terminal/axioma-route-core.ts`
- `scripts/axioma-handoff-preflight.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/integration/axioma-handoff-preflight.test.ts`
- `tests/integration/axioma-jwks-readiness.test.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-download-handler.test.ts`
- `tests/integration/axioma-account-link-handler.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `package.json`
- current docs and this aggregate handoff.
## Findings
1. High - Axioma had strong local ES256/JWKS and route-handler tests, but no operator command producing scanner-safe retained
   evidence. Implemented: `packages/axioma-bridge/src/preflight.ts` generates an ephemeral P-256 fixture and redacted
   ES256/JWKS/token-shape summary, while `scripts/axioma-handoff-preflight.mjs` exercises journal-handoff plus JTI consume
   handlers against disposable PGlite with no network I/O. Target part: local Axioma readiness evidence.
2. High - Retained Axioma evidence could leak PEM keys, service tokens, compact JWTs, raw claims, or raw handoff URLs.
   Implemented: artifact scanner deny rules for Axioma signing-key/API-token assignments, private key blocks, compact JWTs,
   raw `/wtc-handoff` evidence, raw single-use/CSRF claims, and linked account identifiers. Target part: evidence no-leak
   guard.
3. High - Shared route readiness accepted present-but-invalid ES256 env names. Implemented: `axiomaRouteReadiness()` now
   parses the configured key through `createEs256Signer()` and reports `es256_key_invalid` before handlers sign or record
   state. Target part: fail-closed readiness.
4. Medium - `check:core` previously proved only the HS256 dev stub for `@wtc/axioma-bridge`. Implemented: package smoke now
   includes generated ES256/JWKS preflight checks without printing or retaining token/key material. Target part: core smoke
   honesty.
5. Medium - The Axioma preflight must stay opt-in and outside default gates. Implemented: `accept:axioma:handoff-preflight`
   is a root script, static tests assert it is absent from `ci:local`, default `e2e`, and `scripts/gates.mjs`. Target part:
   gate safety.
## Decisions
- Keep Phase 3.41 local-only: use generated ephemeral P-256 material, disposable PGlite, route handlers, and redacted
  summaries only.
- Refuse `APP_ENV=production` and refuse pre-existing `AXIOMA_HANDOFF_SIGNING_KEY` or `AXIOMA_BRIDGE_API_TOKEN` in the
  preflight environment so the dry-run cannot accidentally use live key or service-token material.
- Do not enable terminal CTAs, real bridge mode, live downloads, or live account-link/handoff acceptance in this phase.
- Keep the real-Postgres JTI race gate and live Axioma endpoint acceptance as separate B4 gates.
## Risks
- A green local preflight proves WTC-side signing, public JWKS shape, local route issuance, local JTI consume/replay, and
  evidence hygiene only. It does not prove Axioma accepts the token/JWKS, confirms Option A replay, hosts installer bytes,
  or completes account linking.
- JWKS rotation is still single-active-key only; overlapping multi-key rotation remains a future production concern.
- Real replay race behavior still needs the skipped two-connection Postgres harness against a fresh `wtc_test*` database.
## Verification/tests
- Focused Axioma/scanner Vitest: `npm test -- packages/axioma-bridge/src/es256.test.ts packages/axioma-bridge/src/signer.test.ts packages/axioma-bridge/src/preflight.test.ts tests/integration/axioma-jwks-readiness.test.ts tests/integration/axioma-journal-handoff-handler.test.ts tests/integration/axioma-jti-consume-handler.test.ts tests/integration/axioma-download-handler.test.ts tests/integration/axioma-account-link-handler.test.ts tests/integration/axioma-handoff-preflight.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts` - PASS (`72` passed).
- `node --check scripts/axioma-handoff-preflight.mjs` - PASS.
- `npm run check:core` - PASS, including `@wtc/axioma-bridge handoff: 11 checks`.
- Dry-run Axioma handoff preflight with temp evidence root plus `node scripts/scan-lms-db-e2e-artifacts.mjs <temp-root>` - PASS.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run lint` - PASS.
- `npm run worker:smoke` - PASS.
- `npm run db:generate -w @wtc/db` - PASS, 43 tables, no schema changes.
- `node scripts/gates.mjs full` - PASS (9/9 gates; Vitest `806` passed / `8` skipped).
- `node scripts/gates.mjs e2e` - PASS (`44` passed).
- Final `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS (`2` text files, `68` images, `0` blocked containers).
- Final `npm run secret:scan` - PASS.
- Final `npm run governance:check` - PASS (0 errors / 1 known warning; 6 cited per-agent handoffs all present).
- NOT RUN: live Axioma endpoint-shape/JWKS/handoff/download/account-link acceptance, live installer streaming, production
  ES256 key provisioning, production service-token provisioning, real-Postgres JTI race gate, CI via GitHub Actions.
## Next actions
- Run real-Postgres JTI race proof only when a fresh throwaway `wtc_test*` database is supplied.
- Run live Axioma acceptance only after operator-provided staging/prod P-256 key material, Axioma endpoint-shape confirmation,
  replay-model confirmation, live installer/account-link acceptance inputs, and evidence retention rules are in place.
