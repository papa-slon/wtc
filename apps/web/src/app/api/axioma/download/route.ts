export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { accessFor, reasonLabel } from '@/lib/access';
import { getServerDb } from '@/lib/backend';
import { csrfToken } from '@/lib/csrf';
import { requireUser } from '@/lib/session';
import { handleAxiomaDownloadRequest } from '@/features/terminal/axioma-download';

export async function GET(req: Request): Promise<Response> {
  return handleAxiomaDownloadRequest(req, {
    db: getServerDb(),
    env: process.env,
    getCsrfToken: async () => null,
    requireUser,
    accessFor,
    reasonLabel,
  });
}

export async function POST(req: Request): Promise<Response> {
  return handleAxiomaDownloadRequest(req, {
    db: getServerDb(),
    env: process.env,
    getCsrfToken: csrfToken,
    requireUser,
    accessFor,
    reasonLabel,
  });
}
