# Raw preview URL hygiene handoff
## Scope
This handoff closes the next local retained-evidence hygiene slice after the LMS DB wrapper-redaction phase. The phase did not touch SSH, nginx, systemd, preview/prod DBs, live server processes, bot services, Stripe, Axioma, LMS object stores/scanners, GitHub CI, or production monitoring. It only adjusted source/docs/tests/scanner behavior so raw preview/live access coordinates are not retained as repo-native defaults or generated artifact evidence.

## Files inspected
`apps/web/next.config.ts`, `.gitignore`, `.secretlintignore`, `scripts/scan-lms-db-e2e-artifacts.mjs`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`, `tests/integration/preview-url-hygiene.test.ts`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/INTEGRATION_MAP.md`, `docs/PROJECT_CHAT_HANDOFF_20260601.md`, `docs/NEXT_SESSION_PROMPT_FULL_PLATFORM_20260601.md`, `docs/OPEN_QUESTIONS.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`.

## Files changed
- `apps/web/next.config.ts`
- `.gitignore`
- `.secretlintignore`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/preview-url-hygiene.test.ts`
- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`
- `docs/INTEGRATION_MAP.md`
- `docs/PROJECT_CHAT_HANDOFF_20260601.md`
- `docs/NEXT_SESSION_PROMPT_FULL_PLATFORM_20260601.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/handoffs/20260602-1319-*.md`

## Findings
1. High. Raw preview coordinates are no longer hardcoded in `apps/web/next.config.ts`; dev allowed origins now come from `WTC_DEV_ALLOWED_ORIGINS`. Target part: source config hygiene.
2. High. Active durable docs no longer retain the old public raw IP, raw SSH target, demo password, or preview DB name; they use operator-only placeholders. Target part: durable docs hygiene.
3. Medium. The retained-artifact scanner now rejects raw public IPv4 URLs, public-IP SSH targets, preview/base URL assignments, raw app redirect URL fields, generic DB/admin URL or DSN assignments, and generic token/API-key assignments. Target part: generated artifact scanner.
4. Medium. Static regression coverage now guards selected active source docs/config against reintroducing the old raw preview host, SSH target, demo password, or preview DB name. Target part: recurrence prevention.
5. Medium. Local artifact ignore policy now excludes `.runtime/`, preview stdout logs, `dev-server.log`, and `.next-e2e` build outputs from accidental export/retention. Target part: generated artifact retention.
6. Medium. Screenshot OCR/manual review, child-process stdout redaction, and preflight log-root confinement remain follow-up hardening items, not Phase 3.52 acceptance claims. Target part: residual evidence boundaries.

## Decisions
Exact preview access coordinates belong in an operator-only note/env, not repo defaults. Public preview hygiene is local source/evidence hardening and is not live preview acceptance.

## Risks
Operators must supply `WTC_DEV_ALLOWED_ORIGINS` when a network dev origin is required. Scanner pass still does not prove screenshots are leak-free because image bytes are intentionally skipped.

## Verification/tests
RUN:
- `npm test -- tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/preview-url-hygiene.test.ts` PASS (`21` passed)
- active docs/config search for the old raw preview host, raw SSH target, demo password, and preview DB name PASS (no matches in active docs outside historical handoffs)
- `npm run governance:check` PASS (0 errors / 1 known historical warning; 4 cited per-agent handoffs all present)
- `npm run secret:scan` PASS
- `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift)
- `node scripts/gates.mjs full` PASS (9/9)

NOT RUN:
- live preview smoke
- SSH, nginx, systemd, tmux, or server process checks
- preview/prod DB migrate, seed, or permission probes
- active LMS DB browser acceptance
- active managed real-PG proof
- production/preview append-only audit DB-role proof
- production deploy, GitHub CI, production monitoring

Per-agent handoffs cited:
- [`docs/handoffs/20260602-1319-ecosystem-security-auditor.md`](20260602-1319-ecosystem-security-auditor.md)
- [`docs/handoffs/20260602-1319-ecosystem-devops-implementer.md`](20260602-1319-ecosystem-devops-implementer.md)
- [`docs/handoffs/20260602-1319-ecosystem-tests-runner.md`](20260602-1319-ecosystem-tests-runner.md)
- [`docs/handoffs/20260602-1319-ecosystem-platform-architect.md`](20260602-1319-ecosystem-platform-architect.md)

All current-phase agents were collected and closed before reporting.

## Next actions
1. If credentials are available, run the blocked operator acceptance gates: LMS DB managed, real-PG managed, or audit append-only role preflight.
2. If credentials remain unavailable, the next local evidence-safety slices are screenshot retention policy/OCR guardrail, child-process output redaction, or preflight log-root confinement.
