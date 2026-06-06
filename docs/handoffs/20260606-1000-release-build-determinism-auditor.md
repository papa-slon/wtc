# release-build-determinism-auditor handoff
## Scope
Phase 4.75 read-only audit of WTC release-build determinism and devops cleanup scope after the Phase 4.74 canary deploy for `abe6784518abcbebe38368f3cef05039d55c520f`.

Scope was limited to local repo/package/workspace inspection, Next.js build behavior inspection from installed sources, retained Phase 4.74 deploy evidence, CI parity, lockfile/package-manager hygiene, and a bounded next implementation recommendation.

No live server, container, DB, env file, bot runtime, exchange endpoint, firewall, nginx, systemd, tmux, or live-control path was read or mutated in this auditor lane. No raw host/IP, env value, DSN, token, secret, exchange key, raw DB row, or full raw server log was printed or retained.

This is a single foreground read-only auditor handoff. No background agents were launched and no N-agent audit claim is made.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/DEPLOYMENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/ARCHITECTURE_DECISIONS.md`
- `docs/handoffs/20260606-0905-canary-deploy-preflight-auditor.md`
- `docs/handoffs/20260606-0905-canary-security-perimeter-auditor.md`
- `docs/handoffs/20260606-0909-runtime-continuity-auditor.md`
- `docs/handoffs/20260606-0918-phase-474-canary-deploy-abe6784.md`
- `package.json`
- `package-lock.json`
- `apps/web/package.json`
- `apps/web/next.config.ts`
- `apps/worker/package.json`
- `.github/workflows/ci.yml`
- `vitest.config.ts`
- `tests/integration/deployment-release-build-static.test.ts` (pre-existing untracked file)
- `node_modules/next/dist/lib/verify-typescript-setup.js`
- `node_modules/next/dist/lib/has-necessary-dependencies.js`
- `node_modules/next/dist/lib/install-dependencies.js`
- `node_modules/next/dist/lib/helpers/install.js`
- `node_modules/next/dist/lib/helpers/get-pkg-manager.js`
- `node_modules/next/dist/lib/typescript/required-packages.js`
- Local git status/diff and package-resolution command output

## Files changed
- `docs/handoffs/20260606-1000-release-build-determinism-auditor.md` - this handoff only.

## Findings
1. Severity: P1. The Phase 4.74 TypeScript auto-install is best classified as build-stage env leakage, not missing dependency declarations. Evidence: Phase 4.74 retained only a summarized warning that the server build completed but Next installed TypeScript during build in `docs/handoffs/20260606-0918-phase-474-canary-deploy-abe6784.md:70-73`; the current deployment doc states the one-off container inherited `NODE_ENV=production` from the canary env file during `npm ci` in `docs/DEPLOYMENT.md:35-42`; local npm config under `NODE_ENV=production` reports `omit=["dev"]`; the build-time packages Next checks are dev dependencies in `apps/web/package.json:35-40` and are marked dev in `package-lock.json:57-62` and `package-lock.json:7082-7087`. Recommendation: make the release build command install dev/build tooling explicitly with `npm ci --include=dev --no-audit --no-fund` before `npm run build -w @wtc/web`; runtime containers may still run with production env after the artifact is built. Target part: release install/build determinism.
2. Severity: P1. The `yarn` label is a package-manager detector artifact that appears only after Next has already decided required TypeScript packages are missing. Evidence: Next checks for `typescript`, `@types/react`, and `@types/node` in `node_modules/next/dist/lib/verify-typescript-setup.js:70-84`, resolves them from the app dir in `node_modules/next/dist/lib/has-necessary-dependencies.js:14-37`, and auto-installs when any are missing in `node_modules/next/dist/lib/verify-typescript-setup.js:98-117`; its installer prints `Installing devDependencies (${packageManager})` in `node_modules/next/dist/lib/install-dependencies.js:21-34`; package-manager detection checks only the supplied base dir for `yarn.lock`, `pnpm-lock.yaml`, then `package-lock.json`, then can fall back to a globally available `yarn` in `node_modules/next/dist/lib/helpers/get-pkg-manager.js:19-59`. Recommendation: prevent the auto-install path by ensuring dev dependencies are present before `next build`; do not add app-local lockfiles or switch package managers as a workaround. Target part: package-manager mixing risk.
3. Severity: P2. The repo lockfile and dependency placement are internally consistent for npm workspaces when dev dependencies are installed. Evidence: ADR-001 chooses npm workspaces and `package-lock.json` in `docs/ARCHITECTURE_DECISIONS.md:5-9`; root workspaces are declared in `package.json:7-10`; root TypeScript is declared in `package.json:60-73`; web TypeScript and React/Node types are declared in `apps/web/package.json:35-40`; the lockfile records the same root and web dependency specs in `package-lock.json:14-27` and `package-lock.json:57-62`; a JSON manifest-vs-lock check in this session reported `mismatchCount: 0`; `npm ls typescript next @types/react @types/node --workspaces --all --depth=0` resolved `@wtc/web` with `next@15.5.18`, `typescript@5.9.3`, `@types/node`, and `@types/react`. Recommendation: do not move TypeScript into production dependencies solely to silence Next; keep build tools as dev dependencies and force the build install to include them. Target part: lockfile/dependency model.
4. Severity: P2. CI is close but does not reproduce the release-container failure mode because GitHub runs `npm ci` before the production-like env validation and does not load the canary env file for the install step. Evidence: GitHub Actions installs with plain `npm ci` in `.github/workflows/ci.yml:47-49`, sets `NODE_ENV=production` only for the later env-fence step in `.github/workflows/ci.yml:86-93`, and builds web at `.github/workflows/ci.yml:115-116`; Phase 4.74 built in a one-off `node:22-bookworm` container with server-side canary env reuse per `docs/handoffs/20260606-0918-phase-474-canary-deploy-abe6784.md:105-109`. Recommendation: add a cheap static regression gate for the release runbook and, before every future canary switch, run a server-side pre-build resolver check proving TypeScript packages resolve from `/app/apps/web` after `npm ci --include=dev`. Target part: CI/release parity.
5. Severity: P2. The release-build fix can remain bounded to docs plus a static test; package/runtime cleanup is a separate devops phase. Evidence: the existing untracked static test asserts the deployment doc contains `npm ci --include=dev --no-audit --no-fund`, the no-Next-auto-install warning, runtime container language, and `NODE_ENV=production` in `tests/integration/deployment-release-build-static.test.ts:15-19`; root Vitest discovers `tests/integration/**/*.test.ts` in `vitest.config.ts:6-10`; the worker still starts via `tsx src/index.ts` in `apps/worker/package.json:6-10`, which depends on build/dev tooling still being available somewhere. Recommendation: accept docs/static-test hardening as the Phase 4.75 cleanup; plan worker compilation or explicit runtime tooling as a later phase, not as a prerequisite for the Next build determinism fix. Target part: devops cleanup scope.
6. Severity: P2. The local workspace is dirty from other lanes, so this auditor's result must not attribute those files to this handoff. Evidence: current `git status --short --branch` showed branch `codex/phase-475-production-readiness` with modified `docs/DEPLOYMENT.md` and untracked `docs/handoffs/20260606-1000-long-burnin-continuity-auditor.md`, `docs/handoffs/20260606-1000-production-domain-readiness-auditor.md`, and `tests/integration/deployment-release-build-static.test.ts` before this handoff write. Recommendation: preserve those files, decide separately which lane owns staging them, and keep this auditor's write scope to this one handoff. Target part: workspace hygiene.

## Decisions
1. The TypeScript/yarn auto-install warning is not a bot/runtime blocker and does not invalidate the Phase 4.74 canary smoke/burn-in, but it is a release reproducibility defect that should be fixed before the next canary/server release build.
2. The bounded fix is documentation/runbook plus static regression coverage: use `npm ci --include=dev --no-audit --no-fund` in the release build stage when the canary env file is loaded, then run `npm run build -w @wtc/web`.
3. No `package-lock.json`, `package.json`, or `apps/web/package.json` dependency move is required for this narrow fix.
4. Do not add `yarn.lock`, `pnpm-lock.yaml`, or app-local package locks; the canonical package manager remains npm workspaces with a single root `package-lock.json`.
5. Worker runtime cleanup is separate: either compile the worker to plain JS for runtime containers or make runtime TypeScript tooling explicit in a later devops phase. That should not be bundled into this read-only audit or the narrow Next build cleanup.

## Risks
1. The raw Phase 4.74 server build log was intentionally not retained, so the exact warning line is not available in local docs. This diagnosis is based on the retained Phase 4.74 summary, the current deployment follow-up text, npm config behavior under `NODE_ENV=production`, and Next.js installed source code.
2. If a future release command sets `npm_config_omit=dev` independently, `--include=dev` must still be present on `npm ci`; simply unsetting `NODE_ENV` may not be enough.
3. If the build auto-install path runs again, it can mutate package manifests or create a non-canonical lockfile in the release directory. Treat any `yarn.lock` or package-lock/package.json delta after build as a failed determinism gate.
4. The worker currently uses `tsx` at runtime, so aggressive production-only pruning in runtime containers may break the worker until a separate compile/runtime packaging phase lands.
5. Concurrent untracked handoffs exist in this workspace; an aggregate phase handoff must cite only real per-agent handoff files and must not count this narrative as more than one auditor.

## Verification/tests
RUN:
1. Protocol/context read - PASS: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, and `docs/handoffs/0000-orchestrator-seed.md` inspected.
2. Phase 4.74 evidence read - PASS: deploy preflight, security/perimeter, runtime continuity, and aggregate deploy handoffs inspected.
3. Package/workspace config audit - PASS: root/web/worker package manifests, Next config, `package-lock.json`, ADR-001, and GitHub Actions workflow inspected.
4. Lockfile consistency spot-check - PASS: manifest-vs-lock JSON check returned `mismatchCount: 0`.
5. Local dependency resolution - PASS: `npm ls typescript next @types/react @types/node --workspaces --all --depth=0` resolved the expected web build packages from the current install.
6. npm production omit check - PASS: under `NODE_ENV=production`, `npm config list --json` reported `omit: ["dev"]`.
7. Next.js auto-install path inspection - PASS: installed Next.js sources were inspected for TypeScript dependency detection, auto-install, package-manager selection, and install command behavior.
8. Workspace hygiene check - PASS with dirty tree noted: current branch is `codex/phase-475-production-readiness`; dirty/untracked files listed in Finding 6 were not modified by this auditor.

NOT RUN:
1. No live server SSH, Docker, systemd, tmux, DB, env-file, nginx, firewall, bot, exchange, or live-control inspection - read-only local audit scope and no secret/target retention.
2. No `npm ci`, `npm install`, package-lock write, yarn/pnpm command, or dependency mutation - forbidden by read-only scope.
3. No local `npm run build -w @wtc/web`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run secret:scan`, or Playwright - this auditor changed only one handoff and did not validate the pre-existing docs/test lane.
4. No server release rebuild to reproduce the warning - would require an approved deploy/test lane with redacted server access.
5. No background agents launched and none required to close for this single-auditor lane.

## Next actions
1. Recommended next implementation scope: keep or apply only the deterministic build-stage docs change in `docs/DEPLOYMENT.md` so the release command is:
   `npm ci --include=dev --no-audit --no-fund && npm run build -w @wtc/web && npm run db:migrate -w @wtc/db`.
2. Recommended static regression scope: adopt the existing `tests/integration/deployment-release-build-static.test.ts` or equivalent to assert the deployment runbook includes `--include=dev`, warns against Next auto-installing TypeScript, and preserves the distinction between build-stage dev tooling and runtime `NODE_ENV=production`.
3. Do not touch `package.json`, `package-lock.json`, `apps/web/package.json`, or add any yarn/pnpm lockfile for the narrow fix unless implementation discovers a new lock mismatch.
4. Required local gates for a docs/static-test cleanup PR: `npx vitest run tests/integration/deployment-release-build-static.test.ts`, `npm run governance:check`, `npm run secret:scan`, and `git diff --check`.
5. Required additional gates if package/build scripts change: `npm run lint`, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run typecheck -w @wtc/worker`, `npm test`, and `npm run build -w @wtc/web`.
6. Required future server release gate before any canary switch: in the one-off `node:22-bookworm` build container with the canary env file loaded, run `npm ci --include=dev --no-audit --no-fund`, then verify `typescript/lib/typescript.js`, `@types/react/index.d.ts`, and `@types/node/index.d.ts` resolve from `/app/apps/web` before running `npm run build -w @wtc/web`.
7. Required post-build determinism check for future releases: confirm no `yarn.lock`, `pnpm-lock.yaml`, `apps/web/package-lock.json`, `apps/web/yarn.lock`, package manifest delta, or unexpected `package-lock.json` delta was created by `next build`.
8. If the worker runtime is later pruned to production-only dependencies, open a separate devops phase to compile `apps/worker` to JS or make runtime tooling explicit; do not mix that with this narrow Next release-build determinism cleanup.
