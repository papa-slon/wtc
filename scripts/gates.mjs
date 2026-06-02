#!/usr/bin/env node
/**
 * gates.mjs — single-process, low-noise gate runner.
 *
 * WHY THIS EXISTS: on this Windows host the agent's tool-result channel flushes very late when many
 * heavy `npm` gate processes run at once and stream verbose output back through the pipe. That manifested
 * as minutes-long "buffering" delays. This runner removes both triggers:
 *   1. SEQUENTIAL — exactly one gate process runs at a time (never parallel `npm run` storms).
 *   2. QUIET — passing gates retain only compact status/metric logs; failing gates retain redacted
 *      child output in logs/gates/<gate>.log for diagnostics.
 * So the agent runs ONE command, transfers ~12 small lines, and reads retained logs only on failure.
 *
 * Usage:  node scripts/gates.mjs [quick|core|full|build|e2e]   (default: core)
 *   quick = lint, typecheck x2, test
 *   core  = governance, check:core, lint, typecheck x2, secret:scan, test, db:generate
 *   full  = core + build (e2e is a separate plan)
 *   e2e   = Playwright only
 * Exit code = number of failing gates (0 = all green).
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runRedactedChildProcess } from './redacted-child-process.mjs';
import { ensurePlainWorkspaceDirectory } from './workspace-path-guard.mjs';

const ROOT = process.cwd();
const LOG_DIR = join(ROOT, 'logs', 'gates');

const mode = (process.argv[2] ?? 'core').toLowerCase();

// metric = a regex; the LAST matching line in the log is shown beside the gate (e.g. test counts, table count).
const GATES = {
  governance: { cmd: 'npm run governance:check', metric: /\d+ cited|0 errors|warning/i },
  'check:core': { cmd: 'npm run check:core' },
  lint: { cmd: 'npm run lint' },
  typecheck: { cmd: 'npm run typecheck' },
  'typecheck-web': { cmd: 'npm run typecheck -w @wtc/web' },
  'secret:scan': { cmd: 'npm run secret:scan' },
  test: { cmd: 'npm test', metric: /Tests\s+\d+|Test Files\s+\d+/ },
  'db:generate': { cmd: 'npm run db:generate -w @wtc/db', metric: /\d+ tables|No schema changes/ },
  build: { cmd: 'npm run build -w @wtc/web', metric: /Compiled|Route \(app\)|\bƒ Middleware\b/ },
  e2e: { cmd: 'npx playwright test', metric: /\d+ passed|\d+ failed|\d+ flaky/ },
};

// NOTE: e2e is its OWN plan, never chained into `full`. `npx playwright test` starts a Next dev server
// via playwright's webServer; chaining it in a sequential sweep risks leaving that server running and
// saturating the (Windows) host — the exact thing that caused the late-flush buffering. Run e2e alone:
// `node scripts/gates.mjs e2e` (playwright tears its server down on exit).
const PLANS = {
  quick: ['lint', 'typecheck', 'typecheck-web', 'test'],
  core: ['governance', 'check:core', 'lint', 'typecheck', 'typecheck-web', 'secret:scan', 'test', 'db:generate'],
  full: ['governance', 'check:core', 'lint', 'typecheck', 'typecheck-web', 'secret:scan', 'test', 'db:generate', 'build'],
  build: ['build'],
  e2e: ['e2e'],
};

const plan = PLANS[mode];
if (!plan) {
  console.error(`unknown mode "${mode}" - use ${Object.keys(PLANS).join(' | ')}`);
  process.exit(2);
}
const REAL_LOG_DIR = ensurePlainWorkspaceDirectory(LOG_DIR, 'gate log root');

const results = [];
for (const name of plan) {
  const g = GATES[name];
  const logFile = join(REAL_LOG_DIR, `${name.replace(/[^a-z0-9]+/gi, '_')}.log`);
  let exit = 0;
  let logText = '';
  const started = process.hrtime.bigint();
  try {
    const child = runRedactedChildProcess(process.platform === 'win32' ? 'cmd.exe' : 'sh', process.platform === 'win32' ? ['/d', '/s', '/c', g.cmd] : ['-c', g.cmd], {
      cwd: ROOT,
      env: process.env,
      forwardStdout: false,
      forwardStderr: false,
      maxBuffer: 1 << 30,
      windowsHide: true,
    });
    logText = `${child.stdout}${child.stderr}`;
    exit = typeof child.status === 'number' ? child.status : 1;
    if (child.signal) exit = 1;
  } catch (e) {
    exit = typeof e?.status === 'number' ? e.status : 1;
    logText = `${e instanceof Error ? e.message : String(e)}\n`;
  }
  const secs = Number((process.hrtime.bigint() - started) / 1_000_000n) / 1000;
  let metric = '';
  if (g.metric) {
    const log = logText.split(/\r?\n/);
    for (let i = log.length - 1; i >= 0; i--) {
      if (g.metric.test(log[i])) { metric = log[i].trim().slice(0, 80); break; }
    }
  }
  if (name === 'e2e' && exit === 0 && /\b[1-9]\d*\s+flaky\b/i.test(logText)) {
    exit = 1;
    metric = metric ? `${metric} (strict: flaky forbidden)` : 'strict: flaky forbidden';
  }
  const retainedLog = exit === 0
    ? [
        `PASS ${name}`,
        `exit=${exit}`,
        `elapsed=${secs.toFixed(1)}s`,
        metric ? `metric=${metric}` : '',
        'redacted child output discarded after metric extraction',
      ].filter(Boolean).join('\n') + '\n'
    : logText;
  writeFileSync(logFile, retainedLog, 'utf8');
  results.push({ name, exit, secs, metric, logFile });
}

const fails = results.filter((r) => r.exit !== 0);
const lines = results.map(
  (r) => `${r.exit === 0 ? 'PASS' : 'FAIL'}  ${r.name.padEnd(14)} exit=${r.exit}  ${r.secs.toFixed(1)}s  ${r.metric}`,
);
const summary = [`# gates (${mode}) — ${results.length} gates, ${fails.length} failing`, ...lines, fails.length ? `# see logs/gates/<gate>.log for failures: ${fails.map((f) => f.name).join(', ')}` : '# all green'].join('\n');
writeFileSync(join(REAL_LOG_DIR, 'summary.txt'), summary + '\n');
console.log(summary);
process.exit(fails.length);
