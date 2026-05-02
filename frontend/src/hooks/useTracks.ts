import type { Track } from '@/types/track';
import type { TrackQuery } from '@/api/endpoints/tracks';
import type { PollingState } from './usePolling';

/** Live list of tracks for the C2 map and lists. */
export function useTracks(_query?: TrackQuery): PollingState<Track[]> {
  throw new Error('Not implemented');
}
