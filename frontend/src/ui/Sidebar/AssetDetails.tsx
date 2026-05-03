import { useMemo } from "react";
import type {
  Airfield,
  Aor,
  BorderCrossing,
  Depot,
  Faction,
  Frontline,
  IsrCoverage,
  MissileRange,
  NavalBase,
  SupplyLine,
  Unit,
} from "@/types/scenario";
import { useAppStore } from "@/state/store";
import { isFactionControllableByPlayerTeam } from "@/state/playerTeam";
import { computeDocking } from "@/state/visibility";
import { SectionHeader } from "./primitives/SectionHeader";
import { KeyValueRow } from "./primitives/KeyValueRow";
import { FactionTag } from "./primitives/FactionTag";
import { MetricBar } from "./primitives/MetricBar";
import { ActionDraftPanel } from "./primitives/ActionDraftPanel";
import { ResupplyPicker } from "./primitives/ResupplyPicker";

function Header({
  kind,
  name,
  faction,
  id,
}: {
  kind: string;
  name: string;
  faction: Faction;
  id: string;
}) {
  const parts = kind.split(" · ");
  return (
    <div className="hairline-b px-4 pb-3 pt-4">
      <div className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
        {parts.map((p, i) => (
          <span key={i}>
            {i > 0 && <span className="px-1 text-ink-400">/</span>}
            {p}
          </span>
        ))}
      </div>
      <div className="mt-1 text-[18px] font-semibold leading-tight tracking-tight text-ink-50">
        {name}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <FactionTag faction={faction} />
        <span className="font-mono text-[10px] tracking-wider2 text-ink-300">
          {id}
        </span>
      </div>
    </div>
  );
}

function ActionList({ actions }: { actions: readonly string[] }) {
  if (actions.length === 0) return null;
  return (
    <>
      <SectionHeader label="available actions" trailing="stub" />
      <ul className="px-4 py-2 space-y-1">
        {actions.map((a) => (
          <li
            key={a}
            className="font-mono text-[11px] uppercase tracking-wider2 text-ink-200"
          >
            — {a.replace(/_/g, " ")}
          </li>
        ))}
      </ul>
    </>
  );
}

function Pos({ pos }: { pos: [number, number] }) {
  return (
    <KeyValueRow
      label="position"
      value={`${pos[1].toFixed(3)}°N  ${pos[0].toFixed(3)}°E`}
    />
  );
}

export function DepotDetail({ depot, faction }: { depot: Depot; faction: Faction }) {
  const playerTeam = useAppStore((s) => s.playerTeam);
  const playerOwns = isFactionControllableByPlayerTeam(faction, playerTeam);
  return (
    <div className="flex h-full flex-col">
      <Header kind="logistics depot" name={depot.name} faction={faction} id={depot.id} />
      <SectionHeader label="metadata" />
      <Pos pos={depot.position} />
      <SectionHeader label="metrics" />
      <MetricBar label="capacity" value={depot.capacity} />
      <MetricBar label="fill" value={depot.fill} />
      <SectionHeader label="orders" />
      {playerOwns ? (
        <div className="px-3 py-2">
          <div className="grid grid-cols-2 gap-1.5">
            <ResupplyPicker side="from_depot" depotId={depot.id} />
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
          · controlled by {faction.allegiance} team · switch sides to issue orders
        </div>
      )}
    </div>
  );
}

export function AirfieldDetail({
  airfield,
  faction,
}: {
  airfield: Airfield;
  faction: Faction;
}) {
  return (
    <div className="flex h-full flex-col">
      <Header
        kind={`airfield · ${airfield.role}`}
        name={airfield.name}
        faction={faction}
        id={airfield.id}
      />
      <SectionHeader label="metadata" />
      <Pos pos={airfield.position} />
      <KeyValueRow label="runway" value={`${airfield.runway_m.toLocaleString()} m`} />
      <KeyValueRow label="based aircraft" value={airfield.based_aircraft} />
      <DockedUnits assetId={airfield.id} hostFaction={faction} />
      <ActionList actions={airfield.available_actions} />
    </div>
  );
}

export function NavalDetail({
  base,
  faction,
}: {
  base: NavalBase;
  faction: Faction;
}) {
  return (
    <div className="flex h-full flex-col">
      <Header kind="naval base" name={base.name} faction={faction} id={base.id} />
      <SectionHeader label="metadata" />
      <Pos pos={base.position} />
      <KeyValueRow label="piers" value={base.pier_count} />
      {base.home_port_for.length > 0 && (
        <>
          <SectionHeader label="home port for" trailing={`${base.home_port_for.length}`} />
          <ul className="px-4 py-2 space-y-1">
            {base.home_port_for.map((u) => (
              <li
                key={u}
                className="font-mono text-[11px] uppercase tracking-wider2 text-ink-100"
              >
                {u}
              </li>
            ))}
          </ul>
        </>
      )}
      <DockedUnits assetId={base.id} hostFaction={faction} />
      <ActionList actions={base.available_actions} />
    </div>
  );
}

/** Lists units currently docked at the host asset (computed live from the
 *  scenario via `computeDocking`). Each row selects the unit so its standard
 *  `UnitDetail` panel surfaces with sortie / rebase / strike etc. Always
 *  rendered: for friendly assets the user gets at-a-glance access to their
 *  based aircraft / fleets; for enemy assets the same list doubles as a
 *  target picker (the dock badge already exposes the count). */
function DockedUnits({
  assetId,
  hostFaction,
}: {
  assetId: string;
  hostFaction: Faction;
}) {
  const scenario = useAppStore((s) => s.scenario);
  const select = useAppStore((s) => s.select);
  const playerTeam = useAppStore((s) => s.playerTeam);
  const docking = useMemo(
    () => (scenario ? computeDocking(scenario) : null),
    [scenario],
  );
  if (!scenario || !docking) return null;
  const ids = docking.assetToUnits.get(assetId) ?? [];
  if (ids.length === 0) return null;
  const unitById = new Map(scenario.units.map((u) => [u.id, u]));
  const factionsById = new Map(scenario.factions.map((f) => [f.id, f]));
  const units: Unit[] = ids
    .map((id) => unitById.get(id))
    .filter((u): u is Unit => !!u);
  const isHostile = !isFactionControllableByPlayerTeam(hostFaction, playerTeam)
    && hostFaction.allegiance !== "neutral";

  return (
    <>
      <SectionHeader
        label="docked units"
        trailing={isHostile ? `${units.length} · target` : `${units.length}`}
      />
      <ul className="space-y-1 px-3 py-2">
        {units.map((u) => {
          const f = factionsById.get(u.faction_id);
          return (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => select({ kind: "unit", id: u.id })}
                className="hairline w-full rounded-sm border border-ink-500 bg-ink-700/40 px-2 py-1 text-left transition-colors hover:border-ink-300"
              >
                <div className="flex items-center gap-1.5">
                  {f && <FactionTag faction={f} />}
                  <span className="truncate font-mono text-[11px] uppercase tracking-wider2 text-ink-100">
                    {u.name}
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
                  {u.domain} · str {Math.round(u.strength * 100)}% · rd{" "}
                  {Math.round(u.readiness * 100)}%
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function CrossingDetail({
  crossing,
  faction,
}: {
  crossing: BorderCrossing;
  faction: Faction;
}) {
  return (
    <div className="flex h-full flex-col">
      <Header
        kind={`border crossing · ${crossing.mode}`}
        name={crossing.name}
        faction={faction}
        id={crossing.id}
      />
      <SectionHeader label="metadata" />
      <Pos pos={crossing.position} />
      <KeyValueRow
        label="connects"
        value={`${crossing.countries[0]} ↔ ${crossing.countries[1]}`}
      />
      <KeyValueRow
        label="modes"
        value={[crossing.road ? "road" : null, crossing.rail ? "rail" : null]
          .filter(Boolean)
          .join(" · ") || "—"}
      />
      <ActionList actions={crossing.available_actions} />
    </div>
  );
}

export function SupplyDetail({
  supply,
  faction,
}: {
  supply: SupplyLine;
  faction: Faction;
}) {
  return (
    <div className="flex h-full flex-col">
      <Header
        kind={`supply line · ${supply.mode}`}
        name={supply.name}
        faction={faction}
        id={supply.id}
      />
      <SectionHeader label="metadata" />
      <KeyValueRow label="from" value={supply.from_id ?? "—"} />
      <KeyValueRow label="to" value={supply.to_id ?? "—"} />
      <KeyValueRow label="vertices" value={supply.path.length} />
      <SectionHeader label="metrics" />
      <MetricBar label="health" value={supply.health} />
      <ActionList actions={supply.available_actions} />
    </div>
  );
}

export function IsrDetail({
  isr,
  faction,
}: {
  isr: IsrCoverage;
  faction: Faction;
}) {
  return (
    <div className="flex h-full flex-col">
      <Header
        kind={`ISR · ${isr.platform}`}
        name={isr.name}
        faction={faction}
        id={isr.id}
      />
      <SectionHeader label="metadata" />
      <Pos pos={isr.origin} />
      <KeyValueRow label="range" value={`${isr.range_km.toLocaleString()} km`} />
      <KeyValueRow
        label="heading"
        value={isr.beam_deg >= 360 ? "omni" : `${Math.round(isr.heading_deg)}°`}
      />
      <KeyValueRow label="beam" value={`${Math.round(isr.beam_deg)}°`} />
      <SectionHeader label="metrics" />
      <MetricBar label="confidence" value={isr.confidence} />
      <ActionList actions={isr.available_actions} />
    </div>
  );
}

export function MissileDetail({
  missile,
  faction,
}: {
  missile: MissileRange;
  faction: Faction;
}) {
  const playerTeam = useAppStore((s) => s.playerTeam);
  const startActionDraft = useAppStore((s) => s.startActionDraft);
  const actionDraft = useAppStore((s) => s.actionDraft);
  const playerOwns = isFactionControllableByPlayerTeam(faction, playerTeam);
  const offensive = missile.category !== "sam";
  const draftHere =
    actionDraft &&
    "platformId" in actionDraft &&
    actionDraft.platformId === missile.id;

  return (
    <div className="flex h-full flex-col">
      <Header
        kind={`missile range · ${missile.category}`}
        name={missile.name}
        faction={faction}
        id={missile.id}
      />
      <SectionHeader label="metadata" />
      <Pos pos={missile.origin} />
      <KeyValueRow label="weapon" value={missile.weapon} />
      <KeyValueRow label="range" value={`${missile.range_km.toLocaleString()} km`} />
      <KeyValueRow
        label="heading"
        value={missile.beam_deg >= 360 ? "omni" : `${Math.round(missile.heading_deg)}°`}
      />
      <KeyValueRow label="beam" value={`${Math.round(missile.beam_deg)}°`} />

      <SectionHeader label="orders" />
      {!playerOwns ? (
        <div className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
          · controlled by {faction.allegiance} team · switch sides to issue orders
        </div>
      ) : !offensive ? (
        <div className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
          · SAM platforms are defensive only · they intercept hostile sorties automatically
        </div>
      ) : (
        <div className="px-3 py-2">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() =>
                startActionDraft({ kind: "missile_strike", platformId: missile.id })
              }
              title="Stand-off launch against a fixed asset or detected unit"
              className={btnClass(actionDraft?.kind === "missile_strike" && !!draftHere)}
            >
              Missile strike
            </button>
            <button
              type="button"
              onClick={() =>
                startActionDraft({
                  kind: "interdict_supply",
                  platformKind: "missile_range",
                  platformId: missile.id,
                })
              }
              title="Strike a hostile supply line"
              className={btnClass(
                actionDraft?.kind === "interdict_supply" && !!draftHere,
              )}
            >
              Interdict supply
            </button>
          </div>
        </div>
      )}

      {draftHere && actionDraft && <ActionDraftPanel draft={actionDraft} />}
    </div>
  );
}

function btnClass(active: boolean): string {
  return `border px-2 py-1.5 text-left font-mono text-[10px] uppercase tracking-wider2 transition-colors ${
    active
      ? "border-faction-nato/60 bg-faction-nato/10 text-faction-nato"
      : "border-[var(--hairline)] bg-ink-700/30 text-ink-100 hover:border-[var(--hairline-strong)] hover:bg-ink-700/60 hover:text-ink-50"
  }`;
}

export function AorDetail({
  aor,
  faction,
}: {
  aor: Aor;
  faction: Faction;
}) {
  return (
    <div className="flex h-full flex-col">
      <Header kind="area of responsibility" name={aor.name} faction={faction} id={aor.id} />
      <SectionHeader label="metadata" />
      <KeyValueRow label="formation" value={aor.formation_id ?? "—"} />
      <KeyValueRow label="rings" value={aor.polygon.length} />
      <ActionList actions={aor.available_actions} />
    </div>
  );
}

export function FrontlineDetail({ frontline }: { frontline: Frontline }) {
  return (
    <div className="flex h-full flex-col">
      <div className="hairline-b px-4 pb-3 pt-4">
        <div className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
          line of contact
        </div>
        <div className="mt-1 text-[18px] font-semibold leading-tight tracking-tight text-ink-50">
          {frontline.name}
        </div>
        <span className="font-mono text-[10px] tracking-wider2 text-ink-300">
          {frontline.id}
        </span>
      </div>
      <SectionHeader label="metadata" />
      <KeyValueRow label="vertices" value={frontline.path.length} />
      <KeyValueRow label="buffer" value={`${frontline.buffer_km} km`} />
      {frontline.updated_at && (
        <KeyValueRow label="updated" value={frontline.updated_at.slice(0, 10)} />
      )}
      {frontline.notes && (
        <>
          <SectionHeader label="notes" />
          <div className="px-4 py-3 font-mono text-[11px] leading-relaxed text-ink-100">
            {frontline.notes}
          </div>
        </>
      )}
      <ActionList actions={frontline.available_actions} />
    </div>
  );
}
