import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('LMS object-store primitives are shared', () => {
  it('keeps SigV4 implementation in @wtc/lms instead of app code', () => {
    const web = read('apps/web/src/features/lms/material-storage.ts');
    const worker = read('apps/worker/src/lms-object-cleanup.ts');
    const shared = read('packages/lms/src/object-storage.ts');

    expect(shared).toContain('createHmac');
    expect(shared).toContain('buildLmsObjectPutRequest');
    expect(shared).toContain('buildLmsObjectDeleteRequest');
    expect(shared).toContain('buildLmsObjectReadUrl');

    expect(web).toContain('buildLmsObjectPutRequest');
    expect(web).toContain('buildLmsObjectDeleteRequest');
    expect(web).toContain('buildLmsObjectReadUrl');
    expect(worker).toContain('buildLmsObjectDeleteRequest');

    for (const appSource of [web, worker]) {
      expect(appSource).not.toContain("from 'node:crypto'");
      expect(appSource).not.toContain('createHmac');
      expect(appSource).not.toContain('function signingKey');
      expect(appSource).not.toContain('function awsEncode');
      expect(appSource).not.toContain('function signCanonicalRequest');
      expect(appSource).not.toContain('AWS4-HMAC-SHA256 Credential=');
      expect(appSource).not.toContain('LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY?.trim()');
    }
  });
});
