import type { TortilaSymbolBreakdownRow } from '@wtc/bot-adapters';
import { shortSymbol, fmtNumberOrDash, fmtSignedOrDash, fmtPf, fmtHold } from './format';

interface SymbolContributionBarsProps {
  rows: TortilaSymbolBreakdownRow[];
}

/** Per-symbol contribution bars + a sortable table. Bars are centered on a
 *  zero line so red/green visually balance. */
export function SymbolContribution({ rows }: SymbolContributionBarsProps) {
  if (rows.length === 0) {
    return <div className="tov-empty-mini">No closed trades yet to break down per symbol.</div>;
  }
  const maxAbs = rows.reduce((m, r) => Math.max(m, Math.abs(r.net_pnl)), 0) || 1;

  return (
    <div className="wtc-stack" style={{ gap: 8 }}>
      <div className="wtc-stack" style={{ gap: 2 }}>
        {rows.map((row) => {
          const pct = Math.abs(row.net_pnl) / maxAbs;
          const isPos = row.net_pnl >= 0;
          const tip = `${shortSymbol(row.symbol)} . net ${fmtSignedOrDash(row.net_pnl)} . ${row.trades} trades . ${fmtNumberOrDash(row.win_rate_pct, 0)}% WR . contrib ${row.contribution_pct >= 0 ? '+' : ''}${row.contribution_pct.toFixed(1)}%`;
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
            <tr>
              <th>Symbol</th>
              <th className="num">Trades</th>
              <th className="num">WR</th>
              <th className="num">Net</th>
              <th className="num">PF</th>
              <th className="num">Avg hold</th>
              <th className="num">Contrib</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isPos = row.net_pnl >= 0;
              const contribIsPos = row.contribution_pct >= 0;
              return (
                <tr key={row.symbol}>
                  <td data-label="Symbol">{shortSymbol(row.symbol)}</td>
                  <td data-label="Trades" className="num">{row.trades}</td>
                  <td data-label="WR" className="num">{fmtNumberOrDash(row.win_rate_pct, 0)}%</td>
                  <td data-label="Net" className={`num ${isPos ? 'tov-up' : 'tov-down'}`}>{fmtSignedOrDash(row.net_pnl)}</td>
                  <td data-label="PF" className="num">{fmtPf(row.profit_factor)}</td>
                  <td data-label="Avg hold" className="num">{fmtHold(row.avg_hold_hours)}</td>
                  <td data-label="Contrib" className={`num ${contribIsPos ? 'tov-up' : 'tov-down'}`}>
                    {`${contribIsPos ? '+' : ''}${row.contribution_pct.toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
