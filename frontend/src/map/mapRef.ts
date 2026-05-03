import type { Map as MlMap } from "maplibre-gl";

let current: MlMap | null = null;
const listeners = new Set<(m: MlMap | null) => void>();

export function setMapInstance(map: MlMap | null) {
  current = map;
  for (const fn of listeners) fn(map);
}

export function getMapInstance(): MlMap | null {
  return current;
}

export function subscribeMap(fn: (m: MlMap | null) => void): () => void {
  listeners.add(fn);
  if (current) fn(current);
  return () => {
    listeners.delete(fn);
  };
}
