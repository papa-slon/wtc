# legacy-provider-tests-auditor handoff
## Scope
Read-only tests audit for Phase 3.72 - Legacy provider-account ingestion + admin mapping foundation. Inspected current coverage around Legacy worker ingestion, provider-account mapping, admin user bot drilldown, config export, bot settings e2e, CSRF/admin/audit guardrails, and no-secret assertions.

No live services, SSH, tmux, systemd, exchange APIs, provider DB, `.env`, worker tick, bot start/stop/retest/apply-config, or live provider DB query were touched. At handoff time the worktree already had in-progress dirty changes, including `apps/worker/src/legacy-live.ts` changing during this audit to add provider-account scoped worker logic; this handoff reflects the current dirty tree after re-reading that file.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1758-phase-3-71-legacy-provider-account-scope.md`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/index.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0018_provider_snapshot_scope.sql`
- `packages/audit/src/audit.test.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/legacy-live-worker-static.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/csrf-coverage.test.ts`
- `tests/integration/admin-account-unlock-static.test.ts`
- `tests/integration/admin-account-unlock-db.test.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/e2e/helpers/auth.ts`
- `playwright.auth.config.ts`
- `playwright.auth-db.config.ts`

## Files changed
None - read-only audit.

Handoff written: `docs/handoffs/20260603-1815-legacy-provider-tests-auditor.md`.

## Findings
1. Severity: Critical. Legacy worker provider-account ingestion now has implementation hooks but no executable DB coverage proving `bot_provider_account_id` is written. Evidence: `apps/worker/src/legacy-live.ts:391` exports `snapshotLegacyRowsToWtc`, `apps/worker/src/legacy-live.ts:416` and `apps/worker/src/legacy-live.ts:450` pass `botProviderAccountId` into metric/position inserts, and `apps/worker/src/legacy-live.ts:516`, `apps/worker/src/legacy-live.ts:535`, `apps/worker/src/legacy-live.ts:538` iterate active mappings and read each mapped `providerAccountId`. Current tests only exercise helper transforms and source whitelisting at `tests/integration/legacy-live-worker-static.test.ts:96`, `tests/integration/legacy-live-worker-static.test.ts:164`, and `tests/integration/legacy-live-worker-static.test.ts:175`. Recommendation: add `tests/integration/legacy-live-worker-db.test.ts` or extend `legacy-live-worker-static.test.ts` with PGlite migrations, two users, two Legacy bot instances, two `bot_provider_accounts`, and direct calls to `snapshotLegacyRowsToWtc`; assert metric and position rows carry the mapped account id, fleet fallback rows remain null, `rawJson.providerAccountScoped` is true/false as expected, B-user rows are absent, and secret sentinel strings never appear. Target part: worker Legacy ingestion.

2. Severity: Critical. Production user Legacy reads are source-checked but not behavior-checked against real DB rows. Evidence: `apps/web/src/features/bots/data.tsx:330` fails closed on zero/multiple active mappings, `apps/web/src/features/bots/data.tsx:345` to `apps/web/src/features/bots/data.tsx:352` build provider-scoped metric/position/trade filters, but `tests/integration/bot-read-safety-static.test.ts:87` to `tests/integration/bot-read-safety-static.test.ts:94` only match source text. Recommendation: add `tests/integration/bot-read-safety-db.test.ts` using PGlite plus mocked `getServerDb`/server config, or extract an injectable pure DB read helper. Seed user A mapped rows, user B mapped rows, and a newer null fleet row on user A's Legacy instance; assert `loadBotReadModelForUser(userA, 'legacy_bot', ...)` returns only A mapped facts, excludes B/null rows, returns `Legacy provider mapping required` for no active mapping, returns the ambiguous issue for multiple active mappings, and does not fall back to the adapter when production DB snapshot mode has a DB. Target part: user read path.

3. Severity: High. Admin user bot drilldown displays mapped/pending state, but its metric selection is not provider-account scoped and the pending/disabled cases lack executable coverage. Evidence: the loader fetches provider accounts by target user at `apps/web/src/features/admin/user-bot-detail-loader.ts:202` to `apps/web/src/features/admin/user-bot-detail-loader.ts:214`, but metric rows are selected only by bot instance at `apps/web/src/features/admin/user-bot-detail-loader.ts:218` to `apps/web/src/features/admin/user-bot-detail-loader.ts:243`, then first row wins at `apps/web/src/features/admin/user-bot-detail-loader.ts:276` to `apps/web/src/features/admin/user-bot-detail-loader.ts:304`. Current DB test proves one mapped path and other-user leakage at `tests/integration/admin-user-bot-detail-loader.test.ts:217`, `tests/integration/admin-user-bot-detail-loader.test.ts:262`, and `tests/integration/admin-user-bot-detail-loader.test.ts:282`, while the pending state is only static at `tests/integration/admin-user-bot-detail-static.test.ts:47`. Recommendation: extend `admin-user-bot-detail-loader.test.ts` with mapped metric vs newer null same-instance metric, no-active-mapping pending state, disabled/needs_review mapping not counted as mapped, and no other-user/null fleet leakage. If the null same-instance fixture wins today, update the loader to filter Legacy latest metrics by the active provider account id. Target part: admin user bot drilldown.

4. Severity: High. Admin provider-account map/update/disable forms and actions do not exist yet, and repository audit behavior is not covered beyond audit action registration. Evidence: current admin drilldown page is read-only with mapped/pending copy at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:104`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:115`, and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:167`; repository primitives write audit at `packages/db/src/repositories.ts:1705`, `packages/db/src/repositories.ts:1775`, `packages/db/src/repositories.ts:1797`, and `packages/db/src/repositories.ts:1812`; `packages/audit/src/audit.test.ts:57` to `packages/audit/src/audit.test.ts:63` only verifies action codes exist. Recommendation: add `tests/integration/bot-provider-account-mapping-db.test.ts` for map/update/disable audit rows, duplicate active claim failure, disabled mapping behavior, trimmed/validated provider ids, snapshot insert helpers retaining `botProviderAccountId` for metrics/positions/trades/safety, and audit payload redaction. Also add `tests/integration/admin-provider-account-actions-static.test.ts` once actions land: require `requireUser`, `assertAdmin`, `assertCsrf`, Zod schema, repo call, revalidate of `/admin/users/${targetUserId}/bots` and `/admin/audit-log`, and no exchange secret field references. Target part: admin mapping forms/actions and repository audit.

5. Severity: High. Config export provider-mapping behavior is static-only. Evidence: route gates session/access and uses user-scoped Legacy read at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:12`, `apps/web/src/app/api/bots/[bot]/config-export/route.ts:13`, and `apps/web/src/app/api/bots/[bot]/config-export/route.ts:18`; it returns `provider_mapping_required` at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:25`; `tests/integration/bot-config-export-static.test.ts:31` only source-matches that string. Recommendation: add an injectable `config-export-handler` test or route test with mocks proving Legacy missing mapping returns 403 JSON without attachment headers, mapped Legacy exports the provider-scoped live config, Tortila uses saved config without Legacy read, all success responses set `cache-control: no-store`, and no `apiKey`/`apiSecret`/`authorization`/`token` sentinels appear in body or headers. Target part: config export.

6. Severity: Medium. Playwright coverage does not prove mapped/pending provider-account states in a DB-backed admin/user flow. Evidence: `tests/e2e/bot-settings.spec.ts:13` covers safe settings rendering and `tests/e2e/bot-settings.spec.ts:41` only checks the export link; `tests/e2e/admin-mobile-pg8.spec.ts:23` visits `/admin/users/demo-user/bots` and `tests/e2e/admin-mobile-pg8.spec.ts:36` focuses 375px shell readability. Recommendation: add a DB-backed Playwright spec, using the guarded auth DB harness or a dedicated prepared e2e DB, that logs in as admin and verifies a mapped user shows `provider account mapped`, a pending user shows `provider account pending` / `Provider account not mapped`, mapping forms carry CSRF once implemented, no other-user pub_id/secret markers render, and desktop/mobile screenshots have no horizontal scroll. Extend bot settings e2e so a mapped Legacy user sees provider-account context and a pending Legacy user sees mapping-required/export-blocked behavior. Target part: Playwright mapped/pending states.

7. Severity: Medium. No-secret coverage exists in narrow helper tests but is not yet tied to the new provider-account mapping and worker error/health paths. Evidence: helper tests exclude exchange-key field names at `tests/integration/legacy-live-worker-static.test.ts:164` and `tests/integration/legacy-live-worker-static.test.ts:175`, while worker provider-account health/error details now include scoped counters and internal mapping ids at `apps/worker/src/legacy-live.ts:480` to `apps/worker/src/legacy-live.ts:485` and `apps/worker/src/legacy-live.ts:569` to `apps/worker/src/legacy-live.ts:589`. Recommendation: every new DB/action/e2e test above should seed sentinel values like `api_key_SHOULD_NOT_LEAK`, `secret_key_SHOULD_NOT_LEAK`, `Bearer SHOULD_NOT_LEAK`, `password=SHOULD_NOT_LEAK`, and B-user pub_id markers, then assert audit rows, health detail, config export responses, page text, and retained screenshots do not contain them. For full `providerAccountId`/pub_id display, set an explicit policy: user surfaces should use masked/short ids; admin mapping surfaces may show full ids only where intended. Target part: no secret leaks.

## Decisions
1. Treat static/source tests as guardrails only; acceptance for this phase needs executable DB tests for worker writes, read isolation, repository audit, and route responses.
2. Do not test against the live Legacy provider DB. Use synthetic provider rows and PGlite WTC DB fixtures.
3. Prefer adding focused tests over broad snapshots: one test per boundary and risk gate, with explicit sentinel values for cross-user/null-fleet leakage and secrets.
4. If `loadBotReadModelForUser` or the config export route is hard to test because of Next/server-only wiring, extract small injectable helpers rather than weakening the assertions.

## Risks
1. The dirty worktree changed while this audit was running; re-run the focused `rg`/test discovery before final acceptance.
2. The current admin drilldown loader likely needs a provider-account metric filter before it can pass a null fleet row regression test.
3. Generic `csrf-coverage.test.ts` will catch missing `assertCsrf`, but it will not prove target-user scoping, admin-only authorization, Zod schemas, audit rows, or duplicate-claim handling.
4. Playwright DB-backed provider-account states may need a new guarded e2e setup if the existing auth DB harness remains limited to `auth-production-profile.spec.ts`.

## Verification/tests
RUN:
1. Static inspection only with `git status`, `rg`, `Select-String`, and `Get-Content`.

NOT RUN:
1. `npm test` - not run; read-only audit scope.
2. `npx vitest ...` - not run; read-only audit scope.
3. Playwright - not run; would create runtime artifacts and needs an implementation slice.
4. `npm run typecheck`, `npm run lint`, `npm run secret:scan`, `npm run governance:check` - not run; no product-code edits by this auditor.
5. Worker tick, managed DB, live DB migrations, live provider DB, live exchange/API checks, bot start/stop/retest/apply-config - not run and forbidden for this phase.

## Next actions
1. Add `tests/integration/legacy-live-worker-db.test.ts` for `snapshotLegacyRowsToWtc` provider-account writes and fleet-null fallback.
2. Add `tests/integration/bot-read-safety-db.test.ts` for user read isolation across mapped, missing, ambiguous, other-user, and null-fleet rows.
3. Extend `tests/integration/admin-user-bot-detail-loader.test.ts` for pending/disabled mapping states and provider-account scoped metrics.
4. Add `tests/integration/bot-provider-account-mapping-db.test.ts` for repository map/update/disable audit, duplicates, redaction, and snapshot helper persistence.
5. Add admin mapping schemas/actions/forms plus static tests proving the admin/CSRF/Zod/repo/audit/revalidate pipeline.
6. Add config export handler/route tests for `provider_mapping_required`, mapped Legacy export, Tortila export, headers, and redaction.
7. Add DB-backed Playwright mapped/pending coverage for admin drilldown and Legacy settings/export states, then run the targeted Vitest specs, `npm run typecheck -w @wtc/web`, `npm run lint`, `npm run secret:scan`, and the new Playwright spec.
