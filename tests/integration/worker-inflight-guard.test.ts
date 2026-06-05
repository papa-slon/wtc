import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSerializedDbWorkerTickRunner } from '../../apps/worker/src/index.ts';

function deferred<T>() {
  let resolveValue!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolveValue = resolve;
  });
  return { promise, resolve: resolveValue };
}

describe('DB worker in-flight guard', () => {
  it('skips overlapping scheduler ticks without starting a second DB tick', async () => {
    let nowMs = 1_000;
    let calls = 0;
    const first = deferred<'first'>();
    const warnings: string[] = [];
    const runner = createSerializedDbWorkerTickRunner<string>({
      now: () => nowMs,
      logger: { warn: (message) => warnings.push(message) },
      runTick: async () => {
        calls += 1;
        if (calls === 1) return first.promise;
        return 'second';
      },
    });

    const running = runner.run();
    expect(runner.getState()).toMatchObject({ inFlight: true, startedAtMs: 1_000, skippedWhileInFlight: 0 });

    nowMs = 61_000;
    await expect(runner.run()).resolves.toMatchObject({
      status: 'skipped_in_flight',
      startedAtMs: 1_000,
      skippedAtMs: 61_000,
      ageMs: 60_000,
      skippedWhileInFlight: 1,
    });
    expect(calls).toBe(1);
    expect(warnings).toEqual([
      '[worker:db] tick skipped: previous db worker tick still in flight; age_ms=60000; skipped_while_in_flight=1',
    ]);

    nowMs = 62_000;
    first.resolve('first');
    await expect(running).resolves.toMatchObject({
      status: 'ran',
      result: 'first',
      startedAtMs: 1_000,
      finishedAtMs: 62_000,
      durationMs: 61_000,
    });
    expect(runner.getState()).toMatchObject({ inFlight: false, startedAtMs: null, skippedWhileInFlight: 0 });

    nowMs = 63_000;
    await expect(runner.run()).resolves.toMatchObject({
      status: 'ran',
      result: 'second',
      startedAtMs: 63_000,
      finishedAtMs: 63_000,
      durationMs: 0,
    });
    expect(calls).toBe(2);
  });

  it('releases the in-flight state after a failed tick so the next interval can run', async () => {
    let calls = 0;
    const runner = createSerializedDbWorkerTickRunner<string>({
      logger: { warn: () => undefined },
      runTick: async () => {
        calls += 1;
        if (calls === 1) throw new Error('tick failed');
        return 'recovered';
      },
    });

    await expect(runner.run()).rejects.toThrow('tick failed');
    expect(runner.getState()).toMatchObject({ inFlight: false, startedAtMs: null, skippedWhileInFlight: 0 });

    await expect(runner.run()).resolves.toMatchObject({ status: 'ran', result: 'recovered' });
    expect(calls).toBe(2);
  });

  it('wires the long-running DB interval through the serialized runner and keeps one-shot DB acceptance direct', () => {
    const source = readFileSync(resolve(process.cwd(), 'apps/worker/src/index.ts'), 'utf8');

    expect(source).toContain('export function createSerializedDbWorkerTickRunner');
    expect(source).toContain('tick skipped: previous db worker tick still in flight');
    expect(source).toContain('const dbTickRunner = createSerializedDbWorkerTickRunner');
    expect(source).toContain('void dbTickRunner.run().catch');
    expect(source).not.toMatch(/void\s+runDbWorkerTick\(db\)\.catch/);
    expect(source).toContain('return await runDbWorkerTick(db, now, env);');
  });
});
