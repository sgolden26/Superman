import { useMemo, useState } from "react";
import type {
  Composition,
  Country,
  InventoryStatus,
  MilitaryPosture,
  NuclearStatus,
  RegimeType,
  RelationStatus,
} from "@/types/country";
import type { Faction } from "@/types/scenario";
import { useAppStore } from "@/state/store";
import { SectionHeader } from "./primitives/SectionHeader";
import { KeyValueRow } from "./primitives/KeyValueRow";
import { MetricBar } from "./primitives/MetricBar";
import { FactionTag } from "./primitives/FactionTag";
import { Tabs } from "./primitives/Tabs";

type TabId =
  | "overview"
  | "government"
  | "military"
  | "nuclear"
  | "demographics"
  | "diplomacy"
  | "energy"
  | "opinion"
  | "geography"
  | "actions";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "government", label: "Govt" },
  { id: "military", label: "Military" },
  { id: "nuclear", label: "Nuclear" },
  { id: "demographics", label: "Demographics" },
  { id: "diplomacy", label: "Diplomacy" },
  { id: "energy", label: "Energy" },
  { id: "opinion", label: "Opinion" },
  { id: "geography", label: "Geography" },
  { id: "actions", label: "Actions" },
];

const REGIME_LABEL: Record<RegimeType, string> = {
  liberal_democracy: "Liberal democracy",
  illiberal_democracy: "Illiberal democracy",
  hybrid: "Hybrid regime",
  authoritarian: "Authoritarian",
  military_junta: "Military junta",
};

const POSTURE_LABEL: Record<MilitaryPosture, string> = {
  defensive: "Defensive",
  deterrent: "Deterrent",
  offensive: "Offensive",
  expeditionary: "Expeditionary",
};

const NUCLEAR_LABEL: Record<NuclearStatus, string> = {
  nws: "Nuclear weapon state",
  umbrella_host: "Umbrella / host",
  latent: "Latent",
  none: "Non-nuclear",
};

const RELATION_LABEL: Record<RelationStatus, string> = {
  allied: "Allied",
  friendly: "Friendly",
  neutral: "Neutral",
  strained: "Strained",
  hostile: "Hostile",
  at_war: "At war",
};

const RELATION_TONE: Record<RelationStatus, string> = {
  allied: "var(--accent-ok)",
  friendly: "var(--accent-ok)",
  neutral: "var(--ink-100)",
  strained: "var(--accent-amber)",
  hostile: "var(--accent-danger)",
  at_war: "var(--accent-danger)",
};

const STATUS_LABEL: Record<InventoryStatus, string> = {
  operational: "OP",
  limited: "LTD",
  reserve: "RES",
  legacy: "LGC",
};

interface Props {
  country: Country;
  faction: Faction;
}

export function CountryDetail({ country, faction }: Props) {
  const [tab, setTab] = useState<TabId>("overview");
  const select = useAppStore((s) => s.select);
  const scenario = useAppStore((s) => s.scenario);

  const countryById = useMemo(() => {
    const m = new Map<string, Country>();
    for (const c of scenario?.countries ?? []) m.set(c.id, c);
    return m;
  }, [scenario]);

  return (
    <div className="flex h-full flex-col">
      <div className="hairline-b px-4 pb-3 pt-4">
        <div className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
          country dossier
          <span className="px-1 text-ink-400">/</span>
          {country.iso_a3}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl leading-none">{country.flag_emoji}</span>
          <span className="text-[18px] font-semibold leading-tight tracking-tight text-ink-50">
            {country.name}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-ink-200">{country.official_name}</div>
        <div className="mt-2 flex items-center gap-2">
          <FactionTag faction={faction} />
          <span className="font-mono text-[10px] tracking-wider2 text-ink-300">
            {country.id}
          </span>
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="flex-1 overflow-y-auto">
        {tab === "overview" && <Overview country={country} onSelectCity={(id) => select({ kind: "city", id })} />}
        {tab === "government" && <GovernmentTab country={country} />}
        {tab === "military" && <MilitaryTab country={country} />}
        {tab === "nuclear" && <NuclearTab country={country} />}
        {tab === "demographics" && <DemographicsTab country={country} />}
        {tab === "diplomacy" && (
          <DiplomacyTab
            country={country}
            countryById={countryById}
            onSelectCountry={(id) => select({ kind: "country", id })}
          />
        )}
        {tab === "energy" && <EnergyTab country={country} />}
        {tab === "opinion" && <OpinionTab country={country} />}
        {tab === "geography" && <GeographyTab country={country} countryById={countryById} />}
        {tab === "actions" && <ActionsTab country={country} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function Overview({
  country,
  onSelectCity,
}: {
  country: Country;
  onSelectCity: (cityId: string) => void;
}) {
  return (
    <div>
      <SectionHeader label="headline" />
      <KeyValueRow label="alliance" value={country.faction_id.toUpperCase()} />
      <KeyValueRow label="regime" value={REGIME_LABEL[country.government.regime_type]} mono={false} />
      <KeyValueRow
        label="population"
        value={country.demographics.population.toLocaleString("en-GB")}
      />
      <KeyValueRow
        label="area"
        value={`${country.geography.area_km2.toLocaleString("en-GB")} km²`}
      />
      <KeyValueRow label="alert level" value={`${country.military.alert_level} / 5`} />
      <KeyValueRow label="posture" value={POSTURE_LABEL[country.military.posture]} mono={false} />

      <SectionHeader label="capital" />
      {country.capital_city_id ? (
        <button
          onClick={() => onSelectCity(country.capital_city_id!)}
          className="flex w-full items-baseline justify-between px-4 py-2 text-left hover:bg-ink-700"
        >
          <span className="font-mono text-[11px] uppercase tracking-wider2 text-ink-100">
            {country.capital_city_id}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
            jump →
          </span>
        </button>
      ) : (
        <div className="px-4 py-2 font-mono text-[11px] text-ink-200">no capital recorded</div>
      )}

      <SectionHeader label="key metrics" />
      <MetricBar label="war support" value={country.public_opinion.war_support} />
      <MetricBar label="govt approval" value={country.government.approval_rating} />
      <MetricBar label="stability" value={country.government.stability_index} />
      <MetricBar
        label="institutional trust"
        value={country.public_opinion.institutional_trust}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Government
// ---------------------------------------------------------------------------

function GovernmentTab({ country }: { country: Country }) {
  const g = country.government;
  return (
    <div>
      <SectionHeader label="leadership" />
      <KeyValueRow label="regime type" value={REGIME_LABEL[g.regime_type]} mono={false} />
      <KeyValueRow label="head of state" value={g.head_of_state} mono={false} />
      <KeyValueRow label="head of govt" value={g.head_of_government} mono={false} />
      <KeyValueRow label="last election" value={g.last_election ?? "—"} />
      <KeyValueRow label="next election" value={g.next_election ?? "—"} />

      <SectionHeader label="cabinet" trailing={`${g.cabinet.length}`} />
      {g.cabinet.length === 0 ? (
        <Empty>cabinet not recorded</Empty>
      ) : (
        <ul className="px-4 py-2">
          {g.cabinet.map((m) => (
            <li
              key={m.title}
              className="flex items-baseline justify-between border-b border-ink-700/60 py-1.5 text-[11px]"
            >
              <span className="font-mono uppercase tracking-wider2 text-ink-200">
                {m.title}
              </span>
              <span className="text-ink-50">{m.name}</span>
            </li>
          ))}
        </ul>
      )}

      <SectionHeader label="indices" />
      <MetricBar label="approval" value={g.approval_rating} />
      <MetricBar label="stability" value={g.stability_index} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Military
// ---------------------------------------------------------------------------

function MilitaryTab({ country }: { country: Country }) {
  const m = country.military;
  return (
    <div>
      <SectionHeader label="posture" />
      <KeyValueRow label="posture" value={POSTURE_LABEL[m.posture]} mono={false} />
      <KeyValueRow label="alert level" value={`${m.alert_level} / 5`} />
      <div className="px-4 py-2">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className="h-2 flex-1"
              style={{
                background:
                  n <= m.alert_level ? "var(--accent-amber)" : "var(--ink-600, #2a2f3a)",
              }}
            />
          ))}
        </div>
      </div>

      <SectionHeader label="manpower" />
      <KeyValueRow
        label="active"
        value={m.active_personnel.toLocaleString("en-GB")}
      />
      <KeyValueRow
        label="reserves"
        value={m.reserve_personnel.toLocaleString("en-GB")}
      />
      <KeyValueRow
        label="paramilitary"
        value={m.paramilitary.toLocaleString("en-GB")}
      />

      <SectionHeader label="doctrine" />
      <div className="px-4 py-3 text-[11px] leading-relaxed text-ink-100">
        {m.doctrine}
      </div>

      <SectionHeader label="branches" trailing={`${m.branches.length}`} />
      <div className="px-2 py-1">
        {m.branches.map((b) => (
          <details
            key={b.name}
            className="hairline mb-2 border bg-ink-800/40"
          >
            <summary className="cursor-pointer list-none px-3 py-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-ink-50">{b.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
                  {b.personnel.toLocaleString("en-GB")}
                </span>
              </div>
            </summary>
            {b.inventory.length === 0 ? (
              <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
                inventory not reported
              </div>
            ) : (
              <ul className="px-3 py-2">
                {b.inventory.map((line) => (
                  <li
                    key={`${line.category}-${line.label}`}
                    className="grid grid-cols-[1fr_auto_auto] items-baseline gap-2 border-b border-ink-700/60 py-1 text-[11px]"
                  >
                    <span className="truncate text-ink-50">{line.label}</span>
                    <span className="font-mono text-ink-100">
                      {line.count.toLocaleString("en-GB")}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-wider2 text-ink-200">
                      {STATUS_LABEL[line.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </details>
        ))}
      </div>

      <SectionHeader label="c2 nodes" trailing={`${m.c2_nodes.length}`} />
      {m.c2_nodes.length === 0 ? (
        <Empty>none reported</Empty>
      ) : (
        <ul className="px-4 py-2">
          {m.c2_nodes.map((n) => (
            <li
              key={n}
              className="flex items-center gap-2 py-1 font-mono text-[11px] uppercase tracking-wider2 text-ink-50"
            >
              <span className="inline-block h-px w-3 bg-ink-300" />
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nuclear
// ---------------------------------------------------------------------------

function NuclearTab({ country }: { country: Country }) {
  const n = country.nuclear;
  return (
    <div>
      <SectionHeader label="status" />
      <KeyValueRow label="status" value={NUCLEAR_LABEL[n.status]} mono={false} />
      <KeyValueRow label="warheads" value={n.warheads.toLocaleString("en-GB")} />
      <KeyValueRow
        label="no first use"
        value={n.nfu === null ? "undeclared" : n.nfu ? "yes" : "no"}
      />

      <SectionHeader label="delivery systems" trailing={`${n.delivery_systems.length}`} />
      {n.delivery_systems.length === 0 ? (
        <Empty>none</Empty>
      ) : (
        <ul className="px-4 py-2">
          {n.delivery_systems.map((d) => (
            <li
              key={d}
              className="flex items-center gap-2 py-1 text-[11px] text-ink-50"
            >
              <span className="inline-block h-px w-3 bg-ink-300" />
              {d}
            </li>
          ))}
        </ul>
      )}

      <SectionHeader label="declared posture" />
      <div className="px-4 py-3 text-[11px] leading-relaxed text-ink-100">
        {n.declared_posture || "—"}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Demographics
// ---------------------------------------------------------------------------

function DemographicsTab({ country }: { country: Country }) {
  const d = country.demographics;
  return (
    <div>
      <SectionHeader label="headline" />
      <KeyValueRow
        label="population"
        value={d.population.toLocaleString("en-GB")}
      />
      <KeyValueRow label="median age" value={d.median_age.toFixed(1)} />
      <KeyValueRow
        label="urbanisation"
        value={`${(d.urbanisation * 100).toFixed(0)}%`}
      />

      <SectionHeader label="ethnic groups" />
      <CompositionBars items={d.ethnic_groups} />

      <SectionHeader label="languages" />
      <CompositionBars items={d.languages} />

      <SectionHeader label="religions" />
      <CompositionBars items={d.religions} />
    </div>
  );
}

function CompositionBars({ items }: { items: Composition[] }) {
  if (items.length === 0) return <Empty>not recorded</Empty>;
  return (
    <div className="px-4 py-2">
      <div className="flex h-2 w-full overflow-hidden bg-ink-700">
        {items.map((c, i) => (
          <span
            key={c.label}
            title={`${c.label} ${(c.share * 100).toFixed(1)}%`}
            style={{
              width: `${c.share * 100}%`,
              background: PALETTE[i % PALETTE.length],
            }}
          />
        ))}
      </div>
      <ul className="mt-2">
        {items.map((c, i) => (
          <li
            key={c.label}
            className="flex items-baseline justify-between py-0.5 text-[11px]"
          >
            <span className="flex items-center gap-2 text-ink-100">
              <span
                className="inline-block h-1.5 w-1.5"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              {c.label}
            </span>
            <span className="font-mono text-[10px] text-ink-200">
              {(c.share * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PALETTE = [
  "#5aa9ff",
  "#7ad492",
  "#d6a45a",
  "#c489f0",
  "#ff8b67",
  "#9aacc2",
  "#5fc7c1",
];

// ---------------------------------------------------------------------------
// Diplomacy
// ---------------------------------------------------------------------------

function DiplomacyTab({
  country,
  countryById,
  onSelectCountry,
}: {
  country: Country;
  countryById: Map<string, Country>;
  onSelectCountry: (id: string) => void;
}) {
  const d = country.diplomacy;
  return (
    <div>
      <SectionHeader label="alliance memberships" trailing={`${d.alliance_memberships.length}`} />
      {d.alliance_memberships.length === 0 ? (
        <Empty>none</Empty>
      ) : (
        <div className="flex flex-wrap gap-1.5 px-4 py-3">
          {d.alliance_memberships.map((m) => (
            <span
              key={m}
              className="hairline border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider2 text-ink-50"
            >
              {m}
            </span>
          ))}
        </div>
      )}

      <SectionHeader label="treaties" trailing={`${d.treaties.length}`} />
      <ul className="px-2 py-1">
        {d.treaties.map((t) => (
          <li
            key={t.name}
            className="hairline mb-1 border px-3 py-2"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-ink-50">{t.name}</span>
              <span className="font-mono text-[9px] uppercase tracking-wider2 text-ink-200">
                {t.kind}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-ink-200">
              <span>parties: {t.parties.join(", ") || "—"}</span>
              <span style={{ color: t.in_force ? "var(--accent-ok)" : "var(--ink-300)" }}>
                {t.in_force ? "in force" : "lapsed"}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <SectionHeader label="bilateral relations" trailing={`${d.relations.length}`} />
      <ul>
        {d.relations.map((r) => {
          const other = countryById.get(r.other_country_id);
          const known = other != null;
          const pct = Math.round(((r.score + 1) / 2) * 100);
          return (
            <li key={r.other_country_id} className="border-b border-ink-700/40">
              <button
                disabled={!known}
                onClick={() => known && onSelectCountry(r.other_country_id)}
                className={`flex w-full flex-col gap-1 px-4 py-2 text-left ${
                  known ? "hover:bg-ink-700" : "cursor-default opacity-70"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="flex items-center gap-2 text-[11px] text-ink-50">
                    {other?.flag_emoji}
                    <span>{other?.name ?? r.other_country_id.toUpperCase()}</span>
                  </span>
                  <span
                    className="font-mono text-[10px] uppercase tracking-wider2"
                    style={{ color: RELATION_TONE[r.status] }}
                  >
                    {RELATION_LABEL[r.status]} · {r.score >= 0 ? "+" : ""}
                    {r.score.toFixed(2)}
                  </span>
                </div>
                <div className="relative h-1 w-full bg-ink-700">
                  <span
                    className="absolute top-0 h-full"
                    style={{
                      left: r.score >= 0 ? "50%" : `${pct}%`,
                      width: `${Math.abs(r.score) * 50}%`,
                      background: RELATION_TONE[r.status],
                    }}
                  />
                  <span className="absolute left-1/2 top-0 h-full w-px bg-ink-400/60" />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Energy & logistics
// ---------------------------------------------------------------------------

function EnergyTab({ country }: { country: Country }) {
  const e = country.energy;
  return (
    <div>
      <SectionHeader label="dependence" />
      <MetricBar label="oil import share" value={e.oil_dependence} tone="warn" />
      <MetricBar label="gas import share" value={e.gas_dependence} tone="warn" />
      <KeyValueRow label="top gas supplier" value={e.top_gas_supplier} mono={false} />
      <KeyValueRow label="strategic reserves" value={`${e.strategic_reserves_days} days`} />

      <SectionHeader label="rail" />
      <KeyValueRow
        label="gauge"
        value={`${e.rail_gauge_mm} mm ${e.rail_gauge_mm === 1520 ? "(broad)" : "(standard)"}`}
      />

      <SectionHeader label="pipelines" trailing={`${e.pipelines.length}`} />
      {e.pipelines.length === 0 ? (
        <Empty>none</Empty>
      ) : (
        <ul className="px-4 py-2">
          {e.pipelines.map((p) => (
            <li
              key={p}
              className="flex items-center gap-2 py-1 text-[11px] text-ink-50"
            >
              <span className="inline-block h-px w-3 bg-ink-300" />
              {p}
            </li>
          ))}
        </ul>
      )}

      <SectionHeader label="key ports" trailing={`${e.key_ports.length}`} />
      {e.key_ports.length === 0 ? (
        <Empty>landlocked / none</Empty>
      ) : (
        <ul className="px-4 py-2">
          {e.key_ports.map((p) => (
            <li
              key={p}
              className="flex items-center gap-2 py-1 text-[11px] text-ink-50"
            >
              <span className="inline-block h-px w-3 bg-ink-300" />
              {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public opinion
// ---------------------------------------------------------------------------

function OpinionTab({ country }: { country: Country }) {
  const p = country.public_opinion;
  return (
    <div>
      <SectionHeader label="sentiment" />
      <MetricBar label="war support" value={p.war_support} />
      <MetricBar label="institutional trust" value={p.institutional_trust} />

      <SectionHeader label="pressure" />
      <MetricBar label="protest intensity" value={p.protest_intensity} tone="warn" />
      <MetricBar label="censorship index" value={p.censorship_index} tone="danger" />

      <SectionHeader label="top outlets" trailing={`${p.top_outlets.length}`} />
      {p.top_outlets.length === 0 ? (
        <Empty>none</Empty>
      ) : (
        <ul className="px-4 py-2">
          {p.top_outlets.map((o) => (
            <li
              key={o}
              className="flex items-center gap-2 py-1 text-[11px] text-ink-50"
            >
              <span className="inline-block h-px w-3 bg-ink-300" />
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------

function GeographyTab({
  country,
  countryById,
}: {
  country: Country;
  countryById: Map<string, Country>;
}) {
  const g = country.geography;
  return (
    <div>
      <SectionHeader label="footprint" />
      <KeyValueRow label="area" value={`${g.area_km2.toLocaleString("en-GB")} km²`} />

      <SectionHeader label="land borders" trailing={`${g.land_borders.length}`} />
      <ul className="px-4 py-2">
        {g.land_borders.map((b) => {
          const other = countryById.get(b.other);
          const label = other ? `${other.flag_emoji} ${other.name}` : b.other;
          return (
            <li
              key={`${b.other}-${b.length_km}`}
              className="flex items-baseline justify-between py-1 text-[11px]"
            >
              <span className="text-ink-100">{label}</span>
              <span className="font-mono text-ink-200">
                {b.length_km.toLocaleString("en-GB")} km
              </span>
            </li>
          );
        })}
      </ul>

      <SectionHeader label="key bases" trailing={`${g.key_bases.length}`} />
      <ul className="px-2 py-1">
        {g.key_bases.map((k) => (
          <li
            key={k.name}
            className="hairline mb-1 border px-3 py-2"
          >
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-ink-50">{k.name}</span>
              <span className="font-mono text-[9px] uppercase tracking-wider2 text-ink-200">
                {k.kind.replace(/_/g, " ")}
              </span>
            </div>
            <div className="mt-1 font-mono text-[10px] text-ink-200">
              {k.lat.toFixed(3)}°N {k.lon.toFixed(3)}°E
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function ActionsTab({ country }: { country: Country }) {
  return (
    <div>
      <SectionHeader label="available actions" trailing="stub" />
      <div className="px-3 py-2">
        <p className="mb-2 text-[11px] leading-relaxed text-ink-200">
          National-level affordances. Execution is not implemented in v1; these
          are wired in the schema so the simulation engine can dispatch them
          later.
        </p>
        <div className="grid grid-cols-1 gap-1.5">
          {country.available_actions.map((a) => (
            <button
              key={a}
              disabled
              title="stub - execution not implemented"
              className="hairline border px-3 py-1.5 text-left font-mono text-[11px] uppercase tracking-wider2 text-ink-200 opacity-70"
            >
              {a.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 font-mono text-[11px] text-ink-200">{children}</div>
  );
}
