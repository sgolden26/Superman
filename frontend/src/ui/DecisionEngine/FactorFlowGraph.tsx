import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Action } from "@/types/decision";
import {
  type FlowNode,
  buildFactorGraph,
} from "@/decision/buildFactorGraph";
import type { IntelEvent, RegionIntel } from "@/types/intel";

const CATEGORY_SHORT: Record<string, string> = {
  protest: "Protest",
  military_loss: "Military",
  economic_stress: "Economic",
  political_instability: "Politics",
  nationalist_sentiment: "Nationalism",
};

function anchorOut(n: FlowNode): { x: number; y: number } {
  if (n.kind === "morale") {
    return { x: n.x + n.w, y: n.y + n.h / 2 };
  }
  return { x: n.x + n.w, y: n.y + n.h / 2 };
}

function anchorIn(n: FlowNode): { x: number; y: number } {
  return { x: n.x, y: n.y + n.h / 2 };
}

function edgePath(a: FlowNode, b: FlowNode): string {
  const p0 = anchorOut(a);
  const p1 = anchorIn(b);
  const mid = (p0.x + p1.x) / 2;
  return `M ${p0.x} ${p0.y} C ${mid} ${p0.y} ${mid} ${p1.y} ${p1.x} ${p1.y}`;
}

function edgePaint(style: "informs" | "drives" | "ambient" | "choice"): {
  stroke: string;
  dash?: string;
} {
  switch (style) {
    case "informs":
      return { stroke: "rgba(90,169,255,0.5)" };
    case "drives": {
      return { stroke: "rgba(110,231,183,0.45)" };
    }
    case "ambient":
      return { stroke: "rgba(100,116,139,0.4)", dash: "4 4" };
    case "choice":
      return { stroke: "rgba(148,163,184,0.35)", dash: "2 3" };
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/** Wrap a string to two lines, breaking at the last space within max. Line 2
 *  is truncated with an ellipsis if it still exceeds `max`. */
function wrapToTwoLines(s: string, max: number): { a: string; b: string } {
  const trimmed = s.trim();
  if (trimmed.length <= max) return { a: trimmed, b: "" };
  const breakAt = trimmed.lastIndexOf(" ", max);
  if (breakAt < Math.floor(max * 0.5)) {
    return { a: trimmed.slice(0, max), b: truncate(trimmed.slice(max), max) };
  }
  return {
    a: trimmed.slice(0, breakAt),
    b: truncate(trimmed.slice(breakAt + 1), max),
  };
}

/** Two balanced lines for action node titles (no clipping). */
function actionTitleLines(name: string): { a: string; b: string } {
  if (name.length <= 20) return { a: name, b: "" };
  const mid = name.lastIndexOf(" ", 18);
  if (mid <= 4) {
    return { a: name.slice(0, 18), b: name.slice(18) };
  }
  return { a: name.slice(0, mid), b: name.slice(mid + 1) };
}

interface Props {
  region: RegionIntel;
  territoryName: string;
  actions: Action[];
  selectedActionId: string | null;
  onActionSelect: (id: string) => void;
  /** When provided, signal nodes become clickable and call this with the
   * underlying IntelEvent so callers can open an article viewer. */
  onSignalClick?: (event: IntelEvent) => void;
}

type ViewBox = [number, number, number, number];

export function FactorFlowGraph({
  region,
  territoryName,
  actions,
  selectedActionId,
  onActionSelect,
  onSignalClick,
}: Props) {
  const { nodes, edges, viewW, viewH } = useMemo(
    () => buildFactorGraph(region, actions, territoryName),
    [region, actions, territoryName],
  );

  const eventBySignalId = useMemo(() => {
    const m = new Map<string, IntelEvent>();
    for (const e of region.recent_events) m.set(`sig-${e.id}`, e);
    return m;
  }, [region.recent_events]);

  const byId = useMemo(() => {
    const m = new Map<string, FlowNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const [viewBox, setViewBox] = useState<ViewBox>([0, 0, viewW, viewH]);
  const viewBoxRef = useRef(viewBox);
  viewBoxRef.current = viewBox;
  const wrapRef = useRef<HTMLDivElement>(null);
  const pan = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startVb: ViewBox;
  } | null>(null);

  useEffect(() => {
    setViewBox([0, 0, viewW, viewH]);
  }, [viewW, viewH, region.region_id]);

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setViewBox((prev) => {
        const [vx, vy, vw, vh] = prev;
        const mx = (e.clientX - rect.left) / Math.max(1, rect.width);
        const my = (e.clientY - rect.top) / Math.max(1, rect.height);
        const zoomIn = e.deltaY < 0;
        const k = zoomIn ? 0.88 : 1.12;
        let nw = vw * k;
        const minW = Math.min(220, viewW * 0.25);
        const maxW = viewW * 2.2;
        nw = Math.min(maxW, Math.max(minW, nw));
        const ar = vh / vw;
        const nh = nw * ar;
        const nminx = vx + (vw - nw) * mx;
        const nminy = vy + (vh - nh) * my;
        return [nminx, nminy, nw, nh];
      });
    },
    [viewH, viewW],
  );

  const onPanPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pan.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startVb: [...viewBoxRef.current] as ViewBox,
    };
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const s = pan.current;
      if (!s || e.pointerId !== s.pointerId) return;
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      const [v0, v1, vw, vh] = s.startVb;
      const dx = (e.clientX - s.startClientX) / w;
      const dy = (e.clientY - s.startClientY) / h;
      setViewBox([v0 - dx * vw, v1 - dy * vh, vw, vh]);
    };
    const onUp = (e: PointerEvent) => {
      if (pan.current && e.pointerId === pan.current.pointerId) {
        pan.current = null;
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div className="hairline flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden border border-ink-500 bg-ink-800/50">
      <div className="flex items-baseline justify-between border-b border-ink-600 px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
          factor graph
        </span>
        <div className="max-w-[72%] text-right font-mono text-[8px] uppercase tracking-wider2 leading-snug text-ink-300">
          <div className="truncate">signals → {territoryName} → options</div>
          <div className="mt-0.5 normal-case">scroll: zoom · drag empty: pan</div>
        </div>
      </div>
      <div
        ref={wrapRef}
        onWheel={onWheel}
        className="min-h-0 flex-1 touch-none select-none overflow-hidden p-2"
        style={{ touchAction: "none" }}
        role="presentation"
      >
        <svg
          width="100%"
          viewBox={viewBox.join(" ")}
          className="h-full min-h-[240px] cursor-grab text-ink-100 active:cursor-grabbing"
          role="img"
          aria-label="Intel fusion graph for the selected region"
        >
          <title>How signals and factors relate to morale and available actions</title>
          <rect
            x="0"
            y="0"
            width={viewW}
            height={viewH}
            fill="transparent"
            onPointerDown={onPanPointerDown}
          />
          {edges.map((e) => {
            const a = byId.get(e.from);
            const b = byId.get(e.to);
            if (!a || !b) return null;
            const { stroke, dash } = edgePaint(e.style);
            return (
              <path
                key={e.id}
                d={edgePath(a, b)}
                fill="none"
                stroke={stroke}
                strokeWidth="1.5"
                strokeDasharray={dash}
                pointerEvents="none"
              />
            );
          })}

          {nodes.map((n) => {
            if (n.kind === "signal") {
              const ev = eventBySignalId.get(n.id);
              const clickable = Boolean(onSignalClick && ev);
              const { a: sigA, b: sigB } = wrapToTwoLines(n.label, 32);
              return (
                <g
                  key={n.id}
                  pointerEvents={clickable ? "all" : "none"}
                  onClick={
                    clickable && ev
                      ? () => onSignalClick?.(ev)
                      : undefined
                  }
                  className={clickable ? "cursor-pointer" : undefined}
                >
                  <title>{n.label}</title>
                  <rect
                    x={n.x}
                    y={n.y}
                    width={n.w}
                    height={n.h}
                    rx="2"
                    fill="rgba(15,23,42,0.8)"
                    stroke="rgba(71,85,105,0.8)"
                    strokeWidth="1"
                  />
                  <text
                    x={n.x + 6}
                    y={n.y + 16}
                    className="fill-ink-100"
                    style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}
                    pointerEvents="none"
                  >
                    <tspan x={n.x + 6} dy="0">
                      {sigA}
                    </tspan>
                    {sigB ? (
                      <tspan x={n.x + 6} dy="13">
                        {sigB}
                      </tspan>
                    ) : null}
                  </text>
                  <text
                    x={n.x + 6}
                    y={n.y + n.h - 10}
                    className="fill-ink-300"
                    style={{ fontSize: 8, fontFamily: "ui-monospace, monospace" }}
                    pointerEvents="none"
                  >
                    {n.sublabel ?? "signal"}
                  </text>
                </g>
              );
            }
            if (n.kind === "factor") {
              const c = n.contribution ?? 0;
              const pos = c >= 0;
              const { a: facA, b: facB } = wrapToTwoLines(n.label, 36);
              return (
                <g key={n.id} pointerEvents="none">
                  <title>{n.label}</title>
                  <rect
                    x={n.x}
                    y={n.y}
                    width={n.w}
                    height={n.h}
                    rx="2"
                    fill="rgba(15,23,42,0.9)"
                    stroke={pos ? "rgba(16,185,129,0.4)" : "rgba(244,63,94,0.4)"}
                    strokeWidth="1"
                  />
                  <text
                    x={n.x + 6}
                    y={n.y + 16}
                    className="fill-ink-200"
                    style={{ fontSize: 8, fontFamily: "ui-monospace, monospace" }}
                  >
                    {CATEGORY_SHORT[n.sublabel ?? ""] ?? n.sublabel}
                  </text>
                  <text
                    x={n.w + n.x - 6}
                    y={n.y + 16}
                    textAnchor="end"
                    className="fill-ink-50"
                    style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}
                  >
                    {pos ? "+" : ""}
                    {c.toFixed(1)}
                  </text>
                  <text
                    x={n.x + 6}
                    y={n.y + 34}
                    className="fill-ink-100"
                    style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}
                  >
                    <tspan x={n.x + 6} dy="0">
                      {facA}
                    </tspan>
                    {facB ? (
                      <tspan x={n.x + 6} dy="13">
                        {facB}
                      </tspan>
                    ) : null}
                  </text>
                </g>
              );
            }
            if (n.kind === "morale") {
              return (
                <g key={n.id} pointerEvents="none">
                  <rect
                    x={n.x}
                    y={n.y}
                    width={n.w}
                    height={n.h}
                    rx="6"
                    fill="rgba(30,41,59,0.9)"
                    stroke="rgba(90,169,255,0.45)"
                    strokeWidth="1.5"
                  />
                  <text
                    x={n.x + n.w / 2}
                    y={n.y + 28}
                    textAnchor="middle"
                    className="fill-ink-200"
                    style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}
                  >
                    {n.label}
                  </text>
                  <text
                    x={n.x + n.w / 2}
                    y={n.y + 50}
                    textAnchor="middle"
                    className="fill-ink-50"
                    style={{ fontSize: 11, fontFamily: "ui-monospace, monospace" }}
                  >
                    {Math.round(region.morale_score)} / 100
                  </text>
                  <text
                    x={n.x + n.w / 2}
                    y={n.y + 72}
                    textAnchor="middle"
                    className="fill-ink-300"
                    style={{ fontSize: 8, fontFamily: "ui-monospace, monospace" }}
                  >
                    {n.sublabel}
                  </text>
                </g>
              );
            }
            if (n.kind === "action") {
              const actId = n.id.replace("act-", "");
              const active = actId === selectedActionId;
              const { a: lineA, b: lineB } = actionTitleLines(n.label);
              const cy = n.y + n.h / 2 - (lineB ? 6 : 0);
              const action = actions.find((a) => a.id === actId);
              const tooltip =
                action?.wargame_note && action.wargame_note.length > 0
                  ? `${action.name}: ${action.wargame_note}`
                  : action?.name ?? n.label;
              return (
                <g key={n.id} pointerEvents="all">
                  <title>{tooltip}</title>
                  <rect
                    x={n.x}
                    y={n.y}
                    width={n.w}
                    height={n.h}
                    rx="2"
                    fill={active ? "rgba(30,58,95,0.95)" : "rgba(15,23,42,0.9)"}
                    stroke={
                      active ? "rgba(90,169,255,0.8)" : "rgba(51,65,85,0.8)"
                    }
                    strokeWidth={active ? 1.5 : 1}
                    className="cursor-pointer"
                    onClick={() => onActionSelect(actId)}
                  />
                  <text
                    x={n.x + n.w / 2}
                    y={cy}
                    textAnchor="middle"
                    className="fill-ink-100"
                    style={{ fontSize: 8, fontFamily: "ui-monospace, monospace" }}
                    pointerEvents="none"
                  >
                    <tspan x={n.x + n.w / 2} dy="0">
                      {lineA}
                    </tspan>
                    {lineB ? (
                      <tspan x={n.x + n.w / 2} dy="12">
                        {lineB}
                      </tspan>
                    ) : null}
                  </text>
                </g>
              );
            }
            return null;
          })}
        </svg>
      </div>
    </div>
  );
}
