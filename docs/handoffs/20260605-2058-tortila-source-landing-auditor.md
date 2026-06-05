# tortila-source-landing-auditor handoff
## Scope
Phase 4.62 read-only canonical Tortila source landing discovery for `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Scope: inspect WTC repo references and bounded local sibling paths under `C:\Users\maxib\GTE BOT` for canonical git-backed Tortila / `bot_tortila` source evidence, especially whether the Phase 4.59 `JOURNAL_READ_TOKEN` patch is landed in a real repo or only in adjacent non-git source.

Boundaries honored: no live bot/journal execution, no endpoint curl, no provider/exchange probes, no SSH, no process control, no production DB/server mutation, and no raw secrets/DSNs/tokens read or printed. This is a single foreground auditor handoff; no N-agent audit is claimed. Desktop thread/agent discovery did not expose a callable background-agent tool in this interface.

## Files inspected
- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/INTEGRATION_MAP.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/handoffs/20260605-1730-phase-459-tortila-journal-auth-proof.md`
- `docs/handoffs/20260605-1730-tortila-journal-auth-boundary-auditor.md`
- `docs/handoffs/20260605-1810-tortila-canonical-source-auditor.md`
- `docs/handoffs/20260605-1810-production-deploy-readiness-auditor.md`
- `docs/handoffs/20260605-1810-final-gate-gap-auditor.md`
- `docs/handoffs/20260605-2005-production-boundary-auditor.md`
- `docs/handoffs/20260605-2005-release-merge-deploy-auditor.md`
- `docs/handoffs/20260605-2018-phase-461-main-merge-ci-truth.md`
- `docs/handoffs/20260605-2058-deploy-target-discovery-auditor.md` (pre-existing untracked handoff; read only)
- `scripts/run-tortila-real-read-managed.mjs`
- `packages/bot-adapters/src/http.ts`
- `apps/worker/src/index.ts`
- `C:\Users\maxib\GTE BOT\bot_tortila\AGENTS.md`
- `C:\Users\maxib\GTE BOT\bot_tortila\pyproject.toml`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\tests\test_journal.py`
- Immediate sibling directory inventory under `C:\Users\maxib\GTE BOT`
- Git metadata for `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`, `GTE_PRO`, `GTE_PROJECT`, `GTE_PROJECT — копия`, and `GTE_tv_parity`

## Files changed
- `docs/handoffs/20260605-2058-tortila-source-landing-auditor.md` only.

Pre-existing dirty/untracked file before this handoff write:
- `docs/handoffs/20260605-2058-deploy-target-discovery-auditor.md`

## Findings
1. Severity P0 - Canonical Tortila production source landing is not complete from available local evidence. Evidence: `docs/STATUS.md:21-29` says Phase 4.61 cleared GitHub CI but production deploy, production Tortila journal secret/firewall probes, and canonical Tortila source landing remain NOT RUN; `docs/NEXT_ACTIONS.md:74-85` keeps Tortila production auth/firewall/deploy NOT RUN and says it requires canonical bot repo/source landing; `docs/PRODUCTION_BLOCKERS_CURRENT.md:5-9` lists canonical Tortila source and production journal auth/firewall probes as remaining blockers. Recommendation: do not call the Tortila source landing complete until a git-backed canonical bot repo/path/remote/branch is identified and the patch is verified there. Target part: source-control and production-readiness gate.

2. Severity P0 - The Phase 4.59 `JOURNAL_READ_TOKEN` patch exists in the adjacent local `bot_tortila` source, but that directory is not git-backed. Evidence: `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py:100-115` reads `JOURNAL_READ_TOKEN`, accepts bearer or `x-journal-read-token`, and validates the supplied token; `app.py:339-343` applies JSON 401 middleware to `/api/*`; `C:\Users\maxib\GTE BOT\bot_tortila\tests\test_journal.py:160-178` tests missing, wrong, bearer, header, and `/api/marks` token behavior. But `git status --short --branch`, `git remote -v`, and `git rev-parse --show-toplevel` in `C:\Users\maxib\GTE BOT\bot_tortila` all returned "not a git repository". Recommendation: treat this as adjacent source proof only, not canonical landing. Target part: Tortila journal auth source.

3. Severity P0 - The bounded local sibling scan found git-backed repos, but not a git-backed Tortila / `turtle_bot` source repo. Evidence: top-level sibling inventory showed `.git` only in `GTE_PRO`, `GTE_PROJECT`, `GTE_PROJECT — копия`, `GTE_tv_parity`, and `wtc_ecosystem_platform`; tracked-file scans in the non-WTC git siblings for `tortila`, `turtle_bot`, `bot_tortila`, `src/turtle_bot/journal/app.py`, and `tests/test_journal.py` returned no matches. Git facts observed: WTC is `codex/phase-462-production-source-discovery` with remote `https://github.com/papa-slon/wtc.git`; `GTE_PRO` is `master`, no remote, 8034 dirty entries; `GTE_PROJECT` is `master`, no remote, 4 dirty entries; `GTE_PROJECT — копия` is `master`, no remote, 125 dirty entries; `GTE_tv_parity` is `tv-parity-roadmap`, no remote, 26 dirty entries. Recommendation: require operator-provided canonical Tortila repo/source bundle rather than inferring from these siblings. Target part: local source discovery.

4. Severity P0 - WTC references intentionally point to adjacent local `../bot_tortila` for proof harnesses, not to a canonical source-control target. Evidence: `docs/handoffs/0000-orchestrator-seed.md:25-28` names Tortila runtime `/home/ubuntu/apps/turtle_bingx`, journal service `:8080`, and local source `C:\Users\maxib\GTE BOT\bot_tortila`; `scripts/run-tortila-real-read-managed.mjs:94-109` resolves `TORTILA_REAL_READ_SOURCE_ROOT` or `../bot_tortila` and refuses when that local source root is absent; `scripts/run-tortila-real-read-managed.mjs:112-126` injects only a proof token for the local harness. Recommendation: for canonical verification, set `TORTILA_REAL_READ_SOURCE_ROOT` to the real git-backed Tortila checkout once supplied and rerun the managed proof there. Target part: WTC proof harness.

5. Severity P1 - WTC is wired to the token contract, but that wiring does not prove upstream Tortila source landing. Evidence: `packages/bot-adapters/src/http.ts:41-49` attaches bearer auth only when a token is configured and avoids logging the token; `http.ts:93-98` refuses unauthenticated journal reads; `http.ts:154-160` maps missing token to `not_configured`; `apps/worker/src/index.ts:314-317` passes `env.JOURNAL_READ_TOKEN` into the Tortila adapter. Recommendation: keep WTC adapter behavior as-is, but separate WTC client readiness from provider-source landing. Target part: WTC worker/adapter boundary.

6. Severity P1 - Recent WTC docs preserve the canonical-source blocker correctly after CI. Evidence: `docs/CONTRACTS/tortila-adapter.md:34-42` says Phase 4.59 proof is adjacent local source and still requires landing or confirming the middleware in canonical git-backed Tortila source; `docs/CONTRACTS/tortila-adapter.md:47-50` says the local token proof is not firewall/deploy proof; `docs/handoffs/20260605-2018-phase-461-main-merge-ci-truth.md:92-97` lists canonical git-backed Tortila source landing as NOT RUN. Recommendation: leave the blocker explicit until source-control proof exists. Target part: durable docs truth.

## Decisions
1. Verdict: **No** - canonical Tortila production source landing is not complete.
2. The Phase 4.59 `JOURNAL_READ_TOKEN` patch is proven in adjacent non-git source only: `C:\Users\maxib\GTE BOT\bot_tortila`.
3. No local git-backed canonical Tortila / `bot_tortila` repo was found under the bounded `C:\Users\maxib\GTE BOT` sibling scan.
4. WTC source and docs are ready to verify against a canonical checkout once provided, but WTC readiness is not provider-source landing.
5. Do not deploy or promote Tortila production read-only mode from this discovery alone.

## Risks
1. Treating the adjacent non-git `bot_tortila` folder as canonical would hide source-control drift and could ship unreviewed runtime source.
2. Treating green WTC CI or local managed proof as production source landing would skip the provider repo, secret provisioning, firewall/private-network proof, authorized probes, and deployment monitoring gates.
3. The local git-backed sibling repos are dirty and mostly remote-less; using them as implicit source authority would be unsafe without operator confirmation.
4. A future broad deploy/source phase can accidentally widen scope into live journal, process control, or provider/exchange probes unless those gates stay explicitly forbidden until approved.

## Verification/tests
RUN in this read-only auditor:
1. `git status --short --branch` in WTC - observed branch `codex/phase-462-production-source-discovery`; before this handoff write, the only dirty entry was pre-existing untracked `docs/handoffs/20260605-2058-deploy-target-discovery-auditor.md`.
2. `git remote -v` in WTC - observed `origin https://github.com/papa-slon/wtc.git` for fetch and push.
3. `git rev-parse --show-toplevel` in WTC - observed `C:/Users/maxib/GTE BOT/wtc_ecosystem_platform`.
4. `git status --short --branch`, `git remote -v`, and `git rev-parse --show-toplevel` in `C:\Users\maxib\GTE BOT\bot_tortila` - observed not a git repository.
5. Immediate sibling `.git` inventory under `C:\Users\maxib\GTE BOT` - observed git-backed siblings `GTE_PRO`, `GTE_PROJECT`, `GTE_PROJECT — копия`, `GTE_tv_parity`, and `wtc_ecosystem_platform`; `bot_tortila` has no `.git`.
6. Concise git metadata for git-backed siblings - observed the branch/remote/dirty facts recorded in Finding 3.
7. `rg` searches over WTC docs/handoffs/scripts/apps/packages for `Phase 4.59`, `JOURNAL_READ_TOKEN`, `canonical git-backed`, and `bot_tortila` - observed current docs preserve the adjacent-source/local-proof distinction.
8. `rg` searches over git-backed non-WTC siblings for `JOURNAL_READ_TOKEN`, `x-journal-read-token`, `journal read token required`, `turtle_bot.journal`, `tortila`, and `turtle_bot` - observed no tracked Tortila source match.
9. Line-numbered inspections of adjacent `bot_tortila` source/tests - observed token middleware and pytest coverage in the non-git source.

NOT RUN by design:
1. No live bot/journal process, endpoint curl, `/api/marks`, `/api/overview`, provider/exchange probe, SSH, systemd, tmux, process control, deploy command, or production DB command.
2. No pytest, npm, Playwright, lint, typecheck, build, or secret-scan gate; scope was source landing discovery, not code verification.
3. No raw `.env`, DSN, token, bearer value, cookie, exchange key, provider payload, or production row output.
4. No git mutation, commit, push, PR, merge, or workflow dispatch.
5. No canonical Tortila source verification, because no canonical git-backed Tortila source path/remote/branch/source bundle was available locally.

## Next actions
1. Operator must provide/open the canonical git-backed Tortila bot source path, remote, branch, or authoritative source bundle.
2. In that source, verify whether `src/turtle_bot/journal/app.py` and `tests/test_journal.py` contain the Phase 4.59 token middleware/tests.
3. If missing, land only the journal auth patch and tests in the canonical Tortila repo; avoid exchange clients, order managers, live-control paths, and runtime config beyond reviewed placeholders.
4. Run canonical bot-side pytest/ruff gates, then rerun WTC `npm run accept:tortila:real-read:managed` with `TORTILA_REAL_READ_SOURCE_ROOT` pointing at the canonical checkout.
5. Only after canonical source proof, run a separately approved production-auth/firewall/deploy phase with real secret provisioning, private-network/firewall proof, redacted positive/negative probes, monitoring, and explicit RUN/NOT RUN reporting.
