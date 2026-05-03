import { GeoPoint, type GeoPointDTO, type Uuid } from './common';

export interface SensorDTO {
  id: Uuid;
  name: string;
  location: GeoPointDTO;
}

/** Wire-compatible mirror of `app.domain.models.sensor.Sensor`. */
export class Sensor {
  constructor(
    public readonly id: Uuid,
    public readonly name: string,
    public readonly location: GeoPoint,
  ) {}

  static fromJson(raw: SensorDTO): Sensor {
    return new Sensor(raw.id, raw.name, GeoPoint.fromJson(raw.location));
  }
}
