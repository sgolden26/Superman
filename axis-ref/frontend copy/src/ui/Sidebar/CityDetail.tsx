import type { City, Faction } from "@/types/scenario";
import { SectionHeader } from "./primitives/SectionHeader";
import { KeyValueRow } from "./primitives/KeyValueRow";
import { FactionTag } from "./primitives/FactionTag";
import { CountryBadge } from "./primitives/CountryBadge";

interface Props {
  city: City;
  faction: Faction;
}

export function CityDetail({ city, faction }: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="hairline-b px-4 pb-3 pt-4">
        <div className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
          city
          <span className="px-1 text-ink-400">/</span>
          {city.importance}
        </div>
        <div className="mt-1 text-[18px] font-semibold leading-tight tracking-tight text-ink-50">
          {city.name}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <FactionTag faction={faction} />
          <span className="font-mono text-[10px] tracking-wider2 text-ink-300">
            {city.id}
          </span>
        </div>
      </div>

      <SectionHeader label="metadata" />
      <KeyValueRow
        label="position"
        value={`${city.position[1].toFixed(3)}°N  ${city.position[0].toFixed(3)}°E`}
      />
      <KeyValueRow
        label="population"
        value={city.population.toLocaleString("en-GB")}
      />
      <div className="flex items-center justify-between px-4 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
          country
        </span>
        <CountryBadge countryId={city.country_id ?? null} />
      </div>

      <SectionHeader label="infrastructure" trailing={`${city.infrastructure.length}`} />
      {city.infrastructure.length === 0 ? (
        <div className="px-4 py-3 font-mono text-[11px] text-ink-200">
          none reported
        </div>
      ) : (
        <ul className="px-4 py-2">
          {city.infrastructure.map((entry) => (
            <li
              key={entry}
              className="flex items-center gap-2 py-1 font-mono text-[11px] uppercase tracking-wider2 text-ink-50"
            >
              <span className="inline-block h-px w-3 bg-ink-300" />
              {entry.replace(/_/g, " ")}
            </li>
          ))}
        </ul>
      )}

      <SectionHeader label="political posture" trailing="stub" />
      <div className="px-4 py-3 font-mono text-[11px] leading-relaxed text-ink-100">
        Sentiment, protest intensity and leader pressure metrics will populate
        here once the intel layer is online.
      </div>
    </div>
  );
}
