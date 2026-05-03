import type { StyleSpecification } from 'maplibre-gl';

/**
 * Darkened satellite basemap for console use. Raster is Esri World Imagery;
 * paint pulls highlights down and kills neon vegetation so symbology reads.
 *
 * Layer and source ids use the `sm-` prefix per repo convention.
 */
export const DARK_SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  name: 'sm-dark-satellite',
  sources: {
    'sm-esri-world-imagery': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution:
        '<a href="https://www.esri.com/">Esri</a> · Maxar, Earthstar, others',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'sm-satellite-raster',
      type: 'raster',
      source: 'sm-esri-world-imagery',
      minzoom: 0,
      maxzoom: 22,
      paint: {
        'raster-fade-duration': 0,
        'raster-opacity': 0.94,
        'raster-brightness-min': 0.03,
        'raster-brightness-max': 0.48,
        'raster-contrast': 0.12,
        'raster-saturation': -0.5,
      },
    },
  ],
};
