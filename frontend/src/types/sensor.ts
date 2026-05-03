import { GeoPoint } from './common';

/** Wire shape from the backend (`backend/app/models/sensor.py`). */
export interface SensorDTO {
  id: number;
  name: string;
  lat: number;
  lon: number;
}

export class Sensor {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly location: GeoPoint,
  ) {}

  static fromJson(raw: SensorDTO): Sensor {
    return new Sensor(raw.id, raw.name, new GeoPoint(raw.lat, raw.lon));
  }
}
