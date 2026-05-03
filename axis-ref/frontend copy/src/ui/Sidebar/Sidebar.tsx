import { useAppStore } from "@/state/store";
import { EmptyState } from "./EmptyState";
import { CityDetail } from "./CityDetail";
import { UnitDetail } from "./UnitDetail";
import { TerritoryDetail } from "./TerritoryDetail";
import { CountryDetail } from "./CountryDetail";
import { OblastDetail } from "./OblastDetail";
import {
  AirfieldDetail,
  AorDetail,
  CrossingDetail,
  DepotDetail,
  FrontlineDetail,
  IsrDetail,
  MissileDetail,
  NavalDetail,
  SupplyDetail,
} from "./AssetDetails";

export function Sidebar() {
  const scenario = useAppStore((s) => s.scenario);
  const selection = useAppStore((s) => s.selection);
  const clearSelection = useAppStore((s) => s.clearSelection);

  if (!scenario) return <EmptyState />;

  const factionsById = new Map(scenario.factions.map((f) => [f.id, f]));
  const countriesById = new Map(scenario.countries.map((c) => [c.id, c]));

  let body: React.ReactNode = <EmptyState />;
  let title = "no contact";

  const k = selection?.kind;
  const id = selection?.id;
  const finder = <T extends { id: string }>(arr: T[]) =>
    id ? arr.find((x) => x.id === id) : undefined;

  if (k === "city") {
    const city = finder(scenario.cities);
    const faction = city ? factionsById.get(city.faction_id) : undefined;
    if (city && faction) {
      body = <CityDetail city={city} faction={faction} />;
      title = city.name.toUpperCase();
    }
  } else if (k === "unit") {
    const unit = finder(scenario.units);
    const faction = unit ? factionsById.get(unit.faction_id) : undefined;
    if (unit && faction) {
      body = <UnitDetail unit={unit} faction={faction} />;
      title = (unit.callsign || unit.name).toUpperCase();
    }
  } else if (k === "territory") {
    const t = finder(scenario.territories);
    const faction = t ? factionsById.get(t.faction_id) : undefined;
    if (t && faction) {
      body = <TerritoryDetail territory={t} faction={faction} />;
      title = t.name.toUpperCase();
    }
  } else if (k === "country") {
    const c = finder(scenario.countries);
    const faction = c ? factionsById.get(c.faction_id) : undefined;
    if (c && faction) {
      body = <CountryDetail country={c} faction={faction} />;
      title = c.name.toUpperCase();
    }
  } else if (k === "oblast") {
    const o = finder(scenario.oblasts);
    const faction = o ? factionsById.get(o.faction_id) : undefined;
    if (o && faction) {
      const country = countriesById.get(o.country_id);
      body = (
        <OblastDetail oblast={o} faction={faction} countryName={country?.name ?? "—"} />
      );
      title = o.name.toUpperCase();
    }
  } else if (k === "depot") {
    const d = finder(scenario.depots);
    const faction = d ? factionsById.get(d.faction_id) : undefined;
    if (d && faction) {
      body = <DepotDetail depot={d} faction={faction} />;
      title = d.name.toUpperCase();
    }
  } else if (k === "airfield") {
    const a = finder(scenario.airfields);
    const faction = a ? factionsById.get(a.faction_id) : undefined;
    if (a && faction) {
      body = <AirfieldDetail airfield={a} faction={faction} />;
      title = a.name.toUpperCase();
    }
  } else if (k === "naval_base") {
    const n = finder(scenario.naval_bases);
    const faction = n ? factionsById.get(n.faction_id) : undefined;
    if (n && faction) {
      body = <NavalDetail base={n} faction={faction} />;
      title = n.name.toUpperCase();
    }
  } else if (k === "border_crossing") {
    const c = finder(scenario.border_crossings);
    const faction = c ? factionsById.get(c.faction_id) : undefined;
    if (c && faction) {
      body = <CrossingDetail crossing={c} faction={faction} />;
      title = c.name.toUpperCase();
    }
  } else if (k === "supply_line") {
    const s = finder(scenario.supply_lines);
    const faction = s ? factionsById.get(s.faction_id) : undefined;
    if (s && faction) {
      body = <SupplyDetail supply={s} faction={faction} />;
      title = s.name.toUpperCase();
    }
  } else if (k === "isr_coverage") {
    const i = finder(scenario.isr_coverages);
    const faction = i ? factionsById.get(i.faction_id) : undefined;
    if (i && faction) {
      body = <IsrDetail isr={i} faction={faction} />;
      title = i.name.toUpperCase();
    }
  } else if (k === "missile_range") {
    const m = finder(scenario.missile_ranges);
    const faction = m ? factionsById.get(m.faction_id) : undefined;
    if (m && faction) {
      body = <MissileDetail missile={m} faction={faction} />;
      title = m.name.toUpperCase();
    }
  } else if (k === "aor") {
    const a = finder(scenario.aors);
    const faction = a ? factionsById.get(a.faction_id) : undefined;
    if (a && faction) {
      body = <AorDetail aor={a} faction={faction} />;
      title = a.name.toUpperCase();
    }
  } else if (k === "frontline") {
    const f = finder(scenario.frontlines);
    if (f) {
      body = <FrontlineDetail frontline={f} />;
      title = f.name.toUpperCase();
    }
  }

  const kindBreadcrumb = selectionBreadcrumb(k);

  return (
    <div className="flex h-full flex-col panel-surface">
      <div className="hairline-b flex items-center justify-between gap-3 px-4 py-2">
        <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
          contact
          {kindBreadcrumb ? (
            <>
              <span className="px-1.5 text-ink-300">/</span>
              <span className="text-ink-100">{kindBreadcrumb}</span>
            </>
          ) : null}
          {selection ? (
            <>
              <span className="px-1.5 text-ink-300">/</span>
              <span className="text-ink-50">{title}</span>
            </>
          ) : null}
        </span>
        {selection && (
          <button
            onClick={clearSelection}
            className="shrink-0 font-mono text-[10px] uppercase tracking-wider2 text-ink-200 transition-colors hover:text-ink-50"
            title="Clear selection"
          >
            clear
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">{body}</div>
    </div>
  );
}

function selectionBreadcrumb(kind: string | undefined): string | null {
  switch (kind) {
    case "city":
      return "city";
    case "unit":
      return "unit";
    case "territory":
      return "territory";
    case "country":
      return "country";
    case "oblast":
      return "oblast";
    case "depot":
      return "depot";
    case "airfield":
      return "airfield";
    case "naval_base":
      return "naval base";
    case "border_crossing":
      return "crossing";
    case "supply_line":
      return "supply";
    case "isr_coverage":
      return "isr";
    case "missile_range":
      return "missile";
    case "aor":
      return "aor";
    case "frontline":
      return "frontline";
    default:
      return null;
  }
}
