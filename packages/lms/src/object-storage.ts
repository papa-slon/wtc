import { createHmac } from 'node:crypto';
import { isOpaqueLmsMaterialStorageKey, sha256HexForBytes } from './materials.ts';

export type LmsObjectStorageEnv = Record<string, string | undefined>;

export interface LmsObjectStorageConfig {
  endpoint: URL;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface LmsObjectStorageRequest {
  url: URL;
  headers: Record<string, string>;
}

export function readLmsObjectStorageConfig(env: LmsObjectStorageEnv): LmsObjectStorageConfig {
  const endpointRaw = env.LMS_OBJECT_STORAGE_ENDPOINT?.trim();
  const bucket = env.LMS_OBJECT_STORAGE_BUCKET?.trim();
  const region = env.LMS_OBJECT_STORAGE_REGION?.trim();
  const accessKeyId = env.LMS_OBJECT_STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY?.trim();
  if (!endpointRaw || !bucket || !region || !accessKeyId || !secretAccessKey) {
    throw new Error('lms_object_storage_config_required');
  }
  let endpoint: URL;
  try {
    endpoint = new URL(endpointRaw);
  } catch {
    throw new Error('lms_object_storage_config_required');
  }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') {
    throw new Error('lms_object_storage_config_required');
  }
  if (!/^[A-Za-z0-9._-]{3,128}$/.test(bucket) || !/^[A-Za-z0-9._-]{1,64}$/.test(region)) {
    throw new Error('lms_object_storage_config_required');
  }
  return { endpoint, bucket, region, accessKeyId, secretAccessKey };
}

function awsEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}

function objectPath(config: LmsObjectStorageConfig, storageKey: string): string {
  if (!isOpaqueLmsMaterialStorageKey(storageKey)) throw new Error('lms_storage_key_invalid');
  return `/${awsEncode(config.bucket)}/${storageKey.split('/').map(awsEncode).join('/')}`;
}

export function buildLmsObjectStorageUrl(config: LmsObjectStorageConfig, storageKey: string): URL {
  const url = new URL(config.endpoint.toString());
  url.pathname = objectPath(config, storageKey);
  return url;
}

function timestampParts(now: number): { amzDate: string; dateStamp: string } {
  const iso = new Date(now).toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest();
}

function signingKey(secretAccessKey: string, dateStamp: string, region: string): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}

function canonicalQuery(params: URLSearchParams): string {
  return [...params.entries()]
    .sort(([aKey, aValue], [bKey, bValue]) => aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey))
    .map(([key, value]) => `${awsEncode(key)}=${awsEncode(value)}`)
    .join('&');
}

function signCanonicalRequest(input: {
  method: 'DELETE' | 'GET' | 'PUT';
  canonicalUri: string;
  canonicalQueryString: string;
  canonicalHeaders: string;
  signedHeaders: string;
  payloadHash: string;
  config: LmsObjectStorageConfig;
  now: number;
}): string {
  const { amzDate, dateStamp } = timestampParts(input.now);
  const scope = `${dateStamp}/${input.config.region}/s3/aws4_request`;
  const canonicalRequest = [
    input.method,
    input.canonicalUri,
    input.canonicalQueryString,
    input.canonicalHeaders,
    input.signedHeaders,
    input.payloadHash,
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256HexForBytes(Buffer.from(canonicalRequest, 'utf8')),
  ].join('\n');
  return createHmac('sha256', signingKey(input.config.secretAccessKey, dateStamp, input.config.region))
    .update(stringToSign, 'utf8')
    .digest('hex');
}

export function buildLmsObjectPutRequest(input: {
  config: LmsObjectStorageConfig;
  storageKey: string;
  mimeType: string;
  bytes: Uint8Array;
  now: number;
}): LmsObjectStorageRequest {
  const url = buildLmsObjectStorageUrl(input.config, input.storageKey);
  const payloadHash = sha256HexForBytes(input.bytes);
  const { amzDate, dateStamp } = timestampParts(input.now);
  const scope = `${dateStamp}/${input.config.region}/s3/aws4_request`;
  const canonicalHeaders = [
    `content-type:${input.mimeType}`,
    `host:${url.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    '',
  ].join('\n');
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const signature = signCanonicalRequest({
    method: 'PUT',
    canonicalUri: url.pathname,
    canonicalQueryString: '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
    config: input.config,
    now: input.now,
  });
  return {
    url,
    headers: {
      authorization: `AWS4-HMAC-SHA256 Credential=${input.config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      'content-type': input.mimeType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
  };
}

export function buildLmsObjectDeleteRequest(input: {
  config: LmsObjectStorageConfig;
  storageKey: string;
  now: number;
}): LmsObjectStorageRequest {
  const url = buildLmsObjectStorageUrl(input.config, input.storageKey);
  const { amzDate, dateStamp } = timestampParts(input.now);
  const scope = `${dateStamp}/${input.config.region}/s3/aws4_request`;
  const payloadHash = sha256HexForBytes(new Uint8Array());
  const canonicalHeaders = [
    `host:${url.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
    '',
  ].join('\n');
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const signature = signCanonicalRequest({
    method: 'DELETE',
    canonicalUri: url.pathname,
    canonicalQueryString: '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
    config: input.config,
    now: input.now,
  });
  return {
    url,
    headers: {
      authorization: `AWS4-HMAC-SHA256 Credential=${input.config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
  };
}

export function buildLmsObjectReadUrl(input: {
  config: LmsObjectStorageConfig;
  storageKey: string;
  mimeType: string;
  contentDisposition: string;
  now: number;
  expiresSeconds?: number;
}): string {
  const url = buildLmsObjectStorageUrl(input.config, input.storageKey);
  const expires = Math.min(Math.max(input.expiresSeconds ?? 60, 1), 300);
  const { amzDate, dateStamp } = timestampParts(input.now);
  const scope = `${dateStamp}/${input.config.region}/s3/aws4_request`;
  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${input.config.accessKeyId}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
    'response-content-disposition': input.contentDisposition,
    'response-content-type': input.mimeType,
  });
  const canonicalQueryString = canonicalQuery(params);
  const signature = signCanonicalRequest({
    method: 'GET',
    canonicalUri: url.pathname,
    canonicalQueryString,
    canonicalHeaders: `host:${url.host}\n`,
    signedHeaders: 'host',
    payloadHash: 'UNSIGNED-PAYLOAD',
    config: input.config,
    now: input.now,
  });
  params.set('X-Amz-Signature', signature);
  url.search = canonicalQuery(params);
  return url.toString();
}
