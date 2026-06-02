# ecosystem-bot-integration-auditor handoff
## Scope
Workstream A and B only: real worker acceptance path, `apps/worker/src/index.ts`,
`apps/worker/src/jobs.ts`, journal DB-first behavior, Tortila/legacy bot product surfaces,
config export, safety, and no live bot/exchange/API marks behavior.

Constraints followed: read-only audit; no source-code edits; no live server mutation; no external
exchange, live bot, live journal, SSH, tmux, systemd, or API marks calls.

## Files inspected
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/tick-once.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/mock-tortila.ts`
- `packages/bot-adapters/src/mock-legacy.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`
- `packages/bot-adapters/src/tortila/tortila.mapping.ts`
- `packages/bot-adapters/src/tortila/tortila.schemas.ts`
- `packages/bot-adapters/src/warnings.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/web/src/lib/server-config.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/journal.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/journal/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/bot-journal-review.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `packages/bot-adapters/src/__tests__/getHealth-states.test.ts`
- `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts`
- `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts`
- `.env.example`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`

## Files changed
None - read-only audit

## Findings
1. HIGH - `JOURNAL_READ_TOKEN` prevents only `getHealth()`, not real Tortila data reads.
   Evidence: `packages/bot-adapters/src/factory.ts:21` to `packages/bot-adapters/src/factory.ts:23`
   promises that an absent token reports `readState='not_configured'` and "never silently runs
   unauthenticated"; `packages/bot-adapters/src/http.ts:41` to `packages/bot-adapters/src/http.ts:50`
   sends `Authorization` only when a token exists; `packages/bot-adapters/src/http.ts:146` to
   `packages/bot-adapters/src/http.ts:147` short-circuits only `getHealth()` when the token is absent.
   But the real data methods still call journal endpoints with the same optional token:
   `getMetrics()` at `packages/bot-adapters/src/http.ts:178` to
   `packages/bot-adapters/src/http.ts:205`, `getPositions()` at
   `packages/bot-adapters/src/http.ts:226` to `packages/bot-adapters/src/http.ts:237`,
   `getTrades()` at `packages/bot-adapters/src/http.ts:240` to
   `packages/bot-adapters/src/http.ts:246`, and `getEquityCurve()` at
   `packages/bot-adapters/src/http.ts:249` to `packages/bot-adapters/src/http.ts:260`.
   The worker then calls `getMetrics`, `getPositions`, and `getTrades` after health regardless of
   `readState`: `apps/worker/src/jobs.ts:107` to `apps/worker/src/jobs.ts:138`. The shared web loader
   does the same for requested UI parts: `apps/web/src/features/bots/data.tsx:140` to
   `apps/web/src/features/bots/data.tsx:156`.
   No-network proof run this session with stubbed `fetch`:
   `createHttpTortilaAdapter('http://journal.local').getPositions('x')` called
   `http://journal.local/api/summary` with `auth:null`.
   Recommendation: add a real-adapter preflight shared by all data methods, or make `getJson` reject
   unauthenticated calls for protected Tortila endpoints. In the worker and `loadBotReadModel`, do not
   call data methods after `health.readState === 'not_configured'`; record health-only state instead.
   Add regression tests for `getMetrics`, `getPositions`, `getTrades`, and `getEquityCurve` with no
   token asserting zero fetch calls, plus a worker no-token test asserting no metric/trade import.
   Target part: Workstream A real worker acceptance path and Workstream B read surfaces.

2. MEDIUM - Worker env handling does not honor the documented `TORTILA_JOURNAL_BASE_URL` fallback and
   can silently collect mock data in `BOT_ADAPTER_MODE=read-only`.
   Evidence: `.env.example:39` to `.env.example:42` says both `TORTILA_JOURNAL_URL` and
   `TORTILA_JOURNAL_BASE_URL` are supported; `apps/web/src/lib/server-config.ts:13` to
   `apps/web/src/lib/server-config.ts:14` implements that fallback for web reads; admin health treats
   either var as configured at `apps/web/src/features/admin/queries.ts:254` to
   `apps/web/src/features/admin/queries.ts:257`. The worker path uses only
   `env.TORTILA_JOURNAL_URL` at `apps/worker/src/index.ts:60` to `apps/worker/src/index.ts:62`.
   The factory returns mock when mode is non-mock but `tortilaBaseUrl` is absent:
   `packages/bot-adapters/src/factory.ts:26` to `packages/bot-adapters/src/factory.ts:31`.
   Acceptance requires read-only to return real journal data when `TORTILA_JOURNAL_URL` is set and
   otherwise show honest configured/unreachable states, not simulated data:
   `docs/ACCEPTANCE_MATRIX_MASTER.md:33` to `docs/ACCEPTANCE_MATRIX_MASTER.md:37`.
   Recommendation: normalize worker env resolution to the same canonical-plus-fallback helper as web,
   or fail closed with `not_configured` health-only when `BOT_ADAPTER_MODE` is non-mock and no usable
   Tortila URL exists. Add a `runDbWorkerTick` regression with `BOT_ADAPTER_MODE=read-only` and only
   `TORTILA_JOURNAL_BASE_URL` set.
   Target part: Workstream A worker acceptance/configuration path.

3. MEDIUM - Admin bot ops collapses `not_configured` into "last check error", undoing the worker's
   read-state honesty.
   Evidence: worker mapping explicitly preserves `not_configured` as its own status at
   `apps/worker/src/jobs.ts:58` to `apps/worker/src/jobs.ts:71`, and records the adapter read state
   into health detail at `apps/worker/src/jobs.ts:209` to `apps/worker/src/jobs.ts:223`.
   The regression test states the invariant directly: `tests/integration/worker-health-mapping.test.ts:1`
   to `tests/integration/worker-health-mapping.test.ts:11`. Admin queries define "last error" as any
   `tortila-journal` row with status not equal to `ok` at `apps/web/src/features/admin/queries.ts:285`
   to `apps/web/src/features/admin/queries.ts:299`, then the page labels any such value
   `journal: last check error` at `apps/web/src/app/admin/bots/page.tsx:15` to
   `apps/web/src/app/admin/bots/page.tsx:19`. For a `not_configured` row that contains
   `readStateDetail` but no `error`/`message`, this also degrades to `error (no detail)` via
   `apps/web/src/features/admin/queries.ts:293` to `apps/web/src/features/admin/queries.ts:298`.
   Recommendation: query and render the latest `status`, `detail.readState`, and
   `detail.readStateDetail`; label `not_configured` as setup needed, `unreachable` as down,
   `malformed` as error, and `stale` as stale/old data. Reserve "error" for true `error`/`malformed`
   conditions.
   Target part: Workstream B admin bot ops surface.

4. MEDIUM - The trade journal advertises DB-first behavior but calls the adapter before checking
   durable imports.
   Evidence: `loadBotJournal()` calls `loadBotReadModel(productCode, ['trades'])` before checking for
   a DB at `apps/web/src/features/bots/journal.ts:147` to
   `apps/web/src/features/bots/journal.ts:160`. It only then loads `bot_trade_imports` and reviews at
   `apps/web/src/features/bots/journal.ts:162` to `apps/web/src/features/bots/journal.ts:170`.
   The page tells users "DB-first journal" when imports exist at
   `apps/web/src/app/(app)/app/bots/[bot]/journal/page.tsx:151` to
   `apps/web/src/app/(app)/app/bots/[bot]/journal/page.tsx:156`, and the static test only checks for
   symbol presence, not call ordering: `tests/integration/bot-statistics-static.test.ts:57` to
   `tests/integration/bot-statistics-static.test.ts:65`.
   Recommendation: load DB instance/imports/reviews first when Postgres is available; call the adapter
   only when no durable imports exist or when running in no-DB demo mode. Add a regression that proves
   adapter reads are fallback-only for imported trade rows.
   Target part: Workstream B journal DB-first behavior.

## Decisions
- No source-code edits were made.
- No live server, live bot, SSH, systemd, tmux, exchange, or external journal action was run.
- The real Tortila adapter remains GET-only in code (`packages/bot-adapters/src/http.ts:41` to
  `packages/bot-adapters/src/http.ts:50`) and I found no product-code call to `/api/marks`; `rg` over
  `apps`, `packages`, and `tests` found only comments/docs/test text for `/api/marks`.
- Live control remains hard-disabled in both adapter code and UI: `packages/bot-adapters/src/control.ts:6`
  to `packages/bot-adapters/src/control.ts:18`, `packages/bot-adapters/src/http.ts:57` to
  `packages/bot-adapters/src/http.ts:72`, and `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:180`
  to `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:189`.
- Legacy non-mock mode is blocked instead of live-proxied: `packages/bot-adapters/src/factory.ts:32`
  to `packages/bot-adapters/src/factory.ts:38`; blocked adapter health never fetches the legacy API:
  `packages/bot-adapters/src/legacy/legacy-blocked.ts:54` to
  `packages/bot-adapters/src/legacy/legacy-blocked.ts:70`; tests assert no fetch at
  `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts:111` to
  `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts:120`.
- Config export is entitlement-gated and no-store:
  `apps/web/src/app/api/bots/[bot]/config-export/route.ts:11` to
  `apps/web/src/app/api/bots/[bot]/config-export/route.ts:23`. Export bodies are reference-only and
  omit exchange keys: `apps/web/src/features/bots/config.ts:339` to
  `apps/web/src/features/bots/config.ts:365`.

## Risks
- If `BOT_ADAPTER_MODE=read-only`, `TORTILA_JOURNAL_URL` is set, and `JOURNAL_READ_TOKEN` is absent,
  the worker and UI can still attempt unauthenticated Tortila journal data reads despite health saying
  setup is missing.
- If an operator sets only `TORTILA_JOURNAL_BASE_URL`, admin can show a configured base URL while the
  worker uses no URL and the adapter factory falls back to mock.
- Admin ops may page operators for "error" on an expected setup-needed state, or hide the actual
  `readStateDetail` needed to fix configuration.
- The journal page can contact the adapter even when durable imported trades are already available,
  increasing latency and widening the blast radius of adapter misconfiguration.

## Verification/tests
- Static inspection with `rg` and line-numbered `Get-Content` only.
- Ran a no-network proof with `node --experimental-strip-types --input-type=module` and a stubbed
  `globalThis.fetch`; observed `getPositions()` without a token calls `/api/summary` with no auth
  header. No external network call was made.
- Not run: `npm test`, `node scripts/gates.mjs full`, Playwright, build, real-Postgres harness.
  Reason: this was a read-only auditor handoff with no implementation changes, and scope forbids live
  server/exchange actions.

## Next actions
1. Fix the real Tortila adapter auth boundary so every real data method refuses to fetch without
   `JOURNAL_READ_TOKEN`; add no-token/no-fetch tests for all data methods and the worker tick.
2. Normalize worker Tortila URL resolution to `TORTILA_JOURNAL_URL ?? TORTILA_JOURNAL_BASE_URL`, or
   fail closed with a first-class `not_configured` health-only row in non-mock mode.
3. Fix admin bot health to render the persisted read-state taxonomy instead of treating every non-ok
   row as a generic error.
4. Reorder `loadBotJournal()` so Postgres imports are checked before any adapter fallback call.
5. After fixes, run targeted gates first:
   `npx vitest run packages/bot-adapters/src/__tests__/getHealth-states.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/worker-health-mapping.test.ts tests/integration/bot-journal-review.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-export-static.test.ts`.
   Then run `node scripts/gates.mjs full` and the e2e smoke only in a separate tests-runner pass.
