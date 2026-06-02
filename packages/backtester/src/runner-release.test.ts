import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { BACKTESTER_RUNNER_RELEASE, runnerReleasePath } from './derive';

describe('@wtc/backtester runner release artifact', () => {
  it('runner ZIP exists and matches release metadata', () => {
    const path = runnerReleasePath();
    const body = readFileSync(path);
    const sha256 = createHash('sha256').update(body).digest('hex');
    expect(statSync(path).size).toBe(BACKTESTER_RUNNER_RELEASE.sizeBytes);
    expect(sha256).toBe(BACKTESTER_RUNNER_RELEASE.sha256);
    expect(BACKTESTER_RUNNER_RELEASE.sha256).not.toBe('pending');
  });
});
