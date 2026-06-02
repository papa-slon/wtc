# ecosystem-platform-architect handoff
## Scope
Phase 3.38 read-only platform-architecture audit after Phase 3.37. Scope was to plan a bounded LMS live external malware-scanner acceptance preflight by inspecting current scanner config/runtime boundaries, the material upload path, artifact scanner, docs, and tests. No product code, tests, scripts, migrations, DB commands, browser runs, live scanner calls, live S3/R2 calls, or public-upload changes were performed.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260602-0634-phase-3-37-lms-object-store-live-preflight.md`
- `docs/handoffs/20260602-0341-phase-3-30-lms-external-scanner-boundary.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `docs/STATUS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `.env.example`
- `package.json`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `packages/lms/src/materials.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-create-compensation.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/lms-s3-r2-live-preflight.mjs`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-material-create-compensation.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-object-storage-live-preflight.test.ts`

## Files changed
- `docs/handoffs/20260602-0659-ecosystem-platform-architect.md` only.

## Findings
1. Severity: High. Evidence: `package.json:30` exposes only `accept:lms:object-storage`; Phase 3.37 explicitly left live external scanner acceptance NOT RUN at `docs/handoffs/20260602-0634-phase-3-37-lms-object-store-live-preflight.md:103` and names it as a next action at `docs/handoffs/20260602-0634-phase-3-37-lms-object-store-live-preflight.md:106`; `docs/STATUS.md:20`-`22` keeps live external malware-scanner acceptance open after Phase 3.37. Recommendation: add a separate opt-in live scanner preflight command, for example `accept:lms:scanner`, with default dry-run/no-network behavior and live mode gated by explicit operator consent such as `LMS_FILE_SCANNER_LIVE_ACCEPTANCE=1`, an operator-approved endpoint/token, and a declared safe corpus. Target part: scanner preflight command boundary.

2. Severity: High. Evidence: typed config requires `LMS_FILE_SCANNER_MODE`, endpoint, token, and timeout keys at `packages/config/src/env.ts:69`-`72`; external mode requires endpoint/token and an HTTPS endpoint without credentials/query/fragment at `packages/config/src/env.ts:122`-`132`; runtime scanner mode/config/timeout are duplicated in the web upload boundary at `apps/web/src/features/lms/material-storage.ts:79`-`107`. Recommendation: the preflight should exercise the same validated config shape and either factor a small scanner client helper from `material-storage.ts` or call the existing upload scanner path without DB/object writes; avoid a one-off script protocol that can drift from production upload semantics. Target part: shared scanner runtime boundary.

3. Severity: High. Evidence: live upload code calls the external scanner in `scanWithExternalService` at `apps/web/src/features/lms/material-storage.ts:124`-`156`; `storeLmsUploadedFile` scans before storage at `apps/web/src/features/lms/material-storage.ts:234`, and clean `s3-r2` uploads call `beforeObjectPut` and then object PUT at `apps/web/src/features/lms/material-storage.ts:253`-`254`; `createMaterialAction` reaches this path through `fileMaterialFromForm` at `apps/web/src/features/lms/actions.ts:136`-`144`. Recommendation: keep Phase 3.38 scanner preflight scanner-only unless the operator explicitly combines it with object-store acceptance; a clean scanner verdict must not accidentally write S3/R2 objects, DB material rows, audit rows, screenshots, or retained file bytes during the scanner preflight. Target part: LMS material upload acceptance boundary.

4. Severity: High. Evidence: local mocked tests prove scanner-before-object-store ordering and no filename/hash scanner envelope at `tests/integration/lms-material-storage.test.ts:230`-`262`, quarantine status at `tests/integration/lms-material-storage.test.ts:268`-`286`, and fail-closed unavailable/malformed/timeout behavior at `tests/integration/lms-material-storage.test.ts:338`-`373`; acceptance docs still state this is not live malware-engine acceptance and requires real endpoint/token plus safe corpus and live clean/quarantine/failure/timeout observations at `docs/ACCEPTANCE_MATRIX_MASTER.md:98`-`104`. Recommendation: live preflight acceptance must cover four observed verdict classes: clean, quarantined, scanner non-2xx/malformed, and timeout/network failure. The quarantine sample must be operator/vendor-approved; use EICAR only if the chosen scanner endpoint explicitly supports that safe test string. Target part: live scanner acceptance matrix.

5. Severity: Medium. Evidence: artifact scanner deny rules already reject scanner endpoint/token assignments at `scripts/scan-lms-db-e2e-artifacts.mjs:45`-`46`, authorization headers at `scripts/scan-lms-db-e2e-artifacts.mjs:60`, bearer tokens at `scripts/scan-lms-db-e2e-artifacts.mjs:62`, dynamic marker manifests at `scripts/scan-lms-db-e2e-artifacts.mjs:70`-`88`, and caller-supplied evidence roots at `scripts/scan-lms-db-e2e-artifacts.mjs:131`; tests cover scanner env leakage and dynamic markers at `tests/integration/lms-db-e2e-artifact-scan.test.ts:66` and `tests/integration/lms-db-e2e-artifact-scan.test.ts:115`-`143`. Recommendation: before retaining live scanner evidence, add a `logs/lms-scanner-preflight` evidence root and dynamic marker manifest for endpoint host/path, token label, corpus markers, raw scanner reason/body samples, and any vendor request IDs; archive only a redacted summary after `node scripts/scan-lms-db-e2e-artifacts.mjs logs/lms-scanner-preflight` passes, and never archive the marker manifest. Target part: retained live scanner evidence/no-leak gate.

6. Severity: Medium. Evidence: upload audits are intentionally safe metadata only: `docs/AUDIT_LOG_SCHEMA.md:220` allows `storageProvider`, `hasStorageKey`, `scanStatus`, `hasQuarantineReason`, and `retainedUntil`; repository audit payloads emit `storageProvider`, `hasStorageKey`, `scanStatus`, and `hasQuarantineReason` at `packages/db/src/repositories.ts:732`-`735`, with `education.material_upload` written at `packages/db/src/repositories.ts:752` and `packages/db/src/repositories.ts:857`. Recommendation: scanner preflight should not use DB material creation; if a later full upload/browser gate does, it must assert audit payloads never include raw scanner reason text, endpoint, token, request headers, file body, filename, hash, object key, or provider body. Target part: DB/audit boundary.

7. Severity: Medium. Evidence: `.env.example:30` says public production uploads remain disabled until live object-store and external scanner acceptance; `packages/config/src/env.ts:138`-`142` blocks public uploads in deployment environments unless production storage and external scanning are configured; `docs/DEPLOYMENT.md:82`-`85` keeps `LMS_PUBLIC_UPLOADS_ENABLED=false` until live object-store acceptance, live scanner acceptance, DB-backed browser evidence, and scanner-passed retained artifacts exist. Recommendation: the scanner preflight must refuse `LMS_PUBLIC_UPLOADS_ENABLED=true` and must not be used as public rollout approval; public upload rollout remains a later operator-approved phase after object-store, scanner, DB browser, cleanup/reconcile, and artifact gates are all observed. Target part: rollout sequencing and production safety.

8. Severity: Medium. Evidence: Phase 3.37's object-store preflight is explicitly separate from scanner acceptance at `docs/DEPLOYMENT.md:87`-`115`; the object-store live preflight test asserts the opt-in command stays out of default gates at `tests/integration/lms-object-storage-live-preflight.test.ts:29`-`36`, writes redacted dry-run evidence and scans it at `tests/integration/lms-object-storage-live-preflight.test.ts:40`-`79`, and refuses live mode without explicit confirmation at `tests/integration/lms-object-storage-live-preflight.test.ts:88`. Recommendation: copy this gate shape for scanner preflight: root npm script, not called by `e2e`, `ci:local`, or `scripts/gates.mjs`; dry-run evidence redaction test; live-refusal test; artifact scan of generated summaries. Target part: scanner preflight tests and default-gate safety.

## Decisions
- Treat Phase 3.38 as a preflight-design phase, not live acceptance. Do not claim live external scanner acceptance unless an operator supplies an approved scanner endpoint/token and safe corpus and the live command exits 0 with scanner-passed retained evidence.
- Keep live external scanner acceptance separate from live S3/R2 acceptance, DB-backed browser acceptance, cleanup/reconcile acceptance, and public upload rollout.
- Keep public uploads disabled during scanner preflight. A scanner gate may prove live scanner behavior, but it does not authorize public production uploads by itself.
- Reuse the Phase 3.37 evidence model: dry-run first, live opt-in only, redacted summary-only artifacts, dynamic markers for live-only values, and an explicit artifact scanner pass before archiving.
- Prefer a shared scanner helper or direct reuse of the web upload scanner path so the preflight validates the same request shape accepted by `storeLmsUploadedFile`.

## Risks
- The current runtime expects scanner JSON shaped as `{ "status": "clean" }` or `{ "status": "quarantined", "reason": "..." }`; a real vendor endpoint may return a different protocol, async polling model, or richer body that the current synchronous adapter rejects.
- A live scanner endpoint may not support deterministic quarantine/failure/timeout fixtures. Without vendor-supported test controls, only partial live acceptance can be claimed.
- Using EICAR against a third-party endpoint without explicit operator/vendor approval can create avoidable operational or policy risk.
- A script that directly calls `fetch` instead of shared scanner logic could pass while the real upload path remains broken.
- Retained stdout, JSON summaries, HARs, traces, screenshots of network panels, or raw scanner bodies can leak endpoint/token/corpus details unless the scanner evidence policy is enforced.

## Verification/tests
- Read-only source inspection only.
- Not run: no Vitest, typecheck, lint, worker smoke, full gate, e2e, LMS DB-browser runner, artifact scanner, secret scan, governance check, live scanner call, live S3/R2 call, DB command, server process, or migration command.
- Recommended local gates after implementation:
  - `node --check scripts/lms-external-scanner-live-preflight.mjs`
  - `npm test -- packages/config/src/env.test.ts tests/integration/lms-material-storage.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-external-scanner-live-preflight.test.ts`
  - `npm run accept:lms:scanner -- --dry-run`
  - `node scripts/scan-lms-db-e2e-artifacts.mjs logs/lms-scanner-preflight`
  - `node scripts/gates.mjs full`
  - `node scripts/gates.mjs e2e`
  - `npm run secret:scan`
  - `npm run governance:check`
- Recommended live gate only with operator-approved scanner credentials and safe corpus:
  - `npm run accept:lms:scanner -- --live`
  - `node scripts/scan-lms-db-e2e-artifacts.mjs logs/lms-scanner-preflight`

## Next actions
1. Add a scanner-only preflight entry point such as `scripts/lms-external-scanner-live-preflight.mjs` plus `accept:lms:scanner`, excluded from all default gates.
2. Factor or reuse the current external scanner request/response helper so the preflight uses the same HTTPS/token/timeout/request-envelope behavior as the material upload path.
3. Add tests proving dry-run redaction, live refusal without explicit consent, default-gate exclusion, scanner artifact scanning, and representative leak rejection for endpoint, token, Authorization/Bearer, corpus bytes/base64, raw reason/body, and vendor request IDs.
4. Update `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/DEPLOYMENT.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and `docs/PRODUCTION_BLOCKERS_CURRENT.md` with a distinct live scanner preflight boundary and RUN/NOT RUN wording.
5. Only after the preflight lands, run live scanner acceptance with operator-approved endpoint/token and safe corpus; keep live S3/R2, DB-browser, cleanup/reconcile, and public rollout gates separately reported.
