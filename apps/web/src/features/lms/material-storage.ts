import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import {
  buildLmsObjectDeleteRequest,
  buildLmsObjectPutRequest,
  buildLmsObjectReadUrl,
  LMS_DEFAULT_FILE_RETENTION_DAYS,
  LMS_FILESYSTEM_STORAGE_PROVIDER,
  LMS_LOCAL_STORAGE_PROVIDER,
  LMS_OBJECT_STORAGE_PROVIDER,
  buildLmsStorageKey,
  isLmsMaterialStorageKey,
  normalizeLmsFileUpload,
  readLmsExternalScannerConfig,
  readLmsObjectStorageConfig,
  scanLmsFileWithExternalScanner,
  scanLmsFileBytes,
  sha256HexForBytes,
  type LmsFileScanStatus,
  type LmsFileStorageProvider,
} from '@wtc/lms';
import type { MaterialFileDownloadRow } from '@wtc/db';

export interface StoredLmsFileMaterial {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  contentSha256: string;
  fileBytesBase64?: string;
  storageProvider: string;
  storageKey: string;
  scanStatus: Exclude<LmsFileScanStatus, 'not_required'>;
  scanCheckedAt: Date;
  quarantineReason: string | null;
  retainedUntil: Date;
}

type StorageEnv = Record<string, string | undefined>;

export type LmsMaterialFileDelivery =
  | { kind: 'bytes'; bytes: Buffer }
  | { kind: 'redirect'; url: string };

type UploadScanResult = {
  status: Extract<LmsFileScanStatus, 'clean' | 'quarantined'>;
  reason: string | null;
};

function configuredProvider(env: StorageEnv = process.env): LmsFileStorageProvider {
  const provider = env.LMS_FILE_STORAGE_PROVIDER?.trim() || LMS_LOCAL_STORAGE_PROVIDER;
  if (provider === LMS_LOCAL_STORAGE_PROVIDER || provider === LMS_FILESYSTEM_STORAGE_PROVIDER || provider === LMS_OBJECT_STORAGE_PROVIDER) return provider;
  throw new Error('lms_storage_provider_unsupported');
}

function assertUploadProviderAllowed(env: StorageEnv, provider: string): void {
  if ((env.NODE_ENV === 'production' || env.APP_ENV === 'staging' || env.APP_ENV === 'production') && (provider === LMS_LOCAL_STORAGE_PROVIDER || provider === LMS_FILESYSTEM_STORAGE_PROVIDER)) {
    throw new Error('lms_storage_provider_not_production_ready');
  }
}

function requireFilesystemRoot(env: StorageEnv = process.env): string {
  const root = env.LMS_FILE_STORAGE_ROOT?.trim();
  if (!root) throw new Error('lms_file_storage_root_required');
  return resolve(root);
}

function localObjectPath(rootDir: string, storageKey: string): string {
  if (!isLmsMaterialStorageKey(storageKey)) throw new Error('lms_storage_key_invalid');
  const root = resolve(rootDir);
  const target = resolve(root, ...storageKey.split('/'));
  if (target !== root && !target.startsWith(root + sep)) throw new Error('lms_storage_key_invalid');
  return target;
}

function configuredScannerMode(env: StorageEnv = process.env): 'local-signature' | 'external' {
  const mode = env.LMS_FILE_SCANNER_MODE?.trim() || 'local-signature';
  if (mode === 'local-signature' || mode === 'external') return mode;
  throw new Error('lms_file_scanner_mode_unsupported');
}

async function scanWithExternalService(input: {
  mimeType: string;
  sizeBytes: number;
  bytes: Uint8Array;
  env: StorageEnv;
}): Promise<UploadScanResult> {
  return scanLmsFileWithExternalScanner({
    config: readLmsExternalScannerConfig(input.env),
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    bytes: input.bytes,
  });
}

async function scanUploadedFile(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  bytes: Uint8Array;
  env: StorageEnv;
}): Promise<UploadScanResult> {
  if (configuredScannerMode(input.env) === 'external') {
    return scanWithExternalService(input);
  }
  return scanLmsFileBytes({ fileName: input.fileName, mimeType: input.mimeType, bytes: input.bytes });
}

async function putObject(input: {
  storageKey: string;
  mimeType: string;
  bytes: Uint8Array;
  now: number;
  env: StorageEnv;
}): Promise<void> {
  const config = readLmsObjectStorageConfig(input.env);
  const request = buildLmsObjectPutRequest({ config, storageKey: input.storageKey, mimeType: input.mimeType, bytes: input.bytes, now: input.now });
  let response: Response;
  try {
    response = await fetch(request.url, { method: 'PUT', headers: request.headers, body: new Uint8Array(input.bytes) });
  } catch {
    throw new Error('lms_object_storage_write_failed');
  }
  if (!response.ok) throw new Error('lms_object_storage_write_failed');
}

export async function deleteLmsObjectStorageFile(input: {
  storageKey: string;
  now: number;
  env?: StorageEnv;
}): Promise<void> {
  const env = input.env ?? process.env;
  const config = readLmsObjectStorageConfig(env);
  const request = buildLmsObjectDeleteRequest({ config, storageKey: input.storageKey, now: input.now });
  let response: Response;
  try {
    response = await fetch(request.url, { method: 'DELETE', headers: request.headers });
  } catch {
    throw new Error('lms_object_storage_delete_failed');
  }
  if (!response.ok && response.status !== 404) throw new Error('lms_object_storage_delete_failed');
}

export async function compensateLmsUploadedFile(input: {
  material: {
    storageProvider?: string;
    storageKey?: string;
    scanStatus?: string;
  };
  now: number;
  env?: StorageEnv;
}): Promise<boolean> {
  if (input.material.storageProvider !== LMS_OBJECT_STORAGE_PROVIDER || input.material.scanStatus !== 'clean') return false;
  if (!input.material.storageKey) return false;
  await deleteLmsObjectStorageFile({ storageKey: input.material.storageKey, now: input.now, env: input.env });
  return true;
}

export async function storeLmsUploadedFile(input: {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  now: number;
  env?: StorageEnv;
  beforeObjectPut?: (input: { storageProvider: typeof LMS_OBJECT_STORAGE_PROVIDER; storageKey: string; scanStatus: 'clean'; retainedUntil: Date }) => Promise<void>;
}): Promise<StoredLmsFileMaterial> {
  const normalized = normalizeLmsFileUpload(input);
  const env = input.env ?? process.env;
  const storageProvider = configuredProvider(env);
  assertUploadProviderAllowed(env, storageProvider);
  const scan = await scanUploadedFile({ fileName: normalized.fileName, mimeType: normalized.mimeType, sizeBytes: normalized.sizeBytes, bytes: input.bytes, env });
  const storageKey = buildLmsStorageKey();
  const scanCheckedAt = new Date(input.now);
  const retainedUntil = new Date(input.now + LMS_DEFAULT_FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  if (storageProvider === LMS_LOCAL_STORAGE_PROVIDER) {
    return {
      ...normalized,
      storageProvider,
      storageKey,
      scanStatus: scan.status,
      scanCheckedAt,
      quarantineReason: scan.reason,
      retainedUntil,
    };
  }

  if (storageProvider === LMS_OBJECT_STORAGE_PROVIDER) {
    if (scan.status === 'clean') {
      await input.beforeObjectPut?.({ storageProvider, storageKey, scanStatus: 'clean', retainedUntil });
      await putObject({ storageKey, mimeType: normalized.mimeType, bytes: input.bytes, now: input.now, env });
    }
    return {
      fileName: normalized.fileName,
      mimeType: normalized.mimeType,
      sizeBytes: normalized.sizeBytes,
      contentSha256: normalized.contentSha256,
      storageProvider,
      storageKey,
      scanStatus: scan.status,
      scanCheckedAt,
      quarantineReason: scan.reason,
      retainedUntil,
    };
  }

  const root = requireFilesystemRoot(input.env);
  const target = localObjectPath(root, storageKey);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, input.bytes, { flag: 'wx' }).catch(async (err: unknown) => {
    if (typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'EEXIST') return;
    throw err;
  });
  return {
    fileName: normalized.fileName,
    mimeType: normalized.mimeType,
    sizeBytes: normalized.sizeBytes,
    contentSha256: normalized.contentSha256,
    storageProvider,
    storageKey,
    scanStatus: scan.status,
    scanCheckedAt,
    quarantineReason: scan.reason,
    retainedUntil,
  };
}

export async function resolveLmsMaterialFileDelivery(
  row: MaterialFileDownloadRow,
  env: StorageEnv = process.env,
  opts: { now?: number; contentDisposition?: string; expiresSeconds?: number } = {},
): Promise<LmsMaterialFileDelivery> {
  if (row.storageProvider === LMS_LOCAL_STORAGE_PROVIDER) {
    if (!row.fileBytesBase64) throw new Error('lms_db_local_bytes_missing');
    return { kind: 'bytes', bytes: Buffer.from(row.fileBytesBase64, 'base64') };
  }
  if (row.storageProvider === LMS_OBJECT_STORAGE_PROVIDER) {
    if (row.fileBytesBase64) throw new Error('lms_object_storage_payload_invalid');
    return {
      kind: 'redirect',
      url: buildLmsObjectReadUrl({
        config: readLmsObjectStorageConfig(env),
        storageKey: row.storageKey,
        mimeType: row.mimeType,
        contentDisposition: opts.contentDisposition ?? 'attachment; filename="lesson-material.bin"',
        now: opts.now ?? Date.now(),
        expiresSeconds: opts.expiresSeconds,
      }),
    };
  }
  if (row.storageProvider !== LMS_FILESYSTEM_STORAGE_PROVIDER) throw new Error('lms_storage_provider_unsupported');
  const target = localObjectPath(requireFilesystemRoot(env), row.storageKey);
  const bytes = await readFile(target);
  if (bytes.byteLength !== row.sizeBytes || sha256HexForBytes(bytes) !== row.contentSha256) {
    throw new Error('lms_storage_integrity_mismatch');
  }
  return { kind: 'bytes', bytes };
}

export async function resolveLmsMaterialFileBytes(row: MaterialFileDownloadRow, env: StorageEnv = process.env): Promise<Buffer> {
  const delivery = await resolveLmsMaterialFileDelivery(row, env);
  if (delivery.kind !== 'bytes') throw new Error('lms_storage_provider_unsupported');
  return delivery.bytes;
}
