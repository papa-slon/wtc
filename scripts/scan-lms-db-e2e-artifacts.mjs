#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import {
  assertNoLinkedExistingSegments,
  assertPlainWorkspaceFile,
  toSlash,
} from './workspace-path-guard.mjs';

const ROOT = process.cwd();
const DEFAULT_ROOTS = ['test-results', 'playwright-report', 'tests/e2e/screenshots', 'logs/lms-db-e2e'];
const LMS_STORAGE_PATH_MARKER = 'lms/materials/';
const RAW_VIMEO_EMBED_URL = 'player.vimeo.com/video/123456789';
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico']);
const UNSCANNABLE_EXTENSIONS = new Set(['.zip', '.gz', '.br', '.pdf']);
const BLOCKED_RETAINED_PATHS = [
  { label: 'raw dev-server log artifact', pattern: /(^|\/)dev-server\.log$/i },
  { label: 'raw safe-preview log artifact', pattern: /(^|\/)preview-safe[^/]*\.log$/i },
];

const FORBIDDEN = [
  { label: 'LMS file DTO field fileBytesBase64', pattern: /\bfileBytesBase64\b/i },
  { label: 'LMS storage key camelCase field', pattern: /\bstorageKey\b/i },
  { label: 'LMS storage key snake_case field', pattern: /\bstorage_key\b/i },
  { label: 'LMS cleanup task id field', pattern: /\bcleanup(?:TaskId|_task_id)\b/i },
  { label: 'LMS internal storage path', pattern: new RegExp(LMS_STORAGE_PATH_MARKER.replaceAll('/', '\\/'), 'i') },
  { label: 'LMS original filename DTO field', pattern: /\bfileName\b/i },
  { label: 'LMS MIME type DTO field', pattern: /\bmimeType\b/i },
  { label: 'LMS content hash DTO field', pattern: /\bcontentSha256\b/i },
  { label: 'LMS storage provider DTO field', pattern: /\bstorageProvider\b/i },
  { label: 'LMS local storage provider value', pattern: /\bdb-local\b/i },
  { label: 'LMS retention DTO field', pattern: /\bretainedUntil\b/i },
  { label: 'LMS quarantine DTO field', pattern: /\bquarantineReason\b/i },
  { label: 'LMS deleted-at DTO field', pattern: /\bdeletedAt\b/i },
  { label: 'LMS audit storage-key presence field', pattern: /\bhasStorageKey\b/i },
  { label: 'deprecated LMS download hash header', pattern: /\bx-lms-sha256\b/i },
  { label: 'signed object URL algorithm token', pattern: /\bX-Amz-Algorithm\b/i },
  { label: 'signed object URL credential token', pattern: /\bX-Amz-Credential\b/i },
  { label: 'signed object URL signature token', pattern: /\bX-Amz-Signature\b/i },
  { label: 'legacy signed object access key token', pattern: /\bAWSAccessKeyId\b/i },
  { label: 'clean uploaded file body marker', pattern: /db-backed lms acceptance/i },
  { label: 'clean uploaded file body base64 prefix', pattern: /ZGItYmFja2VkIGxtcyBhY2NlcHRhbmNl/i },
  { label: 'quarantine uploaded file body marker', pattern: /EICAR-STANDARD-ANTIVIRUS-TEST-FILE/i },
  { label: 'quarantine uploaded file body base64 prefix', pattern: /RUlDQVItU1RBTkRBUkQtQU5USVZJUlVTLVRFU1QtRklMRQ/i },
  { label: 'raw LMS iframe HTML', pattern: new RegExp(`<iframe\\s+src=["']https:\\/\\/${RAW_VIMEO_EMBED_URL.replaceAll('.', '\\.')}`, 'i') },
  { label: 'raw LMS iframe base64 prefix', pattern: /PGlmcmFtZSBzcmM9Imh0dHBzOi8vcGxheWVyLnZpbWVvLmNvbS92aWRlby8xMjM0NTY3ODki/i },
  { label: 'escaped raw iframe HTML', pattern: /&lt;iframe/i },
  { label: 'demo password in artifact', pattern: /wtc-demo-pass-123/i },
  { label: 'Postgres URL in artifact', pattern: /postgres(?:ql)?:\/\/[^ \t\r\n"'<>]+/i },
  { label: 'LMS database URL assignment', pattern: /LMS_E2E_DATABASE_URL\s*=\s*[^ \t\r\n]+/i },
  { label: 'DATABASE_URL assignment', pattern: /DATABASE_URL\s*=\s*[^ \t\r\n]+/i },
  {
    label: 'database/admin URL or DSN assignment',
    pattern:
      /\b(?:REAL_POSTGRES_DATABASE_URL|REAL_POSTGRES_ADMIN_DATABASE_URL|LMS_E2E_ADMIN_DATABASE_URL|AUDIT_APPEND_ONLY_DATABASE_URL|POSTGRES_DSN|DATABASE_DSN|[A-Z0-9_]*(?:DATABASE|POSTGRES)_(?:URL|DSN))\s*=\s*[^ \t\r\n]+/i,
  },
  { label: 'session secret assignment', pattern: /SESSION_SECRET\s*=\s*[^ \t\r\n]+/i },
  { label: 'secret vault KEK assignment', pattern: /SECRET_VAULT_KEK\s*=\s*[^ \t\r\n]+/i },
  { label: 'generic secret token or API key assignment', pattern: /\b[A-Z][A-Z0-9_]*(?:TOKEN|API_KEY|SECRET|ACCESS_KEY)[A-Z0-9_]*\s*=\s*[^ \t\r\n]+/i },
  { label: 'Stripe secret key assignment', pattern: /STRIPE_SECRET_KEY\s*=\s*[^ \t\r\n]+/i },
  { label: 'Stripe webhook secret assignment', pattern: /STRIPE_WEBHOOK_SECRET\s*=\s*[^ \t\r\n]+/i },
  { label: 'Stripe secret key token', pattern: /\bsk_(?:test|live)_[A-Za-z0-9_]+/i },
  { label: 'Stripe webhook secret token', pattern: /\bwhsec_[A-Za-z0-9_]+/i },
  { label: 'Stripe signature header', pattern: /\bstripe-signature\b/i },
  { label: 'Stripe signature value', pattern: /\bt=\d+,v1=[a-f0-9]{32,}\b/i },
  { label: 'Stripe raw event body marker', pattern: /"object"\s*:\s*"event"/i },
  { label: 'Stripe checkout session id', pattern: /\bcs_(?:test|live)_[A-Za-z0-9_]+/i },
  { label: 'Stripe price id token', pattern: /\bprice_[A-Za-z0-9_]+/i },
  { label: 'Stripe checkout endpoint', pattern: /api\.stripe\.com\/v1\/checkout\/sessions/i },
  { label: 'Stripe checkout request price field', pattern: /line_items\[0\]\[price\]/i },
  { label: 'Stripe checkout metadata user field', pattern: /metadata\[userId\]/i },
  { label: 'Axioma handoff signing key assignment', pattern: /AXIOMA_HANDOFF_SIGNING_KEY\s*=\s*[^ \t\r\n]+/i },
  { label: 'Axioma HS256 dev secret assignment', pattern: /AXIOMA_HANDOFF_SIGNING_SECRET\s*=\s*[^ \t\r\n]+/i },
  { label: 'Axioma bridge API token assignment', pattern: /AXIOMA_BRIDGE_API_TOKEN\s*=\s*[^ \t\r\n]+/i },
  { label: 'private key block in artifact', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i },
  { label: 'compact JWT in artifact', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { label: 'Axioma raw handoff route evidence', pattern: /\/wtc-handoff\b/i },
  { label: 'Axioma raw handoff nonce claim', pattern: /"nonce"\s*:/i },
  { label: 'Axioma raw handoff jti claim', pattern: /"jti"\s*:/i },
  { label: 'Axioma linked user claim', pattern: /wtc_axioma_user_id/i },
  { label: 'Axioma account user identifier field', pattern: /axioma[_-]?user[_-]?id/i },
  { label: 'LMS scanner endpoint assignment', pattern: /LMS_FILE_SCANNER_ENDPOINT\s*=\s*[^ \t\r\n]+/i },
  { label: 'LMS scanner token assignment', pattern: /LMS_FILE_SCANNER_TOKEN\s*=\s*[^ \t\r\n]+/i },
  { label: 'LMS scanner live acceptance assignment', pattern: /LMS_FILE_SCANNER_LIVE_ACCEPTANCE\s*=\s*[^ \t\r\n]+/i },
  { label: 'LMS scanner quarantine corpus assignment', pattern: /LMS_FILE_SCANNER_LIVE_EICAR\s*=\s*[^ \t\r\n]+/i },
  { label: 'external scanner MIME header', pattern: /\bx-wtc-lms-mime-type\b/i },
  { label: 'external scanner size header', pattern: /\bx-wtc-lms-size-bytes\b/i },
  { label: 'external scanner request content type', pattern: /\bapplication\/octet-stream\b/i },
  { label: 'external scanner provider JSON body', pattern: /"status"\s*:\s*"(?:clean|quarantined|failed)"/i },
  { label: 'LMS object storage endpoint assignment', pattern: /LMS_OBJECT_STORAGE_ENDPOINT\s*=\s*[^ \t\r\n]+/i },
  { label: 'LMS object storage bucket assignment', pattern: /LMS_OBJECT_STORAGE_BUCKET\s*=\s*[^ \t\r\n]+/i },
  { label: 'LMS object storage region assignment', pattern: /LMS_OBJECT_STORAGE_REGION\s*=\s*[^ \t\r\n]+/i },
  { label: 'LMS object storage access key assignment', pattern: /LMS_OBJECT_STORAGE_ACCESS_KEY_ID\s*=\s*[^ \t\r\n]+/i },
  { label: 'LMS object storage secret key assignment', pattern: /LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY\s*=\s*[^ \t\r\n]+/i },
  { label: 'signed object authorization credential', pattern: /\bAWS4-HMAC-SHA256\s+Credential=/i },
  { label: 'signed object content hash header', pattern: /\bx-amz-content-sha256\b/i },
  { label: 'signed object date header', pattern: /\bx-amz-date\b/i },
  { label: 'S3/R2 XML provider body marker', pattern: /<Error>\s*(?:\r?\n\s*)?<(?:Code|Message)>/i },
  { label: 'S3/R2 request id header', pattern: /\bx-amz-request-id\b/i },
  { label: 'prep token assignment', pattern: /LMS_DB_E2E_PREP_TOKEN\s*=\s*[^ \t\r\n]+/i },
  { label: 'session cookie name in artifact', pattern: /\b(?:__Host-)?wtc_session\b/i },
  { label: 'cookie header in artifact', pattern: /(?:"|\b)(?:cookie|set-cookie)(?:"|\b)\s*[:=]/i },
  { label: 'authorization header in artifact', pattern: /(?:"|\b)authorization(?:"|\b)\s*[:=]/i },
  { label: 'session token-like cookie value in artifact', pattern: /\b(?:wtc_session|__Host-wtc_session|cookie|set-cookie)["'\s:=]+[a-f0-9]{64}\b/i },
  { label: 'bearer token in artifact', pattern: /\bBearer\s+[A-Za-z0-9._~+/-]+/i },
  { label: 'basic auth in artifact', pattern: /\bBasic\s+[A-Za-z0-9+/=]+/i },
  {
    label: 'raw public IP URL in artifact',
    pattern:
      /\bhttps?:\/\/(?!(?:localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.))(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?::\d{1,5})?(?:[/?#]|\b)/i,
  },
  {
    label: 'raw SSH public IP target in artifact',
    pattern:
      /\b[a-z][a-z0-9_-]*@(?!(?:127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.))(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/i,
  },
  {
    label: 'preview/base URL assignment in artifact',
    pattern: /\b(?:APP_BASE_URL|PREVIEW_URL|PUBLIC_PREVIEW_URL|WTC_PREVIEW_URL|NEXT_PUBLIC_[A-Z0-9_]*URL)\s*=\s*https?:\/\/[^ \t\r\n]+/i,
  },
  { label: 'raw app redirect URL field in artifact', pattern: /\b(?:success_url|cancel_url)\s*[:=]\s*https?:\/\/[^ \t\r\n"'<>]+/i },
  { label: 'password hash in artifact', pattern: /\$argon2id\$/i },
];

function resolveWorkspacePath(raw, kind) {
  const value = (raw ?? '').trim();
  const slashPath = toSlash(value);
  if (!value || URL_SCHEME.test(slashPath) || slashPath.startsWith('//')) {
    throw new Error(`${kind} must be inside workspace`);
  }
  if (slashPath.split('/').includes('..')) {
    throw new Error(`${kind} must not contain traversal`);
  }
  const absolute = resolve(ROOT, value);
  const rel = relative(ROOT, absolute);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`${kind} must be inside workspace`);
  }
  assertNoLinkedExistingSegments(absolute, kind);
  return { absolute, display: toSlash(rel || '.') };
}

function displayPath(file) {
  const rel = relative(ROOT, file);
  if (rel.startsWith('..') || isAbsolute(rel)) return '<outside-workspace>';
  return toSlash(rel || file);
}

function loadDynamicMarkers() {
  const rawPath = process.env.LMS_DB_E2E_DYNAMIC_MARKERS_PATH?.trim();
  if (!rawPath) return [];
  const { absolute: path } = resolveWorkspacePath(rawPath, 'dynamic marker manifest');
  if (!existsSync(path)) throw new Error('dynamic marker manifest missing');
  assertPlainWorkspaceFile(path, 'dynamic marker manifest');
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error('dynamic marker manifest invalid JSON');
  }
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.markers)) {
    throw new Error('dynamic marker manifest invalid shape');
  }
  if (parsed.markers.length > 100) throw new Error('dynamic marker manifest too large');
  return parsed.markers.map((marker, idx) => {
    if (!marker || typeof marker.label !== 'string' || typeof marker.value !== 'string') {
      throw new Error(`dynamic marker ${idx} invalid`);
    }
    const label = marker.label.trim();
    const value = marker.value;
    if (!/^[A-Za-z0-9 .:_-]{1,80}$/.test(label)) throw new Error(`dynamic marker ${idx} label invalid`);
    if (value.length < 8 || value.length > 10_000) throw new Error(`dynamic marker ${idx} value invalid`);
    return {
      label,
      values: [value, Buffer.from(value, 'utf8').toString('base64')],
    };
  });
}

function extension(path) {
  const name = path.toLowerCase();
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot) : '';
}

function isProbablyBinary(buffer) {
  const limit = Math.min(buffer.length, 4096);
  for (let i = 0; i < limit; i += 1) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

function walk(path, out) {
  assertNoLinkedExistingSegments(path, 'artifact path');
  const s = statSync(path);
  if (s.isDirectory()) {
    for (const name of readdirSync(path)) walk(join(path, name), out);
    return;
  }
  if (s.isFile()) out.push(path);
}

function hasForbiddenText(text, dynamicMarkers = []) {
  for (const rule of FORBIDDEN) {
    if (rule.pattern.test(text)) return rule.label;
  }
  for (const marker of dynamicMarkers) {
    if (marker.values.some((value) => text.includes(value))) return `dynamic LMS marker ${marker.label}`;
  }
  return null;
}

function safeArtifactLabel(label, dynamicMarkers = []) {
  return hasForbiddenText(label, dynamicMarkers) ? '<redacted-artifact-path>' : label;
}

function scanText(label, text, failures, dynamicMarkers) {
  for (const rule of FORBIDDEN) {
    if (rule.pattern.test(text)) failures.push({ label, rule: rule.label });
  }
  for (const marker of dynamicMarkers) {
    if (marker.values.some((value) => text.includes(value))) {
      failures.push({ label, rule: `dynamic LMS marker ${marker.label}` });
    }
  }
}

function scanRetainedPath(display, label, failures) {
  for (const rule of BLOCKED_RETAINED_PATHS) {
    if (rule.pattern.test(display)) failures.push({ label, rule: rule.label });
  }
}

const roots = process.argv.slice(2);
let targetRoots;
try {
  targetRoots = (roots.length ? roots : DEFAULT_ROOTS).map((root) => resolveWorkspacePath(root, 'artifact root'));
} catch {
  console.error(`# LMS DB e2e artifact scan refused - artifact roots must be workspace-local paths`);
  process.exit(2);
}
let dynamicMarkers = [];
try {
  dynamicMarkers = loadDynamicMarkers();
} catch (error) {
  console.error(`# LMS DB e2e artifact scan failed - dynamic marker manifest rejected`);
  console.error(`FAIL dynamic marker manifest: ${error instanceof Error ? error.message : 'invalid manifest'}`);
  process.exit(1);
}
const files = [];
let missingRoots = 0;
for (const root of targetRoots) {
  if (existsSync(root.absolute)) {
    try {
      assertNoLinkedExistingSegments(root.absolute, 'artifact root');
      walk(root.absolute, files);
    } catch {
      console.error(`# LMS DB e2e artifact scan refused - artifact roots must be workspace-local paths`);
      process.exit(2);
    }
  }
  else if (roots.length) {
    console.error(`# LMS DB e2e artifact scan refused - explicit artifact root missing`);
    process.exit(2);
  } else missingRoots += 1;
}

const failures = [];
let scannedText = 0;
let skippedImages = 0;
let blockedContainers = 0;

for (const file of files) {
  const display = displayPath(file);
  const safeDisplay = safeArtifactLabel(display, dynamicMarkers);
  scanRetainedPath(display, safeDisplay, failures);
  scanText(`${safeDisplay} (path)`, display, failures, dynamicMarkers);

  const ext = extension(file);
  if (UNSCANNABLE_EXTENSIONS.has(ext)) {
    blockedContainers += 1;
    failures.push({ label: safeDisplay, rule: 'unscanned binary/container artifact' });
    continue;
  }

  const buffer = readFileSync(file);
  if (IMAGE_EXTENSIONS.has(ext)) {
    skippedImages += 1;
    continue;
  }
  if (isProbablyBinary(buffer)) {
    failures.push({ label: safeDisplay, rule: 'unscanned binary artifact' });
    continue;
  }

  scannedText += 1;
  scanText(safeDisplay, buffer.toString('utf8'), failures, dynamicMarkers);
}

if (failures.length) {
  console.error(`# LMS DB e2e artifact scan failed - ${failures.length} issue(s)`);
  for (const f of failures.slice(0, 20)) {
    console.error(`FAIL ${f.label}: ${f.rule}`);
  }
  if (failures.length > 20) console.error(`... ${failures.length - 20} more`);
  process.exit(1);
}

console.log(
  `# LMS DB e2e artifact scan passed - ${scannedText} text file(s), ${skippedImages} image file(s), ` +
    `${blockedContainers} blocked container(s), ${missingRoots} missing root(s), ${files.length} total artifact file(s), ` +
    `${dynamicMarkers.length} dynamic marker(s)`,
);
