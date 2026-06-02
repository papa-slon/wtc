import { writeFileSync, closeSync } from 'node:fs';
import { isAbsolute, posix, relative, resolve } from 'node:path';
import {
  assertNoLinkedExistingSegments,
  ensurePlainWorkspaceDirectory,
  openExclusivePlainWorkspaceFile,
} from './workspace-path-guard.mjs';

const ROOT = process.cwd();
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const WINDOWS_ABSOLUTE = /^[A-Za-z]:[\\/]/;

export function resolvePreflightLogRoot(rawRoot, fallbackRoot) {
  const raw = (rawRoot ?? '').trim() || fallbackRoot;
  const slashPath = raw.replaceAll('\\', '/');

  if (!raw || URL_SCHEME.test(slashPath) || isAbsolute(raw) || WINDOWS_ABSOLUTE.test(raw) || slashPath.startsWith('//')) {
    throw new Error('preflight log root must be a repo-local logs path');
  }

  const normalized = posix.normalize(slashPath);
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error('preflight log root must be a repo-local logs path');
  }
  if (normalized !== 'logs' && !normalized.startsWith('logs/')) {
    throw new Error('preflight log root must be under logs/');
  }

  const absoluteRoot = resolve(ROOT, ...normalized.split('/'));
  const rel = relative(ROOT, absoluteRoot);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('preflight log root must stay inside the workspace');
  }
  assertNoLinkedExistingSegments(absoluteRoot, 'preflight log root');

  return {
    absoluteRoot,
    displayRoot: normalized,
  };
}

export function writePreflightSummary(logRoot, summary) {
  const realRoot = ensurePlainWorkspaceDirectory(logRoot.absoluteRoot, 'preflight log root');
  const fileName = `summary-${summary.runId}.json`;
  const path = resolve(realRoot, fileName);
  const fd = openExclusivePlainWorkspaceFile(path, 'preflight summary');
  try {
    writeFileSync(fd, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  } finally {
    closeSync(fd);
  }
  return `${logRoot.displayRoot}/${fileName}`;
}
