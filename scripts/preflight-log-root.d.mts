export type PreflightLogRoot = {
  absoluteRoot: string;
  displayRoot: string;
};

export function resolvePreflightLogRoot(rawRoot: string | undefined | null, fallbackRoot: string): PreflightLogRoot;
export function writePreflightSummary(logRoot: PreflightLogRoot, summary: { runId: string; [key: string]: unknown }): string;
