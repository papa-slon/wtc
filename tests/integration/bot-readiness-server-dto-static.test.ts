import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const loader = read('apps/web/src/features/bots/readiness-loader.ts');
const repositories = read('packages/db/src/repositories.ts');
const botDetail = read('apps/web/src/app/(app)/app/bots/[bot]/page.tsx');
const settings = read('apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx');
const setup = read('apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx');
const cabinet = read('apps/web/src/features/cabinet/loader.ts');
const launchPanel = read('apps/web/src/features/bots/BotLaunchReadinessPanel.tsx');

function sourceForExportedFunction(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}`);
  expect(start, `missing function ${name}`).toBeGreaterThanOrEqual(0);
  const next = src.indexOf('\nexport ', start + 1);
  return src.slice(start, next > start ? next : src.length);
}

describe('bot readiness server DTO boundary', () => {
  it('is server-only, entitlement-gated, and built from safe scalar facts', () => {
    expect(loader).toMatch(/import 'server-only'/);
    expect(loader).toMatch(/export async function loadBotReadinessForUser/);
    expect(loader).toMatch(/botAccessForUser/);
    expect(loader).toMatch(/if \(!access\.allowed\)/);
    expect(loader).toMatch(/summarizeExchangeKeyMetadata/);
    expect(loader).toMatch(/summarizeUserBotProviderMapping/);
    expect(loader).toMatch(/buildBotReadinessItems/);
    expect(loader).toMatch(/WORKER_CONTINUITY_STALE_AFTER_SECONDS = 3 \* 60/);
    expect(loader).toMatch(/where\(eq\(schema\.integrationHealthChecks\.target, 'worker'\)\)/);
    expect(loader).toMatch(/workerBotContinuityStatus: worker\?\.botContinuityStatus/);
    expect(loader).toMatch(/workerProductSnapshot: worker\?\.productSnapshot/);
    expect(loader).toMatch(/workerProductReadState: worker\?\.productReadState/);
    expect(loader).toMatch(/lastSyncAt: read\.health\.lastSyncAt/);
    expect(loader).toMatch(/staleDataSeconds: read\.health\.staleDataSeconds/);
    expect(loader).toMatch(/processAlive: read\.health\.processAlive/);
    expect(loader).toMatch(/loadBotReadModelForUser\(user\.id, productCode, \['metrics'\]\)/);
    expect(loader).not.toMatch(/recordExchangeKeyMetadataCheck|addExchangeKey|vault\.open|fetch\(|startBot|stopBot|applyConfig|apiKey|apiSecret|config\.raw|providerAccounts|s\.exchangeApiKeySecrets\.sealed/);
  });

  it('uses passive repository summaries that never select secret material or provider payloads', () => {
    const exchangeSummary = sourceForExportedFunction(repositories, 'summarizeExchangeKeyMetadata');
    expect(exchangeSummary).toMatch(/select\(\{ id: s\.exchangeAccounts\.id \}\)/);
    expect(exchangeSummary).toMatch(/select\(\{ exchangeAccountId: s\.exchangeApiKeySecrets\.exchangeAccountId \}\)/);
    expect(exchangeSummary).not.toMatch(/\.sealed|wrappedDek|payload|apiKey|apiSecret/);

    const providerSummary = sourceForExportedFunction(repositories, 'summarizeUserBotProviderMapping');
    expect(providerSummary).toMatch(/eq\(s\.botInstances\.userId, input\.userId\)/);
    expect(providerSummary).toMatch(/eq\(s\.botProviderAccounts\.userId, input\.userId\)/);
    expect(providerSummary).toMatch(/eq\(s\.botProviderAccounts\.status, 'active'\)/);
    expect(providerSummary).toMatch(/activeCount: rows\.length/);
    expect(providerSummary).toMatch(/ambiguous_mapping/);
    expect(providerSummary).not.toMatch(/providerAccountId|rawJson|providerAccounts/);
  });

  it('wires dashboard/settings/setup/cabinet readiness through the DTO instead of local builders', () => {
    expect(botDetail).toMatch(/loadBotReadinessForUser\(user, meta\.code, 'dashboard', \{ read \}\)/);
    expect(botDetail).toMatch(/const readinessItems = readiness\.items/);
    expect(botDetail).toMatch(/BotLaunchReadinessPanel/);
    expect(botDetail).toMatch(/<BotLaunchReadinessPanel bot=\{bot\} botName=\{meta\.name\} items=\{readinessItems\} \/>/);
    expect(botDetail).not.toMatch(/listExchangeKeys\(user\.id\)/);
    expect(botDetail).not.toMatch(/buildBotReadinessItems/);

    expect(settings).toMatch(/loadBotReadinessForUser\(user, meta\.code, 'settings', \{ includeOperationalRows: false \}\)/);
    expect(settings).toMatch(/const settingsReadiness = readiness\.items/);
    expect(settings).not.toMatch(/buildBotReadinessItems/);

    expect(setup).toMatch(/loadBotReadinessForUser\(user, meta\.code, 'setup-review', \{ includeOperationalRows: false \}\)/);
    expect(setup).toMatch(/const setupReadiness = readiness\.items/);
    expect(setup).toMatch(/readiness\.providerAccountCount/);
    expect(setup).not.toMatch(/buildBotReadinessItems/);

    expect(cabinet).toMatch(/loadBotReadinessForUser\(\{ id: userId, roles: \[\] \}, code, 'cabinet'/);
    expect(cabinet).toMatch(/decision\.allowed \? await gatherSignals\(userId, code, decision\) : undefined/);
    expect(cabinet).not.toMatch(/listExchangeKeys|loadBotConfig|buildBotReadinessItems/);
  });

  it('renders a launch readiness command center without live-control wiring', () => {
    expect(launchPanel).toMatch(/Launch readiness command center/);
    expect(launchPanel).toMatch(/Start bot unavailable/);
    expect(launchPanel).toMatch(/live start disabled/);
    expect(launchPanel).toMatch(/no exchange ping/);
    expect(launchPanel).toMatch(/does not start, stop, apply config, retest\s+exchange connectivity, or touch open positions/);
    expect(launchPanel).toMatch(/Open statistics/);
    expect(launchPanel).toMatch(/items: readonly BotReadinessItem\[\]/);
    expect(launchPanel).not.toMatch(/form action|type="submit"|startBot|stopBot|applyConfig|fetch\(|getBotAdapter|apiKey|apiSecret|sealed|Connection verified/);
  });
});
