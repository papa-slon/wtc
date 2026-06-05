# legacy-trade-idempotency-db-auditor handoff
## Scope
Phase 4.30 DB/schema read-only audit for provider-aware Legacy closed-trade import idempotency after Phase 4.29.

The audit stayed within the requested slice: current `bot_trade_imports` uniqueness, nullable `bot_provider_account_id` migration shape, repository conflict-target behavior, focused regression/gate recommendations, and risks. No live DB, worker tick, secret reads, live bot controls, or broad refactors were run. This is an auditor handoff only; implementation remains for the next operator/implementer lane.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260604-1849-phase-4-29-legacy-provider-scope-hardening.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0002_sour_paibok.sql`
- `packages/db/migrations/0018_provider_snapshot_scope.sql`
- `packages/db/migrations/0019_freezing_beyonder.sql`
- `packages/db/migrations/0020_moaning_robin_chapel.sql`
- `packages/db/migrations/meta/_journal.json`
- `packages/db/migrations/meta/0020_snapshot.json`
- `tests/integration/db-0002.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/bot-journal-review.test.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/jobs.ts`
- `package.json`
- `packages/db/package.json`
- `apps/worker/package.json`
- `node_modules/drizzle-orm/pg-core/query-builders/insert.d.ts`

## Files changed
None — read-only audit. Handoff written only at `docs/handoffs/20260604-1852-legacy-trade-idempotency-db-auditor.md`.

## Findings
1. Severity P1 - `bot_trade_imports` currently has exactly one unique index, and it is global rather than provider-aware. Evidence: `packages/db/src/schema.ts:565-592` defines nullable `botProviderAccountId` but keeps `uniqExternalTrade` as `uniqueIndex('bti_external_trade_idx').on(t.botInstanceId, t.externalTradeId, t.sourceAdapter)`; `packages/db/migrations/0002_sour_paibok.sql:264-268` created only `bti_external_trade_idx` as unique plus non-unique closed/external lookup indexes; latest snapshot still records `bti_external_trade_idx` unique on `bot_instance_id`, `external_trade_id`, `source_adapter` at `packages/db/migrations/meta/0020_snapshot.json:2323-2350`, while `bti_provider_closed_idx` and `bti_external_id_idx` are non-unique at `packages/db/migrations/meta/0020_snapshot.json:2372-2413`. Recommendation: replace the global unique index with provider-scoped and unscoped partial unique indexes before Legacy closed-trade imports are called production-ready. Target part: `bot_trade_imports` uniqueness.

2. Severity P1 - A single composite unique index that includes nullable `bot_provider_account_id` is not sufficient for this repo's invariant. Evidence: `packages/db/src/schema.ts:570` and `packages/db/migrations/meta/0020_snapshot.json:2223-2228` show `bot_provider_account_id` is nullable; `packages/db/migrations/0018_provider_snapshot_scope.sql:4-8` added it as nullable with `ON DELETE set null`; Phase 4.29 explicitly deferred provider-aware trade idempotency and recommended separate uniqueness for unscoped and provider-scoped imports at `docs/handoffs/20260604-1849-phase-4-29-legacy-provider-scope-hardening.md:60` and `docs/handoffs/20260604-1849-phase-4-29-legacy-provider-scope-hardening.md:98-100`. Recommendation: use two partial unique indexes, not one nullable composite index:

```sql
CREATE UNIQUE INDEX "bti_external_trade_unscoped_idx"
ON "bot_trade_imports" USING btree ("bot_instance_id","external_trade_id","source_adapter")
WHERE "bot_provider_account_id" IS NULL;

CREATE UNIQUE INDEX "bti_external_trade_provider_idx"
ON "bot_trade_imports" USING btree ("bot_instance_id","bot_provider_account_id","external_trade_id","source_adapter")
WHERE "bot_provider_account_id" IS NOT NULL;

DROP INDEX IF EXISTS "bti_external_trade_idx";
```

In Drizzle schema, mirror this as `uniqueIndex(...).where(sql\`${t.botProviderAccountId} IS NULL\`)` and `uniqueIndex(...).where(sql\`${t.botProviderAccountId} IS NOT NULL\`)`. Create the replacement indexes before dropping the stricter old index when hand-writing/reviewing the migration. Target part: next DB migration and `packages/db/src/schema.ts`.

3. Severity P1 - Repository import behavior currently relies on untargeted `ON CONFLICT DO NOTHING`, so the code does not document which idempotency invariant is intended after the partial-index split. Evidence: `packages/db/src/repositories.ts:2239-2247` says idempotency is `ON CONFLICT (botInstanceId, externalTradeId, sourceAdapter)` but calls `.onConflictDoNothing()` without a target; local Drizzle supports explicit `target` plus `where` for `onConflictDoNothing` at `node_modules/drizzle-orm/pg-core/query-builders/insert.d.ts:134-137`. Recommendation: branch by normalized `input.botProviderAccountId ?? null`:

```ts
const conflict = providerId
  ? insert.onConflictDoNothing({
      target: [
        s.botTradeImports.botInstanceId,
        s.botTradeImports.botProviderAccountId,
        s.botTradeImports.externalTradeId,
        s.botTradeImports.sourceAdapter,
      ],
      where: sql`${s.botTradeImports.botProviderAccountId} IS NOT NULL`,
    })
  : insert.onConflictDoNothing({
      target: [
        s.botTradeImports.botInstanceId,
        s.botTradeImports.externalTradeId,
        s.botTradeImports.sourceAdapter,
      ],
      where: sql`${s.botTradeImports.botProviderAccountId} IS NULL`,
    });
```

Keep audit insertion only after `.returning()` yields a new row, as current code does at `packages/db/src/repositories.ts:2247-2249`. Target part: `importBotTrade`.

4. Severity P2 - Existing tests prove duplicate idempotency only for the unscoped legacy/global invariant, not for same `externalTradeId` across provider accounts. Evidence: `tests/integration/db-0002.test.ts:118-126` inserts the same unscoped trade twice and expects `true` then `false`; `tests/integration/legacy-provider-worker.test.ts:111-154` covers active Legacy provider mapping selection but not trade imports; `tests/integration/legacy-provider-worker.test.ts:156-202` covers provider-scoped metric/position snapshots only; Phase 4.29 lists provider-aware trade idempotency migration/regression as not run/implemented at `docs/handoffs/20260604-1849-phase-4-29-legacy-provider-scope-hardening.md:86-94`. Recommendation: add a DB regression that inserts the same `externalTradeId`/`sourceAdapter` for two different non-null `botProviderAccountId` values on the same `botInstanceId` and expects both inserts to succeed, then repeats each provider and expects `inserted:false`; keep a separate unscoped duplicate test expecting `inserted:false`. Target part: `tests/integration/db-0002.test.ts` plus any Legacy worker closed-trade test once that worker path imports trades.

5. Severity P2 - The current Legacy worker snapshot path does not yet import closed trades, while the generic closed-trade worker path imports trades without provider identity. Evidence: `apps/worker/src/legacy-live.ts:397-480` imports and writes metric/position snapshots only; `apps/worker/src/jobs.ts:233-257` imports closed trades through `importBotTrade` but passes `botInstanceId`, `externalTradeId`, and `sourceAdapter` without `botProviderAccountId`. Recommendation: when Legacy closed-trade import is implemented, pass the mapped WTC provider-account UUID into `importBotTrade`; do not infer idempotency from `pub_id` or raw provider payloads, and do not log provider IDs beyond WTC UUIDs needed for relational scope. Target part: future Legacy closed-trade importer.

6. Severity P2 - The replacement partial indexes interact with the existing `ON DELETE set null` FK on `bot_provider_account_id`. Evidence: `packages/db/src/schema.ts:570` and `packages/db/migrations/0018_provider_snapshot_scope.sql:8` set provider-account deletion to null; the proposed unscoped partial unique index would make a hard delete fail if two provider-scoped rows with the same `bot_instance_id`, `external_trade_id`, and `source_adapter` were nulled into the same key. Recommendation: treat `bot_provider_accounts` as durable identity rows and disable them via status rather than hard-delete; if hard deletes must remain supported, change this FK decision in the same DB slice before allowing provider-duplicate trades. Target part: provider-account lifecycle and trade history retention.

## Decisions
- Do not run `db:migrate`, worker ticks, live DB checks, managed continuity, browser automation, or secret/env reads in this auditor lane.
- The safest migration shape is two partial unique indexes because `bot_provider_account_id` must remain nullable for historical/unscoped imports, while provider-scoped imports need their own idempotency key.
- Keep `bti_instance_closed_idx`, `bti_provider_closed_idx`, and `bti_external_id_idx` as non-unique lookup indexes unless query planning later proves otherwise.
- Prefer explicit repository conflict targets over generic `.onConflictDoNothing()` so idempotency does not silently expand to unrelated future constraints.
- Do not claim Phase 4.30 complete from this audit alone; this handoff is implementation guidance with evidence.

## Risks
- Existing unscoped trade rows can coexist with newly provider-scoped rows for the same `externalTradeId` after the partial-index split. For Legacy this may be acceptable if no Legacy closed-trade imports exist yet, but any existing unscoped Legacy/Tortila data needs an explicit backfill/dedupe decision before changing an importer from unscoped to scoped.
- `ON DELETE set null` on `bot_provider_account_id` can conflict with a new unscoped partial unique index during provider-account hard delete. Disabling provider accounts is safer than deleting them.
- Drizzle generated SQL should be reviewed, because the safest order is to create the replacement partial unique indexes first, then drop `bti_external_trade_idx`.
- PGlite integration tests exercise migrations from files (`tests/integration/db-0002.test.ts:35-40`), but they are not a substitute for a production/managed Postgres migration rehearsal when operator-approved DB URLs are available.
- The worktree is heavily dirty from prior phases; this audit did not certify unrelated changes.

## Verification/tests
RUN this session:
- Read-only file inspection only.
- `git branch --show-current` observed `codex/bot-analytics-settings-canary-20260603`.
- `git status --short` observed a heavily dirty pre-existing worktree, including DB/schema/test files in this slice.

NOT RUN this session:
- `npm run db:migrate` - not run; no live/managed DB mutation allowed.
- `npm run worker:tick`, `npm run accept:worker:continuity`, `npm run accept:worker:continuity:managed` - not run; worker execution is out of scope.
- `npx vitest ...` - not run; this auditor was read-only and did not implement the migration/regression.
- `npm run typecheck`, `npm run lint`, `npm run secret:scan`, `npm run governance:check` - not run; no implementation files changed.
- Live bot start/stop/apply-config, provider reachability, raw secret/env reads, SSH/tmux/systemd, deploy, production monitoring - not run and intentionally out of scope.

Exact gates for the implementation lane:
- `npm run db:generate -w @wtc/db` or equivalent reviewed Drizzle migration generation for the schema/index change.
- `npx vitest run tests/integration/db-0002.test.ts tests/integration/legacy-provider-worker.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/bot-journal-review.test.ts`
- `npm run typecheck`
- `npm run typecheck -w @wtc/worker` if the Legacy worker closed-trade import path is touched.
- `git diff --check`
- `npm run secret:scan`
- `npm run governance:check`

## Next actions
1. Implement the Drizzle schema change and new migration with `bti_external_trade_unscoped_idx` and `bti_external_trade_provider_idx`, then drop `bti_external_trade_idx`.
2. Update `importBotTrade` to use explicit conflict targets with matching partial-index predicates based on whether `botProviderAccountId` is null.
3. Add focused regression coverage for same `externalTradeId` across two provider accounts, same-provider duplicates, and unscoped duplicates.
4. If Legacy closed-trade import is implemented in the same phase, ensure it passes the mapped WTC `botProviderAccountId` into `importBotTrade` and keeps raw provider IDs/secrets out of logs/audit/screenshots.
5. Run the exact implementation gates above and list RUN vs NOT RUN in the aggregate Phase 4.30 handoff.
