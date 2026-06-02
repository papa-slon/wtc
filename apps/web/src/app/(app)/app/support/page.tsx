import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { CsrfField, assertCsrf } from '@/lib/csrf';
import { Card, SectionHeader, StatusPill, EmptyState, buttonClasses } from '@wtc/ui';
import { fmtDate } from '@/lib/format';
import { supportTicketSchema, loadSupport, createTicket } from '@/features/support/data';

async function createTicketAction(formData: FormData): Promise<void> {
  'use server';
  const user = await requireUser();
  await assertCsrf(formData);
  const parsed = supportTicketSchema.safeParse({
    subject: formData.get('subject'),
    body: formData.get('body'),
    productCode: formData.get('productCode') || undefined,
    priority: formData.get('priority') || undefined,
  });
  if (!parsed.success) return;
  await createTicket(user.id, parsed.data);
  revalidatePath('/app/support');
}

function statusTone(s: string) {
  return s === 'resolved' || s === 'closed' ? 'ok' : s === 'in_progress' ? 'warn' : 'neutral';
}

export default async function AppSupportPage() {
  const user = await requireUser();
  const state = await loadSupport(user.id);

  return (
    <div className="wtc-stack">
      <SectionHeader kicker="Support" title="Support & notifications" copy="Open a ticket and track its status. Support and admin staff triage from the admin console." />

      <div className="wtc-row" style={{ marginTop: -4 }}>
        {state.mode === 'postgres' ? (
          <StatusPill tone="ok">storage: Postgres</StatusPill>
        ) : (
          <>
            <StatusPill tone="warn">storage: in-memory (dev)</StatusPill>
            <span className="wtc-dim" style={{ fontSize: 12 }}>Demo mode — tickets are not persisted. Set DATABASE_URL to store tickets + notifications in Postgres.</span>
          </>
        )}
      </div>

      <Card title="Notifications">
        {state.notifications.length === 0 ? (
          <EmptyState title="No notifications" hint="Entitlement, TradingView, billing and bot-safety alerts appear here." />
        ) : (
          <div className="wtc-stack">
            {state.notifications.map((n) => (
              <div key={n.id} className="wtc-spread">
                <div>
                  <strong style={{ fontSize: 14 }}>{n.title}</strong>
                  <p className="wtc-dim" style={{ fontSize: 12, margin: '2px 0 0' }}>{n.body}</p>
                </div>
                <StatusPill tone={n.readAt ? 'neutral' : 'warn'}>{n.readAt ? 'read' : 'unread'}</StatusPill>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Open a ticket">
        <form action={createTicketAction} className="wtc-stack" style={{ gap: 12 }}>
          <CsrfField />
          <input className="wtc-input" name="subject" placeholder="Short subject (min 5 chars)" />
          <textarea className="wtc-input" name="body" placeholder="Describe the issue (min 10 chars). Never paste exchange API keys or secrets." rows={4} />
          <div className="wtc-row">
            <select className="wtc-input" name="productCode" defaultValue="" style={{ maxWidth: 220 }}>
              <option value="">General</option>
              <option value="tortila_bot">Tortila Bot</option>
              <option value="legacy_bot">Legacy Bot</option>
              <option value="axioma_terminal">Axioma Terminal</option>
              <option value="tradingview_indicators">TradingView Indicators</option>
              <option value="education">Education</option>
            </select>
            <select className="wtc-input" name="priority" defaultValue="normal" style={{ maxWidth: 160 }}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <button className={buttonClasses('primary')} type="submit">Submit ticket</button>
          </div>
        </form>
      </Card>

      <Card title="Your tickets">
        {state.tickets.length === 0 ? (
          <EmptyState title="No tickets yet" />
        ) : (
          <table className="wtc-table">
            <thead><tr><th>Subject</th><th>Product</th><th>Priority</th><th>Status</th><th>Opened</th></tr></thead>
            <tbody>
              {state.tickets.map((t) => (
                <tr key={t.id}>
                  <td>{t.subject}</td>
                  <td className="wtc-mono">{t.productCode ?? '—'}</td>
                  <td className="wtc-mono">{t.priority}</td>
                  <td><StatusPill tone={statusTone(t.status)}>{t.status}</StatusPill></td>
                  <td className="wtc-mono">{fmtDate(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
