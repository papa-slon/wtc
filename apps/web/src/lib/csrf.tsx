import 'server-only';
import { cookies } from 'next/headers';
import { deriveSessionCsrfToken, verifyCsrf } from '@wtc/auth';
import { requiredSecret, AppError } from '@wtc/shared';
import { SESSION_COOKIE } from '@/lib/session';

// DEV-ONLY signing secret; requiredSecret throws in production if SESSION_SECRET is unset.
const DEV_ONLY_CSRF_SECRET = 'dev-only-csrf-secret-not-for-prod';

function csrfSecret(): string {
  return requiredSecret('SESSION_SECRET', process.env.SESSION_SECRET, DEV_ONLY_CSRF_SECRET);
}

async function currentSessionToken(): Promise<string> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? '';
}

/** Per-session CSRF token (synchronizer token bound to the session cookie). */
export async function csrfToken(): Promise<string> {
  return deriveSessionCsrfToken(await currentSessionToken(), csrfSecret());
}

/** Hidden field to embed in every AUTHENTICATED mutating form. */
export async function CsrfField() {
  const token = await csrfToken();
  return <input type="hidden" name="csrf" value={token} />;
}

/** Verify CSRF inside a server action. Throws (fail closed) on mismatch or missing token. */
export async function assertCsrf(formData: FormData): Promise<void> {
  const submitted = String(formData.get('csrf') ?? '');
  const expected = await csrfToken();
  if (!expected || !verifyCsrf(expected, submitted)) throw new AppError('forbidden', 'CSRF validation failed');
}
