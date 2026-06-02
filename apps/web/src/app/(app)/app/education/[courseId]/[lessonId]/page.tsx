import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { accessFor, reasonLabel } from '@/lib/access';
import { Card, SectionHeader, StatusPill, EmptyState, RiskWarningBanner, buttonClasses } from '@wtc/ui';
import { parseSanitizedLmsIframe, safeHttpsUrl } from '@wtc/lms';
import { CsrfField } from '@/lib/csrf';
import { lmsMode, loadStudentLesson } from '@/features/lms/queries';
import { markLessonCompleteAction } from '@/features/lms/actions';

function SafeEmbedFrame({ html, title }: { html?: string; title: string }) {
  const frame = parseSanitizedLmsIframe(html);
  if (!frame) return <p className="wtc-dim" style={{ margin: 0 }}>Embedded content is unavailable.</p>;
  return (
    <iframe
      src={frame.src}
      title={frame.title || title}
      loading={frame.loading}
      referrerPolicy={frame.referrerPolicy}
      allow={frame.allow}
      allowFullScreen={frame.allowFullscreen}
      sandbox="allow-scripts allow-same-origin allow-presentation"
      style={{ display: 'block', width: '100%', maxWidth: '100%', minWidth: 0, aspectRatio: '16 / 9', border: 0, borderRadius: 8 }}
    />
  );
}

function fileScanTone(status?: string) {
  if (status === 'clean') return 'ok' as const;
  if (status === 'quarantined' || status === 'failed') return 'bad' as const;
  if (status === 'pending') return 'warn' as const;
  return 'neutral' as const;
}

export default async function StudentLessonPage({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const { courseId, lessonId } = await params;
  const user = await requireUser();
  const access = await accessFor(user.id, 'education');

  if (!access.allowed) {
    return (
      <div className="wtc-stack">
        <SectionHeader kicker="Education" title="Lesson locked" />
        <RiskWarningBanner severity="warning" title={`Education access ${reasonLabel(access.reason)}`} detail="An active education entitlement is required (fail-closed)." />
        <Link href="/app/billing" className={buttonClasses('primary')}>Go to billing</Link>
      </div>
    );
  }

  if (lmsMode() === 'demo') {
    return (
      <div className="wtc-stack">
        <SectionHeader kicker="Education" title="Lesson" />
        <RiskWarningBanner severity="info" title="storage: in-memory (demo)" detail="Lesson content + progress are DB-backed. Set DATABASE_URL to view live lessons." />
        <Link href={`/app/education/${courseId}`} className={buttonClasses('ghost')}>← Back to course</Link>
      </div>
    );
  }

  const data = await loadStudentLesson(user.id, access.allowed, courseId, lessonId);
  if (!data) {
    return (
      <div className="wtc-stack">
        <SectionHeader kicker="Education" title="Lesson unavailable" />
        <EmptyState title="Not available" hint="This lesson is not published or does not exist." />
        <Link href={`/app/education/${courseId}`} className={buttonClasses('ghost')}>← Back to course</Link>
      </div>
    );
  }

  const { course, lesson, materials, pinnedLinks, completed } = data;
  // SECURITY (M-2): render-time https guard — never emit a non-https / javascript: / data: scheme as an href,
  // even if such a value somehow reached the DB. Primary control is the Zod https rule on the write path.
  const safeVideoUrl = lesson.contentType === 'video' ? safeHttpsUrl(lesson.videoUrl) : null;
  const safeExternalUrl = lesson.contentType === 'link' ? safeHttpsUrl(lesson.externalUrl) : null;
  return (
    <div className="wtc-stack">
      <div className="wtc-spread">
        <SectionHeader kicker={`Education · ${course.title}`} title={lesson.title} />
        <Link href={`/app/education/${course.id}`} className={buttonClasses('ghost')}>← Back to course</Link>
      </div>

      <div className="wtc-row">
        <StatusPill tone={completed ? 'ok' : 'neutral'}>{completed ? '✓ completed' : 'in progress'}</StatusPill>
        <form action={markLessonCompleteAction}>
          <CsrfField />
          <input type="hidden" name="courseId" value={course.id} />
          <input type="hidden" name="lessonId" value={lesson.id} />
          <button className={buttonClasses(completed ? 'ghost' : 'primary')} type="submit" disabled={completed}>{completed ? 'Completed' : 'Mark complete'}</button>
        </form>
      </div>

      {safeVideoUrl && (
        <Card title="Video">
          {/* Rendered as a safe outbound https link (no untrusted iframe embed). */}
          <a className={buttonClasses('secondary')} href={safeVideoUrl} target="_blank" rel="noopener noreferrer">Open video ↗</a>
        </Card>
      )}

      {safeExternalUrl && (
        <Card title="External resource">
          {/* 'link' lessons render a guarded outbound https link only — never raw HTML or an iframe. */}
          <a className={buttonClasses('secondary')} href={safeExternalUrl} target="_blank" rel="noopener noreferrer">Open link ↗</a>
        </Card>
      )}

      {lesson.contentType === 'embed' && (
        <Card title="Embedded content">
          {/* 'embed' is deferred (needs a server-side HTML sanitizer — stored-XSS gate); never render raw embed HTML. */}
          <SafeEmbedFrame html={lesson.embedHtml} title={lesson.title} />
        </Card>
      )}

      {lesson.body && (
        <Card title="Lesson">
          {/* Plain text — React escapes by default; never rendered as raw HTML. */}
          <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.7 }}>{lesson.body}</p>
        </Card>
      )}

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

      <Card title={`Materials (${materials.length})`}>
        {materials.length === 0 ? (
          <EmptyState title="No materials" />
        ) : (
          <ul className="wtc-stack" style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
            {materials.map((m) => {
              const mu = m.materialType === 'link' ? safeHttpsUrl(m.externalUrl) : null;
              return (
                <li key={m.id} className="wtc-stack" style={{ borderBottom: '1px solid var(--stroke)', paddingBottom: 8, gap: 10, minWidth: 0 }}>
                  <div className="wtc-spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap', minWidth: 0 }}>
                    <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                    {m.title} <span className="wtc-dim" style={{ fontSize: 12 }}>({m.materialType}{m.sizeBytes ? ` - ${Math.round(m.sizeBytes / 102.4) / 10} KB` : ''})</span>
                    {m.materialType === 'file' ? <span style={{ marginLeft: 8 }}><StatusPill tone={fileScanTone(m.scanStatus)}>{m.scanStatus ?? 'pending'}</StatusPill></span> : null}
                  </span>
                  {mu ? <a className={buttonClasses('ghost')} href={mu} target="_blank" rel="noopener noreferrer">Open ↗</a> : null}
                  {m.materialType === 'file' && m.downloadUrl ? <a className={buttonClasses('ghost')} href={m.downloadUrl}>Download</a> : null}
                    {m.materialType === 'file' && !m.downloadUrl ? <span className="wtc-dim" style={{ fontSize: 12 }}>download unavailable</span> : null}
                  </div>
                  {m.materialType === 'embed' ? <SafeEmbedFrame html={m.embedHtml} title={m.title} /> : null}
                  {!mu && m.materialType !== 'file' && m.materialType !== 'embed' ? <span className="wtc-dim" style={{ fontSize: 12 }}>unavailable</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
