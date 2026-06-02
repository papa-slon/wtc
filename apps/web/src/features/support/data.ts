import 'server-only';
import { z } from 'zod';
import { getServerDb } from '@/lib/backend';
import { createSupportTicket, listSupportTickets, listNotifications } from '@wtc/db';

/**
 * Support + notifications surface data. Tickets and notifications are per-user isolated at the repo
 * layer (always WHERE user_id = $userId). Without a DATABASE_URL the surface renders an honest demo
 * state (nothing persisted). Ticket create is audited in-txn (support.ticket_create).
 */
export const supportTicketSchema = z.object({
  subject: z.string().trim().min(5).max(160),
  body: z.string().trim().min(10).max(4000),
  productCode: z.string().trim().max(40).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
});

export interface TicketView { id: string; subject: string; status: string; priority: string; productCode: string | null; createdAt: number }
export interface NotifView { id: string; type: string; title: string; body: string; readAt: number | null; createdAt: number }
export interface SupportState { mode: 'postgres' | 'demo'; tickets: TicketView[]; notifications: NotifView[] }

export async function loadSupport(userId: string): Promise<SupportState> {
  const db = getServerDb();
  if (!db) return { mode: 'demo', tickets: [], notifications: [] };
  const tickets = await listSupportTickets(db, { userId });
  const notifications = await listNotifications(db, userId, { limit: 20 });
  return {
    mode: 'postgres',
    tickets: tickets.map((t) => ({ id: t.id, subject: t.subject, status: t.status, priority: t.priority, productCode: t.productCode, createdAt: t.createdAt.getTime() })),
    notifications: notifications.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, readAt: n.readAt?.getTime() ?? null, createdAt: n.createdAt.getTime() })),
  };
}

export async function createTicket(
  userId: string,
  input: { subject: string; body: string; productCode?: string; priority?: string },
): Promise<'created' | 'demo'> {
  const db = getServerDb();
  if (!db) return 'demo';
  await createSupportTicket(db, { userId, subject: input.subject, body: input.body, productCode: input.productCode, priority: input.priority });
  return 'created';
}
