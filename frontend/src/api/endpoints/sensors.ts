import type { ApiClient } from '../client';
import type { Sensor, SensorStatus, SensorType } from '@/types/sensor';
import type { GeoPoint, Uuid } from '@/types/common';

export interface SensorCreate {
  name: string;
  type: SensorType;
  location: GeoPoint;
  range_metres: number;
}

export interface SensorUpdate {
  name?: string;
  status?: SensorStatus;
  location?: GeoPoint;
}

export const bind = (client: ApiClient) => ({
  list: (): Promise<Sensor[]> => client.get('/sensors'),
  create: (payload: SensorCreate): Promise<Sensor> => client.post('/sensors', payload),
  update: (id: Uuid, payload: SensorUpdate): Promise<Sensor> =>
    client.patch(`/sensors/${id}`, payload),
});
