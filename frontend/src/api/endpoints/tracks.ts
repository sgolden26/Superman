import type { ApiClient } from '../client';
import type { Track } from '@/types/track';
import type { Uuid } from '@/types/common';

export interface TrackQuery {
  active_only?: boolean;
  subject_id?: Uuid;
  bbox?: [number, number, number, number];
  limit?: number;
  offset?: number;
}

export const bind = (client: ApiClient) => ({
  list: (_query?: TrackQuery): Promise<Track[]> =>
    client.get('/tracks', { query: _query as never }),
  get: (id: Uuid): Promise<Track> => client.get(`/tracks/${id}`),
});
