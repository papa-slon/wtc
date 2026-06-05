import type { AccessDecision } from '@wtc/entitlements';
import { botMeta, type BotProductCode } from './meta';
import { exportBotConfig } from './config-export';

export interface BotConfigExportUser {
  id: string;
  roles: readonly string[];
}

export interface BotConfigExportState {
  current: Record<string, unknown> | null;
}

export interface BotConfigExportReadModel {
  config: {
    data?: { raw?: unknown } | null;
    issue: { code?: string | null } | null;
  };
}

export interface BotConfigExportOptions {
  bot: string;
  requireUser: () => Promise<BotConfigExportUser>;
  botAccessForUser: (user: BotConfigExportUser, productCode: BotProductCode) => Promise<AccessDecision>;
  loadBotConfig: (userId: string, productCode: BotProductCode) => Promise<BotConfigExportState>;
  loadBotReadModelForUser: (userId: string, productCode: BotProductCode, parts: readonly ['config']) => Promise<BotConfigExportReadModel | null>;
  exportConfig?: typeof exportBotConfig;
}

function noStoreJson(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function legacyProviderAccountCount(readModel: BotConfigExportReadModel | null): number {
  const raw = readModel?.config.data?.raw;
  if (!isObject(raw) || !Array.isArray(raw.providerAccounts)) return 0;
  return raw.providerAccounts.filter((row) => isObject(row) && typeof row.pubId === 'string' && row.pubId.trim() !== '').length;
}

function legacyProviderMappingRequired(readModel: BotConfigExportReadModel | null): boolean {
  if (readModel?.config.issue?.code === 'legacy_provider_mapping_required') return true;
  return legacyProviderAccountCount(readModel) !== 1;
}

export async function handleBotConfigExportRequest(_req: Request, opts: BotConfigExportOptions): Promise<Response> {
  const meta = botMeta(opts.bot);
  if (!meta) return noStoreJson({ error: 'not_found' }, 404);

  let user: BotConfigExportUser;
  try {
    user = await opts.requireUser();
  } catch {
    return noStoreJson({ error: 'unauthenticated' }, 401);
  }

  const access = await opts.botAccessForUser(user, meta.code);
  if (!access.allowed) {
    return noStoreJson({ error: 'access_required', reason: access.reason }, 403);
  }

  const [state, legacyRead] = await Promise.all([
    opts.loadBotConfig(user.id, meta.code),
    meta.code === 'legacy_bot' ? opts.loadBotReadModelForUser(user.id, meta.code, ['config']) : Promise.resolve(null),
  ]);
  if (meta.code === 'legacy_bot' && legacyProviderMappingRequired(legacyRead)) {
    return noStoreJson({ error: 'provider_mapping_required' }, 403);
  }

  const exported = (opts.exportConfig ?? exportBotConfig)(meta.code, state.current);
  return new Response(exported.body, {
    status: 200,
    headers: {
      'content-type': exported.contentType,
      'content-disposition': `attachment; filename="${exported.filename}"`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  });
}
