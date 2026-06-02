# Phase 2.10 / Phase Group 7 — LMS authorization hardening: RBAC/ownership/entitlement denial → audit + throw, CSRF-first ordering (aggregate handoff)

_2026-05-30, epoch `20260530-2330`. Operator-authored aggregate per [`SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md) §4.
Driven by a **5 read-only auditor fan-out (agents-before-edits, Rule 1)** via one Workflow run (`wf_bc573b81-055`)
→ operator-orchestrated **serial** implementation (not a git repo, no worktrees, no parallel writers). **5 per-agent
handoff files** at this epoch, every one cited below. No SSH / live server / live bot / live exchange / Stripe charge /
TradingView automation / Axioma production handoff. **Not production-ready.** Sixth phase-group window in the operator's
continuous program (follows Phase 2.9 / PG6, epoch `20260530-2230`)._

## Scope

PG7 (LMS) from [`EXECUTION_PLAN_MASTER.md`](../EXECUTION_PLAN_MASTER.md) W8 / [`ROADMAP_MASTER.md`](../ROADMAP_MASTER.md) §7 —
three workstreams; **no migration** (the rich migration is deferred, unanimously, to Phase-3):

1. **LMS RBAC/ownership/entitlement denial → audit + throw (the core security deliverable).** The 10 LMS server
   actions previously **silently `return`ed** on every authorization denial (`if (!isTeacher) return`, the
   `ownsCourse()`-boolean ownership gate, `if (!access.allowed) return`, `if (!isAdmin) return`) — a denied attempt
   looked like a no-op with **no audit trace**. Replaced with four guard helpers that **write one audit row
   (`result:'failure'`) then throw `AppError`**: `requireTeacher` / `requireAdmin` / `requireCourseOwnership` /
   `requireEducationAccess` in the new `apps/web/src/features/lms/guard.ts`.
2. **CSRF-first ordering.** Every action now calls `assertCsrf(formData)` as its **first awaited statement**, before
   `requireUser()` (was the reverse). `assertCsrf` reads the session cookie directly (independent of `requireUser`), so
   a forged cross-site POST is rejected before any session read or DB I/O. Canonical pipeline is now
   **assertCsrf → requireUser → RBAC/ownership/entitlement (audit+throw) → Zod → repo (in-txn success audit) → revalidate**.
3. **Rich LMS migration 0005 — UNANIMOUSLY deferred to a Phase-3 plan (5/5 auditors).** No candidate field
   (slug/level/tags/content_type/embed_html/file-meta/global-pinned/progress-state) has a consumer this phase; the rich
   UI is explicitly Phase-3; the dead-code-avoidance discipline (PG4 checkout, PG6 web signer resolver) is decisive.
   Two fields are additionally blocked: `materials` file-meta on the **upload security review** (ROADMAP §7), and
   `lessons.embed_html` on an **unbuilt server-side sanitizer** (stored-XSS). `pinned_links owner_type='global'` is
   **non-additive** (DROP+ADD CHECK on the 0002 constraint — drizzle-kit would leave both constraints live). The
   ready-to-run Phase-3 DDL spec lives in the db-architect + education per-agent handoffs.

**Migration:** none (40→41 baseline from PG6 unchanged; `db:generate` = "No schema changes").

## Agents launched (5 per-agent handoffs — all closed; every one cited)

Read-only audit fan-out (one Workflow run `wf_bc573b81-055`; all 5 returned, none left running):
1. `ecosystem-education-implementer` → [`…-ecosystem-education-implementer.md`](20260530-2330-ecosystem-education-implementer.md) — enumerated all 16 silent-return sites (F1–F10), CSRF-order (F11), pinned-link/teacher-profile web surfaces absent = Phase-3 (F12/F13), retire the `ownsCourse` boolean wrapper (F14), rich-migration per-field Phase-3 verdict + DDL sketch (F15).
2. `ecosystem-security-auditor` → [`…-ecosystem-security-auditor.md`](20260530-2330-ecosystem-security-auditor.md) — CSRF-first (F-01), the throw+audit design (F-02 CRITICAL), resolved ordering (F-03), **Zod failures stay graceful** (F-04), middleware has no CSRF conflict (F-05), docstring fix (F-06), `ownsCourse` body unchanged-fix-at-call-sites (F-07), redact payload safe (F-08), `AuditResult` note (F-09).
3. `ecosystem-db-architect` → [`…-ecosystem-db-architect.md`](20260530-2330-ecosystem-db-architect.md) — 41-table baseline + 0000–0004 pristine (F-01/F-02), **throw+audit needs zero schema change** (F-03), `pinned_links 'global'` non-additive CHECK (F-04 CRITICAL), per-field Phase-3 verdicts (F-05–F-10), text[] PGlite skipIf note (F-11), spine rule (F-12), DATA_MODEL 40→41 doc fix (F-13).
4. `ecosystem-platform-architect` → [`…-ecosystem-platform-architect.md`](20260530-2330-ecosystem-platform-architect.md) — CSRF-first (F1), throw+audit (F2), `@wtc/lms` guards already throw — just call them (F3), audit-code is a spine-first edit (F4), write-scope sequencing (F5), rich-migration Phase-3 (F6), ADR-017 denial-audit convention (F7), INTEGRATION_MAP no change (F8), `ownsCourse` demote (F9), boundary intact (F10).
5. `ecosystem-tests-runner` → [`…-ecosystem-tests-runner.md`](20260530-2330-ecosystem-tests-runner.md) — `retries:2` carry (F-01), CSRF-first (F-02), denial codes + throw (F-03/F-04), **e2e SAFE — no LMS form submission + teacher-layout redirect (F-05 CRITICAL)**, static ordering test (F-06), action-layer ownership test (F-07), rich-migration Phase-3 (F-08).

## Cross-auditor conflicts resolved (operator decisions)

1. **Denial audit code(s).** security/platform wanted ONE `education.access_denied`; tests-runner wanted TWO
   (`education.rbac_denied` + `education.entitlement_denied`). **Decision: TWO codes.** Entitlement denials are routine
   (a user without an active education sub) while rbac/ownership/admin denials are anomalous/suspicious — distinct
   `action` codes let security monitoring alert on the latter without the former's noise. The finer reason
   (`role` | `ownership` | `admin_required` | `<access reason>`) rides in `after.reason`; the attempted operation in
   `after.attempted`. Underscore convention matches every existing `education.*` code.
2. **`result` value: `'failure'` vs `'denied'`.** security-auditor F-09 wanted `AuditResult` widened to include
   `'denied'`; tests-runner D-3 noted the type is `'success'|'failure'`. **Decision: `result:'failure'`, NO type
   change.** The "denied" semantic is fully carried by the fine-grained `*_denied` action code; this matches the
   `auth.login_failed` precedent exactly and avoids a spine type-widening. (If a future single generic code is ever
   adopted, revisit `'denied'`.)
3. **Exception type.** **Decision: `AppError` from `@wtc/shared`** — `'forbidden'` (403) for rbac/ownership,
   `'entitlement_denied'` (402) for entitlement. Same class `assertCsrf` throws; mapped by `toEnvelope`. The pure
   `@wtc/lms` `OwnershipDenied`/`EntitlementDenied` stay the read-layer (queries.ts) decision throw; the action layer
   reuses the pure `assertTeacherOwns` *decision* inside `requireCourseOwnership` and adds the audit + `AppError`.
4. **Zod parse failures.** **Decision: stay graceful (no audit, no throw)** — input errors, not authz events
   (security F-04; consistent with `(auth)/actions.ts`). Same for not-found/unpublished and demo-mode (`getServerDb()`
   null) — those remain honest graceful returns; only **authorization** denials audit+throw.
5. **`ownsCourse` boolean helper.** **Decision: retire it for mutations** — replaced by `requireCourseOwnership`
   (loads the owner via `loadOwnershipContext`, runs the pure `assertTeacherOwns`, audits `ownership` + throws on
   denial; a missing course is treated as a denial — no existence leak). `loadOwnershipContext` (read path) is unchanged.
6. **Rich migration 0005.** **Decision: Phase-3 plan (unanimous).** No DB wave this phase; `db:generate` stays 41 tables.

## Files changed

**Audit spine (single-writer, serialized-first):**
- `packages/audit/src/audit.ts` — `AUDIT_ACTIONS` += `education.rbac_denied`, `education.entitlement_denied` (after the
  `education.pinned_link_*` block) with a comment explaining the two-code rationale + the `after.reason` convention.
  `AuditResult` **unchanged** (`'success'|'failure'`; denials use `'failure'`).

**Feature scope (`apps/web/src/features/lms`, disjoint — single writer):**
- `apps/web/src/features/lms/guard.ts` (**new**, server-only) — `LmsActor`/`DenialCtx` types; `lmsRoles`; the shared
  `auditDenied` (writes `result:'failure'`, `after:{reason,attempted}`, no secrets); and the four gates
  `requireTeacher` / `requireAdmin` / `requireCourseOwnership` (admin-bypass; reuses pure `assertTeacherOwns`) /
  `requireEducationAccess` (fail-closed via `accessFor`). Each gate **audits then throws** on denial.
- `apps/web/src/features/lms/actions.ts` — all 10 actions reordered to **assertCsrf-first**; every silent authz
  `return` replaced with a guard call; `roles()` and `ownsCourse()` local helpers removed (superseded by `guard.ts`);
  imports of `accessFor`/`assertTeacherOwns`/`loadOwnershipContext` dropped from this file (now in `guard.ts`).
  Docstring updated to the corrected canonical pipeline. Zod/not-found/demo branches stay graceful.

**Tests:**
- `packages/audit/src/audit.test.ts` (**new**, 4) — both denial codes registered; `buildEvent` denial round-trips with
  `result:'failure'` + non-secret `after`; memory writer captures the denial; codes stay inside the `AuditAction` union.
- `tests/integration/lms-rbac-pipeline.test.ts` (**new**, 8) — static guarantees over `actions.ts`/`guard.ts` (vitest
  excludes `apps/web/**`, so server actions are asserted by source analysis like `csrf-coverage.test.ts`): all 10
  actions found; `assertCsrf` precedes `requireUser` and is the first await in every action; **none** of the pre-PG7
  silent-return authz patterns remain; the four guard helpers are used; each guard both audits and throws AppError;
  fail-closed codes (`forbidden`/`entitlement_denied`) present.

**Docs (owned-doc truth, serialize-last):**
- `docs/ROADMAP_MASTER.md` §7 (LMS RBAC-throw + CSRF-first → **DONE**; rich migration → Phase-3 plan) + §11
  (per-mutation pipeline → DONE).
- `docs/ARCHITECTURE_DECISIONS.md` — **ADR-017** (denial-audit convention: server actions write a `result:'failure'`
  audit row before throwing on RBAC/ownership/entitlement denial; CSRF-first).
- `docs/DATA_MODEL.md` §0 — 40 → **41 tables** (+ migration 0004 `axioma_handoff_jti_revocations`); doc-only (db-architect F-13).
- `docs/EDUCATION_LMS_PLAN.md` — the Phase-3 rich-migration spec (per-field DDL + the pinned_links CHECK hand-edit
  caveat) + pinned-link/teacher-profile web surfaces marked Phase-3.
- `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md` — operator truth.

## Findings → fixes (summary)

- **F-02 (CRITICAL, silent authz return).** A denied teacher/student/admin mutation returned 200-with-no-effect and
  **wrote no audit row** — the worst case being Teacher A submitting Teacher B's `courseId` (silent, untraceable).
  **Fixed**: every authz denial now writes `education.rbac_denied`/`education.entitlement_denied` (`result:'failure'`,
  `after:{reason,attempted}`) and throws `AppError` (403/402). A missing course is a denial (no existence leak).
- **F-01/F-11 (CSRF ordering).** `assertCsrf` moved to the first awaited statement in all 10 actions.
- **F-04 (CRITICAL DB, pinned_links 'global').** Confirmed non-additive → kept OUT of any migration; Phase-3 hand-edit.
- **e2e safety (F-05).** Verified SAFE: the suite submits **no** LMS form (only navigations), the teacher layout
  redirects non-teachers before any teacher form renders, and `user@wtc.local` holds an active `education` entitlement
  — so no denial path is exercised. e2e stayed 36/36.
- **Package purity / boundaries preserved.** `@wtc/audit` stays zero-dep; `@wtc/lms` pure guards unchanged; the
  audit+throw orchestration lives in the features layer (`guard.ts`), not in React pages.

## Decisions

1. No migration this phase; rich LMS 0005 is a documented Phase-3 plan (unanimous). 41 tables unchanged.
2. Two denial audit codes (`education.rbac_denied` / `education.entitlement_denied`), `result:'failure'`, reason+attempted in `after`. `AuditResult` type unchanged.
3. `AppError('forbidden'|'entitlement_denied')` is the thrown type; pure `@wtc/lms` guards reused for the ownership *decision*.
4. CSRF-first is the canonical server-action ordering; Zod/not-found/demo stay graceful (only authz denials audit+throw).
5. `ownsCourse` retired for mutations → `requireCourseOwnership`; `loadOwnershipContext` (read path) unchanged.
6. Server-action behavior is asserted by **static analysis** (vitest excludes `apps/web/**`) + e2e — the established repo pattern.

## Risks

- **Server actions are not executed in vitest** (apps/web excluded) — the denial audit+throw is covered by static
  source assertions + the `@wtc/audit` building-block tests + e2e, not by an in-process action invocation. A true
  action-execution test would need a real-PG/Next harness (TARGET; B1). Honest gap; mitigated by the static regression
  guard that fails if any silent-return pattern reappears or CSRF-ordering regresses.
- **Coverage stmts 27.2 → 27.12 (−0.08)** — the new app-layer `guard.ts` (98 lines) is in the `apps/web` denominator
  that vitest cannot execute (e2e-covered, not unit-covered); branch held at 74.32%. Same structural pattern noted in
  every prior UI/actions phase; the 80% target is aspirational/not-enforced.
- **Rich LMS UI remains Phase-3** — embed players, file upload (BLOCKED on upload security review), global community
  links, slug URLs, auto-progress. The repos for pinned-links/teacher-profiles exist but have no web surface yet (Phase-3).
- All surfaces still render the honest labelled demo state here (no `DATABASE_URL`); **PGlite is not a substitute for
  real-PG acceptance (B1)** — unchanged.

## Verification/tests — gates RUN vs NOT RUN (per SESSION_PROTOCOL.md §6)

| # | Gate | Result |
|---|------|--------|
| 1 | `npm run check:core` | **PASS** (7 smokes; `@wtc/audit: redaction + buildEvent + memory writer verified`) |
| 2 | `npm run lint` | **PASS** (`--max-warnings 0`, exit 0) |
| 3 | `npm run typecheck` (packages) | **PASS** |
| 4 | `npm run typecheck -w @wtc/web` | **PASS** (guard.ts + actions.ts refactor) |
| 5 | `npm run secret:scan` | **PASS** (clean) |
| 6 | `npm test` (Vitest) | **PASS — 406 passed / 8 skipped (414)** across 39 files (+12 vs 2.9's 394: lms-rbac-pipeline 8, audit 4) |
| 7 | `npm run coverage` | **PASS — 27.12% stmts / 74.32% branch** (branch held; stmts −0.08 = new app-layer guard.ts in the e2e-covered/unit-excluded apps/web denominator; `packages/audit` ↑ 92.48%) |
| 8 | `npm run db:generate -w @wtc/db` | **PASS — 41 tables; "No schema changes, nothing to migrate"** (no migration 0005) |
| 9 | `npm run build -w @wtc/web` | **PASS — app routes compile (teacher/* intact); `ƒ Middleware 35.2 kB`** |
| 10 | `npm run e2e` (Playwright) | **PASS — 36/36** (4.8 min; all green first try — no flake this run; `retries:2` carried for the known dev-only Server-Action recompilation race; teacher/LMS pages render, no denial path exercised) |
| 11 | `npm run governance:check` | **PASS** (current phase `20260530-2330`; 5 cited per-agent handoffs all present) |
| — | `db:migrate` / `db:seed` / real-PG harness | **NOT RUN** — no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; Docker absent (B1). |
| — | **B2 Stripe test-mode checkout** | **NOT RUN** — Q-2 undecided + no Stripe test keys (unchanged). |
| — | **B4 Axioma real activation** | **NOT RUN / TARGET** — OP P-256 key + EXT endpoint shapes (unchanged from PG6). |
| — | `npm ci` | **NOT RE-RUN** — `node_modules` present; not a git repo. |

Not touched (safety): SSH/live servers, live bot control, real adapters/exchange, real Stripe charge, Axioma production
handoff / journal_server, TradingView automation, plaintext exchange keys. `BOT_ADAPTER_MODE=mock` default preserved;
legacy real adapter stays deleted + factory-blocked (B3); all three Axioma terminal CTAs stay disabled (B4).

## Background agents — closed

All 5 per-agent runs in the audit fan-out (Workflow `wf_bc573b81-055`) **completed**. **No agents remain running.**

## Next actions (continuous program — each its own epoch + aggregate)

- **PG8 Admin console** — mobile-readable cards (no 375px horizontal scroll) + honest empty/demo/postgres/blocked state
  pills consuming PG2/PG5 real state. ([`ROADMAP_MASTER.md`](../ROADMAP_MASTER.md) §8.)
- **Phase-3 LMS rich** — migration 0005 (slug/level/tags/content_type/embed_html/file-meta/global-pinned/progress-state)
  as ONE db-architect wave, co-landed with its consumers (retire the derive functions; hand-edit the pinned_links CHECK;
  embed_html only after the sanitizer + file-meta only after the upload security review clears) + pinned-link &
  teacher-profile web surfaces. Spec in the db-architect/education per-agent handoffs + `EDUCATION_LMS_PLAN.md`.
- **Operator-gated (BLOCKED until provided):** real-PG `wtc_test` URL (B1); Stripe provider + test keys (B2); Axioma
  endpoint shapes + P-256 key (B4); legacy plaintext-key upstream fix (B3); git init + remote (B6); Q-6 club+education
  bundling (gates pinned_links 'global'); upload security review (gates material file-meta).
- **Carried:** F-03 structured logger (PG12); CSP per-request nonce; move static headers to `next.config.ts`; F-07
  HS256-secret deprecation; Q-14 SECRET_HINTS coordination; the spec audit-code dot→underscore reconciliation.
- Full register: [`PRODUCTION_BLOCKERS.md`](../PRODUCTION_BLOCKERS.md); ordering: [`EXECUTION_PLAN_MASTER.md`](../EXECUTION_PLAN_MASTER.md).
