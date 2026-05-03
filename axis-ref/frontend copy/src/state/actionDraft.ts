import type { ScenarioSnapshot, Unit, MissileRange, IsrCoverage } from "@/types/scenario";
import type { PlayerTeam } from "@/state/playerTeam";
import type { SortieMissionDTO } from "@/types/orders";
import { haversineKm } from "@/map/geodesic";

/** Combat ranges (km). Mirror backend constants in `axis.sim.combat`. */
export const ENGAGE_RANGE_KM: Record<string, number> = {
  infantry_brigade: 18,
  armoured_brigade: 32,
  air_wing: 0,
  naval_task_group: 280,
};
export const AIR_SORTIE_RADIUS_KM = 600;
export const AIR_REBASE_RADIUS_KM = 1800;
export const NAVAL_MOVE_RADIUS_KM = 520;

/** What the candidate point on the map represents.  Maps 1:1 to StrikeTargetKindDTO
 *  for strike kinds; for non-strike drafts (rebase / naval move) it's a friendly
 *  destination asset rather than a hostile target. */
export type ActionDraftCandidateKind =
  | "unit"
  | "airfield"
  | "naval_base"
  | "depot"
  | "missile_range"
  | "supply_line";

export interface ActionDraftCandidate {
  candidateKind: ActionDraftCandidateKind;
  id: string;
  position: [number, number];
  name: string;
  /** Optional detail line shown next to the candidate in lists/HUDs. */
  hint?: string;
  /** Distance from draft origin, km. */
  distanceKm: number;
}

interface DraftBase {
  origin: [number, number];
  rangeKm: number;
  candidates: ActionDraftCandidate[];
  selectedCandidateId: string | null;
  /** When true, map clicks select candidates. False after Add-to-orders. */
  pickingTarget: boolean;
}

export interface EngageDraft extends DraftBase {
  kind: "engage";
  attackerId: string;
  attackerName: string;
}
export interface RebaseAirDraft extends DraftBase {
  kind: "rebase_air";
  unitId: string;
  unitName: string;
}
export interface AirSortieDraft extends DraftBase {
  kind: "air_sortie";
  unitId: string;
  unitName: string;
  mission: SortieMissionDTO;
}
export interface NavalMoveDraft extends DraftBase {
  kind: "naval_move";
  unitId: string;
  unitName: string;
}
export interface NavalStrikeDraft extends DraftBase {
  kind: "naval_strike";
  unitId: string;
  unitName: string;
}
export interface MissileStrikeDraft extends DraftBase {
  kind: "missile_strike";
  platformId: string;
  platformName: string;
}
export interface InterdictSupplyDraft extends DraftBase {
  kind: "interdict_supply";
  platformKind: "air_wing" | "missile_range";
  platformId: string;
  platformName: string;
}

export type ActionDraft =
  | EngageDraft
  | RebaseAirDraft
  | AirSortieDraft
  | NavalMoveDraft
  | NavalStrikeDraft
  | MissileStrikeDraft
  | InterdictSupplyDraft;

export type ActionDraftKind = ActionDraft["kind"];

/** Owner-key for the "one combat-affecting order per unit/platform" rule. Same
 *  scheme as `ownerKey` in state/orders.ts, used to pre-empt duplicate drafts. */
export function draftOwnerKey(draft: ActionDraft): string {
  switch (draft.kind) {
    case "engage":
      return `unit:${draft.attackerId}`;
    case "rebase_air":
    case "air_sortie":
    case "naval_move":
    case "naval_strike":
      return `unit:${draft.unitId}`;
    case "missile_strike":
    case "interdict_supply":
      return `platform:${draft.platformId}`;
  }
}

// ---------------------------------------------------------------------------
// Detection helpers (mirror backend rules, FE-side)
// ---------------------------------------------------------------------------

function bearingDeg(a: [number, number], b: [number, number]): number {
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const dlon = ((b[0] - a[0]) * Math.PI) / 180;
  const x = Math.sin(dlon) * Math.cos(lat2);
  const y =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dlon);
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
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

/** Detection rule (mirror backend `is_target_detected`):
 *  friendly-faction always detected, else within self_detect radius of attacker,
 *  else covered by any friendly ISR cone. */
export function isTargetDetected(
  scenario: ScenarioSnapshot,
  attackerFactionId: string,
  attackerPos: [number, number] | null,
  selfDetectRadiusKm: number,
  targetFactionId: string,
  targetPos: [number, number],
): boolean {
  if (targetFactionId === attackerFactionId) return true;
  if (sameAllegiance(scenario, attackerFactionId, targetFactionId)) return true;
  if (attackerPos && selfDetectRadiusKm > 0) {
    if (haversineKm(attackerPos, targetPos) <= selfDetectRadiusKm) return true;
  }
  const friendlyIsr = scenario.isr_coverages.filter((c) =>
    sameAllegiance(scenario, attackerFactionId, c.faction_id),
  );
  return coveredByIsr(targetPos, friendlyIsr);
}

function sameAllegiance(scenario: ScenarioSnapshot, a: string, b: string): boolean {
  if (a === b) return true;
  const fa = scenario.factions.find((f) => f.id === a);
  const fb = scenario.factions.find((f) => f.id === b);
  if (!fa || !fb || fa.allegiance === "neutral") return false;
  return fa.allegiance === fb.allegiance;
}

function isHostile(scenario: ScenarioSnapshot, a: string, b: string): boolean {
  if (a === b) return false;
  const fa = scenario.factions.find((f) => f.id === a);
  const fb = scenario.factions.find((f) => f.id === b);
  if (!fa || !fb) return false;
  if (fa.allegiance === "neutral" || fb.allegiance === "neutral") return false;
  return fa.allegiance !== fb.allegiance;
}

// ---------------------------------------------------------------------------
// Range / origin helpers
// ---------------------------------------------------------------------------

export function rangeForEngage(unit: Unit): number {
  return ENGAGE_RANGE_KM[unit.kind] ?? 18;
}

export function rangeForMissile(platform: MissileRange): number {
  return platform.range_km;
}

// ---------------------------------------------------------------------------
// Candidate computation
// ---------------------------------------------------------------------------

interface CandidateContext {
  scenario: ScenarioSnapshot;
  origin: [number, number];
  rangeKm: number;
  ownFactionId: string;
}

function within(ctx: CandidateContext, p: [number, number]): number | null {
  const d = haversineKm(ctx.origin, p);
  return d <= ctx.rangeKm * 1.05 ? d : null;
}

function addUnitCandidates(
  ctx: CandidateContext,
  out: ActionDraftCandidate[],
  filter: "hostile_detected" | "hostile_any",
  selfDetectKm: number,
): void {
  for (const u of ctx.scenario.units) {
    if (!isHostile(ctx.scenario, ctx.ownFactionId, u.faction_id)) continue;
    const d = within(ctx, u.position);
    if (d == null) continue;
    if (filter === "hostile_detected") {
      if (
        !isTargetDetected(
          ctx.scenario,
          ctx.ownFactionId,
          ctx.origin,
          selfDetectKm,
          u.faction_id,
          u.position,
        )
      ) {
        continue;
      }
    }
    out.push({
      candidateKind: "unit",
      id: u.id,
      position: [u.position[0], u.position[1]],
      name: u.name,
      hint: `${u.kind.replace("_", " ")}`,
      distanceKm: d,
    });
  }
}

function addStaticTargets(
  ctx: CandidateContext,
  out: ActionDraftCandidate[],
  selfDetectKm: number,
): void {
  const detect = (factionId: string, p: [number, number]) =>
    isTargetDetected(ctx.scenario, ctx.ownFactionId, ctx.origin, selfDetectKm, factionId, p);
  for (const a of ctx.scenario.airfields) {
    if (!isHostile(ctx.scenario, ctx.ownFactionId, a.faction_id)) continue;
    const d = within(ctx, a.position);
    if (d == null) continue;
    if (!detect(a.faction_id, a.position)) continue;
    out.push({
      candidateKind: "airfield", id: a.id,
      position: [a.position[0], a.position[1]], name: a.name,
      hint: `${a.runway_m} m`, distanceKm: d,
    });
  }
  for (const dpt of ctx.scenario.depots) {
    if (!isHostile(ctx.scenario, ctx.ownFactionId, dpt.faction_id)) continue;
    const d = within(ctx, dpt.position);
    if (d == null) continue;
    if (!detect(dpt.faction_id, dpt.position)) continue;
    out.push({
      candidateKind: "depot", id: dpt.id,
      position: [dpt.position[0], dpt.position[1]], name: dpt.name,
      hint: `fill ${(dpt.fill * 100).toFixed(0)}%`, distanceKm: d,
    });
  }
  for (const nb of ctx.scenario.naval_bases) {
    if (!isHostile(ctx.scenario, ctx.ownFactionId, nb.faction_id)) continue;
    const d = within(ctx, nb.position);
    if (d == null) continue;
    if (!detect(nb.faction_id, nb.position)) continue;
    out.push({
      candidateKind: "naval_base", id: nb.id,
      position: [nb.position[0], nb.position[1]], name: nb.name,
      hint: `piers ${nb.pier_count}`, distanceKm: d,
    });
  }
}

function supplyLineMidpoint(path: [number, number][]): [number, number] {
  if (path.length === 0) return [0, 0];
  if (path.length === 1) return [path[0][0], path[0][1]];
  if (path.length % 2 === 1) {
    const m = path[(path.length - 1) / 2];
    return [m[0], m[1]];
  }
  const a = path[path.length / 2 - 1];
  const b = path[path.length / 2];
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export interface DraftSpec {
  kind: ActionDraftKind;
  /** Provide one of the two for unit-originated drafts. */
  unitId?: string;
  /** For missile-platform-originated drafts. */
  platformId?: string;
  /** For interdict_supply, indicates which platform kind the order references. */
  platformKind?: "air_wing" | "missile_range";
  /** Sortie sub-kind. */
  mission?: SortieMissionDTO;
}

export interface BuildDraftResult {
  draft: ActionDraft;
  warning: string | null;
}

/** Build a draft (origin/range/candidates) for a given spec. Returns null when
 *  the spec doesn't match the scenario (e.g. unknown unit, wrong domain). */
export function buildActionDraft(
  scenario: ScenarioSnapshot,
  team: PlayerTeam,
  spec: DraftSpec,
): BuildDraftResult | null {
  switch (spec.kind) {
    case "engage": {
      const u = spec.unitId ? scenario.units.find((x) => x.id === spec.unitId) : null;
      if (!u || u.domain === "air") return null;
      if (!playerOwns(scenario, team, u.faction_id)) return null;
      const rangeKm = rangeForEngage(u);
      const ctx: CandidateContext = {
        scenario, origin: u.position, rangeKm, ownFactionId: u.faction_id,
      };
      const candidates: ActionDraftCandidate[] = [];
      addUnitCandidates(ctx, candidates, "hostile_detected", rangeKm);
      candidates.sort((a, b) => a.distanceKm - b.distanceKm);
      return {
        draft: {
          kind: "engage", attackerId: u.id, attackerName: u.name,
          origin: [u.position[0], u.position[1]], rangeKm,
          candidates, selectedCandidateId: null, pickingTarget: true,
        },
        warning: candidates.length === 0 ? "No hostile units detected in range." : null,
      };
    }
    case "rebase_air": {
      const u = spec.unitId ? scenario.units.find((x) => x.id === spec.unitId) : null;
      if (!u || u.domain !== "air") return null;
      if (!playerOwns(scenario, team, u.faction_id)) return null;
      const rangeKm = AIR_REBASE_RADIUS_KM;
      const candidates: ActionDraftCandidate[] = [];
      for (const a of scenario.airfields) {
        if (!sameAllegiance(scenario, u.faction_id, a.faction_id)) continue;
        if (a.id === u.home_base_id) continue;
        if (a.runway_m < 2000) continue;
        const d = haversineKm(u.position, a.position);
        if (d > rangeKm) continue;
        candidates.push({
          candidateKind: "airfield", id: a.id,
          position: [a.position[0], a.position[1]], name: a.name,
          hint: `runway ${a.runway_m} m`, distanceKm: d,
        });
      }
      candidates.sort((a, b) => a.distanceKm - b.distanceKm);
      return {
        draft: {
          kind: "rebase_air", unitId: u.id, unitName: u.name,
          origin: [u.position[0], u.position[1]], rangeKm,
          candidates, selectedCandidateId: null, pickingTarget: true,
        },
        warning: candidates.length === 0 ? "No friendly airfield within rebase range." : null,
      };
    }
    case "air_sortie": {
      const u = spec.unitId ? scenario.units.find((x) => x.id === spec.unitId) : null;
      const mission = spec.mission ?? "strike";
      if (!u || u.domain !== "air") return null;
      if (!playerOwns(scenario, team, u.faction_id)) return null;
      const rangeKm = AIR_SORTIE_RADIUS_KM;
      const ctx: CandidateContext = {
        scenario, origin: u.position, rangeKm, ownFactionId: u.faction_id,
      };
      const candidates: ActionDraftCandidate[] = [];
      if (mission === "strike") {
        addUnitCandidates(ctx, candidates, "hostile_detected", rangeKm);
        addStaticTargets(ctx, candidates, rangeKm);
      } else {
        for (const m of scenario.missile_ranges) {
          if (m.category !== "sam") continue;
          if (!isHostile(scenario, u.faction_id, m.faction_id)) continue;
          const d = haversineKm(u.position, m.origin);
          if (d > rangeKm) continue;
          candidates.push({
            candidateKind: "missile_range", id: m.id,
            position: [m.origin[0], m.origin[1]], name: m.name,
            hint: `${m.weapon} SAM`, distanceKm: d,
          });
        }
      }
      candidates.sort((a, b) => a.distanceKm - b.distanceKm);
      return {
        draft: {
          kind: "air_sortie", unitId: u.id, unitName: u.name, mission,
          origin: [u.position[0], u.position[1]], rangeKm,
          candidates, selectedCandidateId: null, pickingTarget: true,
        },
        warning:
          candidates.length === 0
            ? mission === "sead"
              ? "No hostile SAM platforms in sortie range."
              : "No detected hostile targets in sortie range."
            : null,
      };
    }
    case "naval_move": {
      const u = spec.unitId ? scenario.units.find((x) => x.id === spec.unitId) : null;
      if (!u || u.domain !== "naval") return null;
      if (!playerOwns(scenario, team, u.faction_id)) return null;
      const rangeKm = NAVAL_MOVE_RADIUS_KM;
      const candidates: ActionDraftCandidate[] = [];
      for (const b of scenario.naval_bases) {
        if (!sameAllegiance(scenario, u.faction_id, b.faction_id)) continue;
        const d = haversineKm(u.position, b.position);
        if (d > rangeKm) continue;
        candidates.push({
          candidateKind: "naval_base", id: b.id,
          position: [b.position[0], b.position[1]], name: b.name,
          hint: `piers ${b.pier_count}`, distanceKm: d,
        });
      }
      candidates.sort((a, b) => a.distanceKm - b.distanceKm);
      return {
        draft: {
          kind: "naval_move", unitId: u.id, unitName: u.name,
          origin: [u.position[0], u.position[1]], rangeKm,
          candidates, selectedCandidateId: null, pickingTarget: true,
        },
        warning: candidates.length === 0 ? "No friendly port within sailing range." : null,
      };
    }
    case "naval_strike": {
      const u = spec.unitId ? scenario.units.find((x) => x.id === spec.unitId) : null;
      if (!u || u.domain !== "naval") return null;
      if (!playerOwns(scenario, team, u.faction_id)) return null;
      const rangeKm = rangeForEngage(u);
      const ctx: CandidateContext = {
        scenario, origin: u.position, rangeKm, ownFactionId: u.faction_id,
      };
      const candidates: ActionDraftCandidate[] = [];
      addUnitCandidates(ctx, candidates, "hostile_detected", rangeKm);
      addStaticTargets(ctx, candidates, rangeKm);
      candidates.sort((a, b) => a.distanceKm - b.distanceKm);
      return {
        draft: {
          kind: "naval_strike", unitId: u.id, unitName: u.name,
          origin: [u.position[0], u.position[1]], rangeKm,
          candidates, selectedCandidateId: null, pickingTarget: true,
        },
        warning: candidates.length === 0 ? "No detected hostile targets in strike range." : null,
      };
    }
    case "missile_strike": {
      const m = spec.platformId
        ? scenario.missile_ranges.find((x) => x.id === spec.platformId)
        : null;
      if (!m || m.category === "sam") return null;
      if (!playerOwns(scenario, team, m.faction_id)) return null;
      const rangeKm = m.range_km;
      // Missile strike has no detection check on the backend (long-range fires at known assets).
      // Offer all hostile units + static military assets in range, regardless of ISR cover.
      const ctx: CandidateContext = {
        scenario, origin: m.origin, rangeKm, ownFactionId: m.faction_id,
      };
      const candidates: ActionDraftCandidate[] = [];
      for (const u of scenario.units) {
        if (!isHostile(scenario, m.faction_id, u.faction_id)) continue;
        const d = within(ctx, u.position);
        if (d == null) continue;
        candidates.push({
          candidateKind: "unit", id: u.id,
          position: [u.position[0], u.position[1]], name: u.name,
          hint: u.kind.replace("_", " "), distanceKm: d,
        });
      }
      for (const a of scenario.airfields) {
        if (!isHostile(scenario, m.faction_id, a.faction_id)) continue;
        const d = within(ctx, a.position);
        if (d == null) continue;
        candidates.push({
          candidateKind: "airfield", id: a.id,
          position: [a.position[0], a.position[1]], name: a.name,
          hint: `runway ${a.runway_m} m`, distanceKm: d,
        });
      }
      for (const dpt of scenario.depots) {
        if (!isHostile(scenario, m.faction_id, dpt.faction_id)) continue;
        const d = within(ctx, dpt.position);
        if (d == null) continue;
        candidates.push({
          candidateKind: "depot", id: dpt.id,
          position: [dpt.position[0], dpt.position[1]], name: dpt.name,
          hint: `fill ${(dpt.fill * 100).toFixed(0)}%`, distanceKm: d,
        });
      }
      for (const nb of scenario.naval_bases) {
        if (!isHostile(scenario, m.faction_id, nb.faction_id)) continue;
        const d = within(ctx, nb.position);
        if (d == null) continue;
        candidates.push({
          candidateKind: "naval_base", id: nb.id,
          position: [nb.position[0], nb.position[1]], name: nb.name,
          hint: `piers ${nb.pier_count}`, distanceKm: d,
        });
      }
      candidates.sort((a, b) => a.distanceKm - b.distanceKm);
      return {
        draft: {
          kind: "missile_strike", platformId: m.id, platformName: m.name,
          origin: [m.origin[0], m.origin[1]], rangeKm,
          candidates, selectedCandidateId: null, pickingTarget: true,
        },
        warning: candidates.length === 0 ? "No hostile target in missile range." : null,
      };
    }
    case "interdict_supply": {
      let origin: [number, number];
      let rangeKm: number;
      let ownFactionId: string;
      let platformName: string;
      let platformKind: "air_wing" | "missile_range";
      if (spec.platformKind === "air_wing") {
        const u = spec.platformId ? scenario.units.find((x) => x.id === spec.platformId) : null;
        if (!u || u.domain !== "air") return null;
        if (!playerOwns(scenario, team, u.faction_id)) return null;
        origin = [u.position[0], u.position[1]];
        rangeKm = AIR_SORTIE_RADIUS_KM;
        ownFactionId = u.faction_id;
        platformName = u.name;
        platformKind = "air_wing";
      } else if (spec.platformKind === "missile_range") {
        const m = spec.platformId
          ? scenario.missile_ranges.find((x) => x.id === spec.platformId)
          : null;
        if (!m || m.category === "sam") return null;
        if (!playerOwns(scenario, team, m.faction_id)) return null;
        origin = [m.origin[0], m.origin[1]];
        rangeKm = m.range_km;
        ownFactionId = m.faction_id;
        platformName = m.name;
        platformKind = "missile_range";
      } else {
        return null;
      }
      const candidates: ActionDraftCandidate[] = [];
      for (const s of scenario.supply_lines) {
        if (!isHostile(scenario, ownFactionId, s.faction_id)) continue;
        const mid = supplyLineMidpoint(s.path);
        const d = haversineKm(origin, mid);
        if (d > rangeKm * 1.05) continue;
        candidates.push({
          candidateKind: "supply_line", id: s.id,
          position: mid, name: s.name,
          hint: `${s.mode} · health ${(s.health * 100).toFixed(0)}%`,
          distanceKm: d,
        });
      }
      candidates.sort((a, b) => a.distanceKm - b.distanceKm);
      return {
        draft: {
          kind: "interdict_supply",
          platformKind, platformId: spec.platformId!, platformName,
          origin, rangeKm,
          candidates, selectedCandidateId: null, pickingTarget: true,
        },
        warning: candidates.length === 0 ? "No hostile supply line in range." : null,
      };
    }
  }
}

function playerOwns(scenario: ScenarioSnapshot, team: PlayerTeam, factionId: string): boolean {
  const f = scenario.factions.find((x) => x.id === factionId);
  return !!f && f.allegiance === team;
}

/** Find the candidate nearest to a click, within `snapKm`. */
export function snapToCandidate(
  candidates: ActionDraftCandidate[],
  click: [number, number],
  snapKm: number,
): ActionDraftCandidate | null {
  let best: ActionDraftCandidate | null = null;
  let bestKm = snapKm;
  for (const c of candidates) {
    const d = haversineKm(click, c.position);
    if (d <= bestKm) {
      best = c;
      bestKm = d;
    }
  }
  return best;
}
