import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

describe('user resolved bot config source guardrails', () => {
  it('adds a published-only resolver source model in the bot config feature', () => {
    const config = read('apps/web/src/features/bots/config.ts');
    const repos = read('packages/db/src/repositories.ts');

    expect(repos).toContain('getPublishedBotGlobalConfig');
    expect(repos).toContain("row.status !== 'published'");
    expect(repos).toContain('!row.appliesToNewUsers');
    expect(config).toContain("export type BotConfigSource = 'user_override' | 'system_default' | 'built_in'");
    expect(config).toContain('getPublishedBotGlobalConfig');
    expect(config).toContain('publishedSystemDefaultConfig');
    expect(config).toContain('botConfigSchemaFor(productCode).safeParse(row.config)');
    expect(config).toContain('safeUserBotConfigForProduct');
    expect(config).toContain('assertNoForbiddenUserBotConfigKeys(config)');
    expect(config).toContain('parseUserBotConfigForProduct(productCode, cfg.config)');
    expect(config).toContain('Saved custom profile failed validation');
    expect(config).toContain('sourceIssue');
    expect(config).toContain('sourceLabel');
    expect(config).toContain('sourceDetail');
    expect(config).toContain('allowUserOverride');
    expect(config).toContain('bot_config_override_disabled');
    expect(config).toContain('selectSystemDefaultBotConfig');
    expect(config).not.toContain('getBotAdapter');
    expect(config).not.toContain('startBot');
    expect(config).not.toContain('stopBot');
    expect(config).not.toContain('testExchange');
    expect(config).not.toContain('process.env.LEGACY_DATABASE_URL');
  });

  it('keeps settings/setup source choice behind user access and CSRF actions', () => {
    const settings = read('apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx');
    const setup = read('apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx');
    const quickPath = read('apps/web/src/features/bots/BotSettingsQuickPath.tsx');

    const settingsAccess = settings.indexOf('if (!access.allowed) return <BotAccessRequired');
    const settingsLoad = settings.indexOf('loadBotConfig(user.id, meta.code)');
    expect(settingsAccess).toBeGreaterThanOrEqual(0);
    expect(settingsLoad).toBeGreaterThan(settingsAccess);
    expect(settings).toContain('BotSettingsQuickPath');
    expect(settings).toContain('customVersionCount={state.versions.length}');
    expect(settings).toContain('exportBlockedByProviderMapping={exportBlockedByProviderMapping}');
    expect(settings).toContain('Use system default');
    expect(settings).toContain('Customize my settings');
    expect(settings).toContain('useSystemDefaultAction');
    expect(settings).toContain('selectSystemDefaultBotConfig');
    expect(settings).toContain('assertCsrf(formData)');
    expect(settings).toContain('botAccessForUser(user, meta.code)');
    expect(settings).toContain('Save custom settings');
    expect(settings).toContain('Customization locked');
    expect(settings).toContain('state.sourceIssue');

    const setupAccess = setup.indexOf('if (!access.allowed)');
    const setupLoad = setup.indexOf('loadBotConfig(user.id, meta.code)');
    expect(setupAccess).toBeGreaterThanOrEqual(0);
    expect(setupLoad).toBeGreaterThan(setupAccess);
    expect(setup).toContain('Use system default');
    expect(setup).toContain('Customize my settings');
    expect(setup).toContain('wizardUseSystemDefault');
    expect(setup).toContain('selectSystemDefaultBotConfig');
    expect(setup).toContain('assertCsrf(formData)');
    expect(setup).toContain('botAccessForUser(user, meta.code)');
    expect(setup).toContain('Save custom settings');
    expect(setup).toContain('Customization locked');
    expect(setup).toContain('cfg.sourceIssue');

    expect(quickPath).toContain('Basic settings path');
    expect(quickPath).toContain('2. Coin trigger');
    expect(quickPath).toContain('3. Stage slots');
    expect(quickPath).toContain('2. Coin strategy');
    expect(quickPath).toContain('3. Portfolio caps');
    expect(quickPath).toContain('live exchange ping is not run here');
    expect(quickPath).toContain('admin views are read-only per user');
    expect(quickPath).toContain('No live apply, start, stop, exchange mutation, or provider mutation');
    expect(quickPath).toContain('legacyProviderAccountCount');
    expect(quickPath).toContain('exchangeKeyCount');
    expect(quickPath).not.toContain('apiSecret');
    expect(quickPath).not.toContain('providerPubId');
    expect(quickPath).not.toContain('providerAccountId');
    expect(quickPath).not.toContain('applyConfig');
    expect(quickPath).not.toContain('startBot');
    expect(quickPath).not.toContain('stopBot');
  });

  it('exports the resolved WTC config source, not a Legacy runtime fallback', () => {
    const route = read('apps/web/src/app/api/bots/[bot]/config-export/route.ts');
    const handler = read('apps/web/src/features/bots/config-export-handler.ts');

    expect(route).toContain('requireUser');
    expect(route).toContain('botAccessForUser');
    expect(route).toContain('loadBotConfig');
    expect(route).toContain('handleBotConfigExportRequest');
    expect(handler).toContain('loadBotConfig(user.id, meta.code)');
    expect(handler).toContain('legacy_provider_mapping_required');
    expect(handler).toContain('(opts.exportConfig ?? exportBotConfig)(meta.code, state.current)');
    expect(handler).not.toContain('state.current ?? liveConfig');
    expect(handler).not.toContain('raw as Record<string, unknown>');
    expect(handler).toContain('cache-control');
    expect(handler).toContain('no-store');
  });

  it('does not add live control, provider raw, or secret paths to source chooser surfaces', () => {
    const surfaces = [
      read('apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx'),
      read('apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx'),
      read('apps/web/src/app/api/bots/[bot]/config-export/route.ts'),
    ].join('\n');

    for (const forbidden of [
      'getBotAdapter',
      'applyConfig',
      'startBot',
      'stopBot',
      'restartBot',
      'testExchange',
      'exchange_key.test',
      'providerAccountId',
      'rawJson',
      'LEGACY_DATABASE_URL',
      'TORTILA_JOURNAL_BASE_URL',
      'process.env',
    ]) {
      expect(surfaces).not.toContain(forbidden);
    }
    expect(surfaces).toContain('no live apply/start/stop');
    expect(surfaces).toContain('read-only evidence');
  });
});
