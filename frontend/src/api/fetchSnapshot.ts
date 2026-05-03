import { TheatreSnapshotSchema, type TheatreSnapshot } from '@/types/snapshot';

/**
 * Loads the theatre snapshot served as `/state.json` (Vite copies from
 * `data/` in predev; dev middleware can also read `../data/state.json` live).
 */
export async function fetchSnapshot(): Promise<TheatreSnapshot> {
  const res = await fetch('/state.json', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Could not load state.json (HTTP ${res.status})`);
  }
  const raw: unknown = await res.json();
  return TheatreSnapshotSchema.parse(raw);
}
