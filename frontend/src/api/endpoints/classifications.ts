import type { ApiClient } from '../client';
import type { ClassificationResult } from '@/types/classification';
import type { Uuid } from '@/types/common';

export interface ClassifyRequest {
  classifier_name?: string;
}

export const bind = (client: ApiClient) => ({
  history: (subjectId: Uuid): Promise<ClassificationResult[]> =>
    client.get(`/classifications/subject/${subjectId}`),
  classify: (
    subjectId: Uuid,
    payload: ClassifyRequest = {},
  ): Promise<ClassificationResult> =>
    client.post(`/classifications/subject/${subjectId}`, payload),
});
