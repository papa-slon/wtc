import 'server-only';
import { cookies } from 'next/headers';
import { sessionCookieName } from '@wtc/auth';
import { userForToken, type DemoUser } from '@/lib/backend';

// Production uses the __Host- prefixed cookie name (RFC 6265bis: forces Secure, Path=/, no Domain);
// dev over http cannot use __Host- (it requires Secure), so dev falls back to the plain name. The
// set-cookie options in (auth)/actions.ts already set Secure (prod), Path=/, and no Domain.
export const SESSION_COOKIE = sessionCookieName(process.env.NODE_ENV === 'production');

export async function getCurrentUser(): Promise<DemoUser | null> {
  const jar = await cookies();
  return userForToken(jar.get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<DemoUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error('UNAUTHENTICATED');
  return u;
}

export function isAdmin(u: DemoUser | null): boolean {
  return !!u && u.roles.includes('admin');
}
