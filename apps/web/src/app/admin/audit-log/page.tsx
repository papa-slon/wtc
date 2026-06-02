import { requireUser } from '@/lib/session';
import { assertAdmin } from '@wtc/auth';
import { recentAuditEvents, backendMode } from '@/lib/backend';
import { Card, SectionHeader, StatusPill, EmptyState } from '@wtc/ui';

export default async function AuditLogPage() {
  const actor = await requireUser();
  assertAdmin(actor.roles); // per-page RBAC (defence-in-depth beyond the layout gate)

  const events = await recentAuditEvents(); // newest-first; DB-backed in production, in-memory in dev
  return (
    <div className="wtc-stack">
      <SectionHeader kicker="Admin" title="Audit log" copy="Append-only, secret-redacted record of sensitive actions (login, key CRUD, grants/revokes, admin actions)." />
      {/* Storage mode pill — canonical, consistent with every other admin page */}
      <div className="wtc-row" style={{ marginTop: -4 }}>
        {backendMode === 'postgres' ? (
          <StatusPill tone="ok">storage: Postgres</StatusPill>
        ) : (
          <StatusPill tone="warn">storage: in-memory (demo)</StatusPill>
        )}
      </div>
      <Card>
        {events.length === 0 ? <EmptyState title="No audit events yet" hint="Log in, add a key, or grant a product to generate events." /> : (
          <div className="wtc-table-wrap">
            <table className="wtc-table">
              <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Result</th></tr></thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="wtc-mono" data-label="Time" style={{ fontSize: 12 }}>{new Date(e.ts).toISOString().replace('T', ' ').slice(0, 19)}</td>
                    <td data-label="Actor">{e.actorRole ?? 'system'}</td>
                    <td className="wtc-mono" data-label="Action">{e.action}</td>
                    <td className="wtc-dim" data-label="Target" style={{ fontSize: 12 }}>{e.targetType}{e.targetId ? `:${e.targetId.slice(0, 18)}` : ''}</td>
                    <td data-label="Result"><StatusPill tone={e.result === 'success' ? 'ok' : 'bad'}>{e.result}</StatusPill></td>
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
