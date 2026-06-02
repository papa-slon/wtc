import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { accessFor, reasonLabel } from '@/lib/access';
import { Card, SectionHeader, StatusPill, EmptyState, RiskWarningBanner, buttonClasses } from '@wtc/ui';
import { levelTone, safeHttpsUrl } from '@wtc/lms';
import { CsrfField } from '@/lib/csrf';
import { lmsMode, loadStudentCourse } from '@/features/lms/queries';
import { enrollAction } from '@/features/lms/actions';

export default async function StudentCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const user = await requireUser();
  const access = await accessFor(user.id, 'education');

  if (!access.allowed) {
    return (
      <div className="wtc-stack">
        <SectionHeader kicker="Education" title="Course locked" />
        <RiskWarningBanner severity="warning" title={`Education access ${reasonLabel(access.reason)}`} detail="An active education entitlement is required to view this course (fail-closed). Activate or renew in billing." />
        <Link href="/app/billing" className={buttonClasses('primary')}>Go to billing</Link>
      </div>
    );
  }

  if (lmsMode() === 'demo') {
    return (
      <div className="wtc-stack">
        <SectionHeader kicker="Education" title="Course" />
        <RiskWarningBanner severity="info" title="storage: in-memory (demo)" detail="Course content + progress are DB-backed. Set DATABASE_URL to view live course content." />
        <Link href="/app/education" className={buttonClasses('ghost')}>← All courses</Link>
      </div>
    );
  }

  const data = await loadStudentCourse(user.id, access.allowed, courseId);
  if (!data) {
    return (
      <div className="wtc-stack">
        <SectionHeader kicker="Education" title="Course unavailable" />
        <EmptyState title="Not available" hint="This course is not published or does not exist." />
        <Link href="/app/education" className={buttonClasses('ghost')}>← All courses</Link>
      </div>
    );
  }

  const { course, lessons, pinnedLinks, progress } = data;
  return (
    <div className="wtc-stack">
      <div className="wtc-spread">
        <SectionHeader kicker="Education" title={course.title} copy={course.description} />
        <Link href="/app/education" className={buttonClasses('ghost')}>← All courses</Link>
      </div>

      <div className="wtc-row" style={{ flexWrap: 'wrap' }}>
        <StatusPill tone={levelTone(course.level)}>{course.level}</StatusPill>
        {course.tags.map((t) => <StatusPill key={t} tone="neutral">{t}</StatusPill>)}
        <StatusPill tone={progress.progressPct === 100 ? 'ok' : 'warn'}>{progress.completedLessons}/{progress.totalLessons} complete ({progress.progressPct}%)</StatusPill>
        <form action={enrollAction}>
          <CsrfField />
          <input type="hidden" name="courseId" value={course.id} />
          <button className={buttonClasses('secondary')} type="submit">Enrol / resume</button>
        </form>
      </div>

      <Card title={`Course links (${pinnedLinks.length})`}>
        {pinnedLinks.length === 0 ? (
          <EmptyState title="No course links configured" />
        ) : (
          <ul className="wtc-stack" style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
            {pinnedLinks.map((link) => {
              const safeUrl = safeHttpsUrl(link.url);
              return (
                <li key={link.id} className="wtc-spread" style={{ borderBottom: '1px solid var(--stroke)', paddingBottom: 8 }}>
                  <div>
                    <strong>{link.label}</strong>
                    <div className="wtc-dim" style={{ fontSize: 12 }}>{link.iconType ?? 'link'} - order {link.sortOrder}</div>
                  </div>
                  {safeUrl ? <a className={buttonClasses('ghost')} href={safeUrl} target="_blank" rel="noopener noreferrer">Open -&gt;</a> : <span className="wtc-dim" style={{ fontSize: 12 }}>unavailable</span>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Lessons">
        {lessons.length === 0 ? (
          <EmptyState title="No lessons published yet" />
        ) : (
          <div className="wtc-stack">
            {lessons.map((l) => (
              <Link key={l.id} href={`/app/education/${course.id}/${l.id}`} className="wtc-spread" style={{ borderBottom: '1px solid var(--stroke)', paddingBottom: 8, textDecoration: 'none' }}>
                <div><strong>{l.sortOrder}. {l.title}</strong><div className="wtc-dim" style={{ fontSize: 12 }}>{l.contentType}</div></div>
                <StatusPill tone={l.completed ? 'ok' : 'neutral'}>{l.completed ? '✓ complete' : 'open'}</StatusPill>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
