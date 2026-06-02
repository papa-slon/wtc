export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { accessFor, reasonLabel } from '@/lib/access';
import { getServerDb } from '@/lib/backend';
import { csrfToken } from '@/lib/csrf';
import { requireUser } from '@/lib/session';
import { handleAxiomaJournalHandoffRequest } from '@/features/terminal/axioma-journal-handoff';

export async function GET(): Promise<Response> {
  return handleAxiomaJournalHandoffRequest(
    new Request('https://wtc.local/api/axioma/journal-handoff', { method: 'GET' }),
    {
      db: null,
      getCsrfToken: async () => null,
      requireUser,
      accessFor,
      reasonLabel,
      env: process.env,
    },
  );
}

export async function POST(req: Request): Promise<Response> {
  return handleAxiomaJournalHandoffRequest(req, {
    db: getServerDb(),
    getCsrfToken: csrfToken,
    requireUser,
    accessFor,
    reasonLabel,
    env: process.env,
  });
}
