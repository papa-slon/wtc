/**
 * @wtc/lms — education domain. See docs/EDUCATION_LMS_PLAN.md.
 * Object ownership is enforced here (teachers edit only their own content); students see only
 * entitled, published content and cannot enumerate hidden/unentitled lessons (fail-closed).
 * RBAC role gating is enforced at the route via @wtc/auth; this layer enforces ownership + visibility.
 *
 * Phase 2.2 adds the LEAN full-LMS domain (mapped to the actual 38-table schema): view types,
 * error hierarchy, pure ownership/entitlement guards, and pure progress/completion math. The web
 * glue (features/lms — getServerDb + @wtc/db repos) maps DB rows to these view types.
 */
import type { LmsFileScanStatus } from './materials.ts';

export * from './errors.ts';
export * from './types.ts';
export * from './guards.ts';
export * from './completion.ts';
export * from './urls.ts';
export * from './materials.ts';
export * from './object-storage.ts';
export * from './external-scanner.ts';

export interface Course {
  id: string;
  ownerTeacherId: string;
  title: string;
  description?: string;
  productCode: 'education' | 'club';
  published: boolean;
  createdAt: number;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  body?: string;
  videoUrl?: string;
  embedHtml?: string;
  order: number;
  published: boolean;
}

export interface Material {
  id: string;
  lessonId: string;
  label: string;
  url?: string;
  kind: 'link' | 'file' | 'embed';
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  contentSha256?: string;
  fileBytesBase64?: string;
  storageProvider?: string;
  storageKey?: string;
  scanStatus?: LmsFileScanStatus;
  scanCheckedAt?: number;
  quarantineReason?: string;
  retainedUntil?: number;
  deletedAt?: number;
  embedHtml?: string;
}

export interface LessonProgress {
  userId: string;
  lessonId: string;
  completedAt: number;
}

export interface Actor {
  userId: string;
  isAdmin: boolean;
}

export interface LmsStore {
  courses: Map<string, Course>;
  lessons: Map<string, Lesson>;
  materials: Map<string, Material>;
  progress: LessonProgress[];
}

export function createMemoryLmsStore(): LmsStore {
  return { courses: new Map(), lessons: new Map(), materials: new Map(), progress: [] };
}

function canEdit(actor: Actor, course: Course): boolean {
  return actor.isAdmin || course.ownerTeacherId === actor.userId;
}

export class LmsService {
  private store: LmsStore;

  constructor(store: LmsStore) {
    this.store = store;
  }

  createCourse(actor: Actor, input: { title: string; description?: string; productCode?: 'education' | 'club'; published?: boolean }, now: number): Course {
    const course: Course = {
      id: globalThis.crypto.randomUUID(),
      ownerTeacherId: actor.userId,
      title: input.title,
      description: input.description,
      productCode: input.productCode ?? 'education',
      published: input.published ?? false,
      createdAt: now,
    };
    this.store.courses.set(course.id, course);
    return course;
  }

  updateCourse(actor: Actor, courseId: string, patch: Partial<Pick<Course, 'title' | 'description' | 'published'>>): Course {
    const course = this.store.courses.get(courseId);
    if (!course) throw new Error('course not found');
    if (!canEdit(actor, course)) throw new Error('forbidden: not your course'); // ownership enforcement
    const updated = { ...course, ...patch };
    this.store.courses.set(courseId, updated);
    return updated;
  }

  /** Student view: only published lessons of an entitled course. Fail-closed: no access => []. */
  listLessonsForStudent(courseId: string, hasEducationAccess: boolean): Lesson[] {
    if (!hasEducationAccess) return [];
    const course = this.store.courses.get(courseId);
    if (!course || !course.published) return [];
    return [...this.store.lessons.values()].filter((l) => l.courseId === courseId && l.published).sort((a, b) => a.order - b.order);
  }

  /** Teacher/admin view: all lessons (incl. drafts) of a course they own. */
  listLessonsForEditor(actor: Actor, courseId: string): Lesson[] {
    const course = this.store.courses.get(courseId);
    if (!course || !canEdit(actor, course)) return [];
    return [...this.store.lessons.values()].filter((l) => l.courseId === courseId).sort((a, b) => a.order - b.order);
  }

  markComplete(userId: string, lessonId: string, hasEducationAccess: boolean, now: number): void {
    if (!hasEducationAccess) throw new Error('no education access');
    this.store.progress.push({ userId, lessonId, completedAt: now });
  }
}
