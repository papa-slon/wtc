# Phase 3.68 Legacy DB live-read canary handoff
## Scope
Enable Legacy Bot read-only live visibility on the WTC HTTPS canary through worker-written WTC Postgres snapshots.

This phase did not enable Legacy HTTP/control adapter calls, did not call Legacy mutation endpoints, did not start/stop/apply
bot config, and did not modify the running bot code. The deployed path is:

Legacy provider Postgres safe columns -> WTC worker snapshot -> WTC Postgres -> WTC web/admin UI.

Per-agent handoffs used and reconciled:
- [ecosystem bot integration auditor](20260603-1305-ecosystem-bot-integration-auditor.md)
- [ecosystem security auditor](20260603-1305-ecosystem-security-auditor.md)
- [ecosystem devops implementer](20260603-1305-ecosystem-devops-implementer.md)

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- Current Legacy source at `C:\Users\maxib\GTE BOT\bot`
- Current WTC bot adapter, worker, bot UI, admin, cabinet, config, env, and tests files changed in commit `0eb22a2`
- Server WTC release/container state, service active state, WTC DB snapshot counts, public HTTPS, and firewall state

## Files changed
Repository:
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `apps/worker/package.json`
- `apps/web/src/features/bots/*`
- `apps/web/src/app/(app)/app/bots/*`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/admin/*`
- `apps/web/src/features/cabinet/loader.ts`
- `packages/config/src/env.ts`
- `packages/bot-adapters/src/warnings.ts`
- `packages/cabinet/src/derive.ts`
- current source-of-truth docs updated for Legacy `pub_id` DB snapshot semantics:
  `docs/ARCHITECTURE.md`, `docs/INTEGRATION_MAP.md`, `docs/CONTRACTS/legacy-bot-adapter.md`,
  `docs/CONTRACTS/tortila-adapter.md`, `docs/SITEMAP.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- focused integration/e2e tests and env examples
- per-agent handoffs listed above

Server:
- Created and deployed release `/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260603-0724-0eb22a2-legacy-live-read`.
- Replaced only `wtc-ecosystem-canary` and `wtc-ecosystem-worker` with that release.
- Kept `turtle-bot.service`, `turtle-journal.service`, `nginx`, `postgresql`, and `wtc-bot-api-firewall.service` active.

## Findings
1. Severity: High. Legacy DB live-read is active on canary. Evidence: worker one-shot and live worker logs reported
   `legacy=ok`, `sourceAdapter=legacy-db`, `accounts=2`, `settings=13`, `positions=2`. Recommendation: keep worker DB
   snapshots as the only Legacy live-read surface. Target part: bot integration.
2. Severity: High. Browser verification passed. Evidence: Legacy dashboard showed `HEALTHY` and `REAL DATA`; Legacy settings
   showed `Showing latest Legacy live snapshot`, the symbol matrix, RSI/CCI rows, and no access block; Legacy statistics
   showed positions/stage data and honest no-equity/no-trade-history states; admin bots showed `LEGACY DB READ: ENABLED`.
   Recommendation: operator can review the canary directly. Target part: web UX.
3. Severity: High. Running bots were preserved. Evidence: `turtle-bot.service` and `turtle-journal.service` remained active
   after WTC canary/worker replacement. Recommendation: continue treating bot service control as a separate phase. Target part:
   production boundary.
4. Severity: High. External bot ports stayed closed. Evidence: local external probes returned `8000=false`, `8080=false`,
   while `443=true`; server firewall service remained active. Recommendation: keep this check on every WTC deploy. Target part:
   network boundary.
5. Severity: Medium. Real provider schema differed from local source: table `symbolsettingss` exists instead of
   `symbolsettings`, and delay/delta columns are absent. Evidence: server metadata-only schema inspection. Recommendation:
   keep relation/column detection in the worker and do not assume local ORM names equal production names. Target part:
   Legacy adapter compatibility.

## Decisions
- Use direct Legacy provider DB reads only through explicit safe-column SQL; never select exchange credential columns.
- Use `pub_id` as the provider identity. WTC does not collect new exchange keys for Legacy.
- Keep direct Legacy HTTP/control adapter blocked.
- Update current roadmap/contracts so "Legacy blocked" means direct HTTP/control/live apply, not the accepted
  `pub_id` DB snapshot read path.
- Keep `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`, and Axioma live routes disabled.
- Use existing server bot DB credentials to derive the Legacy DB read URL server-side without printing values.

## Risks
- The Legacy provider DB still contains exchange credential columns provider-side; WTC code does not select or render them.
- The current DB role privilege breadth was not proven column-restricted in this phase; code-level whitelist and secret scan passed.
- Legacy wallet equity currently reflects provider balances as observed; closed-trade history and equity curve remain unavailable and are shown as unavailable, not fabricated.
- Long burn-in and alerting are not complete.

## Verification/tests
RUN:
- Read-only agents launched before broad edits; 3 per-agent handoffs exist and are linked above.
- `npx vitest run tests/integration/legacy-live-worker-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-statistics-static.test.ts tests/integration/cabinet-pg9.test.ts packages/bot-adapters/src/__tests__/legacy-blocked.test.ts packages/config/src/env.test.ts` - PASS, 121 tests.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run lint` - PASS.
- `npm run secret:scan` - PASS.
- `npm test` - PASS, 107 files, 948 passed, 10 skipped.
- `npm run build -w @wtc/web` - PASS locally and on server.
- `npm run check:core` - PASS.
- `npm run governance:check` - PASS with one known historical warning.
- Post-doc-update `npm run secret:scan` - PASS.
- Post-doc-update `npm run governance:check` - PASS with one known historical warning.
- Post-doc-update stale Legacy wording scan across current source-of-truth docs - PASS, no stale direct "Legacy blocked"
  wording for the accepted `pub_id` DB snapshot path.
- Server one-shot worker tick on release `0eb22a2` - PASS; Tortila ok, Legacy ok.
- Server pre-switch smoke on `127.0.0.1:8311` - PASS.
- Server WTC canary and worker replacement - PASS.
- Public HTTPS checks `/products/tortila` and `/login` - PASS 200.
- WTC DB checks - PASS: `legacy_metrics=2`, `legacy_positions=4`, latest `legacy-bot` health ok.
- External port checks - PASS: 8000/8080 closed externally; 443 open.
- Browser checks - PASS: Legacy dashboard/settings/statistics/admin bot health with no horizontal overflow.

NOT RUN / NOT GREEN:
- Live Legacy start/stop/apply-config - NOT RUN and remains disabled.
- Direct Legacy HTTP adapter acceptance - NOT RUN and remains blocked.
- Provider-side credential storage remediation - NOT RUN.
- Column-restricted Legacy DB role proof - NOT RUN.
- Stripe live checkout/webhook, Axioma live bridge/download/account-link, LMS live object-store/scanner - NOT RUN.
- Branded domain, production promotion beyond canary, long burn-in, and production alerting - NOT RUN.

## Next actions
1. Operator review:
   - `https://wtc.54.179.188.61.nip.io/app/bots/legacy`
   - `https://wtc.54.179.188.61.nip.io/app/bots/legacy/settings`
   - `https://wtc.54.179.188.61.nip.io/app/bots/statistics?bot=legacy`
   - `https://wtc.54.179.188.61.nip.io/admin/bots`
2. Add a column-restricted Legacy DB role proof or provision a restricted role, then update the canary secret to use it.
3. Run burn-in monitoring for worker freshness and secret-leak checks.
4. Keep live control as a separate audited phase.
