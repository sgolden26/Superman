import type { Uuid } from '@/types/common';

export interface SubjectDetailDrawerProps {
  subjectId: Uuid | null;
  onClose: () => void;
}

/**
 * Slide-in detail panel: classification + factors, current track, history,
 * imagery thumbnails, operator annotations.
 */
export default function SubjectDetailDrawer(_props: SubjectDetailDrawerProps) {
  return <div data-component="SubjectDetailDrawer" />;
}
