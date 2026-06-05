# tortila-source-perimeter-auditor handoff
## Scope
Read-only Phase 4.69 discovery of Tortila/Turtle canonical source and production perimeter after the WTC canary deploy. The audit checked local adjacent source, server runtime source, WTC adapter boundaries, service metadata, and network posture. It did not edit files, read secrets/env values, query SQLite data, run endpoint probes, restart services, deploy, or call exchange/live-control paths.

## Files inspected
- `docs/CONTRACTS/tortila-adapter.md`
- `scripts/run-tortila-real-read-managed.mjs`
- `packages/bot-adapters/src/http.ts`
- Local adjacent `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py`
- Local adjacent `C:\Users\maxib\GTE BOT\bot_tortila\tests\test_journal.py`
- Server runtime source metadata under `/home/ubuntu/apps/turtle_bingx`
- Server systemd/socket/firewall/nginx metadata for Turtle/Tortila journal posture
- Filtered WTC worker continuity logs

## Files changed
None - read-only audit.

## Findings
1. Severity: P0. Tortila production-source gate is not green. Evidence: no canonical git-backed Tortila/Turtle source was found locally or on the server; `/home/ubuntu/apps/turtle_bingx` exists but is not git-backed. Recommendation: require a canonical source packet before production-source completion. Target part: Tortila source-control gate.
2. Severity: P0. Local adjacent source contains the desired journal read-token patch, but server runtime does not. Evidence: local `app.py` reads `JOURNAL_READ_TOKEN`, accepts bearer and `x-journal-read-token`, and protects `/api/*`; local `test_journal.py` covers missing/wrong/correct token behavior. Server runtime `app.py` and `test_journal.py` differ from local and have no `JOURNAL_READ_TOKEN`, `x-journal-read-token`, or bearer-token middleware matches. Recommendation: land token middleware/tests in the canonical source, then deploy runtime source separately. Target part: Tortila journal auth boundary.
3. Severity: High. WTC adapter stays correctly narrow. Evidence: `packages/bot-adapters/src/http.ts` attaches bearer auth when configured, refuses unauthenticated real reads, and uses only health/summary/trades/equity; `scripts/run-tortila-real-read-managed.mjs` allowlists the same endpoints and rejects `/api/marks` plus `/api/overview`. Recommendation: keep `/api/marks` and `/api/overview` out of WTC proof. Target part: WTC read-only adapter.
4. Severity: Medium. Runtime firewall posture is useful but not a green gate. Evidence: bot ports listen broadly at process level; iptables drops non-loopback traffic for those ports, while UFW is inactive and nginx does not proxy the journal port. Recommendation: production proof must include redacted positive/negative probes and service-boundary evidence after token middleware is deployed. Target part: network perimeter.

## Decisions
- Do not call current Tortila production source complete.
- Treat WTC worker `tortila ok` as runtime read proof only, not token-auth/perimeter proof, while server runtime lacks auth middleware.
- Next WTC implementation should add a canonical-source verifier instead of more UI polish.

## Risks
- Adjacent non-git source can drift from server runtime and cannot be release-governed.
- Runtime token probes are not meaningful until the deployed journal enforces token auth.
- Firewall posture depends on the iptables guard staying loaded.

## Verification/tests
RUN:
1. Local/server git inventory - PASS; no canonical Tortila git repo found.
2. Local/server source grep for token middleware/tests - PASS; local patched, server runtime not patched.
3. Systemd/socket/firewall/nginx posture inspection - PASS in read-only scope.
4. Filtered WTC worker log continuity check - PASS; runtime read proof remains green.

NOT RUN:
1. pytest/ruff, endpoint curl probes, SQLite data reads, env reads, service restart, deploy, external firewall probe - intentionally skipped.

## Next actions
1. Add a WTC canonical-source verifier that rejects non-git adjacent/runtime folders.
2. Identify or create the canonical Tortila source repo, land token middleware/tests there, then run bot pytest/ruff.
3. Deploy runtime source and run redacted auth/perimeter probes in a separate approved phase.
