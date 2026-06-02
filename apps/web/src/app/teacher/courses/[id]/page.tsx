import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { Card, SectionHeader, StatusPill, EmptyState, RiskWarningBanner, buttonClasses } from '@wtc/ui';
import { levelTone, safeHttpsUrl, type TeacherMaterialView } from '@wtc/lms';
import { CsrfField } from '@/lib/csrf';
import { lmsMode, loadTeacherCourse } from '@/features/lms/queries';
import {
  updateCourseAction,
  setCoursePublishedAction,
  createLessonAction,
  updateLessonAction,
  setLessonPublishedAction,
  createMaterialAction,
  deleteMaterialAction,
  createPinnedLinkAction,
  deletePinnedLinkAction,
} from '@/features/lms/actions';

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}

function scanTone(status?: TeacherMaterialView['scanStatus']) {
  if (status === 'clean') return 'ok' as const;
  if (status === 'quarantined' || status === 'failed') return 'bad' as const;
  if (status === 'pending') return 'warn' as const;
  return 'neutral' as const;
}

function TeacherMaterialLabel({ material }: { material: TeacherMaterialView }) {
  if (material.materialType === 'link') {
    const safeUrl = safeHttpsUrl(material.externalUrl);
    return safeUrl ? <a className="wtc-link" href={safeUrl} target="_blank" rel="noopener noreferrer">{material.title}</a> : <span>{material.title}</span>;
  }
  if (material.materialType === 'file') {
    return (
      <span className="wtc-row" style={{ gap: 6 }}>
        <strong>{material.title}</strong>
        <span className="wtc-dim" style={{ fontSize: 12 }}>- file {formatBytes(material.sizeBytes)}</span>
        <StatusPill tone={scanTone(material.scanStatus)}>{material.scanStatus ?? 'pending'}</StatusPill>
      </span>
    );
  }
  return <span><strong>{material.title}</strong><span className="wtc-dim" style={{ fontSize: 12 }}> - sanitized embed</span></span>;
}

export default async function TeacherCourseEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const isAdmin = user.roles.includes('admin');
  if (!user.roles.includes('teacher') && !isAdmin) redirect('/app');

  if (lmsMode() === 'demo') {
    return (
      <main className="wtc-container" style={{ padding: '34px 22px' }}>
        <SectionHeader kicker="Teacher · course" title="Course editor" />
        <RiskWarningBanner severity="info" title="storage: in-memory (demo)" detail="Course editing is DB-backed. Set DATABASE_URL to manage lessons & materials in Postgres." />
        <div style={{ marginTop: 16 }}><Link href="/teacher/courses" className={buttonClasses('ghost')}>← Courses</Link></div>
      </main>
    );
  }

  const detail = await loadTeacherCourse(user.id, isAdmin, id);
  if (!detail) notFound();
  const { course, lessons, students, pinnedLinks } = detail;
  const owns = true; // loadTeacherCourse already enforces ownerTeacherId OR teacherProfileId ownership.
  if (!owns) {
    return (
      <main className="wtc-container" style={{ padding: '34px 22px' }}>
        <SectionHeader kicker="Teacher · course" title={course.title} />
        <RiskWarningBanner severity="warning" title="Not your course" detail="You can only edit courses you own (ownership enforced server-side)." />
        <div style={{ marginTop: 16 }}><Link href="/teacher/courses" className={buttonClasses('ghost')}>← Courses</Link></div>
      </main>
    );
  }

  return (
    <main className="wtc-container" style={{ padding: '34px 22px' }}>
      <div className="wtc-spread">
        <SectionHeader kicker="Teacher · course" title={course.title} copy={`${course.publishedLessonCount}/${course.lessonCount} lessons published · ${course.enrolledCount} enrolled`} />
        <Link href="/teacher/courses" className={buttonClasses('ghost')}>← Courses</Link>
      </div>

      <div className="wtc-row" style={{ marginTop: -4, flexWrap: 'wrap' }}>
        <StatusPill tone={course.isPublished ? 'ok' : 'warn'}>{course.isPublished ? 'published' : 'draft'}</StatusPill>
        <StatusPill tone={levelTone(course.level)}>{course.level}</StatusPill>
        {course.tags.map((t) => <StatusPill key={t} tone="neutral">{t}</StatusPill>)}
        <form action={setCoursePublishedAction}>
          <CsrfField />
          <input type="hidden" name="courseId" value={course.id} />
          <input type="hidden" name="published" value={course.isPublished ? 'false' : 'true'} />
          <button className={buttonClasses('secondary')} type="submit">{course.isPublished ? 'Unpublish' : 'Publish course'}</button>
        </form>
      </div>

      <div className="wtc-grid wtc-grid-2">
        <Card title="Course details">
          <form action={updateCourseAction} className="wtc-stack">
            <CsrfField />
            <input type="hidden" name="courseId" value={course.id} />
            <div className="wtc-field"><label htmlFor="title">Title</label><input className="wtc-input" id="title" name="title" defaultValue={course.title} /></div>
            <div className="wtc-field"><label htmlFor="description">Description</label><input className="wtc-input" id="description" name="description" defaultValue={course.description ?? ''} /></div>
            <div className="wtc-field"><label htmlFor="level">Level</label><select className="wtc-input" id="level" name="level" defaultValue={course.level}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div>
            <div className="wtc-field"><label htmlFor="tags">Tags (comma-separated)</label><input className="wtc-input" id="tags" name="tags" defaultValue={course.tags.join(', ')} placeholder="e.g. rsi, risk" /></div>
            <button className={buttonClasses('primary')} type="submit">Save details</button>
          </form>
        </Card>

        <Card title="Add a lesson">
          <form action={createLessonAction} className="wtc-stack">
            <CsrfField />
            <input type="hidden" name="courseId" value={course.id} />
            <div className="wtc-field"><label htmlFor="ltitle">Title</label><input className="wtc-input" id="ltitle" name="title" required minLength={3} /></div>
            <div className="wtc-field"><label htmlFor="contentType">Content type</label><select className="wtc-input" id="contentType" name="contentType" defaultValue="video"><option value="video">Video</option><option value="embed">Embed</option><option value="article">Article</option><option value="link">External link</option></select></div>
            <div className="wtc-field"><label htmlFor="body">Body (text / markdown — for article)</label><textarea className="wtc-input" id="body" name="body" rows={3} /></div>
            <div className="wtc-field"><label htmlFor="videoUrl">Video URL (for video, https)</label><input className="wtc-input" id="videoUrl" name="videoUrl" placeholder="https://…" /></div>
            <div className="wtc-field"><label htmlFor="externalUrl">External URL (for link, https)</label><input className="wtc-input" id="externalUrl" name="externalUrl" placeholder="https://…" /></div>
            <div className="wtc-field"><label htmlFor="embedHtml">Embed iframe (YouTube/Vimeo)</label><textarea className="wtc-input" id="embedHtml" name="embedHtml" rows={3} placeholder="<iframe src=&quot;https://www.youtube.com/embed/...&quot;></iframe>" /></div>
            <button className={buttonClasses('primary')} type="submit">Add draft lesson</button>
          </form>
        </Card>
      </div>

      <Card title={`Course links (${pinnedLinks.length})`}>
        <div className="wtc-grid wtc-grid-2">
          <form action={createPinnedLinkAction} className="wtc-stack">
            <CsrfField />
            <input type="hidden" name="ownerType" value="course" />
            <input type="hidden" name="ownerId" value={course.id} />
            <input type="hidden" name="courseId" value={course.id} />
            <div className="wtc-field"><label htmlFor="plink-label">Label</label><input className="wtc-input" id="plink-label" name="label" required /></div>
            <div className="wtc-field"><label htmlFor="plink-url">URL (https)</label><input className="wtc-input" id="plink-url" name="url" placeholder="https://..." required /></div>
            <div className="wtc-field"><label htmlFor="plink-icon">Icon/type</label><input className="wtc-input" id="plink-icon" name="iconType" placeholder="docs, telegram, support..." /></div>
            <div className="wtc-field"><label htmlFor="plink-order">Sort order</label><input className="wtc-input" id="plink-order" name="sortOrder" type="number" min="0" max="1000" defaultValue="0" /></div>
            <button className={buttonClasses('secondary')} type="submit">Add course link</button>
          </form>
          <div className="wtc-stack">
            {pinnedLinks.length === 0 ? (
              <EmptyState title="No course links yet" hint="Add external resources that should appear with this course." />
            ) : (
              pinnedLinks.map((link) => (
                <div key={link.id} className="wtc-spread" style={{ borderBottom: '1px solid var(--stroke)', paddingBottom: 8 }}>
                  <div>
                    <a className="wtc-link" href={safeHttpsUrl(link.url) ?? undefined} target="_blank" rel="noopener noreferrer">{link.label}</a>
                    <div className="wtc-dim" style={{ fontSize: 12 }}>{link.iconType ?? 'link'} · order {link.sortOrder}</div>
                  </div>
                  <form action={deletePinnedLinkAction}>
                    <CsrfField />
                    <input type="hidden" name="linkId" value={link.id} />
                    <input type="hidden" name="ownerType" value="course" />
                    <input type="hidden" name="ownerId" value={course.id} />
                    <input type="hidden" name="courseId" value={course.id} />
                    <button className={buttonClasses('ghost')} type="submit">Delete</button>
                  </form>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      <Card title={`Lessons (${lessons.length})`}>
        {lessons.length === 0 ? (
          <EmptyState title="No lessons yet" hint="Add your first lesson above." />
        ) : (
          <div className="wtc-stack">
            {lessons.map((l) => (
              <div key={l.id} style={{ borderBottom: '1px solid var(--stroke)', paddingBottom: 8 }}>
                <div className="wtc-spread">
                  <div>
                    <strong>{l.sortOrder}. {l.title}</strong>
                    <div className="wtc-dim" style={{ fontSize: 12 }}>{l.contentType}</div>
                  </div>
                  <div className="wtc-row">
                    <StatusPill tone={l.isPublished ? 'ok' : 'warn'}>{l.isPublished ? 'published' : 'draft'}</StatusPill>
                    <form action={setLessonPublishedAction}>
                      <CsrfField />
                      <input type="hidden" name="courseId" value={course.id} />
                      <input type="hidden" name="lessonId" value={l.id} />
                      <input type="hidden" name="published" value={l.isPublished ? 'false' : 'true'} />
                      <button className={buttonClasses('ghost')} type="submit">{l.isPublished ? 'Unpublish' : 'Publish'}</button>
                    </form>
                  </div>
                </div>
                <details style={{ marginTop: 6 }}>
                  <summary className="wtc-dim" style={{ fontSize: 12, cursor: 'pointer' }}>Edit lesson</summary>
                  <form action={updateLessonAction} className="wtc-stack" style={{ marginTop: 8 }}>
                    <CsrfField />
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="lessonId" value={l.id} />
                    <div className="wtc-field"><label htmlFor={`et-${l.id}`}>Title</label><input className="wtc-input" id={`et-${l.id}`} name="title" defaultValue={l.title} required minLength={3} /></div>
                    <div className="wtc-field"><label htmlFor={`ect-${l.id}`}>Content type</label><select className="wtc-input" id={`ect-${l.id}`} name="contentType" defaultValue={l.contentType}><option value="video">Video</option><option value="embed">Embed</option><option value="article">Article</option><option value="link">External link</option></select></div>
                    <div className="wtc-field"><label htmlFor={`eb-${l.id}`}>Body</label><textarea className="wtc-input" id={`eb-${l.id}`} name="body" rows={2} defaultValue={l.body ?? ''} /></div>
                    <div className="wtc-field"><label htmlFor={`ev-${l.id}`}>Video URL (https)</label><input className="wtc-input" id={`ev-${l.id}`} name="videoUrl" defaultValue={l.videoUrl ?? ''} placeholder="https://…" /></div>
                    <div className="wtc-field"><label htmlFor={`ee-${l.id}`}>External URL (https)</label><input className="wtc-input" id={`ee-${l.id}`} name="externalUrl" defaultValue={l.externalUrl ?? ''} placeholder="https://…" /></div>
                    <div className="wtc-field"><label htmlFor={`ehtml-${l.id}`}>Embed iframe (YouTube/Vimeo)</label><textarea className="wtc-input" id={`ehtml-${l.id}`} name="embedHtml" rows={2} defaultValue={l.embedHtml ?? ''} /></div>
                    <button className={buttonClasses('secondary')} type="submit">Save lesson</button>
                  </form>
                </details>
                <div className="wtc-stack" style={{ marginTop: 8 }}>
                  <div className="wtc-spread">
                    <strong style={{ fontSize: 13 }}>Materials ({l.materials.length})</strong>
                    <span className="wtc-dim" style={{ fontSize: 12 }}>links, files, embeds</span>
                  </div>
                  {l.materials.length === 0 ? (
                    <p className="wtc-dim" style={{ fontSize: 12, margin: 0 }}>No materials attached to this lesson.</p>
                  ) : (
                    l.materials.map((material) => (
                      <div key={material.id} className="wtc-spread" style={{ gap: 12 }}>
                        <TeacherMaterialLabel material={material} />
                        <form action={deleteMaterialAction}>
                          <CsrfField />
                          <input type="hidden" name="courseId" value={course.id} />
                          <input type="hidden" name="materialId" value={material.id} />
                          <button className={buttonClasses('ghost')} type="submit">Delete</button>
                        </form>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="wtc-grid wtc-grid-2">
        <Card title="Add a material">
          <form action={createMaterialAction} className="wtc-stack" encType="multipart/form-data">
            <CsrfField />
            <input type="hidden" name="courseId" value={course.id} />
            <div className="wtc-field">
              <label htmlFor="mlesson">Lesson</label>
              <select className="wtc-input" id="mlesson" name="lessonId" required>
                <option value="">Select a lesson…</option>
                {lessons.map((l) => <option key={l.id} value={l.id}>{l.sortOrder}. {l.title}</option>)}
              </select>
            </div>
            <div className="wtc-field"><label htmlFor="label">Label</label><input className="wtc-input" id="label" name="label" required /></div>
            <div className="wtc-field"><label htmlFor="murl">URL (for link, https)</label><input className="wtc-input" id="murl" name="url" placeholder="https://…" /></div>
            <div className="wtc-field">
              <label htmlFor="kind">Kind</label>
              <select className="wtc-input" id="kind" name="kind" defaultValue="link"><option value="link">Link</option><option value="file">File</option><option value="embed">Embed</option></select>
            </div>
            <div className="wtc-field"><label htmlFor="mfile">File (PDF, PNG, JPEG, TXT; max 5 MB)</label><input className="wtc-input" id="mfile" name="file" type="file" accept="application/pdf,image/png,image/jpeg,text/plain" /></div>
            <div className="wtc-field"><label htmlFor="membed">Embed iframe (YouTube/Vimeo)</label><textarea className="wtc-input" id="membed" name="embedHtml" rows={3} placeholder="<iframe src=&quot;https://player.vimeo.com/video/...&quot;></iframe>" /></div>
            <button className={buttonClasses('primary')} type="submit">Add material</button>
            <p className="wtc-dim" style={{ fontSize: 12 }}>Files are stored in the local DB row with storage keys, scan state, quarantine state, and retention timestamps. Production object storage and a real malware engine remain separate rollout gates.</p>
          </form>
        </Card>

        <Card title={`Students (${students.length})`}>
          {students.length === 0 ? (
            <EmptyState title="No students enrolled yet" />
          ) : (
            <div className="wtc-table-wrap">
              <table className="wtc-table">
                <thead><tr><th>Student</th><th>Progress</th></tr></thead>
                <tbody>
                  {students.map((stp, i) => (
                    <tr key={i}>
                      <td data-label="Student">{stp.displayName}</td>
                      <td data-label="Progress" className="wtc-mono">{stp.completedLessons}/{stp.totalLessons} ({stp.progressPct}%)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="wtc-dim" style={{ fontSize: 12, marginTop: 8 }}>Student rosters show display name + progress only — never email.</p>
        </Card>
      </div>
    </main>
  );
}
