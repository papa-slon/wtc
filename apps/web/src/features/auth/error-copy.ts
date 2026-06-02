export type AuthErrorCode = 'invalid_form' | 'invalid_credentials' | 'rate_limited' | 'temporary';

export interface AuthErrorCopy {
  code: AuthErrorCode;
  detail: string;
}

const AUTH_ERROR_COPY: Record<AuthErrorCode, string> = {
  invalid_form: 'Check the form and try again.',
  invalid_credentials: 'Invalid email or password.',
  rate_limited: 'Too many attempts. Wait a minute and try again.',
  temporary: 'We could not complete that request. Check the form or try again shortly.',
};

const AUTH_ERROR_CODES = new Set<AuthErrorCode>([
  'invalid_form',
  'invalid_credentials',
  'rate_limited',
  'temporary',
]);

export function authErrorCode(value: unknown): AuthErrorCode | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  return AUTH_ERROR_CODES.has(value as AuthErrorCode) ? (value as AuthErrorCode) : 'temporary';
}

export function authErrorCopy(value: unknown): AuthErrorCopy | null {
  const code = authErrorCode(value);
  if (!code) return null;
  return { code, detail: AUTH_ERROR_COPY[code] };
}
