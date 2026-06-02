# Phase 3.55 retained visual artifact policy handoff
## Scope
Close the local retained-evidence gap where screenshots/images were counted by artifact scans but not inspected by text secret scanning or OCR. This phase adds a fail-closed retained visual-artifact review gate and updates operator evidence policy without live acceptance, deploy, SSH, nginx, systemd, DB mutation, live server checks, bot services, provider calls, CI execution, or production monitoring.

## Agents
- [`docs/handoffs/20260602-1444-ecosystem-security-auditor.md`](20260602-1444-ecosystem-security-auditor.md)
- [`docs/handoffs/20260602-1444-ecosystem-tests-runner.md`](20260602-1444-ecosystem-tests-runner.md)
- [`docs/handoffs/20260602-1444-ecosystem-devops-implementer.md`](20260602-1444-ecosystem-devops-implementer.md)
- [`docs/handoffs/20260602-1444-ecosystem-platform-architect.md`](20260602-1444-ecosystem-platform-architect.md)

All background agents were closed after their read-only results were collected.

## Files inspected
`AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/DEPLOYMENT.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_54_20260602.md`, `README.md`, `package.json`, `.gitignore`, `.secretlintignore`, `.github/workflows/ci.yml`, `playwright.config.ts`, `playwright.lms-db.config.ts`, `scripts/scan-lms-db-e2e-artifacts.mjs`, `scripts/run-lms-db-e2e.mjs`, `scripts/gates.mjs`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`, `tests/e2e/*.spec.ts`, `logs/gates`, and `tests/e2e/screenshots`.

## Files changed
- `scripts/check-retained-visual-artifacts.mjs`
- `tests/integration/retained-visual-artifacts.test.ts`
- `package.json`
- `.gitignore`
- `.github/workflows/ci.yml`
- `scripts/run-lms-db-e2e.mjs`
- `README.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/RISK_REGISTER_MASTER.md`
- `docs/SECRET_VAULT_DESIGN.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_55_20260602.md`
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_54_20260602.md`
- `docs/NEXT_SESSION_PROMPT_FULL_PLATFORM_20260601.md`
- `docs/PROJECT_CHAT_HANDOFF_20260601.md`
- `docs/handoffs/20260602-1444-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-1444-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-1444-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-1444-ecosystem-platform-architect.md`
- `docs/handoffs/20260602-1444-phase-3-55-retained-visual-artifact-policy.md`

## Findings
1. Severity: High. Text retained-artifact scanning skips image bytes, so a scanner PASS was not screenshot leak proof. Evidence: `scripts/scan-lms-db-e2e-artifacts.mjs:11`, `scripts/scan-lms-db-e2e-artifacts.mjs:251`-`255`, and `tests/integration/lms-db-e2e-artifact-scan.test.ts:300`-`304`. Fix: added `scripts/check-retained-visual-artifacts.mjs`, which inventory-counts images separately and fails closed for retained images unless a visual review/OCR manifest covers every image in the supplied roots.
2. Severity: High. `secret:scan` was documented as covering screenshots even though `.secretlintignore` excludes `*.png`. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:14` and `.secretlintignore:16`. Fix: updated the acceptance matrix to separate text secret scanning from retained visual artifact evidence.
3. Severity: High. CI's staged e2e artifact upload would retain screenshots on `always()` without visual policy checks. Evidence: `.github/workflows/ci.yml:120`-`126`. Fix: replaced direct screenshot upload with visual artifact inventory, conditional `--manifest` validation for any reviewed manifest upload candidate, and upload of only matching manifest files with short retention.
4. Severity: Medium. LMS DB browser instructions allowed screenshot archive after text scanner pass even though screenshot pixels were unscanned. Evidence: `scripts/run-lms-db-e2e.mjs:104`-`106` and `docs/DEPLOYMENT.md:247`-`250`. Fix: updated runner/runbook wording so screenshots are retained only after text artifact and visual review gates both pass.

## Decisions
- Implemented the visual evidence policy as script-only tooling plus docs, not a new `@wtc/*` package.
- No OCR dependency was added. OCR sidecars are supported and scanned when supplied; otherwise manual review manifests are accepted as manual review evidence only, not OCR proof.
- `npm run evidence:visual -- --inventory ...` is scope discovery only and is not acceptance.
- `npm run evidence:visual -- --manifest <manifest> <roots>` is the retained visual artifact gate. It fails if any retained image is missing from the review manifest, if review metadata is malformed, if required marker classes are missing, or if OCR sidecar text contains forbidden/dynamic markers.

## Risks
- Manual review manifests are evidence of review, not machine OCR proof.
- Existing screenshots in `tests/e2e/screenshots` are still not reviewed; current acceptance mode correctly refuses them without a manifest.
- GitHub CI remains staged/inert because the workspace is not git-backed.

## Verification/tests
| Gate | Command | Result |
|---|---|---|
| visual checker syntax | `node --check scripts/check-retained-visual-artifacts.mjs` | PASS |
| LMS DB runner syntax | `node --check scripts/run-lms-db-e2e.mjs` | PASS |
| focused visual policy tests | `npx vitest run tests/integration/retained-visual-artifacts.test.ts` | PASS (`10` passed) |
| visual inventory | `npm run evidence:visual -- --inventory tests/e2e/screenshots` | PASS (`68` image files inventoried; inventory is not acceptance) |
| no-manifest fail-closed check | `npm run evidence:visual -- tests/e2e/screenshots` | EXPECTED REFUSAL (`review manifest required for 68 image file(s)`) |
| secret scan | `npm run secret:scan` | PASS |
| full local gate runner | `node scripts/gates.mjs full` | PASS (9/9) |
| retained gate-log scanner | `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates` | PASS (`15` text files, `0` images, `0` blocked containers) |
| final governance | `npm run governance:check` | PASS (0 errors, 1 known historical warning) |

Gates NOT RUN: OCR review of current screenshots, retained screenshot acceptance manifest, `npm run e2e`, `node scripts/gates.mjs e2e`, actual LMS DB browser acceptance, active managed real-Postgres proof, production/preview append-only audit DB-role proof, live preflights, live Stripe/Axioma acceptance, preview/prod DB rollout, SSH/nginx/systemd/server checks, GitHub CI execution, and production monitoring.

## Next actions
1. If retained screenshot evidence is needed, produce a visual review/OCR manifest and run `npm run evidence:visual -- --manifest <manifest> <roots>`.
2. If credentials become available, prioritize the blocked live acceptance path; do not substitute this visual policy for live DB/provider/server proof.
3. Keep long-running `safe-preview` retained-output policy and symlink-hard preflight confinement as separate future safety slices.
