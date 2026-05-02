import type { ApiClient } from '../client';
import type { Subject } from '@/types/subject';
import type { Uuid } from '@/types/common';

export interface AnnotateRequest {
  alias?: string | null;
  add_tags?: string[];
  remove_tags?: string[];
}

export const bind = (client: ApiClient) => ({
  list: (): Promise<Subject[]> => client.get('/subjects'),
  get: (id: Uuid): Promise<Subject> => client.get(`/subjects/${id}`),
  annotate: (id: Uuid, payload: AnnotateRequest): Promise<Subject> =>
    client.patch(`/subjects/${id}`, payload),
});
