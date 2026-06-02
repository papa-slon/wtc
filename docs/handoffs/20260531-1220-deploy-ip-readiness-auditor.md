## Scope
Read-only audit of how to safely open the web app in a browser over IP without touching live bots or workers.

## Files inspected
- package.json
- apps/web/package.json
- apps/web/next.config.mjs
- docs/DEPLOYMENT.md
- docs/STATUS.md

## Files changed
None by this auditor.

## Findings
- A safe dev preview can run with DATABASE_URL empty, APP_ENV=development, BOT_ADAPTER_MODE=mock, and all live-control flags disabled.
- The worker should not be run for a visual preview.
- Real production deployment is still blocked by Postgres, secrets, CI, Stripe, Axioma, and live adapter readiness.

## Decisions
- Use a browser preview only after build/typecheck/test gates pass.
- Do not run worker processes for the demo preview.

## Risks
- LAN/IP preview is not production hardening.
- Firewall or occupied ports can still block external browser access.

## Verification/tests
- Auditor verified a short-lived local preview command and terminated only that spawned server.

## Next actions
- After implementation gates pass, start the web app on an explicit host/port and report the URL.
