import type { RegionIntel } from "@/types/intel";
import type { Faction, Oblast, Territory } from "@/types/scenario";

interface Props {
  regions: RegionIntel[];
  territoriesById: Map<string, Territory>;
  oblastsById: Map<string, Oblast>;
  factionsById: Map<string, Faction>;
  selectedRegionId: string | null;
  onSelect: (territoryId: string) => void;
}

const TREND_GLYPH = { rising: "▲", steady: "—", declining: "▼" } as const;

function moraleColor(score: number): string {
  if (score >= 70) return "var(--accent-ok)";
  if (score >= 50) return "var(--ink-50)";
  if (score >= 30) return "var(--accent-amber)";
  return "var(--accent-danger)";
}

export function RegionList({
  regions,
  territoriesById,
  oblastsById,
  factionsById,
  selectedRegionId,
  onSelect,
}: Props) {
  return (
    <div className="px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
        regions
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {regions.map((r) => {
          const t = territoriesById.get(r.region_id);
          const o = oblastsById.get(r.region_id);
          const f = t
            ? factionsById.get(t.faction_id)
            : o
              ? factionsById.get(o.faction_id)
              : undefined;
          const active = r.region_id === selectedRegionId;
          const color = moraleColor(r.morale_score);
          return (
            <li key={r.region_id}>
              <button
                onClick={() => onSelect(r.region_id)}
                aria-pressed={active}
                className={`flex w-full items-center justify-between gap-2 border px-2 py-1.5 text-left transition-colors ${
                  active
                    ? "border-faction-nato bg-ink-700"
                    : "border-ink-500 bg-ink-800 hover:border-ink-300"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] text-ink-50">
                    {t?.name ?? o?.name ?? r.region_id}
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-wider2 text-ink-200">
                    {f?.name ?? "—"}
                  </div>
                </div>
                <div className="flex items-center gap-1.5" style={{ color }}>
                  <span className="font-mono text-[10px]">
                    {TREND_GLYPH[r.morale_trend]}
                  </span>
                  <span className="font-mono text-[16px] leading-none">
                    {Math.round(r.morale_score)}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
