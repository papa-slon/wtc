import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const data = read('apps/web/src/features/bots/data.tsx');
const botsList = read('apps/web/src/app/(app)/app/bots/page.tsx');
const botDetail = read('apps/web/src/app/(app)/app/bots/[bot]/page.tsx');
const positions = read('apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx');
const trades = read('apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx');
const equity = read('apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx');
const safety = read('apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx');
const settings = read('apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx');
const setup = read('apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx');
const config = read('apps/web/src/features/bots/config.ts');
const adminQueries = read('apps/web/src/features/admin/queries.ts');
const adminBots = read('apps/web/src/app/admin/bots/page.tsx');
const journal = read('apps/web/src/features/bots/journal.ts');

describe('bot read surfaces tolerate blocked/not-ready adapters', () => {
  it('shared loader catches LegacyAdapterBlockedError and AdapterNotReadyError', () => {
    expect(data).toMatch(/LegacyAdapterBlockedError/);
    expect(data).toMatch(/AdapterNotReadyError/);
    expect(data).toMatch(/botReadIssueFromError/);
    expect(data).toMatch(/safeBotCall/);
    expect(data).toMatch(/loadBotReadModel/);
  });

  it('bot dashboard pages use the safe read model instead of direct adapter data calls', () => {
    for (const source of [botsList, botDetail, positions, trades, equity, safety]) {
      expect(source).toMatch(/loadBotReadModel/);
      expect(source).not.toMatch(/getBotAdapter/);
    }
  });

  it('bot list does not call read adapters for unentitled products', () => {
    expect(botsList).toMatch(/const read = access\.allowed \? await loadBotReadModel\(b\.code, \['metrics'\]\) : null/);
    expect(botsList).toMatch(/adapter status hidden until entitlement is active/);
  });

  it('UI renders adapter read issues instead of fabricating zeros', () => {
    for (const source of [botsList, botDetail, positions, trades, equity, safety]) {
      expect(source).toMatch(/\.issue/);
    }
    expect(botDetail).toMatch(/No metrics available from this adapter/);
  });

  it('safety route reads warnings through the safe wrapper', () => {
    expect(safety).toMatch(/loadBotReadModel\(meta\.code, \['warnings'\]\)/);
    expect(safety).toMatch(/read\.warnings\.issue/);
    expect(data).toMatch(/warnings: SafeBotRead<RiskWarning\[\]>/);
  });

  it('not_configured health skips UI data reads instead of probing unauthenticated endpoints', () => {
    expect(data).toMatch(/const canReadData = health\.readState !== 'not_configured'/);
    expect(data).toMatch(/want\.has\('metrics'\) && canReadData/);
    expect(data).toMatch(/want\.has\('trades'\) && canReadData/);
  });

  it('production Tortila read-only UI is DB-snapshot backed, not web adapter backed', () => {
    expect(data).toMatch(/function dbSnapshotMode\(productCode: BotProductCode\)/);
    expect(data).toMatch(/productCode === 'tortila_bot'/);
    expect(data).toMatch(/process\.env\.NODE_ENV === 'production'/);
    expect(data).toMatch(/loadDbBotReadModel/);
    expect(data).toMatch(/integrationHealthChecks/);
    expect(data).toMatch(/botMetricSnapshots/);
    expect(data).toMatch(/botPositionSnapshots/);
    expect(data).toMatch(/botTradeImports/);
  });

  it('admin bot health renders not_configured as setup-needed, not a generic error', () => {
    expect(adminQueries).toMatch(/tortilaJournalStatus/);
    expect(adminQueries).toMatch(/tortilaJournalReadState/);
    expect(adminQueries).toMatch(/lastErr\.status === 'not_configured'/);
    expect(adminBots).toMatch(/journal: setup needed/);
    expect(adminBots).toMatch(/tortilaJournalReadStateDetail/);
  });

  it('bot journal stays DB-only when Postgres is configured', () => {
    const dbLookup = journal.indexOf('const inst = await ensureBotInstance');
    const importsBranch = journal.indexOf('if (imports.length > 0)');
    const noImportsReturn = journal.indexOf("source: 'db_imports'", importsBranch);
    expect(dbLookup).toBeGreaterThan(0);
    expect(importsBranch).toBeGreaterThan(dbLookup);
    expect(noImportsReturn).toBeGreaterThan(importsBranch);
    expect(journal.indexOf("const read = await loadBotReadModel(productCode, ['trades']);", dbLookup)).toBe(-1);
  });
});

describe('bot config captures manual/auto intent without live control', () => {
  it('schema persists operationMode as manual|auto with a manual-safe default', () => {
    expect(config).toMatch(/z\.enum\(\['manual', 'auto'\]\)\.default\('manual'\)/);
    expect(config).toMatch(/BOT_OPERATION_MODES/);
    expect(config).toMatch(/operationMode: 'manual'/);
  });

  it('ships product-specific reference profiles and demo persistence for browser setup', () => {
    expect(config).toMatch(/BotConfigPreset/);
    expect(config).toMatch(/TORTILA_PRESETS/);
    expect(config).toMatch(/LEGACY_PRESETS/);
    expect(config).toMatch(/botConfigPresetsFor/);
    expect(config).toMatch(/botConfigPresetFor/);
    expect(config).toMatch(/__WTC_DEMO_BOT_CONFIGS__/);
  });

  it('config is product-specific for Tortila and Legacy', () => {
    expect(config).toMatch(/tortilaBotConfigSchema/);
    expect(config).toMatch(/legacyBotConfigSchema/);
    expect(config).toMatch(/tortilaSymbolConfigSchema/);
    expect(config).toMatch(/serializeTortilaSymbolConfigs/);
    expect(config).toMatch(/stopN/);
    expect(config).toMatch(/rsiLength/);
    expect(config).toMatch(/botConfigSchemaFor/);
    expect(config).toMatch(/botConfigFieldsFor/);
  });

  it('settings and setup parse and render operationMode while keeping WTC-only copy', () => {
    for (const source of [settings, setup]) {
      expect(source).toMatch(/botConfigFormInput\(meta\.code, formData\)/);
      expect(source).toMatch(/name="operationMode"/);
      expect(source).toMatch(/WTC-side intent only/);
    }
    expect(settings).toMatch(/applyBotPresetAction/);
    expect(settings).toMatch(/Reference profiles/);
    expect(setup).toMatch(/wizardApplyPreset/);
    expect(setup).toMatch(/Use this profile/);
  });

  it('Tortila settings/setup render a per-coin SYMBOL_CONFIGS editor', () => {
    const symbolTable = read('apps/web/src/features/bots/TortilaSymbolConfigTable.tsx');
    expect(symbolTable).toMatch(/Per-coin Tortila configuration/);
    expect(symbolTable).toMatch(/Generated SYMBOL_CONFIGS/);
    expect(symbolTable).toMatch(/symbol@tf@system@risk@stop@add@max_units@atr@tp_rr/);
    expect(settings).toMatch(/TortilaSymbolConfigTable/);
    expect(setup).toMatch(/TortilaSymbolConfigTable/);
    expect(config).toMatch(/symbolConfigs: z\.array/);
  });

  it('legacy live setup is blocked while still allowing WTC-side reference settings', () => {
    expect(setup).toMatch(/Live setup blocked/);
    expect(setup).toMatch(/liveAdapterBlocked/);
    expect(settings).toMatch(/WTC-side reference config/);
  });
});
