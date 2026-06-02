import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { assertAdmin } from '@wtc/auth';
import { listTerminalReleases, upsertTerminalRelease } from '@wtc/db';
import { CsrfField, assertCsrf } from '@/lib/csrf';
import { getServerDb } from '@/lib/backend';
import { requireUser } from '@/lib/session';
import { fmtDate } from '@/lib/format';
import { Card, SectionHeader, StatusPill, EmptyState, RiskWarningBanner, buttonClasses } from '@wtc/ui';

const releaseSchema = z.object({
  version: z.string().trim().min(1).max(40),
  channel: z.enum(['stable', 'beta']),
  platform: z.string().trim().min(3).max(40),
  publishedAt: z.string().trim().optional(),
  minSupportedVersion: z.string().trim().max(40).optional(),
  checksumSha256: z.string().trim().regex(/^[a-f0-9]{64}$/i).optional().or(z.literal('')),
  downloadUrlTemplate: z.string().trim().url().startsWith('https://').optional().or(z.literal('')),
  releaseNotesMarkdown: z.string().trim().max(4000).optional(),
  isCurrent: z.boolean(),
});

async function publishTerminalReleaseAction(formData: FormData): Promise<void> {
  'use server';
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);
  const parsed = releaseSchema.safeParse({
    version: formData.get('version'),
    channel: formData.get('channel'),
    platform: formData.get('platform'),
    publishedAt: formData.get('publishedAt') || undefined,
    minSupportedVersion: formData.get('minSupportedVersion') || undefined,
    checksumSha256: formData.get('checksumSha256') || undefined,
    downloadUrlTemplate: formData.get('downloadUrlTemplate') || undefined,
    releaseNotesMarkdown: formData.get('releaseNotesMarkdown') || undefined,
    isCurrent: formData.get('isCurrent') === 'on',
  });
  if (!parsed.success) throw new Error(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
  const db = getServerDb();
  if (!db) return;
  const publishedAt = parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : new Date();
  if (Number.isNaN(publishedAt.getTime())) throw new Error('Invalid publishedAt');
  await upsertTerminalRelease(db, {
    ...parsed.data,
    publishedAt,
    checksumSha256: parsed.data.checksumSha256 || undefined,
    downloadUrlTemplate: parsed.data.downloadUrlTemplate || undefined,
    minSupportedVersion: parsed.data.minSupportedVersion || undefined,
    releaseNotesMarkdown: parsed.data.releaseNotesMarkdown || undefined,
    actorUserId: actor.id,
  });
  revalidatePath('/admin/terminal');
  revalidatePath('/app/terminal');
}

export default async function AdminTerminalPage() {
  const actor = await requireUser();
  assertAdmin(actor.roles);
  const db = getServerDb();
  const releases = db ? await listTerminalReleases(db, 50) : [];

  return (
    <div className="wtc-stack">
      <div className="wtc-spread">
        <SectionHeader
          kicker="Admin"
          title="Terminal releases"
          copy="Control room for Axioma release metadata. This prepares the WTC terminal room without enabling the production bridge or local order gating."
        />
        {db ? <StatusPill tone="ok">storage: Postgres</StatusPill> : <StatusPill tone="warn">storage: in-memory (demo)</StatusPill>}
      </div>

      <RiskWarningBanner
        severity="info"
        title="Release metadata only"
        detail="Publishing a release row updates WTC metadata and the user terminal page. It does not upload installer bytes, call Axioma, enable downloads, or gate local terminal execution."
      />

      {!db && (
        <RiskWarningBanner
          severity="warning"
          title="Postgres required for terminal release publishing"
          detail="The admin form is visible for review, but release rows are persisted only when DATABASE_URL is configured."
        />
      )}

      <Card title="Publish or update a release">
        <form action={publishTerminalReleaseAction} className="wtc-grid wtc-grid-2">
          <CsrfField />
          <label className="wtc-field">
            <span>Version</span>
            <input className="wtc-input" name="version" placeholder="0.9.0" required disabled={!db} />
          </label>
          <label className="wtc-field">
            <span>Channel</span>
            <select className="wtc-input" name="channel" defaultValue="stable" disabled={!db}>
              <option value="stable">stable</option>
              <option value="beta">beta</option>
            </select>
          </label>
          <label className="wtc-field">
            <span>Platform</span>
            <input className="wtc-input" name="platform" defaultValue="windows-x64" required disabled={!db} />
          </label>
          <label className="wtc-field">
            <span>Published at</span>
            <input className="wtc-input" name="publishedAt" type="datetime-local" disabled={!db} />
          </label>
          <label className="wtc-field">
            <span>Minimum supported version</span>
            <input className="wtc-input" name="minSupportedVersion" placeholder="0.8.0" disabled={!db} />
          </label>
          <label className="wtc-field">
            <span>SHA-256</span>
            <input className="wtc-input" name="checksumSha256" placeholder="64 hex chars" disabled={!db} />
          </label>
          <label className="wtc-field" style={{ gridColumn: '1 / -1' }}>
            <span>Download URL template</span>
            <input className="wtc-input" name="downloadUrlTemplate" placeholder="https://downloads.example.com/axioma/{version}/installer.exe" disabled={!db} />
          </label>
          <label className="wtc-field" style={{ gridColumn: '1 / -1' }}>
            <span>Release notes</span>
            <textarea className="wtc-input" name="releaseNotesMarkdown" rows={4} placeholder="- Change one&#10;- Change two" disabled={!db} />
          </label>
          <label className="wtc-row">
            <input type="checkbox" name="isCurrent" defaultChecked disabled={!db} />
            <span>Mark as current for this channel/platform</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button className={buttonClasses('primary')} type="submit" disabled={!db}>Publish release metadata</button>
          </div>
        </form>
      </Card>

      <Card title="Release cache">
        {releases.length === 0 ? (
          <EmptyState title="No release rows" hint={db ? 'Publish the first terminal release metadata row.' : 'Connect DATABASE_URL to view and edit release rows.'} />
        ) : (
          <div className="wtc-table-wrap">
            <table className="wtc-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Channel</th>
                  <th>Platform</th>
                  <th>Published</th>
                  <th>Current</th>
                  <th>Checksum</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Version" className="wtc-mono">{r.version}</td>
                    <td data-label="Channel"><StatusPill tone={r.channel === 'stable' ? 'ok' : 'warn'}>{r.channel}</StatusPill></td>
                    <td data-label="Platform">{r.platform}</td>
                    <td data-label="Published" className="wtc-mono">{fmtDate(r.publishedAt.getTime())}</td>
                    <td data-label="Current"><StatusPill tone={r.isCurrent ? 'ok' : 'neutral'}>{r.isCurrent ? 'current' : 'archived'}</StatusPill></td>
                    <td data-label="Checksum" className="wtc-mono">{r.checksumSha256 ? `${r.checksumSha256.slice(0, 12)}...` : '-'}</td>
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
