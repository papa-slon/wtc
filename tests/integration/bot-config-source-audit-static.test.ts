import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

describe('bot config source/audit hardening static guards', () => {
  it('documents metadata-only exchange-key checks separately from future exchange pings', () => {
    const audit = read('packages/audit/src/audit.ts');
    const docs = read('docs/AUDIT_LOG_SCHEMA.md');
    const repos = read('packages/db/src/repositories.ts');
    const demo = read('apps/web/src/lib/demo.ts');

    expect(audit).toContain("'exchange_key.metadata_check'");
    expect(audit).toContain("'exchange_key.test'");
    expect(docs).toContain('WTC vault metadata ownership check only');
    expect(docs).toContain('Reserved legacy/future code');
    expect(docs).toContain('This proves WTC vault metadata only');
    expect(repos).toContain("action: 'exchange_key.metadata_check'");
    expect(repos).not.toContain("action: 'exchange_key.test'");
    expect(demo).toContain("action: 'exchange_key.metadata_check'");
    expect(demo).not.toContain("action: 'exchange_key.test'");
  });

  it('keeps bot config audit payloads metadata-only and rejects forbidden config keys below actions', () => {
    const repos = read('packages/db/src/repositories.ts');
    const docs = read('docs/AUDIT_LOG_SCHEMA.md');

    expect(repos).toContain('const FORBIDDEN_BOT_CONFIG_KEYS');
    expect(repos).toContain('assertNoForbiddenBotConfigKeys(input.config)');
    expect(repos).toContain("before: { version: cur?.version ?? null }");
    expect(repos).toContain('after: { version }');
    expect(docs).toContain('For `bot.config.save`: target is `bot_instance`');
    expect(docs).toContain('initial save using');

    for (const key of ['apikey', 'apisecret', 'providerpubid', 'provideraccountid', 'rawjson', 'legacydatabaseurl', 'tortilajournalbaseurl', 'applyconfig', 'startbot', 'stopbot']) {
      expect(repos).toContain(`'${key}'`);
    }
  });

  it('revalidates user overrides on load and refuses unsafe user saves before repository writes', () => {
    const config = read('apps/web/src/features/bots/config.ts');

    expect(config).toContain('safeUserBotConfigForProduct(productCode, config)');
    expect(config).toContain('assertNoForbiddenUserBotConfigKeys(config)');
    expect(config).toContain('botConfigSchemaFor(productCode).safeParse(config)');
    expect(config).toContain('parseUserBotConfigForProduct(productCode, cfg.config)');
    expect(config).toContain('invalidUserConfigIssue(cfg.version)');
    expect(config).toContain('sourceIssue');
    expect(config).toContain('Saved custom profile failed validation');
    expect(config.indexOf('const safeConfig = safeUserBotConfigForProduct(productCode, config)')).toBeLessThan(config.indexOf('await saveBotConfig(db'));
  });
});
