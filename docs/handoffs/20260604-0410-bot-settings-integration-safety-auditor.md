# bot-settings-integration-safety-auditor handoff
## Scope
Read-only Phase 3.94 bot integration and safety audit for Legacy and Tortila bot settings, statistics, readiness, admin inspection, global config, and live-control boundaries. I did not touch live bots, provider DBs, worker restart/tick paths, exchanges, env, vault, SSH, tmux, systemd, or the live server. Product code and tests were not edited.

## Files inspected
- AGENTS.md
- docs/SESSION_PROTOCOL.md
- docs/handoffs/0000-orchestrator-seed.md
- docs/STATUS.md
- docs/IMPLEMENTED_FILES.md
- docs/NEXT_ACTIONS.md
- docs/handoffs/20260604-0340-phase-3-93-admin-global-provider-identity-boundary.md
- apps/web/src/features/bots/config.ts
- apps/web/src/features/bots/config-action-handler.ts
- apps/web/src/features/bots/config-export.ts
- apps/web/src/features/bots/config-export-handler.ts
- apps/web/src/features/bots/runtime-config-sanitizer.ts
- apps/web/src/features/bots/readiness.ts
- apps/web/src/features/bots/readiness-loader.ts
- apps/web/src/features/bots/data.tsx
- apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/page.tsx
- apps/web/src/app/(app)/app/bots/statistics/page.tsx
- apps/web/src/app/api/bots/[bot]/config-export/route.ts
- apps/web/src/lib/access.ts
- apps/web/src/lib/backend.ts
- apps/web/src/lib/db-store.ts
- apps/web/src/features/admin/actions.ts
- apps/web/src/features/admin/queries.ts
- apps/web/src/features/admin/bot-health-loader.ts
- apps/web/src/features/admin/user-bot-detail-loader.ts
- apps/web/src/features/admin/health-detail.ts
- apps/web/src/app/admin/bots/page.tsx
- apps/web/src/app/admin/bots/config/page.tsx
- apps/web/src/app/admin/users/[userId]/bots/page.tsx
- packages/db/src/schema.ts
- packages/db/src/repositories.ts
- packages/audit/src/redact.ts
- packages/entitlements/src/engine.ts
- packages/bot-adapters/src/types.ts
- packages/bot-adapters/src/control.ts
- packages/bot-adapters/src/factory.ts
- packages/bot-adapters/src/http.ts
- packages/bot-adapters/src/legacy/legacy-blocked.ts
- packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts
- apps/worker/src/index.ts
- apps/worker/src/jobs.ts
- apps/worker/src/legacy-live.ts
- Focused tests listed under Verification/tests.

## Files changed
1. docs/handoffs/20260604-0410-bot-settings-integration-safety-auditor.md

## Findings
1. Severity: High. No reviewed web UI/action currently starts, stops, retests, applies config to, or otherwise mutates a live Legacy or Tortila bot. Evidence: the orchestrator seed keeps bot controls mock/read-only until a separately audited adapter is approved (docs/handoffs/0000-orchestrator-seed.md:117); user settings save behavior is explicitly "WTC version only" with no live apply/start/stop/retest (apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:287); setup has the same "no live apply/start/stop" boundary (apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:289); DB config save is "WTC DB only; NEVER forwarded to the live bot" (packages/db/src/repositories.ts:2179); adapter types define start/stop/apply as Promise<never> (packages/bot-adapters/src/types.ts:90); every HTTP control method calls the disabled-control guard (packages/bot-adapters/src/http.ts:59). Recommendation: keep all startBot/stopBot/applyConfig routes absent until a separate bot-integration plus security audit approves a real control adapter. Target: main agent, bot web/actions/adapters.

2. Severity: High. User bot settings, readiness, and statistics are entitlement-gated and normally scoped to the authenticated user's own bot instance and provider/exchange metadata. Evidence: `loadBot` requires a user and calls `botAccessForUser` (apps/web/src/features/bots/data.tsx:29); entitlement denial paths fail closed in the engine (packages/entitlements/src/engine.ts:120, packages/entitlements/src/engine.ts:150); readiness uses `botAccessForUser` before loading runtime state (apps/web/src/features/bots/readiness-loader.ts:123); denied readiness returns a hidden/no-runtime shape before reading live summaries (apps/web/src/features/bots/readiness-loader.ts:126, apps/web/src/features/bots/readiness-loader.ts:154, apps/web/src/features/bots/readiness-loader.ts:155); user read models tell users no global snapshots are used when their instance is missing (apps/web/src/features/bots/data.tsx:446); snapshot queries scope by bot instance and Legacy provider account where applicable (apps/web/src/features/bots/data.tsx:485, apps/web/src/features/bots/data.tsx:488, apps/web/src/features/bots/data.tsx:491); config export requires user access and returns 403 on entitlement failure (apps/web/src/features/bots/config-export-handler.ts:53). Recommendation: do not introduce user-facing bot read paths that bypass `loadBot`, `loadBotReadinessForUser`, or `loadBotReadModelForUser`. Target: main agent, user bot surfaces.

3. Severity: High. Legacy live HTTP access remains intentionally blocked; Legacy runtime facts come from read-only DB snapshots and provider mappings, not from a live control/API path. Evidence: the Legacy blocked adapter states there is no code path that can reach the plaintext-key endpoint in any adapter mode (packages/bot-adapters/src/legacy/legacy-blocked.ts:14); factory selection returns the blocked Legacy adapter in real modes (packages/bot-adapters/src/factory.ts:35); Legacy worker reads are env-gated by `LEGACY_LIVE_READS_ENABLED` and `LEGACY_DATABASE_URL` (apps/worker/src/legacy-live.ts:490, apps/worker/src/legacy-live.ts:491); the worker rejects selected secret fields (apps/worker/src/legacy-live.ts:145); Legacy worker snapshots write metric/position rows only (apps/worker/src/legacy-live.ts:414, apps/worker/src/legacy-live.ts:448). Recommendation: keep Legacy HTTP adapter blocked until upstream plaintext `/api_management` behavior is removed or wrapped by a separately audited secret-safe bridge. Target: main agent, Legacy integration.

4. Severity: High. Exchange secrets are not exposed by current user/admin read paths. Evidence: schema says `exchange_api_key_secrets` has no plaintext column (packages/db/src/schema.ts:6); the sealed payload lives in `exchangeApiKeySecrets.sealed` (packages/db/src/schema.ts:128, packages/db/src/schema.ts:132); exchange-key creation audits only label/exchange/mode/keyMask/keyId, not sealed or plaintext material (packages/db/src/repositories.ts:397, packages/db/src/repositories.ts:399); `listExchangeKeys` never joins the secret table (packages/db/src/repositories.ts:404, packages/db/src/repositories.ts:406); metadata checks select only secret-row ids (packages/db/src/repositories.ts:415, packages/db/src/repositories.ts:467); admin user detail renders key masks and says secret material is not loaded (apps/web/src/app/admin/users/[userId]/bots/page.tsx:290). Recommendation: keep future exchange pings metadata-only/read-only until the exchange adapter passes security and bot-integration audit, and keep sealed payloads out of read DTOs. Target: main agent, exchange key readiness.

5. Severity: Medium. Config source of truth is coherent: built-in fallback, admin-published system default, and user-owned override are WTC reference profiles; runtime snapshots are evidence only. Evidence: user settings load/persist/select helpers are WTC config helpers (apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:40, apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:111); `loadBotConfig`, `persistBotConfig`, and `selectSystemDefaultBotConfig` are the source-of-truth entry points (apps/web/src/features/bots/config.ts:899, apps/web/src/features/bots/config.ts:959, apps/web/src/features/bots/config.ts:978); admin defaults write `bot_global_configs`, append version history, and audit metadata only (apps/web/src/app/admin/bots/config/page.tsx:235); admin copy says defaults define inheritance and do not mutate user overrides or running bots (apps/web/src/app/admin/bots/config/page.tsx:285); user settings say Legacy provider mappings/balances/slots/orders/runtime snapshots are read-only evidence, not settings source (apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:369). Recommendation: preserve this ownership model in docs and UI copy; do not hydrate editable configs from runtime snapshots. Target: main agent, bot settings.

6. Severity: Medium. Admin inspection is correctly admin-gated, but admin still has WTC DB mutation actions for global defaults and Legacy provider mappings. This is not live bot mutation, but acceptance wording must distinguish read-only detail pages from admin metadata/config writes. Evidence: admin bot health page requires user plus admin and has no live-control buttons (apps/web/src/app/admin/bots/page.tsx:72, apps/web/src/app/admin/bots/page.tsx:73); admin user bot detail requires user plus admin (apps/web/src/app/admin/users/[userId]/bots/page.tsx:72, apps/web/src/app/admin/users/[userId]/bots/page.tsx:73); detail labels user settings/provider mappings read-only (apps/web/src/app/admin/users/[userId]/bots/page.tsx:93, apps/web/src/app/admin/users/[userId]/bots/page.tsx:94); mapping and disable actions require user/admin/CSRF before DB repo writes (apps/web/src/features/admin/actions.ts:355, apps/web/src/features/admin/actions.ts:398); global config save requires user/admin and writes global WTC config (apps/web/src/features/admin/actions.ts:496, apps/web/src/app/admin/bots/config/page.tsx:133). Recommendation: main agent should document "admin read-only user detail and fleet health" separately from "admin WTC DB metadata/global-default mutations"; neither category should be described as live bot control. Target: main agent, admin bot pages/actions.

7. Severity: Medium. Sanitizer and config guard constants have alias drift. The action, admin, and repository guards block `exchangeapply`, `exchangeorder`, and `livecontrol`, but the runtime sanitizer and user config local guard do not list those aliases. Evidence: action form forbidden keys include these aliases (apps/web/src/features/bots/config-action-handler.ts:76, apps/web/src/features/bots/config-action-handler.ts:77, apps/web/src/features/bots/config-action-handler.ts:78); admin form forbidden keys include the same aliases (apps/web/src/features/admin/actions.ts:465, apps/web/src/features/admin/actions.ts:466, apps/web/src/features/admin/actions.ts:467); repository guard includes the same aliases (packages/db/src/repositories.ts:540, packages/db/src/repositories.ts:541, packages/db/src/repositories.ts:542); runtime sanitizer starts its own forbidden set without those aliases (apps/web/src/features/bots/runtime-config-sanitizer.ts:3); user config has its own forbidden set (apps/web/src/features/bots/config.ts:713). Current normal writes are still protected by form and repository guards, and focused tests passed, but a raw runtime `liveConfig` containing a new alias could be displayed unless separately redacted. Recommendation: centralize bot forbidden-key aliases in one package/helper and add parity tests for action, admin, user config parse, runtime sanitizer, and repository guards. Target: main agent, config safety constants/tests.

8. Severity: Medium. Production DB availability appears fail-closed, which limits adapter-fallback leakage risk, but user pages should keep Tortila production reads DB-scoped by policy. Evidence: `backend.ts` says production without `DATABASE_URL` must not silently use memory (apps/web/src/lib/backend.ts:4); `getServerDb()` throws when production DB is denied (apps/web/src/lib/backend.ts:44, apps/web/src/lib/backend.ts:45); `db-store` also requires `DATABASE_URL` (apps/web/src/lib/db-store.ts:50, apps/web/src/lib/db-store.ts:51); `loadBotReadModelForUser` exists as the user-scoped entry point (apps/web/src/features/bots/data.tsx:704). Recommendation: keep or add a static guard that production non-mock user pages fail closed if the DB-scoped read model is unavailable, rather than falling back to product-level adapter reads. Target: main agent, user statistics/dashboard loader.

## Decisions
1. Treated this as a per-agent read-only audit lane, not a broad implementation phase; no background agents were launched from this lane.
2. Did not run worker ticks, live preview, live HTTP probes, exchange pings, provider DB reads, env/vault inspection, SSH, tmux, systemd, or server mutations.
3. Considered admin provider mapping/global default actions WTC DB mutations, not live bot mutations. They are in scope for safety classification but should remain clearly labeled.
4. Accepted the focused Vitest suite as this lane's executable verification gate; full lint/build/e2e were out of scope for this read-only auditor.

## Risks
1. The worktree was already dirty before this handoff; I did not revert or normalize unrelated files.
2. Runtime `liveConfig` snapshots can contain Legacy provider identifiers before UI sanitization; current user/admin views mask or strip them, but guard drift should be closed before expanding runtime config panels.
3. There is no DB-level JSONB CHECK shown for forbidden bot config keys; direct SQL can bypass repository/action guards.
4. Admin pages intentionally reveal some provider-account identifiers/masks to admins for ownership mapping. This is not an exchange secret, but it should remain admin-only and read-only on detail pages.
5. This audit did not prove live production state, canary logs, provider DB contents, or deployed env flags; it only reviewed source and ran local read-only tests.

## Verification/tests
RUN:
1. Read required protocol and phase docs: AGENTS.md, docs/SESSION_PROTOCOL.md, docs/handoffs/0000-orchestrator-seed.md, docs/STATUS.md, docs/IMPLEMENTED_FILES.md, docs/NEXT_ACTIONS.md, docs/handoffs/20260604-0340-phase-3-93-admin-global-provider-identity-boundary.md.
2. Static source search for bot control, forbidden keys, exchange secret read paths, DB fail-closed paths, admin gates, user gates, worker read paths, and config source-of-truth.
3. `git status --short` observed a dirty worktree before the handoff write.
4. `npx vitest run tests/integration/admin-bot-health-loader.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/bot-config-action-handler.test.ts tests/integration/bot-config-export-route-handler.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-readiness-builder.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts tests/integration/legacy-live-worker-static.test.ts packages/bot-adapters/src/adapters.test.ts packages/bot-adapters/src/__tests__/legacy-blocked.test.ts` - PASS, 11 test files, 117 tests.

NOT RUN:
1. No live bot start/stop/apply-config/retest.
2. No worker restart, worker tick, provider DB query, live journal/API probe, exchange ping, order path, env/vault/secret inspection, SSH, tmux, systemd, or live server mutation.
3. No full `npm run lint`, full typecheck, full unit suite, Playwright/e2e, build, deployment, secret scan, migration, or real Postgres mutation.
4. No browser visual acceptance and no production canary log verification.

## Next actions
1. Main agent should centralize forbidden bot config/runtime keys and add parity tests for action form, admin form, user config parser, runtime sanitizer, and repository guard.
2. Main agent should add or keep a static guard that production user bot pages do not fall back to product-level adapter reads when DB-scoped snapshots are unavailable.
3. Main agent should document the admin split explicitly: fleet/user detail pages are read-only, while provider mapping and global default actions are WTC DB metadata/config mutations only.
4. Main agent should avoid enabling any Legacy HTTP adapter until the plaintext upstream endpoint risk is closed and separately audited.
5. Main agent should keep exchange key readiness metadata-only until an exchange adapter passes security plus bot-integration audit.
