/**
 * Next.js instrumentation — runs once at SERVER BOOT (runtime), NOT during `next build`.
 * (Next 15 bundles this file at build time but only calls register() when the server starts.)
 *
 * We validate the typed environment at boot so a misconfigured `SECRET_VAULT_KEK` (e.g. not a base64
 * 32-byte key) fails fast here instead of lazily on the first vault use. The Node-runtime guard keeps
 * this Node-only config off the edge runtime. The lazy fail-closed vault (@wtc/crypto parseKek +
 * requiredSecret) remains the backstop — this is defence-in-depth, not a replacement.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { loadEnv } = await import('@wtc/config');
    loadEnv();
  }
}
