import type { GeoJSONSource, LayerSpecification, Map as MlMap } from "maplibre-gl";
import { geodesicCirclePolygon, greatCircleLineString, haversineKm } from "@/map/geodesic";
import type { ActionDraft } from "@/state/actionDraft";
import { LAYER_UNIT_DOT } from "@/map/style";

export const SOURCE_ACTION_DRAFT = "action_draft_overlay";
export const LAYER_ACTION_DRAFT_FILL = "action_draft_fill";
export const LAYER_ACTION_DRAFT_RING = "action_draft_ring";
export const LAYER_ACTION_DRAFT_ROUTE = "action_draft_route";
export const LAYER_ACTION_DRAFT_CANDIDATE = "action_draft_candidate";
export const LAYER_ACTION_DRAFT_CANDIDATE_LABEL = "action_draft_candidate_label";
export const LAYER_ACTION_DRAFT_SELECTED = "action_draft_selected";

const emptyFc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** Visual variant per draft.kind; controls fill/ring/route colour. */
function tone(kind: ActionDraft["kind"]): { fill: string; ring: string; route: string; mark: string; selected: string } {
  switch (kind) {
    case "rebase_air":
    case "naval_move":
      return {
        fill: "#7ad492", ring: "#aef0bb", route: "#bfffce",
        mark: "#7ad492", selected: "#dde3ec",
      };
    case "engage":
    case "air_sortie":
    case "missile_strike":
    case "naval_strike":
    case "interdict_supply":
      return {
        fill: "#ff5a5a", ring: "#ff8b8b", route: "#ffb0b0",
        mark: "#ff8b8b", selected: "#ffeaea",
      };
  }
}

export function ensureActionDraftOverlay(map: MlMap): void {
  if (!map.getSource(SOURCE_ACTION_DRAFT)) {
    map.addSource(SOURCE_ACTION_DRAFT, { type: "geojson", data: emptyFc });
  }
  const layers: LayerSpecification[] = [
    {
      id: LAYER_ACTION_DRAFT_FILL,
      type: "fill",
      source: SOURCE_ACTION_DRAFT,
      filter: ["==", ["get", "layer"], "disc"],
      paint: {
        "fill-color": ["get", "tone_fill"],
        "fill-opacity": 0.10,
      },
    },
    {
      id: LAYER_ACTION_DRAFT_RING,
      type: "line",
      source: SOURCE_ACTION_DRAFT,
      filter: ["==", ["get", "layer"], "ring"],
      paint: {
        "line-color": ["get", "tone_ring"],
        "line-width": 1.6,
        "line-opacity": 0.9,
        "line-dasharray": [3, 2] as unknown as [number, number],
      },
    },
    {
      id: LAYER_ACTION_DRAFT_ROUTE,
      type: "line",
      source: SOURCE_ACTION_DRAFT,
      filter: ["==", ["get", "layer"], "route"],
      paint: {
        "line-color": ["get", "tone_route"],
        "line-width": 2.5,
        "line-opacity": 0.95,
        "line-dasharray": [1, 1.5] as unknown as [number, number],
      },
    },
    {
      id: LAYER_ACTION_DRAFT_CANDIDATE,
      type: "circle",
      source: SOURCE_ACTION_DRAFT,
      filter: ["==", ["get", "layer"], "candidate"],
      paint: {
        "circle-radius": 6,
        "circle-color": ["get", "tone_mark"],
        "circle-opacity": 0.55,
        "circle-stroke-color": "#0b0f14",
        "circle-stroke-width": 1.5,
      },
    },
    {
      id: LAYER_ACTION_DRAFT_CANDIDATE_LABEL,
      type: "symbol",
      source: SOURCE_ACTION_DRAFT,
      filter: ["==", ["get", "layer"], "candidate"],
      layout: {
        "text-field": ["get", "name"],
        "text-size": 10,
        "text-offset": [0.85, 0],
        "text-anchor": "left",
        "text-font": ["Open Sans Regular"],
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#dde3ec",
        "text-halo-color": "#0b0f14",
        "text-halo-width": 1.4,
      },
    },
    {
      id: LAYER_ACTION_DRAFT_SELECTED,
      type: "circle",
      source: SOURCE_ACTION_DRAFT,
      filter: ["==", ["get", "layer"], "selected"],
      paint: {
        "circle-radius": 10,
        "circle-color": "transparent",
        "circle-stroke-color": ["get", "tone_selected"],
        "circle-stroke-width": 2.4,
      },
    },
  ];
  for (const spec of layers) {
    if (!map.getLayer(spec.id)) {
      // Mount under unit dots so unit icons stay clickable on top.
      if (map.getLayer(LAYER_UNIT_DOT)) {
        map.addLayer(spec, LAYER_UNIT_DOT);
      } else {
        map.addLayer(spec);
      }
    }
  }
}

export function refreshActionDraftOverlay(map: MlMap, draft: ActionDraft | null): void {
  const src = map.getSource(SOURCE_ACTION_DRAFT) as GeoJSONSource | undefined;
  if (!src) return;
  if (!draft) {
    src.setData(emptyFc);
    return;
  }
  const t = tone(draft.kind);
  const props = { tone_fill: t.fill, tone_ring: t.ring, tone_route: t.route, tone_mark: t.mark, tone_selected: t.selected };
  const features: GeoJSON.Feature[] = [];

  const disc = geodesicCirclePolygon(draft.origin, draft.rangeKm);
  const ring = disc.coordinates[0].slice(0, -1);
  features.push({ type: "Feature", properties: { layer: "disc", ...props }, geometry: disc });
  features.push({
    type: "Feature",
    properties: { layer: "ring", ...props },
    geometry: { type: "LineString", coordinates: ring },
  });

  for (const c of draft.candidates) {
    features.push({
      type: "Feature",
      properties: { layer: "candidate", id: c.id, name: c.name, ...props },
      geometry: { type: "Point", coordinates: c.position },
    });
  }

  if (draft.selectedCandidateId) {
    const sel = draft.candidates.find((c) => c.id === draft.selectedCandidateId);
    if (sel) {
      features.push({
        type: "Feature",
        properties: { layer: "selected", id: sel.id, ...props },
        geometry: { type: "Point", coordinates: sel.position },
      });
      if (haversineKm(draft.origin, sel.position) > 1e-6) {
        features.push({
          type: "Feature",
          properties: { layer: "route", ...props },
          geometry: greatCircleLineString(draft.origin, sel.position),
        });
      }
    }
  }

  src.setData({ type: "FeatureCollection", features });
}
