# Next Session Prompt After Phase 3.55

Open this folder first:

`C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`

This is a NEW session after Phase 3.55. Do not start from chat memory. Re-establish ground truth from the repo and current command output.

## Read First

Read these files before planning edits:

- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- latest phase handoff in `docs/handoffs/` (currently `docs/handoffs/20260602-1444-phase-3-55-retained-visual-artifact-policy.md`)
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`

Verify whether this folder is git-backed:

```powershell
git rev-parse --show-toplevel
```

Expected current truth: this folder has not been git-backed in recent sessions. Do not claim commits, branches, PRs, GitHub CI, or merge readiness unless this command proves that changed.

## Session Protocol

- Name exactly one phase at session start.
- Each new phase is a NEW session. Do not run two phases in one session.
- For a broad/major phase, launch read-only agents before any code or docs edit.
- If agent tooling is unavailable for a broad/major phase, stop and report BLOCKED rather than doing the phase solo.
- Every claimed agent must write one handoff at `docs/handoffs/<YYYYMMDD-HHMM>-<agent>.md`.
- The operator aggregate handoff must cite every per-agent handoff by path.
- Close all agents before the final report.
- Final report and aggregate handoff must list exact gates RUN and exact gates NOT RUN with reasons.

## Required Read-Only Agents Before Edits

Use these agents for the next broad/major phase:

- `ecosystem-security-auditor`
- `ecosystem-tests-runner`
- `ecosystem-devops-implementer`
- `ecosystem-platform-architect`

Add narrower domain agents only if the selected phase actually needs them.

## Choose The Next Phase

First check whether operator credentials are available in the environment or have been explicitly provided for this session. Do not print or archive credential values.

If credentials are available, prioritize the blocked real acceptance path that matches the supplied credential:

1. LMS DB managed acceptance:

```powershell
npm run e2e:lms:db:managed
```

Requires `LMS_E2E_ADMIN_DATABASE_URL` pointing at an operator-approved non-throwaway maintenance DB. The runner creates and drops a fresh `wtc_test_lms_*` database.

2. Real-Postgres managed proof:

```powershell
npm run accept:real-pg:managed
```

Requires `REAL_POSTGRES_ADMIN_DATABASE_URL` pointing at an operator-approved non-throwaway maintenance DB. The runner creates and drops a fresh `wtc_test_realpg*` database.

3. Audit append-only role proof:

```powershell
npm run accept:audit:append-only-role
```

Requires the restricted `wtc_app_role` / append-only acceptance URL documented by the current preflight script and deployment docs.

If credentials are not available, choose one bounded local safety slice:

- long-running `safe-preview` retained-output policy
- symlink-hard preflight root confinement

If retained screenshots/images are needed for evidence, do not archive them after text scanning alone. Use the Phase 3.55 visual evidence command with an explicit manifest:

```powershell
npm run evidence:visual -- --inventory tests/e2e/screenshots
npm run evidence:visual -- --manifest logs/retained-visual-artifacts/<run-id>/visual-review.json tests/e2e/screenshots
```

Inventory is not acceptance. Without a manifest, screenshot review/OCR remains NOT RUN.

## Current Evidence From Phase 3.55

Phase 3.55 is locally landed and verified:

- `scripts/check-retained-visual-artifacts.mjs` added a separate retained screenshot/image evidence gate.
- `npm run evidence:visual -- --inventory ...` counts retained images only and is not acceptance.
- `npm run evidence:visual -- --manifest ...` fails closed unless every retained image in the supplied roots has passing manual/OCR review metadata.
- OCR sidecar text is scanned for DB URLs, auth/cookie tokens, signed URL tokens, raw public-IP URLs, provider tokens, LMS internal metadata, and dynamic marker values without printing matched values.
- Staged CI no longer uploads raw `tests/e2e/screenshots/**` directly; it inventories visual artifacts, validates any reviewed visual-evidence manifest upload candidate, and uploads only matching manifest files.
- Existing screenshots were inventoried, not reviewed: no retained screenshot acceptance manifest was run.

Observed gates:

```powershell
node --check scripts/check-retained-visual-artifacts.mjs
node --check scripts/run-lms-db-e2e.mjs
npx vitest run tests/integration/retained-visual-artifacts.test.ts
npm run evidence:visual -- --inventory tests/e2e/screenshots
npm run secret:scan
node scripts/gates.mjs full
node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates
npm run governance:check
```

All were PASS in the Phase 3.55 closeout. The no-manifest visual acceptance command was also checked and refused as expected:

```powershell
npm run evidence:visual -- tests/e2e/screenshots
```

It failed with `review manifest required for 68 image file(s)`, which is the intended fail-closed behavior.

## Forbidden Unless Explicitly Scoped

- live bot start/stop/apply-config
- production deploy
- SSH/nginx/systemd mutation
- preview/prod DB migration or seed
- live Stripe/Axioma/LMS provider calls without operator credentials
- plaintext secrets in docs, logs, DB, fixtures, screenshots, or responses
- one-file prototype architecture
- fake integration claim
- two phases in one session

## Stop Conditions

Stop and write a handoff if:

- credentials are required but unavailable
- the selected phase grows beyond one bounded phase
- quality degrades or context is insufficient
- agent tooling is unavailable for a broad/major phase
- a serious runtime blocker appears

Before final report:

- close all agents
- write per-agent handoffs and aggregate handoff
- update `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and `docs/IMPLEMENTED_FILES.md`
- list gates RUN and NOT RUN
- do not claim production readiness unless the relevant live gates were actually observed green in this session
