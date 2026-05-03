import type { GeoJSONSource, LayerSpecification, Map as MlMap } from "maplibre-gl";
import {
  destinationPointKm,
  greatCircleInterpolate,
  greatCircleLineString,
  haversineKm,
} from "@/map/geodesic";
import { stagedOrderSource, type StagedOrder } from "@/state/orders";
import type { ScenarioSnapshot } from "@/types/scenario";
import { LAYER_UNIT_DOT } from "@/map/style";

export const SOURCE_STAGED_ORDERS = "staged_orders_overlay";
export const LAYER_STAGED_GLOW = "staged_orders_glow";
export const LAYER_STAGED_MOVE = "staged_orders_move";
export const LAYER_STAGED_STRIKE = "staged_orders_strike";
export const LAYER_STAGED_RESUPPLY = "staged_orders_resupply";
export const LAYER_STAGED_ENTRENCH = "staged_orders_entrench";
export const LAYER_STAGED_CHEVRON = "staged_orders_chevron";
export const LAYER_STAGED_ORIGIN = "staged_orders_origin";

const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

const ENTRENCH_RING_KM = 12;

/** Mount the staged-orders overlay layers. Idempotent — safe to call on
 *  every scenario refresh. Layers are inserted under `LAYER_UNIT_DOT` so
 *  unit icons stay clickable on top. */
export function ensureStagedOrdersOverlay(map: MlMap): void {
  if (!map.getSource(SOURCE_STAGED_ORDERS)) {
    map.addSource(SOURCE_STAGED_ORDERS, { type: "geojson", data: empty });
  }
  const specs: LayerSpecification[] = [
    {
      id: LAYER_STAGED_GLOW,
      type: "line",
      source: SOURCE_STAGED_ORDERS,
      filter: [
        "all",
        ["==", ["get", "source"], "llm"],
        ["in", ["get", "layer"], ["literal", ["move", "strike", "resupply"]]],
      ],
      paint: {
        "line-color": "#7ad492",
        "line-width": 6,
        "line-opacity": 0.20,
        "line-blur": 1.5,
      },
      layout: { "line-cap": "round" },
    },
    {
      id: LAYER_STAGED_MOVE,
      type: "line",
      source: SOURCE_STAGED_ORDERS,
      filter: ["==", ["get", "layer"], "move"],
      paint: {
        "line-color": ["get", "color"],
        "line-width": 2.4,
        "line-opacity": 0.85,
      },
      layout: { "line-cap": "round" },
    },
    {
      id: LAYER_STAGED_STRIKE,
      type: "line",
      source: SOURCE_STAGED_ORDERS,
      filter: ["==", ["get", "layer"], "strike"],
      paint: {
        "line-color": ["get", "color"],
        "line-width": 1.8,
        "line-opacity": 0.78,
        "line-dasharray": [2, 2] as unknown as [number, number],
      },
      layout: { "line-cap": "round" },
    },
    {
      id: LAYER_STAGED_RESUPPLY,
      type: "line",
      source: SOURCE_STAGED_ORDERS,
      filter: ["==", ["get", "layer"], "resupply"],
      paint: {
        "line-color": "#7ad492",
        "line-width": 1.4,
        "line-opacity": 0.85,
        "line-dasharray": [0.6, 1.6] as unknown as [number, number],
      },
    },
    {
      id: LAYER_STAGED_ENTRENCH,
      type: "line",
      source: SOURCE_STAGED_ORDERS,
      filter: ["==", ["get", "layer"], "entrench"],
      paint: {
        "line-color": ["get", "color"],
        "line-width": 1.8,
        "line-opacity": 0.85,
        "line-dasharray": [2, 1.5] as unknown as [number, number],
      },
    },
    {
      id: LAYER_STAGED_CHEVRON,
      type: "circle",
      source: SOURCE_STAGED_ORDERS,
      filter: ["==", ["get", "layer"], "chevron"],
      paint: {
        "circle-radius": 4.5,
        "circle-color": ["get", "color"],
        "circle-opacity": 0.95,
        "circle-stroke-color": "#0b0f14",
        "circle-stroke-width": 1.4,
      },
    },
    {
      id: LAYER_STAGED_ORIGIN,
      type: "circle",
      source: SOURCE_STAGED_ORDERS,
      filter: ["==", ["get", "layer"], "origin"],
      paint: {
        "circle-radius": 2.5,
        "circle-color": ["get", "color"],
        "circle-opacity": 0.95,
        "circle-stroke-color": "#0b0f14",
        "circle-stroke-width": 1.0,
      },
    },
  ];
  for (const spec of specs) {
    if (map.getLayer(spec.id)) continue;
    if (map.getLayer(LAYER_UNIT_DOT)) {
      map.addLayer(spec, LAYER_UNIT_DOT);
    } else {
      map.addLayer(spec);
    }
  }
}

/** Update the overlay from the current per-team staged orders.
 *
 *  `scenario` is consulted for entities (units, depots) whose live position
 *  the order itself doesn't snapshot (engage / resupply / entrench).
 */
export function refreshStagedOrdersOverlay(
  map: MlMap,
  orders: StagedOrder[],
  scenario: ScenarioSnapshot | null,
  options: { suppress?: boolean } = {},
): void {
  const src = map.getSource(SOURCE_STAGED_ORDERS) as GeoJSONSource | undefined;
  if (!src) return;
  if (options.suppress || orders.length === 0 || !scenario) {
    src.setData(empty);
    return;
  }

  const unitsById = new Map(scenario.units.map((u) => [u.id, u]));
  const depotsById = new Map(scenario.depots.map((d) => [d.id, d]));

  const features: GeoJSON.Feature[] = [];
  for (const o of orders) {
    const color = teamColor(o.team);
    const source = stagedOrderSource(o);
    const baseProps = { id: o.id, kind: o.kind, source, color };
    pushFeaturesFor(features, o, baseProps, unitsById, depotsById);
  }
  src.setData({ type: "FeatureCollection", features });
}

function pushFeaturesFor(
  out: GeoJSON.Feature[],
  o: StagedOrder,
  baseProps: { id: string; kind: string; source: string; color: string },
  unitsById: Map<string, ScenarioSnapshot["units"][number]>,
  depotsById: Map<string, ScenarioSnapshot["depots"][number]>,
): void {
  switch (o.kind) {
    case "move":
    case "naval_move":
    case "rebase_air": {
      pushArrow(out, "move", o.origin, o.destination, baseProps);
      return;
    }
    case "air_sortie":
    case "naval_strike":
    case "missile_strike":
    case "interdict_supply": {
      pushArrow(out, "strike", o.origin, o.targetPos, baseProps);
      return;
    }
    case "engage": {
      const a = unitsById.get(o.attackerId);
      const t = unitsById.get(o.targetId);
      if (!a || !t) return;
      pushArrow(
        out,
        "strike",
        [a.position[0], a.position[1]],
        [t.position[0], t.position[1]],
        baseProps,
      );
      return;
    }
    case "resupply": {
      const d = depotsById.get(o.depotId);
      const u = unitsById.get(o.unitId);
      if (!d || !u) return;
      const from: [number, number] = [d.position[0], d.position[1]];
      const to: [number, number] = [u.position[0], u.position[1]];
      if (haversineKm(from, to) < 1e-3) return;
      out.push({
        type: "Feature",
        properties: { ...baseProps, layer: "resupply" },
        geometry: greatCircleLineString(from, to),
      });
      out.push({
        type: "Feature",
        properties: { ...baseProps, layer: "origin" },
        geometry: { type: "Point", coordinates: from },
      });
      out.push({
        type: "Feature",
        properties: { ...baseProps, layer: "chevron" },
        geometry: { type: "Point", coordinates: to },
      });
      return;
    }
    case "entrench": {
      const u = unitsById.get(o.unitId);
      if (!u) return;
      out.push({
        type: "Feature",
        properties: { ...baseProps, layer: "entrench" },
        geometry: ringPolygon([u.position[0], u.position[1]], ENTRENCH_RING_KM),
      });
      return;
    }
  }
}

function pushArrow(
  out: GeoJSON.Feature[],
  layer: "move" | "strike",
  origin: [number, number],
  destination: [number, number],
  baseProps: { id: string; kind: string; source: string; color: string },
): void {
  if (haversineKm(origin, destination) < 1e-3) return;
  out.push({
    type: "Feature",
    properties: { ...baseProps, layer },
    geometry: greatCircleLineString(origin, destination),
  });
  out.push({
    type: "Feature",
    properties: { ...baseProps, layer: "origin" },
    geometry: { type: "Point", coordinates: origin },
  });
  out.push({
    type: "Feature",
    properties: { ...baseProps, layer: "chevron" },
    geometry: { type: "Point", coordinates: destination },
  });
  const lead = greatCircleInterpolate(destination, origin, 0.05);
  out.push({
    type: "Feature",
    properties: { ...baseProps, layer: "origin" },
    geometry: { type: "Point", coordinates: lead },
  });
}

function teamColor(team: "red" | "blue"): string {
  return team === "blue" ? "#5aa9ff" : "#ff5a5a";
}

function ringPolygon(
  center: [number, number],
  radiusKm: number,
): GeoJSON.LineString {
  const segments = 48;
  const coords: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const brng = (360 * i) / segments;
    coords.push(destinationPointKm(center, brng, radiusKm));
  }
  return { type: "LineString", coordinates: coords };
}
