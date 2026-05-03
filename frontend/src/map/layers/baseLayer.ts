import type { LayerSpecification } from "maplibre-gl";
import type { Country } from "@/types/country";
import type { Faction } from "@/types/scenario";

export const SOURCE_COUNTRY_BASES = "axis-country-bases";
export const LAYER_COUNTRY_BASE_DOT = "axis-country-base-dot";
export const LAYER_COUNTRY_BASE_LABEL = "axis-country-base-label";

export interface BaseProps {
  id: string;
  name: string;
  kind: string;
  country_id: string;
  color: string;
}

export function baseFeatureCollection(
  countries: Country[],
  factionsById: Map<string, Faction>,
): GeoJSON.FeatureCollection<GeoJSON.Point, BaseProps> {
  const features: GeoJSON.Feature<GeoJSON.Point, BaseProps>[] = [];
  for (const c of countries) {
    const color = factionsById.get(c.faction_id)?.color ?? "#aab4c2";
    for (const b of c.geography.key_bases) {
      features.push({
        type: "Feature",
        properties: {
          id: `base.${c.id}.${b.name}`,
          name: b.name,
          kind: b.kind,
          country_id: c.id,
          color,
        },
        geometry: { type: "Point", coordinates: [b.lon, b.lat] },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

export const baseDotLayer: LayerSpecification = {
  id: LAYER_COUNTRY_BASE_DOT,
  type: "circle",
  source: SOURCE_COUNTRY_BASES,
  paint: {
    "circle-radius": 4,
    "circle-color": ["get", "color"],
    "circle-stroke-color": "#070a0e",
    "circle-stroke-width": 1.2,
    "circle-opacity": 0.95,
  },
};

export const baseLabelLayer: LayerSpecification = {
  id: LAYER_COUNTRY_BASE_LABEL,
  type: "symbol",
  source: SOURCE_COUNTRY_BASES,
  layout: {
    "text-field": ["get", "name"],
    "text-font": ["Open Sans Semibold"],
    "text-size": 9,
    "text-offset": [0, 0.9],
    "text-anchor": "top",
    "text-letter-spacing": 0.05,
  },
  paint: {
    "text-color": "#aab4c2",
    "text-halo-color": "#070a0e",
    "text-halo-width": 1.0,
  },
};
