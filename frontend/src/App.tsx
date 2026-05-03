import type { ReactNode } from 'react';
import { useEffect } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import TheatreMap from '@/map/TheatreMap';
import { useTheatreStore } from '@/state/theatreStore';
import FactionStrip from '@/ui/FactionStrip';
import UnitsTablePanel from '@/ui/UnitsTablePanel';

const POLL_MS = 10_000;

function formatClock(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(d) + ' UTC';
  } catch {
    return iso;
  }
}

/** Main C2 console: theatre map, faction summary, unit table backed by `state.json`. */
export default function App() {
  const snapshot = useTheatreStore((s) => s.snapshot);
  const error = useTheatreStore((s) => s.error);
  const isLoading = useTheatreStore((s) => s.isLoading);
  const refresh = useTheatreStore((s) => s.refresh);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const meta: ReactNode = snapshot ? (
    <div className="flex flex-col items-end gap-0.5 text-[10px] font-medium normal-case tracking-normal text-mil-200">
      <span>{formatClock(snapshot.scenario.clock)}</span>
      <span className="text-mil-400">{snapshot.scenario.classification}</span>
      <span className="font-mono text-mil-300">
        schema {snapshot.schema_version} · {snapshot.units.length} units
      </span>
    </div>
  ) : error ? (
    <span className="normal-case tracking-normal text-accent-danger">{error}</span>
  ) : (
    <span className="normal-case tracking-normal text-mil-400">Loading theatre…</span>
  );

  const mapPlaceholder = error
    ? `Could not load snapshot. ${error}`
    : isLoading && !snapshot
      ? 'Loading state.json…'
      : 'Waiting for theatre data…';

  return (
    <div className="flex h-full flex-col bg-mil-950 font-sans text-mil-100">
      <PageHeader
        title={snapshot?.scenario.name ?? 'Superman C2'}
        description={snapshot?.scenario.id ?? 'Theatre-scale wargame console'}
        meta={meta}
      />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="relative min-h-[40vh] min-w-0 flex-[1.4] border-b border-mil-800 lg:border-b-0 lg:border-r">
          <TheatreMap snapshot={snapshot} placeholder={mapPlaceholder} />
        </section>
        <aside className="flex min-h-0 w-full flex-col bg-mil-900 lg:w-[400px] lg:shrink-0">
          {snapshot ? (
            <>
              <div className="shrink-0 border-b border-mil-800 p-3">
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider2 text-mil-400">
                  Order of battle
                </h3>
                <FactionStrip snapshot={snapshot} />
              </div>
              <div className="flex min-h-0 flex-1 flex-col p-0">
                <UnitsTablePanel snapshot={snapshot} />
              </div>
            </>
          ) : (
            <div className="p-4 text-sm text-mil-300">
              {error
                ? 'Fix data export or server copy, then refresh. Run `python -m superman export` from the backend package.'
                : 'Fetching `state.json` (see README predev copy step)…'}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
