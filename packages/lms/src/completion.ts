/**
 * Pure progress/completion math for the LEAN lesson_progress schema (percent_complete + completed).
 * No DB; fully unit-testable. The DB repos (upsertLessonProgress / markEnrollmentComplete /
 * listCourseProgress) own persistence; this derives the view fields from rows.
 */
import type { LessonState } from './types.ts';

/** Overall course completion %, clamped, based on published lessons completed. */
export function courseProgressPct(totalPublished: number, completed: number): number {
  if (totalPublished <= 0) return 0;
  return Math.round((Math.min(completed, totalPublished) / totalPublished) * 100);
}

/** A course is complete when there is at least one published lesson and all are completed. */
export function isCourseComplete(totalPublished: number, completed: number): boolean {
  return totalPublished > 0 && completed >= totalPublished;
}

/** Derive lesson state + pct from a lean lesson_progress row (null = not started). */
export function deriveLessonState(
  row: { completed: boolean; percentComplete: string | number } | null,
): { state: LessonState; progressPct: number } {
  if (!row) return { state: 'not_started', progressPct: 0 };
  if (row.completed) return { state: 'completed', progressPct: 100 };
  const pct = Math.max(0, Math.min(100, Math.round(Number(row.percentComplete))));
  return { state: pct > 0 ? 'started' : 'not_started', progressPct: pct };
}

/** Enrollment source derived from the entitlement link (null FK = manual/admin enrollment). */
export function enrollmentSource(entitlementId: string | null): 'entitlement' | 'manual_admin' {
  return entitlementId == null ? 'manual_admin' : 'entitlement';
}

/** Presentational tone for a course level badge (kept out of the React pages — AGENTS.md §logic-in-packages).
 *  Values are a subset of the @wtc/ui StatusPill `Tone` union. */
export function levelTone(level: string): 'neutral' | 'warn' | 'gold' {
  return level === 'advanced' ? 'gold' : level === 'intermediate' ? 'warn' : 'neutral';
}

// NOTE: deriveContentType(videoUrl) was retired in Phase 3.1 (migration 0005) — lessons.content_type is
// now the authoritative column (backfilled from video_url). Read row.contentType directly; do not re-derive.
