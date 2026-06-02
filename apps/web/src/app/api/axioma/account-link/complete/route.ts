export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { accessFor, reasonLabel } from '@/lib/access';
import { getServerDb } from '@/lib/backend';
import { handleAxiomaAccountLinkCompleteRequest } from '@/features/terminal/axioma-account-link';

function options() {
  return {
    db: getServerDb(),
    env: process.env,
    getCsrfToken: async () => null,
    requireUser: async () => {
      throw new Error('browser session not used for Axioma account-link completion');
    },
    accessFor,
    reasonLabel,
  };
}

export async function GET(req: Request): Promise<Response> {
  return handleAxiomaAccountLinkCompleteRequest(req, options());
}

export async function POST(req: Request): Promise<Response> {
  return handleAxiomaAccountLinkCompleteRequest(req, options());
}
