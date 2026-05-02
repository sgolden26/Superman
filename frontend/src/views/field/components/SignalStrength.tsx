export interface SignalStrengthProps {
  bars: 0 | 1 | 2 | 3 | 4;
  label?: string;
}

export default function SignalStrength(_props: SignalStrengthProps) {
  return <span aria-label="signal strength" />;
}
