# ecosystem-platform-architect handoff
## Scope
Phase 3.56 read-only audit lane for safe-preview retained-output policy. Scope was limited to the minimal architecture boundary for `npm run preview:safe`: whether the retained-output guard belongs in `scripts/safe-preview.mjs` or a shared helper, whether it raises one-file prototype concerns, how it should interact with the child output redactor and preflight log-root helper, and what implementation acceptance criteria should prove.

No product code, tests, configs, existing docs, live services, SSH/nginx/systemd, DB, worker, bot controls, or preview server were changed or run.

## Files inspected
`AGENTS.md`; `docs/handoffs/0000-orchestrator-seed.md`; `docs/SESSION_PROTOCOL.md`; `docs/STATUS.md`; `docs/IMPLEMENTED_FILES.md`; `docs/NEXT_ACTIONS.md`; `docs/ARCHITECTURE.md`; `docs/ARCHITECTURE_DECISIONS.md`; `docs/DEPLOYMENT.md`; `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_54_20260602.md`; `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_55_20260602.md`; prior relevant handoffs under `docs/handoffs/20260602-1319-*`, `20260602-1357-*`, and `20260602-1444-*`; `package.json`; `.gitignore`; `.secretlintignore`; `scripts/safe-preview.mjs`; `scripts/redacted-child-process.mjs`; `scripts/preflight-log-root.mjs`; `scripts/gates.mjs`; `scripts/safe-worker-tick.mjs`; `scripts/check-retained-visual-artifacts.mjs`; `packages/config/src/env.ts`; `packages/config/src/index.ts`; `packages/config/package.json`; `tests/integration/db-seed-preview-hardening.test.ts`; `tests/integration/child-output-redaction.test.ts`; `tests/integration/preflight-log-root.test.ts`.

`packages/app-env` was requested if relevant, but it is absent in the current tree; the inspected environment package is `packages/config`.

## Files changed
None — read-only audit. Created this handoff only: `docs/handoffs/20260602-1531-ecosystem-platform-architect.md`.

## Findings
1. Severity: High. `safe-preview.mjs` is the remaining raw long-running stream boundary: it starts Next with `spawn(...)` and `stdio: 'inherit'`, while the current deployment docs explicitly say not to archive raw `preview:safe` stdout/stderr. Evidence: `scripts/safe-preview.mjs:20`-`25`; `docs/DEPLOYMENT.md:337`-`339`; `docs/NEXT_ACTIONS.md:28`-`35`; `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_55_20260602.md:83`-`86`. Recommendation: replace inherited stdio with piped stdout/stderr and redact before any retained log write; if console forwarding remains, forward the redacted stream as well. Preserve `shell:false`, signal propagation, forced safe env, and Next direct invocation. Target part: `scripts/safe-preview.mjs`.

2. Severity: Medium. Reuse the existing child-output redaction patterns, but do not reuse `runRedactedChildProcess()` as-is for `safe-preview`; that wrapper uses `spawnSync`, captures finite output, and returns after process exit, while preview is a long-running interactive dev-server stream. Evidence: `scripts/redacted-child-process.mjs:28`-`46` owns the text redaction corpus; `scripts/redacted-child-process.mjs:49`-`59` uses synchronous child execution; `scripts/redacted-child-process.mjs:70`-`75` returns captured output; `scripts/gates.mjs:70`-`78` correctly uses it for finite gate commands. Recommendation: import `redactProcessOutput()` for stream chunks, or add a script-local async stream helper only if needed for testability/reuse. Target part: script utility boundary.

3. Severity: Medium. The minimal architecture boundary is script tooling, not `packages/config` or product packages. `safe-preview` already owns the developer safety overlay (`APP_ENV=development`, mock bot adapter, live controls off), while `packages/config` is the typed app/runtime env validator and architecture docs keep business/domain logic in packages. Evidence: `scripts/safe-preview.mjs:10`-`15`; `packages/config/src/env.ts:18`-`36`; `docs/ARCHITECTURE.md:107`-`119`; `docs/ARCHITECTURE.md:433`-`445`; `docs/handoffs/0000-orchestrator-seed.md:123`-`124`. Recommendation: do not add a new `@wtc/*` package or app-level logger for this slice. Target part: monorepo/package boundary.

4. Severity: Medium. Preflight log-root confinement should be used only if the implementation introduces a configurable retained-log or summary root; otherwise a fixed repo-local `logs/preview-safe-*.log` path is simpler. Evidence: `scripts/preflight-log-root.mjs:8`-`33` confines env-provided roots to repo-local `logs/`; `scripts/preflight-log-root.mjs:36`-`42` writes relative summary paths; `.gitignore:14` and `.secretlintignore:14` already treat `logs/preview-safe*.log` as generated local evidence. Recommendation: if adding `SAFE_PREVIEW_LOG_ROOT` or similar, route it through `resolvePreflightLogRoot()`; if no override is needed, keep the path fixed under `logs/` and avoid importing the preflight helper. Target part: retained preview log path.

5. Severity: Medium. A naive per-chunk stream redactor can leak secrets split across stdout/stderr chunks. The existing redactor is text-pattern based and was previously applied to complete finite child output. Evidence: `scripts/redacted-child-process.mjs:28`-`46`; `scripts/redacted-child-process.mjs:61`-`65`; `tests/integration/child-output-redaction.test.ts:73`-`104`. Recommendation: buffer by line or maintain a bounded carryover/overlap before redaction, and add a fixture that splits a Postgres URL, bearer token, raw public-IP URL, and private-key marker across chunks. Target part: safe-preview stream implementation.

6. Severity: Low. This does not raise the repo's "one-file prototype" concern if it stays as operator evidence tooling around an existing root script. The concern would appear only if product/runtime policy, env validation, or web logging were packed into `safe-preview.mjs`. Evidence: `package.json:26` exposes `preview:safe` as a root script; `docs/ARCHITECTURE.md:377` defines safe IP preview as an operator-only mock-adapter preview path; `docs/ARCHITECTURE.md:537` keeps Web and Worker as the only app processes; prior platform guidance kept visual artifact policy script-only at `docs/handoffs/20260602-1444-ecosystem-platform-architect.md:15`-`20`. Recommendation: keep this as a bounded script and test slice; no new process, package, or app feature. Target part: no-one-file-prototype gate.

7. Severity: Medium. Acceptance cannot rely on `secret:scan` alone for preview retained logs because preview-safe logs are ignored by secretlint. Evidence: `.secretlintignore:14`; `.gitignore:14`; `docs/DEPLOYMENT.md:328`-`335`; `docs/DEPLOYMENT.md:337`-`339`. Recommendation: implementation acceptance must include an explicit retained-preview-log scanner step or focused fixture assertions proving retained preview output is redacted before archive. Target part: acceptance criteria.

## Decisions
Minimal recommended implementation shape:

1. Keep the retention policy in `scripts/safe-preview.mjs` plus focused tests.
2. Reuse `redactProcessOutput()` from `scripts/redacted-child-process.mjs` for text sanitization.
3. Do not use `runRedactedChildProcess()` for the long-running preview server unless it is refactored into an async streaming API; a local stream wrapper is safer.
4. Use a fixed `logs/preview-safe-*.log` output path or, if an operator-configurable log root is added, pass that root through `resolvePreflightLogRoot()`.
5. Do not edit `packages/config`, add a new `packages/*` helper, or change app/product logging for this slice.
6. Treat retained preview output as local evidence hygiene only. A green Phase 3.56 does not prove live preview, production, DB, Stripe, Axioma, SSH/nginx/systemd, or bot acceptance.

## Risks
Chunk-split redaction is the main implementation risk; line/carryover buffering is needed before calling the regex redactor. Redacting live console output may hide raw preview coordinates that operators sometimes use, but Phase 3.52 already moved raw preview coordinates to operator-only env/placeholders and the redactor should preserve non-sensitive localhost output. Retained logs under `logs/preview-safe*.log` are ignored by git and secretlint, so the implementation must name an explicit scan/assertion gate before any archive claim. Starting `preview:safe` during tests can leave a dev server running; prefer static and pure stream-function tests unless a bounded child fixture replaces Next.

## Verification/tests
RUN in this audit:
1. Read-only source and documentation inspection with line-numbered `rg`.
2. Confirmed the target handoff file did not already exist before writing it.

NOT RUN in this audit:
1. `node --check`, Vitest, `npm run secret:scan`, `node scripts/gates.mjs full`, Playwright, and retained artifact scans. Reason: this lane is pre-implementation read-only audit.
2. `npm run preview:safe` or any dev/live server. Reason: scope forbids live/server mutation and this audit did not need a running preview.
3. DB migrations/seeds, worker smoke, real-Postgres, Stripe, Axioma, SSH, nginx, systemd, production/preview rollout, GitHub CI, and monitoring. Reason: out of scope and/or credential/operator-approved acceptance remains separate.

Implementation acceptance criteria for Phase 3.56:
1. `scripts/safe-preview.mjs` no longer contains `stdio: 'inherit'`; it keeps `shell:false`, direct Next CLI invocation, forced safe env, and signal/exit propagation.
2. Retained preview stdout/stderr is redacted before write and, if forwarded, redacted before console output. The redaction fixture must cover Postgres URL/DSN, DB/env secret assignment, password fragment, Authorization/Cookie/Bearer/Basic/JWT-like values, provider token, signed URL token, raw public-IP URL, and private-key block.
3. A split-chunk fixture proves no retained leak when sensitive values cross chunk boundaries.
4. If a preview log file is written, it is repo-local under `logs/preview-safe*.log` or a `resolvePreflightLogRoot()`-confined `logs/...` root, and only relative display paths are printed.
5. Focused tests pass, at minimum the preview safety assertions in `tests/integration/db-seed-preview-hardening.test.ts` plus a new or extended retained-preview-output test.
6. `node --check scripts/safe-preview.mjs` passes.
7. Final implementation gate report lists `npm run secret:scan`, `node scripts/gates.mjs full`, and any retained preview-log scan as RUN or NOT RUN with reasons; no gate is claimed green unless observed in that implementation session.

## Next actions
1. Implement the minimal script-level retained-output policy in `scripts/safe-preview.mjs`.
2. Add focused test coverage for static wiring, redaction corpus, and split-chunk retained-output behavior.
3. If the implementation writes a retained log, scan that exact `logs/preview-safe*.log` artifact explicitly before claiming it archive-safe.
4. Update the aggregate Phase 3.56 handoff with this per-agent handoff path, exact files changed, and exact gates RUN/NOT RUN.
