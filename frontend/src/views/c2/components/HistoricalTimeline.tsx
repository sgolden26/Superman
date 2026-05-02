import type { Uuid } from '@/types/common';

export interface HistoricalTimelineProps {
  subjectId: Uuid;
}

/** Vertical timeline of detections, classification changes, alerts. */
export default function HistoricalTimeline(_props: HistoricalTimelineProps) {
  return <div data-component="HistoricalTimeline" />;
}
