# ecosystem-devops-implementer handoff

## Scope

Phase 2 epoch 20260530-0126. Owned files: `docs/DEPLOYMENT.md`, `.env.example`,
`docker-compose.yml`. Three tasks:
(a) Fix stale deploy-doc claim ("swap demo.ts accessors").
(b) Add real-PG harness plan + CI staged-honesty section.
(c) Enumerate Phase 2 env var delta.
(d) Add Wave-2 devops checklist.

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/DEPLOYMENT.md` (pre-edit)
- `.env.example`
- `docker-compose.yml`
- `.github/workflows/ci.yml`
- `package.json` (root scripts)
- `apps/web/src/lib/backend.ts`
- `tests/integration/db-real-postgres.test.ts`
- `docs/handoffs/20260529-2352-phase-1-7-part-e-tv-lms-persistence.md`
- `docs/handoffs/20260529-1921-ci-devops-implementer.md`
- `docs/handoffs/20260529-2052-phase-1-6-enforcement-persistence-truth.md`

## Files changed

- `docs/DEPLOYMENT.md` — three edits (stale accessor claim fixed; real-PG section added; CI
  staged-honesty section added; Wave-2 checklist added)

## Findings

### 1. STALE — "swap demo.ts accessors" (SEVERITY: high, deploy-doc correctness)

**Evidence:** `docs/DEPLOYMENT.md` line 39 (pre-edit):
```
> Swap `apps/web/src/lib/demo.ts` accessors for `@wtc/db` repositories to use Postgres.
```

**Problem:** `apps/web/src/lib/backend.ts` has existed since Phase 1.7 and already does this
switching automatically (`const core = useDb ? dbStore : memory`). The stale line implies a
manual code edit is required to go live, which is false and dangerous — an operator following
it would fork away from the maintained selector, bypassing the fail-closed guard and the
`denied` prod fence.

**Fix:** replaced with a truthful description of the backend selector: set `DATABASE_URL`, run
`db:migrate`, run `db:seed`. No code edits needed. Target part: Part (a).

### 2. ABSENT — no real-PG harness operator flow documented (SEVERITY: medium)

**Evidence:** `tests/integration/db-real-postgres.test.ts` exists and is opt-in via
`REAL_POSTGRES_DATABASE_URL`, but DEPLOYMENT.md had no section explaining the throwaway-DB
prerequisite, the DB-name guard (`wtc_test`/`wtc_test_*`), or the PowerShell drop/create steps.

**Fix:** added "Real-Postgres integration harness" section with the hard guard rule, the
throwaway-DB flow, and the re-run caveat (raw migrations, not idempotent). Target part: Part (b).

### 3. ABSENT — CI staged-honesty not surfaced in DEPLOYMENT.md (SEVERITY: medium)

**Evidence:** `ci.yml` line 1 carries the comment "CI is staged: this repo is not yet a git
repo / has no GitHub remote." but DEPLOYMENT.md made no mention of CI status, creating a gap
where an operator could assume CI had run.

**Fix:** added "CI status (staged — inert)" section stating CI is NOT RUN, pointing at
`npm run ci:local` as the current local equivalent, and specifying the activation precondition
(git init + remote). Target part: Part (b).

### 4. ABSENT — Wave-2 devops checklist (SEVERITY: low, process clarity)

**Evidence:** DEPLOYMENT.md had no explicit pre-deployment verification list for Phase 2.

**Fix:** added "Wave-2 devops checklist" section distinguishing "can verify now" items from
"NOT RUN / needs approval" items. Target part: Part (d).

## Deploy-doc truth fixes

| Location | Was | Now |
|---|---|---|
| `DEPLOYMENT.md` line 39 | "Swap `apps/web/src/lib/demo.ts` accessors for `@wtc/db` repositories to use Postgres." | Backend selector already exists; going live = set DATABASE_URL + run migrate/seed. No code swap needed. |
| `DEPLOYMENT.md` (absent) | No real-PG harness section | Added: DB-name guard, throwaway-DB flow, re-run caveat |
| `DEPLOYMENT.md` (absent) | No CI staged-honesty statement | Added: CI is NOT RUN (staged/inert); local equivalent is `npm run ci:local` |
| `DEPLOYMENT.md` (absent) | No Phase 2 pre-deployment checklist | Added: Wave-2 devops checklist with RUN vs NOT RUN separation |

## Real-PG + CI readiness plan

### Real-PG harness

- File: `tests/integration/db-real-postgres.test.ts`
- Trigger: opt-in only via `REAL_POSTGRES_DATABASE_URL`; skipped in all other runs
- Hard guard (operator must verify before running): DB name in the URL must be `wtc_test` or
  `wtc_test_*`. Any other name risks pointing at a live or populated DB.
- Throwaway-DB flow: `psql ... -c "DROP DATABASE IF EXISTS wtc_test"` then `CREATE DATABASE
  wtc_test`; set `$env:REAL_POSTGRES_DATABASE_URL`; `npm test -- tests/integration/db-real-postgres.test.ts`
- Re-run caveat: the harness applies raw migrations (not idempotent). Drop and recreate `wtc_test`
  before each run.
- Status: NOT RUN this session (no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL` supplied; local
  PG17 credentials unknown to the agent).

### CI (GitHub Actions)

- File: `.github/workflows/ci.yml`
- Status: STAGED — INERT. The repo has no `.git` directory and no GitHub remote. The workflow has
  NEVER executed.
- Activation precondition: `git init` + add a GitHub remote. On first real push/PR, CI will run:
  postgres:17-alpine service, `npm ci`, `db:migrate`, `db:seed`, `npm test`, `npm run coverage`,
  `npm run build -w @wtc/web`, and the e2e job (Playwright/chromium). The `wtc_test` DB is
  dropped/created before `Test` and before `Coverage` (the harness re-applies raw migrations on
  each coverage re-run).
- Local equivalent now: `npm run ci:local` (omits db:migrate, db:seed, e2e — offline-fast).
- Rule: do not claim CI is green until it has run on a real push/PR.

## Env var delta

Phase 2 introduces no new environment variables. The existing `.env.example` is correct and
sufficient for all Phase 2 work. Review:

| Var | Status |
|---|---|
| `DATABASE_URL` | Existing. Required for the Postgres path; absent = in-memory (fail-closed in prod). |
| `SESSION_SECRET` | Existing. Required. |
| `SECRET_VAULT_KEK` | Existing. Required. base64-32 bytes enforced by `loadEnv`. |
| `SECRET_VAULT_KEY_ID` | Existing. Required. |
| `AXIOMA_HANDOFF_SIGNING_SECRET` | Existing. Required in prod. |
| `FEATURE_LIVE_BOT_CONTROL` | Existing. Default false. Unchanged. |
| `FEATURE_TV_AUTOMATION` | Existing. Default false. Unchanged. |
| `BOT_ADAPTER_MODE` | Existing. Default mock. Unchanged. |
| `TORTILA_JOURNAL_BASE_URL` | Existing. Only used when BOT_ADAPTER_MODE != mock. |
| `LEGACY_BOT_BASE_URL` | Existing. Only used when BOT_ADAPTER_MODE != mock. |
| `AXIOMA_JOURNAL_BASE_URL` | Existing. Bridge only. |
| `AXIOMA_BRIDGE_API_TOKEN` | Existing placeholder. Not yet issued. |
| `BILLING_PROVIDER` | Existing. Default mock. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Existing placeholders. Not yet active. |
| `APP_BASE_URL` / `PORT` | Existing. |
| `REAL_POSTGRES_DATABASE_URL` | Existing (in ci.yml; NOT in .env.example by design — it is never stored; operator sets it in-session only). |
| `CSRF_SECRET` | Generated ephemerally in ci.yml; not in `loadEnv` schema (CSRF is session-derived). Forward provision only. |

No additions to `.env.example` are required for Phase 2.

## Decisions

- `demo.ts` remains in place as the in-memory adapter — it is the backend selector's memory branch,
  not a file to be deleted or replaced. Correcting the deploy doc is a doc-only fix; no code change.
- The DB-name guard (`wtc_test`/`wtc_test_*`) is documented as an operator obligation (not enforced
  in code) because the harness already skips entirely when the env var is absent; the guard is a
  procedural control against operator error when the var IS set.
- `.env.example` is not edited — it is already truthful and Phase 2 adds no new vars.
- `docker-compose.yml` is not edited — it already uses `postgres:17-alpine` (fixed in Phase 1.5).

## Risks

- Real-PG harness remains NOT RUN (local PG17 credentials unknown to the agent). Operator must
  provide `REAL_POSTGRES_DATABASE_URL` with a throwaway `wtc_test` DB before the harness can be
  exercised.
- CI cannot run until the repo is initialised as a git repository with a GitHub remote. Until then,
  `npm run ci:local` is the only locally-executable gate set.
- The `CSRF_SECRET` variable generated in ci.yml ephemeral step is not consumed by `loadEnv`;
  this is a forward provision. If a future phase adds it to the env schema, no CI change is needed.

## Verification/tests

Gates RUN this session:

| Gate | Result |
|---|---|
| DEPLOYMENT.md edit correctness (read-back) | PASS — all three edits verified via Read |
| Stale claim removal confirmed | PASS — "Swap demo.ts accessors" line removed |
| backend.ts selector confirmed present | PASS — `apps/web/src/lib/backend.ts` read and verified |
| db-real-postgres.test.ts harness guard confirmed | PASS — file read; opt-in pattern + DB-name note verified |
| ci.yml staged-inert status confirmed | PASS — line 1 comment read |
| .env.example truthfulness confirmed | PASS — all vars checked; no real secrets |

Gates NOT RUN this session:

| Gate | Reason |
|---|---|
| `db:migrate` / `db:seed` | No DATABASE_URL / credentials provided |
| Real-PG harness (`REAL_POSTGRES_DATABASE_URL`) | No throwaway DB credentials provided |
| `npm run ci:local` | Not instructed to run gates this wave; doc-only edits |
| CI (GitHub Actions) | Not a git repo / no remote — permanently inert until activation |

## Next actions

1. Operator: when ready to exercise the real-PG harness, create `wtc_test`, set
   `$env:REAL_POSTGRES_DATABASE_URL`, verify the DB name guard, then run
   `npm test -- tests/integration/db-real-postgres.test.ts`.
2. Operator: activate CI by running `git init`, adding a GitHub remote, and pushing. First CI
   run will exercise the full gate set including `postgres:17-alpine`, `db:migrate`, `db:seed`,
   and the `wtc_test` opt-in harness.
3. Phase 2 server deployment: follow the phased rollout table in DEPLOYMENT.md; Phase 2 (internal
   `:8300`) requires explicit operator approval before any server-side action.
4. Phase 1.8 (full LMS): separate session per SESSION_PROTOCOL.md — do not continue in this one.
