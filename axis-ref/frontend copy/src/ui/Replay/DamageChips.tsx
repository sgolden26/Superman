import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/state/store";
import { subscribeMap } from "@/map/mapRef";
import type {
  ReplayEngageEvent,
  ReplayStrikeEvent,
} from "@/state/replay";

type ChipEvent = ReplayEngageEvent | ReplayStrikeEvent;

interface ChipGroup {
  key: string;
  anchor: [number, number];
  events: ChipEvent[];
}

/** Persistent damage report chips anchored to map lon/lat. They render once
 *  the replay enters the "reports" phase (and stay through "strikes" too, so
 *  the impact pulse and the chip co-occur). Co-located events collapse into
 *  a single summary chip with a count badge; click to expand the breakdown. */
export function DamageChips() {
  const replay = useAppStore((s) => s.replay);
  const [, setTick] = useState(0);

  useEffect(() => {
    return subscribeMap((m) => {
      if (!m) return;
      const bump = () => setTick((t) => t + 1);
      m.on("move", bump);
      m.on("zoom", bump);
      m.on("rotate", bump);
      m.on("pitch", bump);
      m.on("resize", bump);
      bump();
      return () => {
        m.off("move", bump); m.off("zoom", bump);
        m.off("rotate", bump); m.off("pitch", bump);
        m.off("resize", bump);
      };
    });
  }, []);

  const groups = useMemo<ChipGroup[]>(() => {
    if (!replay) return [];
    const events = replay.events.filter(
      (e): e is ChipEvent => e.kind === "strike" || e.kind === "engage",
    );
    const byKey = new Map<string, ChipGroup>();
    for (const e of events) {
      const key = `${e.target[0].toFixed(2)},${e.target[1].toFixed(2)}`;
      const g = byKey.get(key);
      if (g) g.events.push(e);
      else byKey.set(key, { key, anchor: e.target, events: [e] });
    }
    return [...byKey.values()];
  }, [replay]);

  if (!replay) return null;
  if (replay.phase !== "strikes" && replay.phase !== "reports") return null;
  if (groups.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {groups.map((g) => (
        <ChipGroupAnchor key={g.key} group={g} />
      ))}
    </div>
  );
}

function ChipGroupAnchor({ group }: { group: ChipGroup }) {
  const replay = useAppStore((s) => s.replay);
  const phase = replay?.phase;
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    return subscribeMap((m) => {
      if (!m) {
        setPos(null);
        return;
      }
      const update = () => {
        const p = m.project(group.anchor);
        setPos([p.x, p.y]);
      };
      update();
      m.on("move", update);
      m.on("zoom", update);
      m.on("rotate", update);
      m.on("pitch", update);
      m.on("resize", update);
      return () => {
        m.off("move", update); m.off("zoom", update);
        m.off("rotate", update); m.off("pitch", update);
        m.off("resize", update);
      };
    });
  }, [group.anchor]);

  if (!pos) return null;

  const muted = phase === "strikes";
  const single = group.events.length === 1;
  const dominantTeam = pickDominantTeam(group.events);
  const colour = dominantTeam === "blue" ? "#5aa9ff" : "#ff5a5a";

  return (
    <div
      style={{
        position: "absolute",
        left: pos[0],
        top: pos[1],
        transform: "translate(8px, -50%)",
        opacity: muted ? 0.55 : 1,
        transition: "opacity 220ms ease-out",
        pointerEvents: "auto",
      }}
    >
      {single ? (
        <SingleChip event={group.events[0]} colour={colour} />
      ) : expanded ? (
        <ExpandedGroup
          events={group.events}
          colour={colour}
          onCollapse={() => setExpanded(false)}
        />
      ) : (
        <SummaryChip
          events={group.events}
          colour={colour}
          onExpand={() => setExpanded(true)}
        />
      )}
    </div>
  );
}

function SingleChip({ event, colour }: { event: ChipEvent; colour: string }) {
  const lines = chipLines(event);
  const headline = chipHeadline(event);
  return (
    <div
      className="rounded-sm border border-slate-700/60 bg-slate-950/90 px-2 py-1 font-mono text-[10.5px] shadow-md"
      data-team={event.team}
    >
      <div
        style={{ color: colour }}
        className="flex items-center gap-1 uppercase tracking-wider"
      >
        <span aria-hidden style={{ background: colour }} className="h-1.5 w-1.5 rounded-full" />
        <span>{headline}</span>
      </div>
      {lines.map((l, i) => (
        <div key={i} className="text-slate-300 leading-snug">{l}</div>
      ))}
    </div>
  );
}

function SummaryChip({
  events,
  colour,
  onExpand,
}: {
  events: ChipEvent[];
  colour: string;
  onExpand: () => void;
}) {
  const counts = aggregate(events);
  const headline = events[0].kind === "engage"
    ? `${events.length} engagements`
    : `${events.length} strikes`;
  const targetLabel = events[0].kind === "strike"
    ? events[0].targetLabel
    : (events[0] as ReplayEngageEvent).defenderName;

  return (
    <button
      type="button"
      onClick={onExpand}
      className="rounded-sm border border-slate-700/60 bg-slate-950/90 px-2 py-1 font-mono text-[10.5px] shadow-md transition hover:border-slate-500"
      title="Click to expand"
    >
      <div
        style={{ color: colour }}
        className="flex items-center gap-1.5 uppercase tracking-wider"
      >
        <span aria-hidden style={{ background: colour }} className="h-1.5 w-1.5 rounded-full" />
        <span>{headline}</span>
        <span
          style={{ borderColor: colour, color: colour }}
          className="ml-1 rounded-sm border px-1 text-[9.5px] leading-none"
        >
          ×{events.length}
        </span>
      </div>
      <div className="text-left text-slate-300 leading-snug">
        {counts.hits}h · {counts.misses}m · {counts.intercepts}i
      </div>
      <div className="text-left text-slate-400 leading-snug truncate max-w-[200px]">
        {targetLabel}
      </div>
    </button>
  );
}

function ExpandedGroup({
  events,
  colour,
  onCollapse,
}: {
  events: ChipEvent[];
  colour: string;
  onCollapse: () => void;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-sm border border-slate-700/60 bg-slate-950/95 p-1 shadow-md">
      <div className="flex items-center justify-between gap-2 px-1">
        <div
          style={{ color: colour }}
          className="font-mono text-[10px] uppercase tracking-wider"
        >
          ×{events.length} · target group
        </div>
        <button
          type="button"
          onClick={onCollapse}
          className="rounded-sm border border-slate-700 px-1.5 font-mono text-[10px] text-slate-300 hover:border-slate-500"
          aria-label="Collapse"
        >
          collapse
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {events.map((e) => {
          const lineColour = e.team === "blue" ? "#5aa9ff" : "#ff5a5a";
          return (
            <div
              key={e.orderId}
              className="rounded-sm border border-slate-800 bg-slate-950/85 px-2 py-0.5 font-mono text-[10.5px]"
              data-team={e.team}
            >
              <div
                style={{ color: lineColour }}
                className="flex items-center gap-1 uppercase tracking-wider"
              >
                <span aria-hidden style={{ background: lineColour }} className="h-1.5 w-1.5 rounded-full" />
                <span>{chipHeadline(e)}</span>
              </div>
              {chipLines(e).map((l, i) => (
                <div key={i} className="text-slate-300 leading-snug">{l}</div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function aggregate(events: ChipEvent[]): { hits: number; misses: number; intercepts: number } {
  let hits = 0, misses = 0, intercepts = 0;
  for (const e of events) {
    if (e.kind === "strike") {
      if (e.intercepted) intercepts++;
      else if (e.hit) hits++;
      else misses++;
    } else {
      if (e.defenderRetreated || e.defenderStrengthLoss > 0.05) hits++;
      else misses++;
    }
  }
  return { hits, misses, intercepts };
}

function pickDominantTeam(events: ChipEvent[]): "red" | "blue" {
  let red = 0, blue = 0;
  for (const e of events) {
    if (e.team === "red") red++;
    else blue++;
  }
  return red > blue ? "red" : "blue";
}

function chipHeadline(e: ChipEvent): string {
  if (e.kind === "engage") {
    if (e.defenderRetreated) return "Engagement · retreat";
    return "Engagement";
  }
  if (e.intercepted) return `${prettyVariety(e.variety)} · intercept`;
  if (!e.hit) return `${prettyVariety(e.variety)} · miss`;
  return `${prettyVariety(e.variety)} · hit`;
}

function prettyVariety(v: string): string {
  switch (v) {
    case "air_strike": return "Air strike";
    case "air_sead": return "SEAD";
    case "naval_strike": return "Naval strike";
    case "missile": return "Missile";
    case "interdict": return "Interdict";
    default: return v;
  }
}

function chipLines(e: ChipEvent): string[] {
  if (e.kind === "engage") {
    return [
      `def Δstr ${pct(e.defenderStrengthLoss)}  mor ${pct(e.defenderMoraleLoss)}`,
      `atk Δstr ${pct(e.attackerStrengthLoss)}  mor ${pct(e.attackerMoraleLoss)}`,
      e.defenderName,
    ];
  }
  const lines: string[] = [];
  if (e.intercepted) {
    lines.push("intercepted before impact");
  } else if (!e.hit) {
    lines.push("missed target");
  } else {
    lines.push(`damage ${pct(e.damage)}`);
  }
  if (e.attackerLoss > 0) lines.push(`atk Δstr ${pct(e.attackerLoss)}`);
  lines.push(e.targetLabel);
  return lines;
}

function pct(v: number): string {
  return `-${Math.max(0, Math.round(v * 100))}%`;
}
