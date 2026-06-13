import type { TortilaCalendar, TortilaCalendarDay } from '@wtc/bot-adapters';

interface CalendarHeatmapProps {
  calendar: TortilaCalendar;
}

function colorForPnl(pnl: number, maxAbs: number): string {
  if (maxAbs <= 0 || Math.abs(pnl) < 0.005) return 'rgba(255, 255, 255, 0.035)';
  const intensity = Math.min(1, Math.abs(pnl) / maxAbs);
  // Use 5 tiers for a GitHub-style ramp.
  const tier = intensity < 0.2 ? 0.18 : intensity < 0.45 ? 0.34 : intensity < 0.7 ? 0.52 : 0.7;
  if (pnl > 0) return `rgba(84, 214, 161, ${tier})`;
  return `rgba(255, 107, 116, ${tier})`;
}

/** GitHub-style daily P&L heatmap. Rows are days-of-week (Mon..Sun), columns
 *  are weeks. Pure CSS grid; each cell carries a `title` for hover tooltips. */
export function CalendarHeatmap({ calendar }: CalendarHeatmapProps) {
  // Bucket days into a 7-row grid keyed by week. The journal returns days in
  // ascending date order starting on the most-recent calendar-aligned Monday.
  const cols: TortilaCalendarDay[][] = [];
  let current: TortilaCalendarDay[] = [];
  for (const day of calendar.days) {
    if (day.dow === 0 && current.length > 0) {
      cols.push(current);
      current = [];
    }
    current.push(day);
  }
  if (current.length > 0) cols.push(current);

  return (
    <div className="tov-calendar" style={{ gridAutoColumns: 'minmax(8px, 1fr)' }}>
      {cols.flatMap((col, ci) =>
        Array.from({ length: 7 }, (_, di) => {
          const day = col.find((d) => d.dow === di);
          if (!day) return <div key={`${ci}-${di}`} className="tov-cal-cell" style={{ background: 'transparent' }} />;
          const bg = colorForPnl(day.pnl, calendar.max_abs);
          const label = `${day.date} - ${day.pnl >= 0 ? '+' : ''}${day.pnl.toFixed(2)} USDT`;
          return <div key={`${ci}-${di}`} className="tov-cal-cell" style={{ background: bg }} title={label} />;
        }),
      )}
    </div>
  );
}
