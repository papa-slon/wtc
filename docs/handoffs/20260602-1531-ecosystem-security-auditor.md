# ecosystem-security-auditor handoff
## Scope
Read-only security audit for Phase 3.56 safe-preview retained-output policy. Scope covered long-running `safe-preview` stdout/stderr, local preview logs, retained evidence boundaries, secret leakage risks, preview URL exposure, DB URL/auth token/cookie/provider value exposure, and whether the upcoming implementation should refuse or redact. No live server, preview start, SSH, nginx, systemd, DB mutation, bot service, provider call, test run, or product-code edit was performed.

## Files inspected
`AGENTS.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/SESSION_PROTOCOL.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, `docs/DEPLOYMENT.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/ARCHITECTURE.md`, `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_55_20260602.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `package.json`, `.gitignore`, `.secretlintignore`, `.env.example`, `.github/workflows/ci.yml`, `apps/web/next.config.ts`, `apps/web/src/features/billing/checkout.ts`, `scripts/safe-preview.mjs`, `scripts/redacted-child-process.mjs`, `scripts/gates.mjs`, `scripts/safe-worker-tick.mjs`, `scripts/scan-lms-db-e2e-artifacts.mjs`, `scripts/check-retained-visual-artifacts.mjs`, `scripts/run-lms-db-e2e.mjs`, `scripts/billing-stripe-checkout-preflight.mjs`, `tests/integration/child-output-redaction.test.ts`, `tests/integration/db-seed-preview-hardening.test.ts`, `tests/integration/retained-visual-artifacts.test.ts`, `tests/integration/preview-url-hygiene.test.ts`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`, and current `logs/preview-safe*.log`.

## Files changed
None — read-only audit except this handoff file: `docs/handoffs/20260602-1531-ecosystem-security-auditor.md`.

## Findings
1. Severity: High. Raw long-running preview output can be retained without redaction. Evidence: `scripts/safe-preview.mjs:20`-`24` spawns Next with the full inherited env plus forced flags and `stdio: 'inherit'`; `redacted-child-process.mjs:6`-`25` lists the sensitive classes already treated as retained-output risks; `AGENTS.md:76`-`78` forbids plaintext secrets in logs/responses/screenshots. Recommendation: Phase 3.56 should remove raw inherited output from any retained `safe-preview` path; redact the stream before terminal/log retention and refuse explicit raw archive/tee mode. Target part: `scripts/safe-preview.mjs` retained stdout/stderr handling.
2. Severity: High. Existing preview log files prove the advisory "do not archive" boundary is already porous, and these logs are excluded from normal secret scans. Evidence: `logs/preview-safe.out.log:2`-`7` contains retained raw Next startup output, `.gitignore:14` ignores `logs/preview-safe*.log`, `.secretlintignore:14` also excludes it, and `docs/DEPLOYMENT.md:337`-`339` says raw `preview:safe` stdout/stderr must not be archived. Recommendation: the implementation should either own redacted log creation under a bounded `logs/...` path or refuse non-TTY/raw redirected output; any retained preview log must pass the text artifact scanner before archive. Target part: preview log retention/archival boundary.
3. Severity: Medium. Preview coordinates are operator-only but currently printable in retained output. Evidence: `scripts/safe-preview.mjs:20` binds `--hostname 0.0.0.0`, `logs/preview-safe.out.log:5`-`7` records the Next local/network URL lines, `docs/ARCHITECTURE.md:377` labels the public preview URL as operator-only, and `apps/web/next.config.ts:3`-`9` makes dev origins operator-configured through `WTC_DEV_ALLOWED_ORIGINS`. Recommendation: redact raw public-IP preview URLs, preview/base URL assignments, and configured dev origins from retained preview output; keep the retained summary at "safe preview started" plus local/relative evidence, not public coordinates. Target part: preview URL redaction policy.
4. Severity: Medium. Safe preview forces bot/TV safety flags but does not clear or classify provider/credential env values that can appear in errors or request diagnostics. Evidence: `scripts/safe-preview.mjs:10`-`15` forces only `APP_ENV`, `BOT_ADAPTER_MODE`, `FEATURE_LIVE_BOT_CONTROL`, and `FEATURE_TV_AUTOMATION`; `apps/web/src/features/billing/checkout.ts:41`-`48` and `apps/web/src/features/billing/checkout.ts:83`-`99` consume `BILLING_PROVIDER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `APP_BASE_URL`; `.env.example:112`-`121` documents provider values; `scripts/billing-stripe-checkout-preflight.mjs:77`-`78` refuses live Stripe keys in the preflight path, but `safe-preview.mjs` has no analogous retained-output guard. Recommendation: for retained preview evidence, redact test provider values and refuse live-key-shaped env values unless an explicit operator override is added and recorded without values. Target part: safe-preview env/provider startup policy.
5. Severity: Medium. The existing redaction helper is one-shot and buffered, not safe to apply directly to a long-running dev server. Evidence: `redacted-child-process.mjs:49`-`59` uses `spawnSync` with buffered stdout/stderr, while `scripts/safe-preview.mjs:20` uses long-running `spawn`. Recommendation: implement a streaming redactor for `safe-preview` using `spawn` plus stdout/stderr transforms and chunk-boundary carryover; do not convert the preview server to `spawnSync` or buffer unbounded output. Target part: script-local redaction helper / preview process wrapper.
6. Severity: Medium. Regression coverage does not yet protect the `safe-preview` retained-output policy. Evidence: `tests/integration/db-seed-preview-hardening.test.ts:45`-`60` checks forced flags, direct Next spawn, bind host, port, and `shell:false` only; `tests/integration/child-output-redaction.test.ts:106`-`120` guards gates and worker smoke but not `safe-preview`; Phase 3.54 recorded long-running safe-preview stream redaction as NOT RUN at `docs/handoffs/20260602-1357-phase-3-54-child-output-redaction.md:64`-`65`. Recommendation: add tests that fail on raw `stdio: 'inherit'` in retained mode, prove a fixture preview child redacts DB URLs, cookies, auth headers, provider tokens, preview URLs, and split-across-chunk tokens, and prove unsafe log roots/raw archive attempts are refused. Target part: integration tests and static wiring guards.

## Decisions
- Prefer redaction for normal long-running preview output because operators still need live startup/error diagnostics; refuse only raw archival/redirected retained-output modes or live-key-shaped provider env in retained evidence mode.
- Keep this as script-local tooling plus docs/tests. No new `@wtc/*` runtime package is justified for a developer preview wrapper.
- Do not weaken the existing safety profile: `APP_ENV=development`, mock bot adapters, live bot control off, and TV automation off remain required.
- Do not treat `secret:scan`, visual evidence inventory, or ignored generated logs as proof that preview logs are archive-safe.

## Risks
- Current `logs/preview-safe*.log` contents inspected here did not show secrets, but they are raw retained output and are excluded from `secret:scan`.
- Future Next/plugin/runtime errors may print env-shaped values, headers, cookies, provider diagnostics, or preview URLs; this was not exercised because the lane is read-only and did not start preview.
- Regex-only stream redaction can miss values split across chunks unless the implementation preserves a carryover window.
- Refusing all non-TTY output would be safer but may interrupt legitimate automation; a redacted explicit log mode is the lower-friction control.

## Verification/tests
RUN:
- Read-only source/doc/test inspection only.
- `git status --short` attempted and returned "not a git repository".
- Confirmed target handoff path did not exist before writing.
- Inspected current `logs/preview-safe.out.log` and `logs/preview-safe.err.log` without reproducing any sensitive values.

NOT RUN:
- `npm run preview:safe`
- `npm run dev`
- `npm run e2e`
- `node scripts/gates.mjs full`
- `npm run secret:scan`
- `npm run evidence:visual`
- live preview smoke
- LMS DB managed/browser acceptance
- active real-Postgres proof
- append-only audit role proof
- SSH, nginx, systemd, tmux, server process checks
- Stripe/Axioma/LMS provider calls
- production deploy, GitHub CI, production monitoring

## Next actions
1. Add a streaming safe-preview redaction path and remove/refuse raw retained stdout/stderr archive behavior.
2. Add a confined redacted log mode under `logs/...` with bounded retention, no raw append to `logs/preview-safe*.log`, and scanner-clean retained evidence before archive.
3. Add focused regression tests for safe-preview stream redaction, provider/env refusal, unsafe log roots, split-token chunking, and no raw `stdio: 'inherit'` in retained mode.
4. Update deployment/status/implemented-files docs in the implementation phase to distinguish transient interactive preview from reviewed retained evidence.
