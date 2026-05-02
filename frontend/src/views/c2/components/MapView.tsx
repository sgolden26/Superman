import type { Track } from '@/types/track';
import type { Sensor } from '@/types/sensor';
import type { Alert } from '@/types/alert';
import type { Mission } from '@/types/mission';
import type { Uuid } from '@/types/common';

export interface MapViewProps {
  tracks: Track[];
  sensors: Sensor[];
  alerts: Alert[];
  mission?: Mission | null;
  onSelectSubject?: (id: Uuid) => void;
}

/** MapLibre canvas with sensor coverage circles, track polylines, alert pins. */
export default function MapView(_props: MapViewProps) {
  return <div className="h-full w-full" data-component="MapView" />;
}
