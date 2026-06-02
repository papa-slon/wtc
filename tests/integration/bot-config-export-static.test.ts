import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const configFeature = read('apps/web/src/features/bots/config.ts');
const exportRoute = read('apps/web/src/app/api/bots/[bot]/config-export/route.ts');
const settingsPage = read('apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx');
const backtesterPage = read('apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx');

describe('bot config export', () => {
  it('exports safe bot-native config without keys or live-apply behavior', () => {
    expect(configFeature).toMatch(/exportBotConfig/);
    expect(configFeature).toMatch(/SYMBOL_CONFIGS=/);
    expect(configFeature).toMatch(/wtc-tortila-config\.env/);
    expect(configFeature).toMatch(/wtc-legacy-config\.json/);
    expect(configFeature).toMatch(/no exchange keys/i);
    expect(configFeature).not.toMatch(/apiSecret/);
    expect(configFeature).not.toMatch(/apiKey/);
  });

  it('gates config-export route by session and entitlement', () => {
    expect(exportRoute).toMatch(/requireUser/);
    expect(exportRoute).toMatch(/accessFor/);
    expect(exportRoute).toMatch(/access_required/);
    expect(exportRoute).toMatch(/content-disposition/);
    expect(exportRoute).toMatch(/no-store/);
  });

  it('surfaces config export from settings and the Tortila backtester flow', () => {
    expect(settingsPage).toMatch(/Download config export/);
    expect(settingsPage).toMatch(/\/api\/bots\/\$\{bot\}\/config-export/);
    expect(backtesterPage).toMatch(/Download current config/);
    expect(backtesterPage).toMatch(/\/api\/bots\/\$\{slug\}\/config-export/);
  });
});
