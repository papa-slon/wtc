export function toSlash(path: string): string;
export function realWorkspaceRoot(): string;
export function isInsideRealWorkspace(path: string): boolean;
export function assertWorkspaceRealPath(path: string, kind: string): string;
export function assertNoLinkedExistingSegments(path: string, kind: string): void;
export function ensurePlainWorkspaceDirectory(path: string, kind: string): string;
export function assertPlainWorkspaceFile(path: string, kind: string): string;
export function assertPlainWorkspaceRoot(path: string, kind: string): string;
export function openExclusivePlainWorkspaceFile(path: string, kind: string): number;
