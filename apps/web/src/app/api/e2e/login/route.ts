import { NextResponse } from 'next/server';
import { createSession, verifyLogin } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';

const LOCAL_E2E_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export async function POST(request: Request) {
  const host = new URL(request.url).hostname;
  if (process.env.NODE_ENV === 'production' || process.env.E2E_AUTH_BYPASS !== '1' || !LOCAL_E2E_HOSTS.has(host)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const user = await verifyLogin(email, password);
  if (!user) return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });

  const { token, expiresAt } = await createSession(user.id);
  const response = NextResponse.json({ ok: true, userId: user.id });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
  });
  return response;
}
