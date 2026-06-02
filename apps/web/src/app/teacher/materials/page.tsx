import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { CsrfField } from '@/lib/csrf';
import { Card, SectionHeader, StatusPill, EmptyState, RiskWarningBanner, buttonClasses } from '@wtc/ui';
import { safeHttpsUrl, type TeacherMaterialView } from '@wtc/lms';
import { loadTeacherMaterials } from '@/features/lms/queries';
import { deleteMaterialAction } from '@/features/lms/actions';

function materialHref(material: TeacherMaterialView): string | undefined {
  if (material.materialType === 'link') return safeHttpsUrl(material.externalUrl) ?? undefined;
  return undefined;
}

function scanTone(status?: TeacherMaterialView['scanStatus']) {
  if (status === 'clean') return 'ok' as const;
  if (status === 'quarantined' || status === 'failed') return 'bad' as const;
  if (status === 'pending') return 'warn' as const;
  return 'neutral' as const;
}

function scanLabel(material: TeacherMaterialView): string {
  if (material.materialType !== 'file') return 'not required';
  return material.scanStatus ?? 'pending';
}

export default async function TeacherMaterialsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const isAdmin = user.roles.includes('admin');
  if (!user.roles.includes('teacher') && !isAdmin) redirect('/app');

  const data = await loadTeacherMaterials(user.id, isAdmin);

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="Teacher materials"
        title="Materials"
        copy="Manage lesson materials across your courses: safe https links, DB-backed local files, and sanitized iframe embeds."
      />
      <div className="wtc-row" style={{ marginTop: -4 }}>
        {data.mode === 'postgres' ? <StatusPill tone="ok">storage: Postgres</StatusPill> : <><StatusPill tone="warn">storage: in-memory (demo)</StatusPill><span className="wtc-dim" style={{ fontSize: 12 }}>Connect DATABASE_URL to persist materials.</span></>}
      </div>

      <RiskWarningBanner
        severity="info"
        title="Local storage boundary"
        detail="This build records storage keys, scan state, quarantine state, and retention timestamps while storing bytes in Postgres for local acceptance. Production object storage and a real malware engine remain separate gates."
      />

      <Card title={`Linked materials (${data.rows.length})`}>
        {data.rows.length === 0 ? (
          <EmptyState title="No linked materials yet" hint="Open a course and add an https material to one of its lessons." />
        ) : (
          <div className="wtc-table-wrap">
            <table className="wtc-table">
              <thead><tr><th>Material</th><th>Course</th><th>Lesson</th><th>Kind</th><th>Scan</th><th>Action</th></tr></thead>
              <tbody>
                {data.rows.map(({ course, lesson, material }) => (
                  <tr key={material.id}>
                    <td data-label="Material">{materialHref(material) ? <a className="wtc-link" href={materialHref(material)} target={material.materialType === 'link' ? '_blank' : undefined} rel={material.materialType === 'link' ? 'noopener noreferrer' : undefined}>{material.title}</a> : material.title}</td>
                    <td data-label="Course"><Link className="wtc-link" href={`/teacher/courses/${course.id}`}>{course.title}</Link></td>
                    <td data-label="Lesson">{lesson.title}</td>
                    <td data-label="Kind"><StatusPill tone="neutral">{material.materialType}</StatusPill></td>
                    <td data-label="Scan"><StatusPill tone={scanTone(material.scanStatus)}>{scanLabel(material)}</StatusPill></td>
                    <td data-label="Action" className="wtc-td-action">
                      <form action={deleteMaterialAction}>
                        <CsrfField />
                        <input type="hidden" name="courseId" value={course.id} />
                        <input type="hidden" name="materialId" value={material.id} />
                        <button className={buttonClasses('ghost')} type="submit">Delete</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
