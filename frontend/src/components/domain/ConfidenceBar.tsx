export interface ConfidenceBarProps {
  value: number;
  label?: string;
}

/** Horizontal 0-1 confidence visualisation. */
export default function ConfidenceBar(_props: ConfidenceBarProps) {
  return <div role="progressbar" aria-valuemin={0} aria-valuemax={1} />;
}
