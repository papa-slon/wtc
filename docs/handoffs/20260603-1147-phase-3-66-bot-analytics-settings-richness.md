# Phase 3.66 bot analytics and settings richness handoff
## Scope
Phase 3.66 expanded bot product depth after operator review showed the current bot settings and statistics were too thin.
The phase added journal-grade analytics panels for bot statistics and a richer Legacy averaging bot settings/reference/export
surface based on the audited local/server Legacy configuration shape.

This phase did not enable Legacy live API reads, did not enable live bot start/stop/apply-config, did not mutate live bot
runtime code, did not restart live bot services, and did not read or store exchange credentials. Legacy remains blocked for
live adapter use until the plaintext exchange-key exposure risk is resolved by separate bot-integration and security gates.

Per-agent handoffs used and reconciled:
- [ecosystem bot runtime auditor](20260603-1147-ecosystem-bot-runtime-auditor.md)
- [ecosystem legacy settings auditor](20260603-1147-ecosystem-legacy-settings-auditor.md)
- [ecosystem bot integration auditor](20260603-1147-ecosystem-bot-integration-auditor.md)
- [ecosystem ux statistics auditor](20260603-1147-ecosystem-ux-statistics-auditor.md)
- [ecosystem tests runner](20260603-1147-ecosystem-tests-runner.md)

All five background agents were closed before this aggregate handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1147-ecosystem-bot-runtime-auditor.md`
- `docs/handoffs/20260603-1147-ecosystem-legacy-settings-auditor.md`
- `docs/handoffs/20260603-1147-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260603-1147-ecosystem-ux-statistics-auditor.md`
- `docs/handoffs/20260603-1147-ecosystem-tests-runner.md`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `packages/analytics/src/advanced.ts`
- `packages/analytics/src/index.ts`
- `packages/analytics/src/advanced.test.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`

## Files changed
- `packages/analytics/src/advanced.ts` - adds advanced analytics for returns, trade quality, risk-adjusted metrics, symbol
  contribution, daily PnL, distribution, and open exposure.
- `packages/analytics/src/index.ts` - exports the advanced analytics API and types.
- `packages/analytics/src/advanced.test.ts` - covers advanced analytics calculations.
- `apps/web/src/features/bots/statistics-panels.tsx` - replaces the thin statistics surface with returns matrix, risk
  diagnostics, trade quality, symbol contribution, heatmap, distribution, and Legacy operations coverage panels.
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx` - wires advanced analytics and Legacy operations data into the bot
  statistics page.
- `apps/web/src/features/bots/config.ts` - replaces flat Legacy defaults with symbol/stage settings, validation, form
  parsing, backward-compatible config derivation, and safe native export structure.
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx` - adds the Legacy averaging configuration matrix UI.
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` - shows the Legacy matrix on Legacy settings.
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx` - shows the Legacy matrix during Legacy setup.
- `tests/integration/bot-statistics-static.test.ts` - updates static coverage to the new advanced statistics panels.
- `docs/handoffs/20260603-1147-ecosystem-bot-runtime-auditor.md` - read-only per-agent handoff.
- `docs/handoffs/20260603-1147-ecosystem-legacy-settings-auditor.md` - read-only per-agent handoff.
- `docs/handoffs/20260603-1147-ecosystem-bot-integration-auditor.md` - read-only per-agent handoff.
- `docs/handoffs/20260603-1147-ecosystem-ux-statistics-auditor.md` - read-only per-agent handoff.
- `docs/handoffs/20260603-1147-ecosystem-tests-runner.md` - per-agent verification handoff.
- `docs/handoffs/20260603-1147-phase-3-66-bot-analytics-settings-richness.md` - this aggregate handoff.

## Findings
1. Severity: High. The old bot statistics surface was too thin for operator review and did not recover the useful
   Tortila-style journal diagnostics. Recommendation: keep the new statistics surface centered on returns, risk, trade
   quality, symbol contribution, daily PnL, distribution, drawdown, open exposure, exits, and activity. Target part: bot
   statistics UI and analytics package.
2. Severity: High. Legacy averaging bot settings are much wider than the prior WTC form represented. Audits found
   per-symbol activation, RSI/CCI signal selection, indicator lengths/thresholds, timeframes, take-profit, initial entry,
   averaging drops, averaging volumes, balance percent, leverage, and stage slots. Recommendation: keep Legacy settings as
   a matrix-oriented configuration surface, not a small generic form. Target part: Legacy settings/setup UI.
3. Severity: High. Legacy live adapter remains unsafe because the audited API management surface can expose plaintext
   exchange credentials. Recommendation: keep `createLegacyBlockedAdapter()` as the only non-mock Legacy runtime path until
   a dedicated credential-safe adapter and control safety audit pass. Target part: Legacy integration.
4. Severity: Medium. The tests-runner agent initially found a static assertion drift: the test still expected the old
   `Symbol performance` label while the implementation now renders `Symbol contribution`. Recommendation: update static
   tests when product copy changes so old labels do not mask valid implementation changes. Target part: static coverage.
5. Severity: Medium. Local browser checks showed the first rich Legacy JSON preview was visually too heavy. Recommendation:
   keep safe export available through the route/button, but do not render the full JSON blob inline in the settings page.
   Target part: UX polish.

## Decisions
- Keep Tortila and Legacy statistics on the same advanced analytics model where canonical trade/equity/position data exists.
- Add Legacy-specific operations coverage on the statistics page because the Legacy bot currently exposes configuration
  coverage more safely than performance history.
- Represent Legacy settings as editable symbol and stage matrices with safe JSON export, not as live apply controls.
- Preserve fail-closed entitlement/access behavior and existing blocked Legacy live adapter behavior.
- Do not include exchange secrets, DB URLs, SSH targets, raw preview URLs, cookies, bearer tokens, or provider payloads in
  durable docs.
- Treat the tests-runner handoff's red focused static test as superseded by the main operator fix and later green gates in
  this aggregate handoff.

## Risks
- Legacy performance statistics remain limited until a credential-safe read path can produce canonical trades/equity without
  touching plaintext exchange-secret endpoints.
- The Legacy settings matrix is reference/export UI only; users still cannot safely apply live config changes through WTC.
- Browser verification was local-dev only, not deployed production-canary verification for this phase.
- Advanced statistics are only as complete as the bot adapter snapshot/import data they receive.
- Full production remains incomplete for other tracks outside this slice: branded domain, long burn-in, billing acceptance,
  Axioma live bridge, live LMS provider gates, and live bot control.

## Verification/tests
RUN in this phase:
- Per-agent handoffs present: bot runtime auditor, Legacy settings auditor, bot integration auditor, UX statistics auditor,
  and tests runner.
- Local browser checks passed for `http://localhost:3000/app/bots/legacy/settings`,
  `http://localhost:3000/app/bots/statistics?bot=legacy`, and `http://localhost:3000/app/bots/statistics?bot=tortila`.
- Browser checks confirmed no horizontal scroll in the inspected local viewports, Legacy matrix/stage coverage rendered, and
  Tortila advanced statistics panels rendered.
- `npm test -- tests/integration/bot-statistics-static.test.ts packages/analytics/src/advanced.test.ts` passed: 2 files, 9
  tests.
- `npm test` passed: 106 files, 940 tests passed, 10 skipped.
- Earlier in-scope gates run before the final static fix: root/web typecheck passed, lint passed, web production build
  passed, bot read/config export static checks passed, and secret scan passed.

NOT RUN / NOT GREEN in this phase:
- Legacy live adapter acceptance: NOT RUN / NOT GREEN; blocked by plaintext exchange-key exposure risk.
- Live bot start/stop/apply-config: NOT RUN by policy and remains disabled.
- Live bot service restart or runtime mutation: NOT RUN by policy.
- Production-canary deploy of this UI slice: NOT RUN in this phase.
- Provider-side Legacy credential-safe read acceptance: NOT RUN.
- Provider-side journal bearer-auth acceptance: NOT RUN in this phase.
- Stripe checkout/webhook live acceptance: NOT RUN.
- Axioma live bridge/account-link/download acceptance: NOT RUN.
- Live LMS object-store/scanner acceptance: NOT RUN.
- Branded-domain DNS/TLS migration, long burn-in, and production monitoring acceptance: NOT RUN.

## Next actions
1. Run `governance:check` and the final local CI gate after this aggregate handoff exists.
2. If the gates stay green, deploy this UI/statistics slice to the WTC canary without touching bot services.
3. Re-check canary browser pages for Legacy settings, Legacy statistics, Tortila statistics, access controls, and admin
   health after deploy.
4. Plan a separate Legacy credential-safe read adapter phase before any real Legacy live performance or apply-config work.
5. Keep live control disabled until security, bot-integration, RBAC, entitlement, audit-log, and rollback gates all pass.
