/**
 * Type-safe access to Vite env vars. Add new vars here so TS catches typos.
 */
export const env = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string) ?? '/api/v1',
  mapStyleUrl:
    (import.meta.env.VITE_MAP_STYLE_URL as string) ??
    'https://demotiles.maplibre.org/style.json',
  pollIntervalMs: Number(import.meta.env.VITE_POLL_INTERVAL_MS ?? 5000),
} as const;
