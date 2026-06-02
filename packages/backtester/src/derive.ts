import type { AccessReason } from '@wtc/entitlements';
import type { Tone } from '@wtc/ui';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type BotSlug = 'tortila' | 'legacy';

export interface BacktesterRunnerRelease {
  version: string;
  fileName: string;
  routeHref: string;
  sha256: string;
  sizeBytes: number;
  minPython: string;
}

export const BACKTESTER_RUNNER_RELEASE: BacktesterRunnerRelease = {
  version: '0.1.0',
  fileName: 'wtc-backtester-0.1.0.zip',
  routeHref: '/api/bots/tortila/backtest/runner-download',
  sha256: 'feaf74bb1ae220fb3694d1ba09ca79d2eacea406ef749fc3dd52398796ebf6ef',
  sizeBytes: 5390,
  minPython: '3.11',
};

/**
 * True means a static offline runner ZIP is distributed. It does not mean the web tier can run
 * backtests, create jobs, upload artifacts, or render server-generated results.
 */
export const BACKTESTER_RUNNER_DISTRIBUTED: boolean = true;

export function runnerReleasePath(release: BacktesterRunnerRelease = BACKTESTER_RUNNER_RELEASE): string {
  const monorepoPath = join(process.cwd(), 'packages', 'backtester', 'runners', release.fileName);
  if (existsSync(monorepoPath)) return monorepoPath;
  return join(process.cwd(), 'runners', release.fileName);
}

export function botHasBacktester(slug: BotSlug): boolean {
  return slug === 'tortila';
}

export function getRunnerRelease(slug: BotSlug): BacktesterRunnerRelease | null {
  if (!botHasBacktester(slug) || !BACKTESTER_RUNNER_DISTRIBUTED) return null;
  return BACKTESTER_RUNNER_RELEASE;
}

export type BacktesterViewKind =
  | 'legacy_boundary'
  | 'access_required'
  | 'runner_available';

export interface BacktesterView {
  kind: BacktesterViewKind;
  kicker: string;
  title: string;
  body: string;
  accessReason?: AccessReason;
  runner?: BacktesterRunnerRelease;
}

export interface BacktesterPill {
  tone: Tone;
  label: string;
}

export function backtesterPill(slug: BotSlug): BacktesterPill {
  if (!botHasBacktester(slug)) return { tone: 'bad', label: 'Not available' };
  return BACKTESTER_RUNNER_DISTRIBUTED
    ? { tone: 'ok', label: 'Available' }
    : { tone: 'neutral', label: 'Not yet available' };
}

const NEVER_FABRICATE =
  'The platform never generates or estimates returns. Results are produced only by the local runner on the user machine.';

export function deriveBacktesterView(
  slug: BotSlug,
  access?: { allowed: boolean; reason: AccessReason },
): BacktesterView {
  if (slug === 'legacy') {
    return {
      kind: 'legacy_boundary',
      kicker: 'Legacy backtester',
      title: 'Not available for this bot',
      body:
        'The Legacy Bot does not have a backtester. Use the Tortila Turtle-strategy runner if you need local strategy testing.',
    };
  }

  const allowed = access?.allowed ?? false;
  if (!allowed) {
    return {
      kind: 'access_required',
      kicker: 'Tortila backtester',
      title: 'Access required',
      body: 'Backtester access follows your Tortila Bot entitlement.',
      accessReason: access?.reason ?? 'blocked_unknown_state',
    };
  }

  const release = getRunnerRelease('tortila');
  if (!release) {
    return {
      kind: 'access_required',
      kicker: 'Tortila backtester',
      title: 'Runner unavailable',
      body: 'No local runner release is currently available.',
      accessReason: 'blocked_unknown_state',
    };
  }

  return {
    kind: 'runner_available',
    kicker: 'Tortila backtester',
    title: 'Download local backtester',
    body:
      'Backtests run in a downloadable local runner on your own machine, never in the web tier. ' +
      'Download the ZIP, edit config.example.json, run it locally, then copy the selected settings back into the bot configuration page. ' +
      NEVER_FABRICATE,
    runner: release,
  };
}
