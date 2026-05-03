import type { LayerSpecification, Map as MlMap } from "maplibre-gl";
import type { ScenarioSnapshot, Selection } from "@/types/scenario";

export const SOURCE_SELECTION = "axis-selection";
export const LAYER_SELECTION_RETICLE = "axis-selection-reticle";

const ICON_ID = "axis-selection-reticle-icon";
const ICON_PX = 96;

/** Per-kind size_factor multiplier into the zoom-driven icon-size ramp.
 *  Tuned so the reticle clearly encloses each marker without dwarfing it. */
const SIZE_FACTOR: Record<string, number> = {
  unit: 1.0,
  city: 0.85,
  depot: 0.78,
  airfield: 0.78,
  naval_base: 0.78,
  border_crossing: 0.78,
};

const POINT_KINDS = new Set([
  "unit",
  "city",
  "depot",
  "airfield",
  "naval_base",
  "border_crossing",
]);

export interface SelectionReticleProps {
  id: string;
  kind: string;
  size_factor: number;
  color: string;
}

const EMPTY_FC: GeoJSON.FeatureCollection<GeoJSON.Point, SelectionReticleProps> = {
  type: "FeatureCollection",
  features: [],
};

/**
 * Draws four L-shaped corner brackets onto an offscreen canvas as a single
 * white SDF sprite. Tinting at draw time (icon-color from feature properties)
 * lets the reticle take on the player's team colour without re-rasterising.
 * The interior is intentionally empty so the brackets frame whatever marker
 * sits beneath them without obscuring it.
 */
export function registerSelectionIcon(map: MlMap): void {
  if (map.hasImage(ICON_ID)) return;
  const canvas = document.createElement("canvas");
  canvas.width = ICON_PX;
  canvas.height = ICON_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, ICON_PX, ICON_PX);

  const inset = 6;
  const arm = 22;
  const stroke = 2.6;

  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = stroke;

  const segments: Array<[number, number, number, number]> = [
    [inset, inset, inset + arm, inset],
    [inset, inset, inset, inset + arm],

    [ICON_PX - inset - arm, inset, ICON_PX - inset, inset],
    [ICON_PX - inset, inset, ICON_PX - inset, inset + arm],

    [ICON_PX - inset - arm, ICON_PX - inset, ICON_PX - inset, ICON_PX - inset],
    [ICON_PX - inset, ICON_PX - inset - arm, ICON_PX - inset, ICON_PX - inset],

    [inset, ICON_PX - inset, inset + arm, ICON_PX - inset],
    [inset, ICON_PX - inset - arm, inset, ICON_PX - inset],
  ];

  ctx.beginPath();
  for (const [x1, y1, x2, y2] of segments) {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();

  map.addImage(ICON_ID, ctx.getImageData(0, 0, ICON_PX, ICON_PX), {
    sdf: true,
  });
}

export function ensureSelectionSource(map: MlMap): void {
  if (map.getSource(SOURCE_SELECTION)) return;
  map.addSource(SOURCE_SELECTION, {
    type: "geojson",
    data: EMPTY_FC,
  });
}

export function selectionFeatureCollection(
  scenario: ScenarioSnapshot,
  selection: Selection,
  teamColor: string,
  unitPositionOverrides: Record<string, [number, number]> = {},
): GeoJSON.FeatureCollection<GeoJSON.Point, SelectionReticleProps> {
  if (!selection || !POINT_KINDS.has(selection.kind)) return EMPTY_FC;

  const pos = positionForSelection(scenario, selection, unitPositionOverrides);
  if (!pos) return EMPTY_FC;

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          id: selection.id,
          kind: selection.kind,
          size_factor: SIZE_FACTOR[selection.kind] ?? 0.85,
          color: teamColor,
        },
        geometry: { type: "Point", coordinates: pos },
      },
    ],
  };
}

function positionForSelection(
  scenario: ScenarioSnapshot,
  selection: NonNullable<Selection>,
  overrides: Record<string, [number, number]>,
): [number, number] | null {
  switch (selection.kind) {
    case "unit": {
      const u = scenario.units.find((x) => x.id === selection.id);
      return u ? overrides[u.id] ?? u.position : null;
    }
    case "city": {
      const c = scenario.cities.find((x) => x.id === selection.id);
      return c ? c.position : null;
    }
    case "depot": {
      const d = scenario.depots.find((x) => x.id === selection.id);
      return d ? d.position : null;
    }
    case "airfield": {
      const a = scenario.airfields.find((x) => x.id === selection.id);
      return a ? a.position : null;
    }
    case "naval_base": {
      const n = scenario.naval_bases.find((x) => x.id === selection.id);
      return n ? n.position : null;
    }
    case "border_crossing": {
      const b = scenario.border_crossings.find((x) => x.id === selection.id);
      return b ? b.position : null;
    }
    default:
      return null;
  }
}

/**
 * Symbol layer that paints the corner-bracket sprite at whatever point feature
 * is currently in `axis-selection`. Empty source = nothing drawn.
 *
 * The SDF sprite is tinted via `icon-color` from the feature property `color`,
 * which the source population sets to the active team's faction colour. A
 * matching translucent halo gives a subtle outer glow without re-rasterising.
 */
export const selectionReticleLayer: LayerSpecification = {
  id: LAYER_SELECTION_RETICLE,
  type: "symbol",
  source: SOURCE_SELECTION,
  layout: {
    "icon-image": ICON_ID,
    "icon-size": [
      "interpolate",
      ["linear"],
      ["zoom"],
      3,
      ["*", ["get", "size_factor"], 0.36],
      6,
      ["*", ["get", "size_factor"], 0.5],
      8,
      ["*", ["get", "size_factor"], 0.62],
    ],
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
    "icon-rotation-alignment": "viewport",
    "icon-pitch-alignment": "viewport",
  },
  paint: {
    "icon-color": ["get", "color"],
    "icon-halo-color": ["get", "color"],
    "icon-halo-width": 1.0,
    "icon-halo-blur": 1.5,
    "icon-opacity": 1,
    "icon-opacity-transition": { duration: 140, delay: 0 },
  },
};
