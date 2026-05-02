import type { Mission } from '@/types/mission';

export interface MissionControlsProps {
  mission: Mission | null;
  onStart: () => void;
  onAbort: () => void;
}

/** Start, abort, and switch active mission. */
export default function MissionControls(_props: MissionControlsProps) {
  return <div data-component="MissionControls" />;
}
