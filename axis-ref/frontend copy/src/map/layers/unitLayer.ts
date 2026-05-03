import type { LayerSpecification, Map as MlMap } from "maplibre-gl";
import type { Faction, Unit } from "@/types/scenario";
import {
  LAYER_UNIT_DOT,
  LAYER_UNIT_HALO,
  SOURCE_UNITS,
} from "../style";

export const LAYER_UNIT_GLYPH = "axis-unit-glyph";

export interface UnitProps {
  id: string;
  name: string;
  faction_id: string;
  domain: Unit["domain"];
  kind: Unit["kind"];
  color: string;
  callsign: string;
  strength: number;
  glyph: string;
  domain_rank: number;
}

const KIND_GLYPH: Record<Unit["kind"], string> = {
  infantry_brigade: "I",
  armoured_brigade: "A",
  air_wing: "F",
  naval_task_group: "S",
};

const DOMAIN_RANK: Record<Unit["domain"], number> = {
  ground: 1,
  air: 2,
  naval: 3,
};

const DOMAINS: Unit["domain"][] = ["ground", "air", "naval"];

const ICON_PX = 40;
const ICON_PAD = 5;
const ICON_STROKE = "#0b0f14";

function unitIconId(domain: Unit["domain"], factionId: string): string {
  return `axis-unit-${domain}-${factionId}`;
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  domain: Unit["domain"],
  size: number,
  pad: number,
) {
  ctx.beginPath();
  if (domain === "ground") {
    ctx.rect(pad, pad, size - 2 * pad, size - 2 * pad);
  } else if (domain === "air") {
    ctx.moveTo(size / 2, pad);
    ctx.lineTo(size - pad, size - pad);
    ctx.lineTo(pad, size - pad);
    ctx.closePath();
  } else {
    ctx.moveTo(size / 2, pad);
    ctx.lineTo(size - pad, size / 2);
    ctx.lineTo(size / 2, size - pad);
    ctx.lineTo(pad, size / 2);
    ctx.closePath();
  }
}

/**
 * Renders each (domain, faction) pair to an offscreen canvas and registers it
 * with the map as an icon sprite. Faction-tinted fills and a dark hairline
 * stroke are baked in; the layer just selects by id at draw time. Idempotent
 * via `hasImage`, so safe to call on every scenario reload.
 */
export function registerUnitIcons(map: MlMap, factions: Faction[]) {
  for (const faction of factions) {
    for (const domain of DOMAINS) {
      const id = unitIconId(domain, faction.id);
      if (map.hasImage(id)) continue;
      const canvas = document.createElement("canvas");
      canvas.width = ICON_PX;
      canvas.height = ICON_PX;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.clearRect(0, 0, ICON_PX, ICON_PX);
      ctx.fillStyle = faction.color ?? "#cccccc";
      ctx.strokeStyle = ICON_STROKE;
      ctx.lineWidth = 2;
      ctx.lineJoin = "miter";
      drawShape(ctx, domain, ICON_PX, ICON_PAD);
      ctx.fill();
      ctx.stroke();
      map.addImage(id, ctx.getImageData(0, 0, ICON_PX, ICON_PX));
    }
  }
}

export function unitFeatureCollection(
  units: Unit[],
  factionsById: Map<string, Faction>,
  positionOverrides?: Record<string, [number, number]>,
): GeoJSON.FeatureCollection<GeoJSON.Point, UnitProps> {
  const features = units.map<GeoJSON.Feature<GeoJSON.Point, UnitProps>>((u) => ({
    type: "Feature",
    properties: {
      id: u.id,
      name: u.name,
      faction_id: u.faction_id,
      domain: u.domain,
      kind: u.kind,
      color: factionsById.get(u.faction_id)?.color ?? "#cccccc",
      callsign: u.callsign,
      strength: u.strength,
      glyph: KIND_GLYPH[u.kind],
      domain_rank: DOMAIN_RANK[u.domain],
    },
    geometry: { type: "Point", coordinates: positionOverrides?.[u.id] ?? u.position },
  }));
  return { type: "FeatureCollection", features };
}

export const unitHaloLayer: LayerSpecification = {
  id: LAYER_UNIT_HALO,
  type: "circle",
  source: SOURCE_UNITS,
  paint: {
    "circle-color": ["get", "color"],
    "circle-opacity": [
      "case",
      ["boolean", ["feature-state", "hover"], false], 0.22,
      0.0,
    ],
    "circle-radius": 16,
    "circle-blur": 0.55,
  },
};

/**
 * Domain-coded shape (square = ground, triangle = air, diamond = naval),
 * pulled from the per-faction icon sprites registered by `registerUnitIcons`.
 * Selection bumps icon-size; hover/select glow comes from the halo circle.
 */
export const unitDotLayer: LayerSpecification = {
  id: LAYER_UNIT_DOT,
  type: "symbol",
  source: SOURCE_UNITS,
  layout: {
    "icon-image": [
      "concat",
      "axis-unit-",
      ["get", "domain"],
      "-",
      ["get", "faction_id"],
    ],
    "icon-size": [
      "interpolate",
      ["linear"],
      ["zoom"],
      3, 0.45,
      6, 0.65,
      8, 0.85,
    ],
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
  },
  paint: {
    "icon-opacity": 0.97,
  },
};

export const unitGlyphLayer: LayerSpecification = {
  id: LAYER_UNIT_GLYPH,
  type: "symbol",
  source: SOURCE_UNITS,
  layout: {
    "text-field": ["get", "glyph"],
    "text-font": ["Open Sans Semibold"],
    "text-size": [
      "interpolate",
      ["linear"],
      ["zoom"],
      3, 9,
      6, 11,
      8, 14,
    ],
    // Triangle's optical centre sits below its em-box centre; nudge the letter
    // down on air units so it reads as inside the shape rather than floating.
    "text-offset": [
      "match",
      ["get", "domain"],
      "air", ["literal", [0, 0.18]],
      ["literal", [0, 0]],
    ],
    "text-allow-overlap": true,
    "text-ignore-placement": true,
  },
  paint: {
    "text-color": "#ffffff",
    "text-halo-color": "#0b0f14",
    "text-halo-width": 1.0,
  },
};
