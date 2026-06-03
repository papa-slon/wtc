import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { botAccessForUser } from '@/lib/access';
import { botMeta } from '@/features/bots/meta';
import { exportBotConfig, loadBotConfig } from '@/features/bots/config';
import { loadBotReadModel } from '@/features/bots/data';

export async function GET(_req: Request, { params }: { params: Promise<{ bot: string }> }) {
  const { bot } = await params;
  const meta = botMeta(bot);
  if (!meta) notFound();
  const user = await requireUser();
  const access = await botAccessForUser(user, meta.code);
  if (!access.allowed) return Response.json({ error: 'access_required' }, { status: 403 });

  const [state, legacyRead] = await Promise.all([
    loadBotConfig(user.id, meta.code),
    meta.code === 'legacy_bot' ? loadBotReadModel(meta.code, ['config']) : Promise.resolve(null),
  ]);
  const liveConfig =
    meta.code === 'legacy_bot' && legacyRead?.config.data?.raw && typeof legacyRead.config.data.raw === 'object'
      ? legacyRead.config.data.raw as Record<string, unknown>
      : null;
  const exported = exportBotConfig(meta.code, liveConfig ?? state.current);
  return new Response(exported.body, {
    status: 200,
    headers: {
      'content-type': exported.contentType,
      'content-disposition': `attachment; filename="${exported.filename}"`,
      'cache-control': 'no-store',
    },
  });
}
