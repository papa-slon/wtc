import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRedactedStreamForwarder } from '../../scripts/safe-preview.mjs';

function collectRedacted(chunks: string[]): string {
  let output = '';
  const forwarder = createRedactedStreamForwarder((text: string) => {
    output += text;
  });
  for (const chunk of chunks) forwarder.write(Buffer.from(chunk, 'utf8'));
  forwarder.flush();
  return output;
}

describe('safe-preview retained output policy', () => {
  it('redacts preview child output before forwarding retained stream text', () => {
    const dbUrl = ['post', 'gres://preview_user', ':', 'preview_pw', '@127.0.0.1:5432/wtc_preview'].join('');
    const bearer = 'preview-bearer-token';
    const cookie = `wtc_session=${'a'.repeat(64)}`;
    const publicPreview = ['http://54', '.179', '.188', '.61:3000/app'].join('');
    const stripeKey = ['sk', '_test_', 'previewsecret'].join('');
    const signedUrl = 'https://objects.example.invalid/file?X-Amz-Signature=previewsig&AWSAccessKeyId=previewkey';
    const privateKeyBegin = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
    const privateKeyEnd = ['-----END ', 'PRIVATE KEY-----'].join('');
    const privateKey = [privateKeyBegin, 'preview-key-material', privateKeyEnd].join('\n');

    const output = collectRedacted([
      'DATABASE_URL=post',
      ['gres://preview_user', ':', 'preview_pw', '@127.0.0.1:5432/wtc_preview\nAuthorization: Bear'].join(''),
      `er ${bearer}\ncookie: ${cookie}\nPUBLIC_PREVIEW_URL=${publicPreview}\n`,
      `STRIPE_SECRET_KEY=${stripeKey}\nsigned=${signedUrl}\n${privateKey}`,
    ]);

    for (const forbidden of [
      dbUrl,
      'preview_pw',
      bearer,
      cookie,
      '54.179.188.61',
      stripeKey,
      'previewsig',
      'previewkey',
      'preview-key-material',
    ]) {
      expect(output).not.toContain(forbidden);
    }
    expect(output).toContain('<redacted>');
    expect(output).toContain('DATABASE_URL=<redacted>');
    expect(output).toContain('Authorization: <redacted>');
    expect(output).toContain('cookie: <redacted>');
  });

  it('buffers incomplete lines so split tokens are not forwarded raw', () => {
    let output = '';
    const forwarder = createRedactedStreamForwarder((text: string) => {
      output += text;
    });

    forwarder.write('Authorization: Bear');
    expect(output).toBe('');
    forwarder.write('er split-preview-token\n');
    expect(output).not.toContain('split-preview-token');
    expect(output).toContain('Authorization: <redacted>');
  });

  it('keeps safe-preview as a direct Next dev wrapper without inherited raw stdio', () => {
    const script = readFileSync(join(process.cwd(), 'scripts', 'safe-preview.mjs'), 'utf8');
    expect(script).toContain("APP_ENV: 'development'");
    expect(script).toContain("BOT_ADAPTER_MODE: 'mock'");
    expect(script).toContain("FEATURE_LIVE_BOT_CONTROL: 'false'");
    expect(script).toContain("FEATURE_TV_AUTOMATION: 'false'");
    expect(script).toContain("const nextCli = join(root, 'node_modules', 'next', 'dist', 'bin', 'next')");
    expect(script).toContain("'--hostname', '0.0.0.0'");
    expect(script).toContain("'--port', '3000'");
    expect(script).toContain('shell: false');
    expect(script).toContain("stdio: ['inherit', 'pipe', 'pipe']");
    expect(script).not.toContain("stdio: 'inherit'");
  });
});
