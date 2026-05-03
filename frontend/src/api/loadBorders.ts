import type { FeatureCollection, Geometry } from "geojson";

export interface BordersBundle {
  admin0Primary: FeatureCollection<Geometry, Admin0Props>;
  admin0Context: FeatureCollection<Geometry, Admin0Props>;
  admin1Ua: FeatureCollection<Geometry, Admin1Props>;
}

export interface Admin0Props {
  iso_a3: string;
  iso_a2: string;
  name: string;
  name_long?: string;
}

export interface Admin1Props {
  iso_a3: string;
  iso_3166_2: string;
  oblast_code: string;
  name: string;
  name_uk?: string | null;
  type_en?: string;
  contested?: boolean;
}

let _cache: Promise<BordersBundle> | null = null;

export function loadBorders(): Promise<BordersBundle> {
  if (_cache) return _cache;
  _cache = (async () => {
    const [admin0Primary, admin0Context, admin1Ua] = await Promise.all([
      fetchJson<BordersBundle["admin0Primary"]>("/borders/admin0_primary.geojson"),
      fetchJson<BordersBundle["admin0Context"]>("/borders/admin0_context.geojson"),
      fetchJson<BordersBundle["admin1Ua"]>("/borders/admin1_ua.geojson"),
    ]);
    return { admin0Primary, admin0Context, admin1Ua };
  })();
  return _cache;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
