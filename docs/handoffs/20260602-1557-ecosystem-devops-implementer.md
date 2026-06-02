# ecosystem-devops-implementer handoff
## Scope
Phase 3.57 read-only devops audit for symlink-hard preflight root confinement. Scope is limited to ops/runbook gaps for `*_PREFLIGHT_LOG_ROOT` summary writes on Windows/Linux, with no live server mutation, no SSH, no nginx/systemd/tmux checks, no provider calls, and no implementation edits. Recommend a local-only implementation and verification path for the next implementation lane.

## Files inspected
- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/DEPLOYMENT.md`
- `docs/handoffs/20260602-1531-phase-3-56-safe-preview-retained-output-policy.md`
- `docs/handoffs/20260602-1338-phase-3-53-preflight-log-root-confinement.md`
- `.env.example`
- `.gitignore`
- `.secretlintignore`
- `package.json`
- `scripts/preflight-log-root.mjs`
- `scripts/preflight-log-root.d.mts`
- `scripts/lms-s3-r2-live-preflight.mjs`
- `scripts/lms-external-scanner-live-preflight.mjs`
- `scripts/billing-stripe-webhook-replay-preflight.mjs`
- `scripts/billing-stripe-checkout-preflight.mjs`
- `scripts/axioma-handoff-preflight.mjs`
- `tests/integration/preflight-log-root.test.ts`
- `tests/integration/preflight-log-root-wiring.test.ts`

## Files changed
None — read-only audit except `docs/handoffs/20260602-1557-ecosystem-devops-implementer.md`.

## Findings
1. Severity: High. The shared preflight root helper is lexically confined but not symlink/junction-hard. Evidence: `scripts/preflight-log-root.mjs:8`-`28` trims, normalizes, rejects URL/absolute/UNC/traversal/non-`logs/` inputs, and checks `path.relative()` against the unresolved workspace path; `scripts/preflight-log-root.mjs:36`-`40` then calls `mkdirSync(logRoot.absoluteRoot, { recursive: true })` and `writeFileSync()` without `realpathSync`, `lstatSync`, reparse-point, symlink, or junction checks. Recommendation: keep the lexical policy, then reject linked existing ancestors and verify the post-create `realpathSync.native()` of the target root stays inside the `realpathSync.native()` workspace before writing. Write through the verified real path and use no-overwrite file creation for the summary file. Target part: `scripts/preflight-log-root.mjs` and `scripts/preflight-log-root.d.mts`.

2. Severity: High. The gap is systemic because all five summary-writing preflight scripts centralize writes through the same helper. Evidence: object storage imports and calls the helper at `scripts/lms-s3-r2-live-preflight.mjs:9`, reads `LMS_OBJECT_STORAGE_PREFLIGHT_LOG_ROOT` at `scripts/lms-s3-r2-live-preflight.mjs:17`, and resolves its default at `scripts/lms-s3-r2-live-preflight.mjs:43`-`47`; external scanner does the same at `scripts/lms-external-scanner-live-preflight.mjs:8`, `scripts/lms-external-scanner-live-preflight.mjs:16`, and `scripts/lms-external-scanner-live-preflight.mjs:40`-`44`; Stripe webhook at `scripts/billing-stripe-webhook-replay-preflight.mjs:23`, `scripts/billing-stripe-webhook-replay-preflight.mjs:29`, and `scripts/billing-stripe-webhook-replay-preflight.mjs:53`-`57`; Stripe checkout at `scripts/billing-stripe-checkout-preflight.mjs:9`, `scripts/billing-stripe-checkout-preflight.mjs:15`, and `scripts/billing-stripe-checkout-preflight.mjs:37`-`41`; Axioma at `scripts/axioma-handoff-preflight.mjs:20`, `scripts/axioma-handoff-preflight.mjs:26`, and `scripts/axioma-handoff-preflight.mjs:50`-`54`. Recommendation: fix the shared helper rather than patching five callers; leave default roots and refusal wording stable unless tests require a safer generic message. Target part: five preflight summary writers.

3. Severity: Medium. Focused tests cover hostile lexical roots and wiring, but not symlink/junction escape. Evidence: `tests/integration/preflight-log-root.test.ts:41`-`52` rejects Windows absolute, POSIX absolute, UNC, URL, parent traversal, nested traversal, backslash traversal, and non-logs roots; `tests/integration/preflight-log-root-wiring.test.ts:70`-`84` verifies the five scripts refuse URL-shaped roots before summary writes; `tests/integration/preflight-log-root-wiring.test.ts:86`-`108` verifies a traversal-shaped root does not create an outside directory. No inspected test creates a `logs/...` symlink or Windows junction to an outside temp directory. Recommendation: add a portable symlink/junction regression test that creates an outside temp directory, links `logs/<test>/escape` to it (`dir` symlink on POSIX, `junction` on Windows), calls `writePreflightSummary()`, expects refusal, and asserts no `summary-*.json` appears outside. Add one wiring-level case for a caller if the helper failure path needs process-level coverage. Target part: `tests/integration/preflight-log-root.test.ts` and optionally `tests/integration/preflight-log-root-wiring.test.ts`.

4. Severity: Medium. Operator runbooks state relative `logs/...` confinement but do not mention realpath, symlinks, junctions, or Windows reparse-point hazards. Evidence: `docs/DEPLOYMENT.md:44`-`49` says overrides must be relative repo-local `logs/...` paths and rejects absolute/UNC/URL/traversal/non-logs roots; `.env.example:47`-`48` repeats the same lexical policy. Recommendation: update the Preflight Evidence Roots runbook to say the physical resolved root must remain inside the workspace, existing path components under `logs/` must not be symlinks/junctions/reparse points, and a detected link means remove/recreate a plain local directory before rerunning. Keep the instruction local-only and continue to require `node scripts/scan-lms-db-e2e-artifacts.mjs logs/<preflight-root>` before archive. Target part: `docs/DEPLOYMENT.md` and `.env.example`.

5. Severity: Low. Ignore and secret-scan policy is narrow and should stay explicit when preflight summaries are generated. Evidence: `.gitignore:12`-`15` ignores `dev-server.log`, `logs/preview-safe*.log`, and `logs/retained-visual-artifacts/`, while `.secretlintignore:12`-`14` ignores only `dev-server.log`, `.runtime`, and `logs/preview-safe*.log`; `package.json:17` runs `secretlint "**/*"`. Recommendation: do not add broad `logs/**` to `.secretlintignore`; preflight summaries must remain scan-visible before archive. If a future implementation decides summaries are local-only generated artifacts, add narrow `.gitignore` entries for the relevant `logs/*-preflight/summary-*.json` paths only, and document that ignore status is not evidence acceptance. Target part: `.gitignore`, `.secretlintignore`, and runbook text.

## Decisions
- Treat this as a read-only audit lane only. Implementation should be a separate local-only phase.
- Do not touch live servers, SSH, nginx, systemd, tmux, preview/prod databases, bot services, Stripe, Axioma, LMS object storage, or external scanner services for this slice.
- No background agents were spawned by this devops audit lane.
- Prefer a single shared helper hardening in `scripts/preflight-log-root.mjs` over per-script path checks.
- Preserve current operator-facing invariant: accepted overrides remain relative `logs/...` paths and printed summaries remain normalized relative `summary=logs/.../summary-*.json`.

## Risks
- Without a realpath and linked-ancestor check, a local `logs/...` symlink/junction can redirect summary evidence outside the workspace even though the env value looks repo-local.
- Symlink/junction tests can be platform-sensitive. Use Windows `junction` for directories to avoid admin-only symlink permissions where possible; if link creation is unavailable, report that focused symlink gate as NOT RUN rather than claiming hard confinement.
- Broadly ignoring `logs/**` would reduce accidental commits but could also hide summary artifacts from `npm run secret:scan`; keep any ignore change narrow and preserve scan visibility.

## Verification/tests
RUN:
- Read-only protocol/source inspection of required docs, preflight helper, five `*_PREFLIGHT_LOG_ROOT` scripts, ignore files, env template, and focused tests.
- `rg` search for `PREFLIGHT_LOG_ROOT` references across scripts/tests/docs/env.
- Read-only Windows reparse-point inspection of current `logs` root: current `logs` is a plain directory and no existing reparse points were listed under `logs`.

NOT RUN:
- `node --check` syntax gates, because this lane is audit-only and no implementation files were edited.
- `npm test -- tests/integration/preflight-log-root.test.ts tests/integration/preflight-log-root-wiring.test.ts`, because the symlink-hard tests do not exist yet and this lane may write only this handoff.
- Any preflight dry-run or live preflight command, because even dry-runs write summary files and this lane may write only this handoff.
- `npm run secret:scan`, `npm run governance:check`, `node scripts/gates.mjs full`, Playwright/e2e, preview, real-Postgres, LMS DB browser, append-only audit role, live provider acceptance, preview/prod DB rollout, SSH/nginx/systemd/server checks, GitHub CI, deploy, and production monitoring.

## Next actions
1. Implement locally in the shared helper: add workspace realpath anchoring, reject existing symlink/junction/reparse ancestors under the chosen root, verify the post-`mkdirSync` real root remains inside the workspace, write the summary through that verified root, and avoid overwriting any pre-existing summary path.
2. Add focused tests: normal repo-local write still passes; linked `logs/<test>/escape` to an outside temp directory refuses on Windows and Linux; no outside summary file is created; one process-level preflight caller refuses a linked root without printing `summary=`.
3. Update runbook text in `docs/DEPLOYMENT.md` and `.env.example` to include the physical realpath/no-link rule and scanner-before-archive rule. Keep this local-only; no live server, SSH, provider, preview/prod DB, or bot checks are needed for this phase.
4. Suggested implementation verification for the next lane: `node --check scripts/preflight-log-root.mjs`; `npm test -- tests/integration/preflight-log-root.test.ts tests/integration/preflight-log-root-wiring.test.ts`; focused existing preflight suites if helper wiring changes; `npm run secret:scan`; `npm run governance:check`; then report all live/server/provider gates as NOT RUN unless explicitly approved and actually observed.
