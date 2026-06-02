import { createHash, randomUUID } from 'node:crypto';

export const LMS_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const LMS_DEFAULT_FILE_RETENTION_DAYS = 365;
export const LMS_LOCAL_STORAGE_PROVIDER = 'db-local';
export const LMS_FILESYSTEM_STORAGE_PROVIDER = 'fs-local';
export const LMS_OBJECT_STORAGE_PROVIDER = 's3-r2';
export const LMS_STORAGE_KEY_PREFIX = 'lms/materials/';
export const LMS_FILE_SCAN_STATUSES = ['pending', 'clean', 'quarantined', 'failed', 'not_required'] as const;
export const LMS_FILE_STORAGE_PROVIDERS = [LMS_LOCAL_STORAGE_PROVIDER, LMS_FILESYSTEM_STORAGE_PROVIDER, LMS_OBJECT_STORAGE_PROVIDER] as const;

export const LMS_ALLOWED_FILE_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'text/plain',
] as const;

export type LmsAllowedFileMimeType = (typeof LMS_ALLOWED_FILE_MIME_TYPES)[number];
export type LmsFileScanStatus = (typeof LMS_FILE_SCAN_STATUSES)[number];
export type LmsFileStorageProvider = (typeof LMS_FILE_STORAGE_PROVIDERS)[number];

export interface NormalizedLmsFile {
  fileName: string;
  mimeType: LmsAllowedFileMimeType;
  sizeBytes: number;
  contentSha256: string;
  fileBytesBase64: string;
}

export interface PreparedLmsFileMaterial extends NormalizedLmsFile {
  storageProvider: typeof LMS_LOCAL_STORAGE_PROVIDER;
  storageKey: string;
  scanStatus: Exclude<LmsFileScanStatus, 'not_required'>;
  scanCheckedAt: Date;
  quarantineReason: string | null;
  retainedUntil: Date;
}

export interface LmsIframeEmbed {
  html: string;
  src: string;
  title: string;
  allow: string;
  allowFullscreen: boolean;
  loading: 'lazy';
  referrerPolicy: 'no-referrer';
}

const ALLOWED_EMBED_HOSTS = [
  { host: 'www.youtube.com', pathPrefix: '/embed/' },
  { host: 'www.youtube-nocookie.com', pathPrefix: '/embed/' },
  { host: 'player.vimeo.com', pathPrefix: '/video/' },
] as const;

const ALLOWED_IFRAME_ATTRS = new Set(['src', 'title', 'allow', 'allowfullscreen', 'loading', 'referrerpolicy']);
const DEFAULT_ALLOW = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
const ALLOWED_ALLOW_FEATURES = new Set(DEFAULT_ALLOW.split(';').map((v) => v.trim()));

function isAllowedMime(mimeType: string): mimeType is LmsAllowedFileMimeType {
  return (LMS_ALLOWED_FILE_MIME_TYPES as readonly string[]).includes(mimeType);
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function sanitizeFileName(name: string): string {
  const noControls = Array.from(name.trim(), (ch) => (ch.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(ch) ? '-' : ch)).join('');
  const trimmed = noControls.replace(/\s+/g, ' ');
  const withoutPath = trimmed.split(/[\\/]/).pop() ?? '';
  const safe = withoutPath.replace(/^\.+$/, '').slice(0, 120);
  return safe || 'material';
}

function startsWithBytes(bytes: Uint8Array, expected: readonly number[]): boolean {
  return bytes.byteLength >= expected.length && expected.every((byte, idx) => bytes[idx] === byte);
}

function assertFileBytesMatchMime(input: { mimeType: LmsAllowedFileMimeType; bytes: Uint8Array }): void {
  if (input.mimeType === 'application/pdf' && !startsWithBytes(input.bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    throw new Error('lms_file_content_type_mismatch');
  }
  if (input.mimeType === 'image/png' && !startsWithBytes(input.bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    throw new Error('lms_file_content_type_mismatch');
  }
  if (input.mimeType === 'image/jpeg' && !startsWithBytes(input.bytes, [0xff, 0xd8, 0xff])) {
    throw new Error('lms_file_content_type_mismatch');
  }
  if (input.mimeType === 'text/plain' && Buffer.from(input.bytes).includes(0x00)) {
    throw new Error('lms_file_content_type_mismatch');
  }
}

export function sha256HexForBytes(bytes: Uint8Array): string {
  return sha256Hex(bytes);
}

export function normalizeLmsFileUpload(input: { fileName: string; mimeType: string; bytes: Uint8Array }): NormalizedLmsFile {
  const fileName = sanitizeFileName(input.fileName);
  const mimeType = input.mimeType.trim().toLowerCase();
  if (!isAllowedMime(mimeType)) throw new Error('lms_file_mime_not_allowed');
  if (input.bytes.byteLength <= 0) throw new Error('lms_file_empty');
  if (input.bytes.byteLength > LMS_MAX_FILE_BYTES) throw new Error('lms_file_too_large');
  assertFileBytesMatchMime({ mimeType, bytes: input.bytes });
  return {
    fileName,
    mimeType,
    sizeBytes: input.bytes.byteLength,
    contentSha256: sha256Hex(input.bytes),
    fileBytesBase64: Buffer.from(input.bytes).toString('base64'),
  };
}

export function scanLmsFileBytes(input: { fileName: string; mimeType: string; bytes: Uint8Array }): {
  status: 'clean' | 'quarantined';
  reason: string | null;
} {
  const ascii = Buffer.from(input.bytes).toString('latin1');
  if (ascii.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) {
    return { status: 'quarantined', reason: 'eicar_test_signature' };
  }
  if (input.mimeType === 'text/plain' && /^\s*MZ/.test(ascii)) {
    return { status: 'quarantined', reason: 'executable_signature_in_text_file' };
  }
  return { status: 'clean', reason: null };
}

export function buildLmsStorageKey(input?: { objectId?: string }): string {
  const objectId = input?.objectId?.trim() || randomUUID();
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(objectId)) throw new Error('lms_storage_key_id_invalid');
  return `${LMS_STORAGE_KEY_PREFIX}${objectId}`;
}

export function isSupportedLmsFileStorageProvider(value: string): value is LmsFileStorageProvider {
  return (LMS_FILE_STORAGE_PROVIDERS as readonly string[]).includes(value);
}

export function isLmsMaterialStorageKey(value: string): boolean {
  return value.startsWith(LMS_STORAGE_KEY_PREFIX) && !value.includes('\\') && !value.split('/').includes('..');
}

export function isOpaqueLmsMaterialStorageKey(value: string): boolean {
  return new RegExp(`^${LMS_STORAGE_KEY_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[A-Za-z0-9_-]{16,80}$`).test(value);
}

export function prepareLmsFileMaterial(input: {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  now?: number;
  retentionDays?: number;
}): PreparedLmsFileMaterial {
  const normalized = normalizeLmsFileUpload(input);
  const nowMs = input.now ?? Date.now();
  const retentionDays = input.retentionDays ?? LMS_DEFAULT_FILE_RETENTION_DAYS;
  const scan = scanLmsFileBytes({ fileName: normalized.fileName, mimeType: normalized.mimeType, bytes: input.bytes });
  return {
    ...normalized,
    storageProvider: LMS_LOCAL_STORAGE_PROVIDER,
    storageKey: buildLmsStorageKey(),
    scanStatus: scan.status,
    scanCheckedAt: new Date(nowMs),
    quarantineReason: scan.reason,
    retainedUntil: new Date(nowMs + retentionDays * 24 * 60 * 60 * 1000),
  };
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function parseAttrs(raw: string): Map<string, string> | null {
  const attrs = new Map<string, string>();
  const attrRe = /([A-Za-z][A-Za-z0-9:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let consumed = '';
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(raw)) !== null) {
    consumed += match[0];
    const name = match[1]!.toLowerCase();
    if (!ALLOWED_IFRAME_ATTRS.has(name)) return null;
    if (attrs.has(name)) return null;
    attrs.set(name, match[2] ?? match[3] ?? '');
  }
  const leftover = raw.replace(attrRe, '').replace(/\s+/g, '');
  if (leftover.length > 0) return null;
  if (!consumed) return null;
  return attrs;
}

function assertAllowedEmbedUrl(rawSrc: string): string {
  let url: URL;
  try {
    url = new URL(rawSrc);
  } catch {
    throw new Error('lms_embed_src_invalid');
  }
  if (url.protocol !== 'https:') throw new Error('lms_embed_src_not_https');
  if (url.username || url.password) throw new Error('lms_embed_src_credentials');
  const allowed = ALLOWED_EMBED_HOSTS.some((rule) => url.hostname === rule.host && url.pathname.startsWith(rule.pathPrefix));
  if (!allowed) throw new Error('lms_embed_src_not_allowed');
  return url.toString();
}

function normalizeAllow(raw: string | undefined): string {
  if (!raw) return DEFAULT_ALLOW;
  const features = raw
    .split(';')
    .map((feature) => feature.trim().toLowerCase())
    .filter((feature) => feature && ALLOWED_ALLOW_FEATURES.has(feature));
  return [...new Set(features)].join('; ') || DEFAULT_ALLOW;
}

export function sanitizeLmsEmbedHtml(rawHtml: string): LmsIframeEmbed {
  const source = rawHtml.trim();
  if (!source) throw new Error('lms_embed_empty');
  if (source.length > 5_000) throw new Error('lms_embed_too_large');
  if (/<\s*script\b/i.test(source) || /\son[a-z]+\s*=/i.test(source) || /\ssrcdoc\s*=/i.test(source)) {
    throw new Error('lms_embed_unsafe_html');
  }
  const match = source.match(/^<iframe\s+([^>]*)>\s*<\/iframe>$/i);
  if (!match) throw new Error('lms_embed_iframe_required');
  const attrs = parseAttrs(match[1]!);
  if (!attrs) throw new Error('lms_embed_attr_not_allowed');
  const src = assertAllowedEmbedUrl(attrs.get('src') ?? '');
  const title = (attrs.get('title')?.trim() || 'Embedded lesson content').slice(0, 120);
  const allow = normalizeAllow(attrs.get('allow'));
  const loading = attrs.get('loading') === undefined || attrs.get('loading') === 'lazy' ? 'lazy' : null;
  if (!loading) throw new Error('lms_embed_loading_not_allowed');
  const referrerPolicy = attrs.get('referrerpolicy') === undefined || attrs.get('referrerpolicy') === 'no-referrer' ? 'no-referrer' : null;
  if (!referrerPolicy) throw new Error('lms_embed_referrer_policy_not_allowed');
  const html = `<iframe src="${escapeAttr(src)}" title="${escapeAttr(title)}" loading="lazy" referrerpolicy="no-referrer" allow="${escapeAttr(allow)}" allowfullscreen="true"></iframe>`;
  return { html, src, title, allow, allowFullscreen: true, loading: 'lazy', referrerPolicy: 'no-referrer' };
}

export function parseSanitizedLmsIframe(html: string | null | undefined): LmsIframeEmbed | null {
  if (!html) return null;
  try {
    return sanitizeLmsEmbedHtml(html);
  } catch {
    return null;
  }
}

export function isSanitizedLmsEmbedHtml(html: string | null | undefined): html is string {
  if (!html) return false;
  const parsed = parseSanitizedLmsIframe(html);
  return !!parsed && parsed.html === html.trim();
}
