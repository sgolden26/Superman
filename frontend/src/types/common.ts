/** Mirror of `app.schemas.common`. Keep in sync. */

export type Uuid = string;
export type Iso8601 = string;

export interface GeoPointDTO {
  lat: number;
  lon: number;
  elevation_m?: number | null;
}

/** Wire-compatible `app.domain.models.geo.GeoPoint`. */
export class GeoPoint {
  constructor(
    public readonly lat: number,
    public readonly lon: number,
    public readonly elevationM: number | null = null,
  ) {}

  static fromJson(raw: GeoPointDTO): GeoPoint {
    return new GeoPoint(raw.lat, raw.lon, raw.elevation_m ?? null);
  }
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}
