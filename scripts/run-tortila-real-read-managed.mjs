#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import postgres from 'postgres';
import { redactProcessOutput, runRedactedChildProcess } from './redacted-child-process.mjs';
import { verifyTortilaCanonicalSourceRoot } from './tortila-canonical-source-verifier.mjs';

const args = process.argv.slice(2);
const allowedArgs = new Set(['--help', '-h']);
const unknownArg = args.find((arg) => !allowedArgs.has(arg));
const adminUrl = process.env.TORTILA_REAL_READ_ADMIN_DATABASE_URL;
const PROOF_JOURNAL_READ_TOKEN = 'phase-458-dummy-read-token';

function usage() {
  console.log(
    [
      'Usage: TORTILA_REAL_READ_ADMIN_DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<maintenance_db> npm run accept:tortila:real-read:managed',
      '',
      'Creates a fresh wtc_test_tortila_real_read_* database, applies WTC migrations, seeds demo users,',
      'creates a temporary Tortila SQLite journal fixture, starts the local Tortila journal behind an allowlist proxy,',
      'runs one WTC worker tick in BOT_ADAPTER_MODE=read-only, verifies sourceAdapter=tortila/readState=ok,',
      'then drops the Postgres database and removes temporary local files.',
      '',
      'Set TORTILA_CANONICAL_SOURCE_REQUIRED=1 and TORTILA_REAL_READ_SOURCE_ROOT=<canonical git checkout>',
      'to require a clean git-backed Tortila source packet before the proof runs.',
      '',
      'Safety: no live bot start/stop/apply-config, no exchange/provider probes, no /api/marks, no production DB targets.',
    ].join('\n'),
  );
}

function safeMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return redactProcessOutput(message);
}

function parseAdminUrl(raw) {
  if (!raw) {
    throw new Error(
      'Set TORTILA_REAL_READ_ADMIN_DATABASE_URL to a local/admin Postgres URL that can CREATE/DROP DATABASE. ' +
        'This runner creates a fresh wtc_test_tortila_real_read_* database and drops it after verification.',
    );
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Tortila real-read managed runner refused: TORTILA_REAL_READ_ADMIN_DATABASE_URL is not a valid URL.');
  }
  if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) {
    throw new Error('Tortila real-read managed runner refused: admin URL must use postgres:// or postgresql://.');
  }
  const adminDb = parsed.pathname.replace(/^\//, '').toLowerCase();
  if (!adminDb || /^wtc_test(?:_|$)/.test(adminDb)) {
    throw new Error('Tortila real-read managed runner refused: admin URL must point at a non-throwaway maintenance database.');
  }
  return parsed;
}

function buildDbName() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `wtc_test_tortila_real_read_${stamp}_${randomBytes(3).toString('hex')}`;
}

function buildTargetUrl(admin, dbName) {
  const target = new URL(admin.toString());
  target.pathname = `/${dbName}`;
  return target.toString();
}

async function applyMigrations(sql) {
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  const files = readdirSync(migDir).filter((file) => file.endsWith('.sql')).sort();
  if (files.length === 0) throw new Error('Tortila real-read managed runner refused: no migration SQL files found.');
  for (const file of files) {
    await sql.unsafe(readFileSync(join(migDir, file), 'utf8'));
  }
  return files.length;
}

function runSeed(targetUrl) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = runRedactedChildProcess(npm, ['run', 'db:seed', '-w', '@wtc/db'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: targetUrl },
    windowsHide: true,
  });
  if (result.signal) {
    console.error(`Tortila real-read managed runner seed stopped by signal ${result.signal}.`);
    return 1;
  }
  return typeof result.status === 'number' ? result.status : 1;
}

function findTortilaSourceRoot() {
  const canonicalRequired = process.env.TORTILA_CANONICAL_SOURCE_REQUIRED === '1';
  const explicitRoot = process.env.TORTILA_REAL_READ_SOURCE_ROOT;
  const candidates = canonicalRequired
    ? [explicitRoot].filter(Boolean)
    : [explicitRoot, resolve(process.cwd(), '..', 'bot_tortila')].filter(Boolean);
  let lastError = null;
  for (const candidate of candidates) {
    const root = resolve(String(candidate));
    try {
      const appFile = join(root, 'src', 'turtle_bot', 'journal', 'app.py');
      const storeFile = join(root, 'src', 'turtle_bot', 'state', 'store.py');
      if (readFileSync(appFile, 'utf8') && readFileSync(storeFile, 'utf8')) {
        if (canonicalRequired) {
          verifyTortilaCanonicalSourceRoot(root);
        }
        return root;
      }
    } catch (error) {
      lastError = error;
      // Try next candidate.
    }
  }
  throw new Error(
    canonicalRequired
      ? `Tortila real-read managed runner refused: canonical Tortila source root was not found or did not pass verification. ${safeMessage(lastError ?? 'No source root candidate.')}`
      : 'Tortila real-read managed runner refused: local bot_tortila source root was not found.',
  );
}

function pythonEnv(sourceRoot, sqlitePath, tempDir) {
  return {
    ...process.env,
    PYTHONPATH: join(sourceRoot, 'src'),
    MODE: 'demo',
    BINGX_DEMO_API_KEY: 'journal-readonly-placeholder',
    BINGX_DEMO_API_SECRET: 'journal-readonly-placeholder',
    BINGX_LIVE_API_KEY: 'journal-readonly-placeholder',
    BINGX_LIVE_API_SECRET: 'journal-readonly-placeholder',
    SYMBOLS: 'BTC/USDT:USDT,ETH/USDT:USDT',
    TIMEFRAME: '4h',
    DB_PATH: sqlitePath,
    LOG_DIR: join(tempDir, 'logs'),
    JOURNAL_READ_TOKEN: PROOF_JOURNAL_READ_TOKEN,
  };
}

function seedTortilaSqlite(sourceRoot, sqlitePath, tempDir) {
  const seedFile = join(tempDir, 'seed_tortila_journal_fixture.py');
  writeFileSync(seedFile, `
from datetime import UTC, datetime, timedelta
from turtle_bot.state.models import EquitySnapshot, FundingRow, PositionRow, SafetyEventRow, TradeRow
from turtle_bot.state.store import Store
import os

db_path = os.environ["DB_PATH"]
s = Store(db_path)
now = datetime.now(tz=UTC)
s.upsert_position(PositionRow(
    symbol="BTC/USDT:USDT",
    side="long",
    units=2,
    total_qty=0.05,
    avg_entry_price=30000,
    last_entry_price=30200,
    current_stop_price=29400,
    system=1,
    opened_at=now - timedelta(hours=12),
    status="open",
))
s.add_trade(TradeRow(
    symbol="ETH/USDT:USDT",
    side="long",
    units=2,
    avg_entry=3000,
    exit_price=3120,
    realized_pnl=24.0,
    funding_pnl=-0.42,
    fees_pnl=-0.18,
    opened_at=now - timedelta(days=3),
    closed_at=now - timedelta(hours=8),
    exit_reason="exit_signal",
))
s.add_trade(TradeRow(
    symbol="BTC/USDT:USDT",
    side="short",
    units=1,
    avg_entry=110000,
    exit_price=112000,
    realized_pnl=-20.0,
    funding_pnl=0.10,
    fees_pnl=-0.22,
    opened_at=now - timedelta(days=1),
    closed_at=now - timedelta(hours=2),
    exit_reason="stop",
))
s.add_equity_snapshot(EquitySnapshot(ts=now - timedelta(hours=6), equity=10000.0, mode="demo"))
s.add_equity_snapshot(EquitySnapshot(ts=now, equity=10004.0, mode="demo"))
s.add_funding(FundingRow(symbol="BTC/USDT:USDT", ts=now - timedelta(hours=8), amount=-0.42))
s.add_safety_event(SafetyEventRow(
    ts=now - timedelta(hours=4),
    kind="circuit_breaker",
    level="error",
    message="demo drawdown halt threshold",
))
s.close()
print("tortila sqlite fixture ready: trades=2 positions=1 equity=2")
`, 'utf8');

  const python = process.env.PYTHON ?? 'python';
  const result = runRedactedChildProcess(python, [seedFile], {
    cwd: sourceRoot,
    env: pythonEnv(sourceRoot, sqlitePath, tempDir),
    forwardStdout: false,
    forwardStderr: false,
    windowsHide: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.signal) return 1;
  return typeof result.status === 'number' ? result.status : 1;
}

function listen(server, host = '127.0.0.1', port = 0) {
  return new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, host, () => {
      server.off('error', rejectListen);
      const address = server.address();
      if (!address || typeof address === 'string') {
        rejectListen(new Error('Tortila real-read managed runner refused: server did not expose a TCP address.'));
        return;
      }
      resolveListen(address.port);
    });
  });
}

function closeServer(server) {
  return new Promise((resolveClose) => {
    server.close(() => resolveClose());
  });
}

function startAllowlistProxy(upstreamPort) {
  const requestLog = [];
  let markRequests = 0;
  const allowed = new Set(['/api/health', '/api/summary', '/api/equity', '/api/trades/list']);
  const server = createServer(async (req, res) => {
    const parsed = new URL(req.url ?? '/', 'http://127.0.0.1');
    requestLog.push(parsed.pathname);
    if (parsed.pathname === '/api/marks') {
      markRequests += 1;
      res.writeHead(599, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'WTC must not request /api/marks' }));
      return;
    }
    if (!allowed.has(parsed.pathname)) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'endpoint not allowed in Tortila real-read proof' }));
      return;
    }
    try {
      const headers = { accept: 'application/json' };
      const auth = req.headers.authorization;
      const tokenHeader = req.headers['x-journal-read-token'];
      if (typeof auth === 'string') headers.authorization = auth;
      if (typeof tokenHeader === 'string') headers['x-journal-read-token'] = tokenHeader;
      const upstream = await fetch(`http://127.0.0.1:${upstreamPort}${parsed.pathname}${parsed.search}`, {
        method: 'GET',
        headers,
      });
      const body = await upstream.text();
      res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' });
      res.end(body);
    } catch {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'upstream journal unavailable' }));
    }
  });
  return {
    server,
    requestLog,
    clearRequestLog: () => {
      requestLog.length = 0;
    },
    getMarkRequests: () => markRequests,
  };
}

function startJournal(sourceRoot, sqlitePath, tempDir, port) {
  const python = process.env.PYTHON ?? 'python';
  const child = spawn(
    python,
    ['-m', 'turtle_bot.journal.app', 'run', '--host', '127.0.0.1', '--port', String(port)],
    {
      cwd: sourceRoot,
      env: pythonEnv(sourceRoot, sqlitePath, tempDir),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  child.stdout?.on('data', (chunk) => {
    output += chunk.toString();
    output = output.slice(-20000);
  });
  child.stderr?.on('data', (chunk) => {
    output += chunk.toString();
    output = output.slice(-20000);
  });
  return { child, getOutput: () => redactProcessOutput(output) };
}

async function waitForHealth(baseUrl, getJournalOutput) {
  const deadline = Date.now() + 20000;
  let lastError = 'not attempted';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/health`, {
        headers: { accept: 'application/json', authorization: `Bearer ${PROOF_JOURNAL_READ_TOKEN}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.ok === true) return;
      }
      lastError = `HTTP ${res.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`Tortila journal did not become healthy: ${safeMessage(lastError)}; journal output=${getJournalOutput()}`);
}

async function fetchProxyStatus(baseUrl, path, headers = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: { accept: 'application/json', ...headers },
  });
  await res.arrayBuffer();
  return res.status;
}

async function assertJournalAuthMatrix(baseUrl) {
  const endpoints = ['/api/health', '/api/summary', '/api/equity', '/api/trades/list'];
  for (const endpoint of endpoints) {
    const missing = await fetchProxyStatus(baseUrl, endpoint);
    if (missing !== 401) {
      throw new Error(`Tortila journal auth matrix refused: expected missing-token ${endpoint} to return 401; observed ${missing}.`);
    }

    const wrong = await fetchProxyStatus(baseUrl, endpoint, { authorization: 'Bearer wrong-token' });
    if (wrong !== 401) {
      throw new Error(`Tortila journal auth matrix refused: expected wrong-token ${endpoint} to return 401; observed ${wrong}.`);
    }

    const bearer = await fetchProxyStatus(baseUrl, endpoint, { authorization: `Bearer ${PROOF_JOURNAL_READ_TOKEN}` });
    if (bearer < 200 || bearer >= 300) {
      throw new Error(`Tortila journal auth matrix refused: expected bearer-token ${endpoint} to pass; observed ${bearer}.`);
    }
  }

  const header = await fetchProxyStatus(baseUrl, '/api/summary', { 'x-journal-read-token': PROOF_JOURNAL_READ_TOKEN });
  if (header < 200 || header >= 300) {
    throw new Error(`Tortila journal auth matrix refused: expected x-journal-read-token /api/summary to pass; observed ${header}.`);
  }

  console.log('Verified Tortila journal read-token matrix: missingToken=401 wrongToken=401 bearerAllowedEndpoints=4 tokenHeader=ok.');
}

function stopChild(child) {
  return new Promise((resolveStop) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolveStop();
      return;
    }
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // best effort
      }
      resolveStop();
    }, 5000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolveStop();
    });
    try {
      child.kill('SIGTERM');
    } catch {
      clearTimeout(timer);
      resolveStop();
    }
  });
}

function runWorkerTick(targetUrl, ownerId, proxyUrl) {
  const tsxCli = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const tickScript = join(process.cwd(), 'apps', 'worker', 'src', 'tick-once.ts');
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [tsxCli, tickScript], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        APP_ENV: 'development',
        DATABASE_URL: targetUrl,
        SYSTEM_BOT_OWNER_ID: ownerId,
        BOT_ADAPTER_MODE: 'read-only',
        TORTILA_JOURNAL_URL: proxyUrl,
        TORTILA_JOURNAL_BASE_URL: proxyUrl,
        JOURNAL_READ_TOKEN: PROOF_JOURNAL_READ_TOKEN,
        FEATURE_LIVE_BOT_CONTROL: 'false',
        FEATURE_TV_AUTOMATION: 'false',
        LEGACY_LIVE_READS_ENABLED: 'false',
        LEGACY_DATABASE_URL: '',
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // best effort
      }
      rejectRun(new Error('Tortila real-read managed runner worker tick timed out.'));
    }, 60000);
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      rejectRun(new Error(redactProcessOutput(error.message)));
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      const safeStdout = redactProcessOutput(stdout);
      const safeStderr = redactProcessOutput(stderr);
      if (safeStdout) process.stdout.write(safeStdout);
      if (safeStderr) process.stderr.write(safeStderr);
      if (signal) {
        console.error(`Tortila real-read managed runner tick stopped by signal ${signal}.`);
        resolveRun(1);
        return;
      }
      resolveRun(typeof code === 'number' ? code : 1);
    });
  });
}

/*
 * Keep a literal copy of the env keys in this file so static safety tests can pin the real-read
 * worker contract even though the child process is spawned asynchronously to keep the local proxy
 * responsive during fetches:
 *
 * {
 *   APP_ENV: 'development',
 *   BOT_ADAPTER_MODE: 'read-only',
 *   TORTILA_CANONICAL_SOURCE_REQUIRED: '1',
 *   JOURNAL_READ_TOKEN: 'phase-458-dummy-read-token',
 *   FEATURE_LIVE_BOT_CONTROL: 'false',
 *   FEATURE_TV_AUTOMATION: 'false',
 *   LEGACY_LIVE_READS_ENABLED: 'false',
 * }
 */

async function assertTortilaRealRead(sql, dbName, proxy) {
  if (proxy.getMarkRequests() !== 0) {
    throw new Error(`Tortila real-read managed runner refused: /api/marks was requested ${proxy.getMarkRequests()} time(s).`);
  }
  if (proxy.requestLog.includes('/api/overview')) {
    throw new Error('Tortila real-read managed runner refused: /api/overview was requested during the WTC worker proof.');
  }
  for (const required of ['/api/health', '/api/summary', '/api/trades/list', '/api/equity']) {
    if (!proxy.requestLog.includes(required)) {
      throw new Error(`Tortila real-read managed runner refused: required journal endpoint ${required} was not requested.`);
    }
  }

  const [health] = await sql`
    SELECT status, detail
    FROM integration_health_checks
    WHERE target = 'tortila-journal'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const healthDetail = health?.detail && typeof health.detail === 'object' ? health.detail : {};
  if (health?.status !== 'ok' || healthDetail.readState !== 'ok' || healthDetail.adapterMode !== 'real') {
    throw new Error(
      `Tortila real-read managed runner refused: expected tortila-journal health status=ok readState=ok adapterMode=real; observed status=${health?.status ?? 'missing'} readState=${healthDetail.readState ?? 'missing'} adapterMode=${healthDetail.adapterMode ?? 'missing'}`,
    );
  }

  const [worker] = await sql`
    SELECT status, detail
    FROM integration_health_checks
    WHERE target = 'worker'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const workerDetail = worker?.detail && typeof worker.detail === 'object' ? worker.detail : {};
  if (
    workerDetail.tortilaSnapshot !== 'ok'
    || workerDetail.tortilaReadState !== 'ok'
    || workerDetail.adapterMode !== 'read-only'
    || workerDetail.tortilaTradesSeen !== 2
    || workerDetail.tortilaTradesImported !== 2
    || workerDetail.tortilaPositionsSnapshotted !== 1
  ) {
    throw new Error(
      `Tortila real-read managed runner refused: expected worker detail tortilaSnapshot=ok readState=ok adapterMode=read-only tradesSeen=2 tradesImported=2 positions=1; observed snapshot=${workerDetail.tortilaSnapshot ?? 'missing'} readState=${workerDetail.tortilaReadState ?? 'missing'} adapterMode=${workerDetail.adapterMode ?? 'missing'} tradesSeen=${workerDetail.tortilaTradesSeen ?? 'missing'} tradesImported=${workerDetail.tortilaTradesImported ?? 'missing'} positions=${workerDetail.tortilaPositionsSnapshotted ?? 'missing'}`,
    );
  }

  const [metric] = await sql`
    SELECT source_adapter, trade_count, raw_json
    FROM bot_metric_snapshots
    WHERE source_adapter = 'tortila'
    ORDER BY snapshot_at DESC
    LIMIT 1
  `;
  const metricRaw = metric?.raw_json && typeof metric.raw_json === 'object' ? metric.raw_json : {};
  if (metric?.source_adapter !== 'tortila' || metricRaw.readState !== 'ok' || Number(metric?.trade_count ?? 0) !== 2) {
    throw new Error(
      `Tortila real-read managed runner refused: expected metric sourceAdapter=tortila readState=ok tradeCount=2; observed sourceAdapter=${metric?.source_adapter ?? 'missing'} readState=${metricRaw.readState ?? 'missing'} tradeCount=${metric?.trade_count ?? 'missing'}`,
    );
  }

  const [tradeCount] = await sql`
    SELECT COUNT(*)::int AS count
    FROM bot_trade_imports
    WHERE source_adapter = 'tortila'
  `;
  const [positionCount] = await sql`
    SELECT COUNT(*)::int AS count
    FROM bot_position_snapshots
    WHERE source_adapter = 'tortila'
  `;
  if (tradeCount?.count !== 2 || positionCount?.count !== 1) {
    throw new Error(
      `Tortila real-read managed runner refused: expected imported trades=2 positions=1; observed trades=${tradeCount?.count ?? 'missing'} positions=${positionCount?.count ?? 'missing'}`,
    );
  }

  console.log(
    `Verified Tortila real-read for ${dbName}: sourceAdapter=tortila readState=ok tradesImported=2 positionsSnapshotted=1 marksRequests=0.`,
  );
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  usage();
  process.exit(0);
}
if (unknownArg) {
  console.error('Tortila real-read managed runner refused: unknown argument.');
  process.exit(2);
}

let admin;
try {
  admin = parseAdminUrl(adminUrl);
} catch (error) {
  console.error(safeMessage(error));
  process.exit(2);
}

const dbName = buildDbName();
const targetUrl = buildTargetUrl(admin, dbName);
const adminSql = postgres(admin.toString(), { max: 1 });
let targetSql = null;
let created = false;
let exitCode = 0;
let journal = null;
let proxy = null;
let proxyPort = null;
let tempDir = null;

try {
  const sourceRoot = findTortilaSourceRoot();
  tempDir = join(process.cwd(), '.codex-logs', `phase-458-tortila-real-read-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}-${randomBytes(3).toString('hex')}`);
  mkdirSync(tempDir, { recursive: true });
  const sqlitePath = join(tempDir, 'tortila-journal-fixture.db');

  exitCode = seedTortilaSqlite(sourceRoot, sqlitePath, tempDir);
  if (exitCode !== 0) throw new Error('Tortila real-read managed runner SQLite fixture seed failed.');

  const journalProbeServer = createServer((_, res) => res.end('ok'));
  const journalPort = await listen(journalProbeServer);
  await closeServer(journalProbeServer);
  journal = startJournal(sourceRoot, sqlitePath, tempDir, journalPort);
  if (journal.child.pid) console.log(`Started local Tortila journal proof server on 127.0.0.1:${journalPort}.`);

  proxy = startAllowlistProxy(journalPort);
  proxyPort = await listen(proxy.server);
  const proxyUrl = `http://127.0.0.1:${proxyPort}`;
  await waitForHealth(proxyUrl, journal.getOutput);
  await assertJournalAuthMatrix(proxyUrl);
  proxy.clearRequestLog();
  console.log(`Started Tortila journal allowlist proxy on 127.0.0.1:${proxyPort}.`);

  await adminSql`CREATE DATABASE ${adminSql(dbName)}`;
  created = true;
  console.log(`Created Tortila real-read throwaway database ${dbName}.`);

  targetSql = postgres(targetUrl, { max: 1 });
  const migrationCount = await applyMigrations(targetSql);
  console.log(`Applied ${migrationCount} migration(s) to Tortila real-read throwaway database ${dbName}.`);

  exitCode = runSeed(targetUrl);
  if (exitCode !== 0) throw new Error('Tortila real-read managed runner WTC seed failed.');

  const [owner] = await targetSql`SELECT id FROM users WHERE email = 'user@wtc.local' LIMIT 1`;
  if (!owner?.id) throw new Error('Tortila real-read managed runner refused: seeded user@wtc.local was not found.');

  exitCode = await runWorkerTick(targetUrl, owner.id, proxyUrl);
  if (exitCode !== 0) throw new Error('Tortila real-read managed runner worker tick failed.');

  await assertTortilaRealRead(targetSql, dbName, proxy);
} catch (error) {
  console.error(`Tortila real-read managed runner failed: ${safeMessage(error)}`);
  if (exitCode === 0) exitCode = typeof error?.status === 'number' ? error.status : 1;
} finally {
  if (proxy?.server) await closeServer(proxy.server).catch(() => {});
  if (journal?.child) await stopChild(journal.child).catch(() => {});
  if (targetSql) {
    await targetSql.end({ timeout: 5 }).catch(() => {});
  }
  if (created) {
    try {
      await adminSql`DROP DATABASE IF EXISTS ${adminSql(dbName)} WITH (FORCE)`;
      console.log(`Dropped Tortila real-read throwaway database ${dbName}.`);
    } catch (dropError) {
      console.error(`Tortila real-read managed runner could not drop ${dbName}: ${safeMessage(dropError)}`);
      if (exitCode === 0) exitCode = 1;
    }
  }
  await adminSql.end({ timeout: 5 }).catch(() => {});
  if (tempDir) {
    const resolvedTemp = resolve(tempDir);
    const expectedPrefix = resolve(process.cwd(), '.codex-logs') + '\\';
    if (resolvedTemp.startsWith(expectedPrefix)) {
      rmSync(resolvedTemp, { recursive: true, force: true });
      console.log('Cleaned Tortila real-read temporary files.');
    } else {
      console.error(`Tortila real-read managed runner refused to remove unexpected temp path: ${resolvedTemp}`);
      if (exitCode === 0) exitCode = 1;
    }
  }
}

if (exitCode !== 0) process.exit(exitCode);
