import { useAppStore } from "@/state/store";

const R_KM = 6371;

function haversineKm(a: { lon: number; lat: number }, b: { lon: number; lat: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function MeasureTool() {
  const active = useAppStore((s) => s.measureActive);
  const setActive = useAppStore((s) => s.setMeasureActive);
  const path = useAppStore((s) => s.measurePath);
  const clear = useAppStore((s) => s.clearMeasure);

  const total = path.reduce((acc, p, i, arr) => {
    if (i === 0) return acc;
    return acc + haversineKm(arr[i - 1], p);
  }, 0);

  return (
    <div className="flex items-center gap-2 px-3 py-1">
      <button
        onClick={() => setActive(!active)}
        className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider2 transition-colors ${
          active
            ? "border-accent-amber bg-ink-700 text-accent-amber"
            : "border-ink-600 text-ink-200 hover:border-ink-400 hover:text-ink-50"
        }`}
        title="Measure ( M )"
      >
        ⌖ measure
      </button>
      {active && (
        <>
          <span className="font-mono text-[10px] text-ink-100">
            {path.length === 0
              ? "click points on map"
              : `${path.length} pts · ${total.toFixed(1)} km`}
          </span>
          {path.length > 0 && (
            <button
              onClick={clear}
              className="font-mono text-[9px] uppercase tracking-wider2 text-ink-200 hover:text-ink-50"
            >
              clear
            </button>
          )}
        </>
      )}
    </div>
  );
}
