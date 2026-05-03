import type { LayerSpecification } from "maplibre-gl";
import type { City, Faction } from "@/types/scenario";
import {
  LAYER_CITY_DOT,
  LAYER_CITY_HALO,
  LAYER_CITY_LABEL,
  SOURCE_CITIES,
} from "../style";
import { CITY_ICON } from "./iconSprites";

export const LAYER_CITY_ICON = "axis-city-icon-symbol";
export const LAYER_CITY_PLATE = "axis-city-plate";

export interface CityProps {
  id: string;
  name: string;
  faction_id: string;
  color: string;
  importance: City["importance"];
  importance_rank: number;
}

const IMPORTANCE_RANK: Record<City["importance"], number> = {
  capital: 3,
  major: 2,
  minor: 1,
};

export function cityFeatureCollection(
  cities: City[],
  factionsById: Map<string, Faction>,
): GeoJSON.FeatureCollection<GeoJSON.Point, CityProps> {
  const features = cities.map<GeoJSON.Feature<GeoJSON.Point, CityProps>>((c) => ({
    type: "Feature",
    properties: {
      id: c.id,
      name: c.name,
      faction_id: c.faction_id,
      color: factionsById.get(c.faction_id)?.color ?? "#cccccc",
      importance: c.importance,
      importance_rank: IMPORTANCE_RANK[c.importance],
    },
    geometry: { type: "Point", coordinates: c.position },
  }));
  return { type: "FeatureCollection", features };
}

export const cityHaloLayer: LayerSpecification = {
  id: LAYER_CITY_HALO,
  type: "circle",
  source: SOURCE_CITIES,
  paint: {
    "circle-color": ["get", "color"],
    "circle-opacity": [
      "case",
      ["boolean", ["feature-state", "hover"], false], 0.18,
      0.0,
    ],
    "circle-radius": [
      "interpolate", ["linear"], ["get", "importance_rank"],
      1, 9,
      3, 14,
    ],
    "circle-blur": 0.5,
  },
};

/**
 * Dark plate that gives every city icon a consistent legibility floor against
 * the satellite basemap, with a faction-coloured rim that brightens on hover.
 * The plate also serves as the click target now that the bare dot is retired.
 *
 * Importance hierarchy is conveyed through plate radius (capital > major >
 * minor) using `match` at the outer level so the inner zoom interpolation
 * is a clean numeric expression that maplibre accepts.
 */
export const cityPlateLayer: LayerSpecification = {
  id: LAYER_CITY_PLATE,
  type: "circle",
  source: SOURCE_CITIES,
  paint: {
    "circle-color": "rgba(11,15,20,0.88)",
    "circle-stroke-color": ["get", "color"],
    "circle-stroke-width": [
      "case",
      ["boolean", ["feature-state", "hover"], false], 1.8,
      ["==", ["get", "importance"], "capital"], 1.6,
      1.1,
    ],
    "circle-radius": [
      "interpolate", ["linear"], ["zoom"],
      3, ["match", ["get", "importance"], "capital", 9, "major", 7, 6],
      6, ["match", ["get", "importance"], "capital", 13, "major", 11, 9],
      9, ["match", ["get", "importance"], "capital", 17, "major", 14, 12],
    ],
    "circle-opacity": 0.95,
  },
};

/**
 * Legacy circle dot. Kept exported for backwards compatibility but no longer
 * registered with the map; every city now wears a plate + skyline icon.
 */
export const cityDotLayer: LayerSpecification = {
  id: LAYER_CITY_DOT,
  type: "circle",
  source: SOURCE_CITIES,
  paint: {
    "circle-color": "#0b0f14",
    "circle-stroke-color": ["get", "color"],
    "circle-stroke-width": 1.4,
    "circle-radius": 4,
    "circle-opacity": 0,
    "circle-stroke-opacity": 0,
  },
};

/** SDF skyline glyph for every city, sized by importance and zoom. */
export const cityIconLayer: LayerSpecification = {
  id: LAYER_CITY_ICON,
  type: "symbol",
  source: SOURCE_CITIES,
  layout: {
    "icon-image": CITY_ICON,
    "icon-size": [
      "interpolate", ["linear"], ["zoom"],
      3, ["match", ["get", "importance"], "capital", 0.55, "major", 0.45, 0.38],
      6, ["match", ["get", "importance"], "capital", 0.78, "major", 0.65, 0.55],
      9, ["match", ["get", "importance"], "capital", 1.0, "major", 0.85, 0.72],
    ],
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
  },
  paint: {
    "icon-color": ["get", "color"],
    "icon-halo-color": "rgba(7,10,14,0.9)",
    "icon-halo-width": 1.2,
    "icon-opacity": 1,
  },
};

export const cityLabelLayer: LayerSpecification = {
  id: LAYER_CITY_LABEL,
  type: "symbol",
  source: SOURCE_CITIES,
  layout: {
    "text-field": ["get", "name"],
    "text-font": ["Open Sans Semibold"],
    "text-size": [
      "interpolate", ["linear"], ["zoom"],
      4, ["match", ["get", "importance"], "capital", 11, "major", 10, 9],
      6, ["match", ["get", "importance"], "capital", 12, "major", 11, 10],
      9, ["match", ["get", "importance"], "capital", 13, "major", 12, 11],
    ],
    "text-offset": [1.0, 0],
    "text-anchor": "left",
    "text-letter-spacing": 0.08,
    "text-allow-overlap": false,
  },
  paint: {
    "text-color": "#dde3ec",
    "text-halo-color": "#070a0e",
    "text-halo-width": 1.4,
  },
};
