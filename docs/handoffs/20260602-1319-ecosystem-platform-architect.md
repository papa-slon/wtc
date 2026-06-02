# ecosystem-platform-architect handoff
## Scope
Phase 3.52 read-only platform audit defining the safe boundary for raw preview URL hygiene. No live deploy, production monitoring, credentialed acceptance, SSH, nginx/systemd, preview DB, or file edits were performed by this lane.

## Files inspected
`docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `docs/DEPLOYMENT.md`, `docs/PROJECT_CHAT_HANDOFF_20260601.md`, `docs/NEXT_SESSION_PROMPT_FULL_PLATFORM_20260601.md`, `scripts/safe-preview.mjs`, `scripts/scan-lms-db-e2e-artifacts.mjs`, `package.json`, `packages/config/src/env.ts`, and relevant Phase 3.47-3.51 handoffs.

## Files changed
None - read-only audit.

## Findings
1. Medium. Literal raw preview URL persisted in durable operator docs. Recommendation: replace with operator-only placeholders unless the operator explicitly wants the URL public. Target part: operational docs.
2. Medium. Existing scanner covered many secret/provider URL leaks but not public raw preview/IP URL exposure. Recommendation: add a narrow rule/test for public IPv4 preview URLs in retained generated evidence while allowing localhost/private IPs. Target part: artifact hygiene.
3. Low. `preview:safe` is not the primary fix target because it already forces dev/mock/no-live behavior. Recommendation: solve durable exposure with docs/config/scanner hygiene, not live preview validation. Target part: local preview wrapper.
4. High. Production and credentialed gates remain separate and must not be bundled into this slice. Recommendation: Phase 3.52 must not probe, restart, migrate, monitor, or accept against live targets. Target part: phase boundary.

## Decisions
The next local work should be broader than scanner-only but bounded to local hygiene: docs cleanup plus scanner/static regression coverage. It should not include live server or credentialed acceptance.

## Risks
Redacting raw preview coordinates reduces cold-start convenience unless an operator-only replacement location exists. Generic URL deny rules can false-positive unless scoped to generated artifacts.

## Verification/tests
No gates run by this auditor. Read-only inspection only.

## Next actions
1. Redact or replace literal raw preview URL occurrences in durable docs.
2. Add focused scanner/static coverage for public raw-IP preview URL exposure.
3. Run only local focused tests and normal local hygiene checks after edits.
