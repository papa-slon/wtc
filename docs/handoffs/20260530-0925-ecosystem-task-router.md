# ecosystem-task-router handoff

Epoch: 20260530-0925. Phase 2.1 — Migration 0002 + Broad Platform Spine + Parallel Product Surfaces. READ-ONLY routing (no code, no docs edited).

> Operator note: the `ecosystem-task-router` agent type carries no Write tool by design. This handoff was authored by the agent during the Phase 2.1 audit fan-out; the operator persisted it to this path (same precedent as the 20260530-0126 epoch).

---

## Scope

Classify the Phase 2.1 work items. Verify that the serial-spine S-1→S-8 and parallel-groups P-A→P-E sequencing from the Phase 2 design remain coherent against the CURRENT code state. Name risk gates per work group. Identify the minimum coherent landable scope for one session at quality.

---

## Files inspected

- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260530-0126-phase-2-full-platform-buildout.md`
- `docs/handoffs/20260530-0126-ecosystem-task-router.md`
- `docs/handoffs/20260530-0126-ecosystem-platform-architect.md`
- `docs/handoffs/20260530-0126-ecosystem-db-architect.md`
- `packages/db/src/schema.ts` (full — 21 tables confirmed)
- `packages/db/src/repositories.ts` (30 exported functions confirmed)
- `packages/db/migrations/` (0000 + 0001 only; no 0002)
- `apps/web/src/lib/backend.ts` (full — no `billingService`, thin `lmsService`)
- `apps/web/src/lib/db-store.ts` (excerpt — confirms thin `lmsService` wired, no billingService)
- `packages/lms/src/index.ts` (full — old synchronous in-memory class; not the async service shape)
- `packages/billing/src/index.ts` + `provider.ts` (mock-only provider; no StripeAdapter)
- `packages/axioma-bridge/src/handoff.ts` (HS256 dev stub confirmed; no ES256/jwks.ts)
- `apps/web/src/features/**` (glob — only `bots/meta.ts` and `bots/data.tsx` exist)
- `apps/web/src/app/**/*.tsx` (glob — 42 page files confirmed)
- `apps/web/src/app/api/**/*.ts` (glob — zero API route files exist)
- `tests/integration/*.test.ts` (glob — 4 integration tests; no 0002 coverage)

---

## Files changed

None — read-only audit (advisory; operator persists this handoff).

---

## Findings

### Finding 1 — CONFIRM: 21-table schema; zero new-0002 tables present
Severity: informational. Evidence: `packages/db/src/schema.ts` (full); `packages/db/migrations/` contains only `0000_broken_jack_murdock.sql` and `0001_early_toad_men.sql`. The 18 tables designed in `20260530-0126-ecosystem-db-architect.md` are absent from disk. The design is complete and correct; the schema step is the hard prerequisite for everything else.
Recommendation: Phase 2.1 opens with S-1 (schema additions + generate migration `0002_ecosystem_expansion.sql`).

### Finding 2 — CONFIRM: 30 repo functions; zero 0002-scope repos exist
Severity: informational. Evidence: `packages/db/src/repositories.ts` exports exactly the 30 Phase-1 functions. None of the Wave-2 repo functions are present. S-2 (LMS repos) and S-3 (billing repos) are fully unstarted.

### Finding 3 — CONFIRM: `features/` directory nearly empty; only bots/ stub exists
Severity: informational. Evidence: `apps/web/src/features/` glob returns only `bots/meta.ts` and `bots/data.tsx`. Parallel groups P-A–P-E all require creating their feature directories; no shared-directory conflict risk.

### Finding 4 — CONFIRM: zero API route files exist
Severity: informational. Evidence: `apps/web/src/app/api/**/*.ts` glob returns zero files. The billing webhook, Axioma routes, JWKS endpoint, and admin API routes are all unbuilt — no route-file collision risk; route files are disjoint per group.

### Finding 5 — CONFIRM: `backend.ts` has thin `lmsService` only; no `billingService`
Severity: planning. The full LMS contract (enrollments, progress, teacher profiles) is absent from both `backend.ts` and `db-store.ts`. Spine S-4/S-7/S-6 must deliver this atomically; the implementer must not leave `backend.ts` partially extended.

### Finding 6 — CONFIRM: `@wtc/lms` package is old synchronous in-memory class, not the async service interface
Severity: planning. `packages/lms/src/index.ts` is the old thin model. S-4 must extend `packages/lms/src/` to the full async contract without breaking existing callers (typecheck after every additive method).

### Finding 7 — CONFIRM: `@wtc/billing` has mock provider only; no StripeAdapter
Severity: planning. S-5 implementer must produce a real adapter with `Stripe-Signature` verification as the first handler line; a tampered signature must be rejected before any DB write.

### Finding 8 — CONFIRM: Axioma bridge is HS256 dev stub only; no `jwks.ts`, no ES256 signer
Severity: high — security gate required. S-8 requires security-auditor sign-off before P-D uses the account-link flow. The existing `alg === 'HS256'` test must remain green; JWKS exports public JWK only.

### Finding 9 — CONFIRM: write-ownership map and S-1→S-8 dependency graph still correct
Severity: informational. No two spine steps share a file with a parallel group; parallel groups are disjoint (all feature dirs absent). Spine must be serial and gate-verified before any parallel group opens a file.

### Finding 10 — RISK: `revokeTv` does not populate `revoked_at`/`revoked_by`
Severity: medium. S-1 adds the columns; S-2 must update `revokeTv` to populate them + move audit into the txn. Tracked debt from the Phase-1.7 tradingview-persistence-auditor.

### Finding 11 — RISK: `courses.teacher_profile_id` backfill is a migration-transaction hazard
Severity: medium. Backfill INSERTs `teacher_profiles` for distinct `owner_teacher_id`; use ON CONFLICT DO NOTHING; do not drop `owner_teacher_id` in 0002 (additive only). Add a PGlite test with a pre-existing course row.

### Finding 12 — SEQUENCING: single-operator order is S-1→S-2→S-3→S-4→S-5→S-7→S-6→S-8
Severity: informational. S-6 must never precede S-7; they are one sitting.

---

## Decisions

1. The serial spine S-1→S-8 remains fully correct and unmodified from the Phase 2 design. No re-derivation needed.
2. The parallel groups P-A through P-E remain fully correct; zero disjoint-ownership violations exist (all five feature dirs absent).
3. The minimum coherent landable scope for Phase 2.1 at quality is the serial spine S-1 through S-3 (schema migration + LMS repos + billing repos) with full PGlite integration coverage; S-4/S-5 if budget allows; S-6 only when S-7 is complete in the same sitting. Rule 7 governs the stop boundary.
4. All hard rules from `0000-orchestrator-seed.md` remain in force for Phase 2.1.

---

## Risks

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| R-01 | 18-table migration 0002 is the hard prerequisite for all upstream work | P0 | S-1 generates via `db:generate` + PGlite test before S-2. |
| R-02 | S-6 (backend+db-store+demo) is a blast-radius shared-file step | P0 | S-7 immediately before S-6, one sitting; typecheck after each add. |
| R-03 | `revokeTv` debt: missing revoked_at/revoked_by write | P1 | Part of S-2 scope. |
| R-04 | `courses.teacher_profile_id` backfill FK violations in test data | P1 | PGlite test with a valid pre-existing course; ON CONFLICT DO NOTHING. |
| R-05 | ES256/JWKS private key must never appear in JWKS/logs | P0 (security gate) | `jwks.ts` exports public JWK only; HS256 prod-throw stays green. |
| R-06 | Stripe webhook signature must be first handler line | P0 (security gate) | Unit test: 400 on tampered signature before any DB write. |
| R-07 | Entitlement gating regression in any new surface | P0 | `hasAccess` only; fail-closed empty/403; no client inference. |
| R-08 | `@wtc/lms` old sync class vs new async interface mismatch | P1 | Audit all importers before extending; typecheck after each add. |
| R-10 | One-file prototype temptation in parallel groups | P1 | All logic in `features/<domain>/queries.ts`+`actions.ts`. |
| R-11 | `pinned_links` polymorphic owner_id — no DB FK | P2 | App enforces owner_type; CHECK constraint in migration. |
| R-12 | Context/time overrun for full 18-table migration + all repos | P1 | Rule 7; split at S-3 boundary as minimum coherent unit. |

---

## Verification/tests

No code changed this session. Gate sequence for implementers: after S-1 → `db:generate` + `typecheck` + `npm test` (PGlite groups); after S-2/S-3 → `typecheck` + `npm test` + `lint`; after S-4/S-5 → `typecheck` + `npm test`; after S-7/S-6 → `typecheck -w @wtc/web` + `npm test` + `build`; after S-8 → `typecheck` + `npm test` + `secret:scan`; after all parallel groups → `governance:check` + `lint` + `typecheck`(both) + `npm test` + `secret:scan` + `build` + `e2e`. `db:migrate`/`db:seed`/real-PG remain NOT RUN without `DATABASE_URL`.

---

## Next actions

Phase 2.1 implements the serial spine (S-1→S-3 minimum; S-4–S-8 if budget allows), following the platform-architect dependency graph exactly, then parallel groups P-A–P-E after all spine gates are green. The operator writes the aggregate handoff linking each per-agent handoff by path. **Rule 7 stop boundary: a verified partial spine (e.g. S-1→S-3, or spine-complete with a subset of surfaces) is a valid stopping point; remaining parallel groups stage to the next session.**
