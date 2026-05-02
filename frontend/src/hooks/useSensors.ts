import type { Sensor } from '@/types/sensor';
import type { PollingState } from './usePolling';

export function useSensors(): PollingState<Sensor[]> {
  throw new Error('Not implemented');
}
