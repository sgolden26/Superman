import type { Track } from '@/types/track';
import type { Uuid } from '@/types/common';

export interface TrackListProps {
  tracks: Track[];
  selectedId?: Uuid | null;
  onSelect?: (id: Uuid) => void;
}

/** Right-rail list of active tracks with classification badge and last-seen. */
export default function TrackList(_props: TrackListProps) {
  return <div data-component="TrackList" />;
}
