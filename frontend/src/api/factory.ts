import { apiClient, type ApiClient } from './client';
import * as alerts from './endpoints/alerts';
import * as classifications from './endpoints/classifications';
import * as detections from './endpoints/detections';
import * as imagery from './endpoints/imagery';
import * as missions from './endpoints/missions';
import * as sensors from './endpoints/sensors';
import * as subjects from './endpoints/subjects';
import * as tracks from './endpoints/tracks';

/**
 * One-stop accessor for every endpoint, bound to a chosen client. Tests can
 * pass a mock `ApiClient` and get a typed surface back.
 */
export const buildApi = (client: ApiClient = apiClient) => ({
  detections: detections.bind(client),
  tracks: tracks.bind(client),
  subjects: subjects.bind(client),
  classifications: classifications.bind(client),
  alerts: alerts.bind(client),
  sensors: sensors.bind(client),
  imagery: imagery.bind(client),
  missions: missions.bind(client),
});

export const api = buildApi();
export type Api = ReturnType<typeof buildApi>;
