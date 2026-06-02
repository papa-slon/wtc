import { describe, expect, it, vi } from 'vitest';
import {
  buildLmsExternalScannerRequest,
  parseLmsExternalScannerResponse,
  readLmsExternalScannerConfig,
  scanLmsFileWithExternalScanner,
} from './external-scanner.ts';

const env = {
  LMS_FILE_SCANNER_ENDPOINT: 'https://scanner.test.local/scan',
  LMS_FILE_SCANNER_TOKEN: 'scanner-local-token-value',
  LMS_FILE_SCANNER_TIMEOUT_MS: '2500',
};

describe('LMS external scanner primitives', () => {
  it('validates scanner config fail-closed without leaking the token', () => {
    expect(readLmsExternalScannerConfig(env).endpoint.toString()).toBe('https://scanner.test.local/scan');
    expect(readLmsExternalScannerConfig(env).timeoutMs).toBe(2500);
    expect(() => readLmsExternalScannerConfig({ ...env, LMS_FILE_SCANNER_ENDPOINT: 'http://scanner.test.local/scan' })).toThrow(/lms_file_scanner_config_required/);
    try {
      readLmsExternalScannerConfig({ ...env, LMS_FILE_SCANNER_ENDPOINT: '' });
      throw new Error('unexpected pass');
    } catch (error) {
      expect(String(error)).not.toContain(env.LMS_FILE_SCANNER_TOKEN);
    }
  });

  it('builds the exact scanner request envelope without filename or hash metadata', () => {
    const config = readLmsExternalScannerConfig(env);
    const request = buildLmsExternalScannerRequest({
      config,
      mimeType: 'text/plain',
      sizeBytes: 4,
      bytes: new TextEncoder().encode('PLAN'),
    });
    expect(request.url.toString()).toBe('https://scanner.test.local/scan');
    expect(request.headers).toEqual({
      authorization: 'Bearer scanner-local-token-value',
      'content-type': 'application/octet-stream',
      'x-wtc-lms-mime-type': 'text/plain',
      'x-wtc-lms-size-bytes': '4',
    });
    const envelope = `${JSON.stringify(request.headers)}\n${Buffer.from(request.body).toString('utf8')}`;
    expect(envelope).not.toContain('plan.txt');
    expect(envelope).not.toMatch(/[a-f0-9]{64}/);
  });

  it('parses scanner responses into clean or normalized quarantine results', () => {
    expect(parseLmsExternalScannerResponse({ status: 'clean' })).toEqual({ status: 'clean', reason: null });
    expect(parseLmsExternalScannerResponse({ status: 'quarantined', reason: 'Vendor Found EICAR signature!!!' })).toEqual({
      status: 'quarantined',
      reason: 'vendor_found_eicar_signature',
    });
    expect(() => parseLmsExternalScannerResponse({ status: 'failed', detail: 'vendor detail' })).toThrow(/lms_file_scan_failed/);
  });

  it('calls the scanner with an injected fetch and hides provider failures behind generic errors', async () => {
    const config = readLmsExternalScannerConfig(env);
    const fetchImpl = vi.fn(async (_input: string | URL, _init?: RequestInit) => Response.json({ status: 'clean' }));
    await expect(scanLmsFileWithExternalScanner({
      config,
      mimeType: 'text/plain',
      sizeBytes: 4,
      bytes: new TextEncoder().encode('PLAN'),
      fetchImpl,
    })).resolves.toEqual({ status: 'clean', reason: null });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as [string | URL, RequestInit?];
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer scanner-local-token-value');

    const failingFetch = vi.fn(async (_input: string | URL, _init?: RequestInit) => Response.json({ status: 'failed', detail: 'scanner exploded' }));
    await expect(scanLmsFileWithExternalScanner({
      config,
      mimeType: 'text/plain',
      sizeBytes: 4,
      bytes: new TextEncoder().encode('PLAN'),
      fetchImpl: failingFetch,
    })).rejects.toThrow(/lms_file_scan_failed/);
  });
});
