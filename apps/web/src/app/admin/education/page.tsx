import { requireUser } from '@/lib/session';
import { assertAdmin } from '@wtc/auth';
import { Card, SectionHeader, StatusPill, MetricCard, EmptyState, buttonClasses } from '@wtc/ui';
import { levelTone } from '@wtc/lms';
import { CsrfField } from '@/lib/csrf';
import { loadAdminEducation } from '@/features/lms/queries';
import { adminEnrollAction } from '@/features/lms/actions';

export default async function AdminEducationPage() {
  // Canonical admin RBAC (single-source @wtc/auth), matching every other admin page.
  const actor = await requireUser();
  assertAdmin(actor.roles);

  const data = await loadAdminEducation();
  const published = data.courses.filter((c) => c.isPublished).length;
  const totalEnrolled = data.courses.reduce((n, c) => n + c.enrolledCount, 0);

  return (
    <div className="wtc-stack">
      <SectionHeader kicker="Admin · education" title="Education moderation" copy="All courses across every teacher, teacher profiles, and manual enrolment overrides." />

      <div className="wtc-row" style={{ marginTop: -4 }}>
        {data.mode === 'postgres' ? <StatusPill tone="ok">storage: Postgres</StatusPill> : <><StatusPill tone="warn">storage: in-memory (demo)</StatusPill><span className="wtc-dim" style={{ fontSize: 12 }}>Demo mode — set DATABASE_URL to moderate live education data.</span></>}
      </div>

      <div className="wtc-grid wtc-grid-4">
        <MetricCard label="Courses" value={String(data.courses.length)} />
        <MetricCard label="Published" value={String(published)} tone={published > 0 ? 'up' : undefined} />
        <MetricCard label="Teachers" value={String(data.teachers.length)} />
        <MetricCard label="Enrolments" value={String(totalEnrolled)} />
      </div>

      <Card title={`All courses (${data.courses.length})`}>
        {data.courses.length === 0 ? (
          <EmptyState title="No courses" hint={data.mode === 'postgres' ? 'No courses created yet.' : 'Connect a database to moderate courses.'} />
        ) : (
          <div className="wtc-table-wrap">
            <table className="wtc-table">
              <thead><tr><th>Course</th><th>Level</th><th>State</th><th>Lessons</th><th>Enrolled</th></tr></thead>
              <tbody>
                {data.courses.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Course">{c.title}</td>
                    <td data-label="Level"><StatusPill tone={levelTone(c.level)}>{c.level}</StatusPill></td>
                    <td data-label="State"><StatusPill tone={c.isPublished ? 'ok' : 'warn'}>{c.isPublished ? 'published' : 'draft'}</StatusPill></td>
                    <td className="wtc-mono" data-label="Lessons">{c.publishedLessonCount}/{c.lessonCount}</td>
                    <td className="wtc-mono" data-label="Enrolled">{c.enrolledCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="wtc-grid wtc-grid-2">
        <Card title={`Teacher profiles (${data.teachers.length})`}>
          {data.teachers.length === 0 ? (
            <EmptyState title="No teacher profiles" />
          ) : (
            <div className="wtc-stack">
              {data.teachers.map((t) => (
                <div key={t.id} className="wtc-spread" style={{ borderBottom: '1px solid var(--stroke)', paddingBottom: 8 }}>
                  <div><strong>{t.displayName}</strong>{t.bio ? <div className="wtc-dim" style={{ fontSize: 12 }}>{t.bio}</div> : null}</div>
                  <StatusPill tone={t.isActive ? 'ok' : 'bad'}>{t.isActive ? 'active' : 'inactive'}</StatusPill>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Manual enrolment (admin override)">
          <form action={adminEnrollAction} className="wtc-stack">
            <CsrfField />
            <div className="wtc-field"><label htmlFor="userId">User ID</label><input className="wtc-input" id="userId" name="userId" placeholder="uuid" required /></div>
            <div className="wtc-field"><label htmlFor="courseId">Course ID</label><input className="wtc-input" id="courseId" name="courseId" placeholder="uuid" required /></div>
            <button className={buttonClasses('primary')} type="submit">Enrol user</button>
            <p className="wtc-dim" style={{ fontSize: 12 }}>Bypasses entitlement (admin override) and is audited. Idempotent.</p>
          </form>
        </Card>
      </div>
    </div>
  );
}
