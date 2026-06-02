import 'server-only';
import type { BotAdapterMode, AdapterOptions } from '@wtc/bot-adapters';

/** Resolve BOT_ADAPTER_MODE from env, fail-safe to 'mock' for any unknown value. */
export function botAdapterMode(): BotAdapterMode {
  const m = process.env.BOT_ADAPTER_MODE;
  return m === 'read-only' || m === 'audited' ? m : 'mock';
}

export function botAdapterOptions(): AdapterOptions {
  return {
    mode: botAdapterMode(),
    // Canonical env var is TORTILA_JOURNAL_URL; TORTILA_JOURNAL_BASE_URL kept as a back-compat fallback.
    tortilaBaseUrl: process.env.TORTILA_JOURNAL_URL ?? process.env.TORTILA_JOURNAL_BASE_URL,
    legacyBaseUrl: process.env.LEGACY_BOT_BASE_URL,
    // JOURNAL_READ_TOKEN: bearer auth for the journal. Absent in a real mode ⇒ readState not_configured.
    tortilaReadToken: process.env.JOURNAL_READ_TOKEN,
  };
}

/** True when the Axioma bridge is the dev/mock placeholder (no real bridge wired). */
export function axiomaBridgeIsDev(): boolean {
  return !process.env.AXIOMA_BRIDGE_API_TOKEN;
}
