/** Earth mean radius for game-grade geodesics (km). */
const R_KM = 6371;

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

/** Haversine great-circle distance in km between [lon, lat] points. */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const h = s1 * s1 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * s2 * s2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R_KM * c;
}

/** Initial (forward) bearing from a to b, degrees [0, 360). */
export function initialBearingDeg(a: [number, number], b: [number, number]): number {
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Destination point traveling `bearingDeg` from `origin` for `distanceKm` (great circle). */
export function destinationPointKm(
  origin: [number, number],
  bearingDeg: number,
  distanceKm: number,
): [number, number] {
  const [lon, lat] = origin;
  const δ = distanceKm / R_KM;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(lat);
  const λ1 = toRad(lon);
  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);
  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
  const φ2 = Math.asin(Math.max(-1, Math.min(1, sinφ2)));
  const y = Math.sin(θ) * sinδ * cosφ1;
  const x = cosδ - sinφ1 * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);
  const lonOut = ((((λ2 * 180) / Math.PI + 540) % 360) - 180) as number;
  const latOut = (φ2 * 180) / Math.PI;
  return [lonOut, latOut];
}

/** Approximate geodesic disc as a GeoJSON polygon (outer ring). */
export function geodesicCirclePolygon(
  center: [number, number],
  radiusKm: number,
  steps = 72,
): GeoJSON.Polygon {
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const brng = (360 * i) / steps;
    ring.push(destinationPointKm(center, brng, radiusKm));
  }
  return { type: "Polygon", coordinates: [ring] };
}

function llToCartesian(lon: number, lat: number): [number, number, number] {
  const λ = toRad(lon);
  const φ = toRad(lat);
  const c = Math.cos(φ);
  return [c * Math.cos(λ), c * Math.sin(λ), Math.sin(φ)];
}

function cartesianToLl(x: number, y: number, z: number): [number, number] {
  const lon = (Math.atan2(y, x) * 180) / Math.PI;
  const hyp = Math.sqrt(x * x + y * y);
  const lat = (Math.atan2(z, hyp) * 180) / Math.PI;
  return [lon, lat];
}

/** Spherical interpolation along the great circle from a (t=0) to b (t=1). */
export function greatCircleInterpolate(
  a: [number, number],
  b: [number, number],
  t: number,
): [number, number] {
  const [ax, ay, az] = llToCartesian(a[0], a[1]);
  const [bx, by, bz] = llToCartesian(b[0], b[1]);
  const dot = Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz));
  const omega = Math.acos(dot);
  if (omega < 1e-8) return a;
  const s0 = Math.sin((1 - t) * omega) / Math.sin(omega);
  const s1 = Math.sin(t * omega) / Math.sin(omega);
  const x = s0 * ax + s1 * bx;
  const y = s0 * ay + s1 * by;
  const z = s0 * az + s1 * bz;
  return cartesianToLl(x, y, z);
}

export function greatCircleLineString(
  a: [number, number],
  b: [number, number],
  segments = 48,
): GeoJSON.LineString {
  const coords: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    coords.push(greatCircleInterpolate(a, b, i / segments));
  }
  return { type: "LineString", coordinates: coords };
}

/** If `point` is farther than `radiusKm` from `center`, return the point on the ring toward `point`. */
export function clampToGeodesicDisk(
  center: [number, number],
  point: [number, number],
  radiusKm: number,
): { point: [number, number]; clamped: boolean } {
  const d = haversineKm(center, point);
  if (d <= radiusKm) return { point, clamped: false };
  const brng = initialBearingDeg(center, point);
  return { point: destinationPointKm(center, brng, radiusKm), clamped: true };
}
