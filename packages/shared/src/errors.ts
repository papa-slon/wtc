export type ErrorCode =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'entitlement_denied'
  | 'internal';

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

const STATUS: Record<ErrorCode, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  entitlement_denied: 402,
  internal: 500,
};

/** Application error carrying a stable code, HTTP status, and safe details. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

export function statusForCode(code: ErrorCode): number {
  return STATUS[code];
}

/** Convert any thrown value into a safe error envelope (never leaks internals/secrets). */
export function toEnvelope(err: unknown, requestId?: string): ErrorEnvelope {
  if (err instanceof AppError) {
    const env: ErrorEnvelope = { error: { code: err.code, message: err.message } };
    if (err.details !== undefined && err.code === 'validation') env.error.details = err.details;
    if (requestId) env.error.requestId = requestId;
    return env;
  }
  const env: ErrorEnvelope = { error: { code: 'internal', message: 'Internal error' } };
  if (requestId) env.error.requestId = requestId;
  return env;
}
