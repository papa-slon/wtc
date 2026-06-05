# Phase 3.73 bot settings source truth handoff
## Scope
Bounded implementation slice for Legacy and Tortila bot settings clarity after Phase 3.72 provider-account ingestion. Goal: make bot settings, setup, statistics, and exports honest about source boundaries: built-in defaults, saved WTC reference config, Legacy provider/runtime snapshots, provider pub_id mapping, and disabled live control.

Read-only background agents were launched before product edits, then closed before final report:
- `docs/handoffs/20260603-1840-bot-settings-source-ux-auditor.md`
- `docs/handoffs/20260603-1840-bot-settings-frontend-auditor.md`
- `docs/handoffs/20260603-1840-bot-settings-security-tests-auditor.md`
- `docs/handoffs/20260603-1840-bot-settings-truth-auditor.md`

External UX references used for the product model:
- 3Commas DCA bot settings: preset-led setup, advanced/simple layouts, pair selection, averaging order review before start.
- Cryptohopper config pools: per-coin overrides layered over base config.
- BlackRock Aladdin materials: unified risk/performance framing and explicit analytics source boundaries.

No live Legacy/Tortila bot start, stop, restart, retest, exchange ping, apply-config, SSH, tmux, systemd, `.env`, provider DB mutation, or live bot control path was run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1830-phase-3-72-legacy-provider-ingestion-admin-mapping.md`
- Four Phase 3.73 per-agent handoffs listed above.
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/e2e/bot-settings.spec.ts`

## Files changed
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/e2e/bot-settings.spec.ts`
- `docs/handoffs/20260603-1910-phase-3-73-bot-settings-source-truth.md`

## Findings
1. Severity: High. Evidence: source UX/security agents found Legacy zero mappings displayed as `1 provider pub_id`. Fix: removed `|| 1` count fallbacks from dashboard, statistics, and Legacy table source summaries; zero now renders as zero/mapping pending.
2. Severity: High. Evidence: truth/UX agents found Legacy editable settings seeded from provider snapshots before saved WTC references. Fix: settings/setup edit only saved WTC config or built-in defaults; provider snapshots moved to read-only evidence.
3. Severity: High. Evidence: security agent found `providerPubId` crossing into user-submitted config/export. Fix: removed hidden provider pub_id form fields and stripped provider ids from sanitized Legacy exports.
4. Severity: High. Evidence: truth agent found defaults leaking into runtime-looking statistics when a raw snapshot object existed but had no explicit runtime rows. Fix: added source-existence helpers so runtime statistics/snapshot panels do not synthesize default rows.
5. Severity: Medium. Evidence: truth agent found Legacy DB reads labeled too strongly as healthy/live. Fix: Legacy read mode now stays `unknown`; status pill copy is `DB snapshot ok`/warning instead of `Healthy`.
6. Severity: Medium. Evidence: truth agent found missing portfolio metrics could become `$0.00`. Fix: portfolio wallet equity now shows partial/N/A semantics with contributor counts.

## Decisions
1. Treat Legacy provider snapshot as read-only evidence, not editable user profile and not runtime health proof.
2. Treat settings forms as WTC reference versions only. Saving never starts, stops, applies, retests, or pings a live bot.
3. Keep provider pub_id ownership admin/DB-side. User forms and exports do not carry provider identity.
4. Keep Tortila exchange-key connection testing disabled until an audited read-only exchange ping adapter exists.
5. Use existing WTC UI primitives and tests instead of introducing a new settings framework in this bounded slice.

## Risks
1. This slice improves source truth and UX safety, but it is not the final full bot-management product. Admin global runtime configuration, audited exchange ping, copy-runtime-to-draft, and complete Tortila parity remain future slices.
2. Browser QA used demo/in-memory app data, not live provider data. It proves UI rendering and copy states, not live bot continuity.
3. The repository had pre-existing dirty changes from adjacent phases; this slice did not revert or normalize unrelated files.

## Verification/tests
RUN:
1. Four read-only background agent audits completed and were closed.
2. External UX research: 3Commas DCA settings, Cryptohopper config pools, BlackRock Aladdin risk/performance dashboard framing.
3. `npx vitest run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/bot-statistics-static.test.ts` - PASS, 31 tests.
4. In-app Browser QA on local dev server `127.0.0.1:3410`: `/app/bots/tortila/settings`, `/app/bots/legacy/settings`, `/app/bots/statistics?bot=legacy` - PASS, required source/warning text present, no horizontal overflow at 1280px viewport.
5. `npm run typecheck` - PASS.
6. `npm run typecheck -w @wtc/web` - PASS.
7. `npm run lint` - PASS.
8. `npm run build -w @wtc/web` - PASS, 35 static pages generated and changed bot routes included.
9. `npx playwright test tests/e2e/bot-settings.spec.ts --project=desktop --project=mobile` - PASS, 2 tests.
10. `npm run check:core` - PASS.
11. `npm run secret:scan` - PASS.
12. `git diff --check` - PASS.

NOT RUN:
1. Full `npm test` - skipped because this was a bounded settings/statistics source-truth slice and focused integration, e2e, build, lint, typecheck, core, and secret gates were run.
2. DB migration apply/push - skipped because this slice did not add migrations.
3. Live Legacy/Tortila bot continuity proof, process watchdog, SSH, tmux, systemd, worker restart, exchange ping, provider DB mutation/read outside app mocks, `.env` reads, start/stop/retest/apply-config - forbidden by scope and not run.
4. Admin global system-configuration UI completion - not part of this source-truth slice.
5. Copy provider snapshot into WTC draft workflow - intentionally not added until product/security design is explicit.

## Next actions
1. Build the next Phase 3.74 slice around admin global bot configuration and user detail statistics without allowing admins to edit user-owned settings.
2. Add an audited exchange-key test adapter only after security design approves no-secret logging, rate limits, and failure copy.
3. Add an explicit copy-runtime-to-draft action for Legacy only if product/security approves the source boundary and audit event.
4. Expand Playwright coverage to admin user drilldown and statistics pages once this bounded source-truth slice is accepted.
