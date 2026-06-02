import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { CsrfField } from '@/lib/csrf';
import { Card, SectionHeader, StatusPill, EmptyState, RiskWarningBanner, buttonClasses } from '@wtc/ui';
import { safeHttpsUrl } from '@wtc/lms';
import { loadTeacherWorkspace } from '@/features/lms/queries';
import { saveTeacherProfileAction, createPinnedLinkAction, deletePinnedLinkAction } from '@/features/lms/actions';

const SOCIAL_FIELDS = [
  ['telegram', 'Telegram'],
  ['instagram', 'Instagram'],
  ['youtube', 'YouTube'],
  ['website', 'Website'],
] as const;

export default async function TeacherCommunityPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const isAdmin = user.roles.includes('admin');
  if (!user.roles.includes('teacher') && !isAdmin) redirect('/app');

  const ws = await loadTeacherWorkspace(user.id, isAdmin);
  const profile = ws.profile;

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="Teacher community"
        title="Profile & pinned links"
        copy="Manage the teacher profile and external community links shown to entitled students."
      />
      <div className="wtc-row" style={{ marginTop: -4 }}>
        {ws.mode === 'postgres' ? (
          <StatusPill tone="ok">storage: Postgres</StatusPill>
        ) : (
          <>
            <StatusPill tone="warn">storage: in-memory (demo)</StatusPill>
            <span className="wtc-dim" style={{ fontSize: 12 }}>Connect DATABASE_URL to persist teacher profiles and links.</span>
          </>
        )}
      </div>

      <div className="wtc-grid wtc-grid-2">
        <Card title="Teacher profile">
          <form action={saveTeacherProfileAction} className="wtc-stack">
            <CsrfField />
            <div className="wtc-field">
              <label htmlFor="displayName">Display name</label>
              <input className="wtc-input" id="displayName" name="displayName" required minLength={2} defaultValue={profile?.displayName ?? user.displayName} />
            </div>
            <div className="wtc-field">
              <label htmlFor="bio">Bio</label>
              <textarea className="wtc-input" id="bio" name="bio" rows={4} defaultValue={profile?.bio ?? ''} />
            </div>
            {SOCIAL_FIELDS.map(([name, label]) => (
              <div className="wtc-field" key={name}>
                <label htmlFor={name}>{label} URL (https)</label>
                <input className="wtc-input" id={name} name={name} placeholder="https://..." defaultValue={profile?.socialLinks[name] ?? ''} />
              </div>
            ))}
            <button className={buttonClasses('primary')} type="submit">{profile ? 'Save profile' : 'Create profile'}</button>
          </form>
        </Card>

        <Card title="Pinned community links">
          {!profile ? (
            <EmptyState title="Create a profile first" hint="Pinned links are attached to the teacher profile so students can see who owns them." />
          ) : (
            <div className="wtc-stack">
              <form action={createPinnedLinkAction} className="wtc-stack">
                <CsrfField />
                <input type="hidden" name="ownerType" value="teacher_profile" />
                <input type="hidden" name="ownerId" value={profile.id} />
                <div className="wtc-field"><label htmlFor="label">Label</label><input className="wtc-input" id="label" name="label" required /></div>
                <div className="wtc-field"><label htmlFor="url">URL (https)</label><input className="wtc-input" id="url" name="url" placeholder="https://..." required /></div>
                <div className="wtc-field"><label htmlFor="iconType">Icon/type</label><input className="wtc-input" id="iconType" name="iconType" placeholder="telegram, instagram, site..." /></div>
                <div className="wtc-field"><label htmlFor="sortOrder">Sort order</label><input className="wtc-input" id="sortOrder" name="sortOrder" type="number" min="0" max="1000" defaultValue="0" /></div>
                <button className={buttonClasses('secondary')} type="submit">Add pinned link</button>
              </form>

              {ws.pinnedLinks.length === 0 ? (
                <EmptyState title="No pinned links yet" hint="Add Telegram, Instagram, Discord, docs, or any other https community link." />
              ) : (
                <div className="wtc-stack">
                  {ws.pinnedLinks.map((link) => (
                    <div key={link.id} className="wtc-spread" style={{ borderBottom: '1px solid var(--stroke)', paddingBottom: 8 }}>
                      <div>
                        <a className="wtc-link" href={safeHttpsUrl(link.url) ?? undefined} target="_blank" rel="noopener noreferrer">{link.label}</a>
                        <div className="wtc-dim" style={{ fontSize: 12 }}>{link.iconType ?? 'link'} · order {link.sortOrder}</div>
                      </div>
                      <form action={deletePinnedLinkAction}>
                        <CsrfField />
                        <input type="hidden" name="linkId" value={link.id} />
                        <input type="hidden" name="ownerType" value="teacher_profile" />
                        <input type="hidden" name="ownerId" value={profile.id} />
                        <button className={buttonClasses('ghost')} type="submit">Delete</button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <RiskWarningBanner
        severity="info"
        title="Student visibility is entitlement-gated"
        detail="These links are rendered only inside the Education room for users with active education access. External communities still need their own moderation and invite policy."
      />
    </div>
  );
}
