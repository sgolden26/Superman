import { useEffect, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildUnitsGeoJson } from '@/map/buildUnitsGeoJson';
import type { TheatreSnapshot } from '@/types/snapshot';

export interface TheatreMapProps {
  snapshot: TheatreSnapshot | null;
  /** Shown over the basemap until a snapshot is ready. */
  placeholder: string;
}

import { DARK_SATELLITE_STYLE } from '@/map/darkSatelliteStyle';

/**
 * Theatre overview: operational units as points, coloured by faction. Layer ids
 * are prefixed `sm-` per repo convention.
 */
export default function TheatreMap({ snapshot, placeholder }: TheatreMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const didFitRef = useRef(false);
  const lastScenarioIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_SATELLITE_STYLE,
      center: [35, 50],
      zoom: 4,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');
    mapRef.current = map;

    const onLoad = () => setMapReady(true);
    map.on('load', onLoad);

    return () => {
      map.off('load', onLoad);
      map.remove();
      mapRef.current = null;
      setMapReady(false);
      didFitRef.current = false;
      lastScenarioIdRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !snapshot) return;

    if (lastScenarioIdRef.current !== snapshot.scenario.id) {
      lastScenarioIdRef.current = snapshot.scenario.id;
      didFitRef.current = false;
    }

    const data = buildUnitsGeoJson(snapshot);
    const source = map.getSource('sm-units') as GeoJSONSource | undefined;

    if (!source) {
      map.addSource('sm-units', { type: 'geojson', data });
      map.addLayer({
        id: 'sm-units-circles',
        type: 'circle',
        source: 'sm-units',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3.5, 10, 9],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#f4f4f5',
          'circle-opacity': 0.98,
        },
      });
    } else {
      source.setData(data);
    }

    if (!didFitRef.current) {
      const [west, south, east, north] = snapshot.scenario.bbox;
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 56, duration: 0, maxZoom: 8 },
      );
      didFitRef.current = true;
    }
  }, [mapReady, snapshot]);

  return (
    <div
      className="relative h-full min-h-[320px] w-full bg-mil-900"
      role="application"
      aria-label="Theatre map"
    >
      <div ref={containerRef} className="absolute inset-0" />
      {!snapshot ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-mil-900/88 px-4 text-center text-sm text-mil-100">
          {placeholder}
        </div>
      ) : null}
    </div>
  );
}
