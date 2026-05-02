import type { ApiClient } from '../client';
import type { AreaOfOperations, Mission } from '@/types/mission';
import type { Uuid } from '@/types/common';

export interface MissionCreate {
  name: string;
  area: AreaOfOperations;
  sensor_ids?: Uuid[];
  operator_ids?: Uuid[];
}

export const bind = (client: ApiClient) => ({
  list: (): Promise<Mission[]> => client.get('/missions'),
  create: (payload: MissionCreate): Promise<Mission> => client.post('/missions', payload),
  get: (id: Uuid): Promise<Mission> => client.get(`/missions/${id}`),
});
