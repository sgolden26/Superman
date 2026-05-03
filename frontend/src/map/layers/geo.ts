/**
 * Geospatial helpers for procedurally generating ring polygons (circles,
 * sectors, line buffers) used by ISR, missile range and frontline layers.
 *
 * The math is great-circle (haversine forward formula) so the visuals look
 * right at any latitude. Inputs are [lon, lat] in degrees, distances in km.
 */

const R_EARTH_KM = 6371.0088;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export function destPoint(
  lon: number,
  lat: number,
  distKm: number,
  bearingDeg: number,
): [number, number] {
  const ang = distKm / R_EARTH_KM;
  const br = toRad(bearingDeg);
  const lat1 = toRad(lat);
  const lon1 = toRad(lon);

  const sinLat2 =
    Math.sin(lat1) * Math.cos(ang) +
    Math.cos(lat1) * Math.sin(ang) * Math.cos(br);
  const lat2 = Math.asin(sinLat2);
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(br) * Math.sin(ang) * Math.cos(lat1),
      Math.cos(ang) - Math.sin(lat1) * sinLat2,
    );
  return [((toDeg(lon2) + 540) % 360) - 180, toDeg(lat2)];
}

export function ringCircle(
  origin: [number, number],
  radiusKm: number,
  segments = 64,
): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const bearing = (i / segments) * 360;
    ring.push(destPoint(origin[0], origin[1], radiusKm, bearing));
  }
  return ring;
}

/**
 * Closed sector (pie slice) ring: origin -> arc -> origin. headingDeg is the
 * sector's centre bearing; beamDeg is total beam width (>= 360 degenerates to
 * a full circle).
 */
export function ringSector(
  origin: [number, number],
  radiusKm: number,
  headingDeg: number,
  beamDeg: number,
  segments = 48,
): [number, number][] {
  if (beamDeg >= 360) return ringCircle(origin, radiusKm, segments);
  const ring: [number, number][] = [];
  ring.push([origin[0], origin[1]]);
  const start = headingDeg - beamDeg / 2;
  for (let i = 0; i <= segments; i++) {
    const bearing = start + (i / segments) * beamDeg;
    ring.push(destPoint(origin[0], origin[1], radiusKm, bearing));
  }
  ring.push([origin[0], origin[1]]);
  return ring;
}

/**
 * Approximate a buffered polyline by offsetting each vertex perpendicular to
 * the local bearing on both sides, then connecting the offsets into a ring.
 * Good enough for the contested-band band rendering; not a true geodesic
 * Minkowski sum.
 */
export function bufferLine(
  path: [number, number][],
  widthKm: number,
): [number, number][] {
  if (path.length < 2) return [];
  const left: [number, number][] = [];
  const right: [number, number][] = [];

  for (let i = 0; i < path.length; i++) {
    const prev = path[Math.max(0, i - 1)];
    const next = path[Math.min(path.length - 1, i + 1)];
    const bearing = forwardBearing(prev[0], prev[1], next[0], next[1]);
    left.push(destPoint(path[i][0], path[i][1], widthKm, bearing - 90));
    right.push(destPoint(path[i][0], path[i][1], widthKm, bearing + 90));
  }
  return [...left, ...right.reverse(), left[0]];
}

function forwardBearing(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dlon = toRad(lon2 - lon1);
  const y = Math.sin(dlon) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dlon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
