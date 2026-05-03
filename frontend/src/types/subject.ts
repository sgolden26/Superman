import type { Iso8601 } from './common';

export type Alignment = 'blue' | 'green' | 'red' | 'grey';

/** Wire shape of `Person` from the backend (`backend/app/models/person.py`). */
export interface SubjectDTO {
  id: number;
  name: string;
  alignment: Alignment;
  fingerprint: string;
  attributes: Record<string, unknown>;
  created_at: Iso8601;
}

export class Subject {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly alignment: Alignment,
    public readonly fingerprint: string,
    public readonly attributes: Record<string, unknown>,
    public readonly createdAt: Iso8601,
  ) {}

  static fromJson(raw: SubjectDTO): Subject {
    return new Subject(
      raw.id,
      raw.name,
      raw.alignment,
      raw.fingerprint,
      raw.attributes,
      raw.created_at,
    );
  }
}
