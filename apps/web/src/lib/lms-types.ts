/**
 * Async LMS service — the app-layer interface the teacher/education pages call. Both the DB-backed
 * adapter (lib/db-store.ts) and the in-memory dev adapter (lib/demo.ts) implement it; lib/backend.ts
 * selects between them (fail-closed in production without DATABASE_URL). Async shape ⇒ a missing
 * `await` at a call site is a typecheck error.
 *
 * Part E = THIN model only (create/list courses, student lesson view). It is NOT the full
 * docs/EDUCATION_LMS_PLAN.md contract (no enrollments/lesson_progress/teacher_profiles) — that is
 * the Phase 1.8 work.
 */
import type { CourseDTO, LessonDTO } from '@wtc/db';

/** UI-facing course: createdAt as epoch-ms (no raw Date leaks to the client). */
export type CourseView = CourseDTO;
export type LessonView = LessonDTO;

export interface LmsActor {
  userId: string;
  isAdmin: boolean;
}

export interface LmsService {
  createCourse(actor: LmsActor, input: { title: string; description?: string; published?: boolean }, now: number): Promise<CourseView>;
  listCoursesForTeacher(actor: LmsActor): Promise<CourseView[]>;
  listPublishedCourses(): Promise<CourseView[]>;
  /** Fail-closed: returns [] without education access or for an unpublished course. */
  listLessonsForStudent(courseId: string, hasEducationAccess: boolean): Promise<LessonView[]>;
}
