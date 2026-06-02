# ecosystem-security-auditor handoff
## Scope
Read-only audit for preflight/evidence log-root confinement covering env/CLI-controlled log, evidence, output, and artifact roots. No live preflights, gates, writes, server operations, or DB mutation were run by this lane.

## Files inspected
`scripts/lms-s3-r2-live-preflight.mjs`, `scripts/lms-external-scanner-live-preflight.mjs`, `scripts/billing-stripe-checkout-preflight.mjs`, `scripts/billing-stripe-webhook-replay-preflight.mjs`, `scripts/axioma-handoff-preflight.mjs`, `scripts/scan-lms-db-e2e-artifacts.mjs`, `scripts/run-lms-db-e2e.mjs`, `scripts/gates.mjs`, related integration tests, and LMS/config storage guards.

## Files changed
None - read-only audit.

## Findings
1. Medium. Five preflight scripts accepted env-controlled `*_PREFLIGHT_LOG_ROOT` values and previously wrote/echoed joined paths directly. Recommendation: use one shared confined evidence-root resolver that rejects absolute paths, traversal, UNC/drive roots, and URL-shaped values; print sanitized repo-relative paths. Target part: preflight summary writers.
2. High. Artifact scanner accepted arbitrary CLI roots and dynamic marker manifest paths, could pass missing explicit roots, and could echo off-repo path labels. Recommendation: reject unsafe explicit roots, refuse missing explicit roots, keep dynamic marker manifests workspace-local, and display repo-relative paths only. Target part: retained-artifact scanner.
3. Low. Existing tests used absolute temp roots, so they did not catch confinement regressions. Recommendation: move tests to repo-local `logs/test-*` roots and add negative root/path-echo cases. Target part: preflight integration tests.
4. Low. Gates log root is fixed and not env-controlled; keep out of this slice. Target part: gate logging boundary.

## Decisions
Evidence roots for operator preflight summaries should be relative repo-local `logs/...` only. Artifact scanner root hardening is in scope because otherwise off-repo evidence can bypass or leak path details.

## Risks
The helper is lexical confinement. If symlink-hard confinement is needed later, add a `realpath` check after directory creation and before writes.

## Verification/tests
No tests run by this auditor. Read-only inspection only.

## Next actions
1. Add shared preflight log-root helper and wire all five summary-writing preflights.
2. Harden scanner explicit roots and dynamic marker path handling.
3. Add helper, wiring, scanner, and repo-local success-path tests.
