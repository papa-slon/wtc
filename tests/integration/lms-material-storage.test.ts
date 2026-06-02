import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  LMS_FILESYSTEM_STORAGE_PROVIDER,
  LMS_LOCAL_STORAGE_PROVIDER,
  LMS_OBJECT_STORAGE_PROVIDER,
} from '@wtc/lms';
import {
  compensateLmsUploadedFile,
  resolveLmsMaterialFileDelivery,
  resolveLmsMaterialFileBytes,
  storeLmsUploadedFile,
} from '../../apps/web/src/features/lms/material-storage.ts';
import type { MaterialFileDownloadRow } from '@wtc/db';

let roots: string[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots = [];
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'wtc-lfs-'));
  roots.push(root);
  return root;
}

function rowFromStored(stored: Awaited<ReturnType<typeof storeLmsUploadedFile>>): MaterialFileDownloadRow {
  return {
    materialId: '00000000-0000-4000-8000-000000000001',
    lessonId: '00000000-0000-4000-8000-000000000002',
    courseId: '00000000-0000-4000-8000-000000000003',
    label: 'Stored',
    fileName: stored.fileName,
    mimeType: stored.mimeType,
    sizeBytes: stored.sizeBytes,
    contentSha256: stored.contentSha256,
    fileBytesBase64: stored.fileBytesBase64 ?? null,
    storageProvider: stored.storageProvider,
    storageKey: stored.storageKey,
    scanStatus: stored.scanStatus,
    scanCheckedAt: stored.scanCheckedAt,
    quarantineReason: stored.quarantineReason,
    retainedUntil: stored.retainedUntil,
  };
}

function objectStorageEnv(): Record<string, string> {
  return {
    LMS_FILE_STORAGE_PROVIDER: LMS_OBJECT_STORAGE_PROVIDER,
    LMS_OBJECT_STORAGE_ENDPOINT: 'https://objects.test.local/',
    LMS_OBJECT_STORAGE_BUCKET: 'wtc-lms-test',
    LMS_OBJECT_STORAGE_REGION: 'auto',
    LMS_OBJECT_STORAGE_ACCESS_KEY_ID: 'local-access-id',
    LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY: 'object-storage-test-secret-value',
  };
}

function externalScannerEnv(): Record<string, string> {
  return {
    LMS_FILE_SCANNER_MODE: 'external',
    LMS_FILE_SCANNER_ENDPOINT: 'https://scanner.test.local/scan',
    LMS_FILE_SCANNER_TOKEN: 'scanner-local-token-value',
  };
}

describe('LMS material storage boundary', () => {
  it('keeps db-local as the default and stores bytes in the DB payload shape', async () => {
    const stored = await storeLmsUploadedFile({
      fileName: 'plan.txt',
      mimeType: 'text/plain',
      bytes: new TextEncoder().encode('PLAN'),
      now: 1_900_000_000_000,
      env: {},
    });
    expect(stored.storageProvider).toBe(LMS_LOCAL_STORAGE_PROVIDER);
    expect(stored.fileBytesBase64).toBe('UExBTg==');
    await expect(resolveLmsMaterialFileBytes(rowFromStored(stored), {})).resolves.toEqual(Buffer.from('PLAN'));
  });

  it('generates opaque non-deterministic keys for identical local uploads', async () => {
    const bytes = new TextEncoder().encode('PLAN');
    const first = await storeLmsUploadedFile({
      fileName: 'plan.txt',
      mimeType: 'text/plain',
      bytes,
      now: 1_900_000_000_000,
      env: {},
    });
    const second = await storeLmsUploadedFile({
      fileName: 'plan.txt',
      mimeType: 'text/plain',
      bytes,
      now: 1_900_000_000_000,
      env: {},
    });

    for (const stored of [first, second]) {
      expect(stored.storageKey).toMatch(/^lms\/materials\/[A-Za-z0-9_-]{16,80}$/);
      expect(stored.storageKey.split('/')).toHaveLength(3);
      expect(stored.storageKey).not.toContain('plan');
      expect(stored.storageKey).not.toContain(stored.contentSha256);
    }
    expect(first.contentSha256).toBe(second.contentSha256);
    expect(first.storageKey).not.toBe(second.storageKey);
  });

  it('supports fs-local object-style storage without persisting DB bytes', async () => {
    const root = await tempRoot();
    const stored = await storeLmsUploadedFile({
      fileName: 'plan.txt',
      mimeType: 'text/plain',
      bytes: new TextEncoder().encode('PLAN'),
      now: 1_900_000_000_000,
      env: { LMS_FILE_STORAGE_PROVIDER: LMS_FILESYSTEM_STORAGE_PROVIDER, LMS_FILE_STORAGE_ROOT: root },
    });
    expect(stored.storageProvider).toBe(LMS_FILESYSTEM_STORAGE_PROVIDER);
    expect(stored.fileBytesBase64).toBeUndefined();
    expect(stored.storageKey).toMatch(/^lms\/materials\/[A-Za-z0-9_-]{16,80}$/);
    expect(stored.storageKey.split('/')).toHaveLength(3);
    expect(stored.storageKey).not.toContain('plan');
    expect(stored.storageKey).not.toContain(stored.contentSha256);
    expect(existsSync(join(root, ...stored.storageKey.split('/')))).toBe(true);
    await expect(resolveLmsMaterialFileBytes(rowFromStored(stored), { LMS_FILE_STORAGE_ROOT: root })).resolves.toEqual(Buffer.from('PLAN'));
  });

  it('stores s3-r2 objects with opaque keys and no inline DB bytes', async () => {
    const fetchCalls: Array<[unknown, RequestInit | undefined]> = [];
    const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
      fetchCalls.push([url, init]);
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const env = objectStorageEnv();
    const stored = await storeLmsUploadedFile({
      fileName: 'plan.txt',
      mimeType: 'text/plain',
      bytes: new TextEncoder().encode('PLAN'),
      now: 1_900_000_000_000,
      env,
    });

    expect(stored.storageProvider).toBe(LMS_OBJECT_STORAGE_PROVIDER);
    expect(stored.fileBytesBase64).toBeUndefined();
    expect(stored.storageKey).toMatch(/^lms\/materials\/[A-Za-z0-9_-]{16,80}$/);
    expect(stored.storageKey).not.toContain('plan');
    expect(stored.storageKey).not.toContain(stored.contentSha256);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchCalls[0]!;
    const requestUrl = new URL(String(url));
    expect(requestUrl.origin).toBe('https://objects.test.local');
    expect(requestUrl.pathname).toBe(`/wtc-lms-test/${stored.storageKey}`);
    expect(requestUrl.toString()).not.toContain('plan');
    expect(requestUrl.toString()).not.toContain(stored.contentSha256);
    expect(init?.method).toBe('PUT');
    const headers = init?.headers as Record<string, string>;
    expect(headers.authorization).toContain('AWS4-HMAC-SHA256');
    expect(headers.authorization).not.toContain('object-storage-test-secret-value');
    expect(headers['content-type']).toBe('text/plain');
    expect(headers['x-amz-content-sha256']).toBe(stored.contentSha256);
    expect(Buffer.from(init?.body as Uint8Array).toString('utf8')).toBe('PLAN');

    const delivery = await resolveLmsMaterialFileDelivery(rowFromStored(stored), env, {
      now: 1_900_000_000_000,
      contentDisposition: 'attachment; filename="lesson-material.txt"',
    });
    expect(delivery.kind).toBe('redirect');
    if (delivery.kind === 'redirect') {
      const redirectUrl = new URL(delivery.url);
      expect(redirectUrl.origin).toBe('https://objects.test.local');
      expect(redirectUrl.pathname).toBe(`/wtc-lms-test/${stored.storageKey}`);
      expect(redirectUrl.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
      expect(redirectUrl.searchParams.get('X-Amz-Signature')).toMatch(/^[a-f0-9]{64}$/);
      expect(redirectUrl.searchParams.get('X-Amz-Expires')).toBe('60');
      expect(redirectUrl.searchParams.get('response-content-disposition')).toBe('attachment; filename="lesson-material.txt"');
      expect(delivery.url).not.toContain('plan.txt');
      expect(delivery.url).not.toContain(stored.contentSha256);
      expect(delivery.url).not.toContain('object-storage-test-secret-value');
    }
    await expect(resolveLmsMaterialFileBytes(rowFromStored(stored), env)).rejects.toThrow(/lms_storage_provider_unsupported/);
  });

  it('runs the durable cleanup registration hook before clean s3-r2 object PUT', async () => {
    const events: string[] = [];
    const fetchMock = vi.fn(async () => {
      events.push('put');
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const env = objectStorageEnv();
    const stored = await storeLmsUploadedFile({
      fileName: 'plan.txt',
      mimeType: 'text/plain',
      bytes: new TextEncoder().encode('PLAN'),
      now: 1_900_000_000_000,
      env,
      beforeObjectPut: async ({ storageKey, scanStatus }) => {
        expect(fetchMock).not.toHaveBeenCalled();
        expect(scanStatus).toBe('clean');
        expect(storageKey).toMatch(/^lms\/materials\/[A-Za-z0-9_-]{16,80}$/);
        events.push('pending');
      },
    });

    expect(stored.scanStatus).toBe('clean');
    expect(events).toEqual(['pending', 'put']);
  });

  it('fails closed without object PUT when durable cleanup registration fails', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(storeLmsUploadedFile({
      fileName: 'plan.txt',
      mimeType: 'text/plain',
      bytes: new TextEncoder().encode('PLAN'),
      now: 1_900_000_000_000,
      env: objectStorageEnv(),
      beforeObjectPut: async () => {
        throw new Error('pending cleanup unavailable');
      },
    })).rejects.toThrow(/pending cleanup unavailable/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('runs the external scanner before object storage without sending filenames or hashes', async () => {
    const fetchCalls: Array<[unknown, RequestInit | undefined]> = [];
    const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
      fetchCalls.push([url, init]);
      const host = new URL(String(url)).hostname;
      if (host === 'scanner.test.local') return Response.json({ status: 'clean' });
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const env = { ...objectStorageEnv(), ...externalScannerEnv() };
    const stored = await storeLmsUploadedFile({
      fileName: 'plan.txt',
      mimeType: 'text/plain',
      bytes: new TextEncoder().encode('PLAN'),
      now: 1_900_000_000_000,
      env,
    });

    expect(stored.scanStatus).toBe('clean');
    expect(stored.quarantineReason).toBeNull();
    expect(fetchCalls).toHaveLength(2);
    const [scannerUrl, scannerInit] = fetchCalls[0]!;
    expect(String(scannerUrl)).toBe('https://scanner.test.local/scan');
    expect(scannerInit?.method).toBe('POST');
    const scannerHeaders = scannerInit?.headers as Record<string, string>;
    expect(scannerHeaders.authorization).toBe('Bearer scanner-local-token-value');
    expect(scannerHeaders['content-type']).toBe('application/octet-stream');
    expect(scannerHeaders['x-wtc-lms-mime-type']).toBe('text/plain');
    expect(scannerHeaders['x-wtc-lms-size-bytes']).toBe('4');
    const scannerEnvelope = `${String(scannerUrl)}\n${JSON.stringify(scannerHeaders)}`;
    expect(scannerEnvelope).not.toContain('plan.txt');
    expect(scannerEnvelope).not.toContain(stored.contentSha256);
    expect(Buffer.from(scannerInit?.body as Uint8Array).toString('utf8')).toBe('PLAN');

    const [objectUrl] = fetchCalls[1]!;
    expect(new URL(String(objectUrl)).hostname).toBe('objects.test.local');
  });

  it('persists external scanner quarantine status with a normalized reason', async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      const host = new URL(String(url)).hostname;
      if (host === 'scanner.test.local') return Response.json({ status: 'quarantined', reason: 'Vendor Found EICAR signature!!!' });
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const stored = await storeLmsUploadedFile({
      fileName: 'eicar.txt',
      mimeType: 'text/plain',
      bytes: new TextEncoder().encode('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'),
      now: 1_900_000_000_000,
      env: { ...objectStorageEnv(), ...externalScannerEnv() },
    });

    expect(stored.storageProvider).toBe(LMS_OBJECT_STORAGE_PROVIDER);
    expect(stored.scanStatus).toBe('quarantined');
    expect(stored.quarantineReason).toBe('vendor_found_eicar_signature');
    expect(stored.fileBytesBase64).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('compensates clean s3-r2 uploads with a signed delete and treats missing objects as reconciled', async () => {
    const fetchCalls: Array<[unknown, RequestInit | undefined]> = [];
    const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
      fetchCalls.push([url, init]);
      if (init?.method === 'DELETE') return new Response(null, { status: 404 });
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const env = objectStorageEnv();
    const stored = await storeLmsUploadedFile({
      fileName: 'plan.txt',
      mimeType: 'text/plain',
      bytes: new TextEncoder().encode('PLAN'),
      now: 1_900_000_000_000,
      env,
    });

    await expect(compensateLmsUploadedFile({ material: stored, now: 1_900_000_060_000, env })).resolves.toBe(true);
    expect(fetchCalls).toHaveLength(2);
    const [deleteUrl, deleteInit] = fetchCalls[1]!;
    expect(new URL(String(deleteUrl)).pathname).toBe(`/wtc-lms-test/${stored.storageKey}`);
    expect(deleteInit?.method).toBe('DELETE');
    const headers = deleteInit?.headers as Record<string, string>;
    expect(headers.authorization).toContain('AWS4-HMAC-SHA256');
    expect(headers.authorization).not.toContain('object-storage-test-secret-value');
    expect(String(deleteUrl)).not.toContain('plan.txt');
    expect(String(deleteUrl)).not.toContain(stored.contentSha256);
  });

  it('does not compensate quarantined metadata-only s3-r2 rows', async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      const host = new URL(String(url)).hostname;
      if (host === 'scanner.test.local') return Response.json({ status: 'quarantined', reason: 'bad' });
      return new Response(null, { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const stored = await storeLmsUploadedFile({
      fileName: 'eicar.txt',
      mimeType: 'text/plain',
      bytes: new TextEncoder().encode('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'),
      now: 1_900_000_000_000,
      env: { ...objectStorageEnv(), ...externalScannerEnv() },
    });

    await expect(compensateLmsUploadedFile({ material: stored, now: 1_900_000_060_000, env: objectStorageEnv() })).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails closed before object writes when the external scanner is unavailable or malformed', async () => {
    const unavailableFetch = vi.fn(async () => new Response(null, { status: 503 }));
    vi.stubGlobal('fetch', unavailableFetch);
    await expect(storeLmsUploadedFile({
      fileName: 'plan.txt',
      mimeType: 'text/plain',
      bytes: new TextEncoder().encode('PLAN'),
      now: 1_900_000_000_000,
      env: { ...objectStorageEnv(), ...externalScannerEnv() },
    })).rejects.toThrow(/lms_file_scan_failed/);
    expect(unavailableFetch).toHaveBeenCalledTimes(1);

    const malformedFetch = vi.fn(async () => Response.json({ status: 'failed', detail: 'scanner exploded with internals' }));
    vi.stubGlobal('fetch', malformedFetch);
    await expect(storeLmsUploadedFile({
      fileName: 'plan.txt',
      mimeType: 'text/plain',
      bytes: new TextEncoder().encode('PLAN'),
      now: 1_900_000_000_000,
      env: { ...objectStorageEnv(), ...externalScannerEnv() },
    })).rejects.toThrow(/lms_file_scan_failed/);
    expect(malformedFetch).toHaveBeenCalledTimes(1);

    const hangingFetch = vi.fn((_: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal as AbortSignal | undefined;
      signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    vi.stubGlobal('fetch', hangingFetch);
    await expect(storeLmsUploadedFile({
      fileName: 'plan.txt',
      mimeType: 'text/plain',
      bytes: new TextEncoder().encode('PLAN'),
      now: 1_900_000_000_000,
      env: { ...objectStorageEnv(), ...externalScannerEnv(), LMS_FILE_SCANNER_TIMEOUT_MS: '1' },
    })).rejects.toThrow(/lms_file_scan_failed/);
    expect(hangingFetch).toHaveBeenCalledTimes(1);
  });

  it('fails closed when s3-r2 config or upload writes are unavailable', async () => {
    await expect(storeLmsUploadedFile({
      fileName: 'plan.txt',
      mimeType: 'text/plain',
      bytes: new TextEncoder().encode('PLAN'),
      now: 1_900_000_000_000,
      env: { LMS_FILE_STORAGE_PROVIDER: LMS_OBJECT_STORAGE_PROVIDER },
    })).rejects.toThrow(/lms_object_storage_config_required/);

    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 503 })));
    await expect(storeLmsUploadedFile({
      fileName: 'plan.txt',
      mimeType: 'text/plain',
      bytes: new TextEncoder().encode('PLAN'),
      now: 1_900_000_000_000,
      env: objectStorageEnv(),
    })).rejects.toThrow(/lms_object_storage_write_failed/);
  });

  it('rejects local upload storage providers in staging or production runtime', async () => {
    await expect(storeLmsUploadedFile({
      fileName: 'plan.txt',
      mimeType: 'text/plain',
      bytes: new TextEncoder().encode('PLAN'),
      now: 1_900_000_000_000,
      env: { APP_ENV: 'staging' },
    })).rejects.toThrow(/lms_storage_provider_not_production_ready/);

    await expect(storeLmsUploadedFile({
      fileName: 'plan.txt',
      mimeType: 'text/plain',
      bytes: new TextEncoder().encode('PLAN'),
      now: 1_900_000_000_000,
      env: { APP_ENV: 'production', LMS_FILE_STORAGE_PROVIDER: LMS_FILESYSTEM_STORAGE_PROVIDER, LMS_FILE_STORAGE_ROOT: await tempRoot() },
    })).rejects.toThrow(/lms_storage_provider_not_production_ready/);
  });

  it('fails closed for unsupported providers and invalid storage keys', async () => {
    const local = await storeLmsUploadedFile({
      fileName: 'plan.txt',
      mimeType: 'text/plain',
      bytes: new TextEncoder().encode('PLAN'),
      now: 1_900_000_000_000,
      env: {},
    });
    await expect(storeLmsUploadedFile({
      fileName: 'plan.txt',
      mimeType: 'text/plain',
      bytes: new TextEncoder().encode('PLAN'),
      now: 1_900_000_000_000,
      env: { LMS_FILE_STORAGE_PROVIDER: 's3' },
    })).rejects.toThrow(/lms_storage_provider_unsupported/);
    await expect(resolveLmsMaterialFileBytes({ ...rowFromStored(local), storageProvider: 's3' }, {})).rejects.toThrow(/lms_storage_provider_unsupported/);
    await expect(resolveLmsMaterialFileBytes({ ...rowFromStored(local), storageProvider: LMS_FILESYSTEM_STORAGE_PROVIDER, storageKey: '../plan.txt' }, { LMS_FILE_STORAGE_ROOT: await tempRoot() })).rejects.toThrow(/lms_storage_key_invalid/);
  });
});
