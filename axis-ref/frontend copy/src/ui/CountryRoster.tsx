import { useMemo, useState } from "react";
import { useAppStore } from "@/state/store";
import {
  CHOROPLETH_METRICS,
  metricDisplay,
  metricNormalised,
  type ChoroplethMetric,
  type Country,
} from "@/types/country";
import type { Faction } from "@/types/scenario";

type SortKey =
  | "name"
  | "alliance"
  | "alert_level"
  | "war_support"
  | "stability_index"
  | "posture"
  | "credibility";

const COLUMNS: { key: SortKey; label: string; width: string }[] = [
  { key: "name", label: "Country", width: "1.4fr" },
  { key: "alliance", label: "Alliance", width: "0.8fr" },
  { key: "alert_level", label: "Alert", width: "0.8fr" },
  { key: "war_support", label: "War sup.", width: "0.9fr" },
  { key: "stability_index", label: "Stability", width: "0.9fr" },
  { key: "posture", label: "Posture", width: "0.9fr" },
  { key: "credibility", label: "Cred.", width: "0.9fr" },
];

const COMPARE_METRICS: ChoroplethMetric[] = [
  "war_support",
  "alert_level",
  "stability_index",
  "approval_rating",
  "protest_intensity",
  "censorship_index",
  "institutional_trust",
];

export function CountryRoster() {
  const open = useAppStore((s) => s.rosterOpen);
  const setOpen = useAppStore((s) => s.setRosterOpen);
  const scenario = useAppStore((s) => s.scenario);
  const select = useAppStore((s) => s.select);
  const compareIds = useAppStore((s) => s.rosterCompareIds);
  const toggleCompare = useAppStore((s) => s.toggleRosterCompare);
  const clearCompare = useAppStore((s) => s.clearRosterCompare);

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const factionsById = useMemo(() => {
    const m = new Map<string, Faction>();
    for (const f of scenario?.factions ?? []) m.set(f.id, f);
    return m;
  }, [scenario]);

  const credibilityByFaction = useMemo(() => {
    const m = new Map<string, number>();
    if (!scenario) return m;
    const totals = new Map<string, { sum: number; n: number }>();
    for (const t of scenario.credibility) {
      const acc = totals.get(t.from_faction_id) ?? { sum: 0, n: 0 };
      acc.sum += t.immediate;
      acc.n += 1;
      totals.set(t.from_faction_id, acc);
    }
    for (const [fid, { sum, n }] of totals) {
      m.set(fid, n > 0 ? sum / n : 0);
    }
    return m;
  }, [scenario]);

  const sorted = useMemo(() => {
    const list = [...(scenario?.countries ?? [])];
    list.sort((a, b) => {
      const va = sortValue(a, sortKey, factionsById, credibilityByFaction);
      const vb = sortValue(b, sortKey, factionsById, credibilityByFaction);
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * (sortAsc ? 1 : -1);
      }
      return String(va).localeCompare(String(vb)) * (sortAsc ? 1 : -1);
    });
    return list;
  }, [scenario, sortKey, sortAsc, factionsById, credibilityByFaction]);

  const compareCountries = useMemo(
    () => compareIds.map((id) => sorted.find((c) => c.id === id)).filter(Boolean) as Country[],
    [compareIds, sorted],
  );

  if (!open) return null;

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const handleSelectCountry = (id: string) => {
    select({ kind: "country", id });
    setOpen(false);
  };

  const gridTemplate = `${COLUMNS.map((c) => c.width).join(" ")} 0.5fr`;

  return (
    <div className="absolute inset-x-0 top-0 z-30 flex max-h-[60vh] flex-col bg-ink-800 hairline-b">
      <div className="hairline-b flex items-center justify-between px-4 py-2">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
            countries · {sorted.length}
          </span>
          {compareCountries.length > 0 && (
            <span className="font-mono text-[10px] uppercase tracking-wider2 text-accent-amber">
              comparing {compareCountries.length} / 4
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {compareCountries.length > 0 && (
            <button
              onClick={clearCompare}
              className="hairline border px-2 py-1 font-mono text-[10px] uppercase tracking-wider2 text-ink-100 hover:text-ink-50"
            >
              clear
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="hairline border px-2 py-1 font-mono text-[10px] uppercase tracking-wider2 text-ink-100 hover:text-ink-50"
          >
            close ✕
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div
            className="hairline-b grid items-baseline px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider2 text-ink-200"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {COLUMNS.map((c) => (
              <button
                key={c.key}
                onClick={() => handleSort(c.key)}
                className="text-left hover:text-ink-50"
              >
                {c.label}
                {sortKey === c.key ? (sortAsc ? " ↑" : " ↓") : ""}
              </button>
            ))}
            <span className="text-right">cmp</span>
          </div>

          <ul>
            {sorted.map((c) => {
              const faction = factionsById.get(c.faction_id);
              const inCompare = compareIds.includes(c.id);
              return (
                <li
                  key={c.id}
                  className={`hairline-b grid items-baseline px-4 py-2 text-[11px] hover:bg-ink-700 ${
                    inCompare ? "bg-ink-700/50" : ""
                  }`}
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  <button
                    onClick={() => handleSelectCountry(c.id)}
                    className="flex items-center gap-2 text-left text-ink-50 hover:text-accent-amber"
                  >
                    <span className="text-[14px] leading-none">{c.flag_emoji}</span>
                    <span>{c.name}</span>
                  </button>
                  <span className="font-mono uppercase tracking-wider2 text-[10px]" style={{ color: faction?.color }}>
                    {faction?.name ?? c.faction_id}
                  </span>
                  <AlertCell value={c.military.alert_level} />
                  <PercentCell value={c.public_opinion.war_support} />
                  <PercentCell value={c.government.stability_index} />
                  <span className="font-mono text-[10px] uppercase tracking-wider2 text-ink-100">
                    {c.military.posture}
                  </span>
                  <CredibilityCell value={credibilityByFaction.get(c.faction_id) ?? null} />
                  <div className="text-right">
                    <button
                      onClick={() => toggleCompare(c.id)}
                      disabled={!inCompare && compareIds.length >= 4}
                      className={`hairline border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider2 ${
                        inCompare
                          ? "border-accent-amber text-accent-amber"
                          : "text-ink-200 hover:text-ink-50 disabled:opacity-40"
                      }`}
                    >
                      {inCompare ? "−" : "+"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {compareCountries.length > 0 && (
          <CompareView countries={compareCountries} />
        )}
      </div>
    </div>
  );
}

function AlertCell({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className="h-2 w-2"
          style={{
            background:
              n <= value ? "var(--accent-amber)" : "rgba(170, 180, 194, 0.20)",
          }}
        />
      ))}
      <span className="ml-1 font-mono text-[10px] text-ink-200">{value}/5</span>
    </div>
  );
}

function CredibilityCell({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider2 text-ink-300">
        —
      </span>
    );
  }
  const pct = Math.round(Math.abs(value) * 100);
  const tone =
    value >= 0.2
      ? "var(--accent-ok)"
      : value <= -0.2
        ? "var(--accent-danger)"
        : "var(--accent-amber)";
  const sign = value >= 0 ? "+" : "−";
  // Bar fills from the centre: positive fills right, negative fills left.
  const half = Math.min(50, pct / 2);
  return (
    <div className="flex items-center gap-2" title={`Outgoing immediate credibility (avg)`}>
      <div className="relative h-1 w-14 bg-ink-700">
        <div
          className="absolute top-0 h-full"
          style={{
            background: tone,
            width: `${half}%`,
            left: value >= 0 ? "50%" : `${50 - half}%`,
          }}
        />
        <div className="absolute top-0 h-full w-px bg-ink-500/60" style={{ left: "50%" }} />
      </div>
      <span className="font-mono text-[10px]" style={{ color: tone }}>
        {sign}
        {pct}
      </span>
    </div>
  );
}

function PercentCell({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-12 bg-ink-700">
        <div
          className="h-full"
          style={{ width: `${pct}%`, background: "var(--ink-100)" }}
        />
      </div>
      <span className="font-mono text-[10px] text-ink-100">{pct}%</span>
    </div>
  );
}

function CompareView({ countries }: { countries: Country[] }) {
  return (
    <aside className="hairline-l flex w-[420px] shrink-0 flex-col overflow-y-auto bg-ink-800/80">
      <div className="hairline-b px-4 py-2 font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
        comparison
      </div>

      <div
        className="grid items-baseline gap-2 px-4 py-2"
        style={{ gridTemplateColumns: `1fr ${"0.5fr ".repeat(countries.length)}` }}
      >
        <span className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
          metric
        </span>
        {countries.map((c) => (
          <span
            key={c.id}
            className="text-right font-mono text-[10px] uppercase tracking-wider2 text-ink-50"
            title={c.name}
          >
            {c.flag_emoji} {c.iso_a3}
          </span>
        ))}
      </div>

      {COMPARE_METRICS.map((metric) => {
        const label = CHOROPLETH_METRICS.find((m) => m.id === metric)?.label ?? metric;
        const values = countries.map((c) => metricNormalised(c, metric));
        const max = Math.max(...values);
        return (
          <div
            key={metric}
            className="grid items-baseline gap-2 border-b border-ink-700/40 px-4 py-2"
            style={{ gridTemplateColumns: `1fr ${"0.5fr ".repeat(countries.length)}` }}
          >
            <span className="font-mono text-[10px] uppercase tracking-wider2 text-ink-100">
              {label}
            </span>
            {countries.map((c, i) => {
              const isMax = values[i] === max && max > 0;
              return (
                <div key={c.id} className="text-right">
                  <div className="font-mono text-[10px] text-ink-50">
                    {metricDisplay(c, metric)}
                  </div>
                  <div className="ml-auto h-1 w-full bg-ink-700">
                    <div
                      className="h-full"
                      style={{
                        width: `${values[i] * 100}%`,
                        background: isMax
                          ? "var(--accent-amber)"
                          : "var(--ink-100)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </aside>
  );
}

function sortValue(
  c: Country,
  key: SortKey,
  factionsById: Map<string, Faction>,
  credibilityByFaction: Map<string, number>,
): number | string {
  switch (key) {
    case "name":
      return c.name;
    case "alliance":
      return factionsById.get(c.faction_id)?.name ?? c.faction_id;
    case "alert_level":
      return c.military.alert_level;
    case "war_support":
      return c.public_opinion.war_support;
    case "stability_index":
      return c.government.stability_index;
    case "posture":
      return c.military.posture;
    case "credibility":
      return credibilityByFaction.get(c.faction_id) ?? -2;
  }
}
