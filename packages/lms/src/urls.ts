/**
 * Pure URL-safety helpers for LMS render paths. These are DEFENSE-IN-DEPTH behind the Zod write-time
 * validation (`.url().startsWith('https://')` in the action layer): a value that somehow reached the DB
 * without the https guard (legacy row, direct DB write) must still never be emitted as a live href.
 * No DB, no I/O — fully unit-testable.
 */

/** True only for a well-formed ABSOLUTE https:// URL. Rejects http:, javascript:, data:, relative, blank. */
export function isHttpsUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false; // not an absolute URL (relative paths, garbage, javascript:alert without // etc.)
  }
  return parsed.protocol === 'https:';
}

/** Returns the URL only when it is a safe https:// URL, else null — use at the render boundary so an
 *  unsafe scheme (javascript:/data:/http:) is never rendered into an href/src. */
export function safeHttpsUrl(url: string | null | undefined): string | null {
  return isHttpsUrl(url) ? (url as string) : null;
}
