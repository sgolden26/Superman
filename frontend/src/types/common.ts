/** Mirror of `app.schemas.common`. Keep in sync. */
export interface GeoPoint {
  lat: number;
  lon: number;
  elevation_m?: number | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

export type Uuid = string;
export type Iso8601 = string;
