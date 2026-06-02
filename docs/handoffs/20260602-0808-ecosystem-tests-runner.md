# ecosystem-tests-runner handoff
## Scope
Read-only Phase 3.41 test/gate audit for local Axioma ES256/JWKS/handoff-token readiness preflight. Inspected Axioma package tests, route-handler tests, secret/artifact scanners, `scripts/gates.mjs`, package scripts, and Axioma acceptance docs. No live Axioma, live installer, live server, object-store, scanner, Stripe, or browser CTA activation was run.

## Files inspected
- `package.json`
- `packages/axioma-bridge/package.json`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/es256.test.ts`
- `packages/axioma-bridge/src/jwks.ts`
- `packages/axioma-bridge/src/signer.ts`
- `packages/axioma-bridge/src/signer.test.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/handoff.test.ts`
- `packages/axioma-bridge/src/bridge.ts`
- `apps/web/src/features/terminal/axioma-route-core.ts`
- `apps/web/src/features/terminal/axioma-jwks-readiness.ts`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`
- `apps/web/src/features/terminal/axioma-journal-handoff.ts`
- `apps/web/src/features/terminal/axioma-jti-consume.ts`
- `apps/web/src/features/terminal/axioma-account-link.ts`
- `apps/web/src/features/terminal/axioma-download.ts`
- `tests/integration/axioma-jwks-readiness.test.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-jti-consume-handler.test.ts`
- `tests/integration/db-axioma-jti.test.ts`
- `tests/integration/axioma-handoff-snapshot.test.ts`
- `tests/integration/axioma-account-link-handler.test.ts`
- `tests/integration/db-axioma-account-link.test.ts`
- `tests/integration/axioma-download-handler.test.ts`
- `tests/integration/db-axioma-download-token.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `scripts/gates.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `.secretlintrc.json`
- `.secretlintignore`
- `.env.example`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`

## Files changed
`docs/handoffs/20260602-0808-ecosystem-tests-runner.md` only.

## Findings
1. MEDIUM - No dedicated Axioma retained-evidence scanner/preflight wrapper exists yet. Evidence: `package.json:30-34` exposes LMS and billing preflight commands plus `check:core`, but no `accept:axioma:*`; `scripts/scan-lms-db-e2e-artifacts.mjs:12-82` blocks LMS/object-store/Stripe/session/auth leaks, but has no Axioma-specific deny labels for `AXIOMA_HANDOFF_SIGNING_KEY`, `AXIOMA_BRIDGE_API_TOKEN`, PEM private-key blocks, compact JWT handoff tokens, `/wtc-handoff` POST evidence, or Axioma service bearer material; `.secretlintignore:8-9` excludes generated Playwright artifacts from secretlint. Recommendation: before accepting retained Axioma preflight evidence, add an `accept:axioma:handoff --dry-run` or explicit scanner lane that writes count/status-only evidence and rejects Axioma key/token/JWT/Authorization/body leakage. Target part: preflight evidence retention.

2. LOW - The durable JTI store has strong PGlite coverage, but cross-connection atomicity remains opt-in real-Postgres evidence. Evidence: `tests/integration/db-axioma-jti.test.ts:136-152` wraps the two-connection same-JTI consume race in `describe.skipIf(!REAL_PG)`; the local run skipped one test while 53 related ES256/JTI tests passed. Recommendation: for final production readiness, run the real-Postgres race harness against a fresh throwaway `wtc_test*` database after credentials are supplied. Target part: replay-store concurrency proof.

3. LOW - Local Axioma route coverage is broad but still not live endpoint-shape acceptance. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:71-74` requires endpoint-shape confirmation, ES256 round-trip/JTI replay tests, and CTA-state e2e; `docs/PRODUCTION_BLOCKERS_CURRENT.md:18` says live Axioma endpoint-shape/account-link/download acceptance and installer streaming/security acceptance remain blocked. Recommendation: keep Phase 3.41 local-only unless OP P-256 key provisioning and EXT Axioma endpoint confirmations are supplied; do not treat green local tests as live Axioma activation. Target part: final acceptance boundaries.

4. LOW - `node scripts/gates.mjs full` is the right final local gate, but it intentionally excludes Playwright e2e. Evidence: `scripts/gates.mjs:43-52` documents e2e as its own plan and defines `full` as governance, core, lint, typecheck, secret scan, tests, db generate, and build only. Recommendation: final report should list `node scripts/gates.mjs full` and `node scripts/gates.mjs e2e` separately, and must not claim browser CTA proof unless the e2e plan is observed green in this session. Target part: gate reporting.

## Decisions
1. Treat the current Phase 3.41 evidence as local readiness only: ES256/JWKS primitives, route-level fail-closed behavior, token/JTI/account-link/download repository behavior, and secret/artifact scanner shape.
2. Do not run live Axioma, live installer fetch, browser CTA activation, or real-Postgres race gates without operator-provided external prerequisites.
3. Reuse `node scripts/gates.mjs full` for serialized final local gates on this Windows host, and run `node scripts/gates.mjs e2e` separately if browser proof is required.

## Risks
1. A future Axioma preflight log could retain a JWT, service bearer, PEM marker, key assignment, or raw POST body unless Axioma-specific artifact rules are added before evidence archival.
2. PGlite proves most replay semantics, but the strongest "exactly one consume wins" proof still needs the skipped real-Postgres race gate.
3. Local ES256/JWKS and route-handler green tests do not prove Axioma accepts the JWKS, `/wtc-handoff`, JTI consume, account-link, or download endpoint contracts.

## Verification/tests
- `npm test -- packages/axioma-bridge/src/es256.test.ts packages/axioma-bridge/src/signer.test.ts packages/axioma-bridge/src/handoff.test.ts tests/integration/axioma-jwks-readiness.test.ts tests/integration/axioma-journal-handoff-handler.test.ts tests/integration/axioma-jti-consume-handler.test.ts tests/integration/db-axioma-jti.test.ts tests/integration/axioma-handoff-snapshot.test.ts` - PASS, 8 files, 53 passed, 1 skipped real-Postgres race.
- `npm test -- tests/integration/axioma-account-link-handler.test.ts tests/integration/db-axioma-account-link.test.ts tests/integration/axioma-download-handler.test.ts tests/integration/db-axioma-download-token.test.ts` - PASS, 4 files, 23 passed.
- `node --check scripts/gates.mjs` - PASS.
- `node --check scripts/scan-lms-db-e2e-artifacts.mjs` - PASS.
- NOT RUN: `node scripts/gates.mjs full`; reason: read-only focused lane, not final aggregate gate.
- NOT RUN: `node scripts/gates.mjs e2e`; reason: browser CTA proof out of scope for this lane and e2e is intentionally separate.
- NOT RUN: real-Postgres JTI race; reason: no throwaway real-Postgres acceptance database supplied.
- NOT RUN: live Axioma endpoint-shape/JWKS/handoff/download/account-link acceptance; reason: OP key provisioning and EXT endpoint confirmations are still external B4 prerequisites.

## Next actions
1. Add an Axioma retained-artifact/preflight scanner lane or wrapper that rejects `AXIOMA_HANDOFF_SIGNING_KEY`, `AXIOMA_BRIDGE_API_TOKEN`, PEM private-key blocks, compact JWTs, raw `token` POST bodies, `/wtc-handoff` raw evidence, Authorization headers, cookies, and copied `.env` values.
2. Add a dry-run `accept:axioma:handoff` command only if the phase owner wants a single operator preflight command; keep it no-network by default and require explicit live consent for any future live mode.
3. For final local acceptance, run focused Axioma tests, the new Axioma artifact scan if added, `npm run secret:scan`, `node scripts/gates.mjs full`, and `node scripts/gates.mjs e2e` only when browser CTA proof is in scope.
4. For production/live acceptance, obtain OP P-256 key material, confirm Axioma endpoint shapes, run real-Postgres JTI race proof, and then run live Axioma JWKS/handoff/JTI/download/account-link acceptance with retained evidence scanned before archival.
