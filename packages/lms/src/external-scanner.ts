import type { LmsFileScanStatus } from './materials.ts';

export type LmsExternalScannerEnv = Record<string, string | undefined>;

export interface LmsExternalScannerConfig {
  endpoint: URL;
  token: string;
  timeoutMs: number;
}

export interface LmsExternalScannerRequest {
  url: URL;
  headers: Record<string, string>;
  body: Uint8Array;
}

export type LmsExternalScannerResult = {
  status: Extract<LmsFileScanStatus, 'clean' | 'quarantined'>;
  reason: string | null;
};

export type LmsExternalScannerFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Pick<Response, 'ok' | 'json'>>;

export function readLmsExternalScannerConfig(env: LmsExternalScannerEnv): LmsExternalScannerConfig {
  const endpointRaw = env.LMS_FILE_SCANNER_ENDPOINT?.trim();
  const token = env.LMS_FILE_SCANNER_TOKEN?.trim();
  if (!endpointRaw || !token) throw new Error('lms_file_scanner_config_required');
  let endpoint: URL;
  try {
    endpoint = new URL(endpointRaw);
  } catch {
    throw new Error('lms_file_scanner_config_required');
  }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('lms_file_scanner_config_required');
  }
  const timeoutMs = readScannerTimeoutMs(env);
  return { endpoint, token, timeoutMs };
}

function readScannerTimeoutMs(env: LmsExternalScannerEnv): number {
  const raw = env.LMS_FILE_SCANNER_TIMEOUT_MS?.trim();
  if (!raw) return 5_000;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 30_000) {
    throw new Error('lms_file_scanner_config_required');
  }
  return value;
}

export function safeLmsExternalScanReason(value: unknown): string {
  if (typeof value !== 'string') return 'external_scan_quarantined';
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
  return normalized || 'external_scan_quarantined';
}

export function parseLmsExternalScannerResponse(value: unknown): LmsExternalScannerResult {
  if (!value || typeof value !== 'object') throw new Error('lms_file_scan_failed');
  const status = (value as { status?: unknown }).status;
  if (status === 'clean') return { status: 'clean', reason: null };
  if (status === 'quarantined') {
    return { status: 'quarantined', reason: safeLmsExternalScanReason((value as { reason?: unknown }).reason) };
  }
  throw new Error('lms_file_scan_failed');
}

export function buildLmsExternalScannerRequest(input: {
  config: LmsExternalScannerConfig;
  mimeType: string;
  sizeBytes: number;
  bytes: Uint8Array;
}): LmsExternalScannerRequest {
  return {
    url: input.config.endpoint,
    headers: {
      authorization: `Bearer ${input.config.token}`,
      'content-type': 'application/octet-stream',
      'x-wtc-lms-mime-type': input.mimeType,
      'x-wtc-lms-size-bytes': String(input.sizeBytes),
    },
    body: new Uint8Array(input.bytes),
  };
}

export async function scanLmsFileWithExternalScanner(input: {
  config: LmsExternalScannerConfig;
  mimeType: string;
  sizeBytes: number;
  bytes: Uint8Array;
  fetchImpl?: LmsExternalScannerFetch;
}): Promise<LmsExternalScannerResult> {
  const request = buildLmsExternalScannerRequest(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.config.timeoutMs);
  let response: Pick<Response, 'ok' | 'json'>;
  try {
    response = await (input.fetchImpl ?? fetch)(request.url, {
      method: 'POST',
      signal: controller.signal,
      headers: request.headers,
      body: request.body as unknown as BodyInit,
    });
  } catch {
    throw new Error('lms_file_scan_failed');
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error('lms_file_scan_failed');
  try {
    return parseLmsExternalScannerResponse(await response.json());
  } catch {
    throw new Error('lms_file_scan_failed');
  }
}
