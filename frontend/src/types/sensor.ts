import type { GeoPoint, Iso8601, Uuid } from './common';

export type SensorType = 'ghost_murmur' | 'satellite' | 'drone';
export type SensorStatus = 'online' | 'degraded' | 'offline';

export interface Sensor {
  id: Uuid;
  name: string;
  type: SensorType;
  status: SensorStatus;
  location: GeoPoint;
  range_metres: number;
  last_heartbeat_at: Iso8601 | null;
}
