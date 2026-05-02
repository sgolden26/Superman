import type { GeoPoint, Iso8601, Uuid } from './common';
import type { SensorType } from './sensor';

export interface ImageryFrame {
  id: Uuid;
  source: SensorType;
  sensor_id: Uuid;
  captured_at: Iso8601;
  centre: GeoPoint;
  footprint: GeoPoint[];
  resolution_m: number;
  storage_uri: string;
}
