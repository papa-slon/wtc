# ecosystem-platform-architect handoff

## Scope

PG7 architecture audit: write-scope boundaries, dead-code-avoidance verdict on the rich LMS
migration (0005), CSRF-first + throw+audit change fit with the `apps/*`/`packages/*` split,
`@wtc/lms` guard adequacy, and platform-owned doc updates implied by PG7.

Epoch: `20260530-2330`. Read-only audit; no source files modified.

---

## Files inspected

- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/handoffs/20260530-2230-phase-2-9-axioma-es256-jti-store.md`
- `docs/EXECUTION_PLAN_MASTER.md`
- `docs/ROADMAP_MASTER.md` (§7 Education/LMS)
- `docs/PRODUCTION_BLOCKERS.md`
- `docs/ARCHITECTURE.md`
- `docs/INTEGRATION_MAP.md`
- `docs/ARCHITECTURE_DECISIONS.md`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `packages/lms/src/errors.ts`
- `packages/lms/src/guards.ts`
- `packages/lms/src/types.ts`
- `packages/lms/src/index.ts`
- `packages/lms/src/lms.test.ts` (glob-confirmed present)
- `packages/audit/src/audit.ts`
- `packages/config/src/env.ts`
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/lib/backend.ts`
- `packages/db/src/schema.ts` (education tables only)

---

## Files changed

None — read-only audit

---

## Findings

### F1 — HIGH — CSRF-first ordering: assertCsrf moves before requireUser
**Evidence:** `apps/web/src/features/lms/actions.ts:56-58`, `72-74`, `87-90`, `103-106`, `118-121`,
`134-137`, `150-153`, `166-170`, `181-183`, `207-210`.
All 10 exported actions call `const user = await requireUser()` as the FIRST await, then
`await assertCsrf(formData)` second. The intended canonical pipeline is
`assertCsrf → requireUser → Zod → RBAC → …`.

**Why safe to swap:** `assertCsrf` (`apps/web/src/lib/csrf.tsx:31-35`) reads the session cookie
directly via `cookies()` and derives a HMAC — it has ZERO dependency on the `user` object. It is
fully independent of `requireUser()`. Swapping the order is purely mechanical; no logic changes.
An unauthenticated call that fails `requireUser()` would previously execute before CSRF validation
ran. CSRF-first is the stronger defence (no RBAC-bypass surface on CSRF fail paths).

**Recommendation:** For each action, move `await assertCsrf(formData)` to the FIRST line (before
`requireUser`). No functional changes elsewhere needed for this workstream item.

**Target area:** `apps/web/src/features/lms/actions.ts` (feature scope, single writer).

---

### F2 — HIGH — Silent RBAC/ownership/entitlement returns: missing throw + audit
**Evidence:** 10 silent `return` guards in `apps/web/src/features/lms/actions.ts`:
- Line 60: `if (!isTeacher) return;` — createCourseAction RBAC
- Line 76-78: `if (!isTeacher) return;` — updateCourseAction RBAC
- Line 82: `if (!(await ownsCourse(...))) return;` — updateCourseAction ownership
- Line 91-93: `if (!isTeacher) return;` — setCoursePublishedAction RBAC
- Line 97: `if (!(await ownsCourse(...))) return;` — setCoursePublishedAction ownership
- Line 107-109: `if (!isTeacher) return;` — createLessonAction RBAC
- Line 113: `if (!(await ownsCourse(...))) return;` — createLessonAction ownership
- Line 123-125: `if (!isTeacher) return;` — setLessonPublishedAction RBAC
- Line 128: `if (!(await ownsCourse(...))) return;` — setLessonPublishedAction ownership
- Line 137-139: `if (!isTeacher) return;` — createMaterialAction RBAC
- Line 145: `if (!(await ownsCourse(...))) return;` — createMaterialAction ownership
- Line 153-155: `if (!isTeacher) return;` — deleteMaterialAction RBAC
- Line 159: `if (!(await ownsCourse(...))) return;` — deleteMaterialAction ownership
- Line 172: `if (!access.allowed) return;` — enrollAction entitlement (student)
- Line 188: `if (!access.allowed) return;` — markLessonCompleteAction entitlement (student)
- Line 212: `if (!isAdmin) return;` — adminEnrollAction RBAC

Every listed guard is a NO-OP on denial: the caller receives no error, the event is not recorded
in the audit log, and a DENIED attempt is indistinguishable from a successful no-op. This means
(a) silent privilege escalation attempts are invisible in the audit trail, (b) no `result='failure'`
row in `audit_logs` for RBAC/entitlement denials, and (c) the caller sees `void` regardless of
whether the action succeeded or was blocked.

**What the fix requires:** Replace each `return` with (1) a write to the `audit` writer from
`@/lib/backend` with `result: 'failure'` and the relevant `education.*` action code, THEN (2) throw
a typed error (e.g. `OwnershipDenied` / `EntitlementDenied` from `@wtc/lms`, or a plain
`AppError('forbidden', ...)` from `@wtc/shared`). The audit write must use an existing
`education.*` code; no new codes are needed for the throw itself (the repo already writes a success
audit; the denial audit is the new `result:'failure'` row before the throw).

**Important:** the `ownsCourse` helper (lines 39-49) currently wraps `assertTeacherOwns` in a
try/catch and returns a boolean — it suppresses the guard's throw. The fix must either
(a) refactor `ownsCourse` to re-throw after auditing, or
(b) call `assertTeacherOwns` directly in the action body (outside the helper) so the throw
propagates after the audit write, rather than being caught and converted to `false`.

**Target area:** `apps/web/src/features/lms/actions.ts` (feature scope).

---

### F3 — INFO — `@wtc/lms` guards are correct and sufficient; no re-implementation needed
**Evidence:** `packages/lms/src/guards.ts:20-31` — `assertTeacherOwns` throws `OwnershipDenied`
on failure. `packages/lms/src/guards.ts:29-31` — `assertEducationAccess` throws `EntitlementDenied`
on failure. `packages/lms/src/errors.ts:1-21` — typed error hierarchy with `code` discriminants.

The guards are pure (no I/O), injected with the already-loaded values, and already throw correctly.
The actions layer needs only to (a) call the guards directly instead of wrapping them in a
try/catch boolean converter, and (b) write a denial audit row before the throw propagates.

No changes to `packages/lms/src/guards.ts` or `packages/lms/src/errors.ts` are needed.

**Boundary confirmation:** the guards live in `packages/lms` (domain layer, pure). The denial
audit write lives in the feature (`apps/web/src/features/lms/actions.ts`). Business logic stays
in packages; the action file is the correct integration point.

**Target area:** n/a — informational confirmation.

---

### F4 — MEDIUM — No `education.access_denied` / `education.rbac_denied` audit code exists
**Evidence:** `packages/audit/src/audit.ts:82-97` — all education codes are success-event codes
(course_create, lesson_create, enroll, progress, etc.). There is no denial code for
RBAC/ownership/entitlement blocks on LMS mutations.

**Recommendation:** Add one or more denial audit codes to `AUDIT_ACTIONS` in
`packages/audit/src/audit.ts`. The minimal addition is a single cross-cutting code, e.g.
`'education.access_denied'` (covers both RBAC and entitlement denials; the `before`/`after`
payload distinguishes the denial type). Alternatively, two fine-grained codes:
`'education.rbac_denied'` and `'education.entitlement_denied'`.

Rationale for the single code: the PG6 precedent used `axioma.handoff_jti_replay` (one code per
semantic event, not one per action). The audit row's `targetType` + `before` payload already
carries enough context to distinguish the denial trigger. Using a single `education.access_denied`
also avoids proliferating codes beyond what is consumed.

This is a spine-file change (`packages/audit/src/audit.ts` is serialized per ADR-014 /
EXECUTION_PLAN_MASTER.md §1). It must be committed in the DB wave / serial spine step before the
actions file is updated.

**Target area:** `packages/audit/src/audit.ts` (spine, serialized).

---

### F5 — MEDIUM — Write-scope map for PG7: confirm disjoint ownership
**Evidence:** `docs/EXECUTION_PLAN_MASTER.md §1` — spine files are serialized.
`docs/EXECUTION_PLAN_MASTER.md §5` — LMS feature dir is disjoint-safe.

PG7 touches these files, with the following ownership assignments:

| File | PG7 writer | Spine status |
|---|---|---|
| `apps/web/src/features/lms/actions.ts` | education-implementer | Disjoint-safe (LMS feature scope) |
| `packages/audit/src/audit.ts` | spine — serialize FIRST (add denial code) | Spine file |
| `packages/lms/src/{guards,errors}.ts` | NO CHANGE needed | Read-only for PG7 |
| `packages/db/src/schema.ts` | db-architect ONLY, IF 0005 is decided | Spine file; migration wave first |
| `packages/db/src/repositories.ts` | db-architect ONLY, IF 0005 is decided | Spine file |
| `apps/web/src/lib/backend.ts` | NO CHANGE needed for throw+audit fix | Spine file |
| `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md` | operator-only, serialize-last | Operator-owned spine |

The `audit.ts` denial-code addition is the ONLY spine-file change needed for workstreams 1 and 2
(CSRF-first + throw+audit). It serializes before `actions.ts` edits. No `packages/db` changes are
needed for those two workstreams.

**Target area:** operator sequencing note.

---

### F6 — MEDIUM — Rich migration (0005) verdict: Phase-3 plan (not do-now)
**Evidence:** `packages/db/src/schema.ts:181-211, 394-448` — confirmed lean schema: courses has
`title`/`description`/`published`/`productCode`/`ownerTeacherId`/`teacherProfileId`; lessons has
`title`/`body`/`videoUrl`/`order`/`published`; materials has `label`/`url`/`kind`; lesson_progress
has `percentComplete`/`completed`/`lastAccessedAt`; pinned_links has
`ownerType`/`ownerId`/`label`/`url`/`iconType`/`sortOrder`. None of the rich candidates exist.

Candidate assessment per the dead-code-avoidance principle (PG4 checkout + PG6 web-signer-resolver
precedent — a column with no consumer this phase is dead schema):

| Candidate column | PG7 consumer? | Verdict |
|---|---|---|
| course `slug` | None (no slug URL routing built this phase) | Phase-3 plan |
| course `level` / `tags` | None (no filter/search UI this phase) | Phase-3 plan |
| lesson `content_type` explicit | DERIVED today via `deriveContentType(videoUrl)` in queries.ts:54; no consumer of an explicit column | Phase-3 plan |
| lesson `embed_html` | Embed player UI is explicitly Phase-3 per ROADMAP §7; file upload BLOCKED (upload security review) | Phase-3 plan |
| material file-meta (`size`/`mime`) | File upload BLOCKED (upload security review per ROADMAP §7) | Phase-3 plan |
| pinned_links `global` owner_type | Global community links need Q-6 bundling decision (OPEN); no admin UI this phase | Phase-3 plan |
| lesson_progress explicit state-machine column | Progress is DERIVED today via `deriveLessonState`; no rich UI consumer this phase | Phase-3 plan |

**Verdict: all 0005 candidates are Phase-3 plan.** PG7 should NOT introduce migration 0005.

Rationale: (1) every candidate has either a blocked upstream dependency (file upload review,
Q-6 decision) or no consuming UI this phase; (2) adding schema without a consumer is explicitly
prohibited by the project discipline (dead-code-avoidance, ADR-014 wave-first pattern); (3) the
ROADMAP already labels the rich UI as Phase-3; (4) migration 0005 would become a mandatory
non-optional spine touch for db-architect before the consumer workstreams that do NOT need it.

For `content_type`: the existing derivation (`videoUrl ? 'video' : 'article'`) already covers the
MVP content types. A Phase-3 migration can add an explicit column when an `audio`/`document`/
`embed` type needs to be stored without breaking the derive logic.

**Target area:** db-architect and operator decision note.

---

### F7 — LOW — ADR for denial-audit convention is warranted
**Evidence:** `docs/ARCHITECTURE_DECISIONS.md` — 16 ADRs exist (ADR-001 through ADR-016, the last
being APP_ENV from PG6). The current audit model has no recorded decision for "denied attempt
produces an audit row with `result:'failure'`". The PG6 aggregate notes `consumeHandoffJti`'s pure
primitive design (no inline audit) and records the distinction. PG7 introduces denial auditing as
a new pattern for the LMS surface; without an ADR it is an unrecorded convention.

**Recommendation:** Append ADR-017 to `docs/ARCHITECTURE_DECISIONS.md` in the aggregate step:

  "ADR-017 — LMS/actions denial-audit convention: when an RBAC, ownership, or entitlement check
  fails in a server action, write an audit row with `result:'failure'` BEFORE throwing the typed
  error. The audit writer is the `audit` export from `@/lib/backend`. The action code uses the
  pre-registered `education.access_denied` code (or the relevant fine-grained code). The throw
  propagates to the Next.js action error boundary; callers receive a failure, not a void no-op."

This is a platform-owned doc update (ARCHITECTURE_DECISIONS.md is append-only, owned by
ecosystem-platform-architect). It may be written in the aggregate step, not in a consumer-wave
agent.

**Target area:** `docs/ARCHITECTURE_DECISIONS.md` (append in aggregate step).

---

### F8 — LOW — INTEGRATION_MAP and ARCHITECTURE.md do NOT need PG7-specific updates
**Evidence:** `docs/INTEGRATION_MAP.md` — LMS is an internal module (no external touchpoint); its
boundaries are not affected by CSRF-first ordering or denial auditing. `docs/ARCHITECTURE.md §5`
mutation pipeline already states "Zod → session auth → RBAC → entitlement → business logic →
audit → response" — the CSRF-first ordering and throw+audit changes refine the implementation of
that pipeline but do not change its documented shape. `docs/ARCHITECTURE.md §7` feature-dir layout
is already correct for the LMS feature.

The only platform-doc work needed is (a) ADR-017 (denial-audit convention, see F7) and (b) a
one-paragraph update to §5 clarifying that server actions run `assertCsrf` FIRST (before session
resolution), distinct from route handlers where Zod runs first. This is a minor clarification, not
a structural change.

**Target area:** `docs/ARCHITECTURE.md §5` mutation pipeline note (minor, aggregate step).

---

### F9 — INFO — `ownsCourse` boolean helper hides the throw; must be refactored for correct audit
**Evidence:** `apps/web/src/features/lms/actions.ts:39-49` — `ownsCourse` calls
`assertTeacherOwns` inside a `try { return true } catch { return false }`. This catch silently
discards the `OwnershipDenied` throw.

For the throw+audit fix to work correctly: either
(a) inline the guard call directly in each action (remove the `ownsCourse` boolean helper), or
(b) keep a helper but refactor it to re-throw after writing the audit row.

Option (a) is cleaner — the action body sees the exact denial type and can write the audit row
with the correct code before re-throwing. Option (b) means the helper needs an audit writer
parameter, which couples it to the web layer (`@/lib/backend` export). Option (a) is preferred
because it keeps the helper pure (usable for read-path ownership checks in queries.ts without
audit coupling) and makes each action's denial path explicit.

**Recommendation:** Remove or demote the `ownsCourse` boolean helper. Call `assertTeacherOwns`
(injecting the loaded context) directly in each teacher-mutation action body after loading
`loadOwnershipContext`. The guard's `OwnershipDenied` throw becomes the natural deny path; the
audit write happens in the action body just before.

**Target area:** `apps/web/src/features/lms/actions.ts`.

---

### F10 — INFO — Boundary integrity: no LMS logic has leaked into React pages
**Evidence:** verified via grep of `packages/lms/src/guards.ts` and cross-check with
`apps/web/src/features/lms/queries.ts:1` (`import 'server-only'`). The queries file uses
`assertTeacherOwns` from `@wtc/lms` for the teacher read-isolation path (queries.ts:115). The
page files themselves are thin shells (consistent with ADR-013). Business logic is in `packages/lms`
and `features/lms/`; nothing has leaked into `app/(teacher)/...` or `app/(app)/...` page files.

The planned throw+audit changes stay inside `features/lms/actions.ts`, consistent with the
established boundary. No page.tsx file needs modification.

**Target area:** n/a — boundary confirmed intact.

---

## Decisions

1. **Rich migration 0005: Phase-3 plan.** All seven candidate columns have no consuming UI this
   phase (or are blocked by an upstream dependency). PG7 must NOT introduce migration 0005.
   `ecosystem-db-architect` should record this as a "no-migration" result in their handoff. The
   Phase-3 plan note belongs in ROADMAP_MASTER.md §7 (operator to update in the aggregate step).

2. **Audit code for denials: `education.access_denied`.** A single new code added to
   `packages/audit/src/audit.ts` before the actions-file edits. Spine-file serialization required.
   Fine-grained split (rbac_denied / entitlement_denied) is optional; a single cross-cutting code
   is sufficient and consistent with the axioma jti code pattern.

3. **`ownsCourse` helper: demote to read-path only or remove.** Inline `assertTeacherOwns` in
   teacher-mutation action bodies to make the denial path explicit and auditable.

4. **ADR-017 (denial-audit convention): write in aggregate step.** Owned by ecosystem-platform-
   architect; append to `docs/ARCHITECTURE_DECISIONS.md`.

5. **ARCHITECTURE.md §5 clarification: assertCsrf-first note for server actions.** Minor update in
   the aggregate step; does not change the documented mutation pipeline shape.

6. **INTEGRATION_MAP.md: no PG7 update needed.** LMS is an internal module; no external touchpoint
   changes.

---

## Risks

1. **`ownsCourse` refactor scope-creep.** If the boolean helper is used in both mutation paths and
   read-paths in queries.ts, removing it may require changes to queries.ts (a disjoint but shared
   file). Verify: `queries.ts` imports and uses `assertTeacherOwns` directly (line 115-120), NOT
   `ownsCourse`. The `ownsCourse` helper is defined AND used exclusively in `actions.ts`. So the
   refactor is contained to `actions.ts` only — no queries.ts edits needed.

2. **Audit write in demo mode.** The `audit` export from `@/lib/backend` is a `createMemoryAuditWriter`
   in demo mode (no DATABASE_URL). Denial audit rows will be written to the in-memory store in demo
   mode, which is correct (they surface in the admin audit log even in demo). No special guard needed;
   the existing audit writer already handles the demo case.

3. **`assertCsrf` throw vs `requireUser` throw ordering on unauthenticated calls.** Moving
   `assertCsrf` first means an unauthenticated request (no session) that also lacks a valid CSRF token
   will fail with `AppError('forbidden', 'CSRF validation failed')` rather than `'UNAUTHENTICATED'`.
   This is intentional and more secure (no session-existence disclosure). The e2e smoke tests log in
   before any action; this change does not affect them.

4. **Spine serialization window.** Adding `education.access_denied` to `audit.ts` must happen BEFORE
   the `actions.ts` edit (the code is referenced in actions.ts). The governance check will flag if the
   implementation agent edits `actions.ts` without the audit code existing. Sequencing: audit.ts edit
   → typecheck → actions.ts edit.

---

## Verification/tests

Tests the implementer should add (not this agent's scope to write — read-only audit):

1. Unit tests for the denial-audit pattern: for each action with an RBAC/ownership/entitlement
   guard, assert that a denial attempt (wrong role / wrong owner / no entitlement) results in
   (a) an `education.access_denied` audit event with `result:'failure'`, AND (b) the action
   throws (rather than returning void). Use the existing `createMemoryAuditWriter` pattern from
   `packages/audit`.

2. Confirm `assertCsrf` is called FIRST: the existing e2e smoke tests that exercise LMS server
   actions will continue to pass after the ordering change (since they always supply a valid CSRF
   token). No new e2e test needed; existing coverage is sufficient.

3. Governance gate: `npm run governance:check` must pass after PG7 (5 per-agent handoffs cited
   in the aggregate).

---

## Next actions

**Serial implementation order for PG7 (workstreams 1 + 2 — CSRF-first + throw+audit):**

1. **Spine step (serialized):** add `'education.access_denied'` to `AUDIT_ACTIONS` in
   `packages/audit/src/audit.ts`. Run `npm run typecheck` and `npm test` — green.

2. **Feature step (disjoint-safe):** edit `apps/web/src/features/lms/actions.ts`:
   a. Move `await assertCsrf(formData)` to the first line of each action.
   b. Demote `ownsCourse` to a read-path boolean (remove from mutation path).
   c. In each teacher-mutation action: call `loadOwnershipContext` then `assertTeacherOwns`
      directly; write `audit.write({ action:'education.access_denied', result:'failure', ... })`
      BEFORE re-throwing the error.
   d. In student actions (`enrollAction`, `markLessonCompleteAction`): after `accessFor`, if
      `!access.allowed`, write `audit.write({ action:'education.access_denied', result:'failure',
      actorUserId:user.id, targetType:'education', ... })` then throw `EntitlementDenied` (or
      `AppError('forbidden', ...)`).
   e. In `adminEnrollAction`: if `!isAdmin`, write denial audit row then throw.

3. **Tests step:** add unit tests for the denial-audit + throw pattern.

4. **Full gates:** `governance:check` / `check:core` / `lint` / `typecheck×2` / `secret:scan` /
   `test` / `coverage` / `db:generate` (confirms no migration) / `build` / `e2e`.

5. **Aggregate step (operator):** append ADR-017 to `docs/ARCHITECTURE_DECISIONS.md`; add minor
   §5 note in `docs/ARCHITECTURE.md`; update `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`,
   `docs/IMPLEMENTED_FILES.md` (serialize-last).

**PG7 workstream 3 (rich migration 0005): DO NOT IMPLEMENT THIS PHASE.** Document as Phase-3
plan in ROADMAP_MASTER.md §7 (operator-aggregate step only).
