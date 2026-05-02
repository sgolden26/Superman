import type { ApiClient } from '../client';
import type { Detection } from '@/types/detection';
import type { Uuid } from '@/types/common';

export interface DetectionQuery {
  sensor_id?: Uuid;
  since?: string;
  until?: string;
  bbox?: [number, number, number, number];
  limit?: number;
  offset?: number;
}

export const bind = (client: ApiClient) => ({
  list: (_query?: DetectionQuery): Promise<Detection[]> =>
    client.get('/detections', { query: _query as never }),
  get: (id: Uuid): Promise<Detection> => client.get(`/detections/${id}`),
});
