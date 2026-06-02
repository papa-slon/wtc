/**
 * @wtc/backtester — see ./derive.ts.
 *
 * The web tier never runs heavy backtests and NEVER fabricates returns. Phase 3.2 ships the
 * entitlement-gated downloadable Tortila local-runner ZIP. Server-side job/artifact/upload remains
 * deferred; that contract lives in docs/CONTRACTS/backtester-runner.md until it has real consumers.
 */
export * from './derive';
