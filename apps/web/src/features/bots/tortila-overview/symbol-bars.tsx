import { shortSymbol, fmtNumberOrDash, fmtSignedOrDash, fmtPf, fmtHold } from './format';

/** Structural row the contribution bars + table read. Tortila rows satisfy it
 *  directly; the legacy (DCA) loader maps its shim rows into the dca-only fields.
 *  Bars use only `symbol`/`net_pnl`/`contribution_pct` (present in both). */
export interface SymbolContributionRow {
  symbol: string;
  net_pnl: number;
  contribution_pct: number;
  // Tortila columns (optional — present on the tortila path)
  trades?: number;
  win_rate_pct?: number;
  profit_factor?: number | null;
  avg_hold_hours?: number;
  // DCA columns (optional — present on the legacy path)
  cycles?: number;
  avg_depth?: number;
}

interface SymbolContributionBarsProps {
  rows: SymbolContributionRow[];
  /** Which table columns to render. 'tortila' (default) is unchanged; 'dca'
   *  drops WR/PF/Avg-hold (no honest source for a DCA bot) and shows
   *  Cycles / Avg depth with a reconstructed-net tag. */
  columns?: 'tortila' | 'dca';
}

/** Per-symbol contribution bars + a sortable table. Bars are centered on a
 *  zero line so red/green visually balance. */
export function SymbolContribution({ rows, columns = 'tortila' }: SymbolContributionBarsProps) {
  if (rows.length === 0) {
    return <div className="tov-empty-mini">No closed trades yet to break down per symbol.</div>;
  }
  const isDca = columns === 'dca';
  const maxAbs = rows.reduce((m, r) => Math.max(m, Math.abs(r.net_pnl)), 0) || 1;

  return (
    <div className="wtc-stack" style={{ gap: 8 }}>
      <div className="wtc-stack" style={{ gap: 2 }}>
        {rows.map((row) => {
          const pct = Math.abs(row.net_pnl) / maxAbs;
          const isPos = row.net_pnl >= 0;
          const tip = isDca
            ? `${shortSymbol(row.symbol)} . net ${fmtSignedOrDash(row.net_pnl)} (recon) . ${row.cycles ?? 0} cycles . avg depth ${fmtNumberOrDash(row.avg_depth ?? null, 2)} . contrib ${row.contribution_pct >= 0 ? '+' : ''}${row.contribution_pct.toFixed(1)}%`
            : `${shortSymbol(row.symbol)} . net ${fmtSignedOrDash(row.net_pnl)} . ${row.trades ?? 0} trades . ${fmtNumberOrDash(row.win_rate_pct ?? null, 0)}% WR . contrib ${row.contribution_pct >= 0 ? '+' : ''}${row.contribution_pct.toFixed(1)}%`;
          return (
            <div key={row.symbol} className="tov-sym-bar-row" title={tip}>
              <span className="name">{shortSymbol(row.symbol)}</span>
              <div className="tov-sym-bar" aria-label={tip}>
                <div className="tov-sym-bar-zero" />
                <div
                  className={`tov-sym-bar-fill ${isPos ? 'up' : 'down'}`}
                  style={{ width: `${(pct * 50).toFixed(2)}%` }}
                />
              </div>
              <span className={`tov-mono ${isPos ? 'tov-up' : 'tov-down'}`} style={{ textAlign: 'right' }}>
                {fmtSignedOrDash(row.net_pnl)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="wtc-table-wrap" style={{ marginTop: 12 }}>
        <table className="tov-trade-table">
          <thead>
            {isDca ? (
              <tr>
                <th>Symbol</th>
                <th className="num">Cycles</th>
                <th className="num">Net (recon)</th>
                <th className="num">Avg depth</th>
                <th className="num">Contrib</th>
              </tr>
            ) : (
              <tr>
                <th>Symbol</th>
                <th className="num">Trades</th>
                <th className="num">WR</th>
                <th className="num">Net</th>
                <th className="num">PF</th>
                <th className="num">Avg hold</th>
                <th className="num">Contrib</th>
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((row) => {
              const isPos = row.net_pnl >= 0;
              const contribIsPos = row.contribution_pct >= 0;
              const contribCell = (
                <td data-label="Contrib" className={`num ${contribIsPos ? 'tov-up' : 'tov-down'}`}>
                  {`${contribIsPos ? '+' : ''}${row.contribution_pct.toFixed(1)}%`}
                </td>
              );
              if (isDca) {
                const deepAvg = (row.avg_depth ?? 0) > 1.5;
                return (
                  <tr key={row.symbol}>
                    <td data-label="Symbol">{shortSymbol(row.symbol)}</td>
                    <td data-label="Cycles" className="num">{row.cycles ?? 0}</td>
                    <td data-label="Net (recon)" className={`num ${isPos ? 'tov-up' : 'tov-down'}`}>{fmtSignedOrDash(row.net_pnl)}</td>
                    <td data-label="Avg depth" className="num" style={deepAvg ? { color: '#f59e0b' } : undefined}>{fmtNumberOrDash(row.avg_depth ?? null, 2)}</td>
                    {contribCell}
                  </tr>
                );
              }
              return (
                <tr key={row.symbol}>
                  <td data-label="Symbol">{shortSymbol(row.symbol)}</td>
                  <td data-label="Trades" className="num">{row.trades ?? 0}</td>
                  <td data-label="WR" className="num">{fmtNumberOrDash(row.win_rate_pct ?? null, 0)}%</td>
                  <td data-label="Net" className={`num ${isPos ? 'tov-up' : 'tov-down'}`}>{fmtSignedOrDash(row.net_pnl)}</td>
                  <td data-label="PF" className="num">{fmtPf(row.profit_factor ?? null)}</td>
                  <td data-label="Avg hold" className="num">{fmtHold(row.avg_hold_hours ?? null)}</td>
                  {contribCell}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
