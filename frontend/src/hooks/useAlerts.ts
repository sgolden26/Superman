import type { Alert } from '@/types/alert';
import type { AlertQuery } from '@/api/endpoints/alerts';
import type { PollingState } from './usePolling';

/** Audience-filtered live alert feed. Used by both C2 and Field. */
export function useAlerts(_query?: AlertQuery): PollingState<Alert[]> {
  throw new Error('Not implemented');
}
