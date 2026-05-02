import type { Alert } from '@/types/alert';
import type { Uuid } from '@/types/common';

export interface AlertFeedProps {
  alerts: Alert[];
  onAcknowledge?: (id: Uuid) => void;
}

/** Chronological alert feed with one-tap acknowledge. */
export default function AlertFeed(_props: AlertFeedProps) {
  return <div data-component="AlertFeed" />;
}
