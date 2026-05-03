import type { ApiClient, RequestOptions } from '../client';
import { Sensor, type SensorDTO } from '@/types/sensor';

/** Object-oriented binding for the `/sensors` resource. */
export class SensorsApi {
  constructor(private readonly client: ApiClient) {}

  async list(opts?: RequestOptions): Promise<Sensor[]> {
    const raw = await this.client.get<SensorDTO[]>('/sensors', opts);
    return raw.map(Sensor.fromJson);
  }
}
