import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('bot/admin local acceptance runner', () => {
  it('registers local bot/admin acceptance scripts as opt-in wrappers', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    const gates = read('scripts/gates.mjs');

    expect(scripts['accept:bots:rendered']).toBe('node scripts/gates.mjs bot-admin-e2e');
    expect(scripts['accept:bots:local']).toBe('node scripts/gates.mjs bot-admin-local');
    expect(scripts['accept:bots:continuity:contract']).toBe('node scripts/gates.mjs bot-continuity-local');
    expect(scripts.e2e).not.toContain('bot-admin');
    expect(scripts['ci:local']).not.toContain('accept:bots');

    expect(gates).toContain("bot-admin-e2e   = targeted local bot/admin rendered pack + visual inventory");
    expect(gates).toContain("bot-admin-local = ci:local + worker smoke + continuity fixture + targeted local bot/admin rendered pack + visual inventory");
    expect(gates).toContain("'bot-admin-e2e': ['bot-admin-e2e', 'visual-inventory']");
    expect(gates).toContain("'bot-admin-local': ['ci:local', 'worker-smoke', 'worker-continuity-fixture', 'bot-admin-e2e', 'visual-inventory']");
  });

  it('runs the focused rendered bot/admin pack and retained visual inventory only', () => {
    const gates = read('scripts/gates.mjs');

    for (const spec of [
      'tests/e2e/smoke.spec.ts',
      'tests/e2e/bot-settings.spec.ts',
      'tests/e2e/bot-readiness-map.spec.ts',
      'tests/e2e/bot-statistics.spec.ts',
      'tests/e2e/warning-summary-visual.spec.ts',
      'tests/e2e/admin-mobile-pg8.spec.ts',
    ]) {
      expect(gates).toContain(spec);
    }

    expect(gates).toContain('npm run evidence:visual -- --inventory tests/e2e/screenshots');
    expect(gates).toContain("'worker-smoke': { cmd: 'npm run worker:smoke'");
    expect(gates).toContain("'worker-continuity-fixture': {");
    expect(gates).toContain("cmd: 'npm run accept:worker:continuity:fixture'");
    expect(gates).toContain('metric: /\\[worker:(?:memory|tick)\\]/i');
    expect(gates).not.toContain('run-worker-continuity-managed');
    expect(gates).not.toContain('run-admin-user-bot-detail-e2e-managed');
    expect(gates).not.toContain('accept:worker:continuity:managed');
    expect(gates).not.toContain('accept:real-pg');
    expect(gates).not.toContain('db:migrate');
    expect(gates).not.toContain('db:seed');
    expect(gates).not.toContain('worker:tick');
    expect(gates).not.toContain('e2e:admin-user-bots:db');
    expect(gates).not.toContain('systemctl');
    expect(gates).not.toContain('tmux');
    expect(gates).not.toContain('ssh ');
  });

  it('refuses managed DB env and scrubs provider/live env for local proof', () => {
    const gates = read('scripts/gates.mjs');

    expect(gates).toContain('LOCAL_BOT_ADMIN_REFUSED_ENV');
    expect(gates).toContain("'WORKER_CONTINUITY_ADMIN_DATABASE_URL'");
    expect(gates).toContain("'ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL'");
    expect(gates).toContain("'REAL_POSTGRES_ADMIN_DATABASE_URL'");
    expect(gates).toContain("'REAL_POSTGRES_DATABASE_URL'");
    expect(gates).toContain("'AUTH_E2E_ADMIN_DATABASE_URL'");
    expect(gates).toContain("'AUTH_E2E_DATABASE_URL'");
    expect(gates).toContain("'LMS_E2E_ADMIN_DATABASE_URL'");
    expect(gates).toContain("'LMS_E2E_DATABASE_URL'");
    expect(gates).toContain("'AUDIT_APPEND_ONLY_ADMIN_DATABASE_URL'");
    expect(gates).toContain("'AUDIT_APPEND_ONLY_DATABASE_URL'");
    expect(gates).toContain('local bot/admin acceptance refuses managed DB env');

    for (const envName of [
      'DATABASE_URL',
      'ADMIN_USER_BOTS_E2E',
      'ADMIN_USER_BOTS_E2E_DATABASE_URL',
      'ADMIN_USER_BOTS_E2E_PREP_TOKEN',
      'ADMIN_USER_BOTS_E2E_HMAC',
      'AUTH_E2E',
      'AUTH_E2E_DATABASE_URL',
      'AUTH_E2E_ADMIN_DATABASE_URL',
      'LMS_E2E',
      'LMS_E2E_DATABASE_URL',
      'LMS_E2E_ADMIN_DATABASE_URL',
      'AUDIT_APPEND_ONLY_DATABASE_URL',
      'AUDIT_APPEND_ONLY_ADMIN_DATABASE_URL',
      'REAL_POSTGRES_DATABASE_URL',
      'REAL_POSTGRES_ADMIN_DATABASE_URL',
      'LEGACY_DATABASE_URL',
      'LEGACY_API_ID',
      'LEGACY_LIVE_READS_ENABLED',
      'TORTILA_JOURNAL_URL',
      'TORTILA_JOURNAL_BASE_URL',
      'JOURNAL_READ_TOKEN',
      'SYSTEM_BOT_OWNER_ID',
      'SYSTEM_BOT_INSTANCE_ID',
      'SYSTEM_LEGACY_BOT_OWNER_ID',
    ]) {
      expect(gates).toContain(`'${envName}'`);
    }

    expect(gates).toContain('for (const name of LOCAL_BOT_ADMIN_SCRUBBED_ENV) delete env[name]');
    expect(gates).toContain("APP_ENV: 'development'");
    expect(gates).toContain("BOT_ADAPTER_MODE: 'mock'");
    expect(gates).toContain("FEATURE_LIVE_BOT_CONTROL: 'false'");
    expect(gates).toContain("FEATURE_TV_AUTOMATION: 'false'");
    expect(gates).toContain("LEGACY_LIVE_READS_ENABLED: 'false'");
    expect(gates).toContain("const LOCAL_BOT_ADMIN_MODES = new Set(['bot-admin-e2e', 'bot-admin-local', 'bot-continuity-local'])");
    expect(gates).toContain('LOCAL MOCK/NO-LIVE ONLY');
    expect(gates).toContain('refuses managed DB/source/live/deploy/CI/production env');
    expect(gates).toContain('const localBotAdminEnv = LOCAL_BOT_ADMIN_MODES.has(mode) ? createLocalBotAdminEnv() : null');
    expect(gates).toContain('const childEnv = resolveGateEnv(g, localBotAdminEnv ?? process.env)');
    expect(gates).toContain("'bot-admin-local': ['ci:local', 'worker-smoke', 'worker-continuity-fixture', 'bot-admin-e2e', 'visual-inventory']");
    expect(gates).not.toContain('env: createLocalBotAdminEnv');
  });

  it('uses redacted retained logs rather than inherited noisy output', () => {
    const gates = read('scripts/gates.mjs');

    expect(gates).toContain("import { runRedactedChildProcess } from './redacted-child-process.mjs'");
    expect(gates).toContain('runRedactedChildProcess');
    expect(gates).toContain('forwardStdout: false');
    expect(gates).toContain('forwardStderr: false');
    expect(gates).toContain("writeFileSync(join(REAL_LOG_DIR, 'summary.txt')");
    expect(gates).toContain("if (name === 'bot-admin-e2e')");
    expect(gates).toContain('E2E_PORT=');
    expect(gates).not.toContain("stdio: 'inherit'");
  });
});
