import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { AccessDecision } from '@wtc/entitlements';
import {
  ensureBotInstance,
  findUserByEmail,
  getPublishedBotGlobalConfig,
  saveBotConfig,
  saveBotGlobalConfig,
  schema,
  seedDatabase,
  type Db,
} from '@wtc/db';
import {
  forbiddenBotConfigActionFormKey,
  handleApplyBotPresetAction,
  handleSaveBotConfigAction,
  handleUseSystemDefaultBotConfigAction,
  type BotConfigActionDependencies,
  type BotConfigActionRoutes,
} from '../../apps/web/src/features/bots/config-action-handler.ts';
import { botConfigErrorCopy, botConfigErrorRedirect } from '../../apps/web/src/features/bots/config-error-copy.ts';
import type { BotProductCode } from '../../apps/web/src/features/bots/meta.ts';

const user = { id: 'user-1', roles: ['user'] };
const manualConfig = { operationMode: 'manual', maxOpenSymbols: 5 };
const presetConfig = { operationMode: 'auto', maxOpenSymbols: 7 };
const tortilaDbConfig = {
  operationMode: 'manual',
  symbols: 'BTC/USDT:USDT',
  symbolConfigs: [
    { symbol: 'BTC/USDT:USDT', timeframe: '4h', system: 2, riskPercent: 0.3, stopN: 2, addStep: 0.5, maxUnits: 4, atrPeriod: 20, takeProfitRr: 0 },
  ],
  timeframe: '4h',
  system: 2,
  riskPercent: 0.3,
  stopN: 2,
  addStep: 0.5,
  maxUnits: 4,
  atrPeriod: 20,
  leverage: 3,
  takeProfitRr: 0,
  maxOpenSymbols: 5,
  maxTotalUnits: 12,
  maxUnitsPerDirection: 8,
  haltDrawdownPercent: 35,
  dailyMaxLossPercent: 6,
  maxNewEntriesPerTick: 2,
};

const settingsRoutes: BotConfigActionRoutes = {
  configError: '/app/bots/tortila/settings?err=config',
  lockedError: '/app/bots/tortila/settings?err=locked',
  systemDefaultError: '/app/bots/tortila/settings?err=system-default',
  revalidatePath: '/app/bots/tortila/settings',
  invalidPreset: 'noop',
};

const focusedSettingsRoutes: BotConfigActionRoutes = {
  ...settingsRoutes,
  configErrorFor: (error) => botConfigErrorRedirect('/app/bots/tortila/settings?err=config', error),
};

const setupRoutes: BotConfigActionRoutes = {
  configError: '/app/bots/legacy/setup?step=strategy&err=config',
  lockedError: '/app/bots/legacy/setup?step=strategy&err=locked',
  systemDefaultError: '/app/bots/legacy/setup?step=strategy&err=system-default',
  successRedirect: '/app/bots/legacy/setup?step=review',
  invalidPreset: 'config-error',
};

const focusedSetupRoutes: BotConfigActionRoutes = {
  ...setupRoutes,
  configErrorFor: (error) => botConfigErrorRedirect('/app/bots/legacy/setup?step=strategy&err=config', error),
};

function allowed(productCode: BotProductCode): AccessDecision {
  return { allowed: true, reason: 'allowed', status: 'active', productCode };
}

function denied(productCode: BotProductCode): AccessDecision {
  return { allowed: false, reason: 'blocked_no_entitlement', status: 'none', productCode };
}

function form(entries: readonly (readonly [string, string])[]): FormData {
  const formData = new FormData();
  for (const [key, value] of entries) formData.set(key, value);
  return formData;
}

function deps(overrides: Partial<BotConfigActionDependencies> = {}): BotConfigActionDependencies {
  return {
    requireUser: vi.fn(async () => user),
    botAccessForUser: vi.fn(async (_user, productCode) => allowed(productCode)),
    formIssues: vi.fn(() => []),
    configFromForm: vi.fn(() => manualConfig),
    parseConfig: vi.fn((_productCode, config) => ({ success: true, data: config })),
    findPreset: vi.fn((_productCode, presetId) => (presetId === 'known' ? { id: 'known', config: presetConfig } : undefined)),
    persistConfig: vi.fn(async () => 'saved'),
    selectSystemDefault: vi.fn(async (): Promise<'saved'> => 'saved'),
    ...overrides,
  };
}

async function createDb(): Promise<{ db: Db; adminId: string; userId: string }> {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const file of readdirSync(migDir).filter((name) => name.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, file), 'utf8'));
  }
  const db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  const adminId = (await findUserByEmail(db, 'admin@wtc.local'))!.id;
  const userId = (await findUserByEmail(db, 'user@wtc.local'))!.id;
  return { db, adminId, userId };
}

async function userBotWriteCounts(db: Db): Promise<{ instances: number; configs: number; versions: number }> {
  return {
    instances: (await db.select({ id: schema.botInstances.id }).from(schema.botInstances)).length,
    configs: (await db.select({ id: schema.botConfigs.id }).from(schema.botConfigs)).length,
    versions: (await db.select({ id: schema.botConfigVersions.id }).from(schema.botConfigVersions)).length,
  };
}

describe('bot config action handler runtime boundaries', () => {
  it('saves settings custom config through injected parsing and persist deps', async () => {
    const d = deps();
    const outcome = await handleSaveBotConfigAction(form([['bot', 'tortila']]), settingsRoutes, d, 'manual edit');

    expect(outcome).toEqual({ kind: 'success', revalidatePaths: ['/app/bots/tortila/settings'] });
    expect(d.botAccessForUser).toHaveBeenCalledWith(user, 'tortila_bot');
    expect(d.formIssues).toHaveBeenCalledWith('tortila_bot', expect.any(FormData));
    expect(d.configFromForm).toHaveBeenCalledWith('tortila_bot', expect.any(FormData));
    expect(d.parseConfig).toHaveBeenCalledWith('tortila_bot', manualConfig);
    expect(d.persistConfig).toHaveBeenCalledWith('user-1', 'tortila_bot', manualConfig, 'manual edit', undefined);
  });

  it('redirects setup custom saves to review without importing Next redirect into the helper', async () => {
    const d = deps();
    const outcome = await handleSaveBotConfigAction(form([['bot', 'legacy']]), setupRoutes, d, 'wizard manual edit');

    expect(outcome).toEqual({
      kind: 'redirect',
      redirectTo: '/app/bots/legacy/setup?step=review',
      revalidatePaths: [],
    });
    expect(d.persistConfig).toHaveBeenCalledWith('user-1', 'legacy_bot', manualConfig, 'wizard manual edit', undefined);
  });

  it('rejects forbidden hidden FormData fields before form parsing or persistence', async () => {
    for (const key of ['apiKey', 'apiSecret', 'providerAccountId', 'providerPubId', 'rawJson', 'applyConfig', 'startBot', 'stopBot', 'retest', 'liveControl']) {
      const d = deps();
      const fd = form([['bot', 'tortila'], [key, 'malicious']]);
      const outcome = await handleSaveBotConfigAction(fd, settingsRoutes, d, 'manual edit');

      expect(forbiddenBotConfigActionFormKey(fd)).toBe(key);
      expect(outcome).toEqual({ kind: 'redirect', redirectTo: '/app/bots/tortila/settings?err=config', revalidatePaths: [] });
      expect(d.formIssues).not.toHaveBeenCalled();
      expect(d.configFromForm).not.toHaveBeenCalled();
      expect(d.parseConfig).not.toHaveBeenCalled();
      expect(d.persistConfig).not.toHaveBeenCalled();
    }
  });

  it('redirects row form issues with whitelisted metadata before parsing or persistence', async () => {
    const d = deps({
      formIssues: vi.fn(() => ['Tortila coin 1: DOGE/USDT:USDT Number must be less than or equal to 3.']),
      firstFormIssue: vi.fn(() => ({ code: 'tortila-row-risk', row: 1 })),
    });
    const fd = form([['bot', 'tortila'], ['symbol_custom_0', 'DOGE/USDT:USDT'], ['risk_0', '9']]);
    const outcome = await handleSaveBotConfigAction(fd, focusedSettingsRoutes, d, 'manual edit');

    expect(outcome).toEqual({
      kind: 'redirect',
      redirectTo: '/app/bots/tortila/settings?err=config&issue=tortila-row-risk&row=1',
      revalidatePaths: [],
    });
    expect(outcome.redirectTo).not.toContain('DOGE');
    expect(outcome.redirectTo).not.toContain('Number');
    expect(d.configFromForm).not.toHaveBeenCalled();
    expect(d.parseConfig).not.toHaveBeenCalled();
    expect(d.persistConfig).not.toHaveBeenCalled();

    const legacy = deps({
      formIssues: vi.fn(() => ['Legacy stage 2: Number must be less than or equal to 50.']),
      firstFormIssue: vi.fn(() => ({ code: 'legacy-stage-capacity', row: 2 })),
    });
    await expect(handleSaveBotConfigAction(form([['bot', 'legacy']]), focusedSetupRoutes, legacy, 'wizard manual edit'))
      .resolves.toEqual({
        kind: 'redirect',
        redirectTo: '/app/bots/legacy/setup?step=strategy&err=config&issue=legacy-stage-capacity&row=2',
        revalidatePaths: [],
      });
    expect(legacy.persistConfig).not.toHaveBeenCalled();
  });

  it('redirects top-level Tortila cap form issues without row focus or persistence', async () => {
    for (const [code, expected] of [
      ['tortila-portfolio-limit', '/app/bots/tortila/settings?err=config&issue=tortila-portfolio-limit'],
      ['tortila-risk-limit', '/app/bots/tortila/settings?err=config&issue=tortila-risk-limit'],
      ['tortila-entry-throttle', '/app/bots/tortila/settings?err=config&issue=tortila-entry-throttle'],
    ] as const) {
      const d = deps({
        formIssues: vi.fn(() => [`Tortila top-level ${code} failed schema validation.`]),
        firstFormIssue: vi.fn(() => ({ code })),
      });
      const outcome = await handleSaveBotConfigAction(form([['bot', 'tortila']]), focusedSettingsRoutes, d, 'manual edit');

      expect(outcome).toEqual({ kind: 'redirect', redirectTo: expected, revalidatePaths: [] });
      expect(outcome.redirectTo).not.toContain('row=');
      expect(d.configFromForm).not.toHaveBeenCalled();
      expect(d.parseConfig).not.toHaveBeenCalled();
      expect(d.persistConfig).not.toHaveBeenCalled();
    }
  });

  it('keeps forbidden-key failures generic with no row focus even when focused routes are enabled', async () => {
    const d = deps();
    const outcome = await handleSaveBotConfigAction(
      form([['bot', 'tortila'], ['apiSecret', 'should-not-echo'], ['row', '1']]),
      focusedSettingsRoutes,
      d,
      'manual edit',
    );

    expect(outcome).toEqual({
      kind: 'redirect',
      redirectTo: '/app/bots/tortila/settings?err=config&issue=forbidden-field',
      revalidatePaths: [],
    });
    expect(outcome.redirectTo).not.toContain('should-not-echo');
    expect(outcome.redirectTo).not.toContain('row=1');
    expect(d.formIssues).not.toHaveBeenCalled();
    expect(d.persistConfig).not.toHaveBeenCalled();
  });

  it('does not redirect malformed bot slugs or caller-supplied redirect fields', async () => {
    const d = deps({
      formIssues: vi.fn(() => ['Tortila coin 1: invalid']),
      firstFormIssue: vi.fn(() => ({ code: 'tortila-row-risk', row: 1 })),
    });
    const outcome = await handleSaveBotConfigAction(
      form([['bot', '//evil.example'], ['next', 'https://evil.example/steal'], ['returnTo', '/admin']]),
      focusedSettingsRoutes,
      d,
      'manual edit',
    );

    expect(outcome).toEqual({ kind: 'noop', revalidatePaths: [] });
    expect(d.botAccessForUser).not.toHaveBeenCalled();
    expect(d.persistConfig).not.toHaveBeenCalled();
  });

  it('wires first form issue classification to bounded row and stage codes', () => {
    const configSource = readFileSync(resolve(process.cwd(), 'apps/web/src/features/bots/config.ts'), 'utf8');

    expect(configSource).toContain('export function botConfigFirstFormIssue');
    expect(configSource).toContain("return { code: tortilaRowIssueCode(firstZodPath(parsed)), row: i + 1 }");
    expect(configSource).toContain("return { code: legacyRowIssueCode(firstZodPath(parsed)), row: i + 1 }");
    expect(configSource).toContain("return { code: legacyStageIssueCode(firstZodPath(parsed)), row: i + 1 }");
    expect(configSource).toContain("if (hasDuplicate(symbols)) return { code: 'tortila-duplicate-symbol' }");
    expect(configSource).toContain("if (hasDuplicate(legacySymbols)) return { code: 'legacy-duplicate-symbol' }");
    expect(configSource).toContain("if (hasDuplicate(stages)) return { code: 'legacy-stage-duplicate' }");
    expect(configSource).toContain("if (field === 'riskPercent') return 'tortila-row-risk'");
    expect(configSource).toContain("if (field === 'averagingPercents' || field === 'averagingVolumePercents') return 'legacy-row-ladder'");
  });

  it('renders safe row-error copy from whitelisted query params only', () => {
    const copy = botConfigErrorCopy('legacy_bot', { err: 'config', issue: 'legacy-row-ladder', row: '1' });
    expect(copy).toMatchObject({ target: 'legacy-row', row: 1 });
    expect(copy?.detail).toContain('Drop ladder and volume ladder');
    const serialized = JSON.stringify(copy);
    for (const forbidden of ['apiSecret', 'providerPubId', 'rawJson', 'applyConfig', 'https://', 'DOGE/USDT']) {
      expect(serialized).not.toContain(forbidden);
    }

    expect(botConfigErrorCopy('tortila_bot', { err: 'config', issue: 'legacy-row-ladder', row: '1' })?.target).toBe('global');
    const capIssues = [
      ['tortila-portfolio-limit', 'Max open symbols must be 1-20'],
      ['tortila-risk-limit', 'Drawdown halt must be 1-95%'],
      ['tortila-entry-throttle', 'Max new entries per tick must be a whole number from 1 to 20'],
    ] as const;
    for (const [issue, detail] of capIssues) {
      const capCopy = botConfigErrorCopy('tortila_bot', { err: 'config', issue });
      expect(capCopy).toMatchObject({ target: 'tortila-cap', code: issue });
      expect(capCopy?.detail).toContain(detail);
      expect(capCopy?.row).toBeUndefined();
      expect(botConfigErrorCopy('legacy_bot', { err: 'config', issue })?.target).toBe('global');
    }
    expect(botConfigErrorRedirect('/app/bots/tortila/settings?err=config', { code: 'tortila-row-risk', row: 999 }))
      .toBe('/app/bots/tortila/settings?err=config&issue=tortila-row-risk');
    expect(botConfigErrorRedirect('/app/bots/tortila/settings?err=config', { code: 'tortila-portfolio-limit', row: 1 }))
      .toBe('/app/bots/tortila/settings?err=config&issue=tortila-portfolio-limit');
  });

  it('does not persist invalid custom drafts or inaccessible bot requests', async () => {
    const invalid = deps({ parseConfig: vi.fn(() => ({ success: false as const })) });
    const invalidOutcome = await handleSaveBotConfigAction(form([['bot', 'tortila']]), settingsRoutes, invalid, 'manual edit');
    expect(invalidOutcome).toEqual({ kind: 'redirect', redirectTo: '/app/bots/tortila/settings?err=config', revalidatePaths: [] });
    expect(invalid.persistConfig).not.toHaveBeenCalled();

    const noAccess = deps({ botAccessForUser: vi.fn(async (_user, productCode) => denied(productCode)) });
    const noAccessOutcome = await handleSaveBotConfigAction(form([['bot', 'tortila']]), settingsRoutes, noAccess, 'manual edit');
    expect(noAccessOutcome).toEqual({ kind: 'noop', revalidatePaths: [] });
    expect(noAccess.configFromForm).not.toHaveBeenCalled();
    expect(noAccess.parseConfig).not.toHaveBeenCalled();
    expect(noAccess.persistConfig).not.toHaveBeenCalled();

    const noAccessPreset = deps({ botAccessForUser: vi.fn(async (_user, productCode) => denied(productCode)) });
    await expect(handleApplyBotPresetAction(form([['bot', 'tortila'], ['presetId', 'known']]), settingsRoutes, noAccessPreset))
      .resolves.toEqual({ kind: 'noop', revalidatePaths: [] });
    expect(noAccessPreset.findPreset).not.toHaveBeenCalled();
    expect(noAccessPreset.persistConfig).not.toHaveBeenCalled();

    const noAccessDefault = deps({ botAccessForUser: vi.fn(async (_user, productCode) => denied(productCode)) });
    await expect(handleUseSystemDefaultBotConfigAction(form([['bot', 'legacy']]), setupRoutes, noAccessDefault))
      .resolves.toEqual({ kind: 'noop', revalidatePaths: [] });
    expect(noAccessDefault.selectSystemDefault).not.toHaveBeenCalled();
  });

  it('turns locked system defaults into the locked error route without swallowing other persist errors', async () => {
    const locked = deps({ persistConfig: vi.fn(async () => { throw new Error('bot_config_override_disabled'); }) });
    const lockedOutcome = await handleSaveBotConfigAction(form([['bot', 'tortila']]), settingsRoutes, locked, 'manual edit');
    expect(lockedOutcome).toEqual({ kind: 'redirect', redirectTo: '/app/bots/tortila/settings?err=locked', revalidatePaths: [] });

    const unexpected = deps({ persistConfig: vi.fn(async () => { throw new Error('db_down'); }) });
    await expect(handleSaveBotConfigAction(form([['bot', 'tortila']]), settingsRoutes, unexpected, 'manual edit')).rejects.toThrow('db_down');
  });

  it('applies presets with surface-specific invalid-preset behavior', async () => {
    const settings = deps();
    const settingsOutcome = await handleApplyBotPresetAction(form([['bot', 'tortila'], ['presetId', 'known']]), settingsRoutes, settings);
    expect(settingsOutcome).toEqual({ kind: 'success', revalidatePaths: ['/app/bots/tortila/settings'] });
    expect(settings.persistConfig).toHaveBeenCalledWith('user-1', 'tortila_bot', presetConfig, 'preset:known', undefined);

    const missingSettings = deps();
    await expect(handleApplyBotPresetAction(form([['bot', 'tortila'], ['presetId', 'missing']]), settingsRoutes, missingSettings))
      .resolves.toEqual({ kind: 'noop', revalidatePaths: [] });
    expect(missingSettings.persistConfig).not.toHaveBeenCalled();

    const missingSetup = deps();
    await expect(handleApplyBotPresetAction(form([['bot', 'legacy'], ['presetId', 'missing']]), setupRoutes, missingSetup))
      .resolves.toEqual({ kind: 'redirect', redirectTo: '/app/bots/legacy/setup?step=strategy&err=config', revalidatePaths: [] });
    expect(missingSetup.persistConfig).not.toHaveBeenCalled();
  });

  it('selects system defaults without calling custom persist', async () => {
    const selected = deps();
    const selectedOutcome = await handleUseSystemDefaultBotConfigAction(form([['bot', 'legacy']]), setupRoutes, selected);
    expect(selectedOutcome).toEqual({ kind: 'redirect', redirectTo: '/app/bots/legacy/setup?step=review', revalidatePaths: [] });
    expect(selected.selectSystemDefault).toHaveBeenCalledWith('user-1', 'legacy_bot', undefined);
    expect(selected.persistConfig).not.toHaveBeenCalled();

    const unavailable = deps({ selectSystemDefault: vi.fn(async (): Promise<'unavailable'> => 'unavailable') });
    const unavailableOutcome = await handleUseSystemDefaultBotConfigAction(form([['bot', 'legacy']]), setupRoutes, unavailable);
    expect(unavailableOutcome).toEqual({
      kind: 'redirect',
      redirectTo: '/app/bots/legacy/setup?step=strategy&err=system-default',
      revalidatePaths: [],
    });
  });

  it('keeps the helper out of live-control and network paths', () => {
    const helper = readFileSync(resolve(process.cwd(), 'apps/web/src/features/bots/config-action-handler.ts'), 'utf8');
    expect(helper).not.toContain('@wtc/bot-adapters');
    expect(helper).not.toContain('packages/bot-adapters');
    expect(helper).not.toContain('fetch(');
    expect(helper).not.toContain('recordExchangeKeyMetadataCheck');
    expect(helper).not.toContain('addExchangeKey');
  });

  it('keeps locked-default and forbidden FormData failures no-write on the migrated DB schema', async () => {
    const { db, adminId, userId } = await createDb();
    await saveBotGlobalConfig(db, {
      productCode: 'tortila_bot',
      profileCode: 'system_default',
      label: 'Locked Tortila default',
      status: 'published',
      appliesToNewUsers: true,
      allowUserOverride: false,
      config: tortilaDbConfig,
      changedBy: adminId,
      reason: 'lock user overrides for review',
      expectedVersion: 0,
    });

    const dbDeps = deps({
      requireUser: vi.fn(async () => ({ id: userId, roles: ['user'] })),
      configFromForm: vi.fn(() => ({ ...tortilaDbConfig, maxOpenSymbols: 9 })),
      findPreset: vi.fn((_productCode, presetId) => (presetId === 'known' ? { id: 'known', config: { ...tortilaDbConfig, maxOpenSymbols: 8 } } : undefined)),
      persistConfig: vi.fn(async (actorUserId, productCode, config, note) => {
        const systemDefault = await getPublishedBotGlobalConfig(db, productCode);
        if (systemDefault?.allowUserOverride === false) throw new Error('bot_config_override_disabled');
        const inst = await ensureBotInstance(db, { userId: actorUserId, productCode });
        await saveBotConfig(db, { botInstanceId: inst.id, config, changedBy: actorUserId, note });
      }),
    });

    const before = await userBotWriteCounts(db);
    await expect(handleSaveBotConfigAction(form([['bot', 'tortila']]), settingsRoutes, dbDeps, 'manual edit'))
      .resolves.toEqual({ kind: 'redirect', redirectTo: '/app/bots/tortila/settings?err=locked', revalidatePaths: [] });
    await expect(handleApplyBotPresetAction(form([['bot', 'tortila'], ['presetId', 'known']]), settingsRoutes, dbDeps))
      .resolves.toEqual({ kind: 'redirect', redirectTo: '/app/bots/tortila/settings?err=locked', revalidatePaths: [] });
    await expect(handleSaveBotConfigAction(form([['bot', 'tortila'], ['startBot', 'true']]), settingsRoutes, dbDeps, 'manual edit'))
      .resolves.toEqual({ kind: 'redirect', redirectTo: '/app/bots/tortila/settings?err=config', revalidatePaths: [] });

    expect(await userBotWriteCounts(db)).toEqual(before);
  }, 30_000);

  // ── RBAC: account field CONSERVATIVE gate ────────────────────────────────────
  it('RBAC (conservative): non-admin POST with a non-empty account field calls persistConfig with accountId undefined (coerced to NULL bucket)', async () => {
    // user fixture: { id: 'user-1', roles: ['user'] } — NOT an admin.
    // Even when the hidden account field carries a non-empty pub_id, the RBAC gate
    // in resolveActionContext MUST strip it (roles.includes('admin') is false).
    const capturedAccountId: Array<string | null | undefined> = [];
    const d = deps({
      persistConfig: vi.fn(async (_userId, _productCode, _config, _note, accountId) => {
        capturedAccountId.push(accountId);
        return 'saved';
      }),
    });

    const outcome = await handleSaveBotConfigAction(
      form([['bot', 'tortila'], ['account', 'some-pub-id-123']]),
      settingsRoutes,
      d,
      'manual edit',
    );

    expect(outcome).toEqual({ kind: 'success', revalidatePaths: ['/app/bots/tortila/settings'] });
    // persistConfig must have been called with accountId=undefined (the NULL bucket).
    expect(d.persistConfig).toHaveBeenCalledTimes(1);
    expect(capturedAccountId[0]).toBeUndefined();
    // Confirm via toHaveBeenCalledWith too.
    expect(d.persistConfig).toHaveBeenCalledWith('user-1', 'tortila_bot', manualConfig, 'manual edit', undefined);
  });

  it('RBAC (conservative): admin POST with a non-empty account field passes that accountId through to persistConfig', async () => {
    // admin fixture: roles includes 'admin' — the gate MUST pass the accountId through.
    const adminUser = { id: 'admin-1', roles: ['admin'] };
    const capturedAccountId: Array<string | null | undefined> = [];
    const d = deps({
      requireUser: vi.fn(async () => adminUser),
      persistConfig: vi.fn(async (_userId, _productCode, _config, _note, accountId) => {
        capturedAccountId.push(accountId);
        return 'saved';
      }),
    });

    const outcome = await handleSaveBotConfigAction(
      form([['bot', 'tortila'], ['account', 'some-pub-id-123']]),
      settingsRoutes,
      d,
      'manual edit',
    );

    expect(outcome).toEqual({ kind: 'success', revalidatePaths: ['/app/bots/tortila/settings'] });
    // persistConfig must have been called with the actual accountId.
    expect(d.persistConfig).toHaveBeenCalledTimes(1);
    expect(capturedAccountId[0]).toBe('some-pub-id-123');
    expect(d.persistConfig).toHaveBeenCalledWith('admin-1', 'tortila_bot', manualConfig, 'manual edit', 'some-pub-id-123');
  });
});
