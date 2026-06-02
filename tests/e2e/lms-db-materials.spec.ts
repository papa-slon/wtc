import { test, expect, type APIRequestContext, type APIResponse, type Locator, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loginAdmin, loginTeacher, loginUser } from './helpers/auth';

test.skip(process.env.LMS_DB_E2E !== '1', 'DB-backed LMS browser acceptance is opt-in via npm run e2e:lms:db.');
test.describe.configure({ mode: 'serial' });

const shot = (name: string, project: string) => `tests/e2e/screenshots/${name}-${project}.png`;
const EXPECTED_IFRAME_ALLOW = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
const INTERNAL_MATERIAL_MARKERS = [
  'fileBytesBase64',
  'storageKey',
  'storage_key',
  'lms/materials/',
  'fileName',
  'mimeType',
  'contentSha256',
  'storageProvider',
  'db-local',
  'retainedUntil',
  'quarantineReason',
  'deletedAt',
  'hasStorageKey',
] as const;

function noHScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

async function expectNoMaterialLeak(page: Page, text: string): Promise<void> {
  const visibleText = await page.locator('body').innerText();
  expect(visibleText).not.toContain(text);
  expect(visibleText).not.toContain(Buffer.from(text, 'utf8').toString('base64'));
  for (const marker of INTERNAL_MATERIAL_MARKERS) expect(visibleText).not.toContain(marker);
}

async function expectNoMaterialMetadataLeak(page: Page, fileSha256: string, fileName: string): Promise<void> {
  const visibleText = await page.locator('body').innerText();
  expect(visibleText).not.toContain(fileSha256);
  expect(visibleText).not.toContain(fileName);
  for (const marker of INTERNAL_MATERIAL_MARKERS) expect(visibleText).not.toContain(marker);
}

async function expectNoRawEmbed(page: Page, rawEmbedHtml: string): Promise<void> {
  const visibleText = await page.locator('body').innerText();
  expect(visibleText).not.toContain(rawEmbedHtml);
  expect(visibleText).not.toContain(Buffer.from(rawEmbedHtml, 'utf8').toString('base64'));
  expect(visibleText).not.toContain('&lt;iframe');
  expect(visibleText).not.toContain('srcdoc');
  await expect(page.locator('iframe[srcdoc]')).toHaveCount(0);
}

function expectNoLeakInText(text: string, markers: readonly string[]): void {
  for (const marker of markers) {
    expect(text).not.toContain(marker);
    expect(text).not.toContain(Buffer.from(marker, 'utf8').toString('base64'));
  }
  for (const marker of INTERNAL_MATERIAL_MARKERS) expect(text).not.toContain(marker);
}

function appendDynamicArtifactMarkers(markers: readonly { label: string; value: string }[]): void {
  const manifestPath = process.env.LMS_DB_E2E_DYNAMIC_MARKERS_PATH?.trim();
  if (!manifestPath) return;
  mkdirSync(dirname(manifestPath), { recursive: true });
  const existing = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8')) as { version?: number; markers?: { label: string; value: string }[] }
    : { version: 1, markers: [] };
  const next = {
    version: 1,
    markers: [...(existing.markers ?? []), ...markers],
  };
  writeFileSync(manifestPath, JSON.stringify(next, null, 2));
}

async function expectNoDownloadResponseLeak(
  res: APIResponse,
  markers: readonly string[],
  cleanFileBytes: string,
): Promise<string> {
  const body = await res.text();
  const headers = res.headers();
  const headerText = JSON.stringify(headers);
  expectNoLeakInText(body, markers);
  expectNoLeakInText(headerText, markers);
  expect(headers['x-lms-sha256']).toBeUndefined();
  expect(headers['content-disposition']).toBeUndefined();
  expect(headers['set-cookie']).toBeUndefined();
  expect(headers['content-type']).toContain('application/json');
  expect(headers['content-length']).not.toBe(String(Buffer.byteLength(cleanFileBytes, 'utf8')));
  return body;
}

async function expectNoDownloadWithoutAuth(request: APIRequestContext, href: string, markers: readonly string[], cleanFileBytes: string): Promise<void> {
  const res = await request.get(href);
  expect(res.status()).toBe(401);
  expect(res.headers()['cache-control']).toContain('no-store');
  const body = await expectNoDownloadResponseLeak(res, markers, cleanFileBytes);
  expect(JSON.parse(body)).toEqual({ error: 'unauthenticated' });
}

async function expectSafeEmbedFrame(frame: Locator): Promise<void> {
  await expect(frame).toHaveAttribute('src', 'https://player.vimeo.com/video/123456789');
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
  await expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect(frame).toHaveAttribute('loading', 'lazy');
  await expect(frame).toHaveAttribute('allow', EXPECTED_IFRAME_ALLOW);
  expect(await frame.getAttribute('srcdoc')).toBeNull();
  expect(await frame.evaluate((el) => (el as HTMLIFrameElement).allowFullscreen)).toBe(true);
}

test('DB-backed LMS: teacher uploads materials and student access fails closed around downloads', async ({ page, request }, info) => {
  const suffix = `${info.project.name}-${Date.now()}`;
  const courseTitle = `DB LMS Acceptance ${suffix}`;
  const lessonTitle = `Downloadable lesson ${suffix}`;
  const materialTitle = `Clean notes ${suffix}`;
  const quarantinedTitle = `Blocked test signature ${suffix}`;
  const embedTitle = `Embedded replay ${suffix}`;
  const fileName = `wtc-db-e2e-notes-${suffix}.txt`;
  const fileText = `db-backed lms acceptance ${suffix}\n`;
  const quarantinedText = `EICAR-STANDARD-ANTIVIRUS-TEST-FILE ${suffix}`;
  const embedHtml = `<iframe src="https://player.vimeo.com/video/123456789" title="${embedTitle}" loading="lazy"></iframe>`;
  const fileSha256 = createHash('sha256').update(fileText).digest('hex');
  const leakMarkers = [fileText, quarantinedText, fileName, fileSha256] as const;
  appendDynamicArtifactMarkers([
    { label: 'clean file body', value: fileText },
    { label: 'quarantine file body', value: quarantinedText },
    { label: 'uploaded filename', value: fileName },
    { label: 'uploaded file sha256', value: fileSha256 },
    { label: 'raw embed html', value: embedHtml },
  ]);

  await loginTeacher(page);
  await page.goto('/teacher/courses');
  await expect(page.getByText('storage: Postgres')).toBeVisible();

  const createCourse = page.locator('form').filter({ has: page.getByRole('button', { name: 'Create draft course' }) });
  await createCourse.locator('input[name="title"]').fill(courseTitle);
  await createCourse.locator('input[name="description"]').fill('DB-backed browser acceptance course.');
  await createCourse.locator('select[name="level"]').selectOption('intermediate');
  await createCourse.locator('input[name="tags"]').fill('db-e2e, materials');
  await createCourse.getByRole('button', { name: 'Create draft course' }).click();
  await expect(page.getByRole('link', { name: new RegExp(courseTitle) })).toBeVisible();
  await page.getByRole('link', { name: new RegExp(courseTitle) }).click();

  const addLesson = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add draft lesson' }) });
  await addLesson.locator('input[name="title"]').fill(lessonTitle);
  await addLesson.locator('select[name="contentType"]').selectOption('article');
  await addLesson.locator('textarea[name="body"]').fill('This lesson proves DB-backed material downloads in browser acceptance.');
  await addLesson.getByRole('button', { name: 'Add draft lesson' }).click();
  await expect(page.locator('strong').filter({ hasText: lessonTitle })).toBeVisible();

  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unpublish', exact: true })).toBeVisible();

  const addFileMaterial = async (title: string, name: string, text: string) => {
    const addMaterial = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add material' }) });
    await addMaterial.locator('select[name="lessonId"]').selectOption({ label: `1. ${lessonTitle}` });
    await addMaterial.locator('input[name="label"]').fill(title);
    await addMaterial.locator('select[name="kind"]').selectOption('file');
    await addMaterial.locator('input[name="file"]').setInputFiles({
      name,
      mimeType: 'text/plain',
      buffer: Buffer.from(text, 'utf8'),
    });
    await addMaterial.getByRole('button', { name: 'Add material' }).click();
    await expect(page.getByText(title)).toBeVisible();
  };

  const addEmbedMaterial = async () => {
    const addMaterial = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add material' }) });
    await addMaterial.locator('select[name="lessonId"]').selectOption({ label: `1. ${lessonTitle}` });
    await addMaterial.locator('input[name="label"]').fill(embedTitle);
    await addMaterial.locator('select[name="kind"]').selectOption('embed');
    await addMaterial.locator('textarea[name="embedHtml"]').fill(embedHtml);
    await addMaterial.getByRole('button', { name: 'Add material' }).click();
    await expect(page.getByText(embedTitle)).toBeVisible();
  };

  await addFileMaterial(materialTitle, fileName, fileText);
  await expect(page.getByText('clean', { exact: true }).first()).toBeVisible();
  await expectNoMaterialLeak(page, fileText);
  await expectNoMaterialMetadataLeak(page, fileSha256, fileName);

  await addFileMaterial(quarantinedTitle, `eicar-${suffix}.txt`, quarantinedText);
  await expect(page.getByText('quarantined', { exact: true }).first()).toBeVisible();
  await expectNoMaterialLeak(page, quarantinedText);

  await addEmbedMaterial();
  await expectNoRawEmbed(page, embedHtml);

  await page.getByRole('button', { name: 'Publish course' }).click();
  await expect(page.getByText('published', { exact: true }).first()).toBeVisible();

  await loginUser(page);
  await page.goto('/app/education');
  await expect(page.getByText('storage: Postgres')).toBeVisible();
  const courseCard = page.locator('.wtc-card').filter({ hasText: courseTitle });
  await expect(courseCard).toBeVisible();
  await courseCard.getByRole('link', { name: /Open course/ }).click();
  await expect(page.getByRole('heading', { name: courseTitle })).toBeVisible();
  await page.getByRole('link', { name: new RegExp(lessonTitle) }).click();
  await expect(page.getByRole('heading', { name: lessonTitle })).toBeVisible();
  const lessonPageUrl = page.url();

  const cleanMaterial = page.locator('li').filter({ hasText: materialTitle });
  const blockedMaterial = page.locator('li').filter({ hasText: quarantinedTitle });
  const embedMaterial = page.locator('li').filter({ hasText: embedTitle });
  await expect(cleanMaterial).toBeVisible();
  await expect(cleanMaterial.getByText('clean', { exact: true })).toBeVisible();
  await expect(blockedMaterial).toBeVisible();
  await expect(blockedMaterial.getByText('quarantined', { exact: true })).toBeVisible();
  await expect(blockedMaterial.getByText('download unavailable')).toBeVisible();
  await expect(blockedMaterial.getByRole('link', { name: 'Download' })).toHaveCount(0);
  const embedFrame = embedMaterial.locator(`iframe[title="${embedTitle}"]`);
  await expect(embedFrame).toBeVisible();
  await expectSafeEmbedFrame(embedFrame);
  await expectNoMaterialLeak(page, fileText);
  await expectNoMaterialLeak(page, quarantinedText);
  await expectNoMaterialMetadataLeak(page, fileSha256, fileName);
  await expectNoRawEmbed(page, embedHtml);

  const href = await cleanMaterial.getByRole('link', { name: 'Download' }).getAttribute('href');
  expect(href, 'download link href').toBeTruthy();
  const absoluteHref = new URL(href!, page.url()).toString();
  await expectNoDownloadWithoutAuth(request, absoluteHref, leakMarkers, fileText);

  await loginTeacher(page);
  const deniedRes = await page.request.get(absoluteHref);
  expect(deniedRes.status()).toBe(403);
  expect(deniedRes.headers()['cache-control']).toContain('no-store');
  const deniedBody = await expectNoDownloadResponseLeak(deniedRes, leakMarkers, fileText);
  expect(JSON.parse(deniedBody)).toMatchObject({ error: 'entitlement_denied' });

  await loginUser(page);
  const res = await page.request.get(absoluteHref);
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toContain('no-store');
  expect(res.headers()['content-type']).toBe('text/plain');
  expect(res.headers()['content-disposition']).toBe('attachment; filename="lesson-material.txt"');
  expect(res.headers()['content-disposition']).not.toContain(fileName);
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(res.headers()['x-lms-sha256']).toBeUndefined();
  expect(await res.text()).toBe(fileText);

  const invalidRes = await page.request.get('/api/education/materials/not-a-uuid/download');
  expect(invalidRes.status()).toBe(400);
  expect(invalidRes.headers()['cache-control']).toContain('no-store');
  const invalidBody = await expectNoDownloadResponseLeak(invalidRes, leakMarkers, fileText);
  expect(JSON.parse(invalidBody)).toEqual({ error: 'invalid_material_id' });

  if (info.project.name.includes('mobile')) {
    await page.goto(lessonPageUrl);
    await expect(page.getByRole('heading', { name: lessonTitle })).toBeVisible();
    expect(await noHScroll(page), 'DB-backed LMS lesson page scrolls horizontally on mobile').toBe(true);
    await page.screenshot({ path: shot('lms-db-material-lesson', info.project.name), fullPage: true });
  }

  await loginAdmin(page);
  await page.goto('/admin/audit-log');
  await expect(page.getByText('storage: Postgres')).toBeVisible();
  await expect(page.getByText('education.material_download').first()).toBeVisible();
  await expectNoMaterialLeak(page, fileText);
  await expectNoMaterialLeak(page, quarantinedText);
  await expectNoMaterialMetadataLeak(page, fileSha256, fileName);
});
