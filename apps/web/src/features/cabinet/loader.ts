import 'server-only';
/**
 * Cabinet data layer (server-only) for the /app overview. For each product it resolves the
 * fail-closed access decision (accessFor → @wtc/entitlements) and, ONLY when access is allowed,
 * gathers that product's setup/activity signals from the existing per-feature loaders. The pure
 * @wtc/cabinet deriver turns each into a ProductCabinetCard view-model.
 *
 * FAIL CLOSED / data-minimisation (security audit F-01, 20260531-0005): per-user signals are fetched
 * INSIDE the `decision.allowed` branch — a user without an active/grace entitlement never triggers a
 * setup/activity query for that product (no data exposure, and ~no DB round-trips for unowned products).
 * Static product facts (B3/B4 blockers, availability) are NOT user data and are surfaced regardless.
 *
 * No business logic lives in the React page — it consumes loadCabinet()'s view-models directly.
 */
import { accessFor } from '@/lib/access';
import { backendMode } from '@/lib/backend';
import { loadBotReadinessForUser } from '@/features/bots/readiness-loader';
import { loadTvUserData } from '@/features/tv/queries';
import { loadStudentCatalogue } from '@/features/lms/queries';
import { PRODUCT_CODES, PRODUCTS, type ProductCode, type AccessDecision } from '@wtc/entitlements';
import { productAvailability } from '@/lib/product-status';
import { BOT_CAPS } from '@/features/bots/meta';
import { knownWarningsForProduct, warningSummaryFromWarnings, type BotProductCode } from '@wtc/bot-adapters';
import {
  deriveProductCard,
  type CabinetCardView,
  type CabinetSignals,
  type CabinetWarnings,
  type BlockerRef,
} from '@wtc/cabinet';

const DESC: Record<ProductCode, string> = {
  tortila_bot: 'Turtle-system bot — journal, risk dashboard, backtester.',
  legacy_bot: 'RSI/CCI averaging bot, normalized analytics.',
  axioma_terminal: 'Premium desktop terminal, bridged via WTC.',
  tradingview_indicators: 'Indicator access via your TradingView username.',
  education: 'Lessons, materials, and community.',
  club: 'Private WTC club access.',
};

const HREF: Record<ProductCode, string> = {
  tortila_bot: '/app/bots/tortila',
  legacy_bot: '/app/bots/legacy',
  axioma_terminal: '/app/terminal',
  tradingview_indicators: '/app/indicators',
  education: '/app/education',
  club: '/app/billing',
};

/** Static product blocker (NOT user data — surfaced regardless of entitlement). */
function blockerFor(code: ProductCode): BlockerRef | null {
  if (code === 'legacy_bot' && BOT_CAPS.legacy_bot.liveAdapterBlocked) return 'B3';
  if (code === 'axioma_terminal') return 'B4'; // CTAs disabled until the Axioma handoff is provisioned
  return null;
}

/** Effective entitlement end (epoch ms) — the soonest of currentPeriodEnd / expiresAt, if any. */
function effectiveEnd(d: AccessDecision): number | null {
  const e = d.entitlement;
  if (!e) return null;
  const ends: number[] = [];
  if (typeof e.currentPeriodEnd === 'number') ends.push(e.currentPeriodEnd);
  if (typeof e.expiresAt === 'number') ends.push(e.expiresAt);
  return ends.length ? Math.min(...ends) : null;
}

function botWarningsSummary(code: BotProductCode): CabinetWarnings {
  return warningSummaryFromWarnings(knownWarningsForProduct(code));
}

/**
 * Per-product setup/activity signals. Called ONLY for an allowed product (the caller gates this).
 * Returns honest values from the real backend — never fabricated; in demo mode the underlying loaders
 * return empty/null and the card carries the demo-persistence note instead.
 */
async function gatherSignals(userId: string, code: ProductCode, decision: AccessDecision): Promise<CabinetSignals> {
  switch (code) {
    case 'tortila_bot':
    case 'legacy_bot': {
      const readiness = await loadBotReadinessForUser({ id: userId, roles: [] }, code, 'cabinet', {
        includeOperationalRows: false,
        access: decision,
      });
      const strategyConfigured = readiness.config.source !== 'built_in';
      const readinessItems = readiness.items.map(({ label, status, value, detail }) => ({ label, status, value, detail }));
      const connectionReady = code === 'legacy_bot'
        ? readiness.providerPubIdState === 'db_mapping_confirmed'
        : readiness.exchangeKeyState === 'vault_metadata_confirmed';
      const signals: CabinetSignals = {
        setupItems: code === 'legacy_bot'
          ? [
              { label: connectionReady ? 'Legacy provider pub_id mapped in WTC DB' : 'Admin maps one active Legacy provider pub_id', done: connectionReady },
              { label: 'Choose or save a strategy configuration', done: strategyConfigured },
            ]
          : [
              {
                label: connectionReady
                  ? 'Exchange vault metadata confirmed - live ping not available yet'
                  : 'Add exchange key metadata - live ping not available yet',
                done: connectionReady,
              },
              { label: 'Choose or save a strategy configuration', done: strategyConfigured },
            ],
        readinessItems,
        activityLine: strategyConfigured
          ? code === 'tortila_bot' && connectionReady
            ? `Strategy source: ${readiness.config.sourceLabel}; exchange metadata confirmed, live ping not run`
            : `Strategy source: ${readiness.config.sourceLabel}`
          : null,
        activityAt: null,
      };
      signals.warnings = botWarningsSummary(code);
      return signals;
    }
    case 'tradingview_indicators': {
      const tv = await loadTvUserData(userId);
      const hasUsername = tv.profile != null || tv.requests.length > 0;
      return {
        setupItems: [{ label: 'Submit your TradingView username', done: hasUsername }],
        activityLine: hasUsername ? 'TradingView username on file' : null,
      };
    }
    case 'education': {
      const cat = await loadStudentCatalogue(userId, true);
      const inProgress = cat.courses.filter((c) => c.progressPct > 0).length;
      const n = cat.courses.length;
      return {
        setupItems: [],
        activityLine: n > 0 ? `${n} course${n === 1 ? '' : 's'} available${inProgress > 0 ? `, ${inProgress} in progress` : ''}` : null,
      };
    }
    case 'axioma_terminal':
      // Download / Open-Journal / account-link are disabled (B4) — no setup checklist, no fabricated activity.
      return { setupItems: [], activityLine: null };
    case 'club':
      return { setupItems: [] };
  }
}

export interface CabinetData {
  mode: 'postgres' | 'memory';
  cards: CabinetCardView[];
  /** number of products with an active/grace entitlement. */
  activeCount: number;
  /** total persistent warnings across OWNED products (already entitlement-gated). */
  noticeCount: number;
}

/** Load the full cabinet view-model set for a user. */
export async function loadCabinet(userId: string): Promise<CabinetData> {
  const now = Date.now();
  const isDemo = backendMode === 'memory';
  const checkoutEnabled = process.env.BILLING_CHECKOUT_ENABLED === 'true';

  const decisions = await Promise.all(PRODUCT_CODES.map((code) => accessFor(userId, code)));

  const cards = await Promise.all(
    PRODUCT_CODES.map(async (code, i): Promise<CabinetCardView> => {
      const decision = decisions[i]!;
      const signals = decision.allowed ? await gatherSignals(userId, code, decision) : undefined;
      return deriveProductCard({
        productCode: code,
        name: PRODUCTS[code].name,
        description: DESC[code],
        href: HREF[code],
        reason: decision.reason,
        allowed: decision.allowed,
        periodEnd: effectiveEnd(decision),
        availability: productAvailability(code).status,
        isDemo,
        blockerRef: blockerFor(code),
        checkoutEnabled,
        signals,
        now,
      });
    }),
  );

  return {
    mode: isDemo ? 'memory' : 'postgres',
    cards,
    activeCount: cards.filter((c) => c.allowed).length,
    noticeCount: cards.reduce((sum, c) => sum + c.warnings.count, 0),
  };
}
