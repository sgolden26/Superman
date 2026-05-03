import { useAppStore, type LayerKey } from "@/state/store";

const LAYER_LABEL: Record<LayerKey, string> = {
  oblasts: "Regions",
  cities: "Cities",
  units_ground: "Ground",
  units_air: "Air",
  units_naval: "Naval",
  depots: "Depots",
  airfields: "Airfields",
  naval_bases: "Naval bases",
  border_crossings: "Crossings",
  supply_lines: "Supply",
  missile_ranges: "Missile arcs",
  frontline: "Front",
};

const GROUPS: { label: string; keys: LayerKey[] }[] = [
  { label: "world", keys: ["oblasts", "cities", "frontline"] },
  { label: "forces", keys: ["units_ground", "units_air", "units_naval"] },
  {
    label: "logistics",
    keys: ["supply_lines", "depots", "airfields", "naval_bases", "border_crossings"],
  },
  { label: "fires", keys: ["missile_ranges"] },
];

export function FilterChips() {
  const visible = useAppStore((s) => s.visibleLayers);
  const toggle = useAppStore((s) => s.toggleLayer);

  return (
    <div className="space-y-3 px-3 py-3">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <div className="mb-1.5 font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
            {group.label}
          </div>
          <div className="flex flex-wrap gap-1">
            {group.keys.map((key) => {
              const active = visible[key];
              return (
                <button
                  key={key}
                  onClick={() => toggle(key)}
                  className={`border px-2 py-[3px] font-mono text-[9px] uppercase tracking-wider2 transition-colors ${
                    active
                      ? "border-faction-nato/40 bg-faction-nato/10 text-faction-nato"
                      : "border-[rgba(255,255,255,0.06)] bg-ink-700/40 text-ink-200 hover:border-[rgba(255,255,255,0.14)] hover:text-ink-50"
                  }`}
                  aria-pressed={active}
                  title={LAYER_LABEL[key]}
                >
                  {LAYER_LABEL[key]}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
