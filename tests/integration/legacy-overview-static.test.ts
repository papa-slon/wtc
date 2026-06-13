/**
 * Static contract test for the premium legacy (DCA/averaging) overview.
 *
 * Reads source files (no Next runtime, no DB, no live shim) and locks the
 * honesty + wiring + security invariants the type system cannot enforce:
 *   - the statistics page mounts <LegacyOverview> for legacy_bot via
 *     loadLegacyLiveOverview() + LEGACY_DCA_CAPS, with an honest fallback;
 *   - the data loader fails closed, never fabricates, carries the token
 *     server-side, and returns status:'empty' for an all-zero shim;
 *   - the /api/bots/legacy/overview proxy is session + entitlement gated;
 *   - the overview renders RECONSTRUCTED money (relative, baseline 0) and NEVER
 *     a wallet equity, a "% since start", the ~100% tp_completion_rate, or any
 *     win-rate/Sharpe/Sortino/funding vanity metric;
 *   - the read path never routes around the hard-blocked legacy control adapter.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const statsPage = read('apps/web/src/app/(app)/app/bots/statistics/page.tsx');
const overviewIndex = read('apps/web/src/features/bots/legacy-overview/index.tsx');
const overviewData = read('apps/web/src/features/bots/legacy-overview-data.ts');
const overviewRoute = read('apps/web/src/app/api/bots/legacy/overview/route.ts');
const reader = read('packages/bot-adapters/src/legacy/legacy-journal-reader.ts');
const adapterIndex = read('packages/bot-adapters/src/index.ts');
const factory = read('packages/bot-adapters/src/factory.ts');
const stuckBag = read('apps/web/src/features/bots/legacy-overview/stuck-bag-card.tsx');

describe('Legacy premium overview: page wiring', () => {
  it('mounts <LegacyOverview> on the statistics page for legacy_bot via the live loader + caps', () => {
    expect(statsPage).toMatch(/import \{ LegacyOverview, LEGACY_DCA_CAPS \} from '@\/features\/bots\/legacy-overview'/);
    expect(statsPage).toMatch(/import \{ loadLegacyLiveOverview, loadLegacyAccounts \} from '@\/features\/bots\/legacy-overview-data'/);
    expect(statsPage).toMatch(/<LegacyOverview overview=\{live\} caps=\{LEGACY_DCA_CAPS\}/);
    expect(statsPage).toMatch(/live\.status === 'live'/);
  });

  it('renders an honest fallback (never a fabricated $0) when the shim is unconfigured / empty / unreachable', () => {
    expect(statsPage).toMatch(/No reconstructed numbers to show/);
    expect(statsPage).toMatch(/never fabricates a \$0 account or placeholder positions/);
  });
});

describe('Legacy overview: reader is exported, read-only, and never the blocked control adapter', () => {
  it('exports the reader + guard from @wtc/bot-adapters', () => {
    expect(adapterIndex).toMatch(/createLegacyJournalReader/);
    expect(adapterIndex).toMatch(/isLegacyJournalError/);
  });

  it('reader uses Authorization: Bearer and returns an error envelope (never throws)', () => {
    expect(reader).toMatch(/authorization\s*=\s*`Bearer \$\{token\}`/);
    expect(reader).toMatch(/LEGACY_JOURNAL_TOKEN is not configured/);
    expect(reader).toMatch(/error: err instanceof Error \? err\.message : 'network error'/);
  });

  it('reader exposes hasToken (not the secret) and documents it is NOT the blocked control path', () => {
    expect(reader).toMatch(/return \{\s*baseUrl: base,\s*hasToken,/);
    expect(reader).not.toMatch(/return \{[^}]*\btoken:/s);
    expect(reader).toMatch(/createLegacyBlockedAdapter/); // referenced only in the "this is NOT that" security comment
    expect(reader).toMatch(/api_management/); // documents it never touches the control endpoint
  });

  it('the hard-blocked legacy CONTROL adapter is untouched (read path is interface-only)', () => {
    expect(factory).toMatch(/createLegacyBlockedAdapter\(\)/);
    expect(factory).toMatch(/legacyJournalUrl/); // the new read var is documented as NOT activating a real adapter
    expect(factory).toMatch(/cannot activate a real adapter/);
  });
});

describe('Legacy overview: data loader fails closed + never fabricates', () => {
  it('is server-only and reads options from botAdapterOptions()', () => {
    expect(overviewData).toMatch(/import 'server-only'/);
    expect(overviewData).toMatch(/import \{ botAdapterOptions \} from '@\/lib\/server-config'/);
    expect(overviewData).toMatch(/const opts = botAdapterOptions\(\)/);
  });

  it('fails closed when mode is mock or URL/token is missing (no synthetic data)', () => {
    expect(overviewData).toMatch(/opts\.mode !== 'mock'/);
    expect(overviewData).toMatch(/LEGACY_JOURNAL_URL is not set/);
    expect(overviewData).toMatch(/LEGACY_JOURNAL_TOKEN is not set/);
  });

  it('returns a per-slice error/data shape so one endpoint failure does not block others', () => {
    expect(overviewData).toMatch(/LegacyOverviewSlice<T>/);
    expect(overviewData).toMatch(/await Promise\.all\(\[/);
  });

  it('reports status:"empty" for an all-zero shim instead of a fabricated $0 account', () => {
    expect(overviewData).toMatch(/status: 'empty'/);
    expect(overviewData).toMatch(/reconstructed no closed cycles/);
  });

  it('guards net-per-cycle against divide-by-zero (null, not NaN/Infinity)', () => {
    expect(overviewData).toMatch(/closedCycles > 0 \? summary\.realized_pnl_net \/ closedCycles : null/);
  });

  it('constructs the reader with the token (token stays server-side, never inlined in a URL)', () => {
    expect(overviewData).toMatch(/createLegacyJournalReader\(baseUrl, opts\.legacyReadToken\)/);
  });
});

describe('Legacy overview: API route is session + entitlement gated', () => {
  it('refuses unauthenticated requests with 401 and missing entitlement with 403', () => {
    expect(overviewRoute).toMatch(/await getCurrentUser\(\)/);
    expect(overviewRoute).toMatch(/error: 'unauthenticated' \}, \{ status: 401/);
    expect(overviewRoute).toMatch(/botAccessForUser\(user, 'legacy_bot'\)/);
    expect(overviewRoute).toMatch(/status: 403/);
  });

  it('ships only the parsed payload, never the token-bearing options', () => {
    expect(overviewRoute).toMatch(/NextResponse\.json\(payload/);
    expect(overviewRoute).not.toMatch(/process\.env\.LEGACY_JOURNAL_TOKEN/);
    expect(overviewRoute).not.toMatch(/botAdapterOptions/);
  });

  it('runs on nodejs runtime and never caches', () => {
    expect(overviewRoute).toMatch(/export const runtime = 'nodejs'/);
    expect(overviewRoute).toMatch(/export const dynamic = 'force-dynamic'/);
    expect(overviewRoute).toMatch(/'cache-control': 'no-store'/);
  });
});

describe('Legacy overview: honesty contract (reconstructed, not wallet; no vanity metrics)', () => {
  it('renders the standing reconstruction banner + reconstructed net PnL (NOT wallet equity)', () => {
    expect(overviewIndex).toMatch(/Reconstructed analytics/);
    expect(overviewIndex).toMatch(/Reconstructed net PnL/);
    expect(overviewIndex).toMatch(/RECONSTRUCTED/);
  });

  it('treats equity as relative (baseline 0) — initialEquity is 0 unless equityIsWallet', () => {
    expect(overviewIndex).toMatch(/initialEquity=\{caps\.equityIsWallet \?/);
    expect(overviewIndex).toMatch(/: 0\}/);
  });

  it('never renders the ~100% tp_completion_rate or a "% since start" capital-return metric', () => {
    // The component never references the suppressed completion rate (the loader/schema do).
    // (Sharpe/Sortino/win-rate appear ONLY in the capability comments that explain they are hidden;
    // their absence from the render is locked by the hasRiskRatios/hasWinLossStats flags below.)
    expect(overviewIndex).not.toMatch(/tp_completion_rate/);
    expect(overviewIndex).not.toMatch(/% since start/);
    expect(overviewIndex).not.toMatch(/pnlPctSinceStart/);
  });

  it('encodes the honesty rules in the LEGACY_DCA_CAPS capability literal', () => {
    expect(overviewIndex).toMatch(/hasLiveMark: false/);
    expect(overviewIndex).toMatch(/hasStopLoss: false/);
    expect(overviewIndex).toMatch(/hasWinLossStats: false/);
    expect(overviewIndex).toMatch(/equityIsWallet: false/);
  });

  it('composes DCA leaves + reused Tortila leaves with recon tags', () => {
    for (const sym of ['DepthGauge', 'SignalMix', 'StuckBagCard', 'EquityPanel', 'SymbolContribution', 'ActivityFeed', 'Sparkline']) {
      expect(overviewIndex).toContain(sym);
    }
    expect(overviewIndex).toMatch(/ReconTag/);
    expect(overviewIndex).toMatch(/\(recon\)/);
  });
});

describe('Legacy overview: stuck-bag card structurally omits mark / stop / price-ladder', () => {
  it('does not draw a PriceLadder, and never computes unrealized PnL / reads a mark / reads a stop', () => {
    // "PositionCard" appears only in the honest "Deliberately NOT a PositionCard variant" comment.
    expect(stuckBag).not.toMatch(/PriceLadder/);
    expect(stuckBag).not.toMatch(/computeUpnl|markPx|unrealized_pnl|stopPrice/);
  });

  it('renders only honest, directly-available fields (averaged entry w/ unavailable state, depth, stage, trigger, held)', () => {
    expect(stuckBag).toMatch(/Averaged entry/);
    expect(stuckBag).toMatch(/averaged_entry_available/);
    expect(stuckBag).toMatch(/unavailable/);
    expect(stuckBag).toMatch(/averaging_depth/);
  });
});

describe('Legacy account switcher: admin-gated, masked, no key leak', () => {
  it('reader exposes getAccounts + per-account scoping (api_id), injection-encoded', () => {
    expect(reader).toMatch(/getAccounts\(\)/);
    expect(reader).toMatch(/function withAccount/);
    expect(reader).toMatch(/api_id=\$\{encodeURIComponent\(accountId\)\}/);
  });

  it('loader scopes reads by accountId and lists accounts without throwing', () => {
    expect(overviewData).toMatch(/loadLegacyAccounts/);
    expect(overviewData).toMatch(/loadLegacyOverviewPayload\(accountId\)/);
    expect(overviewData).toMatch(/reader\.getSummary\(accountId\)/);
  });

  it('page gates the account scope + selector to ADMINS only (a non-admin cannot scope)', () => {
    expect(statsPage).toMatch(/isAdmin/);
    expect(statsPage).toMatch(/const effectiveAccount = admin \? account : undefined/);
    expect(statsPage).toMatch(/admin \? loadLegacyAccounts\(\) : Promise\.resolve\(null\)/);
    expect(statsPage).toMatch(/admin && accounts\.length > 0/);
  });

  it('masks pub_id for display and never references exchange-key fields in the page', () => {
    expect(statsPage).toMatch(/maskPubId/);
    expect(statsPage).not.toMatch(/api_key|secret_key/);
  });
});
