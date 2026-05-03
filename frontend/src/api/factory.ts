import { ApiClient, apiClient } from './client';
import { SensorsApi } from './endpoints/sensors';
import { SubjectsApi } from './endpoints/subjects';

/**
 * Aggregates per-resource API classes against a chosen `ApiClient`. Tests can
 * pass a stubbed transport and get back a typed surface.
 */
export class ApiClientFactory {
  readonly sensors: SensorsApi;
  readonly subjects: SubjectsApi;

  constructor(private readonly client: ApiClient) {
    this.sensors = new SensorsApi(this.client);
    this.subjects = new SubjectsApi(this.client);
  }
}

export const api = new ApiClientFactory(apiClient);
export type Api = ApiClientFactory;
