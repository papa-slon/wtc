#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import {
  assertNoLinkedExistingSegments,
  assertPlainWorkspaceFile,
  toSlash,
} from './workspace-path-guard.mjs';

const ROOT = process.cwd();
const DEFAULT_ROOTS = ['tests/e2e/screenshots'];
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico']);
const BLOCKED_BINARY_EXTENSIONS = new Set(['.zip', '.gz', '.br', '.pdf', '.webm', '.mp4', '.mov', '.avi', '.mkv', '.trace']);

const REQUIRED_REVIEW_LABELS = [
  'secret-like text',
  'Postgres URL or DSN',
  'session or auth token',
  'cookie or authorization header',
  'raw public IP URL',
  'signed object URL token',
  'LMS internal storage or metadata',
  'Stripe or provider token',
];

const FORBIDDEN_TEXT = [
  { label: 'LMS storage key', pattern: /\bstorageKey\b|\bstorage_key\b|\blms\/materials\//i },
  { label: 'LMS internal metadata', pattern: /\b(?:fileBytesBase64|fileName|mimeType|contentSha256|retainedUntil|quarantineReason|deletedAt)\b/i },
  { label: 'Postgres URL or DSN', pattern: /postgres(?:ql)?:\/\/[^ \t\r\n"'<>]+/i },
  {
    label: 'database URL assignment',
    pattern:
      /\b(?:REAL_POSTGRES_DATABASE_URL|REAL_POSTGRES_ADMIN_DATABASE_URL|LMS_E2E_DATABASE_URL|LMS_E2E_ADMIN_DATABASE_URL|AUDIT_APPEND_ONLY_DATABASE_URL|DATABASE_URL|POSTGRES_DSN|DATABASE_DSN)\s*=\s*[^ \t\r\n]+/i,
  },
  { label: 'session secret assignment', pattern: /SESSION_SECRET\s*=\s*[^ \t\r\n]+/i },
  { label: 'secret token or API key assignment', pattern: /\b[A-Z][A-Z0-9_]*(?:TOKEN|API_KEY|SECRET|ACCESS_KEY)[A-Z0-9_]*\s*=\s*[^ \t\r\n]+/i },
  { label: 'Stripe secret key token', pattern: /\bsk_(?:test|live)_[A-Za-z0-9_]+/i },
  { label: 'Stripe webhook secret token', pattern: /\bwhsec_[A-Za-z0-9_]+/i },
  { label: 'Stripe checkout session id', pattern: /\bcs_(?:test|live)_[A-Za-z0-9_]+/i },
  { label: 'Stripe price id token', pattern: /\bprice_[A-Za-z0-9_]+/i },
  { label: 'signed object URL token', pattern: /\b(?:X-Amz-Algorithm|X-Amz-Credential|X-Amz-Signature|AWSAccessKeyId)\b/i },
  { label: 'private key block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i },
  { label: 'compact JWT', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { label: 'session cookie name', pattern: /\b(?:__Host-)?wtc_session\b/i },
  { label: 'cookie header', pattern: /(?:"|\b)(?:cookie|set-cookie)(?:"|\b)\s*[:=]/i },
  { label: 'authorization header', pattern: /(?:"|\b)authorization(?:"|\b)\s*[:=]/i },
  { label: 'bearer token', pattern: /\bBearer\s+[A-Za-z0-9._~+/-]+/i },
  { label: 'basic auth token', pattern: /\bBasic\s+[A-Za-z0-9+/=]+/i },
  {
    label: 'raw public IP URL',
    pattern:
      /\bhttps?:\/\/(?!(?:localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.))(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?::\d{1,5})?(?:[/?#]|\b)/i,
  },
  { label: 'password hash', pattern: /\$argon2id\$/i },
];

function extension(path) {
  const name = path.toLowerCase();
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot) : '';
}

function resolveWorkspacePath(raw, kind) {
  const value = (raw ?? '').trim();
  const slashPath = toSlash(value);
  if (!value || URL_SCHEME.test(slashPath) || slashPath.startsWith('//')) {
    throw new Error(`${kind} must be inside workspace`);
  }
  if (slashPath.split('/').includes('..')) throw new Error(`${kind} must not contain traversal`);
  const absolute = resolve(ROOT, value);
  const rel = relative(ROOT, absolute);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`${kind} must be inside workspace`);
  assertNoLinkedExistingSegments(absolute, kind);
  return { absolute, display: toSlash(rel || '.') };
}

function displayPath(file) {
  const rel = relative(ROOT, file);
  if (rel.startsWith('..') || isAbsolute(rel)) return '<outside-workspace>';
  return toSlash(rel || file);
}

function hasForbiddenText(text, dynamicMarkers = []) {
  for (const rule of FORBIDDEN_TEXT) {
    if (rule.pattern.test(text)) return rule.label;
  }
  for (const marker of dynamicMarkers) {
    if (marker.values.some((value) => text.includes(value))) return `dynamic marker ${marker.label}`;
  }
  return null;
}

function safeArtifactLabel(path, dynamicMarkers = []) {
  return hasForbiddenText(path, dynamicMarkers) ? '<redacted-artifact-path>' : path;
}

function walk(path, out) {
  assertNoLinkedExistingSegments(path, 'visual artifact path');
  const s = statSync(path);
  if (s.isDirectory()) {
    for (const name of readdirSync(path)) walk(join(path, name), out);
    return;
  }
  if (s.isFile()) out.push(path);
}

function parseArgs(argv) {
  const parsed = { inventory: false, manifest: null, roots: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--inventory') {
      parsed.inventory = true;
    } else if (arg === '--manifest') {
      const next = argv[++i];
      if (!next) throw new Error('missing --manifest value');
      parsed.manifest = next;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/check-retained-visual-artifacts.mjs [--inventory] [--manifest path.json] [artifact roots...]');
      process.exit(0);
    } else if (arg.startsWith('--')) {
      throw new Error('unknown option');
    } else {
      parsed.roots.push(arg);
    }
  }
  return parsed;
}

function parseJsonFile(path, kind) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`${kind} invalid JSON`);
  }
}

function loadDynamicMarkers() {
  const rawPath = process.env.LMS_DB_E2E_DYNAMIC_MARKERS_PATH?.trim();
  if (!rawPath) return [];
  const { absolute } = resolveWorkspacePath(rawPath, 'dynamic marker manifest');
  if (!existsSync(absolute)) throw new Error('dynamic marker manifest missing');
  assertPlainWorkspaceFile(absolute, 'dynamic marker manifest');
  const parsed = parseJsonFile(absolute, 'dynamic marker manifest');
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
    return { label, values: [value, Buffer.from(value, 'utf8').toString('base64')] };
  });
}

function loadReviewManifest(rawPath) {
  const { absolute } = resolveWorkspacePath(rawPath, 'visual review manifest');
  if (!existsSync(absolute)) throw new Error('visual review manifest missing');
  assertPlainWorkspaceFile(absolute, 'visual review manifest');
  const parsed = parseJsonFile(absolute, 'visual review manifest');
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.artifacts)) {
    throw new Error('visual review manifest invalid shape');
  }
  if (parsed.artifacts.length > 1_000) throw new Error('visual review manifest too large');
  return parsed;
}

function validateReviewer(value) {
  return typeof value === 'string' && /^[A-Za-z0-9 .:_@-]{1,80}$/.test(value.trim());
}

function validateIsoDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function requiredLabels(dynamicMarkers) {
  return [...REQUIRED_REVIEW_LABELS, ...dynamicMarkers.map((marker) => `dynamic marker ${marker.label}`)];
}

function validateManifest(manifest, imageDisplays, dynamicMarkers) {
  const failures = [];
  const imageSet = new Set(imageDisplays);
  const seen = new Set();
  let ocrSidecars = 0;
  const required = requiredLabels(dynamicMarkers);

  for (const [idx, artifact] of manifest.artifacts.entries()) {
    if (!artifact || typeof artifact.path !== 'string') {
      failures.push({ label: `manifest artifact ${idx}`, rule: 'missing artifact path' });
      continue;
    }

    let artifactPath;
    try {
      artifactPath = resolveWorkspacePath(artifact.path, 'visual artifact path').display;
    } catch {
      failures.push({ label: `manifest artifact ${idx}`, rule: 'unsafe artifact path' });
      continue;
    }

    const label = safeArtifactLabel(artifactPath, dynamicMarkers);
    if (!imageSet.has(artifactPath)) failures.push({ label, rule: 'manifest artifact is not present in scanned image roots' });
    if (seen.has(artifactPath)) failures.push({ label, rule: 'duplicate visual review entry' });
    seen.add(artifactPath);

    if (artifact.result !== 'pass') failures.push({ label, rule: 'visual review result must be pass' });
    if (artifact.method !== 'manual' && artifact.method !== 'ocr') failures.push({ label, rule: 'visual review method must be manual or ocr' });
    if (!validateReviewer(artifact.reviewer)) failures.push({ label, rule: 'visual review reviewer label invalid' });
    if (!validateIsoDate(artifact.reviewedAt)) failures.push({ label, rule: 'visual review timestamp invalid' });

    const reviewed = Array.isArray(artifact.reviewedMarkerLabels) ? artifact.reviewedMarkerLabels : [];
    for (const requiredLabel of required) {
      if (!reviewed.includes(requiredLabel)) failures.push({ label, rule: `missing reviewed marker label ${requiredLabel}` });
    }

    if (artifact.ocrTextPath !== undefined || artifact.method === 'ocr') {
      if (typeof artifact.ocrTextPath !== 'string') {
        failures.push({ label, rule: 'OCR text sidecar path required' });
      } else {
        try {
          const sidecar = resolveWorkspacePath(artifact.ocrTextPath, 'OCR text sidecar');
          assertPlainWorkspaceFile(sidecar.absolute, 'OCR text sidecar');
          const text = readFileSync(sidecar.absolute, 'utf8');
          const rule = hasForbiddenText(text, dynamicMarkers);
          if (rule) failures.push({ label, rule: `OCR text sidecar contains ${rule}` });
          ocrSidecars += 1;
        } catch {
          failures.push({ label, rule: 'OCR text sidecar rejected' });
        }
      }
    }
  }

  for (const image of imageDisplays) {
    if (!seen.has(image)) failures.push({ label: safeArtifactLabel(image, dynamicMarkers), rule: 'missing visual review manifest entry' });
  }

  return { failures, reviewed: seen.size, ocrSidecars };
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch {
  console.error('# retained visual artifact check refused - invalid arguments');
  process.exit(2);
}

let dynamicMarkers = [];
try {
  dynamicMarkers = loadDynamicMarkers();
} catch {
  console.error('# retained visual artifact check failed - dynamic marker manifest rejected');
  process.exit(1);
}

let roots;
try {
  roots = (args.roots.length ? args.roots : DEFAULT_ROOTS).map((root) => resolveWorkspacePath(root, 'artifact root'));
} catch {
  console.error('# retained visual artifact check refused - artifact roots must be workspace-local paths');
  process.exit(2);
}

const files = [];
let missingRoots = 0;
for (const root of roots) {
  if (existsSync(root.absolute)) {
    try {
      assertNoLinkedExistingSegments(root.absolute, 'artifact root');
      walk(root.absolute, files);
    } catch {
      console.error('# retained visual artifact check refused - artifact roots must be workspace-local paths');
      process.exit(2);
    }
  }
  else if (args.roots.length) {
    console.error('# retained visual artifact check refused - explicit artifact root missing');
    process.exit(2);
  } else {
    missingRoots += 1;
  }
}

const images = [];
const blocked = [];
for (const file of files) {
  const display = displayPath(file);
  const ext = extension(file);
  if (IMAGE_EXTENSIONS.has(ext)) images.push(display);
  else if (BLOCKED_BINARY_EXTENSIONS.has(ext)) blocked.push(display);
}

if (blocked.length) {
  console.error(`# retained visual artifact check failed - ${blocked.length} blocked binary/container artifact(s)`);
  for (const file of blocked.slice(0, 20)) console.error(`FAIL ${safeArtifactLabel(file)}: unreviewed binary/container artifact`);
  if (blocked.length > 20) console.error(`... ${blocked.length - 20} more`);
  process.exit(1);
}

if (args.inventory) {
  console.log(
    `# retained visual artifact inventory - ${images.length} image file(s), ${blocked.length} blocked binary/container artifact(s), ` +
      `${missingRoots} missing root(s), ${files.length} total artifact file(s), ${dynamicMarkers.length} dynamic marker(s)`,
  );
  process.exit(0);
}

if (!images.length && !args.manifest) {
  console.log(
    `# retained visual artifact check passed - 0 image file(s), ${missingRoots} missing root(s), ` +
      `${files.length} total artifact file(s), ${dynamicMarkers.length} dynamic marker(s)`,
  );
  process.exit(0);
}

if (!args.manifest) {
  console.error(`# retained visual artifact check failed - review manifest required for ${images.length} image file(s)`);
  for (const file of images.slice(0, 20)) console.error(`FAIL ${safeArtifactLabel(file)}: missing visual review manifest`);
  if (images.length > 20) console.error(`... ${images.length - 20} more`);
  process.exit(1);
}

let manifest;
try {
  manifest = loadReviewManifest(args.manifest);
} catch {
  console.error('# retained visual artifact check failed - visual review manifest rejected');
  process.exit(1);
}

const result = validateManifest(manifest, images, dynamicMarkers);
if (result.failures.length) {
  console.error(`# retained visual artifact check failed - ${result.failures.length} issue(s)`);
  for (const f of result.failures.slice(0, 20)) console.error(`FAIL ${f.label}: ${f.rule}`);
  if (result.failures.length > 20) console.error(`... ${result.failures.length - 20} more`);
  process.exit(1);
}

console.log(
  `# retained visual artifact check passed - ${images.length} image file(s), ${result.reviewed} reviewed artifact(s), ` +
    `${result.ocrSidecars} OCR sidecar(s), ${dynamicMarkers.length} dynamic marker(s)`,
);
