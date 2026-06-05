# phase-3-90-bot-config-runtime-export-acceptance handoff
## Scope
Phase 3.90 runtime acceptance slice for Legacy/Tortila bot config export and web runtime config response safety. The phase launched read-only agents before edits, then extracted the config-export route into a dependency-injected handler, added runtime `Request` tests for export statuses/headers/body leakage, and added a web-boundary sanitizer for runtime `liveConfig` snapshots before they can become `BotConfigView.raw`.

Per-agent handoffs:
1. `docs/handoffs/20260604-0236-bot-config-export-route-auditor.md`
2. `docs/handoffs/20260604-0236-bot-config-actions-runtime-auditor.md`
3. `docs/handoffs/20260604-0236-bot-config-runtime-security-auditor.md`

No live bot start/stop/apply-config/retest, worker tick/restart, provider DB access, exchange ping, `.env`, vault secret inspection, SSH, tmux, systemd, or live server mutation was performed.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0235-phase-3-89-bot-config-source-audit-hardening.md`
8. `docs/handoffs/20260604-0236-bot-config-export-route-auditor.md`
9. `docs/handoffs/20260604-0236-bot-config-actions-runtime-auditor.md`
10. `docs/handoffs/20260604-0236-bot-config-runtime-security-auditor.md`
11. `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
12. `apps/web/src/features/bots/config.ts`
13. `apps/web/src/features/bots/config-export.ts`
14. `apps/web/src/features/bots/config-export-handler.ts`
15. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
16. `apps/web/src/features/bots/data.tsx`
17. `tests/integration/bot-config-export-route-handler.test.ts`
18. `tests/integration/bot-runtime-config-sanitizer.test.ts`
19. `tests/integration/bot-config-export-static.test.ts`
20. `tests/integration/user-resolved-bot-config-static.test.ts`
21. `tests/integration/bot-read-safety-static.test.ts`
22. `tests/integration/bot-config-source-audit-static.test.ts`
23. `tests/integration/db-0002.test.ts`
24. `tests/integration/admin-global-bot-config-db.test.ts`
25. `tests/integration/user-resolved-bot-config-db.test.ts`

## Files changed
1. `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
2. `apps/web/src/features/bots/config.ts`
3. `apps/web/src/features/bots/config-export.ts`
4. `apps/web/src/features/bots/config-export-handler.ts`
5. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
6. `apps/web/src/features/bots/data.tsx`
7. `tests/integration/bot-config-export-route-handler.test.ts`
8. `tests/integration/bot-runtime-config-sanitizer.test.ts`
9. `tests/integration/bot-config-export-static.test.ts`
10. `tests/integration/user-resolved-bot-config-static.test.ts`
11. `tests/integration/bot-read-safety-static.test.ts`
12. `docs/handoffs/20260604-0254-phase-3-90-bot-config-runtime-export-acceptance.md`

## Findings
1. Severity: High. Fixed config export route runtime acceptance gap. Evidence: route wrapper now delegates to `handleBotConfigExportRequest` at `apps/web/src/app/api/bots/[bot]/config-export/route.ts:9`; the extracted handler returns no-store JSON 401/403 failures, preserves the Legacy provider-mapping gate, and returns attachment responses with `no-store`, `nosniff`, and `no-referrer` at `apps/web/src/features/bots/config-export-handler.ts:40`. Runtime tests cover unauthenticated, unauthorized, provider-mapping-required, Tortila 200, and Legacy 200 paths at `tests/integration/bot-config-export-route-handler.test.ts:127`. Recommendation: keep page route as a thin dependency wrapper and extend handler tests if new export states are added. Target part: config export route acceptance.
2. Severity: High. Fixed web-boundary leakage risk from DB snapshot `rawJson.liveConfig`. Evidence: `data.tsx` now calls `buildSafeRuntimeConfigView` at `apps/web/src/features/bots/data.tsx:633` instead of returning `raw: liveConfig`; the sanitizer recursively removes secret/provider/raw-runtime/URL/header/live-control keys at `apps/web/src/features/bots/runtime-config-sanitizer.ts:3`; runtime sanitizer test verifies hostile nested fields are stripped at `tests/integration/bot-runtime-config-sanitizer.test.ts:30`. Recommendation: treat `BotConfigView.raw` as web-safe DTO output, never as a DB raw passthrough. Target part: bot runtime read-model response boundary.
3. Severity: Medium. Preserved source-truth intent for export. Evidence: handler still exports `state.current` through `(opts.exportConfig ?? exportBotConfig)(meta.code, state.current)` at `apps/web/src/features/bots/config-export-handler.ts:65`, not runtime `legacyRead.config.data.raw`; static tests lock this at `tests/integration/user-resolved-bot-config-static.test.ts:72`. Recommendation: do not use Legacy runtime read-model config as export fallback. Target part: user resolved config source.
4. Severity: Medium. Action/runtime save tests remain open. Evidence: read-only action auditor found locked-default and forbidden-field lower guards but no dependency-injected action helper tests; this phase did not extract `config-action-handlers.ts`. Recommendation: next phase should implement action-helper runtime acceptance for locked defaults, malicious extra FormData keys, invalid override fallback/sourceIssue, and no live apply/start/stop. Target part: settings/setup save actions.
5. Severity: Medium. This phase closes export/runtime-config acceptance only, not the full bot-site goal. Evidence: no full Playwright, full build, live worker, live bot, provider DB, or exchange gate was run in this phase. Recommendation: keep the broader goal active and continue by separate protocol phases. Target part: overall Legacy/Tortila completion.

## Decisions
1. Followed existing billing/LMS/Axioma pattern: extracted a feature-level dependency-injected handler and left the Next route as a thin wrapper.
2. Moved safe export formatting into `apps/web/src/features/bots/config-export.ts`, which is pure enough for root Vitest runtime tests, while `config.ts` re-exports it for existing call sites.
3. Added `x-content-type-options: nosniff` and `referrer-policy: no-referrer` to export success and failure responses.
4. Treated runtime `liveConfig` as untrusted at the web boundary, even if current worker writers are whitelisted.
5. Kept settings/setup action helper extraction out of this phase to avoid mixing the route/export acceptance slice with a new server-action architecture slice.

## Risks
1. Settings/setup server-action runtime behavior is still not directly helper-tested.
2. The sanitizer test proves hostile object sanitization at the pure helper boundary, not a full PGlite read through `loadBotReadModelForUser` in production DB snapshot mode.
3. Full browser/RSC response payload checks were not run in this phase.
4. The worktree remains heavily dirty from the broader multi-phase rollout; this phase did not revert unrelated prior changes.

## Verification/tests
RUN:
1. Required protocol/docs read and per-agent handoffs collected.
2. Background read-only agents dispatched before edits and cited above.
3. `npx vitest run tests/integration/bot-config-export-route-handler.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/user-resolved-bot-config-static.test.ts tests/integration/bot-read-safety-static.test.ts` - 5 files, 38 tests passed.
4. `npx vitest run tests/integration/bot-config-source-audit-static.test.ts tests/integration/db-0002.test.ts tests/integration/admin-global-bot-config-db.test.ts tests/integration/user-resolved-bot-config-db.test.ts` - 4 files, 32 tests passed.
5. `npm run typecheck -w @wtc/web` - passed.
6. `npm run typecheck` - passed.
7. `npm run secret:scan` - passed.
8. `git diff --check -- <phase files>` - passed.
9. `npm run governance:check` - passed with 0 errors and 1 known historical warning for `20260529-1921-integration-risk-auditor.md`.

OBSERVED NON-GREEN BUT RESOLVED:
1. Initial focused static run failed because old source-string assertions still looked inside the thin route wrapper after handler extraction. Tests were updated to assert the route wrapper plus extracted handler boundaries, and rerun passed.

NOT RUN:
1. Live bot start/stop/apply-config/retest, worker tick/restart/smoke, provider DB reads/writes, exchange ping, `.env`, vault/secret inspection, SSH, tmux, systemd - forbidden by scope and non-negotiable gates.
2. Full `npm test`, full build, full lint, full Playwright/e2e, preview/browser screenshots - skipped to keep this runtime export/security slice focused.
3. Settings/setup action-helper runtime tests - not implemented in this phase; tracked as the next acceptance gap.
4. PGlite production-mode `loadBotReadModelForUser` hostile `rawJson.liveConfig` fixture - not run; pure sanitizer coverage landed instead.

## Next actions
1. Extract settings/setup save, preset apply, and use-system-default logic into dependency-injected helpers and add PGlite runtime tests for locked-default rejection, forbidden extra FormData behavior, invalid override fallback/sourceIssue, and no live apply/start/stop.
2. Add a PGlite DB snapshot test that injects hostile `bot_metric_snapshots.raw_json.liveConfig` and proves `loadBotReadModelForUser(..., ['config'])` returns sanitized `BotConfigView.raw`.
3. Add a later browser/RSC response pass for bot settings/setup/export links after the action-helper tests land.
