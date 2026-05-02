import type { ApiClient } from '../client';
import type { Alert } from '@/types/alert';
import type { GeoPoint, Uuid } from '@/types/common';

export interface AlertQuery {
  since?: string;
  unacknowledged_only?: boolean;
  near?: GeoPoint;
  radius_metres?: number;
  limit?: number;
  offset?: number;
}

export const bind = (client: ApiClient) => ({
  list: (_query?: AlertQuery): Promise<Alert[]> =>
    client.get('/alerts', { query: _query as never }),
  acknowledge: (id: Uuid, note?: string): Promise<Alert> =>
    client.post(`/alerts/${id}/ack`, { note }),
});
