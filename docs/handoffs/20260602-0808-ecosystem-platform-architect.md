# ecosystem-platform-architect handoff
## Scope
Read-only platform audit for Phase 3.41 local Axioma ES256/JWKS/handoff-token readiness preflight. Inspected package boundaries, `scripts/gates.mjs`, acceptance matrix, deployment docs, Axioma contracts/specs, route readiness, and DB replay primitives. No product-code or docs edits were made except this required handoff.

## Files inspected
- `AGENTS.md`
- `package.json`
- `.env.example`
- `scripts/gates.mjs`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`
- `docs/CONTRACTS/axioma-bridge.md`
- `packages/axioma-bridge/src/es256.ts`
- `packages/axioma-bridge/src/jwks.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `packages/axioma-bridge/src/signer.ts`
- `packages/axioma-bridge/src/index.ts`
- `packages/axioma-bridge/src/__smoke__.ts`
- `packages/config/src/env.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/web/src/features/terminal/axioma-jwks-readiness.ts`
- `apps/web/src/features/terminal/axioma-route-core.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`
- `tests/integration/axioma-jwks-readiness.test.ts`
- `tests/integration/axioma-journal-handoff-handler.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `tests/integration/db-axioma-jti.test.ts`

## Files changed
This handoff only: `docs/handoffs/20260602-0808-ecosystem-platform-architect.md`.

## Findings
1. **MEDIUM - Axioma preflight has no first-class opt-in acceptance command yet.** Evidence: `package.json:30-33` defines opt-in LMS and billing preflights, but no `accept:axioma:*`; `scripts/gates.mjs:47-52` keeps default plans to governance/core/lint/typecheck/secrets/test/db-generate/build/e2e only; PG6 still defines Axioma readiness as ES256 round-trip plus JTI replay and endpoint-shape confirmation in `docs/ACCEPTANCE_MATRIX_MASTER.md:70-74`. Recommendation: add a separate `accept:axioma:handoff-preflight` command, excluded from default gates, with `--dry-run` as the normal local mode and explicit refusal for production/live network behavior unless operator-approved. Target part: `package.json`, `scripts/axioma-*-preflight.mjs`, acceptance docs.

2. **MEDIUM - Preflight logic should not live as a one-file script or only in the web feature layer.** Evidence: crypto and signer ownership is already centralized in `@wtc/axioma-bridge` (`packages/axioma-bridge/src/es256.ts:27-48`, `packages/axioma-bridge/src/signer.ts:52-67`, `packages/axioma-bridge/src/jwks.ts:12-14`), while current JWKS readiness is a web helper reading env directly (`apps/web/src/features/terminal/axioma-jwks-readiness.ts:11-23`) and the public route delegates to it (`apps/web/src/app/.well-known/axioma-jwks.json/route.ts:16-21`). Recommendation: put pure preflight assembly in `packages/axioma-bridge/src/preflight.ts` or equivalent package module, optionally consume typed config from `@wtc/config` at app/script boundaries, and keep scripts/routes as thin adapters. Target part: `@wtc/axioma-bridge` package boundary plus a thin `scripts/*preflight.mjs`.

3. **MEDIUM - Operator-facing deployment docs still contain a stale HS256 production requirement.** Evidence: `docs/DEPLOYMENT.md:363-365` lists `AXIOMA_HANDOFF_SIGNING_SECRET` as production-required, but config now requires `AXIOMA_HANDOFF_SIGNING_KEY` and `AXIOMA_HANDOFF_KEY_ID` when `APP_ENV` is staging or production (`packages/config/src/env.ts:85-96`), and `.env.example` marks the HS256 secret dev/test only while ES256 is required for staging/production (`.env.example:89-97`). Recommendation: devops/docs follow-up should replace that production-required secret list with ES256 key + key id and keep HS256 explicitly dev/test only. Target part: `docs/DEPLOYMENT.md`.

4. **LOW - `check:core` does not prove ES256/JWKS readiness despite including the Axioma package smoke.** Evidence: `package.json:34` runs `packages/axioma-bridge/src/__smoke__.ts`; that smoke signs/verifies only the HS256 dev-stub path (`packages/axioma-bridge/src/__smoke__.ts:2-12`) while ES256/JWKS is covered by focused Vitest tests (`tests/integration/axioma-jwks-readiness.test.ts:44-81`, `tests/integration/axioma-journal-handoff-handler.test.ts:197-237`). Recommendation: either extend the package smoke with a generated P-256 ES256/JWKS round-trip or rely on the new opt-in preflight for ES256 proof, but do not claim `check:core` alone proves PG6. Target part: `packages/axioma-bridge/src/__smoke__.ts` or new preflight gate.

5. **LOW - Gate runner comments can mislead phase reports about e2e inclusion.** Evidence: the header says `full = core + build + e2e` (`scripts/gates.mjs:13-17`), but the implementation intentionally excludes e2e from `full` and makes e2e its own plan (`scripts/gates.mjs:43-52`). Recommendation: fix the comment in a docs/devops cleanup so final reports do not overclaim e2e when only `node scripts/gates.mjs full` ran. Target part: `scripts/gates.mjs` comment only.

## Decisions
- Recommended home for Axioma ES256/JWKS/handoff-token preflight logic: pure package code under `@wtc/axioma-bridge`, with route/script adapters passing env/config in. This matches existing signer/JWKS ownership and avoids one-file prototype drift.
- Recommended command shape: an opt-in `accept:axioma:*` script, modeled after billing/LMS preflights, excluded from `scripts/gates.mjs` default plans and from `ci:local` unless a later phase explicitly promotes a dry-run-only check.
- Keep live Axioma endpoint reachability, production key provisioning, and installer streaming out of default gates. Missing operator credentials/consent should report **NOT RUN**, not PASS.
- Keep route behavior fail-closed: route readiness already requires flag, DB, bridge token, ES256 key, and valid journal URL (`apps/web/src/features/terminal/axioma-route-core.ts:32-45`).

## Risks
- No live EC P-256 key is provisioned in this local environment; production/staging activation remains operator-blocked by design.
- External Axioma `journal_server` endpoint shapes and Option A vs Option B replay model remain not confirmed (`docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:16-18`, `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md:263-265`).
- Live terminal download streaming remains B4/TARGET; local handler tests do not prove provider streaming (`docs/CONTRACTS/axioma-bridge.md:10-14`, `docs/CONTRACTS/axioma-bridge.md:255-259`).
- Repository is not git-backed in this workspace (`git status --short` returned "not a git repository"), so branch/commit/PR readiness cannot be inferred from this audit.

## Verification/tests
- Read-only inspection only; no product gates were run.
- Confirmed existing local evidence covers public JWKS 503/cacheable behavior and no private `d` emission (`tests/integration/axioma-jwks-readiness.test.ts:58-81`).
- Confirmed existing local evidence covers POST-body ES256 journal handoff, JTI recording, audit write, and token not placed in a URL (`tests/integration/axioma-journal-handoff-handler.test.ts:197-237`).
- Confirmed DB replay primitive is atomic single-use via conditional update (`packages/db/src/repositories.ts:2398-2431`) backed by table/indexes (`packages/db/src/schema.ts:746-760`).
- Gates not run: `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, live Axioma checks, real Postgres, and any live deployment checks. Reason: scope was read-only platform audit and preflight placement recommendation, not verification execution.

## Next actions
1. Add `packages/axioma-bridge/src/preflight.ts` for dry-run ES256/JWKS/handoff-token readiness: generated P-256 fixture support for tests, configured-key validation, public-JWK no-`d` assertion, token sign/verify round-trip, and redacted result model.
2. Add `scripts/axioma-handoff-preflight.mjs` as a thin CLI adapter with `--dry-run` default, explicit live/prod refusal semantics, redacted evidence under `logs/axioma-handoff-preflight`, and no network calls unless a future operator-approved live mode is separately scoped.
3. Add `accept:axioma:handoff-preflight` to `package.json`, but do not add it to `scripts/gates.mjs full` or `ci:local` until a later phase decides a dry-run-only acceptance belongs there.
4. Extend package or integration tests to assert the preflight delegates to `@wtc/axioma-bridge` helpers and that app/script layers do not duplicate ES256/JWKS construction.
5. Clean up `docs/DEPLOYMENT.md` production env list and `scripts/gates.mjs` header comment in a docs/devops follow-up.
