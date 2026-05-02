import type { GeoPoint, Iso8601, Uuid } from './common';

export type MissionStatus = 'planned' | 'active' | 'completed' | 'aborted';

export interface AreaOfOperations {
  name: string;
  polygon: GeoPoint[];
}

export interface Mission {
  id: Uuid;
  name: string;
  status: MissionStatus;
  area: AreaOfOperations;
  started_at: Iso8601;
  ended_at: Iso8601 | null;
  sensor_ids: Uuid[];
  operator_ids: Uuid[];
}
