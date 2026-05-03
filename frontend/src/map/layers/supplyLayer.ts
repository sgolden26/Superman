import type { LayerSpecification } from "maplibre-gl";
import type { Feature, LineString } from "geojson";
import type { Faction, SupplyLine } from "@/types/scenario";

export const SOURCE_SUPPLY = "axis-supply";
export const LAYER_SUPPLY_LINE = "axis-supply-line";
export const LAYER_SUPPLY_DASH = "axis-supply-dash";

export interface SupplyProps {
  id: string;
  name: string;
  faction_id: string;
  mode: SupplyLine["mode"];
  health: number;
  color: string;
}

export function supplyFeatureCollection(
  items: SupplyLine[],
  factionsById: Map<string, Faction>,
): GeoJSON.FeatureCollection<LineString, SupplyProps> {
  const features = items.map<Feature<LineString, SupplyProps>>((s) => ({
    type: "Feature",
    properties: {
      id: s.id,
      name: s.name,
      faction_id: s.faction_id,
      mode: s.mode,
      health: s.health,
      color: factionsById.get(s.faction_id)?.color ?? "#aab4c2",
    },
    geometry: { type: "LineString", coordinates: s.path },
  }));
  return { type: "FeatureCollection", features };
}

/** Underlay: a thin solid line shaded by health. */
export const supplyLineLayer: LayerSpecification = {
  id: LAYER_SUPPLY_LINE,
  type: "line",
  source: SOURCE_SUPPLY,
  paint: {
    "line-color": [
      "interpolate",
      ["linear"],
      ["get", "health"],
      0, "#ff5a5a",
      0.5, "#d6a45a",
      1, ["get", "color"],
    ],
    "line-width": 1.4,
    "line-opacity": 0.45,
  },
};

/**
 * Overlay: dashed segment that we animate by stepping `line-dasharray`. The
 * MapView wires up an interval to advance the dash phase to give a flow effect.
 */
export const supplyDashLayer: LayerSpecification = {
  id: LAYER_SUPPLY_DASH,
  type: "line",
  source: SOURCE_SUPPLY,
  paint: {
    "line-color": [
      "interpolate",
      ["linear"],
      ["get", "health"],
      0, "#ff5a5a",
      0.5, "#d6a45a",
      1, ["get", "color"],
    ],
    "line-width": 2.4,
    "line-opacity": 0.85,
    "line-dasharray": [0.5, 2],
  },
};
