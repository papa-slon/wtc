# E2E Preview Auditor

## Scope
Read-only audit of the previous Playwright flake and browser-preview workflow, focused on making visual inspection reliable.

## Files inspected
- `playwright.config.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/e2e/cabinet-pg9-mobile.spec.ts`
- `tests/e2e/education-ph3-1-mobile.spec.ts`
- `tests/e2e/backtester-pg10-mobile.spec.ts`
- `scripts/gates.mjs`
- `scripts/safe-preview.mjs`

## Files changed
- None by this auditor; the Phase 3.6 operator pass implemented the strict auth and preview recommendations.

## Findings
The old e2e login helper posted through normal Server Actions in `next dev`, which caused an "unexpected response" flake during dev recompilation. The e2e server also shared the normal `.next` directory, allowing cache collisions with build/dev runs.

## Decisions
Introduce an e2e-only auth endpoint guarded by `E2E_AUTH_BYPASS=1` and non-production mode, use a shared e2e login helper, force Playwright retries to `0`, isolate Playwright output into `.next-e2e`, and make gate scripts fail on any nonzero flaky count.

## Risks
The e2e bypass must never exist in production. It is guarded by environment and mode checks and is only enabled by the Playwright webServer environment.

## Verification/tests
Required acceptance is a full Playwright run with `0 flaky` and `0 failed`, plus source tests proving the preview script and responsive admin routes are wired. Phase 3.6 achieved `44 passed / 6 skipped / 0 flaky / 0 failed`.

## Next actions
Keep retries at zero. Any future flaky test is a real failure until diagnosed.
