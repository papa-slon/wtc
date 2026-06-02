import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { Card, SectionHeader, StatusPill, EmptyState, buttonClasses } from '@wtc/ui';
import { loadTeacherWorkspace } from '@/features/lms/queries';

export default async function TeacherStudentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const isAdmin = user.roles.includes('admin');
  if (!user.roles.includes('teacher') && !isAdmin) redirect('/app');

  const ws = await loadTeacherWorkspace(user.id, isAdmin);
  const totalEnrolled = ws.courses.reduce((n, c) => n + c.enrolledCount, 0);

  return (
    <main className="wtc-container" style={{ padding: '34px 22px' }}>
      <div className="wtc-spread">
        <SectionHeader kicker="Teacher console" title="Students" copy="Enrolment + progress per course. Open a course to see its student roster (display name + progress only — never email)." />
        <Link href="/teacher" className={buttonClasses('ghost')}>← Dashboard</Link>
      </div>

      <div className="wtc-row" style={{ marginTop: -4 }}>
        {ws.mode === 'postgres' ? <StatusPill tone="ok">storage: Postgres</StatusPill> : <StatusPill tone="warn">storage: in-memory (demo)</StatusPill>}
        <span className="wtc-dim" style={{ fontSize: 12 }}>{totalEnrolled} total enrolments across {ws.courses.length} course(s).</span>
      </div>

      <Card title="Courses & enrolment">
        {ws.courses.length === 0 ? (
          <EmptyState title="No courses yet" hint={ws.mode === 'postgres' ? 'Create a course to start enrolling students.' : 'Connect a database to view students.'} />
        ) : (
          <table className="wtc-table">
            <thead><tr><th>Course</th><th>Published</th><th>Enrolled</th><th></th></tr></thead>
            <tbody>
              {ws.courses.map((c) => (
                <tr key={c.id}>
                  <td>{c.title}</td>
                  <td><StatusPill tone={c.isPublished ? 'ok' : 'warn'}>{c.isPublished ? 'published' : 'draft'}</StatusPill></td>
                  <td className="wtc-mono">{c.enrolledCount}</td>
                  <td><Link href={`/teacher/courses/${c.id}`} className={buttonClasses('ghost')}>Roster →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </main>
  );
}
