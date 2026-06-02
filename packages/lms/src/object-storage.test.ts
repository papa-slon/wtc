import { describe, expect, it } from 'vitest';
import {
  buildLmsObjectDeleteRequest,
  buildLmsObjectPutRequest,
  buildLmsObjectReadUrl,
  buildLmsObjectStorageUrl,
  readLmsObjectStorageConfig,
} from './object-storage.ts';

const env = {
  LMS_OBJECT_STORAGE_ENDPOINT: 'https://objects.test.local/',
  LMS_OBJECT_STORAGE_BUCKET: 'wtc-lms-test',
  LMS_OBJECT_STORAGE_REGION: 'auto',
  LMS_OBJECT_STORAGE_ACCESS_KEY_ID: 'local-access-id',
  LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY: 'object-storage-test-secret-value',
};

describe('LMS shared object-storage primitives', () => {
  it('validates object-store config fail-closed', () => {
    expect(() => readLmsObjectStorageConfig(env)).not.toThrow();
    expect(() => readLmsObjectStorageConfig({ ...env, LMS_OBJECT_STORAGE_ENDPOINT: 'http://objects.test.local/' })).toThrow(/lms_object_storage_config_required/);
    expect(() => readLmsObjectStorageConfig({ ...env, LMS_OBJECT_STORAGE_ENDPOINT: 'https://objects.test.local/path' })).toThrow(/lms_object_storage_config_required/);
    expect(() => readLmsObjectStorageConfig({ ...env, LMS_OBJECT_STORAGE_BUCKET: 'x' })).toThrow(/lms_object_storage_config_required/);
  });

  it('builds signed put and delete requests without exposing the secret', () => {
    const config = readLmsObjectStorageConfig(env);
    const storageKey = 'lms/materials/sharedobjectkey0001';
    const put = buildLmsObjectPutRequest({
      config,
      storageKey,
      mimeType: 'text/plain',
      bytes: new TextEncoder().encode('PLAN'),
      now: 1_900_000_000_000,
    });
    const del = buildLmsObjectDeleteRequest({ config, storageKey, now: 1_900_000_060_000 });

    expect(put.url.toString()).toBe(`https://objects.test.local/wtc-lms-test/${storageKey}`);
    expect(put.headers.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=local-access-id/20300317/auto/s3/aws4_request, ' +
        'SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, ' +
        'Signature=b165dd8ae268643a18271a293915c69ece7509222926c58f881859be1d617e1e',
    );
    expect(put.headers.authorization).not.toContain(env.LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY);
    expect(put.headers['content-type']).toBe('text/plain');
    expect(put.headers['x-amz-content-sha256']).toBe('0ff15403106fefdaa7a0816f2c17f1fd4e4e1c065feb6194a07df811dc03d188');
    expect(put.headers['x-amz-date']).toBe('20300317T174640Z');

    expect(del.url.toString()).toBe(`https://objects.test.local/wtc-lms-test/${storageKey}`);
    expect(del.headers.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=local-access-id/20300317/auto/s3/aws4_request, ' +
        'SignedHeaders=host;x-amz-content-sha256;x-amz-date, ' +
        'Signature=fcb12a01d234083277438187d2ba5efb59feed657ce7b265c1c3a694050ba961',
    );
    expect(del.headers.authorization).not.toContain(env.LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY);
    expect(del.headers['x-amz-content-sha256']).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(del.headers['x-amz-date']).toBe('20300317T174740Z');
  });

  it('builds signed read URLs with bounded expiry and no secret material', () => {
    const config = readLmsObjectStorageConfig(env);
    const storageKey = 'lms/materials/sharedreadobject001';
    const signedUrl = buildLmsObjectReadUrl({
      config,
      storageKey,
      mimeType: 'text/plain',
      contentDisposition: 'attachment; filename="lesson-material.txt"',
      now: 1_900_000_000_000,
      expiresSeconds: 999,
    });
    const url = new URL(signedUrl);

    expect(url.origin).toBe('https://objects.test.local');
    expect(url.pathname).toBe(`/wtc-lms-test/${storageKey}`);
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Date')).toBe('20300317T174640Z');
    expect(url.searchParams.get('X-Amz-Signature')).toBe('d9c269f58b8c7661f1518b02379649c9977da1ace69197f08fe03812122d1f0e');
    expect(url.searchParams.get('response-content-disposition')).toBe('attachment; filename="lesson-material.txt"');
    expect(signedUrl).toBe(
      'https://objects.test.local/wtc-lms-test/lms/materials/sharedreadobject001?' +
        'response-content-disposition=attachment%3B%20filename%3D%22lesson-material.txt%22&' +
        'response-content-type=text%2Fplain&X-Amz-Algorithm=AWS4-HMAC-SHA256&' +
        'X-Amz-Credential=local-access-id%2F20300317%2Fauto%2Fs3%2Faws4_request&' +
        'X-Amz-Date=20300317T174640Z&X-Amz-Expires=300&' +
        'X-Amz-Signature=d9c269f58b8c7661f1518b02379649c9977da1ace69197f08fe03812122d1f0e&' +
        'X-Amz-SignedHeaders=host',
    );
    expect(signedUrl).not.toContain(env.LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY);
  });

  it('rejects non-opaque object keys before request construction', () => {
    const config = readLmsObjectStorageConfig(env);
    expect(() => buildLmsObjectStorageUrl(config, 'lms/materials/short')).toThrow(/lms_storage_key_invalid/);
    expect(() => buildLmsObjectDeleteRequest({ config, storageKey: '../secret', now: 1_900_000_000_000 })).toThrow(/lms_storage_key_invalid/);
  });
});
