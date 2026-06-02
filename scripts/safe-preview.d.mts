export type RedactedStreamForwarder = {
  write(chunk: string | Buffer | Uint8Array): void;
  flush(): void;
};

export const forcedEnv: Record<string, string>;

export function createRedactedStreamForwarder(write: (text: string) => void): RedactedStreamForwarder;

export function startSafePreview(options?: {
  root?: string;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
}): import('node:child_process').ChildProcess;
