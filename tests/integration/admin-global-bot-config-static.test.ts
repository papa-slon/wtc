import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

function sourceForFunction(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = src.indexOf('\n// ----', start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

describe('admin global bot config guardrails', () => {
  it('adds a separate admin system-defaults route and nav entry', () => {
    const nav = read('apps/web/src/lib/nav.ts');
    const page = read('apps/web/src/app/admin/bots/config/page.tsx');

    expect(nav).toContain("/admin/bots/config");
    expect(nav).toContain("Bot Defaults");
    expect(page).toContain('requireUser');
    expect(page).toContain('assertAdmin');
    expect(page).toContain('System bot defaults');
    expect(page).toContain('scope: system defaults');
    expect(page).toContain('LIVE CONTROL: DISABLED');
    expect(page).toContain('user settings: unaffected');
    expect(page).toContain('entitlements remain source of access');
    expect(page).toContain('CsrfField');
    expect(page).toContain('adminSaveBotGlobalConfigAction');
    expect(page).toContain('TortilaSymbolConfigTable');
    expect(page).toContain('LegacyAveragingConfigTable');
    expect(page).toContain('Version history');
    expect(page).toContain('wtc-table-wrap');
    expect(page).toContain('data-label=');
    expect(page).not.toContain('getBotAdapter');
    expect(page).not.toContain('applyConfig');
    expect(page).not.toContain('startBot');
    expect(page).not.toContain('stopBot');
    expect(page).not.toContain('testExchange');
    expect(page).not.toContain('LEGACY_DATABASE_URL');
    expect(page).not.toContain('TORTILA_JOURNAL_BASE_URL');
  });

  it('keeps the admin mutation RBAC/CSRF/Zod/audited and separate from user config saves', () => {
    const actions = read('apps/web/src/features/admin/actions.ts');
    const schemas = read('apps/web/src/features/admin/schemas.ts');
    const action = sourceForFunction(actions, 'adminSaveBotGlobalConfigAction');

    expect(schemas).toContain('saveBotGlobalConfigSchema');
    expect(schemas).toContain("z.enum(['tortila_bot', 'legacy_bot'])");
    expect(schemas).toContain("z.enum(['draft', 'published', 'archived'])");
    expect(schemas).toContain('adminMutationReason');
    expect(schemas).toContain('.strict()');
    expect(action).toContain('requireUser');
    expect(action).toContain('assertAdmin');
    expect(action).toContain('assertCsrf');
    expect(action).toContain('assertNoForbiddenGlobalBotConfigFormKeys');
    expect(action).toContain('saveBotGlobalConfigSchema.safeParse');
    expect(action).toContain('botConfigFormIssues(productCode, formData)');
    expect(action).toContain('botConfigSchemaFor(productCode).safeParse');
    expect(action).toContain('assertNoForbiddenGlobalBotConfigKeys(config)');
    expect(action).toContain('saveBotGlobalConfig');
    expect(action).toContain("revalidatePath('/admin/bots/config')");
    expect(action).toContain("revalidatePath('/admin/audit-log')");
    expect(action).not.toContain('persistBotConfig');
    expect(action).not.toContain('saveBotConfig(');
    expect(action).not.toContain('ensureBotInstance');
    expect(action).not.toContain('getBotAdapter');
    expect(action).not.toContain('recordHealthCheck');
    expect(action).not.toContain('loadBotReadModelForUser');
  });

  it('forbids secret, provider, raw runtime, and live-control keys in global defaults', () => {
    const actions = read('apps/web/src/features/admin/actions.ts');

    for (const key of [
      'apikey',
      'apisecret',
      'secret',
      'token',
      'authorization',
      'sealed',
      'wrappeddek',
      'providerpubid',
      'provideraccountid',
      'pubid',
      'provideraccounts',
      'liveconfig',
      'rawjson',
      'activeslots',
      'activeordersummary',
      'legacydatabaseurl',
      'tortilajournalbaseurl',
      'applyconfig',
      'startbot',
      'stopbot',
      'retest',
      'testexchange',
      'exchangeapply',
      'exchangeorder',
      'livecontrol',
    ]) {
      expect(actions).toContain(`'${key}'`);
    }
  });

  it('documents and types the audit action before repository use', () => {
    const audit = read('packages/audit/src/audit.ts');
    const docs = read('docs/AUDIT_LOG_SCHEMA.md');
    const repos = read('packages/db/src/repositories.ts');

    expect(audit).toContain("'bot.global_config.save'");
    expect(docs).toContain('`bot.global_config.save`');
    expect(docs).toContain('No raw config JSON');
    expect(repos).toContain("action: 'bot.global_config.save'");
    expect(repos).toContain("targetType: 'bot_global_config'");
    expect(repos).toContain('botGlobalConfigVersions');
    expect(repos).not.toContain("action: 'bot.config.save', targetType: 'bot_global_config'");
  });

  it('does not add global default edit controls to selected-user bot drilldown', () => {
    const page = read('apps/web/src/app/admin/users/[userId]/bots/page.tsx');

    expect(page).toContain('user settings: read-only');
    expect(page).not.toContain('adminSaveBotGlobalConfigAction');
    expect(page).not.toContain('Save system default version');
    expect(page).not.toContain('/admin/bots/config');
  });
});
