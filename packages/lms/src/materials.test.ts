import { describe, expect, it } from 'vitest';
import {
  LMS_MAX_FILE_BYTES,
  LMS_OBJECT_STORAGE_PROVIDER,
  buildLmsStorageKey,
  isLmsMaterialStorageKey,
  isOpaqueLmsMaterialStorageKey,
  isSupportedLmsFileStorageProvider,
  isSanitizedLmsEmbedHtml,
  normalizeLmsFileUpload,
  parseSanitizedLmsIframe,
  prepareLmsFileMaterial,
  sanitizeLmsEmbedHtml,
  scanLmsFileBytes,
} from './materials.ts';

describe('@wtc/lms material file policy', () => {
  it('normalizes safe file uploads with sha256 and base64 bytes', () => {
    const normalized = normalizeLmsFileUpload({
      fileName: '../lesson notes?.pdf',
      mimeType: 'application/pdf',
      bytes: new TextEncoder().encode('%PDF-1.7 lesson bytes'),
    });
    expect(normalized.fileName).toBe('..-lesson notes-.pdf');
    expect(normalized.mimeType).toBe('application/pdf');
    expect(normalized.sizeBytes).toBe(21);
    expect(normalized.contentSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects empty, oversize, and unsupported files', () => {
    expect(() => normalizeLmsFileUpload({ fileName: 'a.pdf', mimeType: 'application/pdf', bytes: new Uint8Array() })).toThrow('lms_file_empty');
    expect(() => normalizeLmsFileUpload({ fileName: 'a.exe', mimeType: 'application/x-msdownload', bytes: new Uint8Array([1]) })).toThrow('lms_file_mime_not_allowed');
    expect(() => normalizeLmsFileUpload({ fileName: 'a.txt', mimeType: 'text/plain', bytes: new Uint8Array(LMS_MAX_FILE_BYTES + 1) })).toThrow('lms_file_too_large');
  });

  it('rejects files whose bytes do not match the declared binary MIME type', () => {
    expect(() => normalizeLmsFileUpload({ fileName: 'fake.pdf', mimeType: 'application/pdf', bytes: new TextEncoder().encode('not a pdf') })).toThrow('lms_file_content_type_mismatch');
    expect(() => normalizeLmsFileUpload({ fileName: 'fake.png', mimeType: 'image/png', bytes: new Uint8Array([1, 2, 3]) })).toThrow('lms_file_content_type_mismatch');
    expect(() => normalizeLmsFileUpload({ fileName: 'fake.jpg', mimeType: 'image/jpeg', bytes: new Uint8Array([1, 2, 3]) })).toThrow('lms_file_content_type_mismatch');
  });

  it('prepares clean file storage metadata and retention timestamps', () => {
    const now = 1_900_000_000_000;
    const prepared = prepareLmsFileMaterial({ fileName: 'notes.txt', mimeType: 'text/plain', bytes: new TextEncoder().encode('notes'), now });
    expect(prepared.storageProvider).toBe('db-local');
    expect(prepared.storageKey).toMatch(/^lms\/materials\/[A-Za-z0-9_-]{16,80}$/);
    expect(prepared.storageKey).not.toContain(prepared.contentSha256);
    expect(prepared.storageKey).not.toContain('notes');
    expect(prepared.scanStatus).toBe('clean');
    expect(prepared.quarantineReason).toBeNull();
    expect(prepared.scanCheckedAt.getTime()).toBe(now);
    expect(prepared.retainedUntil.getTime()).toBe(now + 365 * 24 * 60 * 60 * 1000);
  });

  it('validates supported providers and local material storage keys', () => {
    expect(isSupportedLmsFileStorageProvider('db-local')).toBe(true);
    expect(isSupportedLmsFileStorageProvider('fs-local')).toBe(true);
    expect(isSupportedLmsFileStorageProvider(LMS_OBJECT_STORAGE_PROVIDER)).toBe(true);
    expect(isSupportedLmsFileStorageProvider('s3')).toBe(false);
    expect(buildLmsStorageKey({ objectId: 'opaque-test-key-01' })).toBe('lms/materials/opaque-test-key-01');
    expect(isLmsMaterialStorageKey('lms/materials/ab/hash/name')).toBe(true);
    expect(isLmsMaterialStorageKey('../lms/materials/hash')).toBe(false);
    expect(isLmsMaterialStorageKey('lms/materials/../hash')).toBe(false);
    expect(isLmsMaterialStorageKey('objects/hash')).toBe(false);
    expect(isOpaqueLmsMaterialStorageKey('lms/materials/opaque-test-key-01')).toBe(true);
    expect(isOpaqueLmsMaterialStorageKey('lms/materials/ab/hash/name')).toBe(false);
    expect(isOpaqueLmsMaterialStorageKey('lms/materials/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(true);
    expect(isOpaqueLmsMaterialStorageKey('lms/materials/short')).toBe(false);
  });

  it('quarantines EICAR fixtures and executable-looking text uploads', () => {
    const eicar = new TextEncoder().encode('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
    expect(scanLmsFileBytes({ fileName: 'eicar.txt', mimeType: 'text/plain', bytes: eicar })).toEqual({ status: 'quarantined', reason: 'eicar_test_signature' });
    expect(prepareLmsFileMaterial({ fileName: 'eicar.txt', mimeType: 'text/plain', bytes: eicar, now: 1 }).scanStatus).toBe('quarantined');
    expect(scanLmsFileBytes({ fileName: 'fake.txt', mimeType: 'text/plain', bytes: new TextEncoder().encode('MZ fake executable') })).toEqual({ status: 'quarantined', reason: 'executable_signature_in_text_file' });
  });
});

describe('@wtc/lms embed sanitizer', () => {
  it('stores canonical sanitized iframe HTML for allowed providers', () => {
    const out = sanitizeLmsEmbedHtml('<iframe title="Intro" src="https://www.youtube.com/embed/abc123" allow="autoplay; encrypted-media; payment" loading="lazy"></iframe>');
    expect(out.html).toBe('<iframe src="https://www.youtube.com/embed/abc123" title="Intro" loading="lazy" referrerpolicy="no-referrer" allow="autoplay; encrypted-media" allowfullscreen="true"></iframe>');
    expect(isSanitizedLmsEmbedHtml(out.html)).toBe(true);
    expect(parseSanitizedLmsIframe(out.html)?.src).toBe('https://www.youtube.com/embed/abc123');
  });

  it('rejects scripts, event handlers, srcdoc, non-https, and unapproved hosts', () => {
    expect(() => sanitizeLmsEmbedHtml('<script>alert(1)</script>')).toThrow('lms_embed_unsafe_html');
    expect(() => sanitizeLmsEmbedHtml('<iframe src="https://www.youtube.com/embed/x" onload="alert(1)"></iframe>')).toThrow('lms_embed_unsafe_html');
    expect(() => sanitizeLmsEmbedHtml('<iframe srcdoc="<p>x</p>" src="https://www.youtube.com/embed/x"></iframe>')).toThrow('lms_embed_unsafe_html');
    expect(() => sanitizeLmsEmbedHtml('<iframe src="http://www.youtube.com/embed/x"></iframe>')).toThrow('lms_embed_src_not_https');
    expect(() => sanitizeLmsEmbedHtml('<iframe src="https://evil.example/embed/x"></iframe>')).toThrow('lms_embed_src_not_allowed');
  });
});
