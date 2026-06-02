# Handoff: ecosystem-platform-architect · Phase 0

**Agent:** ecosystem-platform-architect
**Date:** 2026-05-29
**Phase:** 0 — Documentation and architecture

---

## Scope

Write the two platform-architect-owned Phase 0 documents:
- `docs/ARCHITECTURE.md` — full system architecture: control-plane vs product-service split, monorepo layout, package responsibilities, API namespaces, mutation pipeline, worker jobs, UI layering, deployment phases, stack justification, and risk register.
- `docs/INTEGRATION_MAP.md` — mermaid flowchart of all system integrations plus a per-touchpoint table covering all five external systems (Tortila journal `:8080`, legacy bot `:8000`, Axioma `journal_server` `:8123`/`axi-o.ma`, Stripe/mock billing, TradingView manual queue).

---

## Files Inspected (Read-Only)

| File | Purpose |
|---|---|
| `docs/handoffs/0000-orchestrator-seed.md` | Canonical decisions: stack, product codes, plan codes, entitlement states, RBAC roles, DB schema groups, design tokens, hard rules |
| `C:\Users\maxib\GTE BOT\bot_tortila\ECOSYSTEM_PLATFORM_CLOUD_CODE_PROMPT.md` | Product and implementation requirements |
| `C:\Users\maxib\GTE BOT\bot_tortila\WTC_ECOSYSTEM_ARCHITECTURE_BLUEPRINT.md` | Monorepo layout, module ownership, API boundaries, deployment strategy, UI architecture |
| `C:\Users\maxib\GTE BOT\bot_tortila\WTC_ECOSYSTEM_DISCOVERY_MAP.md` | Server topology snapshot: bot processes, ports, API surfaces, nginx state, risk signals |
| `docs/ARCHITECTURE_DECISIONS.md` | Existing ADRs (ADR-001 through ADR-007) to respect and cross-reference |

## Files Changed (Written)

| File | Status |
|---|---|
| `docs/ARCHITECTURE.md` | Created — 10 sections, ~400 lines |
| `docs/INTEGRATION_MAP.md` | Created — mermaid diagram + 5 external touchpoint tables + adapter status summary |
| `docs/handoffs/20260529-phase0-platform-architect.md` | Created — this file |

---

## Findings

1. **Two bot ports (`0.0.0.0:8000`, `0.0.0.0:8080`) have no nginx reverse proxy.** This means they may be directly internet-accessible modulo the cloud security group. WTC adapter calls must remain server-side only; the ports must never be called from the browser. A firewall review is recommended before any external deployment.

2. **Tortila journal has active P0/P1 risk signals** (TP reconciliation, margin preflight, BingX error codes `101211`, `100410`, `109421`). These are documented in the adapter contract and must be surfaced as `WarnBanner` components in the WTC UI — never hidden behind a "bot healthy" status.

3. **The Axioma desktop terminal package identity is `com.greenfield.terminal` / "Trading Terminal".** Any rename to Axioma is a deliberate migration, not a text replacement. This is noted in the seed's OPEN_QUESTIONS reference.

4. **No separate `apps/api` for MVP** is the correct choice given the current host has no pnpm/turbo and adding an extra process adds operational overhead without MVP-phase benefit. All domain logic staying in `packages/*` preserves the option to extract later.

5. **The mutation pipeline order is codified** (Zod → auth → RBAC → entitlement → action → audit → response). This must be enforced as a code-review checklist item for every new route handler.

---

## Decisions

| ID | Decision | Rationale |
|---|---|---|
| ADR-001 | npm workspaces (already recorded) | pnpm absent on host |
| ADR-002 | Drizzle ORM (already recorded) | SQL-first, no engine binary |
| ADR-003 | Next.js route handlers, no separate `apps/api` (already recorded) | MVP simplicity; domain logic in packages |
| — | `BOT_ADAPTER_MODE` env flag (`mock | read-only | audited`) governs adapter write capability | Hard gate on live bot control without changing code |
| — | Axioma release metadata cached in `terminal_release_cache` (TTL 6 h) | Reduce upstream rate-limit exposure |
| — | Worker uses `SKIP LOCKED` on `job_queue` | Safe multi-instance worker deployment |
| — | TradingView access is manual-only by default; `TVAutomationAdapter` is a documented stub | ToS compliance; no brittle automation in prod |

---

## Risks

| Risk | Severity | Owner action needed |
|---|---|---|
| Bot ports not behind nginx | P1 | DB-architect / devops: document firewall requirement; adapter calls server-side only |
| Tortila TP/margin warnings | P0 | Bot-integration-auditor: ensure adapter exposes warnings endpoint; UI must render WarnBanner |
| Axioma rename migration | P1 | Axioma-bridge-auditor: document deliberate rename steps in OPEN_QUESTIONS |
| Cross-domain WTC ↔ Axioma auth | P1 | Security-auditor + axioma-bridge-auditor: AXIOMA_HANDOFF_TOKEN_SPEC.md |
| `BOT_ADAPTER_MODE` flag misconfigured in prod | P0 | Devops: verify flag default is `mock` in prod until audit sign-off |

---

## Tests / Verification

The documents themselves are not executable, but they define the contracts and boundaries that tests must enforce:

- `packages/entitlements`: unit tests for state machine transitions including fail-closed behavior. Reference: `ENTITLEMENT_STATE_MACHINE.md`.
- `packages/crypto`: unit tests for encrypt/decrypt round-trip, key rotation, and that plaintext is never returned in error paths.
- `packages/auth`: unit tests for Argon2id hashing, session token generation, RBAC role checks.
- `packages/bot-adapters`: integration tests against mock adapter; ensure control methods throw before `BOT_ADAPTER_MODE=audited`.
- Route handler tests: verify mutation pipeline order (Zod → RBAC → entitlement → audit) for at least one representative endpoint per namespace.
- Playwright: smoke test that the WarnBanner appears when the Tortila mock adapter returns active warnings.

---

## Next Actions

In priority order for the next agents reading this handoff:

1. **db-architect**: write `DOMAIN_MODEL.md` + `DATA_MODEL.md` using the schema groups defined in `ARCHITECTURE.md` section 3 (`packages/db`) and in the seed document.
2. **security-auditor**: write `SECURITY_MODEL.md`, `RBAC_MATRIX.md`, `SECRET_VAULT_DESIGN.md`, `AUDIT_LOG_SCHEMA.md`, `AXIOMA_HANDOFF_TOKEN_SPEC.md` — the mutation pipeline in `ARCHITECTURE.md` section 5 is the security contract.
3. **billing-access-auditor**: write `ENTITLEMENT_STATE_MACHINE.md`, `BILLING_PROVIDER_PLAN.md`, `PAYMENT_WEBHOOK_STATE_MACHINE.md`, `CONTRACTS/billing-webhooks.md` — the billing touchpoint table in `INTEGRATION_MAP.md` section 3 is the starting contract.
4. **bot-integration-auditor**: write `BOT_INTEGRATION_PLAN.md`, `BOT_CONTROL_SAFETY_MODEL.md`, `CANONICAL_ANALYTICS_MODEL.md`, `CONTRACTS/tortila-adapter.md`, `CONTRACTS/legacy-bot-adapter.md` — the adapter interface from the blueprint and the discovery-map risk signals are binding inputs.
5. **axioma-bridge-auditor**: write `CONTRACTS/axioma-bridge.md` — the Axioma touchpoint in `INTEGRATION_MAP.md` and the bridge package spec in `ARCHITECTURE.md` are the inputs.
6. **Orchestrator**: after all Phase 0 docs land, scaffold the monorepo: `package.json` (workspaces), `packages/shared` (product/plan enums, Zod primitives), `packages/db` (schema shell), `packages/entitlements` (state machine stub), `packages/config`, `apps/web` (Next.js shell), `apps/worker` (job loop stub).
