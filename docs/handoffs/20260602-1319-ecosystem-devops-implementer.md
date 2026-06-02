# ecosystem-devops-implementer handoff
## Scope
Phase 3.52 read-only audit of operator/deploy evidence hygiene for preview/live URLs, runtime logs, ignored generated artifacts, and preview command retention behavior.

## Files inspected
`.env.example`, `.gitignore`, `.secretlintignore`, `package.json`, `docker-compose.yml`, `README.md`, `docs/DEPLOYMENT.md`, `docs/ARCHITECTURE.md`, `docs/PROJECT_CHAT_HANDOFF_20260601.md`, `docs/NEXT_SESSION_PROMPT_FULL_PLATFORM_20260601.md`, `docs/INTEGRATION_MAP.md`, `scripts/safe-preview.mjs`, `scripts/gates.mjs`, `scripts/scan-lms-db-e2e-artifacts.mjs`, `dev-server.log`, `logs/preview-safe.out.log`, `.runtime/*.log`, `logs/gates/test.log`, `logs/gates/summary.txt`, `apps/web/.next-e2e`.

## Files changed
None - read-only audit.

## Findings
1. High. Durable docs retained raw preview host/access evidence, SSH command details, and demo-password material. Recommendation: replace with placeholders such as `<raw-preview-url>`, `<ssh-command-from-operator-vault>`, and `<demo-password-from-local-seed-or-operator-note>`. Target part: preview/deploy docs and cold-start prompts.
2. Medium. Runtime preview logs retain network URLs and were not explicitly ignored. Recommendation: ignore `.runtime/`, `dev-server.log`, and preview stdout logs, and archive only redacted summaries. Target part: runtime artifact retention.
3. High. Generated `.next-e2e` artifacts existed outside scanner defaults and contained credential-like demo material. Recommendation: ignore/delete `.next-e2e` and `.next-e2e-db` after browser runs unless a scanner explicitly covers them. Target part: generated browser/build artifacts.
4. Medium. Scanner did not cover general preview URL hygiene: raw IPv4 URLs, SSH targets, key paths, or Next `Network:` lines. Recommendation: extend artifact scanner or add deploy-evidence scanner for preview artifacts. Target part: deploy evidence scanner coverage.
5. Medium. `preview:safe` binds all interfaces and inherits unfiltered Next stdout. Recommendation: keep network preview operator-approved and do not retain raw stdout without redaction. Target part: preview command safety.

## Decisions
Treat demo passwords as credential-like evidence even when demo-only. Treat docs and handoffs as durable artifacts likely to be copied into future sessions.

## Risks
Ignore rules are hygiene/export controls because this workspace is not currently git-backed. Screenshots and generated build files can carry sensitive context even when text scanners pass.

## Verification/tests
No gates run by this auditor. Static inspection only.

## Next actions
1. Redact raw preview URL, SSH command/key path, demo password, and preview DB name from durable docs.
2. Add ignore policy for `.runtime/`, preview logs, `dev-server.log`, `.next-e2e/`, and `.next-e2e-db/`.
3. Add deploy-evidence scanner coverage for raw preview URLs/access details.
