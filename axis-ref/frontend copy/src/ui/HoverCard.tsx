import { useMemo } from "react";
import { useAppStore } from "@/state/store";
import type { ScenarioSnapshot, SelectableKind } from "@/types/scenario";

interface Card {
  kind: string;
  title: string;
  rows: Array<[string, string]>;
  factionColor?: string;
}

function buildCard(scenario: ScenarioSnapshot, kind: SelectableKind, id: string): Card | null {
  const factionColor = (fid?: string) => {
    if (!fid) return undefined;
    return scenario.factions.find((f) => f.id === fid)?.color;
  };

  const findById = <T extends { id: string }>(arr: T[]): T | undefined =>
    arr.find((x) => x.id === id);

  switch (kind) {
    case "city": {
      const c = findById(scenario.cities);
      if (!c) return null;
      return {
        kind: `city · ${c.importance}`,
        title: c.name,
        factionColor: factionColor(c.faction_id),
        rows: [
          ["pop", c.population.toLocaleString("en-GB")],
          ["country", c.country_id ?? "—"],
        ],
      };
    }
    case "unit": {
      const u = findById(scenario.units);
      if (!u) return null;
      return {
        kind: `${u.echelon} · ${u.kind.replace(/_/g, " ")}`,
        title: u.callsign || u.name,
        factionColor: factionColor(u.faction_id),
        rows: [
          ["readiness", `${Math.round(u.readiness * 100)}%`],
          ["morale", `${Math.round(u.morale * 100)}%`],
        ],
      };
    }
    case "territory": {
      const t = findById(scenario.territories);
      if (!t) return null;
      return {
        kind: "territory",
        title: t.name,
        factionColor: factionColor(t.faction_id),
        rows: [["control", `${Math.round(t.control * 100)}%`]],
      };
    }
    case "country": {
      const c = findById(scenario.countries);
      if (!c) return null;
      return {
        kind: "country",
        title: c.name,
        factionColor: factionColor(c.faction_id),
        rows: [
          ["leader", c.government?.head_of_state ?? "—"],
          ["pop", c.demographics?.population?.toLocaleString("en-GB") ?? "—"],
        ],
      };
    }
    case "oblast": {
      const o = findById(scenario.oblasts);
      if (!o) return null;
      return {
        kind: o.contested ? "oblast · contested" : "oblast",
        title: o.name,
        factionColor: factionColor(o.faction_id),
        rows: [
          ["control", `${Math.round(o.control * 100)}%`],
          ["unrest", `${Math.round(o.civil_unrest * 100)}%`],
        ],
      };
    }
    case "depot": {
      const d = findById(scenario.depots);
      if (!d) return null;
      return {
        kind: "depot",
        title: d.name,
        factionColor: factionColor(d.faction_id),
        rows: [["fill", `${Math.round(d.fill * 100)}%`]],
      };
    }
    case "airfield": {
      const a = findById(scenario.airfields);
      if (!a) return null;
      return {
        kind: `airfield · ${a.role}`,
        title: a.name,
        factionColor: factionColor(a.faction_id),
        rows: [
          ["runway", `${a.runway_m} m`],
          ["aircraft", String(a.based_aircraft)],
        ],
      };
    }
    case "naval_base": {
      const n = findById(scenario.naval_bases);
      if (!n) return null;
      return {
        kind: "naval base",
        title: n.name,
        factionColor: factionColor(n.faction_id),
        rows: [["piers", String(n.pier_count)]],
      };
    }
    case "border_crossing": {
      const c = findById(scenario.border_crossings);
      if (!c) return null;
      return {
        kind: `crossing · ${c.mode}`,
        title: c.name,
        rows: [["link", `${c.countries[0]} ↔ ${c.countries[1]}`]],
      };
    }
    case "supply_line": {
      const s = findById(scenario.supply_lines);
      if (!s) return null;
      return {
        kind: `supply · ${s.mode}`,
        title: s.name,
        factionColor: factionColor(s.faction_id),
        rows: [["health", `${Math.round(s.health * 100)}%`]],
      };
    }
    case "isr_coverage": {
      const i = findById(scenario.isr_coverages);
      if (!i) return null;
      return {
        kind: `ISR · ${i.platform}`,
        title: i.name,
        factionColor: factionColor(i.faction_id),
        rows: [
          ["range", `${i.range_km} km`],
          ["confidence", `${Math.round(i.confidence * 100)}%`],
        ],
      };
    }
    case "missile_range": {
      const m = findById(scenario.missile_ranges);
      if (!m) return null;
      return {
        kind: `missile · ${m.category}`,
        title: m.name,
        factionColor: factionColor(m.faction_id),
        rows: [
          ["weapon", m.weapon],
          ["range", `${m.range_km} km`],
        ],
      };
    }
    case "aor": {
      const a = findById(scenario.aors);
      if (!a) return null;
      return {
        kind: "AOR",
        title: a.name,
        factionColor: factionColor(a.faction_id),
        rows: [["formation", a.formation_id ?? "—"]],
      };
    }
    case "frontline": {
      const f = findById(scenario.frontlines);
      if (!f) return null;
      return {
        kind: "frontline",
        title: f.name,
        rows: [["buffer", `${f.buffer_km} km`]],
      };
    }
  }
  return null;
}

export function HoverCard() {
  const scenario = useAppStore((s) => s.scenario);
  const hover = useAppStore((s) => s.hover);

  const card = useMemo(() => {
    if (!scenario || !hover) return null;
    return buildCard(scenario, hover.kind, hover.id);
  }, [scenario, hover]);

  if (!hover || !card) return null;

  const offsetX = 14;
  const offsetY = 14;

  return (
    <div
      className="pointer-events-none absolute z-30 max-w-[260px] border border-[var(--hairline-strong)] bg-ink-900/85 px-2.5 py-2 shadow-2xl backdrop-blur-md"
      style={{ left: hover.x + offsetX, top: hover.y + offsetY }}
    >
      <div className="flex items-center gap-2">
        {card.factionColor && (
          <span
            className="inline-block h-1.5 w-1.5 rounded-[1px]"
            style={{
              background: card.factionColor,
              boxShadow: `0 0 6px ${card.factionColor}80`,
            }}
          />
        )}
        <span className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
          {card.kind}
        </span>
      </div>
      <div className="mt-1 truncate text-[12px] font-semibold tracking-tight text-ink-50">
        {card.title}
      </div>
      <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {card.rows.map(([k, v]) => (
          <div key={k} className="contents">
            <span className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
              {k}
            </span>
            <span className="text-right font-mono text-[10px] tabular-nums text-ink-50">
              {v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
