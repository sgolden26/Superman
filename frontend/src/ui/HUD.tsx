import { useEffect, useState } from "react";
import { useAppStore } from "@/state/store";

export function HUD() {
  const scenario = useAppStore((s) => s.scenario);
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
    <header className="hairline-b panel-surface relative flex h-12 shrink-0 items-stretch">
      <div className="flex items-center gap-3 px-4">
        <Logo />
        <div className="flex flex-col leading-none">
          <span className="font-semibold tracking-[0.16em] text-ink-50">AXIS</span>
          <span className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
            theatre console
          </span>
        </div>
      </div>

      <div className="hairline-l flex min-w-0 flex-1 items-stretch">
        <div className="hairline-r flex shrink-0 items-center px-3">
          <TeamBar />
        </div>
        <div className="flex min-w-0 flex-1 items-center divide-x divide-[var(--hairline)] font-mono text-[10px] uppercase tracking-wider2 text-ink-100">
          <HudCell label="status" value={scenario?.scenario.classification ?? "UNCLASSIFIED // EXERCISE"} tone="amber" />
          <HudCell label="scenario" value={scenario?.scenario.name ?? "—"} />
          <HudCell label="clock" value={scenario?.scenario.clock.replace("T", " ").slice(0, 16) ?? "—"} mono />
        </div>
      </div>

      <div className="hairline-l flex items-center gap-3 px-3 font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
        <CountriesButton />
        <span className="h-4 w-px bg-[var(--hairline)]" />
        <IntelTickBadge
          source={intel?.source ?? null}
          tickSeq={intel?.tick_seq ?? null}
          ago={ago}
          error={intelError}
        />
        <span className="h-4 w-px bg-[var(--hairline)]" />
        <span className="text-ink-300">
          v{__schemaSummary(scenario?.schema_version, intel?.intel_schema_version)}
        </span>
      </div>
    </header>
  );
}

function HudCell({
  label,
  value,
  tone = "neutral",
  mono = false,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "amber";
  mono?: boolean;
}) {
  const valueClass =
    tone === "amber" ? "text-accent-amber" : "text-ink-50";
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 px-4">
      <span className="shrink-0 text-ink-300">{label}</span>
      <span className={`min-w-0 truncate ${valueClass} ${mono ? "tabular-nums" : ""}`}>
        {value}
      </span>
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
        label="blue team"
        selected={team === "blue"}
        onSelect={() => setTeam("blue")}
        className="border-r border-[var(--hairline)]"
        accent="var(--faction-nato)"
        activeClassName="text-faction-nato"
        idleClassName="text-ink-300 hover:text-faction-nato/90"
        title="Play as blue-side (NATO / allied) forces"
      />
      <TeamBarOption
        label="red team"
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
      className={`relative min-w-[5.5rem] px-2.5 font-mono text-[9px] uppercase tracking-wider2 transition-colors ${
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
      <span className="inline-flex items-center gap-1.5">
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
      <span className="inline-flex items-center gap-1.5">
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
    <span className="inline-flex items-center gap-1.5">
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

function __schemaSummary(state: string | undefined, intel: string | undefined): string {
  return `${state ?? "?"}/${intel ?? "?"}`;
}

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.4" className="text-faction-nato">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3v18" />
        <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" opacity="0.45" />
      </g>
    </svg>
  );
}
