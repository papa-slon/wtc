import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const runner = read('scripts/run-lms-db-e2e.mjs');
const managedRunner = read('scripts/run-lms-db-e2e-managed.mjs');
const prepare = read('scripts/prepare-lms-db-e2e.ts');
const config = read('playwright.lms-db.config.ts');
const defaultConfig = read('playwright.config.ts');
const spec = read('tests/e2e/lms-db-materials.spec.ts');
const artifactScan = read('scripts/scan-lms-db-e2e-artifacts.mjs');
const rootPkg = read('package.json');
const webPkg = read('apps/web/package.json');
const envExample = read('.env.example');
const e2eLoginRoute = read('apps/web/src/app/api/e2e/login/route.ts');

function runManaged(env: NodeJS.ProcessEnv = {}, args: string[] = []) {
  return spawnSync(process.execPath, ['scripts/run-lms-db-e2e-managed.mjs', ...args], {
    cwd: ROOT,
    env: { ...process.env, LMS_E2E_ADMIN_DATABASE_URL: '', ...env },
    encoding: 'utf8',
    windowsHide: true,
  });
}

function outputOf(result: ReturnType<typeof runManaged>): string {
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

function postgresUrl(user: string, password: string, hostAndDb: string): string {
  return ['postgres://', user, ':', password, '@', hostAndDb].join('');
}

function runSafeMessage(raw: string) {
  return spawnSync(process.execPath, [
    '--input-type=module',
    '-e',
    `const { safeMessage } = await import('./scripts/run-lms-db-e2e-managed.mjs'); console.log(safeMessage(new Error(${JSON.stringify(raw)})));`,
  ], {
    cwd: ROOT,
    env: { ...process.env, LMS_E2E_ADMIN_DATABASE_URL: '' },
    encoding: 'utf8',
    windowsHide: true,
  });
}

describe('Phase 3.18 LMS DB-backed browser acceptance harness', () => {
  it('is opt-in and wired through dedicated npm scripts', () => {
    expect(rootPkg).toMatch(/"e2e:lms:db": "node scripts\/run-lms-db-e2e\.mjs"/);
    expect(rootPkg).toMatch(/"e2e:lms:db:managed": "node scripts\/run-lms-db-e2e-managed\.mjs"/);
    expect(webPkg).toMatch(/"dev:e2e:db": "next dev --port 3411"/);
    expect(runner).toContain('LMS_E2E_DATABASE_URL');
    expect(runner).toContain('REAL_POSTGRES_DATABASE_URL is reserved');
    expect(runner).not.toContain('process.env.LMS_E2E_DATABASE_URL ?? process.env.REAL_POSTGRES_DATABASE_URL');
    expect(prepare).not.toContain('process.env.LMS_E2E_DATABASE_URL ?? process.env.REAL_POSTGRES_DATABASE_URL');
    expect(runner).toContain('LMS_DB_E2E_PREP_TOKEN');
    expect(runner).toContain('LMS_DB_E2E_DYNAMIC_MARKERS_PATH');
    expect(runner).toContain('lms-db-e2e-dynamic-markers.json');
    expect(runner).toContain('playwright.lms-db.config.ts');
    expect(runner).toContain('scripts/scan-lms-db-e2e-artifacts.mjs');
    expect(runner).toContain('runRedactedChildProcess');
    expect(runner).toContain('scanning generated artifacts before exit');
    expect(spec).toContain("test.skip(process.env.LMS_DB_E2E !== '1'");
    expect(runner).toContain('markers cleaned');
  });

  it('managed runner creates and drops a fresh throwaway DB without printing URLs', () => {
    expect(managedRunner).toContain('LMS_E2E_ADMIN_DATABASE_URL');
    expect(managedRunner).toContain('safeMessage');
    expect(managedRunner).toContain('CREATE DATABASE');
    expect(managedRunner).toContain('DROP DATABASE IF EXISTS');
    expect(managedRunner).toContain('WITH (FORCE)');
    expect(managedRunner).toContain('wtc_test_lms_');
    expect(managedRunner).toContain("['run', 'e2e:lms:db']");
    expect(managedRunner).toContain('LMS_E2E_DATABASE_URL: targetUrl');
    expect(managedRunner).toContain('runRedactedChildProcess');
    expect(managedRunner).toContain('admin URL must point at a non-throwaway maintenance database');
    expect(managedRunner).not.toContain('console.log(targetUrl');
    expect(managedRunner).not.toContain('console.error(targetUrl');
    expect(managedRunner).not.toContain('console.log(adminUrl');
    expect(managedRunner).not.toContain('console.error(adminUrl');
    expect(envExample).toContain('LMS_E2E_DATABASE_URL');
    expect(envExample).toContain('LMS_E2E_ADMIN_DATABASE_URL');
    expect(envExample).toContain('wtc_test_lms_');
  });

  it('managed runner prints safe help without credentials', () => {
    const help = runManaged({}, ['--help']);
    expect(help.status).toBe(0);
    expect(outputOf(help)).toContain('Usage:');
    expect(outputOf(help)).toContain('LMS_E2E_ADMIN_DATABASE_URL');
  });

  it('managed runner refuses unknown args before using present credentials', () => {
    const url = postgresUrl('admin', 'not-real', '127.0.0.1:1/postgres');
    const unknown = runManaged({ LMS_E2E_ADMIN_DATABASE_URL: url }, ['--dry-run']);
    expect(unknown.status).toBe(2);
    expect(outputOf(unknown)).toContain('unknown argument');
    expect(outputOf(unknown)).not.toContain(url);
  });

  it('managed runner refuses URL-shaped unknown args without echoing them', () => {
    const rawArg = `${postgresUrl('cli', 'secret', '127.0.0.1:5432/postgres')}?password=cli-secret`;
    const unknown = runManaged({}, [rawArg]);
    const output = outputOf(unknown);

    expect(unknown.status).toBe(2);
    expect(output).toContain('unknown argument');
    expect(output).not.toContain(rawArg);
    expect(output).not.toContain('cli:secret');
    expect(output).not.toContain('cli-secret');
  });

  it('managed runner refuses missing admin URLs before opening a database', () => {
    const missing = runManaged();
    expect(missing.status).toBe(2);
    expect(outputOf(missing)).toContain('Set LMS_E2E_ADMIN_DATABASE_URL');
  });

  it('managed runner refuses invalid admin URLs before opening a database', () => {
    const invalid = runManaged({ LMS_E2E_ADMIN_DATABASE_URL: 'not-a-postgres-url' });
    expect(invalid.status).toBe(2);
    expect(outputOf(invalid)).toContain('not a valid URL');
  });

  it('managed runner refuses throwaway admin URLs without echoing them', () => {
    const throwawayUrl = postgresUrl('postgres', 'not-real', '127.0.0.1:5432/wtc_test_lms_bad_admin');
    const throwaway = runManaged({ LMS_E2E_ADMIN_DATABASE_URL: throwawayUrl });
    expect(throwaway.status).toBe(2);
    expect(outputOf(throwaway)).toContain('non-throwaway maintenance database');
    expect(outputOf(throwaway)).not.toContain(throwawayUrl);
  });

  it('managed runner sanitizer redacts raw postgres URLs and password parameters', () => {
    const raw = `driver failed for ${postgresUrl('admin', 'secret', '127.0.0.1:5432/postgres')}?sslmode=disable with password=secret-token`;
    const result = runSafeMessage(raw);
    const output = outputOf(result);

    expect(result.status).toBe(0);
    expect(output).toContain('postgres://<redacted>');
    expect(output).toContain('password=<redacted>');
    expect(output).not.toContain('admin:secret');
    expect(output).not.toContain('127.0.0.1:5432/postgres');
    expect(output).not.toContain('secret-token');
  });

  it('LMS child runner and prep use safe message redaction in catch paths and redacted child output', () => {
    expect(runner).toContain('function safeMessage');
    expect(runner).toContain("import { redactProcessOutput, runRedactedChildProcess } from './redacted-child-process.mjs'");
    expect(runner).toContain('runRedacted(command, args)');
    expect(runner).not.toContain("stdio: 'inherit'");
    expect(runner).toContain('LMS DB e2e runner failed: ${safeMessage(error)}');
    expect(runner).toContain('LMS DB artifact scanner could not run: ${safeMessage(scanError)}');
    expect(prepare).toContain('function safeMessage');
    expect(prepare).toContain('console.error(safeMessage(err))');
  });

  it('refuses non-throwaway or non-empty databases before running browser tests', () => {
    expect(prepare).toContain('assertThrowawayDbName');
    expect(prepare).toContain('wtc_test_lms_<suffix>');
    expect(prepare).toContain('^wtc_test(?:_[a-z0-9]+)*$');
    expect(prepare).toContain('information_schema.tables');
    expect(prepare).toContain('is not empty');
    expect(prepare).toContain('lms-db-e2e-prepared.json');
    expect(config).toContain('assertPreparedDatabaseUrl');
    expect(config).toContain('^wtc_test(?:_[a-z0-9]+)*$');
    expect(config).toContain('LMS_DB_E2E_PREP_TOKEN');
  });

  it('runs a separate DB-backed Playwright server with safe local flags', () => {
    expect(config).toContain("const lmsDbE2ePort = process.env.LMS_DB_E2E_PORT ?? '3411'");
    expect(config).toContain('baseURL,');
    expect(config).toContain('`npm run dev -w @wtc/web -- --port ${lmsDbE2ePort}`');
    expect(config).toContain("DATABASE_URL: databaseUrl");
    expect(config).toContain("E2E_AUTH_BYPASS: '1'");
    expect(config).toContain("BOT_ADAPTER_MODE: 'mock'");
    expect(config).toContain("FEATURE_LIVE_BOT_CONTROL: 'false'");
    expect(config).toContain("FEATURE_TV_AUTOMATION: 'false'");
  });

  it('asserts the teacher upload to student download browser flow and audit visibility', () => {
    expect(spec).toContain('Create draft course');
    expect(spec).toContain('Add draft lesson');
    expect(spec).toContain('Add material');
    expect(spec).toContain('Publish course');
    expect(spec).toContain('Download');
    expect(spec).toContain('content-disposition');
    expect(spec).toContain('lesson-material.txt');
    expect(spec).toContain("not.toContain(fileName)");
    expect(spec).toContain('x-content-type-options');
    expect(spec).toContain("headers()['x-lms-sha256']).toBeUndefined");
    expect(spec).not.toContain("headers()['x-lms-sha256']).toBe(fileSha256");
    expect(spec).toContain('expectNoMaterialLeak');
    expect(spec).toContain('expectNoMaterialMetadataLeak');
    expect(spec).toContain('expectNoDownloadResponseLeak');
    expect(spec).toContain('appendDynamicArtifactMarkers');
    expect(spec).toContain('LMS_DB_E2E_DYNAMIC_MARKERS_PATH');
    expect(spec).toContain('invalid_material_id');
    expect(spec).toContain('education.material_download');
  });

  it('covers DB browser denial, quarantine, and sanitized embed assertions', () => {
    expect(spec).toContain('expectNoDownloadWithoutAuth');
    expect(spec).toContain('unauthenticated');
    expect(spec).toContain('entitlement_denied');
    expect(spec).toContain('quarantined');
    expect(spec).toContain('download unavailable');
    expect(spec).toContain('Blocked test signature');
    expect(spec).toContain('Embedded replay');
    expect(spec).toContain('player.vimeo.com/video/123456789');
    expect(spec).toContain('expectNoRawEmbed');
    expect(spec).toContain('expectSafeEmbedFrame');
    expect(spec).toContain('allow-scripts allow-same-origin allow-presentation');
    expect(spec).toContain('referrerpolicy');
    expect(spec).toContain('srcdoc');
    expect(spec).toContain('contentSha256');
    expect(spec).toContain('storageProvider');
    expect(spec).toContain('hasStorageKey');
  });

  it('keeps the e2e login bypass local-only', () => {
    expect(e2eLoginRoute).toContain('LOCAL_E2E_HOSTS');
    expect(e2eLoginRoute).toContain("E2E_AUTH_BYPASS !== '1'");
    expect(e2eLoginRoute).toContain("process.env.NODE_ENV === 'production'");
    expect(e2eLoginRoute).toContain('new URL(request.url).hostname');
  });

  it('keeps the LMS DB browser gate out of default gates', () => {
    const scripts = (JSON.parse(rootPkg) as { scripts: Record<string, string> }).scripts;
    const gates = read('scripts/gates.mjs');
    expect(gates).not.toContain('e2e:lms:db');
    expect(scripts.e2e).toBe('playwright test');
    expect(scripts.e2e).not.toContain('e2e:lms:db');
    expect(scripts['ci:local']).not.toContain('e2e:lms:db');
    expect(scripts['e2e:lms:db']).toBe('node scripts/run-lms-db-e2e.mjs');
    expect(scripts['e2e:lms:db:managed']).toBe('node scripts/run-lms-db-e2e-managed.mjs');
    expect(defaultConfig).toContain('/lms-db-materials\\.spec\\.ts/');
  });

  it('defines artifact no-leak markers for the LMS DB browser run', () => {
    expect(artifactScan).toContain('fileBytesBase64');
    expect(artifactScan).toContain('fileName');
    expect(artifactScan).toContain('mimeType');
    expect(artifactScan).toContain('storageKey');
    expect(artifactScan).toContain('lms/materials/');
    expect(artifactScan).toContain('db-backed lms acceptance');
    expect(artifactScan).toContain('EICAR-STANDARD-ANTIVIRUS-TEST-FILE');
    expect(artifactScan).toContain('player.vimeo.com/video/123456789');
    expect(artifactScan).toContain('&lt;iframe');
    expect(artifactScan).toContain('contentSha256');
    expect(artifactScan).toContain('storageProvider');
    expect(artifactScan).toContain('hasStorageKey');
    expect(artifactScan).toContain('x-lms-sha256');
    expect(artifactScan).toContain('X-Amz-Algorithm');
    expect(artifactScan).toContain('X-Amz-Credential');
    expect(artifactScan).toContain('X-Amz-Signature');
    expect(artifactScan).toContain('AWSAccessKeyId');
    expect(artifactScan).toContain('LMS_FILE_SCANNER_ENDPOINT');
    expect(artifactScan).toContain('LMS_FILE_SCANNER_TOKEN');
    expect(artifactScan).toContain('LMS_FILE_SCANNER_LIVE_ACCEPTANCE');
    expect(artifactScan).toContain('LMS_FILE_SCANNER_LIVE_EICAR');
    expect(artifactScan).toContain('x-wtc-lms-mime-type');
    expect(artifactScan).toContain('x-wtc-lms-size-bytes');
    expect(artifactScan).toContain('application\\/octet-stream');
    expect(artifactScan).toContain('LMS_OBJECT_STORAGE_ENDPOINT');
    expect(artifactScan).toContain('LMS_OBJECT_STORAGE_ACCESS_KEY_ID');
    expect(artifactScan).toContain('LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY');
    expect(artifactScan).toContain('AWS4-HMAC-SHA256');
    expect(artifactScan).toContain('x-amz-content-sha256');
    expect(artifactScan).toContain('x-amz-date');
    expect(artifactScan).toContain('loadDynamicMarkers');
    expect(artifactScan).toContain('dynamic marker manifest rejected');
    expect(artifactScan).toContain('dynamic LMS marker');
    expect(artifactScan).toContain('__Host-');
    expect(artifactScan).toContain('authorization');
    expect(artifactScan).toContain('postgres(?:ql)?');
    expect(artifactScan).toContain('unscanned binary/container artifact');
  });
});
