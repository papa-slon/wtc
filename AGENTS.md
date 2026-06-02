# AGENTS.md — WTC Ecosystem Platform

This repository is built by a multi-agent engineering team. Agent definitions live in
`.claude/agents/`. The binding roster source is `WTC_ECOSYSTEM_AGENT_ROSTER.md` (in
`../bot_tortila`). Canonical build decisions live in `docs/handoffs/0000-orchestrator-seed.md`.

## Roster

| Agent | Role | Writes |
|-------|------|--------|
| `ecosystem-task-router` | classify + route requests, name risk gates | (advisory) |
| `ecosystem-product-architect` | product model, MVP, sitemap | PRODUCT_BRIEF, SITEMAP, MVP_SCOPE, OPEN_QUESTIONS |
| `ecosystem-platform-architect` | system boundaries, monorepo, API map | ARCHITECTURE, INTEGRATION_MAP, ADRs |
| `ecosystem-ux-ui-designer` | premium terminal-first UX, design system | DESIGN_SYSTEM |
| `ecosystem-frontend-implementer` | `apps/web` UI only | web routes/components |
| `ecosystem-backend-implementer` | auth/domain/APIs/audit | `packages/*` + route handlers |
| `ecosystem-db-architect` | schema + migrations | DOMAIN_MODEL, DATA_MODEL, `packages/db` |
| `ecosystem-bot-integration-auditor` | read-only bot audit + adapters | BOT_INTEGRATION_PLAN, BOT_CONTROL_SAFETY_MODEL, CANONICAL_ANALYTICS_MODEL, CONTRACTS/{tortila,legacy} |
| `ecosystem-axioma-bridge-auditor` | read-only Axioma audit + bridge | CONTRACTS/axioma-bridge |
| `ecosystem-security-auditor` | auth/RBAC/secrets/audit/SSO tokens | SECURITY_MODEL, RBAC_MATRIX, SECRET_VAULT_DESIGN, AUDIT_LOG_SCHEMA, AXIOMA_HANDOFF_TOKEN_SPEC |
| `ecosystem-billing-access-auditor` | entitlements/billing/webhooks | ENTITLEMENT_STATE_MACHINE, BILLING_PROVIDER_PLAN, PAYMENT_WEBHOOK_STATE_MACHINE, CONTRACTS/billing-webhooks |
| `ecosystem-education-implementer` | LMS | EDUCATION_LMS_PLAN, `packages/lms` |
| `ecosystem-tradingview-access-implementer` | TV access queue | TRADINGVIEW_ACCESS_PLAN, CONTRACTS/tradingview-access, `packages/tradingview-access` |
| `ecosystem-backtester-architect` | backtester distribution | BACKTESTER_DISTRIBUTION_PLAN, CONTRACTS/backtester-runner, `packages/backtester` |
| `ecosystem-tests-runner` | lint/typecheck/test/Playwright | test reports |
| `ecosystem-devops-implementer` | docker/env/deploy | docker-compose, .env.example, DEPLOYMENT |

## Standard dispatch

```
task-router → product-architect → platform-architect → ux-ui-designer
  → backend/frontend implementers → relevant auditors → tests-runner → devops
```

For broad phases, run read-only auditors in parallel; split implementation by disjoint write
scopes. Every agent writes a handoff `docs/handoffs/<YYYYMMDD-HHMM>-<agent>.md`.

## Session & phase protocol (Phase 1.5+)

Full protocol: [`docs/SESSION_PROTOCOL.md`](docs/SESSION_PROTOCOL.md). Binding rules:

1. A broad/major phase MUST launch its background read-only agents BEFORE any edit to code or docs.
   No edits until the audit agents are dispatched. If agent tooling is unavailable, STOP and report
   BLOCKED — do not do a broad phase solo.
2. No "N-agent audit" claim may be made unless N per-agent handoff files actually exist at
   `docs/handoffs/<YYYYMMDD-HHMM>-<agent>.md`, one per claimed agent, each cited by path in the
   aggregate handoff. A narrative is not an agent.
3. Every agent (foreground or background) writes a handoff in the canonical format below. Read-only
   agents set `## Files changed` to "None — read-only audit".
4. The operator writes an aggregate phase handoff
   `docs/handoffs/<YYYYMMDD-HHMM>-phase<N>-<slug>.md` linking every per-agent handoff by path.
5. All background agents MUST be closed/cleaned up before the final report; the report states they
   were closed.
6. Each new phase is a NEW session. Do not run two phases in one session.
7. If a phase exceeds scope, time budget, or context — or quality degrades — STOP: write a handoff,
   hand the operator a new-session prompt, and do not continue silently.
8. The final report MUST list the exact gates RUN and the exact gates NOT RUN (with the reason each
   was skipped). Do not claim a gate is green unless observed green this session.

## Handoff format (required)

```
# <agent-name> handoff
## Scope
## Files inspected
## Files changed            (read-only → "None — read-only audit")
## Findings                 (numbered; severity, evidence file:line, recommendation, target part)
## Decisions
## Risks
## Verification/tests
## Next actions
```

## Non-negotiable gates

- No live server mutation during discovery (read-only only).
- No plaintext exchange secrets anywhere (DB/logs/audit/responses/fixtures/screenshots).
- No one-file prototype — use `apps/*` + `packages/*`; logic in packages, not React files.
- No fake integration — interface + mock/dev adapter + documented TODO.
- No Axioma-as-only-link UX; bridge, never runtime copy.
- No live bot start/stop/apply-config until adapters pass security + bot-integration audit.
- Entitlements fail closed and are the only access source of truth.

## Conventions

- Package names: `@wtc/<name>`. TS is written strip-friendly (no `enum`/`namespace`; use
  `as const` + union types) so pure logic can run under Node 24 type-stripping during dev checks.
- Every mutation: zod validate → server-side RBAC → entitlement check → act → audit log → never log secrets.
