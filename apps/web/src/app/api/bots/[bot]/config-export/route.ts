import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { accessFor } from '@/lib/access';
import { botMeta } from '@/features/bots/meta';
import { exportBotConfig, loadBotConfig } from '@/features/bots/config';

export async function GET(_req: Request, { params }: { params: Promise<{ bot: string }> }) {
  const { bot } = await params;
  const meta = botMeta(bot);
  if (!meta) notFound();
  const user = await requireUser();
  const access = await accessFor(user.id, meta.code);
  if (!access.allowed) return Response.json({ error: 'access_required' }, { status: 403 });

  const state = await loadBotConfig(user.id, meta.code);
  const exported = exportBotConfig(meta.code, state.current);
  return new Response(exported.body, {
    status: 200,
    headers: {
      'content-type': exported.contentType,
      'content-disposition': `attachment; filename="${exported.filename}"`,
      'cache-control': 'no-store',
    },
  });
}
