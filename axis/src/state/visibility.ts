import type {
  IsrCoverage,
  ScenarioSnapshot,
  Unit,
} from "@/types/scenario";
import type { PlayerTeam } from "@/state/playerTeam";
import type { AssetKind } from "@/map/layers/assetLayer";
import { haversineKm } from "@/map/geodesic";

/** Basic FoW + docking info derived from a scenario snapshot for a given
 *  player perspective. Pure helpers, no React. */

const SELF_DETECT_KM = 60;
const DOCK_RADIUS_KM = 6;

function bearingDeg(a: [number, number], b: [number, number]): number {
  const φ1 = (a[1] * Math.PI) / 180;
  const φ2 = (b[1] * Math.PI) / 180;
  const Δλ = ((b[0] - a[0]) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function angleWithinBeam(bearing: number, heading: number, beam: number): boolean {
  if (beam >= 359.999) return true;
  const diff = Math.abs(((bearing - heading + 540) % 360) - 180);
  return diff <= beam / 2;
}

function coveredByIsr(target: [number, number], cones: IsrCoverage[]): boolean {
  for (const c of cones) {
    if (haversineKm(c.origin, target) > c.range_km) continue;
    if (angleWithinBeam(bearingDeg(c.origin, target), c.heading_deg, c.beam_deg)) {
      return true;
    }
  }
  return false;
}

/** Returns the set of unit ids visible on the map for `team`'s perspective.
 *  Friendly + neutral units are always visible. Enemy units are visible iff
 *  covered by any friendly ISR cone or within `SELF_DETECT_KM` of any
 *  friendly unit. The currently selected unit is forced visible so it can
 *  still anchor the reticle when selected via OOB. */
export function computeVisibleUnitIds(
  scenario: ScenarioSnapshot,
  team: PlayerTeam,
  selectedUnitId?: string | null,
): Set<string> {
  const friendlyFactions = new Set(
    scenario.factions.filter((f) => f.allegiance === team).map((f) => f.id),
  );
  const friendlyUnits = scenario.units.filter((u) => friendlyFactions.has(u.faction_id));
  const friendlyIsr = scenario.isr_coverages.filter((c) =>
    friendlyFactions.has(c.faction_id),
  );

  const visible = new Set<string>();
  for (const u of scenario.units) {
    const isFriendly = friendlyFactions.has(u.faction_id);
    const isNeutral = !isFriendly && !isHostileFactionId(scenario, u.faction_id, team);
    if (isFriendly || isNeutral) {
      visible.add(u.id);
      continue;
    }
    if (selectedUnitId && u.id === selectedUnitId) {
      visible.add(u.id);
      continue;
    }
    if (coveredByIsr(u.position, friendlyIsr)) {
      visible.add(u.id);
      continue;
    }
    if (friendlyUnits.some((fu) => haversineKm(fu.position, u.position) <= SELF_DETECT_KM)) {
      visible.add(u.id);
    }
  }
  return visible;
}

function isHostileFactionId(
  scenario: ScenarioSnapshot,
  factionId: string,
  team: PlayerTeam,
): boolean {
  const f = scenario.factions.find((x) => x.id === factionId);
  if (!f) return false;
  if (f.allegiance === "neutral") return false;
  return f.allegiance !== team;
}

export interface DockingInfo {
  /** Unit -> asset it's docked at, with the asset kind for labelling. */
  unitToAsset: Map<string, { assetId: string; assetKind: AssetKind }>;
  /** Asset -> ordered list of docked unit ids (stable ordering by unit id). */
  assetToUnits: Map<string, string[]>;
}

/** A unit is "docked" at a friendly asset if either:
 *   1. its `home_base_id` matches the asset and they are co-located (<6km), or
 *   2. it sits within 6km of any compatible friendly asset (air -> airfield,
 *      naval -> naval_base).
 *  Ground units never dock for the purpose of this UI. */
export function computeDocking(scenario: ScenarioSnapshot): DockingInfo {
  const unitToAsset = new Map<string, { assetId: string; assetKind: AssetKind }>();
  const assetToUnits = new Map<string, string[]>();

  const factionAllegiance = new Map(scenario.factions.map((f) => [f.id, f.allegiance]));
  const sameSide = (a: string, b: string) => {
    if (a === b) return true;
    const aa = factionAllegiance.get(a);
    const bb = factionAllegiance.get(b);
    return !!aa && !!bb && aa === bb && aa !== "neutral";
  };

  for (const u of scenario.units) {
    if (u.domain === "ground") continue;
    const fleet = u.domain === "air" ? scenario.airfields : scenario.naval_bases;
    const kind: AssetKind = u.domain === "air" ? "airfield" : "naval_base";

    let chosenId: string | null = null;
    if (u.home_base_id) {
      const home = fleet.find((a) => a.id === u.home_base_id);
      if (home && haversineKm(home.position, u.position) <= DOCK_RADIUS_KM) {
        chosenId = home.id;
      }
    }
    if (chosenId === null) {
      let best: { id: string; dist: number } | null = null;
      for (const a of fleet) {
        if (!sameSide(a.faction_id, u.faction_id)) continue;
        const d = haversineKm(a.position, u.position);
        if (d > DOCK_RADIUS_KM) continue;
        if (!best || d < best.dist) best = { id: a.id, dist: d };
      }
      if (best) chosenId = best.id;
    }
    if (chosenId !== null) {
      unitToAsset.set(u.id, { assetId: chosenId, assetKind: kind });
      const list = assetToUnits.get(chosenId) ?? [];
      list.push(u.id);
      assetToUnits.set(chosenId, list);
    }
  }
  for (const list of assetToUnits.values()) list.sort();
  return { unitToAsset, assetToUnits };
}

/** Convenience: compute the units we should NOT render on the map (because
 *  they are docked at an asset; the asset's dock badge represents them). */
export function dockedUnitIds(scenario: ScenarioSnapshot): Set<string> {
  return new Set(computeDocking(scenario).unitToAsset.keys());
}

/** Filter units down to what should appear on the map for `team`. Combines
 *  FoW + docking. Unused at present (we apply both filters separately in
 *  `MapView`) but exported for convenience. */
export function mapVisibleUnits(
  scenario: ScenarioSnapshot,
  team: PlayerTeam,
  selectedUnitId?: string | null,
): Unit[] {
  const visible = computeVisibleUnitIds(scenario, team, selectedUnitId);
  const docked = dockedUnitIds(scenario);
  return scenario.units.filter((u) => visible.has(u.id) && !docked.has(u.id));
}
