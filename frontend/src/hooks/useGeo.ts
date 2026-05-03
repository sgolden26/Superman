import { GeoPoint } from '@/types/common';

export interface GeoState {
  position: GeoPoint | null;
  accuracy_m: number | null;
  error: GeolocationPositionError | null;
}

/** Wraps the browser Geolocation API, with permission and error handling. */
export function useGeo(): GeoState {
  throw new Error('Not implemented');
}
