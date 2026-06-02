# ci-devops-implementer handoff

## Scope

Part C — devops/CI. Deliver the GitHub Actions CI workflow, align Postgres image versions, add the offline-fast `ci:local` script, and create the e2e screenshots `.gitkeep`.

## Files inspected

- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docker-compose.yml`
- `package.json` (root)
- `packages/config/src/env.ts` — source of truth for required env var names
- `packages/shared/src/env-guards.ts` — placeholder/secret guard logic
- `.env.example` — cross-reference for var names
- `packages/auth/src/csrf.ts` — verified CSRF implementation (no `CSRF_SECRET` env var)
- `apps/web/package.json` — confirmed workspace name `@wtc/web`
- `tests/e2e/screenshots/` — directory already existed with PNG artifacts

## Files changed

- `.github/workflows/ci.yml` — CREATED
- `docker-compose.yml` — EDITED (image version only)
- `package.json` — EDITED (one script added)
- `tests/e2e/screenshots/.gitkeep` — CREATED (empty)

## Findings (what you changed + evidence file:line)

### 1. `.github/workflows/ci.yml` (created)

Full GitHub Actions workflow with two jobs:

- `gates` job: `ubuntu-latest`, postgres:17-alpine service (matches CI/compose/host alignment), `DATABASE_URL` at job-env level. Steps in specified order: checkout, setup-node@v4 (node 24, npm cache), `npm ci`, `check:core`, `lint`, `typecheck`, `typecheck -w @wtc/web`, `secret:scan`, ephemeral-secrets step, `db:migrate -w @wtc/db`, `db:seed -w @wtc/db`, `npm test`, `npm run coverage`, `build -w @wtc/web`.
- `e2e` job: `ubuntu-latest`, checkout, setup-node@v4, `npm ci`, `npx playwright install --with-deps chromium`, `npm run e2e` (env `CI=true`), `upload-artifact@v4` for `tests/e2e/screenshots/**` with `if-no-files-found: ignore`.
- Top-of-file comment: `# CI is staged: this repo is not yet a git repo / has no GitHub remote. Local gate equivalent: npm run ci:local. CI pending.`
- No hardcoded secret literals anywhere. The ephemeral-secrets step uses `openssl rand -hex 24` written to `$GITHUB_ENV` at runtime.

Env var names sourced from `packages/config/src/env.ts`:
- `SESSION_SECRET` (required, min 16 chars — `z.string().min(16)`)
- `SECRET_VAULT_KEK` (required, min 16 chars — `z.string().min(16)`)
- `AXIOMA_HANDOFF_SIGNING_SECRET` (optional in schema but named in spec — `.min(16).optional()`)
- `CSRF_SECRET`: the task specification names this variable. However, `packages/config/src/env.ts` contains no `CSRF_SECRET` field. CSRF is implemented in `packages/auth/src/csrf.ts` as a session-bound derivation with no separate env secret. `CSRF_SECRET` is included in the ephemeral step as specified (it costs nothing to set it at runtime) but operators should be aware it is not currently consumed by `loadEnv()`. If a future refactor introduces `CSRF_SECRET` to the env schema, the CI step already provides it.

### 2. `docker-compose.yml` line 4

Changed `image: postgres:16-alpine` to `image: postgres:17-alpine`. No other lines touched.

Evidence: line 4 original value was `postgres:16-alpine`; new value is `postgres:17-alpine`.

### 3. `package.json` line 26

Added one script at the end of the `scripts` block (after `check:core`):

```
"ci:local": "npm run check:core && npm run lint && npm run typecheck && npm run typecheck -w @wtc/web && npm run secret:scan && npm test && npm run build -w @wtc/web"
```

Skips `db:migrate`, `db:seed`, and `e2e` to keep the local gate offline-fast. No other scripts or dependencies modified.

### 4. `tests/e2e/screenshots/.gitkeep` (created, empty)

Ensures the screenshots directory is tracked on a fresh clone (QA-003). The directory already contained PNG files from a prior Playwright run; the `.gitkeep` is additive and harmless.

## Decisions

### Postgres 17 standardisation (supersedes seed doc)

The orchestrator-seed.md locked the stack as "PostgreSQL 16". This implementation standardises on **PostgreSQL 17** across all three surfaces:

| Surface | Before | After |
|---------|--------|-------|
| `docker-compose.yml` postgres service | `postgres:16-alpine` | `postgres:17-alpine` |
| `.github/workflows/ci.yml` service | (new) | `postgres:17-alpine` |
| Host PostgreSQL version (discovery) | `17` | unchanged |

Rationale: the host server already runs PostgreSQL 17. Running 16 in compose/CI against a prod-16→17 upgrade path introduces avoidable schema/extension version drift. Aligning all three surfaces eliminates this class of environment-parity bug. The operator should record this as an ADR (the agent is not permitted to edit `docs/ARCHITECTURE_DECISIONS.md`).

### No `CSRF_SECRET` in env schema

`CSRF_SECRET` is generated in the ephemeral step as instructed, but it is not in the Zod schema in `packages/config/src/env.ts`. The variable is a forward provision; no breaking change to the app results from setting it unused. If the security auditor or backend implementer introduces it to the schema, CI already covers it.

## Risks

- The workflow will not run until the project is initialised as a git repository with a GitHub remote. That is the intended staged state; the top-of-file comment makes this explicit.
- `npm run typecheck -w @wtc/web` syntax works with npm workspaces; confirmed `@wtc/web` workspace name via `apps/web/package.json`.
- The `db:migrate` and `db:seed` steps will fail in CI until `@wtc/db` has those scripts wired up. This is a pre-existing dependency on the db-architect deliverable, not introduced by this change.
- `openssl` is available on `ubuntu-latest` GitHub-hosted runners; no additional install step needed.
- The `e2e` job has no dependency on `gates` completing, so it may run against a non-existent app server. A `needs: [gates]` dependency or a pre-started Next.js dev server may be required when e2e tests are enabled end-to-end. That gate is owned by the tests-runner agent.

## Verification/tests

- Grep confirmed no secret-looking literal (16+ char alphanumeric sequences next to `password/secret/token/key`) exists in `.github/workflows/ci.yml`.
- `docker-compose.yml` re-read: line 4 shows `image: postgres:17-alpine`; no other lines changed.
- `package.json` re-read: `ci:local` script present at line 26; all pre-existing scripts unchanged.
- `tests/e2e/screenshots/.gitkeep` confirmed created via Glob.
- `packages/config/src/env.ts` inspected: `SESSION_SECRET` and `SECRET_VAULT_KEK` are required fields; `AXIOMA_HANDOFF_SIGNING_SECRET` is `.optional()`; `CSRF_SECRET` is absent. All noted above.

## Next actions

- Operator: initialise git repo (`git init`, add GitHub remote) to activate the workflow.
- Operator: record ADR for Postgres 16 → 17 standardisation in `docs/ARCHITECTURE_DECISIONS.md`.
- db-architect / backend-implementer: ensure `@wtc/db` package exposes `db:migrate` and `db:seed` scripts so the CI gates step does not fail on those commands.
- tests-runner agent: evaluate whether `e2e` job needs `needs: [gates]` and a running app server, or a separate Playwright CI config pointing at a deployed preview URL.
- If `CSRF_SECRET` is later added to the env schema (`packages/config/src/env.ts`), no CI change is needed — the ephemeral step already generates it.
