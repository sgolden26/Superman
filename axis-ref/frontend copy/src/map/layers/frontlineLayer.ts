import type { LayerSpecification } from "maplibre-gl";
import type { Feature, LineString, Polygon } from "geojson";
import type { Frontline } from "@/types/scenario";
import { bufferLine } from "./geo";

export const SOURCE_FRONTLINE_BUFFER = "axis-frontline-buffer";
export const SOURCE_FRONTLINE_LINE = "axis-frontline-line";
export const LAYER_FRONTLINE_BUFFER = "axis-frontline-buffer";
export const LAYER_FRONTLINE_LINE = "axis-frontline-line";

export interface FrontlineProps {
  id: string;
  name: string;
  buffer_km: number;
}

export function frontlineLineCollection(
  items: Frontline[],
): GeoJSON.FeatureCollection<LineString, FrontlineProps> {
  const features = items.map<Feature<LineString, FrontlineProps>>((f) => ({
    type: "Feature",
    properties: { id: f.id, name: f.name, buffer_km: f.buffer_km },
    geometry: { type: "LineString", coordinates: f.path },
  }));
  return { type: "FeatureCollection", features };
}

export function frontlineBufferCollection(
  items: Frontline[],
): GeoJSON.FeatureCollection<Polygon, FrontlineProps> {
  const features: Feature<Polygon, FrontlineProps>[] = [];
  for (const f of items) {
    if (f.buffer_km <= 0) continue;
    const ring = bufferLine(f.path as [number, number][], f.buffer_km);
    if (ring.length < 4) continue;
    features.push({
      type: "Feature",
      properties: { id: `${f.id}.buffer`, name: f.name, buffer_km: f.buffer_km },
      geometry: { type: "Polygon", coordinates: [ring] },
    });
  }
  return { type: "FeatureCollection", features };
}

export const frontlineBufferLayer: LayerSpecification = {
  id: LAYER_FRONTLINE_BUFFER,
  type: "fill",
  source: SOURCE_FRONTLINE_BUFFER,
  paint: {
    "fill-color": "#d6a45a",
    "fill-opacity": 0.18,
  },
};

export const frontlineLineLayer: LayerSpecification = {
  id: LAYER_FRONTLINE_LINE,
  type: "line",
  source: SOURCE_FRONTLINE_LINE,
  paint: {
    "line-color": "#ff5a5a",
    "line-width": 2.4,
    "line-opacity": 0.9,
  },
};
