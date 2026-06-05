# Phase 4.69 Tortila canonical source verifier handoff
## Scope
Implemented a source-truth slice after Phase 4.68: add a WTC-side verifier that refuses to treat adjacent/runtime Tortila folders as canonical unless they are clean git-backed source packets with journal token middleware and auth tests. This phase launched three read-only agents before edits, did not mutate live bots, did not deploy, did not query raw DB rows, did not read secrets, did not call exchange/provider endpoints, and did not touch live bot controls.

Agent handoffs:
- [docs/handoffs/20260606-0440-tortila-source-perimeter-auditor.md](20260606-0440-tortila-source-perimeter-auditor.md)
- [docs/handoffs/20260606-0440-legacy-closed-trade-server-auditor.md](20260606-0440-legacy-closed-trade-server-auditor.md)
- [docs/handoffs/20260606-0440-source-truth-implementation-planner.md](20260606-0440-source-truth-implementation-planner.md)

## Files inspected
- `scripts/run-tortila-real-read-managed.mjs`
- `tests/integration/tortila-real-read-managed-runner.test.ts`
- `package.json`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/IMPLEMENTED_FILES.md`
- Local adjacent Tortila token middleware/test files
- Server read-only Tortila/Legacy source/runtime metadata via the per-agent audits

## Files changed
- `scripts/tortila-canonical-source-verifier.mjs`
- `scripts/run-tortila-real-read-managed.mjs`
- `tests/integration/tortila-canonical-source-verifier.test.ts`
- `tests/integration/tortila-real-read-managed-runner.test.ts`
- `package.json`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260606-0440-tortila-source-perimeter-auditor.md`
- `docs/handoffs/20260606-0440-legacy-closed-trade-server-auditor.md`
- `docs/handoffs/20260606-0440-source-truth-implementation-planner.md`
- `docs/handoffs/20260606-0440-phase-469-tortila-canonical-source-verifier.md`

## Findings
1. Severity: P0. Tortila production-source gate remains not green, but WTC now has a strict verifier for the missing source packet. Evidence: `scripts/tortila-canonical-source-verifier.mjs` requires a clean git repo root, full HEAD, named branch, at least one remote name, required journal files, `JOURNAL_READ_TOKEN` middleware, bearer/header token handling, `/api/*` 401 guard, and auth tests. Recommendation: use `npm run verify:tortila:canonical-source` before any canonical-source claim. Target part: Tortila source-control gate.
2. Severity: P0. The managed real-read runner can now fail closed when canonical source is required. Evidence: `scripts/run-tortila-real-read-managed.mjs` calls `verifyTortilaCanonicalSourceRoot(root)` only when `TORTILA_CANONICAL_SOURCE_REQUIRED=1`, and in that mode it checks only the explicit `TORTILA_REAL_READ_SOURCE_ROOT` instead of falling back to `../bot_tortila`. Recommendation: future canonical proof should run with both env vars set. Target part: WTC acceptance runner.
3. Severity: P0. Current adjacent `bot_tortila` still fails canonical verification. Evidence: `TORTILA_CANONICAL_SOURCE_ROOT=<adjacent bot_tortila> npm run verify:tortila:canonical-source` exited `2` with a not-git-backed refusal. Recommendation: do not overclaim adjacent source as canonical. Target part: Tortila source truth.
4. Severity: P0. Legacy closed-trade source remains absent after server audit. Evidence: `docs/handoffs/20260606-0440-legacy-closed-trade-server-auditor.md`. Recommendation: keep Legacy realized analytics blocked until a real source packet/table/API exists. Target part: Legacy analytics/import.

## Decisions
- Added a verifier script instead of another UI polish pass.
- Kept local fixture mode for `accept:tortila:real-read:managed`, but added strict canonical mode behind `TORTILA_CANONICAL_SOURCE_REQUIRED=1`.
- Did not edit live bot runtime files or deploy the local token patch to server runtime.
- Did not implement Legacy importer or realized stats.

## Risks
- The verifier proves source packet shape only; it does not deploy runtime source, provision production secrets, or prove firewall/private-network posture.
- A canonical git repo still needs to be identified or created.
- Legacy source remains absent; trying to implement importer before source proof would fabricate analytics.

## Verification/tests
RUN:
1. `npm test -- tests/integration/tortila-canonical-source-verifier.test.ts tests/integration/tortila-real-read-managed-runner.test.ts` - PASS, 6 tests.
2. `npm test -- packages/bot-adapters/src/__tests__/tortila-mapping.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/two-bot-continuity-contract-static.test.ts` - PASS, 51 tests.
3. `npm test` - PASS, 135 files, 1138 passed, 10 skipped.
4. `npm run typecheck` - PASS.
5. `npm run typecheck -w @wtc/web` - PASS.
6. `npm run typecheck -w @wtc/worker` - PASS.
7. `npm run lint` - PASS.
8. `npm run governance:check` - PASS, 0 errors, 1 known historical warning.
9. `npm run secret:scan` - PASS.
10. `git diff --check` - PASS.
11. `TORTILA_CANONICAL_SOURCE_ROOT=<adjacent bot_tortila> npm run verify:tortila:canonical-source` - expected refusal observed; exited `2` because the adjacent source is not git-backed.

NOT RUN:
1. `npm run accept:tortila:real-read:managed` with strict canonical source - no canonical git-backed source exists yet.
2. pytest/ruff in Tortila runtime - no canonical source checkout was available.
3. Live server mutation, service restart, token provisioning, endpoint probes, `/api/marks`, `/api/overview`, exchange calls, Legacy importer, production deploy - intentionally out of scope.

## Next actions
1. Identify or create the canonical git-backed Tortila/Turtle source repo.
2. Land or verify the journal token middleware/tests in that repo.
3. Run `TORTILA_CANONICAL_SOURCE_ROOT=<canonical repo> npm run verify:tortila:canonical-source`.
4. Then run `TORTILA_CANONICAL_SOURCE_REQUIRED=1 TORTILA_REAL_READ_SOURCE_ROOT=<canonical repo> npm run accept:tortila:real-read:managed` with an approved throwaway DB admin URL.
5. Only after canonical source proof, run a separate approved runtime deploy/auth/firewall probe phase.
