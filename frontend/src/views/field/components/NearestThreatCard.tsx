import type { Track } from '@/types/track';
import type { Subject } from '@/types/subject';

export interface NearestThreatCardProps {
  track: Track | null;
  subject: Subject | null;
  distanceMetres: number | null;
  bearingDegrees: number | null;
}

/** Single big card with classification, distance, bearing and confidence. */
export default function NearestThreatCard(_props: NearestThreatCardProps) {
  return <div data-component="NearestThreatCard" />;
}
