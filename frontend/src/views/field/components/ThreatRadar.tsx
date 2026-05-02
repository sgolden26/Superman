import type { Track } from '@/types/track';
import type { GeoPoint } from '@/types/common';

export interface ThreatRadarProps {
  origin: GeoPoint;
  tracks: Track[];
  rangeMetres?: number;
}

/**
 * Polar plot centred on the user. Threats positioned by bearing and distance.
 * Classification colour-coded; rings show range.
 */
export default function ThreatRadar(_props: ThreatRadarProps) {
  return <div data-component="ThreatRadar" />;
}
