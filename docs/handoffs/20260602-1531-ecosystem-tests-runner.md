# ecosystem-tests-runner handoff
## Scope
Phase 3.56 read-only audit lane for the safe-preview retained-output policy. Scope was limited to proposing exact static assertions, focused test coverage, refusal cases, and gate sequence for `npm run preview:safe` without starting live servers, running Playwright, mutating product code, or changing tests/config/docs outside this handoff.

## Files inspected
- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/DEPLOYMENT.md`
- `docs/handoffs/20260602-1357-phase-3-54-child-output-redaction.md`
- `docs/handoffs/20260602-1357-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-1444-phase-3-55-retained-visual-artifact-policy.md`
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_55_20260602.md`
- `package.json`
- `scripts/safe-preview.mjs`
- `scripts/redacted-child-process.mjs`
- `scripts/redacted-child-process.d.mts`
- `scripts/gates.mjs`
- `scripts/safe-worker-tick.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/run-lms-db-e2e-managed.mjs`
- `scripts/run-real-pg-harness-managed.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/check-retained-visual-artifacts.mjs`
- `tests/integration/child-output-redaction.test.ts`
- `tests/integration/db-seed-preview-hardening.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/retained-visual-artifacts.test.ts`

## Files changed
None — read-only audit except this handoff file: `docs/handoffs/20260602-1531-ecosystem-tests-runner.md`.

## Findings
1. Severity: High. `safe-preview.mjs` is still the only inspected local wrapper that starts a child process with inherited raw output: it imports `spawn` at `scripts/safe-preview.mjs:7`, starts Next at `scripts/safe-preview.mjs:20`, forwards the full parent env plus forced flags at `scripts/safe-preview.mjs:22`, and sets `stdio: 'inherit'` at `scripts/safe-preview.mjs:24`. Existing docs explicitly exclude it from retained-output safety because it is long-running: `docs/DEPLOYMENT.md:337`-`339`, `docs/STATUS.md:31`-`34`, and `docs/NEXT_ACTIONS.md:33`-`35`. Recommendation: Phase 3.56 should add static coverage that fails if `scripts/safe-preview.mjs` contains `stdio: 'inherit'`, lacks `shell: false`, stops forcing the dev/mock/no-live flags, or forwards child stdout/stderr before redaction. Target part: safe preview process wrapper.
2. Severity: High. The shared redaction helper is currently synchronous and one-shot: `runRedactedChildProcess()` uses `spawnSync` at `scripts/redacted-child-process.mjs:49`-`58`, then redacts full captured stdout/stderr at `scripts/redacted-child-process.mjs:61`-`65`. That is correct for gates and proof runners, but a long-running Next dev server cannot be covered by this exact helper without blocking until shutdown. Recommendation: if implementation adds a long-running redacted stream helper, focused Vitest must cover stdout and stderr redaction without launching Next, including a child fixture that emits the leak corpus and exits. Target part: redacted long-running child stream helper.
3. Severity: High. Stream redaction has a chunk-boundary risk that the existing tests do not cover. The redactor rules operate on a single string in `redactProcessOutput()` at `scripts/redacted-child-process.mjs:28`-`46`; the current fixture captures complete stdout/stderr before redaction at `tests/integration/child-output-redaction.test.ts:73`-`104`. Recommendation: add a no-Next fixture test where `DATABASE_URL=postgres://u:p@host/db`, bearer tokens, cookies, Stripe keys, and raw public-IP URLs are split across multiple writes/chunks; assert forwarded/retained output contains only redacted markers and no raw fragments. Target part: streaming redaction correctness.
4. Severity: Medium. Current safe-preview static coverage verifies process shape and forced flags, but not retained-output safety. `tests/integration/db-seed-preview-hardening.test.ts:45`-`60` checks `preview:safe`, forced env values, direct Next CLI execution, host/port, and `shell: false`; it does not prohibit inherited stdio or require redacted output wiring. Recommendation: update this test or add `tests/integration/safe-preview-retained-output.test.ts` to assert no raw inherited stdio, no raw child-output file writes, and retained evidence is summary/redacted only. Target part: static regression coverage.
5. Severity: Medium. Existing child-output wiring tests cover gates and `safe-worker-tick`, but not `safe-preview`. `tests/integration/child-output-redaction.test.ts:106`-`120` asserts `scripts/gates.mjs` and `scripts/safe-worker-tick.mjs` use the helper and avoid inherited stdio. Recommendation: extend the wiring test set to include `safe-preview` once a long-running safe-preview redaction path exists. Target part: helper adoption guard.
6. Severity: Medium. Retained-output policy needs refusal cases if implementation introduces any preview log root, summary path, or retained-output mode. `docs/DEPLOYMENT.md:328`-`335` allows only redacted command output, compact summaries, relative `logs/...` paths, and scanned failing logs; `docs/DEPLOYMENT.md:337`-`339` currently forbids archiving raw safe-preview stdout/stderr. Recommendation: tests should fail closed for absolute, UNC, URL-shaped, traversal, or non-`logs/` preview output roots; fail if raw stdout/stderr is written to a retained `.log`; and allow only a redacted summary artifact plus separately scanned generated artifacts. Target part: retained preview evidence policy.
7. Severity: Medium. The artifact scanner already catches raw public-IP preview URLs and preview URL assignments in retained text artifacts: `scripts/scan-lms-db-e2e-artifacts.mjs:101` and `scripts/scan-lms-db-e2e-artifacts.mjs:112`; visual evidence is separately gated by manifest/OCR policy in `docs/handoffs/20260602-1444-phase-3-55-retained-visual-artifact-policy.md:51`-`52`. Recommendation: the Phase 3.56 gate sequence should include text artifact scanning for any generated preview summary/log fixture and should keep visual evidence gates separate from stdout/stderr redaction. Target part: post-run retained evidence scanning.

## Decisions
- Do not run `npm run preview:safe`, `npm run e2e`, `node scripts/gates.mjs e2e`, Playwright, live preview, SSH, nginx, systemd, DB mutation, provider preflights, or live bot controls in this read-only lane.
- Treat raw `safe-preview` terminal buffers as non-retainable. The acceptable policy target is redacted streaming console output plus an optional compact operator summary, not archived raw Next dev stdout/stderr.
- Do not reuse the synchronous `runRedactedChildProcess()` directly for a long-running preview server unless the implementation deliberately changes preview lifecycle behavior. Prefer a tested async stream redaction helper or an equivalent line/buffered redaction layer.
- Keep `npm run preview:safe` developer-preview behavior intact: direct Next CLI execution, `shell:false`, `--hostname 0.0.0.0`, `--port 3000`, and forced `APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`.

## Risks
- Per-chunk redaction can leak secrets when a credential is split across stream chunks unless the implementation buffers safely before forwarding.
- Over-retaining preview output can contradict the current deployment policy that forbids archiving raw interactive dev-server stdout/stderr.
- A safe-preview redaction change can accidentally weaken existing IP-review behavior if tests do not preserve host/port and direct Next CLI execution.
- The workspace is not git-backed, so GitHub CI and git diff verification are unavailable here; local filesystem checks must be used until a repository is initialized.

## Verification/tests
Gates RUN in this read-only audit:
| Gate | Command | Result |
|---|---|---|
| repo backing check | `git status --short` and `git rev-parse --show-toplevel` | NOT A GIT REPOSITORY |
| source inspection | `rg` / `Get-Content` over scoped files | PASS |
| live server / Playwright | not run by scope | NOT RUN |

Expected Phase 3.56 implementation coverage:
1. Add or update focused tests:
   - `tests/integration/safe-preview-retained-output.test.ts` for no-Next fixture streaming redaction.
   - `tests/integration/db-seed-preview-hardening.test.ts` static assertions for no inherited stdio and forced preview flags.
   - `tests/integration/child-output-redaction.test.ts` wiring guard for the safe-preview redaction path.
2. Static assertions:
   - `package.json` still maps `"preview:safe": "node scripts/safe-preview.mjs"`.
   - `scripts/safe-preview.mjs` still uses direct `process.execPath` + Next CLI, `shell: false`, `--hostname 0.0.0.0`, and `--port 3000`.
   - `scripts/safe-preview.mjs` does not contain `stdio: 'inherit'` or `stdio: "inherit"`.
   - `scripts/safe-preview.mjs` does not write raw child stdout/stderr to a retained file.
   - The forced env overrides cannot be bypassed by parent env values.
3. Dynamic no-server fixture assertions:
   - A child fixture writes leak-shaped stdout and stderr and exits; no Next server is started.
   - Postgres URLs/DSNs, DB assignments, `password=`, auth headers, cookies, bearer/basic/JWT-like values, Stripe keys, provider tokens, signed URL params, raw public-IP URLs, and private key blocks are redacted in forwarded and retained output.
   - Split-write/chunk-boundary secrets are not leaked.
   - Exit code and signal propagation still match the existing preview behavior.
4. Refusal cases:
   - Unsafe retained-output roots: absolute path, UNC path, URL-shaped path, traversal, and non-`logs/` path.
   - Any raw `.log` retention mode for `safe-preview` child stdout/stderr.
   - Any implementation that treats visual artifacts or screenshots as clean because text stream redaction passed.

Expected gate sequence after implementation, still without starting live preview or Playwright:
| Order | Command | Expected |
|---|---|---|
| 1 | `node --check scripts/redacted-child-process.mjs` | PASS |
| 2 | `node --check scripts/safe-preview.mjs` | PASS |
| 3 | `npx vitest run tests/integration/child-output-redaction.test.ts tests/integration/db-seed-preview-hardening.test.ts tests/integration/safe-preview-retained-output.test.ts` | PASS |
| 4 | `npm run secret:scan` | PASS |
| 5 | `node scripts/gates.mjs full` | PASS; does not include e2e per `scripts/gates.mjs:47`-`52` |
| 6 | `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates` | PASS |
| 7 | `npm run governance:check` | PASS |

Expected gates NOT RUN unless separately scoped:
- `npm run preview:safe` because it starts the long-running local dev server.
- `npm run e2e` and `node scripts/gates.mjs e2e` because they start Playwright/webServer.
- LMS DB browser acceptance, managed real-Postgres proof, append-only audit DB-role proof, live provider preflights, live Stripe/Axioma acceptance, preview/prod rollout, SSH/nginx/systemd/server checks, GitHub CI execution, and production monitoring.

## Next actions
1. Implement the long-running safe-preview redaction layer and the no-server fixture tests first; do not start Next as part of focused coverage.
2. Update the existing safe-preview static assertions so they preserve direct Next CLI execution and block inherited/raw retained output.
3. Run the expected gate sequence above, then have the operator aggregate this handoff with the implementation/auditor handoffs for Phase 3.56.
