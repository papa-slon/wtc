## Scope
Read-only audit of the Tortila backtester surface after the model decision to avoid a fake server-runner flow.

## Files inspected
- packages/backtester/src/derive.ts
- packages/backtester/src/derive.test.ts
- packages/backtester
- apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx
- docs/CONTRACTS/backtester-runner.md

## Files changed
None by this auditor.

## Findings
- The honest MVP is a download-only local runner for Tortila, entitlement-gated from the WTC cabinet.
- Server-side backtest jobs, upload tokens, signed artifact upload, and result storage are not ready for a truthful implementation in this session.
- Legacy bot backtester must stay locked.

## Decisions
- Ship a real local-runner ZIP and metadata instead of a disabled teaser or fake server results.
- Keep all produced backtest results local in the MVP.

## Risks
- The runner is a first MVP and not the production-grade historical research stack.
- Real artifact ingestion remains a separate later phase.

## Verification/tests
- Auditor was read-only. Operator must add release metadata, a real ZIP file, route tests, and checksum tests.

## Next actions
- Implement runner release metadata, entitlement-gated download route, UI copy, and checksum assertions.
