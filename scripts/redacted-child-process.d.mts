export type RedactedChildProcessOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string | Buffer | Uint8Array;
  maxBuffer?: number;
  windowsHide?: boolean;
  forwardStdout?: boolean;
  forwardStderr?: boolean;
};

export type RedactedChildProcessResult = {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
};

export function redactProcessOutput(input: unknown): string;
export function runRedactedChildProcess(
  command: string,
  args?: readonly string[],
  options?: RedactedChildProcessOptions,
): RedactedChildProcessResult;
