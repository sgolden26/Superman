import type { ThreatLevel } from '@/types/classification';

export interface ThreatLevelIndicatorProps {
  level: ThreatLevel;
  size?: 'sm' | 'md' | 'lg';
}

/** Coloured dot/ring keyed off `tailwind.config.colors.threat`. */
export default function ThreatLevelIndicator(_props: ThreatLevelIndicatorProps) {
  return <span aria-label="threat level" />;
}
