/**
 * LEAN LMS view types — mapped to the ACTUAL 38-table schema (migration 0002), NOT the rich design.
 * Rich fields that have no column (slug/is_featured/global pinned)
 * are intentionally absent; derived/default fields are documented inline. Timestamps are epoch-ms
 * (no raw Date leaks to the client). See docs/handoffs/20260530-1042-ecosystem-education-implementer.md.
 */
import type { LmsFileScanStatus } from './materials.ts';

export type LessonState = 'not_started' | 'started' | 'completed';
// 0005 (Phase 3.1): the authoritative content_type column. 'embed' is a future-valid value (DB CHECK
// allows it) but NO write path accepts it and NO render path emits raw HTML for it this session — it
// needs a server-side sanitizer first (stored-XSS gate). Kept in the union so render switches stay exhaustive.
export type ContentType = 'video' | 'embed' | 'article' | 'link';
export type MaterialType = 'link' | 'file' | 'embed';
export type PinnedOwnerType = 'teacher_profile' | 'course';

export interface TeacherProfileView {
  id: string;
  userId: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  socialLinks: Record<string, string>;
  isActive: boolean;
}

export interface CourseView {
  id: string;
  title: string;
  description?: string;
  productCode: string;
  isPublished: boolean; // mapped from courses.published
  createdAt: number;
  level: string; // 0005: 'beginner' | 'intermediate' | 'advanced' (NOT NULL DEFAULT → always present)
  tags: string[]; // 0005: display/write only (no tag-filter query)
}

/** Teacher/admin view with computed counts. */
export interface CourseAdminView extends CourseView {
  ownerTeacherId: string;
  teacherProfileId?: string;
  lessonCount: number; // all lessons
  publishedLessonCount: number;
  enrolledCount: number;
}

export interface LessonView {
  id: string;
  courseId: string;
  title: string;
  body?: string; // plain text / markdown — rendered escaped, never as raw HTML
  videoUrl?: string;
  embedHtml?: string;
  sortOrder: number; // mapped from lessons.order
  isPublished: boolean;
  contentType: ContentType; // 0005: read from the lessons.content_type column (no longer derived)
  externalUrl?: string; // 0005: companion to contentType === 'link' (https only — guarded on render)
}

export interface MaterialView {
  id: string;
  lessonId: string;
  title: string; // mapped from materials.label
  materialType: MaterialType; // mapped from materials.kind
  externalUrl?: string; // mapped from materials.url for link materials
  downloadUrl?: string; // server route for file materials
  sizeBytes?: number;
  scanStatus?: LmsFileScanStatus;
  embedHtml?: string;
}

export type TeacherMaterialView = MaterialView;

/** Per-lesson progress, derived from the lean lesson_progress row. */
export interface ProgressView {
  lessonId: string;
  state: LessonState;
  progressPct: number;
  lastSeenAt?: number;
}

export interface CourseProgressSummary {
  courseId: string;
  totalLessons: number; // published lessons
  completedLessons: number;
  progressPct: number; // 0–100
  completedAt?: number; // from enrollments.completed_at
}

export interface EnrollmentView {
  courseId: string;
  enrolledAt: number;
  completedAt?: number;
  source: 'entitlement' | 'manual_admin'; // derived: entitlementId null → manual_admin
}

/** Teacher/admin student list — data-minimal: NEVER email/raw userId/session. */
export interface StudentProgressSummary {
  displayName: string;
  enrolledAt: number;
  completedLessons: number;
  totalLessons: number;
  progressPct: number;
}

export interface PinnedLinkView {
  id: string;
  ownerType: PinnedOwnerType;
  ownerId: string;
  label: string;
  url: string;
  iconType?: string;
  sortOrder: number;
}
