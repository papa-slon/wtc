# Handoff: ecosystem-devops-docs-auditor

_Epoch 20260530-1625. Read-only audit. Produces the Phase Group 1 documentation-truth edit list and deployment/CI readiness picture for the operator. No code or doc files changed — edit list only._

## Scope

Post-Phase-2.4 doc-truth audit for Phase Group 1. Five files inspected for stale claims vs. Phase 2.4 reality: table count (38→40), migration count (3→4), e2e count (28→34), route count (44→53), fixture count, idempotency-store table name, and manual_review/admin-queue status. Deployment/CI readiness picture for Phase Group 12.

## Files inspected

- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/CONTRACTS/billing-webhooks.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/DEPLOYMENT.md`
- `.env.example`
- `docker-compose.yml`
- `docs/handoffs/20260530-1355-phase-2-4-real-bot-readonly-access-ops.md` (ground truth)
- `packages/bot-adapters/src/__fixtures__/tortila/` (fixture file count)

## Files changed

None — read-only audit.

## Findings

### Finding 1 — MEDIUM — `docs/IMPLEMENTED_FILES.md` Persistence table: "Drizzle schema (38 tables)" is stale

**Severity:** MEDIUM  
**Evidence:** `docs/IMPLEMENTED_FILES.md:107` — the Persistence table row reads `Drizzle schema (38 tables)` with state `real (21 base + 17 new from migration 0002)`. Phase 2.4 added migration 0003 bringing the total to 40 tables. The Phase 2.4 aggregate at `docs/handoffs/20260530-1355-phase-2-4-real-bot-readonly-access-ops.md` and the gate run confirm `40 tables`.  
**Recommendation:** Change the cell to `Drizzle schema (40 tables)` and the state to `real (21 base + 17 from migration 0002 + 2 new from migration 0003)`.  
**Target phase group:** 1

---

### Finding 2 — MEDIUM — `docs/IMPLEMENTED_FILES.md` Persistence table: Migration SQL row omits migration 0003

**Severity:** MEDIUM  
**Evidence:** `docs/IMPLEMENTED_FILES.md:108` — the Migration SQL row lists only three migration files `0000`, `0001`, `0002` and says "generated (3 migrations, 38 tables)". Migration `0003_fresh_blockbuster.sql` landed in Phase 2.4.  
**Recommendation:** Extend the row to include `0003_fresh_blockbuster.sql` (`billing_webhook_events`, `billing_manual_review_items`, subscriptions unique index, audit composite index) and change "3 migrations, 38 tables" to "4 migrations, 40 tables"; add `0003` PGlite-tested.  
**Target phase group:** 1

---

### Finding 3 — MEDIUM — `docs/IMPLEMENTED_FILES.md` Phase 2.4 additions entry: fixture count says "8 new" but 11 JSON fixture files exist on disk

**Severity:** MEDIUM  
**Evidence:** `docs/IMPLEMENTED_FILES.md:15` states `__fixtures__/tortila/*` (8 **new**). Actual file count in `packages/bot-adapters/src/__fixtures__/tortila/` is **11 JSON files**:
- `health.valid.json`, `health.down.json`, `health.malformed.json` (3)
- `summary.valid.json`, `summary.no_trades.json`, `summary.missing_field.json` (3)
- `equity.valid.json`, `equity.empty.json`, `equity.length_mismatch.json` (3)
- `trades_list.valid.json`, `trades_list.missing_fees.json` (2)

The "8 fixtures" count referenced in STATUS.md, NEXT_ACTIONS.md, and the Phase 2.4 aggregate handoff appears to be the count of test _scenarios_ or _original design slots_, not the final file count. The aggregate and the tortila-journal-auditor handoff both consistently use "8 fixtures" as an authored design term. However, the file count is the objective truth.  
**Decision:** The discrepancy is 8 (design/scenario count mentioned in Phase 2.4 scope notes) vs. 11 (actual files shipped). The implementer may have shipped 3 additional edge-case fixtures (`health.malformed`, `summary.missing_field`, `equity.length_mismatch`) beyond the 8 baseline scenarios. The right correction is to update `docs/IMPLEMENTED_FILES.md:15` to "11 new" to match reality. STATUS.md and NEXT_ACTIONS.md references to "8 fixtures" are historical gate-run records and aggregate scope notes — those are accurately describing what was intended/planned at writing time and do not need retroactive correction, as they are phase-record prose not current-truth tables.  
**Recommendation:** In `docs/IMPLEMENTED_FILES.md:15`, change `(8 **new**)` to `(11 **new**)`.  
**Target phase group:** 1

---

### Finding 4 — MEDIUM — `docs/IMPLEMENTED_FILES.md` Contracts table: `billing-webhooks.md` row says "no live webhook route yet"

**Severity:** MEDIUM  
**Evidence:** `docs/IMPLEMENTED_FILES.md:135` — the Contracts table row for `billing-webhooks.md` reads `packages/billing/src/{webhook,provider}.ts` (verify + mock provider; **no live webhook route yet**). The route `apps/web/src/app/api/billing/webhook/route.ts` has existed since Phase 2.3 and was hardened with durable idempotency in Phase 2.4.  
**Recommendation:** Update the row to: `packages/billing/src/{webhook,provider,stripe}.ts` + `apps/web/src/app/api/billing/webhook/route.ts` (signature-verified, durable `billing_webhook_events` idempotency, fail-closed manual_review; checkout creation TARGET).  
**Target phase group:** 1

---

### Finding 5 — HIGH — `docs/CONTRACTS/billing-webhooks.md` Section 1 ownership table: idempotency store names the superseded table

**Severity:** HIGH  
**Evidence:** `docs/CONTRACTS/billing-webhooks.md:21` — the ownership table row reads:

```
| Idempotency store | WTC Platform — `webhook_idempotency_keys` table |
```

The landed table (migration 0003) is `billing_webhook_events`. The `webhook_idempotency_keys` name was a superseded design that was never implemented. Phase 2.4 aggregate decision 2 explicitly states: "Durable idempotency = `billing_webhook_events` (supersedes the `audit_logs` ledger AND the never-built `webhook_idempotency_keys`)." Section 7 of the same file correctly describes `billing_webhook_events` as CURRENT. The Section 1 row is the only remaining stale reference in this file.  
**Recommendation:** Change `docs/CONTRACTS/billing-webhooks.md:21` row to:

```
| Idempotency store | WTC Platform — `billing_webhook_events` table (migration 0003; UNIQUE provider+event_id) |
```

**Target phase group:** 1

---

### Finding 6 — MEDIUM — `docs/CONTRACTS/billing-webhooks.md` Gap 3 in Section 14 still says "OPEN (Phase 2.4)" for manual_review admin queue

**Severity:** MEDIUM  
**Evidence:** `docs/CONTRACTS/billing-webhooks.md` Section 14 summary table row for "No `manual_review` flag/resolve actions" reads `OPEN (Phase 2.4)` with note "billing_manual_review_items table in migration 0003; admin review queue TARGET". Phase 2.4 delivered: `billing_manual_review_items` table in migration 0003, `createManualReviewItem`/`listManualReviewItems`/`resolveManualReviewItem`/`flagProductForReview` repos, and `/admin/entitlements/review` page with approve/reject/dismiss actions.  
**Recommendation:** Update the summary table row status from `OPEN (Phase 2.4)` to `FIXED (Phase 2.4)` with note "billing_manual_review_items in migration 0003; /admin/entitlements/review page with approve/reject/dismiss shipped."  
**Target phase group:** 1

---

### Finding 7 — LOW — `docs/NEXT_ACTIONS.md:52` db:generate comment says "3 migrations, 38 tables as of 0002"

**Severity:** LOW  
**Evidence:** `docs/NEXT_ACTIONS.md:52` — the comment reads:

```
npm run db:generate -w @wtc/db   # regenerate migrations (no DB needed; 3 migrations, 38 tables as of 0002)
```

Phase 2.4 added migration 0003, making the total 4 migrations and 40 tables.  
**Recommendation:** Change comment to `# regenerate migrations (no DB needed; 4 migrations, 40 tables as of 0003)`.  
**Target phase group:** 1

---

### Finding 8 — MEDIUM — `docs/STATUS.md` Phase 2.3 gate table: db:generate row says "38 tables"

**Severity:** MEDIUM  
**Evidence:** `docs/STATUS.md:38` — Phase 2.3 gate run table row:

```
| db:generate | `npm run db:generate -w @wtc/db` | PASS — 38 tables, "No schema changes" |
```

This is a historical record of the Phase 2.3 gate run, which was correctly 38 tables at that time. It does not need correction as a phase-record entry. However, it may confuse readers looking for current truth. No change is strictly required here because STATUS.md is a chronological record; the Phase 2.4 section correctly states 40 tables and the Phase 2.3 entry accurately reflects its moment. The Phase 2.4 section header and gate table are the current truth anchor.  
**Decision:** No change needed — this is an accurate historical record, not a stale claim.  
**Target phase group:** N/A (no action)

---

### Finding 9 — LOW — `docs/STATUS.md` Phase 2.3 gate table: e2e row says "28/28" and build row says "44 routes"

**Severity:** LOW  
**Evidence:** `docs/STATUS.md:39-40` — Phase 2.3 gate run rows show `44 routes` and `28/28` e2e. These are correct historical records for Phase 2.3. Phase 2.4 brought these to 53 routes and 34/34 e2e, which is documented in the Phase 2.4 summary section at `docs/STATUS.md:9-10`.  
**Decision:** No change needed — historical records are accurate; Phase 2.4 summary is the current truth anchor.  
**Target phase group:** N/A (no action)

---

### Finding 10 — MEDIUM — `docs/DEPLOYMENT.md` db:generate inline comment in NEXT_ACTIONS is stale (cross-reference finding)

**Severity:** LOW  
**Evidence:** `docs/DEPLOYMENT.md` does not itself contain "38 tables" or "3 migrations" — the DEPLOYMENT.md is current and accurate. The migration-0003 note, real-PG guard, and rollback steps for 0003 are all present. The CI status section correctly states "staged but NOT RUN". The phased server rollout table is accurate. The `.env.example` is current and complete (TORTILA_JOURNAL_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET placeholders all present; FEATURE_LIVE_BOT_CONTROL=false and FEATURE_TV_AUTOMATION=false safe defaults set; BOT_ADAPTER_MODE=mock default correct).  
**Decision:** `docs/DEPLOYMENT.md` requires no changes. It correctly represents the current state.  
**Target phase group:** N/A (no action)

---

### Finding 11 — LOW — `docker-compose.yml` and `.env.example` are current and accurate

**Severity:** LOW (informational — no action needed)  
**Evidence:**
- `docker-compose.yml`: uses `postgres:17-alpine` (matches CI and host PG17), correct credentials `wtc/wtc`, healthcheck present, no secrets. Current and accurate.
- `.env.example`: all required vars present with placeholder values (`SESSION_SECRET`, `SECRET_VAULT_KEK`, `DATABASE_URL`, `REAL_POSTGRES_DATABASE_URL` commented out with warning, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `AXIOMA_HANDOFF_SIGNING_SECRET`, feature flags defaulting off, `BOT_ADAPTER_MODE=mock`). No real secrets. No drift found.  
**Decision:** No changes required.  
**Target phase group:** N/A (no action)

---

### Finding 12 — MEDIUM — Phase Group 12 (CI/deployment) gaps vs. current DEPLOYMENT.md

**Severity:** MEDIUM  
**Evidence:** Review of `docs/DEPLOYMENT.md` against Phase Group 12 requirements reveals these gaps that must be addressed before Phase Group 12 deliverables are complete:

1. **git/CI activation path** — DEPLOYMENT.md correctly notes "CI staged but NOT RUN — not a git repo." Phase Group 12 requires `git init` + GitHub remote + first CI run proof. Steps to activate: `git init`, `git remote add origin <repo>`, `git add`, `git commit`, push, verify GitHub Actions runs `ci.yml`. DEPLOYMENT.md should add an explicit "Phase Group 12 — CI activation checklist" section.

2. **systemd service file** — Phase 2 server deployment to `/home/ubuntu/apps/wtc_ecosystem_platform` requires a `wtc-web.service` systemd unit. DEPLOYMENT.md documents the path and port (`127.0.0.1:8300`) but does not include a sample service file or the exact `ExecStart` command. Phase Group 12 should add a proposed (approval-gated) systemd unit template.

3. **nginx server block** — Phase 3 of the rollout adds nginx. DEPLOYMENT.md notes "Only after approval; TLS; HSTS; `__Host-` session cookie active in prod" but does not include a proposed server block template. Phase Group 12 should add a proposed (approval-gated) nginx block for operator review before touch.

4. **db:seed idempotency known bug** — DEPLOYMENT.md correctly calls out that `db:seed` teacher course insert is NOT idempotent. This must be fixed (`onConflictDoNothing`) before Phase Group 12 deployment sign-off.

5. **Real-PG harness migration 0003 coverage** — DEPLOYMENT.md documents the throwaway-DB flow for migrations 0000–0002. The migration 0003 note was added (Phase 2.4 aggregate `Files changed` lists DEPLOYMENT.md). Verify the throwaway-DB steps include `0003_fresh_blockbuster.sql` application and the concurrent-duplicate `billing_webhook_events` test case.  
**Target phase group:** 12

---

### Finding 13 — LOW — `docs/CONTRACTS/tortila-adapter.md` fixture count: "Mock fixture data" section does not list a count

**Severity:** LOW  
**Evidence:** `docs/CONTRACTS/tortila-adapter.md:475` — the Mock vs Real table footnote reads "Mock fixture data: `packages/bot-adapters/src/__fixtures__/tortila/` (directory with per-endpoint files). Fixtures include all warning codes pre-populated and synthetic (not real) equity data." There is no count claim in this file, so it cannot be stale. The file is accurate.  
**Decision:** No change needed in this file regarding fixture count.  
**Target phase group:** N/A (no action)

## Decisions

1. **"8 fixtures" in STATUS.md, NEXT_ACTIONS.md, and the Phase 2.4 aggregate are historical scope-note prose.** They refer to the 8 planned test-scenario slots in the tortila-journal-auditor's design. The additional 3 files (`health.malformed.json`, `summary.missing_field.json`, `equity.length_mismatch.json`) are valid edge-case fixtures that the implementer added beyond the 8-scenario baseline. The correct correction is only in `docs/IMPLEMENTED_FILES.md:15` (current-truth table), not in historical narrative prose.

2. **`docs/DEPLOYMENT.md` is structurally sound for Phase Groups 1–11.** The gaps identified (Finding 12) are Phase Group 12 deliverables, not current-phase fixes. No edit to DEPLOYMENT.md is required for Phase Group 1.

3. **`docs/STATUS.md` historical phase records are correct as written.** Phase 2.3 gate entries accurately reflect Phase 2.3 reality. No retroactive edits to phase-record entries.

4. **The only two files requiring immediate edits for Phase Group 1 are `docs/IMPLEMENTED_FILES.md` and `docs/CONTRACTS/billing-webhooks.md`.** All other files are either current or are historical records.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| An implementer reads `docs/CONTRACTS/billing-webhooks.md:21` and creates a `webhook_idempotency_keys` table in a future migration | HIGH | Fix Finding 5 immediately; the table name is wrong in the one remaining stale location in that file |
| An implementer reads `docs/IMPLEMENTED_FILES.md` Persistence table and believes only 3 migrations / 38 tables exist, omitting 0003 steps from migration runbook | MEDIUM | Fix Findings 1 and 2; both cells must name 0003 |
| db:seed idempotency bug (teacher course insert) causes data corruption on re-seed in Phase Group 12 deployment | MEDIUM | Fix `db:seed` `onConflictDoNothing` for course insert before Phase Group 12; document in DEPLOYMENT.md Phase Group 12 checklist |
| CI never activated (not a git repo) means no automated gate proof; a manual `npm run ci:local` is the only local check | MEDIUM | Phase Group 12 must gate on `git init` + push + first CI green run; DEPLOYMENT.md CI activation checklist section needed |

## Verification/tests

All findings are based on direct file inspection. No code was executed. Fixture count verified by directory listing of `packages/bot-adapters/src/__fixtures__/tortila/` (11 files confirmed). All line number locators verified by reading the relevant file sections. Gate numbers (40 tables, 4 migrations, 53 routes, 34/34 e2e) sourced from `docs/handoffs/20260530-1355-phase-2-4-real-bot-readonly-access-ops.md` aggregate (authoritative post-implementation record).

This handoff does not run any tests. Verification that the proposed doc edits are correct is the responsibility of the Phase Group 1 implementer.

## Next actions

**Phase Group 1 — immediate doc fixes (no code changes, edit list only):**

1. `docs/IMPLEMENTED_FILES.md:107` — change `Drizzle schema (38 tables)` to `Drizzle schema (40 tables)` and state cell to `real (21 base + 17 from migration 0002 + 2 new from migration 0003)`.
2. `docs/IMPLEMENTED_FILES.md:108` — extend Migration SQL row to include `0003_fresh_blockbuster.sql`; change "3 migrations, 38 tables" to "4 migrations, 40 tables"; add "`0003` PGlite-tested".
3. `docs/IMPLEMENTED_FILES.md:15` — change `__fixtures__/tortila/*` `(8 **new**)` to `(11 **new**)`.
4. `docs/IMPLEMENTED_FILES.md:135` — update `billing-webhooks.md` contracts row: remove "no live webhook route yet"; add `apps/web/src/app/api/billing/webhook/route.ts` to the list and note durable `billing_webhook_events` idempotency.
5. `docs/CONTRACTS/billing-webhooks.md:21` — change `webhook_idempotency_keys` to `billing_webhook_events` in ownership table.
6. `docs/CONTRACTS/billing-webhooks.md` Section 14 summary table — change Gap 3 status from `OPEN (Phase 2.4)` to `FIXED (Phase 2.4)` with correct note.
7. `docs/NEXT_ACTIONS.md:52` — change comment from "3 migrations, 38 tables as of 0002" to "4 migrations, 40 tables as of 0003".

**Phase Group 12 — deployment readiness (each requires operator approval before server touch):**

8. Add "CI activation checklist" section to `docs/DEPLOYMENT.md` (git init steps, push, verify GitHub Actions green).
9. Add proposed (approval-gated) systemd unit template for `wtc-web.service` to `docs/DEPLOYMENT.md`.
10. Add proposed (approval-gated) nginx server block template to `docs/DEPLOYMENT.md`.
11. Fix `db:seed` teacher course insert with `onConflictDoNothing`; document fix in DEPLOYMENT.md.
