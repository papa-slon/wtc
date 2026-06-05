import { requireUser } from '@/lib/session';
import { botAccessForUser } from '@/lib/access';
import { loadBotConfig } from '@/features/bots/config';
import { loadBotReadModelForUser } from '@/features/bots/data';
import { handleBotConfigExportRequest } from '@/features/bots/config-export-handler';

export async function GET(_req: Request, { params }: { params: Promise<{ bot: string }> }) {
  const { bot } = await params;
  return handleBotConfigExportRequest(_req, {
    bot,
    requireUser,
    botAccessForUser,
    loadBotConfig,
    loadBotReadModelForUser,
  });
}
