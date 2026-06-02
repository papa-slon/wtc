import { SectionHeader, EmptyState } from '@wtc/ui';

/** Minimal skeleton for a required-but-not-yet-built route. Renders no fake/synthetic data. */
export function Placeholder({ kicker, title, note }: { kicker: string; title: string; note: string }) {
  return (
    <div className="wtc-stack">
      <SectionHeader kicker={kicker} title={title} />
      <EmptyState title="Planned for a later phase" hint={note} />
    </div>
  );
}
