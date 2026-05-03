import { api } from '@/api/factory';
import { env } from '@/config/env';
import type { Sensor } from '@/types/sensor';
import { usePolling, type PollingState } from './usePolling';

/** Polls the backend for the current set of sensors. */
export function useSensors(): PollingState<Sensor[]> {
  return usePolling<Sensor[]>(
    (signal) => api.sensors.list({ signal }),
    env.pollIntervalMs,
  );
}
