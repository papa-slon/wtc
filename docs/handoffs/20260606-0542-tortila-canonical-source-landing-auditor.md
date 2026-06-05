# tortila-canonical-source-landing-auditor handoff
## Scope
Read-only Phase 4.70 audit of whether adjacent `bot_tortila` could safely become the canonical Tortila source packet for WTC. The audit inspected WTC verifier requirements, prior Phase 4.69 handoffs/docs, adjacent Tortila source shape, ignore rules, token middleware/tests, and secret/artifact risk. No files were edited by the agent, no service was restarted, no live DB/runtime was mutated, no exchange endpoint was called, and no secret values were printed.

## Files inspected
- `scripts/tortila-canonical-source-verifier.mjs`
- `scripts/run-tortila-real-read-managed.mjs`
- `docs/handoffs/20260606-0440-phase-469-tortila-canonical-source-verifier.md`
- `docs/handoffs/20260606-0440-tortila-source-perimeter-auditor.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- Adjacent `bot_tortila/.gitignore`
- Adjacent `bot_tortila/pyproject.toml`
- Adjacent `bot_tortila/src/turtle_bot/journal/app.py`
- Adjacent `bot_tortila/tests/test_journal.py`
- Redacted adjacent source inventory only.

## Files changed
None — read-only audit

## Findings
1. Severity: P0. Adjacent `bot_tortila` was not canonical because it was not git-backed and therefore failed the WTC verifier by design. Evidence: `scripts/tortila-canonical-source-verifier.mjs` requires git repository root, full HEAD, named branch, at least one remote, clean status, required files, middleware, and tests. Recommendation: do not accept adjacent working folder as source authority. Target part: Tortila source-control gate.
2. Severity: High. The adjacent local source did contain the journal read-token patch and native tests needed as seed material. Evidence: `src/turtle_bot/journal/app.py` reads `JOURNAL_READ_TOKEN`, supports bearer/header token parsing, uses constant-time compare, and guards `/api/*`; `tests/test_journal.py` covers missing/wrong/good bearer/header and `/api/marks` rejection. Recommendation: preserve those files in a clean source packet. Target part: Tortila journal auth boundary.
3. Severity: High. Direct in-place `git init` in `bot_tortila` was unsafe. Evidence: root inventory contained `.env`, sqlite runtime files, logs, caches, memory, `_audit`, `_old_bot_source`, `.claude`, and `.codex`; existing ignore rules did not fence every sidecar/artifact class. Recommendation: create a separate clean export with an explicit include list and hardened ignore rules. Target part: source hygiene.
4. Severity: P0. Server runtime should not be used as source truth. Evidence: Phase 4.69 server audit found runtime source not git-backed and lacking the local token middleware/tests. Recommendation: source packet first, runtime deploy/auth/firewall proof later. Target part: runtime/source separation.

## Decisions
- Treat adjacent `bot_tortila` as patched seed material, not source authority.
- Use a separate clean source export/new repo.
- Exclude runtime envs, DB/WAL/SHM files, logs, caches, local agent memory, old-source dumps, audit scratch files, market data downloads, and result artifacts.
- Keep server runtime out of this phase.

## Risks
- A careless in-place `git add -A` could capture runtime artifacts.
- Passing the verifier proves source packet shape, not production deployment, token provisioning, or firewall posture.
- Local source and server runtime still drift until a separate deployment phase.

## Verification/tests
RUN:
1. Read-only adjacent git check confirmed non-git source.
2. Read-only verifier/doc/source/test inspection.
3. Redacted inventory review.

NOT RUN:
1. Server endpoint probes, exchange calls, SQLite reads, service restarts, deploy, live DB/runtime mutation.
2. Secret-value inspection or printing.

## Next actions
1. Create a clean source export/new repo.
2. Run bot-side pytest/ruff in that export.
3. Add a remote, commit, and verify clean branch/HEAD.
4. Run WTC `npm run verify:tortila:canonical-source`.
5. Run strict WTC managed proof only with a disposable Postgres admin URL.
