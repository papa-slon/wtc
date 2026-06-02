export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { accessFor, reasonLabel } from '@/lib/access';
import { getServerDb } from '@/lib/backend';
import { requireUser } from '@/lib/session';
import { handleLmsMaterialDownloadRequest } from '@/features/lms/material-download';

export async function GET(req: Request, ctx: { params: Promise<{ materialId: string }> }): Promise<Response> {
  const { materialId } = await ctx.params;
  return handleLmsMaterialDownloadRequest(req, materialId, {
    db: getServerDb(),
    requireUser,
    accessFor,
    reasonLabel,
  });
}
