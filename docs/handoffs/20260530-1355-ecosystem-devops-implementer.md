# Handoff: ecosystem-devops-implementer
**Slug:** ecosystem-devops-implementer
**Epoch:** 20260530-1355
**Wave:** Phase 2.4 Consumer/UI Wave — Workstreams A + G (truth only; no app source edits)
**Role:** ecosystem-devops-implementer

---

## Scope

Documentation truth and deployment plumbing updates for Phase 2.4. Covers:

1. `docs/CONTRACTS/billing-webhooks.md` — idempotency store superseded by `billing_webhook_events`
   (migration 0003, UNIQUE provider+event_id, INSERT-on-conflict); webhook reception path CURRENT
   (needs `STRIPE_WEBHOOK_SECRET`); checkout = TARGET (blocker: `createCheckout` unimplemented).
2. `docs/CONTRACTS/tortila-adapter.md` + `docs/BOT_INTEGRATION_PLAN.md` + `docs/BOT_CONTROL_SAFETY_MODEL.md`
   — field-name drift corrected (`processAlive`/`status`/`'healthy'|'degraded'|'stale'|'down'`);
   qty-always-null note added; fees sign-inversion warning added; /api/marks "never consume from WTC"
   rule added. Health/summary/equity/trades read-only mappings marked CURRENT (Phase 2.4).
   Legacy adapter BLOCKED documented explicitly.
3. `docs/DATA_MODEL.md` — table count updated to 40; `billing_webhook_events` +
   `billing_manual_review_items` entries added (migration 0003); REAL-in-0002 label fixed
   (present tense, correct file name); migration 0003 summary section added.
4. `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md` — idempotency section updated (audit_logs as-built
   weakness documented; `billing_webhook_events` Phase 2.4 durable store); route file TARGET →
   CURRENT (Phase 2.3); manual_review path confirmed.
5. `docs/INTEGRATION_MAP.md` — Tortila journal read-only adapter Phase 2.4 CURRENT status noted
   (health/summary/equity/trades); worker tortila-journal health collector documented (guarded by
   `TORTILA_JOURNAL_URL`); /api/marks excluded; legacy adapter BLOCKED noted.
6. `.env.example` — `REAL_POSTGRES_DATABASE_URL` commented placeholder added; `TORTILA_JOURNAL_URL`
   added; `STRIPE_WEBHOOK_SECRET`/`STRIPE_SECRET_KEY` documented with explicit notes.
7. `docs/DEPLOYMENT.md` — PGlite not a substitute for real-PG acceptance (explicit statement);
   DB-name guard note (Phase 2.4 machine-enforced); migration 0003 pre-migration checklist;
   `db:seed` non-idempotency caution; `db:migrate`/`db:seed` separation clarified;
   real-PG gate conditions stated; PowerShell step-by-step updated.

---

## Files inspected

- `docs/handoffs/20260530-1355-ecosystem-devops-docs-auditor.md` (primary edit list — Workstream A)
- `docs/handoffs/20260530-1355-ecosystem-deployment-realpg-auditor.md` (primary edit list — Workstream G)
- `docs/handoffs/20260530-1355-ecosystem-tortila-journal-auditor.md` (field-name source of truth)
- `docs/handoffs/20260530-1355-ecosystem-bot-runtime-auditor.md` (adapter/worker status)
- `docs/CONTRACTS/billing-webhooks.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/DATA_MODEL.md`
- `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md`
- `docs/INTEGRATION_MAP.md`
- `.env.example`
- `docs/DEPLOYMENT.md`
- `docs/handoffs/0000-orchestrator-seed.md`

---

## Files changed

- `docs/CONTRACTS/billing-webhooks.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/DATA_MODEL.md`
- `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md`
- `docs/INTEGRATION_MAP.md`
- `.env.example`
- `docs/DEPLOYMENT.md`

---

## Findings

All documentation truth updates applied as specified by the two auditor handoffs. No app source
code was modified (owned files are documentation and .env.example only).

### Billing webhooks (Workstream A)

- `billing-webhooks.md` §3: canonical endpoint header TARGET → CURRENT (Phase 2.3); implementation
  note corrected ("landed Phase 2.3; uses @wtc/billing from Phase 2.1").
- `billing-webhooks.md` §7: idempotency store section completely rewritten. The `audit_logs`
  select-then-insert approach is documented as Phase 2.3 as-built with its concurrent-duplicate
  weakness. `billing_webhook_events` (migration 0003, UNIQUE provider+event_id) is the Phase 2.4
  durable store. `billing_manual_review_items` (migration 0003) also documented. Hard rule added:
  ambiguous/unresolvable data MUST create a manual_review item, NEVER auto-grant.
  `webhook_idempotency_keys` is a superseded design name — do not create that table.
- `billing-webhooks.md` §12: Stripe reception CURRENT; checkout TARGET blocker documented.
- `billing-webhooks.md` §14: Gaps 1+2+5 marked FIXED; Gap 3 remains OPEN; summary table updated.

### Tortila adapter / bot docs (Workstream A + B)

- `tortila-adapter.md`: status updated to Phase 2.4; `processAlive`/`status`/`'degraded'|'stale'|'down'`
  field names corrected; fees sign-inversion warning added at both trade and summary levels; qty
  always-null note added for closed trades; /api/marks excluded with "NEVER CONSUME FROM WTC" rule;
  Mock vs Real section fully replaced with Phase 2.4 CURRENT status table.
- `BOT_INTEGRATION_PLAN.md`: `BotProcessState` type corrected to `'healthy'|'degraded'|'stale'|'down'`;
  `BotHealth` interface updated with `processAlive`/`status`/`lastSyncAt` fields; /api/marks entry
  marked EXCLUDED.
- `BOT_CONTROL_SAFETY_MODEL.md`: UI indicator table corrected (`BotHealth.status` not `.processState`;
  state values updated); Summary Table updated with Phase 2.4 column; legacy adapter BLOCKED note added.

### Data model (Workstream A)

- `DATA_MODEL.md` §0: table count 21 → 40; `REAL-in-0002` label definition: future tense → past tense
  with correct file name `0002_sour_paibok.sql`; `REAL-in-0003` label added.
- `DATA_MODEL.md` §13: migration summary header corrected (filename + "CURRENT" + "Phase 2.1");
  migration 0003 summary section added with `billing_webhook_events` and `billing_manual_review_items`
  table entries, index additions, and repo function list.

### Payment webhook state machine (Workstream A)

- `PAYMENT_WEBHOOK_STATE_MACHINE.md` §1: route implementation note corrected to Phase 2.3;
  `STRIPE_WEBHOOK_SECRET` required note added.
- `PAYMENT_WEBHOOK_STATE_MACHINE.md` §3: idempotency implementation block rewritten.
  `webhook_idempotency_keys` DDL replaced with as-built `audit_logs` approach + `billing_webhook_events`
  Phase 2.4 durable store. Do-not-create `webhook_idempotency_keys` rule stated.
- `PAYMENT_WEBHOOK_STATE_MACHINE.md` §10: route file TARGET → CURRENT (Phase 2.3); handler contract
  label updated.

### Integration map (Workstream A + B)

- `INTEGRATION_MAP.md` §3 Tortila: phase 2.4 CURRENT status; endpoint table updated with CURRENT/EXCLUDED
  labels; worker health collector documented with cadence and guard condition; /api/marks excluded.
- `INTEGRATION_MAP.md` §4: adapter status table updated (TortilaAdapter CURRENT; LegacyBotAdapter BLOCKED).

### .env.example (Workstream G)

- `REAL_POSTGRES_DATABASE_URL` commented placeholder added after `DATABASE_URL`.
- `TORTILA_JOURNAL_URL` added as canonical var name (alias for `TORTILA_JOURNAL_BASE_URL`).
- `STRIPE_WEBHOOK_SECRET` / `STRIPE_SECRET_KEY` documentation expanded with explicit notes about
  requirement for webhook reception and checkout TARGET.

### DEPLOYMENT.md (Workstream G)

- PGlite-is-not-real-PG explicit statement added with list of differences.
- DB-name guard note (Phase 2.4 machine-enforced variant in `beforeAll`).
- PowerShell throwaway-DB flow updated with steps 3-6 (DATABASE_URL, SESSION_SECRET,
  SECRET_VAULT_KEK env set; drop-recreate for second run).
- `db:seed` / `db:migrate` separation clarified.
- Real-PG gate pass/not-run conditions stated.
- Migration 0003 pre-migration checklist added.
- `db:seed` non-idempotency caution added.

---

## Decisions

1. `billing_webhook_events` (not `webhook_idempotency_keys`) is the canonical durable idempotency
   store name from migration 0003. The `webhook_idempotency_keys` name was a superseded design;
   it must not be created.
2. `processAlive` (boolean) + `status` (`'healthy'|'degraded'|'stale'|'down'`) are the confirmed
   Phase 2.4 canonical BotHealth field names per the tortila-journal-auditor source audit.
   The Tortila adapter always returns `status: 'degraded'` while P0+P1 are unresolved.
3. `/api/marks` is permanently excluded from WTC consumption — bot owns the exchange connection.
   This is a safety boundary, not a missing feature.
4. The `REAL_POSTGRES_DATABASE_URL` harness does NOT run in this session (env var not set; no
   throwaway `wtc_test` DB provisioned). This is NOT RUN with honest reason — not a failure.
5. CI is permanently inert until the repository gains `.git` and a GitHub remote. No CI-green
   claim may be made.
6. Legacy adapter BLOCKED at Phase 2.4. All 5 security gates remain NOT STARTED.

---

## Risks

None introduced by this PR. Only documentation truth updates; no app source code changed.

Documented blockers (pre-existing, not hidden):
- `createCheckout` unimplemented → no live Stripe charge path.
- Legacy plaintext-key issue → legacy adapter BLOCKED.
- Real-PG harness NOT RUN → gate not passed (honest, not failed).
- CI NOT RUN → no git repo / no remote.
- Axioma ES256 production signer TARGET → P-256 key not provisioned.

---

## Verification/tests

| Check | Result |
|---|---|
| `npm run secret:scan` | PASS — clean (no secrets found) |
| `npm run governance:check` | PASS — 0 errors, 6 warnings (all historical/prior handoffs, expected exemptions) |
| `db:migrate` | NOT RUN — `DATABASE_URL` not set; no Postgres available on host |
| `db:seed` | NOT RUN — `DATABASE_URL` not set |
| real-PG harness | NOT RUN — `REAL_POSTGRES_DATABASE_URL` not set; no throwaway `wtc_test` provisioned |
| `npm test` (PGlite) | NOT RUN this session — documentation-only changes; prior session reported 185/5 |
| CI | INERT — no `.git` directory, no GitHub remote |

---

## Next actions

1. **tests-runner or db-architect:** Add DB-name + empty-schema `beforeAll` guard to
   `tests/integration/db-real-postgres.test.ts` (deployment-realpg-auditor Finding 1+3).
2. **db-architect:** Migration 0003 — confirm additive-only; include `billing_webhook_events`,
   `billing_manual_review_items`, and the `integration_health_checks(target, checkedAt DESC)` index.
3. **backend-implementer:** Wire `insertWebhookEventOnce` (INSERT-then-conflict) to replace the
   `audit_logs` select-then-insert in `applyStripeEvent`.
4. **backend-implementer:** Wire `createManualReviewItem` for missing-userId / ambiguous events.
5. **db-architect or implementer:** Fix `seed.ts` course insert (`onConflictDoNothing`) before
   first production `db:seed`.
6. **Operator (when git + remote available):** `git init`, add remote, push, verify CI green on
   GitHub Actions. Do NOT claim CI green until `ci.yml` has executed on a real push.
