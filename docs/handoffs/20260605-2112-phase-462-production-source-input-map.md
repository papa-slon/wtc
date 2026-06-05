# Production/source input map handoff
## Scope
This phase maps the remaining production/source gates after the previous merged code and green GitHub CI. The phase answers
whether production deploy, canonical Tortila source landing, or Legacy realized analytics/import can proceed from local
repo evidence alone.

Agents launched before edits:
- [docs/handoffs/20260605-2058-deploy-target-discovery-auditor.md](20260605-2058-deploy-target-discovery-auditor.md)
- [docs/handoffs/20260605-2058-tortila-source-landing-auditor.md](20260605-2058-tortila-source-landing-auditor.md)
- [docs/handoffs/20260605-2058-legacy-source-proof-auditor.md](20260605-2058-legacy-source-proof-auditor.md)

Boundaries honored: no SSH, no systemd/tmux/process control, no production DB mutation, no deploy command, no live-host
curl, no live journal probe, no provider/exchange probe, no live bot start/stop/apply-config/test-connection, no
`/api/marks`, no `/api/overview`, and no raw secret/DSN/token/password output.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/DATA_MODEL.md`
- `docs/IMPLEMENTED_FILES.md`
- `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts`
- `apps/worker/src/legacy-live.ts`
- The three source/deploy handoffs linked above
- Bounded sibling source paths under `C:\Users\maxib\GTE BOT` named in the per-agent handoffs

## Files changed
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-2058-deploy-target-discovery-auditor.md`
- `docs/handoffs/20260605-2058-tortila-source-landing-auditor.md`
- `docs/handoffs/20260605-2058-legacy-source-proof-auditor.md`
- `docs/handoffs/20260605-2112-phase-462-production-source-input-map.md`

## Findings
1. Severity P0 - Production deploy cannot proceed from local repo evidence alone. Evidence: the deploy-target auditor found
   no current approved target packet: target host/domain/canary URL, exact release SHA, rollback target, DB migration/seed
   approval, secret provisioning method, service boundaries, firewall/proxy probe plan, smoke routes, and monitoring plan
   are absent. Recommendation: do not run deploy/SSH/production DB/server mutation until the operator supplies that packet.
   Target part: deploy entry gate.

2. Severity P0 - Canonical Tortila source landing is still not complete. Evidence: the Tortila auditor found the
   `JOURNAL_READ_TOKEN` middleware and tests in adjacent `C:\Users\maxib\GTE BOT\bot_tortila`, but that directory is not
   git-backed; the bounded sibling scan found no canonical git-backed Tortila repo carrying the patch. Recommendation:
   require a canonical repo/path/remote/branch or source bundle, then verify/land the patch there and rerun bot/WTC proofs.
   Target part: Tortila production source gate.

3. Severity P0 - Legacy realized analytics/import remains blocked by upstream source absence. Evidence: the Legacy auditor
   found WTC's destination contract ready, but no valid Legacy upstream table/API/artifact with stable trade/fill id,
   provider/pub_id scope, symbol, side, size, entry/exit, realized PnL, fees/funding, opened/closed timestamps, exit reason,
   replay semantics, and raw payload allowlist. Local Legacy-like sources expose orders, settings, stages, slots, and
   balance, not durable closed-trade economics. Recommendation: keep `blocked_no_source`; do not fabricate realized metrics.
   Target part: Legacy source-proof gate.

4. Severity P1 - The next non-looping work is input collection or a new explicitly approved gate, not more local bot UI
   polish. Evidence: an earlier source-proof phase warned not to continue local Legacy source-proof polish; this phase confirms
   deploy/source gates are external-input gated. Recommendation: continue only with target/source packets, branch policy,
   or a separately authorized live-control/security phase. Target part: operating plan.

## Decisions
1. Production deploy/canary remains NOT RUN until an approved target packet exists.
2. Canonical Tortila production source landing remains NOT RUN until a git-backed source authority is supplied and verified.
3. Legacy importer/realized analytics remains NOT RUN until a valid closed-trade source proof artifact exists.
4. This phase is an evidence map, not a goal completion claim and not a production deploy.

## Risks
1. Treating GitHub CI as production proof would skip server, DB, secret, firewall, proxy, and monitoring gates.
2. Treating adjacent non-git Tortila source as canonical would hide provider-source drift.
3. Deriving Legacy realized analytics from active orders/slots or FILLED handling would create fabricated statistics.
4. Continuing UI/static polish without new inputs would repeat the loop the user explicitly asked us to detect.

## Verification/tests
RUN:
1. `gh run view 27018621559 --json status,conclusion,updatedAt,url,jobs` - observed `main` CI success after PR #2 merge:
   `gates=success`, `e2e=success`, including `Typecheck @wtc/worker`.
2. `git status --short --branch` - observed branch `codex/phase-462-production-source-discovery`; before aggregate edits,
   only the three source/deploy handoffs were untracked.
3. Bounded sibling `.git` inventory under `C:\Users\maxib\GTE BOT` - confirmed `bot_tortila` is not git-backed.
4. Legacy candidate inspection - confirmed local Legacy-like source models expose `Order` and `Slot`, not a closed-trade
   ledger; no Legacy DB/CSV artifact beyond seed JSON was found in `bot` and `trading-bot-server`.
5. The three source/deploy agents were closed after their handoffs were collected. Closed IDs:
   `019e9812-f752-7d50-b408-4a158a846437`, `019e9813-5cac-7e22-a426-e70748022ce5`,
   `019e9813-b263-7191-8617-cc31589a5487`.

NOT RUN:
1. Production DB migration/seed, production deploy, canary switch, nginx/TLS/firewall checks, and monitoring burn-in.
2. Production Tortila journal secret provisioning and authorized positive/negative network probes.
3. Canonical git-backed Tortila source verification, because no canonical source path/remote/branch was available.
4. Legacy closed-trade mapper/import implementation, because no valid upstream source exists.
5. Live bot controls, exchange/provider probes, test-connection, `/api/marks`, and `/api/overview`.

## Next actions
1. If deployment is next, supply the deploy target packet listed in `docs/NEXT_ACTIONS.md` and run a separate approved
   deploy/canary phase.
2. If Tortila production read-only is next, supply/open the canonical git-backed Tortila repo/source bundle and verify the
   token middleware/tests there.
3. If Legacy analytics is next, supply a closed-trade source artifact/API/table contract with all required replay/economics
   fields before mapper work.
