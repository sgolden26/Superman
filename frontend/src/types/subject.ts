import type { Iso8601, Uuid } from './common';

export type Classification = 'unknown' | 'civilian' | 'combatant';

export interface Subject {
  id: Uuid;
  primary_signature_id: Uuid;
  alias: string | null;
  current_classification: Classification;
  classification_confidence: number;
  first_seen_at: Iso8601;
  last_seen_at: Iso8601;
  aliases: string[];
  tags: string[];
}
