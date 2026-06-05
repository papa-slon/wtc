import { spawnSync } from 'node:child_process';

const DEFAULT_MAX_BUFFER = 100 * 1024 * 1024;
const REDACTED = '<redacted>';

const DB_ASSIGNMENT =
  /\b((?:REAL_POSTGRES_DATABASE_URL|REAL_POSTGRES_ADMIN_DATABASE_URL|LMS_E2E_DATABASE_URL|LMS_E2E_ADMIN_DATABASE_URL|AUDIT_APPEND_ONLY_DATABASE_URL|POSTGRES_DSN|DATABASE_DSN|[A-Z0-9_]*(?:DATABASE|POSTGRES)_(?:URL|DSN)|DATABASE_URL)\s*=\s*)[^\s"'<>]+/gi;
const SECRET_ASSIGNMENT =
  /\b((?:SESSION_SECRET|SECRET_VAULT_KEK|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|AXIOMA_HANDOFF_SIGNING_KEY|AXIOMA_HANDOFF_SIGNING_SECRET|AXIOMA_BRIDGE_API_TOKEN|LMS_FILE_SCANNER_TOKEN|LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY|LMS_OBJECT_STORAGE_ACCESS_KEY_ID|[A-Z][A-Z0-9_]*(?:TOKEN|API_KEY|SECRET|ACCESS_KEY|HMAC)[A-Z0-9_]*)\s*=\s*)[^\s"'<>]+/gi;
const PROVIDER_URL_ASSIGNMENT =
  /\b((?:APP_BASE_URL|PREVIEW_URL|PUBLIC_PREVIEW_URL|WTC_PREVIEW_URL|NEXT_PUBLIC_[A-Z0-9_]*URL|LMS_FILE_SCANNER_ENDPOINT|LMS_OBJECT_STORAGE_ENDPOINT|AXIOMA_BRIDGE_URL|STRIPE_API_BASE_URL)\s*=\s*)https?:\/\/[^\s"'<>]+/gi;
const URL_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/)([^:@\s/?#]+):([^@\s/?#]+)@/gi;
const POSTGRES_URL = /\bpostgres(?:ql)?:\/\/[^\s"'<>]+/gi;
const RAW_PUBLIC_IP_URL =
  /\bhttps?:\/\/(?!(?:localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.))(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?::\d{1,5})?(?:[/?#][^\s"'<>]*)?/gi;
const SENSITIVE_QUERY_PARAM = /([?&](?:password|token|api_key|apikey|secret|signature|access_key|session|session_secret|kek)=)[^&#\s"'<>]+/gi;
const SIGNED_URL_PARAM = /([?&](?:X-Amz-Credential|X-Amz-Signature|AWSAccessKeyId)=)[^&#\s"'<>]+/gi;
const PASSWORD_PARAM = /\b(password=)[^&\s"'<>]+/gi;
const AUTH_HEADER = /\b(authorization\s*[:=]\s*)(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi;
const BEARER_VALUE = /\bBearer\s+[A-Za-z0-9._~+/-]+/gi;
const BASIC_VALUE = /\bBasic\s+[A-Za-z0-9+/=]+/gi;
const COOKIE_HEADER = /\b((?:cookie|set-cookie)\s*[:=]\s*)[^\r\n]+/gi;
const JWT_VALUE = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const STRIPE_SECRET = /\b(?:sk_(?:test|live)|whsec|rk_(?:test|live))_[A-Za-z0-9_]+/gi;
const PRIVATE_KEY_BLOCK = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
const PRIVATE_KEY_REPLACEMENT = ['-----BEGIN ', 'PRIVATE KEY-----', REDACTED, '-----END ', 'PRIVATE KEY-----'].join('');

function quoteCmdArg(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=+\-@]+$/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function buildSpawnInvocation(command, args) {
  if (process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command)) {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', [command, ...args].map(quoteCmdArg).join(' ')],
    };
  }
  return { command, args };
}

export function redactProcessOutput(input) {
  const text = input == null ? '' : String(input);
  return text
    .replace(PRIVATE_KEY_BLOCK, PRIVATE_KEY_REPLACEMENT)
    .replace(DB_ASSIGNMENT, `$1${REDACTED}`)
    .replace(SECRET_ASSIGNMENT, `$1${REDACTED}`)
    .replace(PROVIDER_URL_ASSIGNMENT, `$1${REDACTED}`)
    .replace(POSTGRES_URL, `postgres://${REDACTED}`)
    .replace(RAW_PUBLIC_IP_URL, `https://${REDACTED}`)
    .replace(URL_CREDENTIALS, `$1${REDACTED}:${REDACTED}@`)
    .replace(SENSITIVE_QUERY_PARAM, `$1${REDACTED}`)
    .replace(SIGNED_URL_PARAM, `$1${REDACTED}`)
    .replace(PASSWORD_PARAM, `$1${REDACTED}`)
    .replace(AUTH_HEADER, `$1${REDACTED}`)
    .replace(BEARER_VALUE, `Bearer ${REDACTED}`)
    .replace(BASIC_VALUE, `Basic ${REDACTED}`)
    .replace(COOKIE_HEADER, `$1${REDACTED}`)
    .replace(JWT_VALUE, REDACTED)
    .replace(STRIPE_SECRET, REDACTED);
}

export function runRedactedChildProcess(command, args = [], options = {}) {
  const invocation = buildSpawnInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
    input: options.input,
    encoding: 'utf8',
    maxBuffer: options.maxBuffer ?? DEFAULT_MAX_BUFFER,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: options.windowsHide ?? true,
  });

  const stdout = redactProcessOutput(result.stdout);
  const stderr = redactProcessOutput(result.stderr);

  if (options.forwardStdout !== false && stdout) process.stdout.write(stdout);
  if (options.forwardStderr !== false && stderr) process.stderr.write(stderr);
  if (result.error) {
    throw new Error(redactProcessOutput(result.error.message));
  }

  return {
    status: typeof result.status === 'number' ? result.status : null,
    signal: result.signal ?? null,
    stdout,
    stderr,
  };
}
