import type { TheatreSnapshot } from '@/types/snapshot';

/** GeoJSON for MapLibre `geojson` sources. Kept loose so we do not depend on `@types/geojson`. */
export function buildUnitsGeoJson(snapshot: TheatreSnapshot): {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: {
      id: string;
      name: string;
      faction_id: string;
      color: string;
      callsign: string;
    };
  }>;
} {
  const colors = Object.fromEntries(snapshot.factions.map((f) => [f.id, f.color]));

  return {
    type: 'FeatureCollection',
    features: snapshot.units.map((u) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: u.position },
      properties: {
        id: u.id,
        name: u.name,
        faction_id: u.faction_id,
        color: colors[u.faction_id] ?? '#94a3b8',
        callsign: u.callsign ?? '',
      },
    })),
  };
}
