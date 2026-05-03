import type { GeoJSONSource, LayerSpecification, Map as MlMap } from "maplibre-gl";
import type { Unit } from "@/types/scenario";
import {
  geodesicCirclePolygon,
  greatCircleLineString,
  haversineKm,
} from "@/map/geodesic";
import type { GroundMoveDraft } from "@/state/groundMove";
import { groundMoveRadiusKm } from "@/state/groundMove";
import { LAYER_UNIT_DOT } from "@/map/style";

export const SOURCE_MOVEMENT = "movement_overlay";
export const LAYER_MOVEMENT_FILL = "movement_overlay_fill";
export const LAYER_MOVEMENT_RING = "movement_overlay_ring";
export const LAYER_MOVEMENT_ROUTE = "movement_overlay_route";
export const LAYER_MOVEMENT_DEST = "movement_overlay_dest";

const movementRoutePaint = {
  "line-color": "#c4f0ff",
  "line-width": 4.5,
  "line-opacity": 0.98,
  "line-dasharray": [2.8, 2] as [number, number],
};

/** Ghost destination vs solid unit icon on the map. */
const MOVEMENT_DEST_ICON_OPACITY = 0.52;

/** Same `icon-size` stops as `unitDotLayer` so the ground square matches the unit marker. */
const movementDestLayer = {
  id: LAYER_MOVEMENT_DEST,
  type: "symbol",
  source: SOURCE_MOVEMENT,
  filter: ["==", ["get", "layer"], "dest"],
  layout: {
    "icon-image": ["concat", "axis-unit-", "ground", "-", ["get", "faction_id"]],
    "icon-size": [
      "interpolate",
      ["linear"],
      ["zoom"],
      3, 0.45,
      6, 0.65,
      8, 0.85,
    ],
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
  },
  paint: {
    "icon-opacity": MOVEMENT_DEST_ICON_OPACITY,
  },
} satisfies LayerSpecification;

const emptyFc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function addMovementDestLayer(map: MlMap): void {
  if (map.getLayer(LAYER_MOVEMENT_DEST)) return;
  map.addLayer(movementDestLayer, LAYER_UNIT_DOT);
}

export function ensureMovementOverlay(map: MlMap): void {
  if (!map.getSource(SOURCE_MOVEMENT)) {
    map.addSource(SOURCE_MOVEMENT, { type: "geojson", data: emptyFc });

    map.addLayer(
      {
        id: LAYER_MOVEMENT_FILL,
        type: "fill",
        source: SOURCE_MOVEMENT,
        filter: ["==", ["get", "layer"], "disc"],
        paint: {
          "fill-color": "#c5dff5",
          "fill-opacity": 0.22,
        },
      },
      LAYER_UNIT_DOT,
    );

    map.addLayer(
      {
        id: LAYER_MOVEMENT_RING,
        type: "line",
        source: SOURCE_MOVEMENT,
        filter: ["==", ["get", "layer"], "ring"],
        paint: {
          "line-color": "#f0f7ff",
          "line-width": 2.5,
          "line-opacity": 0.95,
        },
      },
      LAYER_UNIT_DOT,
    );

    map.addLayer(
      {
        id: LAYER_MOVEMENT_ROUTE,
        type: "line",
        source: SOURCE_MOVEMENT,
        filter: ["==", ["get", "layer"], "route"],
        paint: movementRoutePaint,
      },
      LAYER_UNIT_DOT,
    );

    addMovementDestLayer(map);
  } else if (!map.getLayer(LAYER_MOVEMENT_DEST)) {
    addMovementDestLayer(map);
  }
}

export function refreshMovementOverlayData(
  map: MlMap,
  drafts: Record<string, GroundMoveDraft>,
  units: Unit[],
): void {
  const src = map.getSource(SOURCE_MOVEMENT) as GeoJSONSource | undefined;
  if (!src) return;

  if (map.getLayer(LAYER_MOVEMENT_FILL)) {
    map.setPaintProperty(LAYER_MOVEMENT_FILL, "fill-color", "#c5dff5");
    map.setPaintProperty(LAYER_MOVEMENT_FILL, "fill-opacity", 0.22);
    map.setPaintProperty(LAYER_MOVEMENT_RING, "line-color", "#f0f7ff");
    map.setPaintProperty(LAYER_MOVEMENT_RING, "line-width", 2.5);
    map.setPaintProperty(LAYER_MOVEMENT_RING, "line-opacity", 0.95);
  }
  if (map.getLayer(LAYER_MOVEMENT_ROUTE)) {
    map.setPaintProperty(LAYER_MOVEMENT_ROUTE, "line-color", movementRoutePaint["line-color"]);
    map.setPaintProperty(LAYER_MOVEMENT_ROUTE, "line-width", movementRoutePaint["line-width"]);
    map.setPaintProperty(LAYER_MOVEMENT_ROUTE, "line-opacity", movementRoutePaint["line-opacity"]);
    map.setPaintProperty(LAYER_MOVEMENT_ROUTE, "line-dasharray", movementRoutePaint["line-dasharray"]);
  }
  if (map.getLayer(LAYER_MOVEMENT_DEST)) {
    map.setPaintProperty(LAYER_MOVEMENT_DEST, "icon-opacity", MOVEMENT_DEST_ICON_OPACITY);
  }

  const unitById = new Map(units.map((u) => [u.id, u]));
  const features: GeoJSON.Feature[] = [];

  for (const [unitId, draft] of Object.entries(drafts)) {
    const unit = unitById.get(unitId);
    if (!unit || unit.domain !== "ground") continue;

    const r = groundMoveRadiusKm(draft.mode);
    const disc = geodesicCirclePolygon(draft.origin, r);
    const ringCoords = disc.coordinates[0].slice(0, -1);

    features.push({
      type: "Feature",
      properties: { layer: "disc", unitId },
      geometry: disc,
    });
    features.push({
      type: "Feature",
      properties: { layer: "ring", unitId },
      geometry: { type: "LineString", coordinates: ringCoords },
    });

    if (draft.destination) {
      const dest = draft.destination;
      features.push({
        type: "Feature",
        properties: { layer: "dest", unitId, faction_id: unit.faction_id },
        geometry: { type: "Point", coordinates: dest },
      });
      if (haversineKm(draft.origin, dest) > 1e-6) {
        features.push({
          type: "Feature",
          properties: { layer: "route", unitId },
          geometry: greatCircleLineString(draft.origin, dest),
        });
      }
    }
  }

  src.setData({ type: "FeatureCollection", features });
}
