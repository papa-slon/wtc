import 'server-only';
/**
 * Terminal feature loader.
 *
 * Reads terminal release metadata from DB when available, falling back to the mock bridge only
 * when DATABASE_URL is unset (dev/demo). In production, getServerDb() throws fail-closed before
 * the null branch here is reached — so this never silently fabricates release data in production.
 *
 * DB fields used:
 *   terminalReleaseCache: version, channel, platform, publishedAt, checksumSha256,
 *                         releaseNotesMarkdown, minSupportedVersion, isCurrent
 *
 * The JWKS readiness check parses the ES256 key through the same helper as the public JWKS route.
 * It never exposes the key value or any private scalar.
 */

import { getServerDb } from '@/lib/backend';
import { getCurrentTerminalRelease, listSubscriptionsForUser, type TerminalReleaseRow } from '@wtc/db';
import { axiomaRouteReadiness, type AxiomaRouteBlocker } from './axioma-routes';
import { resolveAxiomaJwksReadiness } from './axioma-jwks-readiness';

// ---- View types ----

export interface TerminalReleaseView {
  version: string;
  channel: string;
  platform: string;
  /** epoch-ms */
  publishedAt: number;
  checksumSha256: string | null;
  installerName: string | null;
  /** bytes, derived from DB if present — currently always null (field not in schema) */
  sizeBytes: null;
  releaseNotesMarkdown: string | null;
  minSupportedVersion: string | null;
}

export interface TerminalLoaderResult {
  /** 'postgres' when backed by a real DB; 'demo' when DATABASE_URL is unset. */
  mode: 'postgres' | 'demo';
  release: TerminalReleaseView | null;
  /** whether the public JWKS route can emit a parseable ES256 public key */
  jwksConfigured: boolean;
  routeSkeletonConfigured: boolean;
  routeBlockers: AxiomaRouteBlocker[];
  bridgeActionsImplemented: boolean;
}

// ---- Helpers ----

/** Derives a human-readable installer filename from a release row. */
function installerName(row: TerminalReleaseRow): string {
  const ext = row.platform === 'windows-x64' || row.platform === 'win32' ? '.exe' : '';
  const plat = row.platform.replace('windows-x64', 'win').replace('darwin', 'mac').replace('linux', 'linux');
  return `axioma-setup-${row.version}-${plat}${ext}`;
}

function toReleaseView(row: TerminalReleaseRow): TerminalReleaseView {
  return {
    version: row.version,
    channel: row.channel,
    platform: row.platform,
    publishedAt: row.publishedAt.getTime(),
    checksumSha256: row.checksumSha256 ?? null,
    installerName: installerName(row),
    sizeBytes: null,
    releaseNotesMarkdown: row.releaseNotesMarkdown ?? null,
    minSupportedVersion: row.minSupportedVersion ?? null,
  };
}

// ---- Mock fallback (dev/demo only) ----

const MOCK_RELEASE: TerminalReleaseView = {
  version: '0.1.0',
  channel: 'beta',
  platform: 'windows-x64',
  publishedAt: Date.parse('2026-05-20T00:00:00Z'),
  checksumSha256: null,
  installerName: 'axioma-setup-0.1.0-win.exe',
  sizeBytes: null,
  releaseNotesMarkdown: '- Lightweight Charts v5 upgrade\n- Local exchange keys encrypted with OS safeStorage\n- Journal bridge: trades, stats v2, feedback',
  minSupportedVersion: '0.1.0',
};

// ---- Loader ----

/**
 * Load terminal release metadata for the /app/terminal page.
 *
 * @param channel  - 'stable' | 'beta'
 * @param platform - 'windows-x64' | 'darwin' | 'linux' (matches DB column values)
 */
export async function loadTerminalRelease(
  channel = 'stable',
  platform = 'windows-x64',
): Promise<TerminalLoaderResult> {
  const jwksConfigured = resolveAxiomaJwksReadiness().configured;
  const db = getServerDb();
  const routeReadiness = axiomaRouteReadiness({ dbAvailable: !!db });
  if (!db) {
    return {
      mode: 'demo',
      release: MOCK_RELEASE,
      jwksConfigured,
      routeSkeletonConfigured: routeReadiness.configured,
      routeBlockers: routeReadiness.blockers,
      bridgeActionsImplemented: false,
    };
  }
  // Try 'stable' first; if no current stable row, fall back to 'beta'.
  let row = await getCurrentTerminalRelease(db, channel, platform);
  if (!row && channel === 'stable') {
    row = await getCurrentTerminalRelease(db, 'beta', platform);
  }
  return {
    mode: 'postgres',
    release: row ? toReleaseView(row) : null,
    jwksConfigured,
    routeSkeletonConfigured: routeReadiness.configured,
    routeBlockers: routeReadiness.blockers,
    bridgeActionsImplemented: false,
  };
}

/**
 * Load subscriptions for the billing page enrichment (re-export for easy import in page).
 */
export { listSubscriptionsForUser };
