import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const configFeature = read('apps/web/src/features/bots/config-export.ts');
const handlerFeature = read('apps/web/src/features/bots/config-export-handler.ts');
const exportRoute = read('apps/web/src/app/api/bots/[bot]/config-export/route.ts');
const settingsPage = read('apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx');
const backtesterPage = read('apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx');
const tortilaTable = read('apps/web/src/features/bots/TortilaSymbolConfigTable.tsx');
const runtimeFormat = read('apps/web/src/features/bots/tortila-runtime-format.ts');
const botSettingsE2e = read('tests/e2e/bot-settings.spec.ts');

describe('bot config export', () => {
  it('exports safe bot-native config without keys or live-apply behavior', () => {
    expect(configFeature).toMatch(/exportBotConfig/);
    expect(configFeature).toMatch(/serializeTortilaSymbolConfigs/);
    expect(runtimeFormat).toMatch(/serializeTortilaSymbolConfig/);
    expect(tortilaTable).toMatch(/serializeTortilaSymbolConfigs/);
    expect(tortilaTable).toMatch(/Copy draft SYMBOL_CONFIGS/);
    expect(tortilaTable).toMatch(/Download config export uses the last saved WTC reference version/);
    expect(configFeature).toMatch(/SYMBOL_CONFIGS=/);
    expect(configFeature).toMatch(/wtc-tortila-config\.env/);
    expect(configFeature).toMatch(/wtc-legacy-config\.json/);
    expect(configFeature).toMatch(/no exchange keys/i);
    expect(configFeature).toMatch(/legacyAllowedExportConfig/);
    expect(configFeature).toMatch(/legacyRuntimeSymbolConfigSchema/);
    expect(configFeature).toMatch(/legacyRuntimeSymbolConfigsFromConfig/);
    expect(configFeature).toMatch(/delete safe\.providerPubId/);
    expect(configFeature).not.toMatch(/\.\.\.safeConfig/);
    expect(configFeature).not.toMatch(/apiSecret/);
    expect(configFeature).not.toMatch(/apiKey/);
  });

  it('gates config-export route by session and entitlement', () => {
    expect(exportRoute).toMatch(/requireUser/);
    expect(exportRoute).toMatch(/botAccessForUser/);
    expect(exportRoute).toMatch(/handleBotConfigExportRequest/);
    expect(handlerFeature).toMatch(/access_required/);
    expect(handlerFeature).toMatch(/loadBotReadModelForUser\(user\.id, meta\.code, \['config'\]\)/);
    expect(handlerFeature).toMatch(/legacy_provider_mapping_required/);
    expect(handlerFeature).toMatch(/provider_mapping_required/);
    expect(handlerFeature).toMatch(/legacyProviderMappingRequired/);
    expect(handlerFeature).toMatch(/legacyProviderAccountCount/);
    expect(handlerFeature).toMatch(/providerAccounts/);
    expect(handlerFeature).not.toMatch(/issue\?\.title === 'Legacy provider mapping required'/);
    expect(handlerFeature).toMatch(/content-disposition/);
    expect(handlerFeature).toMatch(/no-store/);
    expect(handlerFeature).toMatch(/nosniff/);
    expect(handlerFeature).toMatch(/no-referrer/);
  });

  it('surfaces config export from settings and the Tortila backtester flow', () => {
    expect(settingsPage).toMatch(/Download last saved reference export/);
    expect(settingsPage).toMatch(/Export requires mapped pub_id/);
    expect(settingsPage).toMatch(/legacyExportProviderCount !== 1/);
    expect(settingsPage).toMatch(/Legacy export requires exactly one active mapped pub_id/);
    expect(settingsPage).toMatch(/Legacy export needs exactly one mapped pub_id/);
    expect(settingsPage).toMatch(/Download the saved WTC reference settings in a bot-native format/);
    expect(settingsPage).toMatch(/contains no exchange keys and does not apply anything to a live bot/);
    expect(settingsPage).toMatch(/\/api\/bots\/\$\{bot\}\/config-export/);
    expect(backtesterPage).toMatch(/Download current config/);
    expect(backtesterPage).toMatch(/\/api\/bots\/\$\{slug\}\/config-export/);
  });

  it('keeps browser acceptance on config-export response bodies and blocked Legacy export', () => {
    expect(botSettingsE2e).toContain("page.request.get('/api/bots/tortila/config-export')");
    expect(botSettingsE2e).toContain("page.request.get('/api/bots/legacy/config-export')");
    expect(botSettingsE2e).toContain('content-disposition');
    expect(botSettingsE2e).toContain('wtc-tortila-config.env');
    expect(botSettingsE2e).toContain('provider_mapping_required');
    expect(botSettingsE2e).toContain('expectNoUnsafeExportMarkers');
    expect(botSettingsE2e).toContain("not.toContain('XRP/USDT:USDT@4h@1@0.007@2@1@4@20@0')");
  });
});
