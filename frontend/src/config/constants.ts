/** Cross-cutting constants. Domain-specific values live next to the code that uses them. */
export const GHOST_MURMUR_RANGE_METRES = 40_000;

export const POLL_INTERVALS_MS = {
  alerts: 3_000,
  tracks: 4_000,
  sensors: 15_000,
  missions: 30_000,
} as const;
