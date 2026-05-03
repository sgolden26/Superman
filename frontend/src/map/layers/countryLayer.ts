import type { LayerSpecification } from "maplibre-gl";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Faction } from "@/types/scenario";
import type { Country } from "@/types/country";
import { metricNormalised } from "@/types/country";
import type { Admin0Props } from "@/api/loadBorders";
import type { ChoroplethResolver } from "./territoryLayer";

export const SOURCE_COUNTRIES = "axis-countries";
export const SOURCE_COUNTRY_CONTEXT = "axis-countries-context";
export const LAYER_COUNTRY_FILL = "axis-country-fill";
export const LAYER_COUNTRY_LINE = "axis-country-line";
export const LAYER_COUNTRY_CONTEXT_FILL = "axis-country-context-fill";
export const LAYER_COUNTRY_CONTEXT_LINE = "axis-country-context-line";

export interface CountryFillProps {
  id: string;
  name: string;
  iso_a3: string;
  iso_a2: string;
  faction_id: string;
  color: string;
  cm_value: number;
  cm_has: number;
}

const ISO_TO_COUNTRY_ID: Record<string, string> = {
  RUS: "ru",
  UKR: "ua",
  BLR: "by",
  POL: "pl",
  MDA: "md",
  ROU: "ro",
  GEO: "ge",
};

export function countryFeatureCollection(
  countries: Country[],
  factionsById: Map<string, Faction>,
  admin0: FeatureCollection<Geometry, Admin0Props>,
  choro?: ChoroplethResolver,
): FeatureCollection<Geometry, CountryFillProps> {
  const countryById = new Map(countries.map((c) => [c.id, c]));
  const features: Feature<Geometry, CountryFillProps>[] = [];

  for (const f of admin0.features) {
    const countryId = ISO_TO_COUNTRY_ID[f.properties.iso_a3];
    const country = countryId ? countryById.get(countryId) : undefined;
    const factionId = country?.faction_id ?? "neutral";
    const color = factionsById.get(factionId)?.color ?? "#3d4654";

    let cm_value = 0;
    let cm_has = 0;
    if (choro?.enabled && country) {
      cm_value = metricNormalised(country, choro.metric);
      cm_has = 1;
    }

    features.push({
      type: "Feature",
      properties: {
        id: countryId ?? `iso.${f.properties.iso_a3}`,
        name: f.properties.name,
        iso_a3: f.properties.iso_a3,
        iso_a2: f.properties.iso_a2,
        faction_id: factionId,
        color,
        cm_value,
        cm_has,
      },
      geometry: f.geometry,
    });
  }

  return { type: "FeatureCollection", features };
}

export function contextCountryCollection(
  admin0Context: FeatureCollection<Geometry, Admin0Props>,
): FeatureCollection<Geometry, { id: string; name: string }> {
  const features: Feature<Geometry, { id: string; name: string }>[] =
    admin0Context.features.map((f) => ({
      type: "Feature",
      properties: { id: `ctx.${f.properties.iso_a3}`, name: f.properties.name },
      geometry: f.geometry,
    }));
  return { type: "FeatureCollection", features };
}

export const countryFillLayer: LayerSpecification = {
  id: LAYER_COUNTRY_FILL,
  type: "fill",
  source: SOURCE_COUNTRIES,
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
      ["get", "color"],
    ],
    "fill-opacity": [
      "case",
      ["boolean", ["feature-state", "demoted"], false], 0.06,
      ["==", ["get", "cm_has"], 1], 0.30,
      0.14,
    ],
  },
};

export const countryLineLayer: LayerSpecification = {
  id: LAYER_COUNTRY_LINE,
  type: "line",
  source: SOURCE_COUNTRIES,
  paint: {
    "line-color": "#5b6678",
    "line-width": 0.9,
    "line-opacity": 0.85,
  },
};

export const contextFillLayer: LayerSpecification = {
  id: LAYER_COUNTRY_CONTEXT_FILL,
  type: "fill",
  source: SOURCE_COUNTRY_CONTEXT,
  paint: {
    "fill-color": "#1f2530",
    "fill-opacity": 0.42,
  },
};

export const contextLineLayer: LayerSpecification = {
  id: LAYER_COUNTRY_CONTEXT_LINE,
  type: "line",
  source: SOURCE_COUNTRY_CONTEXT,
  paint: {
    "line-color": "#3d4654",
    "line-width": 0.5,
    "line-opacity": 0.7,
  },
};
