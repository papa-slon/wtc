import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { Card, SectionHeader, StatusPill, EmptyState, buttonClasses } from '@wtc/ui';
import { levelTone } from '@wtc/lms';
import { CsrfField } from '@/lib/csrf';
import { loadTeacherWorkspace } from '@/features/lms/queries';
import { createCourseAction } from '@/features/lms/actions';

export default async function TeacherCoursesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const isAdmin = user.roles.includes('admin');
  if (!user.roles.includes('teacher') && !isAdmin) redirect('/app');

  const ws = await loadTeacherWorkspace(user.id, isAdmin);

  return (
    <main className="wtc-container" style={{ padding: '34px 22px' }}>
      <div className="wtc-spread">
        <SectionHeader kicker="Teacher console" title="Courses" copy="Create and manage your courses. Ownership is enforced server-side — you can only edit your own." />
        <Link href="/teacher" className={buttonClasses('ghost')}>← Dashboard</Link>
      </div>

      <div className="wtc-row" style={{ marginTop: -4 }}>
        {ws.mode === 'postgres' ? (
          <StatusPill tone="ok">storage: Postgres</StatusPill>
        ) : (
          <>
            <StatusPill tone="warn">storage: in-memory (demo)</StatusPill>
            <span className="wtc-dim" style={{ fontSize: 12 }}>Demo mode — course management is not persisted. Set DATABASE_URL to manage courses in Postgres.</span>
          </>
        )}
      </div>

      <div className="wtc-grid wtc-grid-2">
        <Card title="Create a course">
          <form action={createCourseAction} className="wtc-stack">
            <CsrfField />
            <div className="wtc-field"><label htmlFor="title">Title</label><input className="wtc-input" id="title" name="title" required minLength={3} /></div>
            <div className="wtc-field"><label htmlFor="description">Description</label><input className="wtc-input" id="description" name="description" /></div>
            <div className="wtc-field"><label htmlFor="level">Level</label><select className="wtc-input" id="level" name="level" defaultValue="beginner"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div>
            <div className="wtc-field"><label htmlFor="tags">Tags (comma-separated)</label><input className="wtc-input" id="tags" name="tags" placeholder="e.g. rsi, risk" /></div>
            <button className={buttonClasses('primary')} type="submit">Create draft course</button>
            <p className="wtc-dim" style={{ fontSize: 12 }}>New courses start as drafts. Add lessons, then publish.</p>
          </form>
        </Card>
        <Card title={`Courses (${ws.courses.length})`}>
          {ws.courses.length === 0 ? (
            <EmptyState title="No courses yet" hint={ws.mode === 'postgres' ? 'Create your first course to begin.' : 'Connect a database to manage courses.'} />
          ) : (
            <div className="wtc-stack">
              {ws.courses.map((c) => (
                <Link key={c.id} href={`/teacher/courses/${c.id}`} className="wtc-spread" style={{ borderBottom: '1px solid var(--stroke)', paddingBottom: 8, textDecoration: 'none' }}>
                  <div>
                    <strong>{c.title}</strong>
                    <div className="wtc-dim" style={{ fontSize: 12 }}>{c.publishedLessonCount}/{c.lessonCount} lessons published · {c.enrolledCount} enrolled</div>
                    {c.tags.length > 0 && <div className="wtc-row" style={{ gap: 6, marginTop: 4, flexWrap: 'wrap' }}>{c.tags.map((t) => <StatusPill key={t} tone="neutral">{t}</StatusPill>)}</div>}
                  </div>
                  <div className="wtc-row" style={{ gap: 6 }}>
                    <StatusPill tone={levelTone(c.level)}>{c.level}</StatusPill>
                    <StatusPill tone={c.isPublished ? 'ok' : 'warn'}>{c.isPublished ? 'published' : 'draft'}</StatusPill>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
