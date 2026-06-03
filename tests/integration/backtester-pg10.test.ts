import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const page = read('apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx');
const route = read('apps/web/src/app/api/bots/[bot]/backtest/runner-download/route.ts');
const overview = read('apps/web/src/app/(app)/app/bots/[bot]/page.tsx');
const derive = read('packages/backtester/src/derive.ts');
const runner = read('packages/backtester/runner-src/wtc-backtester-0.1.0/engine/tortila_engine.py');

describe('download-only backtester MVP', () => {
  it('page exposes a real download action without server-side queue/job UI', () => {
    expect(page).toMatch(/Download local runner/);
    expect(page).toMatch(/release\.routeHref/);
    expect(page).not.toMatch(/Queue run/i);
    expect(page).not.toMatch(/<form/i);
  });

  it('page states local-only execution and no server artifact pipeline', () => {
    expect(page).toMatch(/Local-only execution/);
    expect(page).toMatch(/Results stay local in this MVP/);
    expect(page).toMatch(/Server-side job creation, artifact upload, and charts remain disabled/);
  });

  it('deriver carries release metadata but no result payload', () => {
    expect(derive).toMatch(/BACKTESTER_RUNNER_DISTRIBUTED: boolean = true/);
    expect(derive).toMatch(/wtc-backtester-0\.1\.0\.zip/);
    expect(derive).toMatch(/runner_available/);
    expect(derive).not.toMatch(/equityCurve|equity_curve/);
    expect(derive).not.toMatch(/\bmetrics\b/);
    expect(derive).not.toMatch(/tradeList/);
  });

  it('download route is session + entitlement gated and rejects legacy', () => {
    expect(route).toMatch(/requireUser\(\)/);
    expect(route).toMatch(/botAccessForUser\(user, 'tortila_bot'\)/);
    expect(route).toMatch(/bot !== 'tortila'/);
    expect(route).toMatch(/entitlement_denied/);
    expect(route).toMatch(/application\/zip/);
    expect(route).not.toMatch(/backtest_jobs|backtest_artifacts|upload_token/i);
  });

  it('runner source is local-only and has no exchange-key handling', () => {
    expect(runner).toMatch(/run_portfolio/);
    expect(runner).toMatch(/pd\.read_csv/);
    expect(runner).not.toMatch(/apiKey|apiSecret|exchange_accounts|live order|create_order/i);
  });
});

describe('bot overview cross-surface honesty', () => {
  it('uses the shared backtesterPill so the overview and the page agree', () => {
    expect(overview).toMatch(/backtesterPill/);
  });
});
