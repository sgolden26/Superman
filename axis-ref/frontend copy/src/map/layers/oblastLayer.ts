import type { LayerSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Faction, Oblast } from "@/types/scenario";
import type { Admin1Props } from "@/api/loadBorders";
import type { ChoroplethResolver } from "./territoryLayer";
import { metricNormalised } from "@/types/country";

export const SOURCE_OBLASTS = "axis-oblasts";
export const LAYER_OBLAST_FILL = "axis-oblast-fill";
export const LAYER_OBLAST_LINE = "axis-oblast-line";
export const LAYER_OBLAST_LABEL = "axis-oblast-label";

export interface OblastProps {
  id: string;
  iso_3166_2: string;
  name: string;
  country_id: string;
  faction_id: string;
  color: string;
  control: number;
  contested: number;
  morale: number;
  civil_unrest: number;
  cm_value: number;
  cm_has: number;
}

export function oblastFeatureCollection(
  oblasts: Oblast[],
  factionsById: Map<string, Faction>,
  admin1: FeatureCollection<Geometry, Admin1Props>,
  choro?: ChoroplethResolver,
): FeatureCollection<Geometry, OblastProps> {
  const byIso = new Map<string, Feature<Geometry, Admin1Props>>();
  for (const f of admin1.features) byIso.set(f.properties.iso_3166_2, f);

  const features: Feature<Geometry, OblastProps>[] = [];
  for (const o of oblasts) {
    const geom = byIso.get(o.iso_3166_2);
    if (!geom) continue;
    const color = factionsById.get(o.faction_id)?.color ?? "#888888";

    let cm_value = 0;
    let cm_has = 0;
    if (choro?.enabled) {
      const country = choro.countryById.get(o.country_id);
      if (country) {
        cm_value = metricNormalised(country, choro.metric);
        cm_has = 1;
      }
    }

    features.push({
      type: "Feature",
      properties: {
        id: o.id,
        iso_3166_2: o.iso_3166_2,
        name: o.name,
        country_id: o.country_id,
        faction_id: o.faction_id,
        color,
        control: o.control,
        contested: o.contested ? 1 : 0,
        morale: o.morale,
        civil_unrest: o.civil_unrest,
        cm_value,
        cm_has,
      },
      geometry: geom.geometry,
    });
  }
  return { type: "FeatureCollection", features };
}

export const oblastFillLayer: LayerSpecification = {
  id: LAYER_OBLAST_FILL,
  type: "fill",
  source: SOURCE_OBLASTS,
  paint: {
    "fill-color": [
      "case",
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
      ["==", ["get", "contested"], 1],
      "#d6a45a",
      ["get", "color"],
    ],
    "fill-opacity": [
      "case",
      ["boolean", ["feature-state", "selected"], false], 0.32,
      ["boolean", ["feature-state", "hover"], false], 0.18,
      ["==", ["get", "cm_has"], 1], 0.20,
      ["==", ["get", "contested"], 1], 0.16,
      0.08,
    ],
  },
};

export const oblastLineLayer: LayerSpecification = {
  id: LAYER_OBLAST_LINE,
  type: "line",
  source: SOURCE_OBLASTS,
  paint: {
    "line-color": [
      "case",
      ["boolean", ["feature-state", "selected"], false], "#ffffff",
      ["==", ["get", "contested"], 1], "#d6a45a",
      "#3d4654",
    ],
    "line-width": [
      "case",
      ["boolean", ["feature-state", "selected"], false], 2.0,
      0.6,
    ],
    "line-opacity": 0.8,
  },
};

export const oblastLabelLayer: LayerSpecification = {
  id: LAYER_OBLAST_LABEL,
  type: "symbol",
  source: SOURCE_OBLASTS,
  layout: {
    "text-field": ["get", "name"],
    "text-font": ["Open Sans Semibold"],
    "text-size": 10,
    "text-letter-spacing": 0.06,
    "text-allow-overlap": false,
  },
  paint: {
    "text-color": "#aab4c2",
    "text-halo-color": "#070a0e",
    "text-halo-width": 1.0,
  },
  minzoom: 6.5,
};
