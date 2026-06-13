'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TortilaTradeRow } from '@wtc/bot-adapters';
import {
  fmtPriceAuto,
  fmtHold,
  fmtSignedOrDash,
  fmtPctOrDash,
  shortSymbol,
  fmtShortTs,
  signClass,
} from './format';

interface TradePage {
  total: number;
  page: number;
  page_size: number;
  pages: number;
  rows: TortilaTradeRow[];
}

interface TradeHistoryProps {
  /** Distinct symbols (full CCXT form) to populate the symbol filter. */
  symbols: string[];
  /** Rows per page requested from the journal. */
  pageSize?: number;
  /** Whether the live journal is configured. When false the island renders a
   *  static hint and does not fetch. */
  enabled: boolean;
}

const EXIT_REASONS = ['stop', 'exit_signal', 'take_profit', 'manual', 'adopted_close'] as const;
type FetchState = 'idle' | 'loading' | 'error';

/**
 * Group I — trade history as a client island. Filters (symbol / side / exit
 * reason) + prev/next pagination, backed by the server proxy at
 * `/api/bots/tortila/trades` (which keeps the journal bearer token server-side).
 * The journal trade row carries `units`, so the U column is honest here (the
 * canonical trade shape drops it — see G2).
 */
export function TradeHistory({ symbols, pageSize = 50, enabled }: TradeHistoryProps) {
  const [page, setPage] = useState(1);
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState('');
  const [exitReason, setExitReason] = useState('');
  const [data, setData] = useState<TradePage | null>(null);
  const [state, setState] = useState<FetchState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const reqId = useRef(0);

  const load = useCallback(
    async (nextPage: number) => {
      if (!enabled) return;
      const id = ++reqId.current;
      setState('loading');
      setErrorMsg(null);
      const qs = new URLSearchParams({ page: String(nextPage), page_size: String(pageSize) });
      if (symbol) qs.set('symbol', symbol);
      if (side) qs.set('side', side);
      if (exitReason) qs.set('exit_reason', exitReason);
      try {
        const res = await fetch(`/api/bots/tortila/trades?${qs.toString()}`, { cache: 'no-store' });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          if (id === reqId.current) {
            setState('error');
            setErrorMsg(body?.error ?? `Request failed (HTTP ${res.status}).`);
          }
          return;
        }
        const json = (await res.json()) as TradePage;
        if (id === reqId.current) {
          setData(json);
          setState('idle');
        }
      } catch {
        if (id === reqId.current) {
          setState('error');
          setErrorMsg('Network error while loading trades.');
        }
      }
    },
    [enabled, pageSize, symbol, side, exitReason],
  );

  // Reset to page 1 whenever a filter changes, then (re)fetch. `load` is a
  // stable useCallback over exactly these inputs, so depending on it is correct.
  useEffect(() => {
    setPage(1);
    void load(1);
  }, [load]);

  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;
  const rows = data?.rows ?? [];
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(total, page * pageSize);

  const go = useCallback(
    (delta: number) => {
      const next = Math.min(Math.max(1, page + delta), Math.max(1, pages));
      if (next === page) return;
      setPage(next);
      void load(next);
    },
    [page, pages, load],
  );

  const symbolOptions = useMemo(
    () => Array.from(new Set(symbols)).sort((a, b) => shortSymbol(a).localeCompare(shortSymbol(b))),
    [symbols],
  );

  if (!enabled) {
    return <div className="tov-empty-mini">Trade history loads from the live journal once the data source is configured.</div>;
  }

  return (
    <div className="wtc-stack" style={{ gap: 12 }}>
      <div className="tov-row-between">
        <div className="tov-filterbar">
          <select aria-label="Filter by symbol" className="tov-filter" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            <option value="">All symbols</option>
            {symbolOptions.map((s) => (
              <option key={s} value={s}>{shortSymbol(s)}</option>
            ))}
          </select>
          <select aria-label="Filter by side" className="tov-filter" value={side} onChange={(e) => setSide(e.target.value)}>
            <option value="">Long / Short</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
          <select aria-label="Filter by exit reason" className="tov-filter" value={exitReason} onChange={(e) => setExitReason(e.target.value)}>
            <option value="">Exit reason</option>
            {EXIT_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <span className="tov-mute-xs tov-mono">
          {state === 'loading' && rows.length === 0 ? 'loading…' : `showing ${showingFrom}-${showingTo} of ${total}`}
        </span>
      </div>

      {state === 'error' ? (
        <div className="tov-empty-mini tov-down">Could not load trades: {errorMsg}</div>
      ) : rows.length === 0 && state !== 'loading' ? (
        <div className="tov-empty-mini">No trades match the current filter.</div>
      ) : (
        <div className="wtc-table-wrap" aria-busy={state === 'loading'} style={{ opacity: state === 'loading' ? 0.6 : 1 }}>
          <table className="tov-trade-table">
            <thead>
              <tr>
                <th>Closed</th>
                <th>Symbol</th>
                <th>Side</th>
                <th className="num">U</th>
                <th className="num">Entry</th>
                <th className="num">Exit</th>
                <th className="num">Ret%</th>
                <th className="num">Hold</th>
                <th className="num">Gross</th>
                <th className="num">Fees</th>
                <th className="num">Fund</th>
                <th className="num">Net</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td data-label="Closed">{fmtShortTs(t.closed_at)}</td>
                  <td data-label="Symbol">{shortSymbol(t.symbol)}</td>
                  <td data-label="Side"><span className={`tov-chip ${t.side}`}>{t.side.toUpperCase()}</span></td>
                  <td data-label="U" className="num">{t.units}</td>
                  <td data-label="Entry" className="num">{fmtPriceAuto(t.entry)}</td>
                  <td data-label="Exit" className="num">{fmtPriceAuto(t.exit)}</td>
                  <td data-label="Ret%" className={`num ${signClass(t.ret_pct)}`}>{fmtPctOrDash(t.ret_pct, 2, true)}</td>
                  <td data-label="Hold" className="num">{fmtHold(t.hold_hours)}</td>
                  <td data-label="Gross" className={`num ${signClass(t.gross_pnl)}`}>{fmtSignedOrDash(t.gross_pnl)}</td>
                  <td data-label="Fees" className="num tov-down">{(-Math.abs(t.fees_pnl)).toFixed(2)}</td>
                  <td data-label="Fund" className={`num ${signClass(t.funding_pnl)}`}>{fmtSignedOrDash(t.funding_pnl)}</td>
                  <td data-label="Net" className={`num ${signClass(t.net_pnl)}`}><strong>{fmtSignedOrDash(t.net_pnl)}</strong></td>
                  <td data-label="Reason"><span className="tov-tag">{t.exit_reason}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="tov-row-between">
        <span className="tov-mute-xs tov-mono">page {page} of {Math.max(1, pages)}</span>
        <div className="wtc-row" style={{ gap: 6 }}>
          <button type="button" className="tov-pager-btn" onClick={() => go(-1)} disabled={page <= 1 || state === 'loading'}>
            ← prev
          </button>
          <button type="button" className="tov-pager-btn" onClick={() => go(1)} disabled={page >= pages || state === 'loading'}>
            next →
          </button>
        </div>
      </div>
    </div>
  );
}
