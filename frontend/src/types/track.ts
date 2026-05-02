import type { GeoPoint, Iso8601, Uuid } from './common';

export interface Track {
  id: Uuid;
  subject_id: Uuid | null;
  started_at: Iso8601;
  last_seen_at: Iso8601;
  last_location: GeoPoint;
  detection_count: number;
  is_active: boolean;
}
