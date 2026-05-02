export interface HeartbeatPulseProps {
  bpm?: number;
  active?: boolean;
}

/** Small animated heart pulse for live-detected signatures. */
export default function HeartbeatPulse(_props: HeartbeatPulseProps) {
  return <span aria-label="heartbeat" />;
}
