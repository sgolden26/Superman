import type { Sensor } from '@/types/sensor';

export interface SensorStatusPanelProps {
  sensors: Sensor[];
}

/** Compact list of all sensors with status dots and last-heartbeat times. */
export default function SensorStatusPanel(_props: SensorStatusPanelProps) {
  return <div data-component="SensorStatusPanel" />;
}
