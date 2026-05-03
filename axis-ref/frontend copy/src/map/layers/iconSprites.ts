import type { Map as MlMap } from "maplibre-gl";

/**
 * Single-channel SDF sprites for non-unit map markers. Each icon is drawn in
 * white onto a 32×32 transparent canvas; MapLibre treats the alpha channel as
 * the distance field at draw time so the shape can be tinted via icon-color
 * and given a halo/glow without re-rasterising.
 *
 * Visual language: monochrome, geometric, mil-spec. Stroke and inner detail
 * are matched across icons so they read as a coherent set when sat on a faction
 * faceplate.
 */

const ICON_PX = 32;

const ASSET_ICON_PREFIX = "axis-asset-";
const CITY_ICON_ID = "axis-city-icon";

export type AssetIconKind =
  | "depot"
  | "airfield"
  | "naval_base"
  | "border_crossing";

export const ASSET_ICON_IDS: Record<AssetIconKind, string> = {
  depot: `${ASSET_ICON_PREFIX}depot`,
  airfield: `${ASSET_ICON_PREFIX}airfield`,
  naval_base: `${ASSET_ICON_PREFIX}naval_base`,
  border_crossing: `${ASSET_ICON_PREFIX}border_crossing`,
};

export const CITY_ICON = CITY_ICON_ID;

type Drawer = (ctx: CanvasRenderingContext2D) => void;

const DRAWERS: Record<string, Drawer> = {
  [ASSET_ICON_IDS.depot]: drawDepot,
  [ASSET_ICON_IDS.airfield]: drawAirfield,
  [ASSET_ICON_IDS.naval_base]: drawNavalBase,
  [ASSET_ICON_IDS.border_crossing]: drawBorderCrossing,
  [CITY_ICON_ID]: drawCity,
};

export function registerMarkerIcons(map: MlMap): void {
  for (const [id, draw] of Object.entries(DRAWERS)) {
    if (map.hasImage(id)) continue;
    const img = renderToImageData(draw);
    if (!img) continue;
    map.addImage(id, img, { sdf: true });
  }
}

function renderToImageData(draw: Drawer): ImageData | null {
  const canvas = document.createElement("canvas");
  canvas.width = ICON_PX;
  canvas.height = ICON_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, ICON_PX, ICON_PX);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  draw(ctx);
  return ctx.getImageData(0, 0, ICON_PX, ICON_PX);
}

/* Skyline: three chunky ascending blocks plus an antenna spire so the icon
 * stays legible at small sizes. Designed to fill ~70% of the 32px canvas. */
function drawCity(ctx: CanvasRenderingContext2D): void {
  ctx.fillRect(3, 18, 8, 11);
  ctx.fillRect(12, 8, 9, 21);
  ctx.fillRect(22, 13, 7, 16);
  ctx.fillRect(15, 3, 3, 6);
}

/* Crate: outlined square with a diagonal X — supplies cached. */
function drawDepot(ctx: CanvasRenderingContext2D): void {
  ctx.lineWidth = 2;
  ctx.strokeRect(7, 8, 18, 16);
  ctx.beginPath();
  ctx.moveTo(7, 8);
  ctx.lineTo(25, 24);
  ctx.moveTo(25, 8);
  ctx.lineTo(7, 24);
  ctx.stroke();
}

/* Plane silhouette: fuselage + swept wings + tail. */
function drawAirfield(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(16, 5);
  ctx.lineTo(18.2, 9);
  ctx.lineTo(18.2, 14.5);
  ctx.lineTo(28, 19);
  ctx.lineTo(28, 21);
  ctx.lineTo(18.2, 18.5);
  ctx.lineTo(18.2, 24);
  ctx.lineTo(20.5, 27);
  ctx.lineTo(20.5, 28);
  ctx.lineTo(11.5, 28);
  ctx.lineTo(11.5, 27);
  ctx.lineTo(13.8, 24);
  ctx.lineTo(13.8, 18.5);
  ctx.lineTo(4, 21);
  ctx.lineTo(4, 19);
  ctx.lineTo(13.8, 14.5);
  ctx.lineTo(13.8, 9);
  ctx.closePath();
  ctx.fill();
}

/* Anchor: ring at the top, vertical shaft, crossbar, two flukes. */
function drawNavalBase(ctx: CanvasRenderingContext2D): void {
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(16, 8, 3, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(16, 11);
  ctx.lineTo(16, 25);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(10, 14);
  ctx.lineTo(22, 14);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(7, 19);
  ctx.quadraticCurveTo(7, 25, 16, 26);
  ctx.moveTo(25, 19);
  ctx.quadraticCurveTo(25, 25, 16, 26);
  ctx.stroke();
}

/* Barrier gate: two posts joined by a horizontal beam with notches. */
function drawBorderCrossing(ctx: CanvasRenderingContext2D): void {
  ctx.fillRect(6, 9, 3, 16);
  ctx.fillRect(23, 9, 3, 16);
  ctx.fillRect(6, 9, 20, 3);
  ctx.fillRect(11, 14, 2, 3);
  ctx.fillRect(15, 14, 2, 3);
  ctx.fillRect(19, 14, 2, 3);
}
