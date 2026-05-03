import type { LayerSpecification } from "maplibre-gl";
import type { Feature, Polygon } from "geojson";
import type {
  Aor,
  Faction,
  IsrCoverage,
  MissileRange,
} from "@/types/scenario";
import { ringSector } from "./geo";

export const SOURCE_ISR = "axis-isr";
export const SOURCE_MISSILE = "axis-missile";
export const SOURCE_AOR = "axis-aor";

export const LAYER_ISR_FILL = "axis-isr-fill";
export const LAYER_ISR_LINE = "axis-isr-line";
export const LAYER_MISSILE_FILL = "axis-missile-fill";
export const LAYER_MISSILE_LINE = "axis-missile-line";
export const LAYER_AOR_FILL = "axis-aor-fill";
export const LAYER_AOR_LINE = "axis-aor-line";

export interface IsrProps {
  id: string;
  name: string;
  faction_id: string;
  platform: string;
  range_km: number;
  confidence: number;
  color: string;
}

export interface MissileProps {
  id: string;
  name: string;
  faction_id: string;
  category: string;
  weapon: string;
  range_km: number;
  color: string;
}

export interface AorProps {
  id: string;
  name: string;
  faction_id: string;
  color: string;
}

export function isrFeatureCollection(
  items: IsrCoverage[],
  factionsById: Map<string, Faction>,
): GeoJSON.FeatureCollection<Polygon, IsrProps> {
  const features = items.map<Feature<Polygon, IsrProps>>((i) => {
    const ring = ringSector(i.origin, i.range_km, i.heading_deg, i.beam_deg);
    return {
      type: "Feature",
      properties: {
        id: i.id,
        name: i.name,
        faction_id: i.faction_id,
        platform: i.platform,
        range_km: i.range_km,
        confidence: i.confidence,
        color: factionsById.get(i.faction_id)?.color ?? "#5fc7c1",
      },
      geometry: { type: "Polygon", coordinates: [ring] },
    };
  });
  return { type: "FeatureCollection", features };
}

export function missileFeatureCollection(
  items: MissileRange[],
  factionsById: Map<string, Faction>,
): GeoJSON.FeatureCollection<Polygon, MissileProps> {
  const features = items.map<Feature<Polygon, MissileProps>>((m) => {
    const ring = ringSector(m.origin, m.range_km, m.heading_deg, m.beam_deg);
    return {
      type: "Feature",
      properties: {
        id: m.id,
        name: m.name,
        faction_id: m.faction_id,
        category: m.category,
        weapon: m.weapon,
        range_km: m.range_km,
        color: factionsById.get(m.faction_id)?.color ?? "#ff8b67",
      },
      geometry: { type: "Polygon", coordinates: [ring] },
    };
  });
  return { type: "FeatureCollection", features };
}

export function aorFeatureCollection(
  items: Aor[],
  factionsById: Map<string, Faction>,
): GeoJSON.FeatureCollection<Polygon, AorProps> {
  const features = items.map<Feature<Polygon, AorProps>>((a) => ({
    type: "Feature",
    properties: {
      id: a.id,
      name: a.name,
      faction_id: a.faction_id,
      color: factionsById.get(a.faction_id)?.color ?? "#7cc4ff",
    },
    geometry: { type: "Polygon", coordinates: a.polygon },
  }));
  return { type: "FeatureCollection", features };
}

export const isrFillLayer: LayerSpecification = {
  id: LAYER_ISR_FILL,
  type: "fill",
  source: SOURCE_ISR,
  paint: {
    "fill-color": ["get", "color"],
    "fill-opacity": [
      "interpolate",
      ["linear"],
      ["get", "confidence"],
      0, 0.05,
      1, 0.16,
    ],
  },
};

export const isrLineLayer: LayerSpecification = {
  id: LAYER_ISR_LINE,
  type: "line",
  source: SOURCE_ISR,
  paint: {
    "line-color": ["get", "color"],
    "line-width": 1.0,
    "line-dasharray": [3, 2],
    "line-opacity": 0.6,
  },
};

export const missileFillLayer: LayerSpecification = {
  id: LAYER_MISSILE_FILL,
  type: "fill",
  source: SOURCE_MISSILE,
  paint: {
    "fill-color": ["get", "color"],
    "fill-opacity": 0.06,
  },
};

export const missileLineLayer: LayerSpecification = {
  id: LAYER_MISSILE_LINE,
  type: "line",
  source: SOURCE_MISSILE,
  paint: {
    "line-color": ["get", "color"],
    "line-width": 1.2,
    "line-dasharray": [1, 2],
    "line-opacity": 0.7,
  },
};

export const aorFillLayer: LayerSpecification = {
  id: LAYER_AOR_FILL,
  type: "fill",
  source: SOURCE_AOR,
  paint: {
    "fill-color": ["get", "color"],
    "fill-opacity": 0.10,
  },
};

export const aorLineLayer: LayerSpecification = {
  id: LAYER_AOR_LINE,
  type: "line",
  source: SOURCE_AOR,
  paint: {
    "line-color": ["get", "color"],
    "line-width": 1.0,
    "line-opacity": 0.55,
  },
};
