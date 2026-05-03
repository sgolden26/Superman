import type { ApiClient, RequestOptions } from '../client';
import { Subject, type SubjectDTO } from '@/types/subject';

/** Object-oriented binding for the `/people` resource (a "subject" in the UI). */
export class SubjectsApi {
  constructor(private readonly client: ApiClient) {}

  async list(opts?: RequestOptions): Promise<Subject[]> {
    const raw = await this.client.get<SubjectDTO[]>('/people', opts);
    return raw.map(Subject.fromJson);
  }
}
