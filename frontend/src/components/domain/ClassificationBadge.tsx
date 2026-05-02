import type { Classification } from '@/types/subject';
import Badge from '@/components/ui/Badge';

export interface ClassificationBadgeProps {
  classification: Classification;
  confidence?: number;
}

/** Civilian / Combatant / Unknown chip with confidence. Used by both views. */
export default function ClassificationBadge(_props: ClassificationBadgeProps) {
  return <Badge>placeholder</Badge>;
}
