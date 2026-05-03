import { useState } from "react";
import { useAppStore } from "@/state/store";
import type { ScenarioSnapshot } from "@/types/scenario";

type Side = "from_unit" | "from_depot";

interface Props {
  side: Side;
  /** When `side === "from_unit"`, this is the unit id requesting resupply. */
  unitId?: string;
  /** When `side === "from_depot"`, this is the source depot id. */
  depotId?: string;
}

/** Inline dropdown to stage a Resupply order from either a unit or a depot.
 *  Both directions emit the same order kind on the backend. We keep the UI
 *  minimal: scenario-wide friendly options sorted by distance from origin. */
export function ResupplyPicker({ side, unitId, depotId }: Props) {
  const [open, setOpen] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const scenario = useAppStore((s) => s.scenario);
  const playerTeam = useAppStore((s) => s.playerTeam);
  const stageResupply = useAppStore((s) => s.stageResupply);
  const setCartOpen = useAppStore((s) => s.setCartOpen);

  if (!scenario) return null;
  const candidates = computeCandidates(scenario, playerTeam, side, unitId, depotId);

  const onConfirm = () => {
    if (!pickedId) return;
    let depotIdFinal: string | null = null;
    let unitIdFinal: string | null = null;
    if (side === "from_unit") {
      depotIdFinal = pickedId;
      unitIdFinal = unitId ?? null;
    } else {
      depotIdFinal = depotId ?? null;
      unitIdFinal = pickedId;
    }
    if (!depotIdFinal || !unitIdFinal) return;
    stageResupply(depotIdFinal, unitIdFinal);
    setPickedId(null);
    setOpen(false);
    setCartOpen(true);
  };

  return (
    <div className="col-span-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={
          side === "from_unit"
            ? "Request a depot to push supplies to this unit"
            : "Push supplies from this depot to a friendly unit"
        }
        className={`w-full border px-2 py-1.5 text-left font-mono text-[10px] uppercase tracking-wider2 transition-colors ${
          open
            ? "border-faction-nato/60 bg-faction-nato/10 text-faction-nato"
            : "border-[var(--hairline)] bg-ink-700/30 text-ink-100 hover:border-[var(--hairline-strong)] hover:bg-ink-700/60 hover:text-ink-50"
        }`}
      >
        {side === "from_unit" ? "Request resupply" : "Resupply unit"}
      </button>

      {open && (
        <div className="hairline-t mt-1 flex flex-col gap-2 px-1 py-2">
          {candidates.length === 0 ? (
            <div className="font-mono text-[10px] text-ink-200">
              {side === "from_unit"
                ? "no friendly depot available"
                : "no friendly unit available"}
            </div>
          ) : (
            <ul className="max-h-40 overflow-y-auto border border-[var(--hairline)]">
              {candidates.map((c) => {
                const active = pickedId === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setPickedId(c.id)}
                      className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left transition-colors ${
                        active
                          ? "bg-faction-nato/10 text-faction-nato"
                          : "text-ink-100 hover:bg-ink-700/40"
                      }`}
                    >
                      <span className="truncate font-mono text-[11px]">{c.name}</span>
                      <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
                        {c.hint}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!pickedId}
              onClick={onConfirm}
              className="hairline border border-accent-ok bg-accent-ok/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider2 text-accent-ok transition-colors hover:bg-accent-ok/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent-ok/10"
            >
              Add to orders
            </button>
            <button
              type="button"
              onClick={() => {
                setPickedId(null);
                setOpen(false);
              }}
              className="hairline border border-ink-500 px-2 py-1 font-mono text-[9px] uppercase tracking-wider2 text-ink-200 transition-colors hover:border-ink-300 hover:text-ink-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface Cand {
  id: string;
  name: string;
  hint: string;
  distanceKm: number;
}

function computeCandidates(
  scenario: ScenarioSnapshot,
  playerTeam: "red" | "blue",
  side: Side,
  unitId: string | undefined,
  depotId: string | undefined,
): Cand[] {
  if (side === "from_unit") {
    const unit = unitId ? scenario.units.find((u) => u.id === unitId) : null;
    if (!unit) return [];
    const out: Cand[] = [];
    for (const d of scenario.depots) {
      if (!sameAllegiance(scenario, playerTeam, d.faction_id)) continue;
      const dist = haversine(unit.position, d.position);
      out.push({
        id: d.id, name: d.name,
        hint: `fill ${(d.fill * 100).toFixed(0)}% · ${dist.toFixed(0)} km`,
        distanceKm: dist,
      });
    }
    out.sort((a, b) => a.distanceKm - b.distanceKm);
    return out;
  }
  const depot = depotId ? scenario.depots.find((d) => d.id === depotId) : null;
  if (!depot) return [];
  const out: Cand[] = [];
  for (const u of scenario.units) {
    if (!sameAllegiance(scenario, playerTeam, u.faction_id)) continue;
    const dist = haversine(depot.position, u.position);
    out.push({
      id: u.id, name: u.name,
      hint: `${u.kind.replace("_", " ")} · ${dist.toFixed(0)} km`,
      distanceKm: dist,
    });
  }
  out.sort((a, b) => a.distanceKm - b.distanceKm);
  return out;
}

function sameAllegiance(
  scenario: ScenarioSnapshot,
  playerTeam: "red" | "blue",
  factionId: string,
): boolean {
  const f = scenario.factions.find((x) => x.id === factionId);
  return !!f && f.allegiance === playerTeam;
}

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const h = s1 * s1 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * s2 * s2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
