# Phase 3.67 bot analytics/settings canary deploy handoff
## Scope
Phase 3.67 deployed the Phase 3.66 bot analytics/settings UI slice to the existing WTC HTTPS canary.

The deploy was WTC-only. It replaced only `wtc-ecosystem-canary` with a new release on the same localhost port, preserved
the existing nginx route, kept `wtc-ecosystem-worker` running, kept `wtc-ecosystem-preview` available as rollback, and did
not mutate live bot code, live bot config, live bot services, exchange state, Axioma server state, or bot API firewall policy.

Per-agent handoffs used and reconciled:
- [ecosystem devops implementer](20260603-1225-ecosystem-devops-implementer.md)
- [ecosystem security auditor](20260603-1225-ecosystem-security-auditor.md)

Both background agents were closed before this aggregate handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/DEPLOYMENT.md`
- `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md`
- `docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md`
- `docs/handoffs/20260603-1147-phase-3-66-bot-analytics-settings-richness.md`
- `docs/handoffs/20260603-1225-ecosystem-devops-implementer.md`
- `docs/handoffs/20260603-1225-ecosystem-security-auditor.md`
- Current server WTC container state, service active state, canary release bind, firewall service state, local bot port
  reachability, external bot-port denial, and public HTTPS status were inspected through redacted operational checks.
- Current public canary authenticated bot pages were inspected through the in-app browser.

## Files changed
Repository:
- `docs/handoffs/20260603-1225-ecosystem-devops-implementer.md` - read-only per-agent handoff.
- `docs/handoffs/20260603-1225-ecosystem-security-auditor.md` - read-only per-agent handoff.
- `docs/handoffs/20260603-1225-phase-3-67-bot-analytics-settings-canary-deploy.md` - this aggregate handoff.

Server:
- Created final WTC release `20260603-1246-8075523-bot-analytics` from the previous bot-analytics canary release, overlaid
  commit `8075523`, preserved the copied server `.env.canary.local`, and built the web production bundle in a one-shot
  Docker build container.
- Replaced only `wtc-ecosystem-canary`; it now mounts
  `/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260603-1246-8075523-bot-analytics:/app` and runs on
  `127.0.0.1:8301`.
- Saved a WTC-side Legacy Bot reference config version `v1` through the admin UI. This is a WTC database reference/export
  config only; it does not apply anything to the live Legacy bot.

## Findings
1. Severity: High. The new release built and served correctly before public switch. Evidence: a temporary WTC-only smoke
   container on `127.0.0.1:8311` served `/products/tortila` successfully before replacing the live canary. Recommendation:
   keep this pre-switch smoke pattern for future UI canary updates. Target part: deploy safety.
2. Severity: High. Public canary now runs the new bot analytics/settings release. Evidence: `wtc-ecosystem-canary` bind is
   the new release path and local/public `/products/tortila` checks returned OK. Recommendation: keep the old release and
   preview container until operator review completes. Target part: WTC canary.
3. Severity: High. Existing bot services remained alive and were not restarted. Evidence: `nginx`, `postgresql`,
   `turtle-bot.service`, `turtle-journal.service`, and `wtc-bot-api-firewall.service` were active after deploy;
   `wtc-ecosystem-worker` and `wtc-ecosystem-preview` stayed running. Recommendation: keep future WTC deploys scoped to WTC
   containers unless a separate bot-owner maintenance phase is approved. Target part: service boundary.
4. Severity: High. Bot API public exposure stayed closed. Evidence: server-local bot ports `8000` and `8080` were open, but
   external probes for `8000` and `8080` returned false/closed. Recommendation: keep firewall state as a required post-deploy
   gate. Target part: network boundary.
5. Severity: High. Live bot control and unsafe integrations remained disabled. Evidence: canary env showed
   `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`, `AXIOMA_ROUTE_SKELETON_ENABLED=false`, and
   `BOT_ADAPTER_MODE=read-only`; Legacy remained reference/export-only in the UI. Recommendation: do not enable Legacy live
   adapter or bot controls in this slice. Target part: control and adapter safety.
6. Severity: Medium. Browser verification passed on the operator-visible canary. Evidence: authenticated browser checks
   confirmed Legacy settings had `Legacy symbol matrix`, RSI/CCI/stage matrix copy, `SAFE JSON EXPORT READY`, saved `manual
   edit` version, no `UNCONFIGURED`, no `Access required`, and no horizontal overflow; Legacy statistics had `Coverage
   matrix`, `Stage slots`, `Returns matrix`, and `Risk diagnostics`; Tortila statistics had `Returns matrix`, `Risk
   diagnostics`, `Trade quality`, and `PnL distribution`; Tortila dashboard had `REAL DATA`. Recommendation: operator can
   review these pages directly on the canary. Target part: browser acceptance.
7. Severity: Low. Canary logs include one `UNAUTHENTICATED` error produced by the deploy smoke's unauthenticated `/app/bots`
   probe; the same probe returned redirect-to-login and authenticated browser checks passed with no browser console errors.
   Recommendation: treat as a known smoke artifact unless the same error appears during authenticated navigation. Target part:
   log interpretation.

## Decisions
- Use the Phase 3.64 WTC-only canary pattern: timestamped release, same `127.0.0.1:8301` canary port, no nginx route change,
  and rollback via prior release or `wtc-ecosystem-preview`.
- Do not restart or rebuild `wtc-ecosystem-worker` because this slice is web UI/statistics/settings only and the existing
  worker continues to emit `tortila-snapshot ok`.
- Save the admin WTC-side Legacy reference config so the canary no longer shows an unconfigured Legacy settings page.
- Keep Legacy live adapter blocked, live bot controls disabled, Axioma routes disabled, and TV automation disabled.
- Do not document raw public host coordinates, DB URLs, tokens, cookies, exchange keys, or provider payloads in durable docs.

## Risks
- This is a canary deploy, not final production completion. Billing, Axioma live bridge, live LMS providers, branded domain,
  provider-side journal auth acceptance, long burn-in, and live bot control remain separate gates.
- Legacy is still reference/export-only because the live API remains blocked by plaintext exchange-key exposure risk.
- The worker remains on the previous WTC release because no worker code changed in this slice; if future analytics require
  worker-side data-shape changes, deploy worker separately with its own gate.
- The old rollback preview remains running and should be retired only by an explicit retention decision.

## Verification/tests
RUN in this phase:
- Read-only agents launched before live mutation: devops deploy auditor and security auditor.
- Both per-agent handoffs were written and both agents were closed.
- Local `npm run ci:local` passed before deploy: core smokes, governance, lint, root/web typecheck, `secret:scan`, full root
  tests, and web production build.
- Local full `npm test` passed before deploy: 106 files, 940 tests passed, 10 skipped.
- Server release overlay was verified to contain `packages/analytics/src/advanced.ts`,
  `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`, and `Symbol contribution` in the statistics panels.
- Server web production build passed in a one-shot Docker build container: Next `15.5.18`, 35 static pages.
- Temporary pre-switch smoke container on `127.0.0.1:8311` served `/products/tortila`.
- `wtc-ecosystem-canary` was replaced and started on `127.0.0.1:8301` with the new release bind.
- Public HTTPS checks: `/products/tortila` returned `200`, `/login` returned `200`, and unauthenticated `/app/bots`
  redirected to `/login`.
- Server post-deploy checks: `wtc-ecosystem-canary`, `wtc-ecosystem-worker`, and `wtc-ecosystem-preview` running;
  `nginx`, `postgresql`, `turtle-bot.service`, `turtle-journal.service`, and `wtc-bot-api-firewall.service` active.
- External bot-port checks: `8000=false`, `8080=false`; server-local bot port checks remained open.
- Worker logs after deploy showed repeated `[worker:tortila-snapshot] ok (mode=read-only, sourceAdapter=tortila)`.
- Browser authenticated checks passed for Legacy settings, Legacy statistics, Tortila statistics, and Tortila dashboard.
- Browser console error log after authenticated checks was empty.

NOT RUN / NOT GREEN in this phase:
- GitHub Actions CI for the uncommitted local working tree: NOT RUN.
- DB migrations or seed: NOT RUN; no schema change in this slice.
- Worker release replacement: NOT RUN; not needed for web-only UI/statistics/settings slice.
- Legacy live adapter acceptance: NOT RUN / NOT GREEN; remains blocked.
- Live bot start/stop/apply-config: NOT RUN and remains disabled.
- Provider-side journal bearer-auth acceptance: NOT RUN in this phase.
- Stripe checkout/webhook live acceptance: NOT RUN.
- Axioma live bridge/account-link/download acceptance: NOT RUN and routes remain disabled.
- Live LMS object-store/scanner acceptance: NOT RUN.
- Branded-domain DNS/TLS migration, long burn-in, production alerting, and final production monitoring acceptance: NOT RUN.

## Next actions
1. Operator should review the canary pages:
   - `/app/bots/legacy/settings`
   - `/app/bots/statistics?bot=legacy`
   - `/app/bots/statistics?bot=tortila`
   - `/app/bots/tortila`
2. Keep monitoring `wtc-ecosystem-canary`, `wtc-ecosystem-worker`, bot services, and `wtc-bot-api-firewall.service`.
3. Commit/push this slice in a separate repo workflow if GitHub CI evidence is required for the exact deployed working tree.
4. Keep Legacy real adapter remediation separate from UI work until upstream key-safe endpoints and security gates are green.
5. Keep live bot controls disabled until the full bot-control safety model passes.
