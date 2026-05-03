import { api } from '@/api/factory';
import { env } from '@/config/env';
import type { Subject } from '@/types/subject';
import { usePolling, type PollingState } from './usePolling';

/** Polls the backend for the current set of subjects. */
export function useSubjects(): PollingState<Subject[]> {
  return usePolling<Subject[]>(
    (signal) => api.subjects.list({ signal }),
    env.pollIntervalMs,
  );
}
