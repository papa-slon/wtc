export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { accessFor, reasonLabel } from '@/lib/access';
import { getServerDb } from '@/lib/backend';
import { csrfToken } from '@/lib/csrf';
import { requireUser } from '@/lib/session';
import { handleAxiomaAccountLinkInitRequest } from '@/features/terminal/axioma-account-link';

function options() {
  return {
    db: getServerDb(),
    env: process.env,
    getCsrfToken: csrfToken,
    requireUser,
    accessFor,
    reasonLabel,
  };
}

export async function GET(req: Request): Promise<Response> {
  return handleAxiomaAccountLinkInitRequest(req, options());
}

export async function POST(req: Request): Promise<Response> {
  return handleAxiomaAccountLinkInitRequest(req, options());
}
