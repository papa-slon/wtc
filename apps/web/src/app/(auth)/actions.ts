'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { loginSchema, registerSchema } from '@wtc/shared';
import { createUser, attemptLogin, createSession, destroySession } from '@/lib/backend';
import { audit } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { assertCsrf } from '@/lib/csrf';

async function setSession(userId: string) {
  const { token, expiresAt } = await createSession(userId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
  });
}

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = loginSchema.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) redirect('/login?error=invalid_form');
  const attempt = await attemptLogin(parsed.data.email, parsed.data.password);
  if (!attempt.ok) {
    redirect('/login?error=invalid_credentials');
  }
  const user = attempt.user;
  await setSession(user.id);
  await audit.write({ actorUserId: user.id, actorRole: user.roles[0] ?? 'user', action: 'auth.login', targetType: 'user', targetId: user.id });
  redirect('/app');
}

export async function registerAction(formData: FormData): Promise<void> {
  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    displayName: formData.get('displayName') || undefined,
  });
  if (!parsed.success) {
    redirect('/register?error=invalid_form');
  }
  try {
    const user = await createUser(parsed.data.email, parsed.data.password, parsed.data.displayName ?? parsed.data.email.split('@')[0]!);
    await setSession(user.id);
  } catch {
    redirect('/register?error=temporary');
  }
  redirect('/app');
}

export async function logoutAction(formData: FormData): Promise<void> {
  // logout is an authenticated, state-changing action → CSRF-protected (the session still exists here)
  await assertCsrf(formData);
  const jar = await cookies();
  await destroySession(jar.get(SESSION_COOKIE)?.value); // await: the DB session is revoked before we redirect
  jar.delete(SESSION_COOKIE);
  redirect('/');
}
