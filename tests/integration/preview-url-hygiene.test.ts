import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const protectedFiles = [
  'apps/web/next.config.ts',
  'docs/ARCHITECTURE.md',
  'docs/DEPLOYMENT.md',
  'docs/INTEGRATION_MAP.md',
  'docs/PROJECT_CHAT_HANDOFF_20260601.md',
  'docs/NEXT_SESSION_PROMPT_FULL_PLATFORM_20260601.md',
  'docs/OPEN_QUESTIONS.md',
  'docs/STATUS.md',
  'docs/NEXT_ACTIONS.md',
  'docs/IMPLEMENTED_FILES.md',
  'docs/PRODUCTION_BLOCKERS_CURRENT.md',
];

describe('preview URL hygiene', () => {
  it('keeps live preview coordinates out of active source docs and config', () => {
    const rawPreviewHost = ['54', '179', '188', '61'].join('.');
    const rawSshTarget = `ubuntu@${rawPreviewHost}`;
    const demoPassword = ['wtc', 'demo', 'pass', '123'].join('-');
    const previewDb = ['wtc', 'platform', 'preview'].join('_');

    for (const file of protectedFiles) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toContain(rawPreviewHost);
      expect(text, file).not.toContain(rawSshTarget);
      expect(text, file).not.toContain(demoPassword);
      expect(text, file).not.toContain(previewDb);
    }
  });

  it('keeps network preview origins operator-configured instead of hardcoded', () => {
    const text = readFileSync('apps/web/next.config.ts', 'utf8');
    expect(text).toContain('WTC_DEV_ALLOWED_ORIGINS');
    expect(text).not.toMatch(/allowedDevOrigins:\s*\[[^\]]+\d+\.\d+\.\d+\.\d+/);
  });
});
