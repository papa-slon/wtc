# admin-launch-readiness-gates-auditor handoff
## Scope
Phase 4.25 read-only gates/tests audit for adding an admin selected-user launch-readiness mirror to `apps/web/src/app/admin/users/[userId]/bots/page.tsx`.

Scope was limited to current static tests, DB-backed selected-user browser harness, smoke/mobile Playwright coverage, Playwright configs, runner scripts, and process governance. No code, app docs, tests, live/provider/worker/deploy commands, or DB harnesses were run or edited. This is the single requested auditor handoff, not an N-agent aggregate claim.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260604-1646-bot-next-completion-ux-auditor.md`
- `docs/handoffs/20260604-1648-bot-next-completion-gates-auditor.md`
- `docs/handoffs/20260604-1705-phase-4-24-bot-launch-readiness-command-center.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `package.json`
- `scripts/gates.mjs`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `playwright.config.ts`
- `playwright.admin-user-bots-db.config.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/bot-readiness-map.spec.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/features/bots/readiness-loader.ts`

## Files changed
- `docs/handoffs/20260604-1714-admin-launch-readiness-gates-auditor.md` - this handoff only.

## Findings
1. Severity P1. The admin selected-user mirror is the explicit next gap after Phase 4.24; the user bot dashboard has the launch-readiness panel, but the selected-user admin drilldown still shows separate command/evidence tables only. Evidence: Phase 4.24 says the user dashboard panel is read-only at `docs/handoffs/20260604-1705-phase-4-24-bot-launch-readiness-command-center.md:43`, says rendered proof covers user dashboards at `:46`, and explicitly says the admin selected-user panel was not mounted at `:53` with next action at `:88`. Current admin detail renders the selected-user command center and evidence ladder at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:327` and `:421`, but has no `BotLaunchReadinessPanel` import near `:1`-`:9`. Recommendation: add a per-bot admin mirror fed only from selected-user safe DTO fields already on `AdminUserBotSummary`; do not add adapter calls, provider probes, exchange pings, worker ticks, or mutation actions. Target part: admin selected-user launch-readiness UI.

2. Severity P1. The reusable launch panel has defaults that are user-page oriented, so admin mounting must override or suppress unsafe/misleading fallbacks. Evidence: `BotLaunchReadinessPanel` defaults `settingsHref` to `/app/bots/${bot}/settings` and statistics to `/app/bots/statistics?bot=${bot}` at `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx:68`-`:69`, then renders those links at `:129`-`:136`. The selected-user admin page declares user settings and provider mappings read-only at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:291`-`:293`, and existing static tests forbid selected-user edit/control imports and submit controls at `tests/integration/admin-user-bot-detail-static.test.ts:128`-`:139`. Recommendation: if reusing the panel, pass admin-safe same-page anchors/labels and `statisticsHref={null}` or add an explicit nullable link prop; assert the admin page does not render `/app/bots/.../settings` as a selected-user "next action." Target part: admin-safe link/copy boundary.

3. Severity P1. Existing static tests already protect selected-user read-only scoping, but they do not yet prove a launch-readiness mirror exists or that its admin copy is safe. Evidence: `admin-user-bot-detail-static.test.ts` checks RBAC/read-only/live-control boundaries at `:70`-`:139` and safe overview DTO rendering at `:190`-`:228`; `bot-read-safety-static.test.ts` checks the user launch panel contract at `:92`-`:137` and bans adapter/secret/live-control terms in readiness surfaces at `:263`-`:266`. Recommendation: add focused assertions to `admin-user-bot-detail-static.test.ts` for `BotLaunchReadinessPanel` or an admin wrapper, admin title/copy, `live start disabled`, `no exchange ping` or equivalent non-live label, admin-safe links, no `CsrfField`, no `type="submit"`, no `saveBotConfigAction`, no provider mapping actions, and no `getBotAdapter|fetch(|vault.open|startBot|stopBot|applyConfig|apiKey|apiSecret|sealed|Connection verified`. Target part: static safety gates.

4. Severity P1. The DB-backed selected-user browser harness is the right acceptance lane for real populated admin scoping, but its current assertions must be deliberately updated for the mirror. Evidence: the spec is opt-in at `tests/e2e/admin-user-bot-detail-db.spec.ts:5`, covers runtime scenarios at `:14`-`:74`, checks selected-user facts at `:177`-`:230`, bans hidden secret/user/provider markers at `:113`-`:163`, and currently asserts no `start|stop|apply|test connection` button at `:226`-`:228`. Recommendation: add visible markers for the admin launch-readiness mirror, assert two per-bot mirrors across Tortila and Legacy, assert disabled/admin-scoped control text if a disabled button is retained, and keep the negative button gate either as "no start/stop/apply/test connection buttons" or as an exact exemption for one disabled review-only control. Prefer admin label such as `Admin launch unavailable` over default `Start bot unavailable` to preserve the existing no-start button ban. Target part: DB-backed selected-user browser acceptance.

5. Severity P2. Demo smoke/mobile coverage is necessary for layout regression, but it is not sufficient for selected-user ownership or provider leak proof. Evidence: `admin-mobile-pg8.spec.ts` includes `/admin/users/demo-user/bots` in the mobile route matrix at `tests/e2e/admin-mobile-pg8.spec.ts:23` and checks no horizontal scroll/screenshot at `:59`-`:65`; `smoke.spec.ts` checks `/admin/users` at `tests/e2e/smoke.spec.ts:183`-`:195`, while the DB spec is excluded from default Playwright at `playwright.config.ts:9`. Recommendation: use admin-mobile and smoke as layout/navigation gates after the UI change, but require the opt-in DB browser harness for selected-user populated-row proof when disposable Postgres is authorized. Target part: browser gate selection.

6. Severity P2. The safe repo gate set is clear, but no gate is green for this Phase 4.25 audit because this task was inspection-only. Evidence: root scripts expose `test`, `lint`, `typecheck`, `secret:scan`, `e2e`, and admin DB e2e scripts at `package.json:13`-`:36`; `scripts/gates.mjs` defines `quick`, `core`, `full`, and standalone `e2e` modes at `scripts/gates.mjs:13`-`:18` and `:48`-`:53`. Recommendation: after implementation, run the focused static/browser gates below first, then a repo sweep (`node scripts/gates.mjs quick`, plus `governance:check` and `secret:scan` if files/handoffs/strings changed). Target part: repo acceptance.

## Decisions
- Treat the admin mirror as a narrow follow-up to Phase 4.24, not as live-control, provider-integration, worker-continuity, or deploy work.
- Prefer safe DTO reuse or a pure admin readiness builder over calling user read models or adapters from the selected-user admin page.
- Preserve the existing selected-user admin contract: inspect only; no user setting edits, provider mapping edits, exchange-key mutation, live config apply, position action, or bot state mutation.
- Do not rely on default Playwright to cover the DB-backed admin selected-user spec; it is intentionally ignored by `playwright.config.ts`.
- No background agents were spawned from this read-only auditor session; there are no background agents to close.

## Risks
- If the shared panel is mounted with default links, admins may be sent to user app settings/statistics surfaces that are not the selected user's read-only mirror.
- If the default `Start bot unavailable` disabled button is mounted unchanged, current DB e2e hidden-marker/button assertions will fail or need a precise disabled-control exemption.
- If readiness rows are recomputed from adapter/provider/runtime internals, the selected-user page can drift from the safe admin DTO and reintroduce leak/live-control risk.
- If only demo smoke/mobile gates pass, the implementation can still leak another user's provider/account/secret/runtime rows in the real DB scenario.
- The worktree was already heavily dirty before this audit. This handoff does not certify unrelated dirty files.

## Verification/tests
RUN in this audit:
- `Get-Location` - confirmed `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.
- `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603...origin/codex/bot-analytics-settings-canary-20260603` with a large pre-existing dirty tree.
- `rg --files ...` - located the requested test, config, runner, governance, and app files.
- Targeted `rg -n` searches over the inspected files for `launch`, `readiness`, `selected-user`, `live`, `provider`, `secret`, `worker`, `deploy`, `testMatch`, `testIgnore`, and gate scripts.
- Line-numbered `Get-Content` reads for the inspected static tests, e2e specs, Playwright configs, runners, admin page, launch panel, and relevant prior handoffs.
- `Get-Date -Format 'yyyyMMdd-HHmm'` - produced handoff timestamp `20260604-1714`.
- `Test-Path -LiteralPath 'docs/handoffs/20260604-1714-admin-launch-readiness-gates-auditor.md'` - confirmed the handoff path was unused before writing.

Recommended focused static gates after implementation:
- `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- If `BotLaunchReadinessPanel` itself changes: add `tests/integration/bot-readiness-server-dto-static.test.ts` to the same Vitest command.
- Required static acceptance: admin page mounts the mirror per bot, copy states admin diagnostic/read-only scope, links stay admin-safe, no submit/action/CSRF/live-control imports are introduced, no secret/provider raw terms appear, and the DB e2e harness source expects the new browser assertions.

Recommended focused browser gates after implementation:
- `E2E_PORT=<free-port> npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile`
- `E2E_PORT=<free-port> npx playwright test tests/e2e/smoke.spec.ts -g "admin users"`
- With explicit disposable Postgres authorization only: `npm run e2e:admin-user-bots:db:managed:matrix`
- If no admin DB URL is available, record `npm run e2e:admin-user-bots:db:managed:matrix` as NOT RUN/NOT GREEN; do not substitute demo smoke as selected-user data proof.

Recommended repo gates after implementation:
- `npm run typecheck -w @wtc/web`
- `npm run lint`
- `node scripts/gates.mjs quick`
- `npm run secret:scan`
- `npm run governance:check`
- `git diff --check`

NOT RUN in this audit:
- No Vitest, Playwright, dev server, browser, DB e2e, `node scripts/gates.mjs`, lint, typecheck, secret scan, governance check, visual inventory, or build commands were run.
- `npm run e2e:admin-user-bots:db`, `npm run e2e:admin-user-bots:db:managed`, and `npm run e2e:admin-user-bots:db:managed:matrix` were NOT RUN because they require a prepared throwaway Postgres/admin harness and this audit was inspection-only.
- `npm run worker:smoke`, `npm run worker:tick`, `npm run dev:worker`, and `npm run accept:worker:continuity` were NOT RUN by user instruction and phase scope.
- Live bot start/stop/apply-config, live exchange ping, provider probe, live/worker/deploy commands, SSH, tmux, systemd, preview/prod server mutation, `.env` reads, and raw secret inspection were NOT RUN.
- `npm run evidence:visual -- --manifest <manifest>` was NOT RUN/NOT GREEN; formal visual acceptance is outside this focused gates audit.

## Next actions
1. Implement the admin selected-user launch-readiness mirror as a read-only per-bot panel using safe selected-user DTO fields only.
2. Add the static assertions first, especially admin-safe link/copy/no-live-control/no-secret checks.
3. Update the DB-backed selected-user spec and harness test so the mirror is proven with Tortila and Legacy populated rows across degraded, fresh, stale, and missing runtime scenarios.
4. Run the focused gates listed above; record exact RUN/NOT RUN results in the aggregate Phase 4.25 handoff.
5. Keep worker continuity, live provider reachability, exchange ping, live bot control, deploy, and visual-manifest promotion as separate authorized phases.
