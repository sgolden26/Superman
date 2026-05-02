import type { ClassificationResult } from '@/types/classification';
import type { Subject } from '@/types/subject';
import type { Track } from '@/types/track';
import type { Uuid } from '@/types/common';

/** Combined view of a subject and its associated tracks/classifications. */
export interface SubjectView {
  subject: Subject | null;
  tracks: Track[];
  classifications: ClassificationResult[];
  isLoading: boolean;
  error: Error | null;
}

export function useSubject(_id: Uuid | null): SubjectView {
  throw new Error('Not implemented');
}
