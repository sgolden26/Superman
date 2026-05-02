import type { SensorStatus } from '@/types/sensor';

export interface SensorStatusDotProps {
  status: SensorStatus;
}

export default function SensorStatusDot(_props: SensorStatusDotProps) {
  return <span aria-label="sensor status" />;
}
