# Handoff: ecosystem-education-implementer — Phase 0

**Date:** 2026-05-29  
**Agent:** ecosystem-education-implementer  
**Phase:** 0 — Documentation

---

## Scope

Write `docs/EDUCATION_LMS_PLAN.md` — the canonical design specification for the WTC Education / LMS module (product code `education`, route slug `education`). This covers RBAC, object-ownership enforcement, data shapes, `packages/lms` service surface, entitlement integration, UI route structure, progress tracking, content delivery, audit events, and the teacher/student/admin experience.

---

## Files Inspected (read-only)

| File | Purpose |
|------|---------|
| `docs/handoffs/0000-orchestrator-seed.md` | Canonical decisions: roles, product codes, plan codes, entitlement states, table names, design tokens, hard rules |
| `C:/Users/maxib/GTE BOT/bot_tortila/ECOSYSTEM_PLATFORM_CLOUD_CODE_PROMPT.md` | Education/LMS feature requirements, security requirements, roles |
| `C:/Users/maxib/GTE BOT/bot_tortila/WTC_ECOSYSTEM_ARCHITECTURE_BLUEPRINT.md` | Monorepo structure, `packages/lms` package definition, API namespace |
| `C:/Users/maxib/GTE BOT/bot_tortila/WTC_ECOSYSTEM_DISCOVERY_MAP.md` | Existing platform state, integration boundaries |

Existing platform state inspected (PowerShell, read-only):
- `packages/lms/src/` — empty stub directory, no existing code.
- `packages/entitlements/src/` — empty stub directory.
- `docs/` — contains `ARCHITECTURE_DECISIONS.md`, `STATUS.md`, `NEXT_ACTIONS.md`, `handoffs/0000-orchestrator-seed.md`.

---

## Files Changed / Created

| File | Action |
|------|--------|
| `docs/EDUCATION_LMS_PLAN.md` | **Created** — full LMS specification |
| `docs/handoffs/20260529-phase0-ecosystem-education-implementer.md` | **Created** — this handoff |

No existing files were modified.

---

## Findings

1. `packages/lms` exists as an empty directory stub (`src/` only). The package needs `package.json`, `tsconfig.json`, and all source files created in Phase 4.
2. `packages/entitlements` similarly has only an empty `src/` stub. The `packages/lms` service will call it via its exported `hasAccess` function; that contract is documented in the LMS plan.
3. No existing education content, courses, or lesson data exists in the platform yet.
4. The discovery map confirms the design reference `v3-editorial-authority.html` was identified as a direction for club/education UI. The LMS plan applies the seed design tokens (`--bg:#050a12`, `--gold:#d5a94f`, etc.) rather than a lighter editorial style, consistent with the terminal-first premium direction.
5. The seed's `teacher_profiles` table name and `Education` schema group are used exactly as specified.

---

## Decisions

| Decision | Rationale |
|----------|-----------|
| `packages/lms` never queries `entitlements` or `subscriptions` tables directly; it calls `packages/entitlements.hasAccess()` | Maintains single source of truth; satisfies the seed's "entitlements are the only access source of truth" rule |
| Object-ownership check (`assertTeacherOwns`) is a server-side guard inside `packages/lms/src/guards/ownership.ts`, called in every teacher-facing service method | Satisfies seed hard rule: "Teacher object-ownership enforced; students cannot enumerate hidden/unentitled content" |
| `courses.product_code` can be set to a specific product code (e.g. `tortila_bot`, `axioma_terminal`) to grant access via that product's entitlement instead of the generic `education` entitlement | Supports product-specific education access requirement from the prompt; bundle expansion is still handled by entitlements package |
| Draft/unpublished content returns `404` (not `403`) to non-owners | Prevents enumeration of draft lesson existence by students |
| Material `file_key` is never returned in any API response; download is always through a signed-URL endpoint | Prevents direct storage object exposure; satisfies exchange/secret key security pattern extended to education files |
| `embed_html` sanitized with an allowlist before storage (not at render time) | Prevents stored XSS; simpler render path |
| Student PII excluded from teacher-facing `getCourseStudentList` response | Privacy: teacher needs progress data, not email/credentials |
| Progress update debounced: client-side max 1/10s, server-side ignores if `last_seen_at > NOW()-8s` | Prevents abuse; reduces DB write load on video scrub |

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `packages/lms` is an empty stub — Phase 4 implementers must create `package.json`, `tsconfig.json`, and all source files from scratch following this spec | Medium | This spec provides complete function signatures, Zod schemas, and file structure |
| `packages/entitlements.hasAccess()` API shape is not yet finalised (package stub only) | Medium | LMS spec documents the expected interface; entitlements implementer must honour it |
| Material file upload requires a real S3/R2 bucket — not available at MVP | Low | Documented as TODO in section 18; interface is defined, adapter is stubbed |
| Embed sanitizer must be a server-side allowlist implementation — Node does not ship a DOM parser | Medium | Use `dompurify` + `jsdom` in Node, or a Rust/WASM HTML cleaner. Phase 4 implementer to select and pin |
| Teacher drag-and-drop lesson reorder requires a client-side DnD library (not yet in `packages/ui`) | Low | `@dnd-kit/core` recommended; Phase 4 UI implementer adds to `packages/ui` |
| Video self-hosting (HLS) not planned for MVP — all video via external URL | Low | Documented in section 18; Vimeo private embeds are the recommended MVP approach |

---

## Tests / Verification

Unit tests required in `packages/lms` (Vitest, no DB/network):
- `assertTeacherOwns`: rejects when `course.teacher_profile_id != teacherProfile.id`.
- `assertTeacherOwns`: rejects when no `teacher_profiles` row exists for `userId`.
- `canAccessCourse`: calls `entitlements.hasAccess` with correct product code.
- `sanitizeEmbedHtml`: strips `<script>`, `on*` attributes, `data:` URIs, non-https `src`.
- `upsertProgress`: transitions `state` to `completed` when `progressPct >= 95`.
- `upsertProgress`: sets `enrollments.completed_at` when all published lessons completed.
- `getMaterialDownloadUrl`: never returns `file_key` in the return value.
- `listPublishedCourses`: does not return draft/unpublished courses.

Integration tests (requires test DB):
- End-to-end: student with `active` entitlement can read a published lesson.
- End-to-end: student with `expired` entitlement receives `EntitlementDenied`.
- End-to-end: teacher can create a lesson in own course.
- End-to-end: teacher cannot update another teacher's lesson (returns `OwnershipDenied`).
- End-to-end: student cannot enumerate draft lessons (returns 404, not 403).

Playwright e2e (Phase 4):
- Student sees locked card for unentitled course.
- Student sees progress ring and "Continue" CTA for entitled course.
- Teacher can create a course and lesson; sees it in own dashboard.
- Teacher cannot see courses owned by other teachers in their dashboard.

---

## Next Actions

1. **Phase 4 — `packages/lms` implementation**: create `package.json`, `tsconfig.json`, and all `src/` files following the function signatures, schemas, and error types in `docs/EDUCATION_LMS_PLAN.md` sections 5.1–5.3.
2. **Phase 4 — `packages/entitlements`**: finalize `hasAccess(userId, productCode)` return type (must include `{ allowed: boolean, state: EntitlementState, reason: string }`). LMS depends on this exact shape.
3. **Phase 4 — `apps/web` teacher routes**: scaffold `/teacher/courses`, `/teacher/courses/[courseId]`, `/teacher/courses/[courseId]/lessons/[lessonId]`, `/teacher/students`, `/teacher/community`.
4. **Phase 4 — `apps/web` student routes**: scaffold `/app/education`, `/app/education/[courseSlug]`, `/app/education/[courseSlug]/[lessonSlug]`.
5. **Phase 4 — `apps/web` admin routes**: scaffold `/admin/education` subtree.
6. **Phase 4 — DB migrations**: add Education table group DDL (`courses`, `lessons`, `materials`, `enrollments`, `lesson_progress`, `teacher_profiles`, `pinned_links`) to `packages/db` migrations.
7. **Phase 4 — embed sanitizer**: select and integrate `dompurify` + `jsdom` (or equivalent) in `packages/lms`. Write unit tests for the allowlist.
8. **Phase 4 — material upload**: stub `uploadMaterial` service function with S3-compatible interface. Wire real bucket in Phase 7 devops.
9. **Phase 5 — worker jobs**: add email/Telegram notification on course completion; add entitlement expiry check that triggers student access-wall update.
10. **Update `docs/STATUS.md`** and `docs/NEXT_ACTIONS.md` to reflect Phase 0 education doc complete.
