export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { readFile } from 'node:fs/promises';
import { botAccessForUser, reasonLabel } from '@/lib/access';
import { requireUser } from '@/lib/session';
import { getRunnerRelease, runnerReleasePath } from '@wtc/backtester';

export async function GET(_req: Request, ctx: { params: Promise<{ bot: string }> }): Promise<Response> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { bot } = await ctx.params;
  if (bot !== 'tortila') {
    return Response.json({ error: 'no_runner_available' }, { status: 404 });
  }

  const access = await botAccessForUser(user, 'tortila_bot');
  if (!access.allowed) {
    return Response.json({ error: 'entitlement_denied', reason: reasonLabel(access.reason) }, { status: 403 });
  }

  const release = getRunnerRelease('tortila');
  if (!release) {
    return Response.json({ error: 'no_runner_available' }, { status: 404 });
  }

  let body: Buffer;
  try {
    body = await readFile(runnerReleasePath(release));
  } catch {
    return Response.json({ error: 'runner_artifact_missing' }, { status: 500 });
  }

  const arrayBuffer = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-length': String(body.byteLength),
      'content-disposition': `attachment; filename="${release.fileName}"`,
      'x-runner-version': release.version,
      'x-runner-sha256': release.sha256,
      'cache-control': 'private, no-store',
    },
  });
}
