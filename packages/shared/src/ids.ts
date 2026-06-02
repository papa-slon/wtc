/** UUID id generator that works in Node 19+ and browsers (global Web Crypto, no imports). */
export function newId(prefix?: string): string {
  const uuid = globalThis.crypto.randomUUID();
  return prefix ? `${prefix}_${uuid}` : uuid;
}
