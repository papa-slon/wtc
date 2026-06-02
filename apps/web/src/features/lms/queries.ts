import 'server-only';
/**
 * LMS data layer (server-only). Uses the backend getServerDb() selector + the @wtc/db repos, and maps
 * rows → @wtc/lms LEAN view types. Real Postgres when DATABASE_URL is set; an honest labelled demo
 * state otherwise (null db → empty lists, never fabricated data). Business logic lives here + @wtc/lms,
 * never in the React pages.
 */
import { getServerDb, lmsService } from '@/lib/backend';
import {
  getTeacherProfile,
  listCoursesForTeacher,
  listAllCourses,
  getCourseById,
  getCourseCounts,
  listLessonsForCourse,
  listPublishedCourses,
  listLessonsForStudent,
  listMaterials,
  listCourseProgress,
  getCourseStudentList,
  listTeacherProfiles,
  listPinnedLinks,
  type CourseRow,
  type Lesson,
  type MaterialRow,
  type TeacherProfileRow,
  type PinnedLinkRow,
} from '@wtc/db';
import {
  type CourseAdminView,
  type CourseView,
  type LessonView,
  type MaterialView,
  type TeacherMaterialView,
  type CourseProgressSummary,
  type StudentProgressSummary,
  type TeacherProfileView,
  type PinnedLinkView,
  assertTeacherOwns,
  courseProgressPct,
} from '@wtc/lms';

export type LmsMode = 'postgres' | 'demo';

/** Storage mode for the LMS surfaces (real DB vs honest demo). */
export function lmsMode(): LmsMode {
  return getServerDb() ? 'postgres' : 'demo';
}

// ---- mappers (row → LEAN view type) ----
function toCourseView(c: CourseRow): CourseView {
  const v: CourseView = { id: c.id, title: c.title, productCode: c.productCode, isPublished: c.published, createdAt: c.createdAt.getTime(), level: c.level, tags: c.tags };
  if (c.description) v.description = c.description;
  return v;
}
function toLessonView(l: Lesson): LessonView {
  // 0005: content type is read from the lessons.content_type column (the videoUrl heuristic is retired).
  const v: LessonView = { id: l.id, courseId: l.courseId, title: l.title, sortOrder: l.order, isPublished: l.published, contentType: l.contentType as LessonView['contentType'] };
  if (l.body) v.body = l.body;
  if (l.videoUrl) v.videoUrl = l.videoUrl;
  if (l.externalUrl) v.externalUrl = l.externalUrl;
  if (l.embedHtml) v.embedHtml = l.embedHtml;
  return v;
}
function toMaterialView(m: MaterialRow): MaterialView {
  const materialType = (m.kind as MaterialView['materialType']) ?? 'link';
  const v: MaterialView = { id: m.id, lessonId: m.lessonId, title: m.label, materialType };
  if (materialType === 'link' && m.url) v.externalUrl = m.url;
  if (materialType === 'file') {
    if (m.scanStatus === 'clean') v.downloadUrl = `/api/education/materials/${m.id}/download`;
    if (m.sizeBytes != null) v.sizeBytes = m.sizeBytes;
    v.scanStatus = m.scanStatus as MaterialView['scanStatus'];
  }
  if (materialType === 'embed' && m.embedHtml) v.embedHtml = m.embedHtml;
  return v;
}

function toTeacherMaterialView(m: MaterialRow): TeacherMaterialView {
  return { ...toMaterialView(m) };
}
function toTeacherProfileView(p: TeacherProfileRow): TeacherProfileView {
  const v: TeacherProfileView = { id: p.id, userId: p.userId, displayName: p.displayName, socialLinks: (p.socialLinks as Record<string, string>) ?? {}, isActive: p.isActive };
  if (p.bio) v.bio = p.bio;
  if (p.avatarUrl) v.avatarUrl = p.avatarUrl;
  return v;
}
function toPinnedLinkView(p: PinnedLinkRow): PinnedLinkView {
  const v: PinnedLinkView = { id: p.id, ownerType: p.ownerType as PinnedLinkView['ownerType'], ownerId: p.ownerId, label: p.label, url: p.url, sortOrder: p.sortOrder };
  if (p.iconType) v.iconType = p.iconType;
  return v;
}

async function courseAdmin(db: NonNullable<ReturnType<typeof getServerDb>>, c: CourseRow): Promise<CourseAdminView> {
  const counts = await getCourseCounts(db, c.id);
  const base = toCourseView(c);
  return { ...base, ownerTeacherId: c.ownerTeacherId, teacherProfileId: c.teacherProfileId ?? undefined, lessonCount: counts.lessonCount, publishedLessonCount: counts.publishedLessonCount, enrolledCount: counts.enrolledCount };
}

// ---- Teacher ----
export interface TeacherWorkspace {
  mode: LmsMode;
  profile: TeacherProfileView | null;
  courses: CourseAdminView[];
  pinnedLinks: PinnedLinkView[];
}
export async function loadTeacherWorkspace(userId: string, isAdmin: boolean): Promise<TeacherWorkspace> {
  const db = getServerDb();
  if (!db) {
    const demoCourses = await lmsService.listPublishedCourses();
    const courses = await Promise.all(
      demoCourses.map(async (c) => {
        const lessons = await lmsService.listLessonsForStudent(c.id, true);
        return {
          id: c.id,
          title: c.title,
          productCode: c.productCode,
          isPublished: c.published,
          createdAt: c.createdAt,
          level: c.level,
          tags: c.tags,
          description: c.description,
          ownerTeacherId: c.ownerTeacherId,
          lessonCount: lessons.length,
          publishedLessonCount: lessons.length,
          enrolledCount: 0,
        };
      }),
    );
    return { mode: 'demo', profile: null, courses, pinnedLinks: [] };
  }
  const profileRow = await getTeacherProfile(db, userId);
  const rows = await listAllCoursesForActor(db, userId, isAdmin);
  const courses = await Promise.all(rows.map((c) => courseAdmin(db, c)));
  const pinnedLinks = profileRow ? (await listPinnedLinks(db, 'teacher_profile', profileRow.id)).map(toPinnedLinkView) : [];
  return { mode: 'postgres', profile: profileRow ? toTeacherProfileView(profileRow) : null, courses, pinnedLinks };
}

async function listAllCoursesForActor(db: NonNullable<ReturnType<typeof getServerDb>>, userId: string, isAdmin: boolean): Promise<CourseRow[]> {
  if (isAdmin) return listAllCourses(db);
  // teacher: own courses (by owner_teacher_id; thin DTO has the ids — re-load full rows)
  const dtos = await listCoursesForTeacher(db, userId, false);
  const rows = await Promise.all(dtos.map((d) => getCourseById(db, d.id)));
  return rows.filter((r): r is CourseRow => r !== null);
}

export interface TeacherCourseDetail {
  mode: LmsMode;
  course: CourseAdminView;
  lessons: (LessonView & { materials: TeacherMaterialView[] })[];
  students: StudentProgressSummary[];
  pinnedLinks: PinnedLinkView[];
}
export async function loadTeacherCourse(userId: string, isAdmin: boolean, courseId: string): Promise<TeacherCourseDetail | null> {
  const db = getServerDb();
  if (!db) return null; // demo: route renders the honest "connect a database" state
  const c = await getCourseById(db, courseId);
  if (!c) return null;
  // TEACHER READ-ISOLATION (Bug fix): enforce ownership BEFORE fetching lessons/roster/counts.
  // A non-admin teacher must own the course (by teacher_profile_id or by owner_teacher_id) —
  // otherwise return null so the route renders 404/forbidden without leaking any course data.
  if (!isAdmin) {
    const actorProfile = await getTeacherProfile(db, userId);
    try {
      assertTeacherOwns({
        isAdmin: false,
        actorUserId: userId,
        actorTeacherProfileId: actorProfile?.id ?? null,
        courseOwnerTeacherId: c.ownerTeacherId,
        courseTeacherProfileId: c.teacherProfileId ?? null,
      });
    } catch {
      return null; // ownership denied — do not fetch roster/lessons/materials
    }
  }
  const course = await courseAdmin(db, c);
  const lessons = await Promise.all((await listLessonsForCourse(db, courseId)).map(async (l) => ({ ...toLessonView(l), materials: (await listMaterials(db, l.id)).map(toTeacherMaterialView) })));
  const students = (await getCourseStudentList(db, courseId)).map((s) => ({
    displayName: s.displayName,
    enrolledAt: s.enrolledAt.getTime(),
    completedLessons: s.completedLessons,
    totalLessons: s.totalLessons,
    progressPct: courseProgressPct(s.totalLessons, s.completedLessons),
  }));
  const pinnedLinks = (await listPinnedLinks(db, 'course', courseId)).map(toPinnedLinkView);
  return { mode: 'postgres', course, lessons, students, pinnedLinks };
}

export interface TeacherMaterialList {
  mode: LmsMode;
  rows: { course: CourseAdminView; lesson: LessonView; material: TeacherMaterialView }[];
}
export async function loadTeacherMaterials(userId: string, isAdmin: boolean): Promise<TeacherMaterialList> {
  const db = getServerDb();
  if (!db) return { mode: 'demo', rows: [] };
  const courses = await Promise.all((await listAllCoursesForActor(db, userId, isAdmin)).map((c) => courseAdmin(db, c)));
  const rows: TeacherMaterialList['rows'] = [];
  for (const course of courses) {
    const lessons = (await listLessonsForCourse(db, course.id)).map(toLessonView);
    for (const lesson of lessons) {
      const materials = (await listMaterials(db, lesson.id)).map(toTeacherMaterialView);
      for (const material of materials) rows.push({ course, lesson, material });
    }
  }
  return { mode: 'postgres', rows };
}

/** Ownership inputs for the actions layer (loads owner + the actor's teacher profile id). */
export async function loadOwnershipContext(actorUserId: string, courseId: string): Promise<{ courseOwnerTeacherId: string; courseTeacherProfileId?: string | null; actorTeacherProfileId?: string | null } | null> {
  const db = getServerDb();
  if (!db) return null;
  const c = await getCourseById(db, courseId);
  if (!c) return null;
  const profile = await getTeacherProfile(db, actorUserId);
  return { courseOwnerTeacherId: c.ownerTeacherId, courseTeacherProfileId: c.teacherProfileId, actorTeacherProfileId: profile?.id ?? null };
}

// ---- Student ----
export interface StudentCatalogue {
  mode: LmsMode;
  hasAccess: boolean;
  courses: (CourseView & { progressPct: number })[];
  communityLinks: PinnedLinkView[];
  teacherProfiles: TeacherProfileView[];
}
export async function loadStudentCatalogue(userId: string, hasAccess: boolean): Promise<StudentCatalogue> {
  const db = getServerDb();
  if (!db) return { mode: 'demo', hasAccess, courses: [], communityLinks: [], teacherProfiles: [] };
  const published = await listPublishedCourses(db);
  const courses = await Promise.all(
    published.map(async (c) => {
      const lessons = await listLessonsForStudent(db, c.id, true);
      const prog = hasAccess ? await listCourseProgress(db, userId, c.id) : [];
      const completed = prog.filter((p) => p.completed).length;
      const v: CourseView & { progressPct: number } = { id: c.id, title: c.title, productCode: c.productCode, isPublished: c.published, createdAt: c.createdAt, level: c.level, tags: c.tags, progressPct: courseProgressPct(lessons.length, completed) };
      if (c.description) v.description = c.description;
      return v;
    }),
  );
  const teacherProfiles = (await listTeacherProfiles(db)).filter((p) => p.isActive).map(toTeacherProfileView);
  const communityLinks = (
    await Promise.all(teacherProfiles.map((p) => listPinnedLinks(db, 'teacher_profile', p.id)))
  ).flat().map(toPinnedLinkView);
  return { mode: 'postgres', hasAccess, courses, communityLinks, teacherProfiles };
}

export interface StudentCourse {
  mode: LmsMode;
  course: CourseView;
  lessons: (LessonView & { completed: boolean })[];
  pinnedLinks: PinnedLinkView[];
  progress: CourseProgressSummary;
}
export async function loadStudentCourse(userId: string, hasAccess: boolean, courseId: string): Promise<StudentCourse | null> {
  if (!hasAccess) return null; // fail-closed
  const db = getServerDb();
  if (!db) return null;
  const c = await getCourseById(db, courseId);
  if (!c || !c.published) return null; // unpublished → fail-closed
  const lessonDtos = await listLessonsForStudent(db, courseId, true);
  const prog = await listCourseProgress(db, userId, courseId);
  const completedSet = new Set(prog.filter((p) => p.completed).map((p) => p.lessonId));
  const lessons = lessonDtos.map((l) => ({ id: l.id, courseId: l.courseId, title: l.title, sortOrder: l.order, isPublished: l.published, contentType: l.contentType, ...(l.body ? { body: l.body } : {}), ...(l.videoUrl ? { videoUrl: l.videoUrl } : {}), ...(l.externalUrl ? { externalUrl: l.externalUrl } : {}), ...(l.embedHtml ? { embedHtml: l.embedHtml } : {}), completed: completedSet.has(l.id) }));
  const completedLessons = lessons.filter((l) => l.completed).length;
  const pinnedLinks = (await listPinnedLinks(db, 'course', courseId)).map(toPinnedLinkView);
  return {
    mode: 'postgres',
    course: toCourseView(c),
    lessons,
    pinnedLinks,
    progress: { courseId, totalLessons: lessons.length, completedLessons, progressPct: courseProgressPct(lessons.length, completedLessons) },
  };
}

export interface StudentLesson {
  mode: LmsMode;
  course: CourseView;
  lesson: LessonView;
  materials: MaterialView[];
  pinnedLinks: PinnedLinkView[];
  completed: boolean;
}
export async function loadStudentLesson(userId: string, hasAccess: boolean, courseId: string, lessonId: string): Promise<StudentLesson | null> {
  if (!hasAccess) return null;
  const db = getServerDb();
  if (!db) return null;
  const c = await getCourseById(db, courseId);
  if (!c || !c.published) return null;
  const lessonDtos = await listLessonsForStudent(db, courseId, true);
  const dto = lessonDtos.find((l) => l.id === lessonId);
  if (!dto) return null; // not published / not in course → fail-closed
  const prog = await listCourseProgress(db, userId, courseId);
  const completed = prog.some((p) => p.lessonId === lessonId && p.completed);
  const lesson: LessonView = { id: dto.id, courseId: dto.courseId, title: dto.title, sortOrder: dto.order, isPublished: dto.published, contentType: dto.contentType };
  if (dto.body) lesson.body = dto.body;
  if (dto.videoUrl) lesson.videoUrl = dto.videoUrl;
  if (dto.externalUrl) lesson.externalUrl = dto.externalUrl;
  if (dto.embedHtml) lesson.embedHtml = dto.embedHtml;
  const materials = (await listMaterials(db, lessonId)).map(toMaterialView);
  const pinnedLinks = (await listPinnedLinks(db, 'course', courseId)).map(toPinnedLinkView);
  return { mode: 'postgres', course: toCourseView(c), lesson, materials, pinnedLinks, completed };
}

// ---- Admin ----
export interface AdminEducation {
  mode: LmsMode;
  courses: CourseAdminView[];
  teachers: TeacherProfileView[];
}
export async function loadAdminEducation(): Promise<AdminEducation> {
  const db = getServerDb();
  if (!db) return { mode: 'demo', courses: [], teachers: [] };
  const courseRows = await listAllCourses(db);
  const courses = await Promise.all(courseRows.map((c) => courseAdmin(db, c)));
  const teachers = (await listTeacherProfiles(db)).map(toTeacherProfileView);
  return { mode: 'postgres', courses, teachers };
}
