import type { LayerSpecification } from "maplibre-gl";
import type { Faction, Territory } from "@/types/scenario";
import type { Country } from "@/types/country";
import { metricNormalised, type ChoroplethMetric } from "@/types/country";
import type { RegionIntel } from "@/types/intel";
import {
  LAYER_TERRITORY_FILL,
  LAYER_TERRITORY_LINE,
  SOURCE_TERRITORIES,
} from "../style";

export interface ChoroplethResolver {
  enabled: boolean;
  metric: ChoroplethMetric;
  countryById: Map<string, Country>;
}

export function territoryFeatureCollection(
  territories: Territory[],
  factionsById: Map<string, Faction>,
  intelById: Map<string, RegionIntel> = new Map(),
  choro?: ChoroplethResolver,
): GeoJSON.FeatureCollection<GeoJSON.Polygon, TerritoryProps> {
  const features = territories.map<GeoJSON.Feature<GeoJSON.Polygon, TerritoryProps>>(
    (t) => {
      const intel = intelById.get(t.id);
      const morale = intel?.morale_score ?? null;

      let cm_value = 0;
      let cm_has = 0;
      if (choro?.enabled && t.country_id) {
        const country = choro.countryById.get(t.country_id);
        if (country) {
          cm_value = metricNormalised(country, choro.metric);
          cm_has = 1;
        }
      }

      return {
        type: "Feature",
        properties: {
          id: t.id,
          name: t.name,
          faction_id: t.faction_id,
          country_id: t.country_id ?? "",
          color: factionsById.get(t.faction_id)?.color ?? "#888888",
          control: t.control,
          morale: morale ?? 50,
          has_morale: morale !== null ? 1 : 0,
          morale_trend: intel?.morale_trend ?? "steady",
          cm_value,
          cm_has,
        },
        geometry: { type: "Polygon", coordinates: t.polygon },
      };
    },
  );
  return { type: "FeatureCollection", features };
}

export interface TerritoryProps {
  id: string;
  name: string;
  faction_id: string;
  country_id: string;
  color: string;
  control: number;
  morale: number;
  has_morale: number;
  morale_trend: string;
  cm_value: number;
  cm_has: number;
}

export const territoryFillLayer: LayerSpecification = {
  id: LAYER_TERRITORY_FILL,
  type: "fill",
  source: SOURCE_TERRITORIES,
  paint: {
    "fill-color": [
      "case",
      // Country choropleth takes priority when available.
      ["==", ["get", "cm_has"], 1],
      [
        "interpolate",
        ["linear"],
        ["get", "cm_value"],
        0, "#2a2f3a",
        0.25, "#5fc7c1",
        0.5, "#d6a45a",
        0.75, "#ff8b67",
        1, "#ff5a5a",
      ],
      // Fall back to morale-based shading when intel exists.
      ["==", ["get", "has_morale"], 0],
      ["get", "color"],
      [
        "interpolate",
        ["linear"],
        ["get", "morale"],
        0, "#ff5a5a",
        30, "#d6a45a",
        50, "#aab4c2",
        70, "#5aa9ff",
        100, "#7ad492",
      ],
    ],
    "fill-opacity": [
      "case",
      ["boolean", ["feature-state", "selected"], false], 0.5,
      ["boolean", ["feature-state", "hover"], false], 0.36,
      ["==", ["get", "cm_has"], 1], 0.40,
      // Lower morale -> stronger tint to make weak regions visually obvious
      [
        "interpolate",
        ["linear"],
        ["get", "morale"],
        0, 0.34,
        50, 0.18,
        100, 0.14,
      ],
    ],
  },
};

export const territoryLineLayer: LayerSpecification = {
  id: LAYER_TERRITORY_LINE,
  type: "line",
  source: SOURCE_TERRITORIES,
  paint: {
    "line-color": ["get", "color"],
    "line-width": [
      "case",
      ["boolean", ["feature-state", "selected"], false], 2.0,
      1.0,
    ],
    "line-opacity": 0.85,
  },
};
