import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { accessFor, reasonLabel } from '@/lib/access';
import { lmsService } from '@/lib/backend';
import { Card, SectionHeader, StatusPill, EmptyState, RiskWarningBanner, buttonClasses } from '@wtc/ui';
import { levelTone, safeHttpsUrl } from '@wtc/lms';
import { loadStudentCatalogue } from '@/features/lms/queries';

export default async function EducationPage() {
  const user = await requireUser();
  const access = await accessFor(user.id, 'education');

  if (!access.allowed) {
    return (
      <div className="wtc-stack">
        <SectionHeader kicker="Education" title="Lessons & materials" />
        <RiskWarningBanner severity="warning" title={`Access ${reasonLabel(access.reason)}`} detail="Education content is entitlement-gated. Activate the Education product in billing to unlock lessons. You cannot enumerate hidden/unentitled content." />
      </div>
    );
  }

  const catalogue = await loadStudentCatalogue(user.id, access.allowed);
  const courses = catalogue.courses.length > 0 ? catalogue.courses : await lmsService.listPublishedCourses();
  const withLessons = await Promise.all(courses.map(async (c) => ({ c, lessons: await lmsService.listLessonsForStudent(c.id, true) })));
  const socialLinks = catalogue.teacherProfiles.flatMap((profile) =>
    Object.entries(profile.socialLinks)
      .map(([kind, url]) => ({ id: `${profile.id}-${kind}`, label: `${profile.displayName} · ${kind}`, url: safeHttpsUrl(url), kind }))
      .filter((link): link is { id: string; label: string; url: string; kind: string } => !!link.url),
  );
  const pinnedLinks = catalogue.communityLinks
    .map((link) => ({ ...link, url: safeHttpsUrl(link.url) }))
    .filter((link): link is typeof link & { url: string } => !!link.url);

  return (
    <div className="wtc-stack">
      <SectionHeader kicker="Education" title="Lessons & materials" copy="You see only published content you are entitled to. Teachers manage their own courses." />
      <div className="wtc-row" style={{ marginTop: -4 }}>
        {catalogue.mode === 'postgres' ? (
          <StatusPill tone="ok">storage: Postgres</StatusPill>
        ) : (
          <>
            <StatusPill tone="warn">storage: in-memory (dev)</StatusPill>
            <span className="wtc-dim" style={{ fontSize: 12 }}>Dev fallback - content resets on restart. Set DATABASE_URL to persist to Postgres.</span>
          </>
        )}
      </div>
      {withLessons.length === 0 ? (
        <EmptyState title="No courses published yet" />
      ) : (
        withLessons.map(({ c, lessons }) => (
          <Card key={c.id} title={c.title} action={<span className="wtc-row" style={{ gap: 6 }}><StatusPill tone={levelTone(c.level)}>{c.level}</StatusPill><StatusPill tone="ok">enrolled</StatusPill></span>}>
            <p className="wtc-muted" style={{ fontSize: 14, marginTop: 0 }}>{c.description}</p>
            {c.tags.length > 0 && <div className="wtc-row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>{c.tags.map((t) => <StatusPill key={t} tone="neutral">{t}</StatusPill>)}</div>}
            {lessons.length === 0 ? <EmptyState title="No lessons yet" /> : (
              <ol className="wtc-stack" style={{ paddingLeft: 18 }}>
                {lessons.map((l) => (
                  <li key={l.id}><strong>{l.title}</strong>{l.body && <div className="wtc-dim" style={{ fontSize: 13 }}>{l.body}</div>}</li>
                ))}
              </ol>
            )}
            <div style={{ marginTop: 12 }}><Link href={`/app/education/${c.id}`} className={buttonClasses('secondary')}>Open course →</Link></div>
          </Card>
        ))
      )}
      <Card title="Community">
        {pinnedLinks.length === 0 && socialLinks.length === 0 ? (
          <EmptyState title="Community links not configured yet" hint="Teachers manage profile links and pinned links from the teacher console." />
        ) : (
          <div className="wtc-stack">
            {pinnedLinks.length > 0 && (
              <div className="wtc-row" style={{ flexWrap: 'wrap' }}>
                {pinnedLinks.map((link) => (
                  <a key={link.id} className={buttonClasses('secondary')} href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                ))}
              </div>
            )}
            {socialLinks.length > 0 && (
              <div className="wtc-row" style={{ flexWrap: 'wrap' }}>
                {socialLinks.map((link) => (
                  <a key={link.id} className={buttonClasses('ghost')} href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
