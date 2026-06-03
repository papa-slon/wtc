# ecosystem-bot-runtime-auditor handoff
## Scope
Read-only production audit of the second bot runtime on `ubuntu@54.179.188.61`.
The target question was whether the legacy RSI/CCI averaging bot is alive and what process boundary WTC must respect.

## Files inspected
- Local WTC adapter and contract files:
  - `packages/bot-adapters/src/legacy/legacy-blocked.ts`
  - `packages/bot-adapters/src/factory.ts`
  - `docs/CONTRACTS/legacy-bot-adapter.md`
- Remote state was inspected through read-only commands: service list, Docker state, listening ports, tmux sessions, process cwd, firewall rules, and sanitized WTC container env allowlist.

## Files changed
None - read-only audit.

## Findings
1. Severity: Info. The legacy averaging bot is running as a tmux-managed Python process in `/home/ubuntu/apps/bot`, listening on server-local port `8000`. Recommendation: treat this as the active legacy runtime and do not assume systemd restart semantics. Target part: legacy runtime operations.
2. Severity: Info. Tortila and Axioma journal services are also up. Recommendation: future WTC work must avoid stopping or mutating these services unless a separate maintenance phase is approved. Target part: live service safety.
3. Severity: High. WTC cannot safely wire a live legacy adapter to the current legacy API because the known `/api_management/` surface exposes plaintext exchange-key material. Recommendation: keep `createLegacyBlockedAdapter()` as the production path until a key-free safe read endpoint exists and security gates pass. Target part: legacy adapter.
4. Severity: Medium. Firewall posture supports future loopback-only reads because public bot API ports are blocked while server-local access remains possible. Recommendation: keep `wtc-bot-api-firewall.service` active. Target part: network boundary.
5. Severity: Medium. The current WTC canary is not configured for legacy live reads. Recommendation: leave `LEGACY_BOT_BASE_URL` absent and keep legacy non-mock blocked until B3 is cleared. Target part: WTC runtime config.

## Decisions
- Do not connect WTC to legacy `/api_management/*` in this phase.
- Do not stop, restart, or mutate the live bots during statistics/settings UI work.
- Treat the current legacy bot as one product/runtime, not as a fleet of separate instances, until product modeling is explicitly expanded.

## Risks
- tmux supervision is weaker than systemd and may not recover from crashes automatically.
- Directly proxying the current legacy API through WTC would create a secret-leak path.

## Verification/tests
RUN: SSH reachability, service state, Docker state, listening ports, tmux/process cwd, firewall rules, sanitized WTC env allowlist, adapter safety-gate code review.

NOT RUN: legacy API authenticated calls, `/api_management/*`, service restarts, full env dumps, log content reads, or any live bot mutation.

## Next actions
1. Keep the legacy live adapter blocked in WTC.
2. Build WTC-side settings and operational views without live apply.
3. Add an upstream key-free read-only legacy endpoint before any real adapter work.
