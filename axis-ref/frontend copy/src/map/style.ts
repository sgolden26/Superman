import type { StyleSpecification } from "maplibre-gl";

/**
 * Esri World Imagery (satellite) + Esri reference overlay (boundaries and
 * place names). Both are public XYZ raster endpoints, no API key, attribution
 * required. Raster keeps the runtime footprint small and avoids a
 * glyphs/sprites dependency for v1.
 */
const ESRI_ATTRIBUTION =
  'Imagery &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community';

export const baseStyle: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    "esri-imagery": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: ESRI_ATTRIBUTION,
    },
    "esri-reference": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: ESRI_ATTRIBUTION,
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#070a0e" } },
    {
      id: "esri-imagery",
      type: "raster",
      source: "esri-imagery",
      // Slight darken + desaturate so the data overlays remain dominant.
      paint: {
        "raster-opacity": 0.4,
        "raster-saturation": -0.3,
        "raster-contrast": 0.05,
        "raster-brightness-max": 0.75,
      },
    },
    // World_Boundaries_and_Places is a single composite; we cannot drop only text
    // from it. Opacity 0 silences basemap place names and reference lines; country /
    // oblast / city labels come from Axis vector layers and layer toggles.
    {
      id: "esri-reference",
      type: "raster",
      source: "esri-reference",
      paint: { "raster-opacity": 0.8 },
    },
  ],
};

export const SOURCE_TERRITORIES = "axis-territories";
export const SOURCE_CITIES = "axis-cities";
export const SOURCE_UNITS = "axis-units";

export const LAYER_TERRITORY_FILL = "axis-territory-fill";
export const LAYER_TERRITORY_LINE = "axis-territory-line";
export const LAYER_CITY_HALO = "axis-city-halo";
export const LAYER_CITY_DOT = "axis-city-dot";
export const LAYER_CITY_LABEL = "axis-city-label";
export const LAYER_UNIT_HALO = "axis-unit-halo";
export const LAYER_UNIT_DOT = "axis-unit-dot";
