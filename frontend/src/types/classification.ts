import type { Iso8601, Uuid } from './common';
import type { Classification } from './subject';

export type ThreatLevel = 'none' | 'low' | 'elevated' | 'high' | 'critical';

export interface ClassificationFactor {
  kind: string;
  description: string;
  weight: number;
}

export interface ClassificationResult {
  id: Uuid;
  subject_id: Uuid;
  classification: Classification;
  confidence: number;
  threat_level: ThreatLevel;
  decided_at: Iso8601;
  classifier_name: string;
  factors: ClassificationFactor[];
}
