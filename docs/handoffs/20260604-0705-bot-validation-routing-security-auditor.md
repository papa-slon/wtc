# bot-validation-routing-security-auditor handoff
## Scope
Phase 4.01 read-only security/data-boundary audit for adding validation issue routing from the top `BotSetupControlCenter`.

Inspected the current `BotSetupControlCenter`, user bot setup/settings pages, config error copy helpers, row/stage config tables, readiness DTO loaders, DB summary helpers, and focused bot config tests. The audit question was whether top-level validation issue routing can expose secrets/raw exchange material, mutate user settings, imply live exchange connectivity, or confuse user/admin boundaries.

No product code was edited. No live services, SSH, tmux, systemd, worker tick/restart, provider DB mutation, env/vault/secret file inspection, live exchange ping, live bot start/stop/apply/retest/control, or position action was run.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0653-phase-4-00-bot-setup-control-center.md`
8. `docs/handoffs/20260604-0644-bot-setup-control-center-security-auditor.md`
9. `docs/handoffs/20260604-0640-bot-setup-control-center-tests-auditor.md`
10. `docs/handoffs/20260604-0642-bot-setup-control-center-ux-auditor.md`
11. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
12. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
13. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
14. `apps/web/src/features/bots/config-error-copy.ts`
15. `apps/web/src/features/bots/config-action-handler.ts`
16. `apps/web/src/features/bots/config.ts`
17. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
18. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
19. `apps/web/src/features/bots/readiness-loader.ts`
20. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
21. `packages/db/src/repositories.ts`
22. `tests/integration/bot-read-safety-static.test.ts`
23. `tests/integration/bot-config-review-static.test.ts`
24. `tests/integration/bot-config-action-handler.test.ts`
25. `tests/integration/bot-runtime-config-sanitizer.test.ts`
26. `tests/e2e/bot-settings.spec.ts`

## Files changed
None — read-only audit

## Findings
1. Severity: High. Top-control validation routing is currently wired through sanitized config error copy on both user pages, which is the correct boundary as long as callers do not bypass it. Evidence: settings derives `configError = botConfigErrorCopy(meta.code, sp)` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:232` and passes `activeIssue={configError ?? undefined}` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:262`; setup does the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:231` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:282`; `botConfigErrorCopy` accepts only whitelisted issue codes and bounded row numbers at `apps/web/src/features/bots/config-error-copy.ts:20`, `apps/web/src/features/bots/config-error-copy.ts:71`, and `apps/web/src/features/bots/config-error-copy.ts:75`. Recommendation: keep `activeIssue` fed only from `botConfigErrorCopy`; never pass raw `formIssues`, Zod messages, provider payloads, symbols, URLs, or request values into the top control center. Target part: `BotSetupControlCenter` props and setup/settings page wiring.
2. Severity: High. The issue route itself is fragment-only and read-only, so it does not mutate user settings or create a new server action. Evidence: `issueAnchor` maps only `tortila-row`, `legacy-row`, and `legacy-stage` to numeric anchors at `apps/web/src/features/bots/BotSetupControlCenter.tsx:111`; `issueHref` falls back to local form anchors only at `apps/web/src/features/bots/BotSetupControlCenter.tsx:119`; the validation row is inserted as a table step at `apps/web/src/features/bots/BotSetupControlCenter.tsx:224`; rendered actions are `Link` elements or `Read-only`, not forms, at `apps/web/src/features/bots/BotSetupControlCenter.tsx:283`. Recommendation: keep this as navigation only; if a future top-center control adds a form or server action, extend `bot-config-action-handler` tests before merging. Target part: top control-center routing/action cell.
3. Severity: High. Forbidden credential/provider/raw/live-control fields are rejected before parsing or persistence, which prevents validation routing from becoming a covert save path. Evidence: forbidden FormData keys include `apiSecret`, `providerPubId`, `rawJson`, `applyConfig`, `startBot`, `stopBot`, `retest`, and `liveControl` at `apps/web/src/features/bots/config-action-handler.ts:51`; `handleSaveBotConfigAction` rejects forbidden keys before `formIssues`, parsing, or `persistConfig` at `apps/web/src/features/bots/config-action-handler.ts:165`; focused tests assert no parsing/persistence for forbidden keys at `tests/integration/bot-config-action-handler.test.ts:154` and generic no-row redirects for `apiSecret` at `tests/integration/bot-config-action-handler.test.ts:201`. Recommendation: keep forbidden-field failures global and unfocused; do not allow caller-supplied `row` or field names to focus credential/provider/live-control errors. Target part: config action helper and focused redirects.
4. Severity: High. The data feeding the control center is summary/count/state DTO data, not raw exchange material or raw provider runtime payloads. Evidence: exchange readiness uses `summarizeExchangeKeyMetadata` and returns only state/count at `apps/web/src/features/bots/readiness-loader.ts:53`; provider readiness returns only mapping state/count at `apps/web/src/features/bots/readiness-loader.ts:73`; denied access returns hidden/zeroed readiness at `apps/web/src/features/bots/readiness-loader.ts:126`; the DB exchange summary selects account ids and secret-row ids, never ciphertext payloads, at `packages/db/src/repositories.ts:415`; provider mapping summary returns counts/status only at `packages/db/src/repositories.ts:1849`. Recommendation: validation routing should continue to carry only safe issue code plus bounded row number; do not add raw config, `keyMask`, provider ids, sealed material, headers, URLs, or runtime JSON to top-center state. Target part: readiness DTO and DB summary boundary.
5. Severity: Medium. Live exchange connectivity is not implied by current routing or copy; the UI explicitly says metadata/live-ping-not-run. Evidence: exchange details say metadata-only vault readiness passed and live ping is not run at `apps/web/src/features/bots/BotSetupControlCenter.tsx:66`; setup review says `WTC vault metadata confirmed; live exchange ping not run` and `WTC metadata saved; live exchange ping not run` at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:575`; static tests forbid live-control/connection tokens in readiness/control-center sources at `tests/integration/bot-read-safety-static.test.ts:137`. Recommendation: keep validation issue labels like `Fix row`/`Fix stage`; do not introduce `Connection verified`, `test exchange`, or ping-success wording in this slice. Target part: validation row copy and exchange-key copy.
6. Severity: Medium. User/admin separation is explicit and should remain separate from issue routing. Evidence: the control center states users save their own WTC profile while admins publish defaults/map Legacy pub_id at `apps/web/src/features/bots/BotSetupControlCenter.tsx:207`; source detail says admins cannot edit user-owned Legacy/Tortila profiles at `apps/web/src/features/bots/config.ts:967`; tests assert the boundary and absence of raw provider id tokens at `tests/integration/bot-config-review-static.test.ts:112` and `tests/integration/bot-config-review-static.test.ts:117`. Recommendation: route validation issues only to the current user's editable form rows; do not link user-page validation actions to admin provider mapping, admin defaults, or selected-user drilldowns. Target part: user/admin boundary row and issue actions.
7. Severity: Medium. Focused static security/config tests are green, but rendered browser proof was not run in this read-only lane. Evidence: `tests/e2e/bot-settings.spec.ts:86` through `tests/e2e/bot-settings.spec.ts:142` covers Tortila row, Legacy row, and Legacy stage validation routing plus no unsafe live-control/connection text; this audit did not start the Playwright server or write screenshots. Recommendation: implementation acceptance should run focused desktop/mobile `tests/e2e/bot-settings.spec.ts` after the owning implementer deliberately starts the e2e server. Target part: rendered validation-routing acceptance.

## Decisions
1. Treat the current routing as acceptable only because it is sanitized-code-plus-row-fragment navigation.
2. Do not recommend new loaders, DB reads, route handlers, server actions, adapter calls, exchange pings, or live-control paths for this slice.
3. Keep forbidden-field failures generic with no row focus.
4. Keep validation routing scoped to current user setup/settings forms, not admin/provider mapping workflows.
5. Record that target files changed during the audit window; line evidence reflects the current filesystem after the later active-issue wiring was present.

## Risks
1. The worktree was already heavily dirty/untracked before this audit, including bot setup/settings files, tests, and many handoffs.
2. `BotSetupControlCenter` trusts the `activeIssue` object it receives; future callers could weaken the boundary if they bypass `botConfigErrorCopy`.
3. Static tests do not prove rendered focus/scroll behavior; Playwright should remain the focused rendered gate for this feature.
4. This audit does not prove production deploy state, provider reachability, live exchange connectivity, or any live bot control adapter.

## Verification/tests
RUN:
1. Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, Phase 4.00 aggregate, and Phase 4.00 per-agent handoffs.
2. Inspected the scoped control-center, setup/settings pages, config error copy, config action helper, config issue producer, row/stage table anchors, readiness DTOs, DB summary helpers, runtime sanitizer, and focused tests with read-only commands.
3. `npm exec vitest -- run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-config-action-handler.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts` - PASS, 4 files, 43 tests.

NOT RUN:
1. Playwright/e2e - not run because it starts a local web server and writes screenshot artifacts.
2. Full `npm test`, full lint, typecheck, build, secret scan, coverage, governance - not run; this was a focused read-only security/data-boundary audit.
3. Live services, SSH, tmux, systemd, env/vault/secret inspection, provider DB mutation, worker tick/restart, live exchange ping, live bot start/stop/apply/retest/control, or position actions - not run by scope and safety policy.
4. Git staging, commit, push, or PR - not requested.

## Next actions
1. Keep the top control-center issue row fed only by `botConfigErrorCopy(meta.code, sp)`.
2. Add a small focused unit/static assertion if future work introduces any new `activeIssue` caller, proving the caller cannot pass raw validation strings or caller-supplied field names.
3. Run focused desktop/mobile `tests/e2e/bot-settings.spec.ts` in the owning implementation lane before claiming rendered validation routing accepted.
4. Keep live exchange ping, Legacy/Tortila apply, start/stop, retest, close-position, and admin provider-mapping work out of this routing slice until separate bot-integration and security audits approve them.
