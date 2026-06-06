import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

describe('deployment release build runbook', () => {
  it('keeps the canary build stage deterministic when production env is loaded', () => {
    const deployment = read('docs/DEPLOYMENT.md');
    const workerPackage = JSON.parse(read('apps/worker/package.json')) as {
      scripts?: Record<string, string>;
    };

    expect(workerPackage.scripts?.start).toBe('tsx src/index.ts');
    expect(deployment).toContain('npm ci --include=dev --no-audit --no-fund');
    expect(deployment).toContain('Do not rely on Next.js auto-installing TypeScript');
    expect(deployment).toContain('Runtime containers');
    expect(deployment).toContain('NODE_ENV=production');
  });
});
