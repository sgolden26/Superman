import type { GeoJSONSource, LayerSpecification, Map as MlMap } from "maplibre-gl";
import { greatCircleInterpolate } from "@/map/geodesic";
import type { ReplayEngageEvent, ReplayStrikeEvent } from "@/state/replay";
import { LAYER_UNIT_DOT } from "@/map/style";

export const SOURCE_STRIKE_ARC = "replay_strike_arc";
export const LAYER_STRIKE_ARC_LINE = "replay_strike_arc_line";
export const LAYER_STRIKE_ARC_TRAIL = "replay_strike_arc_trail";
export const LAYER_STRIKE_ARC_SMOKE = "replay_strike_arc_smoke";
export const LAYER_STRIKE_ARC_TRACER_HALO = "replay_strike_arc_tracer_halo";
export const LAYER_STRIKE_ARC_TRACER = "replay_strike_arc_tracer";
export const LAYER_STRIKE_ARC_FLASH = "replay_strike_arc_flash";
export const LAYER_STRIKE_ARC_RING = "replay_strike_arc_ring";
export const LAYER_STRIKE_ARC_DOT = "replay_strike_arc_dot";

const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** Mount strike-arc layers (dim path, bright trail, smoke, tracer + halo,
 *  origin flash, impact ring + dot). All driven by per-feature paint props. */
export function ensureStrikeArcLayer(map: MlMap): void {
  if (!map.getSource(SOURCE_STRIKE_ARC)) {
    map.addSource(SOURCE_STRIKE_ARC, { type: "geojson", data: empty });
  }
  const specs: LayerSpecification[] = [
    {
      id: LAYER_STRIKE_ARC_LINE,
      type: "line",
      source: SOURCE_STRIKE_ARC,
      filter: ["==", ["get", "layer"], "arc"],
      paint: {
        "line-color": ["get", "color"],
        "line-width": 1.0,
        "line-opacity": ["get", "opacity"],
        "line-dasharray": [2, 2],
      },
      layout: { "line-cap": "round" },
    },
    {
      id: LAYER_STRIKE_ARC_TRAIL,
      type: "line",
      source: SOURCE_STRIKE_ARC,
      filter: ["==", ["get", "layer"], "trail"],
      paint: {
        "line-color": ["get", "color"],
        "line-width": 1.8,
        "line-opacity": ["get", "opacity"],
        "line-blur": 0.6,
      },
      layout: { "line-cap": "round" },
    },
    {
      id: LAYER_STRIKE_ARC_SMOKE,
      type: "circle",
      source: SOURCE_STRIKE_ARC,
      filter: ["==", ["get", "layer"], "smoke"],
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": ["get", "radius"],
        "circle-opacity": ["get", "opacity"],
        "circle-blur": 0.8,
      },
    },
    {
      id: LAYER_STRIKE_ARC_TRACER_HALO,
      type: "circle",
      source: SOURCE_STRIKE_ARC,
      filter: ["==", ["get", "layer"], "tracer_halo"],
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": ["get", "radius"],
        "circle-opacity": ["get", "opacity"],
        "circle-blur": 0.6,
      },
    },
    {
      id: LAYER_STRIKE_ARC_TRACER,
      type: "circle",
      source: SOURCE_STRIKE_ARC,
      filter: ["==", ["get", "layer"], "tracer"],
      paint: {
        "circle-radius": 2.6,
        "circle-color": ["get", "color"],
        "circle-opacity": ["get", "opacity"],
        "circle-stroke-color": "#0b0f14",
        "circle-stroke-width": 0.6,
      },
    },
    {
      id: LAYER_STRIKE_ARC_FLASH,
      type: "circle",
      source: SOURCE_STRIKE_ARC,
      filter: ["==", ["get", "layer"], "flash"],
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": ["get", "radius"],
        "circle-opacity": ["get", "opacity"],
        "circle-blur": 0.5,
      },
    },
    {
      id: LAYER_STRIKE_ARC_RING,
      type: "circle",
      source: SOURCE_STRIKE_ARC,
      filter: ["==", ["get", "layer"], "ring"],
      paint: {
        "circle-radius": ["get", "radius"],
        "circle-color": "transparent",
        "circle-stroke-color": ["get", "color"],
        "circle-stroke-width": 1.4,
        "circle-stroke-opacity": ["get", "opacity"],
      },
    },
    {
      id: LAYER_STRIKE_ARC_DOT,
      type: "circle",
      source: SOURCE_STRIKE_ARC,
      filter: ["==", ["get", "layer"], "dot"],
      paint: {
        "circle-radius": ["get", "radius"],
        "circle-color": ["get", "color"],
        "circle-opacity": ["get", "opacity"],
      },
    },
  ];
  for (const s of specs) {
    if (!map.getLayer(s.id)) {
      if (map.getLayer(LAYER_UNIT_DOT)) map.addLayer(s, LAYER_UNIT_DOT);
      else map.addLayer(s);
    }
  }
}

// ---------------------------------------------------------------------------
// Plan: convert replay events into per-arc plans with staggered timing,
// per-kind durations, and curved (parabolic-bulge) trajectories.
// ---------------------------------------------------------------------------

type Flavour = "hit" | "miss" | "intercept";

const KIND_DURATION_MS: Record<string, number> = {
  air_strike: 1300,
  air_sead: 1100,
  naval_strike: 1700,
  missile: 1900,
  interdict: 1200,
  engage: 1400,
};

/** Perpendicular-bulge fraction of chord length. Higher -> more arched. */
const KIND_BULGE: Record<string, number> = {
  air_strike: 0.10,
  air_sead: 0.08,
  naval_strike: 0.06,
  missile: 0.16,
  interdict: 0.08,
  engage: 0.03,
};

/** Cap stagger so dense rounds still finish promptly. */
const STAGGER_WINDOW_MS = 800;
const PER_ARC_GAP_MS = 80;
const TAIL_PAD_MS = 250;

interface PlannedArc {
  origin: [number, number];
  target: [number, number];
  variety: string;
  flavour: Flavour;
  color: string;
  startMs: number;
  durationMs: number;
  /** Pre-sampled curve points (stable across the animation). */
  pathPoints: [number, number][];
  /** Tracer arrival fraction of duration; impact phase runs after this. */
  strikeAt: number;
  /** Intercept stop fraction (0..strikeAt). Only used when flavour === "intercept". */
  interceptAt: number;
}

interface StrikePlan {
  arcs: PlannedArc[];
  totalDurationMs: number;
}

/** Turn replay events into a deterministic per-arc plan. Both store and map
 *  call this; the plan is pure of input so they agree on duration. */
export function planStrikes(
  events: readonly (ReplayStrikeEvent | ReplayEngageEvent)[],
): StrikePlan {
  const arcs: PlannedArc[] = [];
  if (events.length === 0) return { arcs, totalDurationMs: 0 };

  const stagger = Math.min(
    PER_ARC_GAP_MS,
    events.length > 1 ? STAGGER_WINDOW_MS / (events.length - 1) : 0,
  );

  events.forEach((e, i) => {
    const isStrike = e.kind === "strike";
    const variety = isStrike ? e.variety : "engage";
    const dur = KIND_DURATION_MS[variety] ?? 1500;
    const flavour: Flavour = isStrike
      ? e.intercepted
        ? "intercept"
        : e.hit
          ? "hit"
          : "miss"
      : (e as ReplayEngageEvent).defenderRetreated
          || (e as ReplayEngageEvent).defenderStrengthLoss > 0.05
        ? "hit"
        : "miss";
    const bulgeFrac = KIND_BULGE[variety] ?? 0.08;
    const side = sideFromKey(orderKey(e), i);
    const path = curvedPath(e.origin, e.target, bulgeFrac, side);
    arcs.push({
      origin: e.origin,
      target: e.target,
      variety,
      flavour,
      color: teamColor(e.team),
      startMs: i * stagger,
      durationMs: dur,
      pathPoints: path,
      strikeAt: flavour === "intercept" ? 0.78 : 0.78,
      interceptAt: 0.7,
    });
  });
  const lastEnd = arcs.length === 0
    ? 0
    : Math.max(...arcs.map((a) => a.startMs + a.durationMs));
  return { arcs, totalDurationMs: lastEnd + TAIL_PAD_MS };
}

function orderKey(e: ReplayStrikeEvent | ReplayEngageEvent): string {
  return e.kind === "strike" ? e.orderId : e.orderId;
}

/** Deterministic side flip so concurrent arcs splay both ways. */
function sideFromKey(key: string, fallback: number): 1 | -1 {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  if (h === 0) return fallback % 2 === 0 ? 1 : -1;
  return (h & 1) === 0 ? 1 : -1;
}

/** Sample a great-circle path with a sin(πt) perpendicular bulge in lon/lat
 *  space. Bulge is scaled by chord length so short arcs stay flat and long
 *  arcs feel ballistic. Latitudes are scaled by cos(midLat) so the bulge
 *  reads roughly isotropic to the eye. */
function curvedPath(
  origin: [number, number],
  target: [number, number],
  bulgeFrac: number,
  side: 1 | -1,
  segments = 56,
): [number, number][] {
  const [ox, oy] = origin;
  const [tx, ty] = target;
  const dx = tx - ox;
  const dy = ty - oy;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-6 || bulgeFrac < 1e-6) {
    const flat: [number, number][] = [];
    for (let i = 0; i <= segments; i++) {
      flat.push(greatCircleInterpolate(origin, target, i / segments));
    }
    return flat;
  }
  // Perpendicular unit (rotate (dx, dy) 90deg) in lon/lat.
  const px = (-dy / chord) * side;
  const py = (dx / chord) * side;
  const midLat = (oy + ty) / 2;
  const latScale = Math.max(0.4, Math.cos((midLat * Math.PI) / 180));
  const bulge = chord * bulgeFrac;
  const out: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const base = greatCircleInterpolate(origin, target, t);
    const offset = bulge * Math.sin(Math.PI * t);
    out.push([base[0] + px * offset, base[1] + py * offset * latScale]);
  }
  return out;
}

function pointAt(path: [number, number][], t: number): [number, number] {
  const tt = Math.max(0, Math.min(1, t));
  const lastIdx = path.length - 1;
  const f = tt * lastIdx;
  const i0 = Math.floor(f);
  const i1 = Math.min(lastIdx, i0 + 1);
  const u = f - i0;
  const a = path[i0];
  const b = path[i1];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}

function teamColor(team: "red" | "blue"): string {
  return team === "blue" ? "#5aa9ff" : "#ff5a5a";
}

function impactColor(flavour: Flavour, base: string): string {
  if (flavour === "intercept") return "#ffd166";
  if (flavour === "miss") return "#9aa3ad";
  return base;
}

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

interface SmokePuff {
  pos: [number, number];
  bornMs: number;
  color: string;
}

const SMOKE_LIFETIME_MS = 700;
const SMOKE_EMIT_GAP_MS = 28;

/** Drive the strike phase. Iterates until `totalDurationMs` elapses (or until
 *  `stop()` is called for skip). Returns a stop fn. */
export function playStrikeAnimation(
  map: MlMap,
  events: readonly (ReplayStrikeEvent | ReplayEngageEvent)[],
): () => void {
  const src = map.getSource(SOURCE_STRIKE_ARC) as GeoJSONSource | undefined;
  if (!src || events.length === 0) return () => {};
  const plan = planStrikes(events);
  if (plan.arcs.length === 0) return () => {};

  const start = performance.now();
  let stopped = false;
  const lastEmit = new Map<number, number>();
  const puffs: SmokePuff[] = [];

  function frame() {
    if (stopped) return;
    const now = performance.now();
    const t = now - start;
    const features: GeoJSON.Feature[] = [];

    plan.arcs.forEach((arc, idx) => {
      const local = t - arc.startMs;
      if (local < 0) return;
      const lt = Math.min(1, local / arc.durationMs);

      // Dim full path (visible only after this arc has launched).
      features.push({
        type: "Feature",
        properties: { layer: "arc", color: arc.color, opacity: 0.35 },
        geometry: { type: "LineString", coordinates: arc.pathPoints },
      });

      // Origin flash (first ~220ms of this arc).
      const flashLife = 220;
      if (local < flashLife) {
        const u = local / flashLife;
        features.push({
          type: "Feature",
          properties: {
            layer: "flash",
            color: arc.color,
            radius: 4 + 7 * (1 - u),
            opacity: 0.8 * (1 - u),
          },
          geometry: { type: "Point", coordinates: arc.origin },
        });
      }

      const traceCap = arc.flavour === "intercept" ? arc.interceptAt : arc.strikeAt;
      const traceT = Math.min(1, lt / traceCap);

      if (traceT < 1) {
        // Bright trail: recent ~22% of the path behind the tracer head.
        const tailT = Math.max(0, traceT - 0.22);
        const trailCoords = sliceCurve(arc.pathPoints, tailT * traceCap, traceT * traceCap);
        if (trailCoords.length >= 2) {
          features.push({
            type: "Feature",
            properties: { layer: "trail", color: arc.color, opacity: 0.95 },
            geometry: { type: "LineString", coordinates: trailCoords },
          });
        }
        const head = pointAt(arc.pathPoints, traceT * traceCap);

        // Smoke emission.
        const last = lastEmit.get(idx) ?? -Infinity;
        if (now - last >= SMOKE_EMIT_GAP_MS) {
          puffs.push({ pos: head, bornMs: now, color: arc.color });
          lastEmit.set(idx, now);
        }

        // Tracer halo + dot.
        features.push({
          type: "Feature",
          properties: { layer: "tracer_halo", color: arc.color, radius: 7, opacity: 0.45 },
          geometry: { type: "Point", coordinates: head },
        });
        features.push({
          type: "Feature",
          properties: { layer: "tracer", color: arc.color, opacity: 1 },
          geometry: { type: "Point", coordinates: head },
        });
      }

      // Impact phase.
      if (lt >= traceCap) {
        const impactPhase = (lt - traceCap) / Math.max(0.001, 1 - traceCap);
        const impactPt = arc.flavour === "intercept"
          ? pointAt(arc.pathPoints, arc.interceptAt)
          : arc.target;

        if (arc.flavour === "hit") {
          // Outer expanding ring.
          features.push({
            type: "Feature",
            properties: {
              layer: "ring",
              color: arc.color,
              radius: 6 + 28 * impactPhase,
              opacity: Math.max(0, 0.95 * (1 - impactPhase)),
            },
            geometry: { type: "Point", coordinates: impactPt },
          });
          // Secondary delayed ring (concussion).
          if (impactPhase > 0.18) {
            const u = (impactPhase - 0.18) / 0.82;
            features.push({
              type: "Feature",
              properties: {
                layer: "ring",
                color: arc.color,
                radius: 4 + 22 * u,
                opacity: Math.max(0, 0.55 * (1 - u)),
              },
              geometry: { type: "Point", coordinates: impactPt },
            });
          }
          // Bright inner dot.
          features.push({
            type: "Feature",
            properties: {
              layer: "dot",
              color: arc.color,
              radius: 6 - 4 * impactPhase,
              opacity: Math.max(0.2, 1 - impactPhase),
            },
            geometry: { type: "Point", coordinates: impactPt },
          });
        } else if (arc.flavour === "intercept") {
          // Amber starburst: three rings in close succession.
          for (let k = 0; k < 3; k++) {
            const offset = k * 0.18;
            const ip = (impactPhase - offset) / 0.55;
            if (ip <= 0 || ip >= 1) continue;
            features.push({
              type: "Feature",
              properties: {
                layer: "ring",
                color: "#ffd166",
                radius: 4 + 14 * ip,
                opacity: Math.max(0, 0.9 * (1 - ip)),
              },
              geometry: { type: "Point", coordinates: impactPt },
            });
          }
          features.push({
            type: "Feature",
            properties: {
              layer: "dot",
              color: "#ffd166",
              radius: 3,
              opacity: Math.max(0, 1 - impactPhase),
            },
            geometry: { type: "Point", coordinates: impactPt },
          });
        } else {
          // Miss: tracer skips past target and fades. Render a small dim mark.
          features.push({
            type: "Feature",
            properties: {
              layer: "dot",
              color: impactColor(arc.flavour, arc.color),
              radius: 3,
              opacity: Math.max(0, 0.6 * (1 - impactPhase)),
            },
            geometry: { type: "Point", coordinates: impactPt },
          });
        }
      }
    });

    // Smoke puffs across all arcs.
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      const age = now - p.bornMs;
      if (age >= SMOKE_LIFETIME_MS) {
        puffs.splice(i, 1);
        continue;
      }
      const u = age / SMOKE_LIFETIME_MS;
      features.push({
        type: "Feature",
        properties: {
          layer: "smoke",
          color: p.color,
          radius: 2.2 + 6 * u,
          opacity: 0.55 * (1 - u),
        },
        geometry: { type: "Point", coordinates: p.pos },
      });
    }

    src!.setData({ type: "FeatureCollection", features });

    if (t < plan.totalDurationMs || puffs.length > 0) {
      requestAnimationFrame(frame);
    } else {
      src!.setData(empty);
    }
  }
  requestAnimationFrame(frame);
  return () => {
    stopped = true;
    src.setData(empty);
  };
}

/** Return the sub-curve coords from `t0` to `t1` (both in [0, 1]) along
 *  the precomputed path, including interpolated endpoints. */
function sliceCurve(
  path: [number, number][],
  t0: number,
  t1: number,
): [number, number][] {
  if (t0 >= t1 || path.length < 2) return [];
  const lastIdx = path.length - 1;
  const f0 = Math.max(0, Math.min(1, t0)) * lastIdx;
  const f1 = Math.max(0, Math.min(1, t1)) * lastIdx;
  const i0 = Math.floor(f0);
  const i1 = Math.floor(f1);
  const out: [number, number][] = [pointAt(path, t0)];
  for (let i = i0 + 1; i <= i1; i++) out.push(path[i]);
  out.push(pointAt(path, t1));
  return out;
}

export function clearStrikeArcs(map: MlMap): void {
  const src = map.getSource(SOURCE_STRIKE_ARC) as GeoJSONSource | undefined;
  if (src) src.setData(empty);
}
