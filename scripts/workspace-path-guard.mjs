import { existsSync, lstatSync, mkdirSync, openSync, realpathSync, closeSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const ROOT = process.cwd();
const REAL_ROOT = realpathSync.native(ROOT);
const WINDOWS_REPARSE_POINT = 0x400;

export function toSlash(path) {
  return path.replaceAll('\\', '/');
}

function isLinkLike(stats) {
  return stats.isSymbolicLink() || (typeof stats.mode === 'number' && (stats.mode & WINDOWS_REPARSE_POINT) !== 0);
}

export function isInsideRealWorkspace(path) {
  const rel = relative(REAL_ROOT, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function realWorkspaceRoot() {
  return REAL_ROOT;
}

export function assertWorkspaceRealPath(path, kind) {
  const real = realpathSync.native(path);
  if (!isInsideRealWorkspace(real)) throw new Error(`${kind} must resolve inside workspace`);
  return real;
}

export function assertNoLinkedExistingSegments(targetPath, kind) {
  const absolute = resolve(ROOT, targetPath);
  const rel = relative(ROOT, absolute);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`${kind} must be inside workspace`);

  const parts = rel.split(/[\\/]+/).filter(Boolean);
  let current = ROOT;
  for (const part of parts) {
    current = join(current, part);
    if (!existsSync(current)) break;
    const stats = lstatSync(current);
    if (isLinkLike(stats)) throw new Error(`${kind} must not contain linked path components`);
    const real = realpathSync.native(current);
    if (!isInsideRealWorkspace(real)) throw new Error(`${kind} must resolve inside workspace`);
  }
}

export function ensurePlainWorkspaceDirectory(path, kind) {
  assertNoLinkedExistingSegments(path, kind);
  mkdirSync(path, { recursive: true });
  assertNoLinkedExistingSegments(path, kind);
  return assertWorkspaceRealPath(path, kind);
}

export function assertPlainWorkspaceFile(path, kind) {
  assertNoLinkedExistingSegments(path, kind);
  if (!existsSync(path)) throw new Error(`${kind} missing`);
  const stats = lstatSync(path);
  if (!stats.isFile() || isLinkLike(stats)) throw new Error(`${kind} rejected`);
  return assertWorkspaceRealPath(path, kind);
}

export function assertPlainWorkspaceRoot(path, kind) {
  assertNoLinkedExistingSegments(path, kind);
  if (!existsSync(path)) throw new Error(`${kind} missing`);
  const stats = lstatSync(path);
  if (!stats.isDirectory() || isLinkLike(stats)) throw new Error(`${kind} rejected`);
  return assertWorkspaceRealPath(path, kind);
}

export function openExclusivePlainWorkspaceFile(path, kind) {
  const dir = dirname(path);
  ensurePlainWorkspaceDirectory(dir, `${kind} directory`);
  assertNoLinkedExistingSegments(path, kind);
  const fd = openSync(path, 'wx');
  try {
    assertWorkspaceRealPath(path, kind);
  } catch (error) {
    closeSync(fd);
    throw error;
  }
  return fd;
}
