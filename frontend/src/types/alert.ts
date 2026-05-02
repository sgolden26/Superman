import type { GeoPoint, Iso8601, Uuid } from './common';
import type { ThreatLevel } from './classification';

export type AlertKind =
  | 'proximity'
  | 'classification_change'
  | 'sensor_failure'
  | 'lost_track';

export interface Alert {
  id: Uuid;
  kind: AlertKind;
  threat_level: ThreatLevel;
  subject_id: Uuid | null;
  track_id: Uuid | null;
  sensor_id: Uuid | null;
  location: GeoPoint | null;
  summary: string;
  created_at: Iso8601;
  acknowledged_at: Iso8601 | null;
}
