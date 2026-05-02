import type { GeoPoint } from '@/types/common';

/** Great-circle distance in metres. */
export function haversineMetres(_a: GeoPoint, _b: GeoPoint): number {
  throw new Error('Not implemented');
}

/** Compass bearing from `from` to `to`, in degrees [0, 360). */
export function bearingDegrees(_from: GeoPoint, _to: GeoPoint): number {
  throw new Error('Not implemented');
}

/** Bounding box of a set of points: `[minLon, minLat, maxLon, maxLat]`. */
export function bbox(_points: GeoPoint[]): [number, number, number, number] {
  throw new Error('Not implemented');
}
