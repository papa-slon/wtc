# phase-3-89-bot-config-source-audit-hardening handoff
## Scope
Phase 3.89 backend/security source hardening for Legacy and Tortila bot settings after the Phase 3.88 effective-config review. The phase launched three read-only agents before edits, then hardened user/global bot config source boundaries, audit taxonomy, and focused regression coverage.

Per-agent handoffs:
1. `docs/handoffs/20260604-0220-bot-config-source-backend-auditor.md`
2. `docs/handoffs/20260604-0220-bot-config-security-audit-auditor.md`
3. `docs/handoffs/20260604-0220-bot-config-tests-auditor.md`

No live bot start/stop/apply-config/retest, worker tick/restart, provider DB access, exchange ping, `.env`, vault secret inspection, SSH, tmux, systemd, or live server mutation was performed.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0214-phase-3-88-bot-settings-effective-review.md`
8. `docs/handoffs/20260604-0220-bot-config-source-backend-auditor.md`
9. `docs/handoffs/20260604-0220-bot-config-security-audit-auditor.md`
10. `docs/handoffs/20260604-0220-bot-config-tests-auditor.md`
11. `docs/AUDIT_LOG_SCHEMA.md`
12. `packages/audit/src/audit.ts`
13. `packages/db/src/repositories.ts`
14. `apps/web/src/lib/demo.ts`
15. `apps/web/src/features/bots/config.ts`
16. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
17. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
18. `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
19. `tests/integration/admin-global-bot-config-db.test.ts`
20. `tests/integration/admin-global-bot-config-static.test.ts`
21. `tests/integration/bot-config-source-audit-static.test.ts`
22. `tests/integration/bot-read-safety-static.test.ts`
23. `tests/integration/db-0002.test.ts`
24. `tests/integration/db-persistence.test.ts`
25. `tests/integration/user-resolved-bot-config-static.test.ts`

## Files changed
1. `packages/audit/src/audit.ts`
2. `packages/db/src/repositories.ts`
3. `apps/web/src/lib/demo.ts`
4. `apps/web/src/features/bots/config.ts`
5. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
6. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
7. `docs/AUDIT_LOG_SCHEMA.md`
8. `tests/integration/admin-global-bot-config-db.test.ts`
9. `tests/integration/bot-config-source-audit-static.test.ts`
10. `tests/integration/bot-read-safety-static.test.ts`
11. `tests/integration/db-0002.test.ts`
12. `tests/integration/db-persistence.test.ts`
13. `tests/integration/user-resolved-bot-config-static.test.ts`
14. `docs/handoffs/20260604-0235-phase-3-89-bot-config-source-audit-hardening.md`

## Findings
1. Severity: High. Fixed user bot config source hardening below the page layer. Evidence: user save now validates product-aware config and forbidden keys before DB persistence at `apps/web/src/features/bots/config.ts:967`; active saved overrides are re-parsed on load and invalid rows expose `sourceIssue` instead of becoming the effective config at `apps/web/src/features/bots/config.ts:1027`; settings/setup render the non-green issue at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:286` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:290`. Recommendation: add runtime server-action tests in a later focused phase. Target part: user override source-of-truth boundary.
2. Severity: High. Fixed repository-level forbidden-key rejection for both user and admin global bot config saves. Evidence: `saveBotGlobalConfig` and `saveBotConfig` both call `assertNoForbiddenBotConfigKeys(input.config)` at `packages/db/src/repositories.ts:2087` and `packages/db/src/repositories.ts:2176`; the PGlite regression rejects direct global config calls with secret/provider/raw/live-control keys without writing current, history, or audit rows at `tests/integration/admin-global-bot-config-db.test.ts:181`. Recommendation: keep package-boundary guards as the last line of defense for future callers. Target part: `@wtc/db` bot config repositories.
3. Severity: Medium. Fixed audit taxonomy drift for exchange-key metadata checks and user config saves. Evidence: metadata readiness now writes `exchange_key.metadata_check` at `packages/db/src/repositories.ts:487`, demo parity uses the same action, and docs define it as metadata-only at `docs/AUDIT_LOG_SCHEMA.md:177`; `bot.config.save` audit rows target `bot_instance` with metadata-only `before.version` and `after.version` at `packages/db/src/repositories.ts:2186`, and docs/sample now match that identity at `docs/AUDIT_LOG_SCHEMA.md:423`. Recommendation: keep `exchange_key.test` reserved until a separately audited read-only exchange ping adapter exists. Target part: audit event taxonomy.
4. Severity: Medium. Focused DB/static acceptance is now stronger, but config export route/action behavior is still not runtime-tested. Evidence: static guards cover export safety and source strings, while no route-handler harness was added in this phase. Recommendation: add runtime tests for unauthenticated/unauthorized/provider-mapping-required/200 export states, headers, filenames, and negative payload assertions. Target part: config export acceptance.
5. Severity: Medium. This phase closes backend/security source hardening, not the full Legacy/Tortila bot-site goal. Evidence: no live bot, worker, provider DB, exchange, full Playwright, or full build gates were run in this phase. Recommendation: continue with a new phase for runtime export/action tests or the next UX/analytics completion slice. Target part: overall bot ecosystem completion.

## Decisions
1. Canonical `bot.config.save` audit target remains `bot_instance`; immutable config version is recorded only in `before.version` and `after.version`.
2. `exchange_key.metadata_check` is the only action emitted by WTC vault metadata readiness checks; `exchange_key.test` remains reserved for a future audited exchange ping path.
3. Invalid saved user overrides are treated as a non-green source issue and fall back to a valid system or built-in config, instead of poisoning the resolved user config or export.
4. Admin global defaults and user personal overrides share the same repository forbidden-key guard because both are WTC reference config, not live runtime control payloads.

## Risks
1. Runtime Next route/action behavior for config export and save redirects is still mostly unproved by handler tests.
2. Full-suite, full build, and Playwright were intentionally not repeated in this backend/security slice.
3. The worktree remains heavily dirty from the broader multi-phase bot-settings rollout; this phase did not revert or normalize unrelated prior changes.
4. Historical handoffs still mention older `exchange_key.test` wording as past findings; current source, docs, and focused tests use `exchange_key.metadata_check`.

## Verification/tests
RUN:
1. Required protocol/docs read and per-agent handoffs collected.
2. Background read-only agents dispatched before edits and cited above.
3. `npx vitest run tests/integration/admin-global-bot-config-db.test.ts` - 1 file, 5 tests passed.
4. `npx vitest run tests/integration/bot-config-source-audit-static.test.ts tests/integration/admin-global-bot-config-static.test.ts` - 2 files, 8 tests passed.
5. `npx vitest run tests/integration/user-resolved-bot-config-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/db-0002.test.ts tests/integration/db-persistence.test.ts` - 4 files, 68 tests passed.
6. `npm run typecheck -w @wtc/web` - passed.
7. `npm run typecheck` - passed.
8. `npm run secret:scan` - passed.
9. `git diff --check -- <phase files>` - passed.
10. `npm run governance:check` - passed with 0 errors and 1 known historical warning for `20260529-1921-integration-risk-auditor.md`.

OBSERVED NON-GREEN BUT RESOLVED:
1. A combined Vitest run over the same focused suite ended with Windows `EBUSY` on a Vitest temp SSR file after six files had already passed. The same files were rerun in smaller processes and passed as listed above.
2. `npm run typecheck -w @wtc/db` was attempted earlier and failed because `@wtc/db` has no workspace typecheck script; root `npm run typecheck` covers DB TypeScript and passed.
3. A first `git diff --check` attempt used unquoted PowerShell paths containing `(app)` and failed before checking; the quoted retry passed.

NOT RUN:
1. Live bot start/stop/apply-config/retest, worker tick/restart/smoke, provider DB reads/writes, exchange ping, `.env`, vault/secret inspection, SSH, tmux, systemd - forbidden by scope and non-negotiable gates.
2. Full `npm test`, full build, full lint, and full Playwright/e2e - skipped to keep this backend/security hardening slice focused.
3. Runtime config-export route/action tests - not implemented in this phase; tracked as the main next acceptance gap.

## Next actions
1. Add runtime config-export route-handler tests for denial states, headers, filenames, provider mapping requirement, and no secret/provider/live-control payload leakage.
2. Add focused server-action tests for locked-default save rejection, forbidden-field redirect/error behavior, and invalid user override fallback in the actual action layer.
3. Continue the broader bot-site completion plan with the next phase only after dispatching fresh read-only agents, per `docs/SESSION_PROTOCOL.md`.
