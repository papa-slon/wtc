# Phase 4.37 managed env and visual evidence
## Scope
Close the remaining local visual-evidence acceptance gap and re-audit the managed worker/admin DB gates without printing or inventing credentials.

This phase did not change production bot, worker, database, adapter, live-control, RBAC, entitlement, audit, or deployment behavior. It generated review evidence and updated status docs.

## Background lanes
- [ecosystem-devops-implementer](20260604-2055-managed-env-gates-auditor.md)
- [ecosystem-tests-runner](20260604-2055-visual-evidence-manifest-auditor.md)

All background work was collected. Agents `019e92e3-c970-7581-a8cd-81935baba571` and `019e92e4-1c2c-72a0-951c-a888e003fc08` were closed before this aggregate report.

## Files inspected
- `package.json`
- `scripts/check-retained-visual-artifacts.mjs`
- `scripts/run-worker-continuity-managed.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/safe-worker-tick.mjs`
- `tests/e2e/screenshots`
- `logs/retained-visual-artifacts/20260602-1713-lms-db/visual-review.json`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260604-2055-managed-env-gates-auditor.md`
- `docs/handoffs/20260604-2055-visual-evidence-manifest-auditor.md`

## Files changed
- `logs/visual-review-contact-sheets/20260604-2055-bot-admin-local/contact-sheet-01.png`
- `logs/visual-review-contact-sheets/20260604-2055-bot-admin-local/contact-sheet-02.png`
- `logs/visual-review-contact-sheets/20260604-2055-bot-admin-local/contact-sheet-03.png`
- `logs/visual-review-contact-sheets/20260604-2055-bot-admin-local/contact-sheet-04.png`
- `logs/visual-review-contact-sheets/20260604-2055-bot-admin-local/contact-sheet-05.png`
- `logs/visual-review-contact-sheets/20260604-2055-bot-admin-local/contact-sheet-06.png`
- `logs/visual-review-contact-sheets/20260604-2055-bot-admin-local/contact-sheet-07.png`
- `logs/visual-review-contact-sheets/20260604-2055-bot-admin-local/contact-sheet-08.png`
- `logs/visual-review-contact-sheets/20260604-2055-bot-admin-local/contact-sheet-09.png`
- `logs/retained-visual-artifacts/20260604-2055-bot-admin-local/visual-review.json`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260604-2055-managed-env-gates-auditor.md`
- `docs/handoffs/20260604-2055-visual-evidence-manifest-auditor.md`
- `docs/handoffs/20260604-2055-phase-4-37-managed-env-visual-evidence.md`

## Findings
1. Severity: High. The formal visual acceptance gap is now closed for the current retained screenshot root. Evidence: nine contact sheets were generated and manually reviewed, `visual-review.json` covers every scanned image, and the manifest-backed evidence gate passed with `107` image files and `107` reviewed artifacts. Recommendation: keep visual manifest acceptance separate from Playwright e2e pass counts and inventory-only checks.
2. Severity: High. The managed worker continuity gate remains blocked by missing `WORKER_CONTINUITY_ADMIN_DATABASE_URL`, not by a failed continuity run. Evidence: current env-key check reported the key not set and the managed runner requires an admin maintenance Postgres URL capable of creating/dropping a throwaway DB. Recommendation: do not mark worker continuity green until the managed run observes `worker_status=ok`, `bot_continuity=ok`, `tortila=ok`, and `legacy=ok`.
3. Severity: High. The admin selected-user DB browser matrix remains blocked by missing `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, not by a failed browser run. Evidence: current env-key check reported the key not set and the matrix runner creates/drops throwaway DBs per runtime scenario. Recommendation: run only with an approved maintenance URL and review produced screenshots/traces before retaining them.
4. Severity: Medium. Status docs previously listed formal visual manifest as not green; that is now stale after this phase. Recommendation: keep `STATUS.md`, `NEXT_ACTIONS.md`, and `IMPLEMENTED_FILES.md` aligned with the observed Phase 4.35-4.37 gates.

## Decisions
- Generated contact sheets from the current `tests/e2e/screenshots` images and reviewed them manually for visible secrets, DSNs, auth/session/cookie/header strings, raw public IP URLs, signed object URL tokens, LMS internal metadata, Stripe/provider tokens, visible layout blockers, and live-control enablement.
- Generated `logs/retained-visual-artifacts/20260604-2055-bot-admin-local/visual-review.json` only after contact-sheet review.
- Validated the manifest against the full screenshot root.
- Did not run managed worker continuity or admin selected-user DB matrix because their required admin DB URLs are absent.
- Updated docs to remove formal visual manifest from the not-green list and keep the managed/env/source/safety blockers explicit.

## Risks
- Manual contact-sheet review is not OCR proof. It is accepted by the current retained-visual policy, but OCR can be added later if stricter review evidence is required.
- `logs/` is ignored; the generated manifest/contact sheets must be archived or attached if this evidence package needs to survive outside the working tree.
- The managed DB gates create/drop throwaway Postgres databases. They must not be run with raw production URLs, echoed DSNs, or unreviewed retained artifacts.
- Legacy closed-trade statistics remain source-blocked; this phase does not prove a durable Legacy closed-trade/fill source.

## Verification/tests
RUN in this phase:
- Current env-key check for `WORKER_CONTINUITY_ADMIN_DATABASE_URL`, `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, `DATABASE_URL`, and `LEGACY_DATABASE_URL` - all NOT_SET in the current process; values were not printed.
- `npx vitest run tests/integration/worker-continuity-acceptance-runner.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` - PASS in the managed-env auditor lane, 2 files, 10 tests.
- `npm run evidence:visual -- --manifest logs/retained-visual-artifacts/20260604-2055-bot-admin-local/visual-review.json tests/e2e/screenshots` - PASS, 107 image files, 107 reviewed artifacts, 0 OCR sidecars, 0 dynamic markers.
- `npm run secret:scan` - PASS after visual manifest generation.
- `git diff --check` - PASS after visual manifest generation.
- `npm run ci:local` - PASS after this aggregate/status-doc update; included `check:core`, governance, lint, root typecheck, web typecheck, worker typecheck, secret scan, root `npm test`, and `npm run build -w @wtc/web`.

NOT RUN in this phase:
- `npm run accept:worker:continuity:managed` - not run because `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is not supplied.
- `npm run e2e:admin-user-bots:db:managed:matrix` - not run because `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is not supplied.
- Live exchange ping, live bot start/stop/apply-config, live provider/exchange probes, deploy, GitHub CI, SSH/tmux/systemd, and production monitoring - not run.

## Next actions
1. Re-run `npm run governance:check` after this aggregate file is present.
2. If an approved maintenance Postgres URL is supplied, run exactly one managed gate at a time:
   - `npm run accept:worker:continuity:managed`
   - `npm run e2e:admin-user-bots:db:managed:matrix`
3. Do not implement Legacy closed-trade import until a source-proof artifact names the durable closed-trade/fill source and replay contract.
4. If the current dirty local tree is to be published, run a separate git/CI/deploy phase with staging, commit/PR or canary deploy proof, and post-deploy browser/runtime smoke.
