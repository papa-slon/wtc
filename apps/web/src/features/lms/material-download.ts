import {
  getMaterialFileForPublishedLesson,
  recordMaterialDownloadAudit,
  type Db,
  type MaterialFileDownloadRow,
} from '@wtc/db';
import type { AccessDecision, AccessReason } from '@wtc/entitlements';
import { resolveLmsMaterialFileDelivery } from './material-storage';

export interface LmsDownloadUser {
  id: string;
  roles?: string[];
}

export interface LmsMaterialDownloadOptions {
  db: Db | null;
  now?: number;
  requireUser: () => Promise<LmsDownloadUser>;
  accessFor: (userId: string, productCode: 'education') => Promise<AccessDecision>;
  reasonLabel: (reason: AccessReason) => string;
  getFile?: typeof getMaterialFileForPublishedLesson;
  recordAudit?: typeof recordMaterialDownloadAudit;
  resolveFile?: typeof resolveLmsMaterialFileDelivery;
}

function noStore(body: unknown, init: ResponseInit): Response {
  return Response.json(body, {
    ...init,
    headers: { 'cache-control': 'no-store', ...(init.headers ?? {}) },
  });
}

function attachmentNameForMime(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'lesson-material.pdf';
  if (mimeType === 'image/png') return 'lesson-material.png';
  if (mimeType === 'image/jpeg') return 'lesson-material.jpg';
  if (mimeType === 'text/plain') return 'lesson-material.txt';
  return 'lesson-material.bin';
}

function downloadHeaders(row: MaterialFileDownloadRow, bytes: Buffer): Headers {
  const headers = new Headers();
  headers.set('cache-control', 'private, no-store');
  headers.set('content-type', row.mimeType);
  headers.set('content-length', String(bytes.byteLength));
  headers.set('content-disposition', `attachment; filename="${attachmentNameForMime(row.mimeType)}"`);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  return headers;
}

function redirectHeaders(url: string): Headers {
  const headers = new Headers();
  headers.set('cache-control', 'private, no-store');
  headers.set('location', url);
  headers.set('referrer-policy', 'no-referrer');
  headers.set('x-content-type-options', 'nosniff');
  return headers;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function handleLmsMaterialDownloadRequest(req: Request, materialId: string, opts: LmsMaterialDownloadOptions): Promise<Response> {
  if (req.method !== 'GET') return noStore({ error: 'method_not_allowed' }, { status: 405 });
  if (!isUuid(materialId)) return noStore({ error: 'invalid_material_id' }, { status: 400 });
  let user: LmsDownloadUser;
  try {
    user = await opts.requireUser();
  } catch {
    return noStore({ error: 'unauthenticated' }, { status: 401 });
  }
  const access = await opts.accessFor(user.id, 'education');
  if (!access.allowed) {
    return noStore({ error: 'entitlement_denied', reason: opts.reasonLabel(access.reason) }, { status: 403 });
  }
  const db = opts.db;
  if (!db) return noStore({ error: 'not_configured', blockers: ['database_not_configured'] }, { status: 503 });
  const row = await (opts.getFile ?? getMaterialFileForPublishedLesson)(db, materialId);
  if (!row) return noStore({ error: 'material_file_not_found' }, { status: 404 });
  let delivery: Awaited<ReturnType<typeof resolveLmsMaterialFileDelivery>>;
  try {
    delivery = await (opts.resolveFile ?? resolveLmsMaterialFileDelivery)(row, process.env, {
      now: opts.now ?? Date.now(),
      contentDisposition: `attachment; filename="${attachmentNameForMime(row.mimeType)}"`,
    });
  } catch {
    return noStore({ error: 'material_file_not_found' }, { status: 404 });
  }
  await (opts.recordAudit ?? recordMaterialDownloadAudit)(db, row, user.id, opts.now ?? Date.now());
  if (delivery.kind === 'redirect') {
    return new Response(null, { status: 302, headers: redirectHeaders(delivery.url) });
  }
  return new Response(new Uint8Array(delivery.bytes), { status: 200, headers: downloadHeaders(row, delivery.bytes) });
}
