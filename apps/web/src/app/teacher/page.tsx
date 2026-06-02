import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { Card, SectionHeader, StatusPill, MetricCard, EmptyState, buttonClasses } from '@wtc/ui';
import { levelTone } from '@wtc/lms';
import { loadTeacherWorkspace } from '@/features/lms/queries';

export default async function TeacherPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const isAdmin = user.roles.includes('admin');
  if (!user.roles.includes('teacher') && !isAdmin) redirect('/app');

  const ws = await loadTeacherWorkspace(user.id, isAdmin);
  const published = ws.courses.filter((c) => c.isPublished).length;
  const lessons = ws.courses.reduce((n, c) => n + c.lessonCount, 0);
  const enrolled = ws.courses.reduce((n, c) => n + c.enrolledCount, 0);

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="Teacher console"
        title="Overview"
        copy="Teacher room for courses, materials, community links, and student progress. Ownership is enforced server-side."
      />
      <div className="wtc-row" style={{ marginTop: -4 }}>
        {ws.mode === 'postgres' ? (
          <StatusPill tone="ok">storage: Postgres</StatusPill>
        ) : (
          <>
            <StatusPill tone="warn">storage: in-memory (demo)</StatusPill>
            <span className="wtc-dim" style={{ fontSize: 12 }}>Connect DATABASE_URL to persist teacher courses/materials/community links.</span>
          </>
        )}
      </div>

      <div className="wtc-grid wtc-grid-4">
        <MetricCard label="Courses" value={ws.courses.length} />
        <MetricCard label="Published" value={published} tone={published > 0 ? 'up' : undefined} />
        <MetricCard label="Lessons" value={lessons} />
        <MetricCard label="Enrolled" value={enrolled} />
      </div>

      <div className="wtc-grid wtc-grid-2">
        <Card title="Profile">
          {ws.profile ? (
            <div className="wtc-stack">
              <div className="wtc-card-row"><span className="k">Name</span><span className="v">{ws.profile.displayName}</span></div>
              <div className="wtc-card-row"><span className="k">State</span><span className="v">{ws.profile.isActive ? 'active' : 'inactive'}</span></div>
              {ws.profile.bio && <p className="wtc-muted" style={{ fontSize: 13, lineHeight: 1.6 }}>{ws.profile.bio}</p>}
              <Link href="/teacher/community" className={buttonClasses('secondary')}>Edit community profile</Link>
            </div>
          ) : (
            <div className="wtc-stack">
              <EmptyState title="Profile not configured" hint="Create your teacher profile and community links." />
              <Link href="/teacher/community" className={buttonClasses('primary')}>Create profile</Link>
            </div>
          )}
        </Card>

        <Card title={`Your courses (${ws.courses.length})`}>
          {ws.courses.length === 0 ? (
            <EmptyState title="No courses yet" hint={ws.mode === 'postgres' ? 'Create your first course.' : 'Demo mode has no persistent course workspace.'} />
          ) : (
            <div className="wtc-stack">
              {ws.courses.slice(0, 5).map((c) => (
                <Link key={c.id} href={`/teacher/courses/${c.id}`} className="wtc-spread" style={{ borderBottom: '1px solid var(--stroke)', paddingBottom: 8, textDecoration: 'none' }}>
                  <div>
                    <strong>{c.title}</strong>
                    <div className="wtc-dim" style={{ fontSize: 12 }}>{c.publishedLessonCount}/{c.lessonCount} lessons published</div>
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
    </div>
  );
}
