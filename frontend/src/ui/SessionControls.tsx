import { useEffect, useState } from "react";
import { useAppStore } from "@/state/store";

/**
 * Floating session chrome moved off the retired top HUD: faction side,
 * country roster, and intel feed status.
 */
export function SessionControls() {
  const intel = useAppStore((s) => s.intel);
  const lastIntelLoadAt = useAppStore((s) => s.lastIntelLoadAt);
  const intelError = useAppStore((s) => s.intelError);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const ago = lastIntelLoadAt
    ? Math.max(0, Math.round((now - lastIntelLoadAt) / 1000))
    : null;

  return (
    <div className="flex shrink-0 items-center gap-3 divide-x divide-[var(--hairline)] px-2">
      <TeamBar />
      <div className="flex items-center gap-2 pl-3">
        <CountriesButton />
        <IntelTickBadge source={intel?.source ?? null} tickSeq={intel?.tick_seq ?? null} ago={ago} error={intelError} />
      </div>
    </div>
  );
}

function TeamBar() {
  const team = useAppStore((s) => s.playerTeam);
  const setTeam = useAppStore((s) => s.setPlayerTeam);
  return (
    <div
      role="radiogroup"
      aria-label="Player team"
      className="inline-flex h-7 items-stretch border border-[var(--hairline)] bg-ink-700/40"
    >
      <TeamBarOption
        label="blue"
        selected={team === "blue"}
        onSelect={() => setTeam("blue")}
        className="border-r border-[var(--hairline)]"
        accent="var(--faction-nato)"
        activeClassName="text-faction-nato"
        idleClassName="text-ink-300 hover:text-faction-nato/90"
        title="Play as blue-side (NATO / allied) forces"
      />
      <TeamBarOption
        label="red"
        selected={team === "red"}
        onSelect={() => setTeam("red")}
        accent="var(--faction-ru)"
        activeClassName="text-faction-ru"
        idleClassName="text-ink-300 hover:text-faction-ru/90"
        title="Play as red-side forces"
      />
    </div>
  );
}

function TeamBarOption({
  label,
  selected,
  onSelect,
  className: wrapClass = "",
  accent,
  activeClassName,
  idleClassName,
  title: tip,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  className?: string;
  accent: string;
  activeClassName: string;
  idleClassName: string;
  title: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      title={tip}
      onClick={onSelect}
      className={`relative min-w-[3.5rem] px-2 font-mono text-[9px] uppercase tracking-wider2 transition-colors ${
        selected ? activeClassName : idleClassName
      } ${wrapClass}`}
      style={selected ? { background: `${accent}14` } : undefined}
    >
      {label}
      {selected && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-2 -top-px h-[2px]"
          style={{ background: accent }}
        />
      )}
    </button>
  );
}

function CountriesButton() {
  const open = useAppStore((s) => s.rosterOpen);
  const setOpen = useAppStore((s) => s.setRosterOpen);
  const count = useAppStore((s) => s.scenario?.countries.length ?? 0);
  if (count === 0) return null;
  return (
    <button
      onClick={() => setOpen(!open)}
      aria-pressed={open}
      className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[10px] uppercase tracking-wider2 transition-colors ${
        open
          ? "border-accent-amber/60 bg-accent-amber/10 text-accent-amber"
          : "border-[var(--hairline)] text-ink-100 hover:border-[var(--hairline-strong)] hover:text-ink-50"
      }`}
      type="button"
    >
      <span className="text-ink-300">countries</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

function IntelTickBadge({
  source,
  tickSeq,
  ago,
  error,
}: {
  source: string | null;
  tickSeq: number | null;
  ago: number | null;
  error: string | null;
}) {
  if (error) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider2">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-accent-danger"
          style={{ boxShadow: "0 0 6px var(--accent-danger)" }}
        />
        <span className="text-ink-300">intel</span>
        <span className="text-accent-danger">offline</span>
      </span>
    );
  }
  if (ago == null) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider2">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink-200" />
        <span className="text-ink-300">intel</span>
        <span className="text-ink-200">warming up</span>
      </span>
    );
  }
  const stale = ago > 10;
  const valueClass = stale ? "text-accent-amber" : "text-accent-ok";
  const dotColor = stale ? "var(--accent-amber)" : "var(--accent-ok)";
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider2">
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
      />
      <span className="text-ink-300">intel</span>
      <span className={valueClass}>
        {source ?? "?"}
        {tickSeq != null && tickSeq > 0 ? ` #${tickSeq}` : ""}
      </span>
      <span className="text-ink-300 tabular-nums">{ago}s</span>
    </span>
  );
}
