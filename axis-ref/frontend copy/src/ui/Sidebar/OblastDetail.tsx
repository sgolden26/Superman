import type { Faction, Oblast } from "@/types/scenario";
import { SectionHeader } from "./primitives/SectionHeader";
import { KeyValueRow } from "./primitives/KeyValueRow";
import { FactionTag } from "./primitives/FactionTag";
import { MetricBar } from "./primitives/MetricBar";

interface Props {
  oblast: Oblast;
  faction: Faction;
  countryName: string;
}

export function OblastDetail({ oblast, faction, countryName }: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="hairline-b px-4 pb-3 pt-4">
        <div className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
          oblast
          {oblast.contested && (
            <>
              <span className="px-1 text-ink-400">/</span>
              <span className="text-accent-amber">contested</span>
            </>
          )}
        </div>
        <div className="mt-1 text-[18px] font-semibold leading-tight tracking-tight text-ink-50">
          {oblast.name}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <FactionTag faction={faction} />
          <span className="font-mono text-[10px] tracking-wider2 text-ink-300">
            {oblast.iso_3166_2}
          </span>
        </div>
      </div>

      <SectionHeader label="metadata" />
      <KeyValueRow label="country" value={countryName} />
      <KeyValueRow
        label="population"
        value={oblast.population.toLocaleString("en-GB")}
      />
      <KeyValueRow
        label="area"
        value={`${oblast.area_km2.toLocaleString("en-GB")} km²`}
      />
      <KeyValueRow
        label="refugees out"
        value={oblast.refugees_outflow.toLocaleString("en-GB")}
      />

      <SectionHeader label="metrics" />
      <MetricBar label="control" value={oblast.control} />
      <MetricBar label="morale" value={oblast.morale} />
      <MetricBar label="civil unrest" value={oblast.civil_unrest} tone="warn" />

      {oblast.available_actions.length > 0 && (
        <>
          <SectionHeader label="available actions" trailing="stub" />
          <ul className="px-4 py-2 space-y-1">
            {oblast.available_actions.map((a) => (
              <li
                key={a}
                className="font-mono text-[11px] uppercase tracking-wider2 text-ink-200"
              >
                — {a.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
