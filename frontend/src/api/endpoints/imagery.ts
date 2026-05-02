import type { ApiClient } from '../client';
import type { ImageryFrame } from '@/types/imagery';
import type { SensorType } from '@/types/sensor';

export interface ImageryQuery {
  bbox?: [number, number, number, number];
  since?: string;
  until?: string;
  source?: SensorType;
  limit?: number;
  offset?: number;
}

export const bind = (client: ApiClient) => ({
  list: (_query?: ImageryQuery): Promise<ImageryFrame[]> =>
    client.get('/imagery', { query: _query as never }),
  signedUrl: (id: string): Promise<{ url: string }> => client.get(`/imagery/${id}/url`),
});
