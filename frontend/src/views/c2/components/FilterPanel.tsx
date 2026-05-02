import type { Classification } from '@/types/subject';
import type { ThreatLevel } from '@/types/classification';

export interface FilterValue {
  classifications: Classification[];
  threatLevels: ThreatLevel[];
  showSensorCoverage: boolean;
  showImagery: boolean;
}

export interface FilterPanelProps {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
}

export default function FilterPanel(_props: FilterPanelProps) {
  return <div data-component="FilterPanel" />;
}
