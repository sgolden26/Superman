import { GeoPoint, type GeoPointDTO, type Uuid } from './common';

export interface SubjectDTO {
  id: Uuid;
  name: string;
  location: GeoPointDTO;
}

/** Wire-compatible mirror of `app.domain.models.subject.Subject`. */
export class Subject {
  constructor(
    public readonly id: Uuid,
    public readonly name: string,
    public readonly location: GeoPoint,
  ) {}

  static fromJson(raw: SubjectDTO): Subject {
    return new Subject(raw.id, raw.name, GeoPoint.fromJson(raw.location));
  }
}
