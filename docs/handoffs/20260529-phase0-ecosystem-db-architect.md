# Handoff: ecosystem-db-architect — Phase 0

**Date**: 2026-05-29
**Agent**: ecosystem-db-architect
**Phase**: 0 — Documentation and Architecture

---

## Scope

Write the two DB-architect-owned Phase 0 documents:

- `docs/DOMAIN_MODEL.md` — business concepts, state machines, and cross-domain workflows
- `docs/DATA_MODEL.md` — physical tables, columns, constraints, indexes, Drizzle migration plan

All definitions are derived from and consistent with:
- `docs/handoffs/0000-orchestrator-seed.md` (canonical authority)
- `WTC_ECOSYSTEM_ARCHITECTURE_BLUEPRINT.md`
- `WTC_ECOSYSTEM_DISCOVERY_MAP.md`
- `ECOSYSTEM_PLATFORM_CLOUD_CODE_PROMPT.md`

---

## Files Inspected (Read-Only)

| File | Purpose |
|---|---|
| `docs/handoffs/0000-orchestrator-seed.md` | Stack, table names, entitlement states, RBAC roles, plan codes, product codes, hard rules |
| `bot_tortila/WTC_ECOSYSTEM_ARCHITECTURE_BLUEPRINT.md` | Monorepo layout, bounded contexts, BotAdapter interface, Axioma bridge spec |
| `bot_tortila/WTC_ECOSYSTEM_DISCOVERY_MAP.md` | Live system topology, Tortila journal API surface, legacy bot API surface, Axioma journal_server endpoints, known risk signals |
| `bot_tortila/ECOSYSTEM_PLATFORM_CLOUD_CODE_PROMPT.md` | Product requirements, bot config shapes, entitlement rules, analytics requirements |

## Files Changed / Written

| File | Lines | Description |
|---|---|---|
| `docs/DOMAIN_MODEL.md` | ~500 | Business concepts, state machines, 8 workflow diagrams |
| `docs/DATA_MODEL.md` | ~600 | 26 tables across 8 bounded contexts, indexes, Drizzle plan |
| `docs/handoffs/20260529-phase0-ecosystem-db-architect.md` | — | This file |

---

## Findings

### Domain Model Highlights

1. **Entitlement as sole access arbiter**: The DOMAIN_MODEL formalises the fail-closed rule with a complete state machine diagram. Unknown/unrecognised states deny access. Only `packages/entitlements` evaluates access.

2. **Two bot config shapes fully documented**: Legacy Bot (RSI/CCI, averaging levels, take-profit %, leverage, balance %, stages/slots) and Tortila Bot (ATR, winner filter, trailing TFLab, strategy system variants) are both modelled in `bot_configs.config_json` as typed JSONB.

3. **Tortila risk signals surfaced**: The six known P0/P1 risk signals from the discovery map (`TP_RECONCILIATION_PENDING`, `MARGIN_PREFLIGHT_MISSING`, `TP_REJECTION_101211`, `RATE_LIMIT_100410`, `FILL_LOOKUP_109421`, `EXCHANGE_FLAT_MISMATCH`) are modelled as `bot_safety_events.event_code` values. UI must surface these as warnings — never hide behind a green card.

4. **Axioma bridge design**: `axioma_account_links` has four states (`unlinked`, `pending_link`, `linked`, `error`) supporting the WTC↔Axioma handoff token flow. `terminal_release_cache` stores metadata only — never the binary.

5. **TradingView manual-queue confirmed**: `tradingview_access_requests` drives the admin-queue workflow. Automation is modelled at the adapter layer only, behind a feature flag. No credential-stuffing default.

6. **Backtest job lifecycle**: Full state machine (queued → running → completed/failed/canceled) with a hard invariant: if no runner is configured, the job enters `failed` immediately — no placeholder results ever.

### Data Model Highlights

1. **`exchange_api_key_secrets` is ciphertext-only**: The table stores `ciphertext_blob`, `key_id`, `iv_hex`, `tag_hex` only. No column for plaintext `api_key` or `api_secret` exists. This is enforced structurally, not just by convention.

2. **`audit_logs` is immutable at the DB level**: The seed migration `REVOKE UPDATE, DELETE ON audit_logs FROM wtc_app_role`. Application can only `INSERT` and `SELECT`.

3. **`job_queue` uses `SELECT FOR UPDATE SKIP LOCKED`**: Worker claim pattern is fully specified to prevent double-processing and to handle worker crashes gracefully.

4. **All 26 tables mapped to exact seed-specified names**: Every table name matches the bounded context registry in the seed exactly.

5. **Drizzle config and client boilerplate included**: `drizzle.config.ts`, `src/db.ts`, migration commands, and DB role security SQL are all specified.

6. **Bundle plan expansion**: `plans.bundle_product_codes TEXT[]` stores the member product codes. `packages/entitlements` expands them atomically — one `entitlement` row per member product.

---

## Decisions

| Decision | Rationale |
|---|---|
| `config_json JSONB` on `bot_configs` | Each bot product has a different schema. Drizzle `z.object()` validation applied in `packages/db` before write. Avoids sparse column explosion. |
| `bot_trade_imports` unique on `(bot_instance_id, external_trade_id, source_adapter)` | Supports idempotent import runs without duplicating records. |
| `backtest_jobs` placed in `ops.ts` alongside `job_queue` | Temporal coupling with the worker pattern is strong. Can be split later if Bots context is extracted to its own schema file. |
| Soft delete on `users` and `exchange_accounts`, hard delete elsewhere | Users and exchange accounts may have ongoing audit/legal obligations. Most other tables cascade or are purged on entitlement revoke. |
| `audit_logs.payload JSONB` — no secret constraint enforced at DB level | Enforced by convention and code review in `packages/audit`. A future DB constraint (check for no `api_key`/`secret` keys) can be added as a migration. |
| `terminal_release_cache.is_current BOOLEAN` per `(channel, platform)` | Simplest way to mark current without a separate join query. Worker atomically sets old record `is_current=false`, new record `is_current=true`. |

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `config_json` JSONB drift between bot products | Medium | Zod schemas in `packages/db/src/schema/bots.ts` validate before write. Version is stored in `bot_config_versions`. |
| `exchange_api_key_secrets` accidental plaintext write | Critical | Structural: no plaintext column exists. `packages/crypto` is the only write path and always encrypts first. Code review required. |
| `audit_logs` immutability: application-level REVOKE could be bypassed by DBA | Low | Separate migrator role with DDL access; app role has only INSERT+SELECT. Database access control documented in deployment docs. |
| `bot_metric_snapshots` volume growth with frequent worker polling | Medium | Index on `(bot_instance_id, snapshot_at DESC)`. Retention policy + partition strategy deferred until volume is measured. |
| `job_queue` `SKIP LOCKED` requires Postgres 9.5+. | None | Running Postgres 16 as per stack lock. |
| `entitlements` unique constraint `(user_id, product_code)` allows only one entitlement row per product | Design choice | State machine transitions happen in-place on the single row. `product_access_events` records the full transition history. If future multi-grant per product is needed, the constraint must be lifted and access logic updated. |

---

## Tests / Verification

No runtime tests are produced in Phase 0. The following tests are required before `packages/db` is merged to production:

- [ ] Drizzle schema parses without error (`npx drizzle-kit generate:pg` produces valid SQL).
- [ ] Migration SQL applies cleanly to a fresh Postgres 16 database.
- [ ] Seed script inserts all roles, products, and plans without error.
- [ ] `entitlements` unique constraint is verified by attempting to insert duplicate `(user_id, product_code)`.
- [ ] `audit_logs` UPDATE and DELETE are rejected when run as `wtc_app_role`.
- [ ] `exchange_api_key_secrets` schema has no plaintext columns (schema introspection test).
- [ ] `job_queue` SKIP LOCKED claim pattern works under concurrent workers (integration test with two workers).
- [ ] Bundle expansion: inserting a `bundle_pro` plan creates 4 entitlement rows atomically (unit test in `packages/entitlements`).

---

## Next Actions

| Priority | Action | Owner |
|---|---|---|
| P0 | Scaffold `packages/db/src/schema/` with all 8 context files | devops-implementer / backend-implementer |
| P0 | Write `drizzle.config.ts` and first migration via `drizzle-kit generate:pg` | devops-implementer |
| P0 | Write seed script for roles, products, plans | backend-implementer |
| P0 | Implement `packages/entitlements` with `hasAccess`, `grantAccess`, `revokeAccess` using these tables | backend-implementer |
| P1 | Implement `packages/crypto` AES-256-GCM vault matching `exchange_api_key_secrets` schema | security-auditor |
| P1 | Write `packages/audit` helper that enforces no-secret constraint on `payload` | security-auditor |
| P1 | Define Zod schemas for `bot_configs.config_json` per product code | bot-integration-auditor |
| P2 | Design `bot_metric_snapshots` retention policy | db-architect (next phase) |
| P2 | Evaluate range partitioning for `bot_metric_snapshots` and `bot_trade_imports` after load testing | db-architect (next phase) |
