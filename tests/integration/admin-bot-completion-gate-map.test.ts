import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('admin bot completion gate map', () => {
  const page = read('apps/web/src/app/admin/bots/page.tsx');

  it('renders a read-only operator map for remaining bot completion gates', () => {
    expect(page).toContain('type AdminAcceptanceGateRow');
    expect(page).toContain('function adminAcceptanceGateRows');
    expect(page).toContain('Bot completion gate map');
    expect(page).toContain('Persisted worker tuple');
    expect(page).toContain('Managed continuity acceptance');
    expect(page).toContain('Selected-user DB matrix');
    expect(page).toContain('Legacy live-read source');
    expect(page).toContain('Legacy closed-trade analytics');
    expect(page).toContain('Tortila journal source');
    expect(page).toContain('Live bot control');
    expect(page).toContain('source proof blocked');
    expect(page).toContain('stable closed-trade ids and close timestamps');
    expect(page).toContain('Active orders or slots are not accepted substitutes');
    expect(page).toContain('Requires separate bot-integration and security approval');
  });

  it('shows only env presence and command names for opt-in managed proof', () => {
    expect(page).toContain("envPresence('WORKER_CONTINUITY_ADMIN_DATABASE_URL')");
    expect(page).toContain("envPresence('ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL')");
    expect(page).toContain("envPresence('LEGACY_DATABASE_URL')");
    expect(page).toContain("envPresence('TORTILA_JOURNAL_URL')");
    expect(page).toContain('WORKER_CONTINUITY_ADMIN_DATABASE_URL ${workerEnv}');
    expect(page).toContain('ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL ${adminMatrixEnv}');
    expect(page).toContain('LEGACY_DATABASE_URL ${legacySourceEnv}');
    expect(page).toContain('TORTILA_JOURNAL_URL ${tortilaSourceEnv}');
    expect(page).toContain('values hidden');
    expect(page).toContain('Run npm run accept:worker:continuity:managed');
    expect(page).toContain('Run npm run e2e:admin-user-bots:db:managed:matrix');
    expect(page).toContain('Runner creates and drops a throwaway worker-continuity database');
    expect(page).toContain('Matrix runner creates and drops a throwaway admin-user-bots database');
  });

  it('keeps the gate map free of secret values, DB mutation actions, and live controls', () => {
    expect(page).toContain('does not run a worker tick');
    expect(page).toContain('without reading secret values');
    expect(page).toContain('environment values, exchange secrets, provider');
    expect(page).toContain('are not rendered');
    expect(page).toContain('No admin page can start, stop, apply runtime config, close positions, or ping an exchange/provider.');
    expect(page).not.toContain('process.env.WORKER_CONTINUITY_ADMIN_DATABASE_URL');
    expect(page).not.toContain('process.env.ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL');
    expect(page).not.toContain('postgres://');
    expect(page).not.toContain('DATABASE_URL=');
    expect(page).not.toContain('JOURNAL_READ_TOKEN');
    expect(page).not.toContain('exchangeApiKeySecrets');
    expect(page).not.toContain('rawJson');
    expect(page).not.toContain('apiSecret');
    expect(page).not.toContain('apiKey');
    expect(page).not.toContain('type="submit"');
    expect(page).not.toContain('CsrfField');
    expect(page).not.toContain('startBot');
    expect(page).not.toContain('stopBot');
    expect(page).not.toMatch(/applyConfig\(/);
    expect(page).not.toContain('recordExchangeKeyMetadataCheck');
    expect(page).not.toContain('getBotAdapter');
  });

  it('keeps the new admin table mobile-readable', () => {
    expect(page).toContain('<th>Gate</th><th>Status</th><th>State</th><th>Evidence</th><th>Next proof</th>');
    for (const label of ['Gate', 'Status', 'State', 'Evidence', 'Next proof']) {
      expect(page).toContain(`data-label="${label}"`);
    }
    expect(page).toContain('className="wtc-table-wrap"');
  });
});
