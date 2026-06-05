# bot-settings-platform-security-auditor handoff
## Scope
Phase 3.88 read-only platform/security/source audit for WTC bot configuration source-of-truth and safety boundaries. Scope covered Legacy and Tortila settings resolution across built-in defaults, admin system defaults, user overrides, config export, exchange-key metadata readiness wording, RBAC/entitlements/audit, secret/raw-provider leakage, and live-control semantics. This audit did not edit or revert product files and did not run live bots, worker ticks, provider DB access, `.env`, SSH, tmux, systemd, start/stop/apply/retest, or live exchange/provider calls.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0144-phase-3-87-user-warning-state-visual-scope.md`
8. `docs/AUDIT_LOG_SCHEMA.md`
9. `apps/web/src/features/bots/config.ts`
10. `apps/web/src/features/bots/config-types.ts`
11. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
12. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
13. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
14. `apps/web/src/app/admin/bots/config/page.tsx`
15. `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
16. `apps/web/src/features/admin/actions.ts`
17. `apps/web/src/features/admin/schemas.ts`
18. `apps/web/src/features/admin/types.ts`
19. `apps/web/src/lib/backend.ts`
20. `apps/web/src/lib/db-store.ts`
21. `apps/web/src/lib/demo.ts`
22. `packages/db/src/repositories.ts`
23. `packages/db/src/schema.ts`
24. `packages/shared/src/schemas.ts`
25. `packages/audit/src/audit.ts`
26. `tests/integration/bot-config-export-static.test.ts`
27. `tests/integration/admin-global-bot-config-static.test.ts`
28. `tests/integration/admin-global-bot-config-db.test.ts`
29. `tests/integration/user-resolved-bot-config-static.test.ts`
30. `tests/integration/user-resolved-bot-config-db.test.ts`
31. `tests/integration/admin-user-bot-detail-static.test.ts`
32. `tests/integration/admin-user-bot-detail-loader.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Audit documentation still describes `exchange_key.test` as a real exchange connection test where the key is used transiently, but the implemented flow is now metadata-only and explicitly records `livePing: false`. Evidence: `docs/AUDIT_LOG_SCHEMA.md:177` says "Exchange connection test performed"; `packages/shared/src/schemas.ts:36` says the metadata check does not authorize live pings; `packages/db/src/repositories.ts:473` to `packages/db/src/repositories.ts:481` builds a `sealed_metadata_only` result with `livePing: false`; UI copy says no live ping at `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:72` to `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:73` and `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:147` to `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:148`. Recommendation: update the audit schema wording, and preferably rename or alias the action to `exchange_key.metadata_check` before anyone uses audit rows to claim exchange reachability. Target part: exchange-key metadata test wording and audit taxonomy.
2. Severity: Medium. User override audit payloads do not match the documented `bot.config.save` shape: the docs say audit rows include both prior and new version metadata, while the repository writes only `after: { version }`. Evidence: `docs/AUDIT_LOG_SCHEMA.md:324` documents `before = { version }, after = { version }`; `packages/db/src/repositories.ts:2124` reads the current config row, but `packages/db/src/repositories.ts:2132` writes only the new version in `after`. Recommendation: include a metadata-only `before` payload such as `{ version: cur?.version ?? null }`, preserving the no-raw-config rule. Target part: user override audit trail.
3. Severity: Medium. `saveBotConfig` is exported as a generic `Record<string, unknown>` writer and persists the input config directly; current settings/setup server actions rebuild config from allow-listed form fields and validate it, but the repository itself does not enforce product schema or the forbidden secret/provider/live-control key guard that admin global defaults use. Evidence: `apps/web/src/features/bots/config.ts:364` to `apps/web/src/features/bots/config.ts:383` rebuilds user config from known form names; `apps/web/src/features/admin/actions.ts:431` to `apps/web/src/features/admin/actions.ts:522` adds explicit forbidden-key screening for global defaults; `packages/db/src/repositories.ts:2122` accepts generic config and `packages/db/src/repositories.ts:2127` to `packages/db/src/repositories.ts:2131` writes it into current/history rows. Recommendation: add a shared product-aware safe-save wrapper or repository-level validator for user configs so future callers cannot persist provider ids, raw runtime snapshots, secrets, URLs, or live-control flags by bypassing the current form actions. Target part: user override source-of-truth boundary.
4. Severity: Medium. The user config resolver validates published system defaults before using them, but active user override rows are treated as current without re-validating or classifying stale/invalid config. Evidence: `apps/web/src/features/bots/config.ts:799` to `apps/web/src/features/bots/config.ts:802` validates system default config with `botConfigSchemaFor`; `apps/web/src/features/bots/config.ts:915` to `apps/web/src/features/bots/config.ts:926` returns `cfg.config` directly as `user_override`. Recommendation: parse user override rows through `botConfigSchemaFor(productCode)` on load; if invalid, show a non-green source issue and fall back to system/built-in defaults without exporting the invalid row. Target part: resolved user config source model.
5. Severity: Medium. The guardrail coverage for this slice is strong as static/source tests and PGlite repository tests, but the config export route and Next server actions are not exercised as runtime routes/actions in the inspected tests. Evidence: `tests/integration/bot-config-export-static.test.ts:15` to `tests/integration/bot-config-export-static.test.ts:31` uses string matching for the export route; `tests/integration/admin-global-bot-config-static.test.ts:42` to `tests/integration/admin-global-bot-config-static.test.ts:72` uses string matching for the admin action pipeline; DB behavior is covered separately at `tests/integration/admin-global-bot-config-db.test.ts:91` to `tests/integration/admin-global-bot-config-db.test.ts:188`. Recommendation: add focused runtime tests for config-export 403/200 behavior, metadata-check cross-user denial/no live ping, locked-default save rejection, and forbidden-field rejection through the actual action/route boundary. Target part: bot settings acceptance tests.

## Decisions
1. Current product code keeps the intended source layering: built-in fallback, admin-published system default, user override, and read-only runtime snapshot are separate concepts.
2. Admin global defaults are WTC reference profiles only; they do not create bot instances, mutate user overrides, touch provider mappings, or apply config to a running bot.
3. Config export currently exports the resolved WTC config source only. Legacy export removes `providerPubId` and returns no exchange keys, live-apply token, raw provider payload, or runtime snapshot.
4. Tortila exchange-key readiness is a WTC vault metadata check. It is not an exchange connectivity test and not a bot control operation.
5. Legacy provider `pub_id` mapping is ownership metadata for read-only snapshot scoping; it is not a setting source and not live bot control.

## Risks
1. The existing worktree is heavily dirty and includes many modified/untracked files from other phases; this audit did not attempt to distinguish ownership beyond the inspected paths.
2. Findings are source-review findings only. No tests, route invocations, browser checks, DB harnesses, secret scans, or governance gates were run in this read-only auditor turn.
3. The exchange metadata audit action name `exchange_key.test` can keep causing ambiguous reporting even if UI copy is correct.
4. Repository-level bot config writers remain easy for future callers to misuse unless validation/forbidden-key checks are centralized below the page/action layer.

## Verification/tests
RUN:
1. Required protocol and status docs were read: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260604-0144-phase-3-87-user-warning-state-visual-scope.md`.
2. Read-only source inspection of the bot config feature, settings/setup pages, admin defaults page/actions/schemas/types, config export route, DB schema/repositories, audit docs/actions, shared schemas, backend/demo/db-store wrappers, and relevant static/PGlite tests.
3. `git status --short` was read to confirm the worktree is already dirty before this handoff.

NOT RUN:
1. Live bots, worker ticks/smokes/restarts, provider DB, `.env`, vault inspection, SSH, tmux, systemd, start/stop/apply/retest, exchange ping, or provider network calls - forbidden by scope.
2. `npm test`, focused Vitest, Playwright, typecheck, lint, build, secret scan, governance check, DB migration/seed, and route/action execution - not run because this was a read-only source auditor turn in an already dirty multi-phase worktree.

## Next actions
1. Correct `docs/AUDIT_LOG_SCHEMA.md` and any action naming/copy around `exchange_key.test` so readiness evidence cannot be mistaken for a live exchange connection test.
2. Add metadata-only `before.version` to `bot.config.save` audit rows and cover it with a focused repository test.
3. Centralize user bot config validation/forbidden-key screening below the current form actions, then re-run the bot config export/source tests.
4. Add runtime route/action tests for config export, exchange-key metadata check, locked system defaults, and admin forbidden-field rejection.
