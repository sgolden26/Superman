import type { TheatreSnapshot } from '@/types/snapshot';
import { cn } from '@/lib/classnames';

export interface FactionStripProps {
  snapshot: TheatreSnapshot;
}

/** Compact faction row with unit counts, keyed by `snapshot.factions`. */
export default function FactionStrip({ snapshot }: FactionStripProps) {
  const counts = new Map<string, number>();
  for (const u of snapshot.units) {
    counts.set(u.faction_id, (counts.get(u.faction_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {snapshot.factions.map((f) => (
        <div
          key={f.id}
          className={cn(
            'flex items-center gap-2 rounded-deck border border-mil-600 bg-mil-800/80 px-2.5 py-1.5 text-[11px]',
            'uppercase tracking-wider2 text-mil-100',
          )}
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: f.color, boxShadow: `0 0 0 1px var(--mil-500)` }}
            aria-hidden
          />
          <span className="font-semibold">{f.name}</span>
          <span className="text-mil-300">{counts.get(f.id) ?? 0} units</span>
        </div>
      ))}
    </div>
  );
}
