import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runnerPath = 'scripts/run-tortila-real-read-managed.mjs';
const runner = readFileSync(runnerPath, 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> };

function runRunner(args: string[] = [], adminUrl = '') {
  return spawnSync(process.execPath, [runnerPath, ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TORTILA_REAL_READ_ADMIN_DATABASE_URL: adminUrl,
    },
    encoding: 'utf8',
  });
}

describe('Tortila real-read managed runner', () => {
  it('is exposed as the canonical managed Tortila real-read acceptance script', () => {
    expect(pkg.scripts?.['accept:tortila:real-read:managed']).toBe(`node ${runnerPath}`);
    expect(pkg.scripts?.['verify:tortila:canonical-source']).toBe('node scripts/tortila-canonical-source-verifier.mjs');
  });

  it('refuses missing admin URL and unknown args before DB work', () => {
    const missing = runRunner();
    expect(missing.status).toBe(2);
    expect(`${missing.stdout}\n${missing.stderr}`).toContain('TORTILA_REAL_READ_ADMIN_DATABASE_URL');
    expect(`${missing.stdout}\n${missing.stderr}`).not.toContain('CREATE DATABASE');

    const unknown = runRunner(['--surprise']);
    expect(unknown.status).toBe(2);
    expect(`${unknown.stdout}\n${unknown.stderr}`).toContain('unknown argument');
  });

  it('refuses non-local admin URLs before DB work without echoing the URL', () => {
    const remote = runRunner([], 'postgres://user:secret@db.example.invalid:5432/postgres');
    const output = `${remote.stdout}\n${remote.stderr}`;
    expect(remote.status).toBe(2);
    expect(output).toContain('localhost/loopback');
    expect(output).not.toContain('db.example.invalid');
    expect(output).not.toContain('secret');
    expect(output).not.toContain('CREATE DATABASE');
  });

  it('pins disposable DB, read-only adapter, local journal proxy, and no marks boundary', () => {
    expect(runner).toContain('LOCAL_ADMIN_HOSTS');
    expect(runner).toContain('localhost/loopback');
    expect(runner).toContain('wtc_test_tortila_real_read_');
    expect(runner).toContain('DROP DATABASE IF EXISTS');
    expect(runner).toContain('bot_tortila');
    expect(runner).toContain('TORTILA_CANONICAL_SOURCE_REQUIRED');
    expect(runner).toContain('verifyTortilaCanonicalSourceRoot(root)');
    expect(runner).toContain("'127.0.0.1'");
    expect(runner).toContain("BOT_ADAPTER_MODE: 'read-only'");
    expect(runner).toContain('JOURNAL_READ_TOKEN');
    expect(runner).toContain('phase-458-dummy-read-token');
    expect(runner).toContain('PROOF_JOURNAL_READ_TOKEN');
    expect(runner).toContain('headers.authorization = auth');
    expect(runner).toContain("headers['x-journal-read-token'] = tokenHeader");
    expect(runner).toContain('assertJournalAuthMatrix');
    expect(runner).toContain('missingToken=401 wrongToken=401');
    expect(runner).toContain('proxy.clearRequestLog()');
    expect(runner).toContain('startAllowlistProxy');
    expect(runner).toContain("'/api/health'");
    expect(runner).toContain("'/api/summary'");
    expect(runner).toContain("'/api/equity'");
    expect(runner).toContain("'/api/trades/list'");
    expect(runner).toContain("parsed.pathname === '/api/marks'");
    expect(runner).toContain("proxy.requestLog.includes('/api/overview')");
    expect(runner).toContain('WTC must not request /api/marks');
    expect(runner).toContain('getMarkRequests() !== 0');
    expect(runner).not.toContain('startBot(');
    expect(runner).not.toContain('stopBot(');
    expect(runner).not.toContain('applyConfig(');
  });

  it('verifies persisted WTC evidence for real Tortila source rows', () => {
    expect(runner).toContain("source_adapter = 'tortila'");
    expect(runner).toContain("target = 'tortila-journal'");
    expect(runner).toContain("healthDetail.readState !== 'ok'");
    expect(runner).toContain("healthDetail.adapterMode !== 'real'");
    expect(runner).toContain("workerDetail.tortilaSnapshot !== 'ok'");
    expect(runner).toContain("workerDetail.tortilaReadState !== 'ok'");
    expect(runner).toContain("workerDetail.adapterMode !== 'read-only'");
    expect(runner).toContain('workerDetail.tortilaTradesSeen !== 2');
    expect(runner).toContain('workerDetail.tortilaTradesImported !== 2');
    expect(runner).toContain('workerDetail.tortilaPositionsSnapshotted !== 1');
    expect(runner).toContain('Verified Tortila real-read');
  });
});
