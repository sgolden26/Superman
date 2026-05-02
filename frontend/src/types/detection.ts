import type { GeoPoint, Iso8601, Uuid } from './common';
import type { SensorType } from './sensor';

export interface Detection {
  id: Uuid;
  sensor_id: Uuid;
  sensor_type: SensorType;
  location: GeoPoint;
  observed_at: Iso8601;
  confidence: number;
  signature_id: Uuid | null;
  metadata: Record<string, unknown>;
}
