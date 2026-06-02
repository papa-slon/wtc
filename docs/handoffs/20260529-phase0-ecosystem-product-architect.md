# Handoff: ecosystem-product-architect — Phase 0

**Date**: 2026-05-29
**Agent**: ecosystem-product-architect
**Phase**: 0 — Documentation and Architecture

---

## Scope

Write the four product operating model documents owned by this agent:
- `docs/PRODUCT_BRIEF.md`
- `docs/SITEMAP.md`
- `docs/MVP_SCOPE.md`
- `docs/OPEN_QUESTIONS.md`

---

## Files Inspected (read-only)

| File | Purpose |
|------|---------|
| `docs/handoffs/0000-orchestrator-seed.md` | Canonical decisions: stack, product codes, plan codes, entitlement states, RBAC roles, schema groups, design tokens, hard rules |
| `C:/Users/maxib/GTE BOT/bot_tortila/ECOSYSTEM_PLATFORM_CLOUD_CODE_PROMPT.md` | Full product and architecture prompt; Definition of Done; required pages; per-product requirements |
| `C:/Users/maxib/GTE BOT/bot_tortila/WTC_ECOSYSTEM_ARCHITECTURE_BLUEPRINT.md` | System boundaries, module ownership, monorepo layout, first-class product rule |
| `C:/Users/maxib/GTE BOT/bot_tortila/WTC_ECOSYSTEM_DISCOVERY_MAP.md` | Live server topology, API surfaces, risk signals, what exists vs missing |

No files were modified outside the four docs written below.

---

## Files Written

| File | Lines | Summary |
|------|-------|---------|
| `docs/PRODUCT_BRIEF.md` | ~260 | Vision, 5 user segments, master-account model, 6 products (value prop + monetization each), positioning table, success metrics, 10 explicit non-goals |
| `docs/SITEMAP.md` | ~430 | Full route tree (13 public, 17 app, 9 admin, 5 teacher routes); per-route: audience, entitlement gate, required UI states; cross-cutting state table |
| `docs/MVP_SCOPE.md` | ~220 | DoD mapping, must-have vs deferred per subsystem, real-vs-mock summary table, 7 cut-line escalation rules |
| `docs/OPEN_QUESTIONS.md` | ~300 | 10 numbered open questions with chosen defaults and owners |

---

## Findings

### Product model

The six products (tortila_bot, legacy_bot, axioma_terminal, tradingview_indicators, education, club) are cleanly separated by product code. The master-account model works: WTC owns identity + entitlements; runtime stays in product services. No ambiguity found in the seed definitions.

### Sitemap

All routes from the prompt are accounted for. The `/app/bots/:bot/` sub-routes map cleanly to the dynamic segment pattern. Admin and teacher routes have distinct RBAC gates. Every route has an explicit entitlement gate (product code, `auth`, `role:X`, or `none`) and all required UI states.

One gap found: the prompt lists `/app/bots/legacy` as a top-level route and also implies `/app/bots/:bot/settings`, `/positions`, etc. apply to legacy too. The sitemap treats `:bot` as a dynamic segment covering both `tortila` and `legacy`, with legacy-specific field lists noted in the settings section.

### MVP scope

The real-vs-mock boundary is the most critical finding. The following are **mocked at MVP by design**:
- Bot adapters (Tortila + Legacy) — `BotAdapter` interface + `MockAdapter`, no live HTTP
- Billing provider — `BillingAdapter` interface + `MockBillingAdapter`, no real payment
- Axioma bridge — `AxiomaBridge` interface + `MockAxiomaBridge`, no real `axi-o.ma` calls
- TradingView automation adapter — interface only, no implementation
- Backtester runner — job schema only, no runner connection

The entitlement state machine, audit log, secret vault, and auth are **real from Phase 2**.

### Tortila risk signals

The TP reconciliation and margin pre-flight are P0 items that the safety banner must surface persistently. These must not be dismissible and must link to a known-issues note. The sitemap's `/app/bots/:bot/safety` tab and the dashboard warning banner both reference this explicitly.

---

## Decisions

| Decision | Rationale |
|----------|-----------|
| Club and Education are separate entitlements by default | Separate product codes allow independent pricing and revocation; bundling is opt-in via plan registry migration |
| TradingView access is manual-admin-queue at MVP | ToS ambiguity; prompt hard rule; automation adapter is interface-only |
| Billing is mock-only at MVP | Provider not selected; manual admin grant covers MVP DoD |
| Axioma account link is informational (unverified) at MVP | SSO spec (`AXIOMA_HANDOFF_TOKEN_SPEC.md`) not yet finalized; `journal_server` validation endpoint status unknown |
| Bot controls are disabled/mock at MVP | `BOT_CONTROL_SAFETY_MODEL.md` prerequisite; hard rule from seed |
| BingX-only exchange at MVP | Tortila is BingX-specific; single-exchange scope reduces adapter risk |

All decisions using reasonable defaults where the prompt left ambiguity have been recorded in `OPEN_QUESTIONS.md` with an owner.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Axioma rename migration (`com.greenfield.terminal` → Axioma) creates identifier mismatch between WTC UI and `journal_server` validation | High | Q-1 default: do not rename any component; WTC uses display name "Axioma Terminal" only; contracts document both identifiers explicitly |
| TradingView manual queue creates operational bottleneck at scale | Medium | Admin queue UI designed for efficiency; automation adapter interface ready for future ToS-compliant implementation |
| Mock adapters presented as real data could mislead users | High | Every mock state shows stale badge + "adapter not connected" copy; empty-state rule enforced; no green badges on mock data |
| Tortila P0 (TP reconciliation, margin pre-flight) risks hidden in UI | Critical | Safety banner is non-dismissible; `/app/bots/:bot/safety` tab always renders known-issues section |
| Two bots with different data shapes hard to normalize | Medium | `CANONICAL_ANALYTICS_MODEL.md` (bot-integration-auditor) must define the normalized metric type before Phase 3; Zod schemas enforce both adapters conform |
| Billing provider not selected blocks subscription automation | Medium | Manual admin grant covers MVP; `BillingAdapter` interface ensures provider is a drop-in replacement |

---

## Tests / Verification

Tests owned by other agents (tests-runner), but this agent's output creates the following test targets:

- `packages/entitlements`: unit tests for all 9 entitlement states, `hasAccess()` fail-closed behavior, bundle expansion, manual grant/revoke.
- `packages/auth`: RBAC check unit tests (user/teacher/admin/support); ownership check for teacher routes.
- Route-level Playwright smoke: every route listed in `SITEMAP.md` must return the correct HTTP status code (200 for public, 302→login for auth-required unauthenticated, 403 for wrong role). Empty/disabled states must be visually distinct (Playwright screenshot diff).
- No Playwright test may pass with a route that shows a loading spinner but never resolves to content or error.

---

## Next Actions

Immediate (unblocked):

1. **platform-architect**: write `ARCHITECTURE.md`, `INTEGRATION_MAP.md` — needed for Phase 1 scaffolding.
2. **db-architect**: write `DOMAIN_MODEL.md`, `DATA_MODEL.md` — needed before Drizzle schema is created.
3. **security-auditor**: write `SECURITY_MODEL.md`, `RBAC_MATRIX.md`, `SECRET_VAULT_DESIGN.md`, `AUDIT_LOG_SCHEMA.md`, `AXIOMA_HANDOFF_TOKEN_SPEC.md` — prerequisite for Phase 2 wiring.
4. **billing-access-auditor**: write `ENTITLEMENT_STATE_MACHINE.md`, `BILLING_PROVIDER_PLAN.md`, `PAYMENT_WEBHOOK_STATE_MACHINE.md` — prerequisite for Phase 2.
5. **bot-integration-auditor**: write `BOT_INTEGRATION_PLAN.md`, `BOT_CONTROL_SAFETY_MODEL.md`, `CANONICAL_ANALYTICS_MODEL.md`, and bot adapter contracts — prerequisite for Phase 3.
6. **axioma-bridge-auditor**: write `CONTRACTS/axioma-bridge.md` — prerequisite for any real Axioma wiring.

Blocked until questions resolved:

- Q-2: billing provider selection → `billing-access-auditor` cannot finalize webhook contract
- Q-1: Axioma rename decision → `axioma-bridge-auditor` cannot finalize handoff token `aud` claims
- Q-5: cross-domain auth design → `security-auditor` cannot finalize `AXIOMA_HANDOFF_TOKEN_SPEC.md`
- Q-4: production domain → `devops-implementer` cannot finalize nginx config or cookie domain

---

## Artifacts

- `docs/PRODUCT_BRIEF.md` — complete
- `docs/SITEMAP.md` — complete
- `docs/MVP_SCOPE.md` — complete
- `docs/OPEN_QUESTIONS.md` — complete (10 questions with defaults and owners)
- This handoff: `docs/handoffs/20260529-phase0-ecosystem-product-architect.md`
