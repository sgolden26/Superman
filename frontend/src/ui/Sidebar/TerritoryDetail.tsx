import { useAppStore } from "@/state/store";
import type { Faction, Territory } from "@/types/scenario";
import { SectionHeader } from "./primitives/SectionHeader";
import { KeyValueRow } from "./primitives/KeyValueRow";
import { MetricBar } from "./primitives/MetricBar";
import { FactionTag } from "./primitives/FactionTag";
import { CountryBadge } from "./primitives/CountryBadge";

interface Props {
  territory: Territory;
  faction: Faction;
}

const TREND_GLYPH = { rising: "▲", steady: "—", declining: "▼" } as const;

function moraleTone(score: number): "ok" | "neutral" | "warn" | "danger" {
  if (score >= 70) return "ok";
  if (score >= 50) return "neutral";
  if (score >= 30) return "warn";
  return "danger";
}

function moraleColor(tone: ReturnType<typeof moraleTone>): string {
  switch (tone) {
    case "ok":
      return "var(--accent-ok)";
    case "warn":
      return "var(--accent-amber)";
    case "danger":
      return "var(--accent-danger)";
    default:
      return "var(--ink-50)";
  }
}

export function TerritoryDetail({ territory, faction }: Props) {
  const intel = useAppStore((s) => s.intel);
  const points = territory.polygon.reduce((acc, ring) => acc + ring.length, 0);
  const region = intel?.regions.find((r) => r.region_id === territory.id);

  return (
    <div className="flex h-full flex-col">
      <div className="hairline-b px-4 pb-3 pt-4">
        <div className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
          territory
        </div>
        <div className="mt-1 text-[18px] font-semibold leading-tight tracking-tight text-ink-50">
          {territory.name}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <FactionTag faction={faction} />
          <span className="font-mono text-[10px] tracking-wider2 text-ink-300">
            {territory.id}
          </span>
        </div>
      </div>

      <SectionHeader label="control" />
      <MetricBar label="effective control" value={territory.control} />
      <div className="flex items-center justify-between px-4 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
          country
        </span>
        <CountryBadge countryId={territory.country_id ?? null} />
      </div>

      <SectionHeader label="geometry" />
      <KeyValueRow label="rings" value={territory.polygon.length} />
      <KeyValueRow label="vertices" value={points} />

      <SectionHeader
        label="morale"
        trailing={region ? `live · ${intel?.source ?? "?"}` : "no intel"}
      />
      {region ? (
        <div className="px-4 py-3">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span
                className="font-mono text-[28px] leading-none"
                style={{ color: moraleColor(moraleTone(region.morale_score)) }}
              >
                {Math.round(region.morale_score)}
              </span>
              <span className="font-mono text-[11px] text-ink-200">/100</span>
            </div>
            <span
              className="font-mono text-[10px] uppercase tracking-wider2"
              style={{ color: moraleColor(moraleTone(region.morale_score)) }}
            >
              {TREND_GLYPH[region.morale_trend]} {region.morale_trend} (
              {region.trend_delta >= 0 ? "+" : ""}
              {region.trend_delta.toFixed(1)})
            </span>
          </div>
          {region.drivers[0] && (
            <div className="mt-2 border-l-2 border-ink-400 pl-3 text-[11px] leading-snug text-ink-100">
              Driven by{" "}
              <span className="text-ink-50">
                {region.drivers
                  .slice(0, 2)
                  .map((d) => d.category.replace("_", " "))
                  .join(", ")}
              </span>
              .
            </div>
          )}
          <div className="mt-2 font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
            full breakdown in decision engine →
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 font-mono text-[11px] leading-relaxed text-ink-200">
          Intel feed has not produced a morale snapshot for this region yet.
        </div>
      )}
    </div>
  );
}
