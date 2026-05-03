import type { LayerSpecification } from "maplibre-gl";
import type { Feature } from "geojson";
import type {
  Airfield,
  BorderCrossing,
  Depot,
  Faction,
  NavalBase,
} from "@/types/scenario";
import { ASSET_ICON_IDS } from "./iconSprites";

export const SOURCE_ASSETS = "axis-assets";
export const LAYER_ASSET_DOT = "axis-asset-dot";
export const LAYER_ASSET_LABEL = "axis-asset-label";
export const LAYER_ASSET_PLATE = "axis-asset-plate";
export const SOURCE_DOCK_BADGE = "axis-dock-badge";
export const LAYER_DOCK_BADGE_PLATE = "axis-dock-badge-plate";
export const LAYER_DOCK_BADGE_TEXT = "axis-dock-badge-text";

export type AssetKind = "depot" | "airfield" | "naval_base" | "border_crossing";

export interface AssetProps {
  id: string;
  name: string;
  kind: AssetKind;
  faction_id: string;
  color: string;
  icon: string;
  kind_rank: number;
}

const KIND_RANK: Record<AssetKind, number> = {
  airfield: 3,
  naval_base: 2,
  depot: 1,
  border_crossing: 0,
};

export function assetFeatureCollection(
  depots: Depot[],
  airfields: Airfield[],
  naval: NavalBase[],
  crossings: BorderCrossing[],
  factionsById: Map<string, Faction>,
): GeoJSON.FeatureCollection<GeoJSON.Point, AssetProps> {
  const features: Feature<GeoJSON.Point, AssetProps>[] = [];
  const push = (
    id: string,
    name: string,
    kind: AssetKind,
    factionId: string,
    pos: [number, number],
  ) => {
    const color = factionsById.get(factionId)?.color ?? "#aab4c2";
    features.push({
      type: "Feature",
      properties: {
        id,
        name,
        kind,
        faction_id: factionId,
        color,
        icon: ASSET_ICON_IDS[kind],
        kind_rank: KIND_RANK[kind],
      },
      geometry: { type: "Point", coordinates: pos },
    });
  };
  for (const d of depots) push(d.id, d.name, "depot", d.faction_id, d.position);
  for (const a of airfields) push(a.id, a.name, "airfield", a.faction_id, a.position);
  for (const n of naval) push(n.id, n.name, "naval_base", n.faction_id, n.position);
  for (const c of crossings)
    push(c.id, c.name, "border_crossing", c.faction_id, c.position);
  return { type: "FeatureCollection", features };
}

/** Dark plate that gives the SDF icon a consistent legibility floor against
 *  the satellite basemap, with a faction-coloured rim that brightens on hover. */
export const assetPlateLayer: LayerSpecification = {
  id: LAYER_ASSET_PLATE,
  type: "circle",
  source: SOURCE_ASSETS,
  paint: {
    "circle-color": "rgba(11,15,20,0.85)",
    "circle-stroke-color": ["get", "color"],
    "circle-stroke-width": [
      "case",
      ["boolean", ["feature-state", "hover"], false], 1.8,
      1.2,
    ],
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      3, 7,
      6, 10,
      8, 13,
    ],
    "circle-opacity": 0.95,
  },
};

/**
 * SDF icon symbol layer (plane / anchor / crate / gate). Tinted via the
 * feature's faction `color`; lives at the original `LAYER_ASSET_DOT` id so the
 * existing click-target ordering in `MapView` continues to work.
 */
export const assetDotLayer: LayerSpecification = {
  id: LAYER_ASSET_DOT,
  type: "symbol",
  source: SOURCE_ASSETS,
  layout: {
    "icon-image": ["get", "icon"],
    "icon-size": [
      "interpolate",
      ["linear"],
      ["zoom"],
      3, 0.42,
      6, 0.58,
      8, 0.74,
    ],
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
  },
  paint: {
    "icon-color": ["get", "color"],
    "icon-halo-color": "#070a0e",
    "icon-halo-width": 0.6,
    "icon-opacity": 0.98,
  },
};

interface DockBadgeProps {
  asset_id: string;
  count: number;
  color: string;
  label: string;
}

/** Build the dock-badge source: one feature per asset that has docked units.
 *  Position is the asset's location; the layers offset the badge so it sits
 *  off the asset icon's lower-right corner. The faction colour drives the
 *  plate stroke; the count lives in `label` ready for the text layer. */
export function dockBadgeFeatureCollection(
  depots: Depot[],
  airfields: Airfield[],
  naval: NavalBase[],
  factionsById: Map<string, Faction>,
  assetToUnits: Map<string, string[]>,
): GeoJSON.FeatureCollection<GeoJSON.Point, DockBadgeProps> {
  const features: Feature<GeoJSON.Point, DockBadgeProps>[] = [];
  const push = (
    id: string,
    factionId: string,
    pos: [number, number],
  ) => {
    const list = assetToUnits.get(id);
    if (!list || list.length === 0) return;
    const color = factionsById.get(factionId)?.color ?? "#aab4c2";
    features.push({
      type: "Feature",
      properties: {
        asset_id: id,
        count: list.length,
        color,
        label: String(list.length),
      },
      geometry: { type: "Point", coordinates: pos },
    });
  };
  for (const a of airfields) push(a.id, a.faction_id, a.position);
  for (const n of naval) push(n.id, n.faction_id, n.position);
  for (const d of depots) push(d.id, d.faction_id, d.position);
  return { type: "FeatureCollection", features };
}

/** Faction-tinted plate hugging the asset icon's lower-right corner. */
export const dockBadgePlateLayer: LayerSpecification = {
  id: LAYER_DOCK_BADGE_PLATE,
  type: "circle",
  source: SOURCE_DOCK_BADGE,
  paint: {
    "circle-color": "#0b0f14",
    "circle-stroke-color": ["get", "color"],
    "circle-stroke-width": 1.4,
    "circle-radius": [
      "interpolate", ["linear"], ["zoom"],
      3, 5, 6, 7, 8, 8.5,
    ],
    "circle-opacity": 0.95,
    "circle-translate": [10, -10],
  },
};

/** Mono-style count atop the dock plate. */
export const dockBadgeTextLayer: LayerSpecification = {
  id: LAYER_DOCK_BADGE_TEXT,
  type: "symbol",
  source: SOURCE_DOCK_BADGE,
  layout: {
    "text-field": ["get", "label"],
    "text-font": ["Open Sans Semibold"],
    "text-size": [
      "interpolate", ["linear"], ["zoom"],
      3, 9, 6, 10, 8, 11,
    ],
    "text-allow-overlap": true,
    "text-ignore-placement": true,
    "text-offset": [0.7, -0.7],
  },
  paint: {
    "text-color": ["get", "color"],
    "text-halo-color": "#070a0e",
    "text-halo-width": 1.0,
  },
};

export const assetLabelLayer: LayerSpecification = {
  id: LAYER_ASSET_LABEL,
  type: "symbol",
  source: SOURCE_ASSETS,
  minzoom: 5.5,
  layout: {
    "text-field": ["get", "name"],
    "text-font": ["Open Sans Semibold"],
    "text-size": [
      "interpolate",
      ["linear"],
      ["zoom"],
      5.5, 9,
      7, 10,
      9, 11,
    ],
    "text-offset": [0, 1.4],
    "text-anchor": "top",
    "text-allow-overlap": false,
    "text-ignore-placement": false,
    "text-letter-spacing": 0.04,
  },
  paint: {
    "text-color": "#dde3ec",
    "text-halo-color": "#070a0e",
    "text-halo-width": 1.4,
  },
};
