import { useMemo } from "react";
import { useAppStore } from "@/state/store";
import type { Faction, Unit, UnitDomain } from "@/types/scenario";

const DOMAIN_LABEL: Record<UnitDomain, string> = {
  ground: "Ground",
  air: "Air",
  naval: "Naval",
};

const DOMAIN_GLYPH: Record<UnitDomain, string> = {
  ground: "■",
  air: "▲",
  naval: "◆",
};

export function OOBTree() {
  const scenario = useAppStore((s) => s.scenario);
  const expanded = useAppStore((s) => s.oobExpanded);
  const toggle = useAppStore((s) => s.toggleOobNode);
  const select = useAppStore((s) => s.select);
  const selection = useAppStore((s) => s.selection);

  const groups = useMemo(() => {
    if (!scenario) return [] as Array<{
      faction: Faction;
      domains: Array<{ domain: UnitDomain; units: Unit[] }>;
    }>;
    const out: Array<{
      faction: Faction;
      domains: Array<{ domain: UnitDomain; units: Unit[] }>;
    }> = [];
    for (const faction of scenario.factions) {
      const units = scenario.units.filter((u) => u.faction_id === faction.id);
      if (units.length === 0) continue;
      const byDomain = new Map<UnitDomain, Unit[]>();
      for (const u of units) {
        const list = byDomain.get(u.domain) ?? [];
        list.push(u);
        byDomain.set(u.domain, list);
      }
      const domains: Array<{ domain: UnitDomain; units: Unit[] }> = [];
      for (const d of ["ground", "air", "naval"] as UnitDomain[]) {
        const us = byDomain.get(d);
        if (us && us.length > 0)
          domains.push({
            domain: d,
            units: [...us].sort((a, b) =>
              (a.callsign || a.name).localeCompare(b.callsign || b.name),
            ),
          });
      }
      out.push({ faction, domains });
    }
    return out;
  }, [scenario]);

  if (!scenario) {
    return (
      <div className="px-3 py-4 font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
        warming up…
      </div>
    );
  }

  return (
    <div className="py-1">
      <div className="flex items-center justify-between px-3 pb-1 pt-2">
        <span className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
          order of battle
        </span>
        <span className="font-mono text-[9px] tabular-nums text-ink-300">
          {scenario.units.length}
        </span>
      </div>
      {groups.map(({ faction, domains }) => {
        const factionKey = `f:${faction.id}`;
        const factionOpen = expanded[factionKey] ?? true;
        return (
          <div key={faction.id} className="hairline-soft-b">
            <button
              onClick={() => toggle(factionKey)}
              className="flex w-full items-center gap-2 px-3 py-1.5 transition-colors hover:bg-white/[0.02]"
            >
              <span className="font-mono text-[9px] text-ink-300">
                {factionOpen ? "▾" : "▸"}
              </span>
              <span
                className="inline-block h-2 w-2 rounded-[1px]"
                style={{ background: faction.color }}
              />
              <span className="flex-1 truncate text-left font-mono text-[10px] uppercase tracking-wider2 text-ink-50">
                {faction.id}
              </span>
            </button>
            {factionOpen &&
              domains.map(({ domain, units }) => {
                const domainKey = `d:${faction.id}:${domain}`;
                const domainOpen = expanded[domainKey] ?? false;
                return (
                  <div key={domain}>
                    <button
                      onClick={() => toggle(domainKey)}
                      className="flex w-full items-center gap-2 py-1 pl-6 pr-3 transition-colors hover:bg-white/[0.02]"
                    >
                      <span className="font-mono text-[9px] text-ink-300">
                        {domainOpen ? "▾" : "▸"}
                      </span>
                      <span className="font-mono text-[10px] text-ink-200">
                        {DOMAIN_GLYPH[domain]}
                      </span>
                      <span className="flex-1 truncate text-left font-mono text-[9px] uppercase tracking-wider2 text-ink-200">
                        {DOMAIN_LABEL[domain]}
                      </span>
                      <span className="font-mono text-[9px] tabular-nums text-ink-300">
                        {units.length}
                      </span>
                    </button>
                    {domainOpen && (
                      <ul>
                        {units.map((u) => {
                          const active =
                            selection?.kind === "unit" && selection.id === u.id;
                          return (
                            <li key={u.id}>
                              <button
                                onClick={() => select({ kind: "unit", id: u.id })}
                                className={`flex w-full items-center gap-2 py-1 pl-10 pr-3 text-left font-mono text-[10px] tracking-wider2 transition-colors ${
                                  active
                                    ? "row-selected text-ink-50"
                                    : "text-ink-100 hover:bg-white/[0.02]"
                                }`}
                              >
                                <span className="truncate">
                                  {u.callsign || u.name}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
