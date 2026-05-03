import type { PlayerTeam } from "@/state/playerTeam";
import type { StagedOrder } from "@/state/orders";
import type { ScenarioSnapshot } from "@/types/scenario";
import type { OrderOutcomeDTO } from "@/types/orders";

/** Phased execution replay. The pill at top-centre walks the user through:
 *  moves -> strikes (with arc + impact pulse) -> reports (persistent damage
 *  chips). The first two phases auto-advance; reports waits for the user.
 */
export type ReplayPhase = "moves" | "strikes" | "reports";

export interface ReplayMoveEvent {
  kind: "move";
  unitId: string;
  domain: "ground" | "air" | "naval";
  from: [number, number];
  to: [number, number];
  team: PlayerTeam;
}

export interface ReplayEngageEvent {
  kind: "engage";
  orderId: string;
  attackerId: string;
  defenderId: string;
  attackerName: string;
  defenderName: string;
  origin: [number, number];
  /** Defender position at order time (we anchor the impact + chip here). */
  target: [number, number];
  attackerStrengthLoss: number;
  defenderStrengthLoss: number;
  attackerMoraleLoss: number;
  defenderMoraleLoss: number;
  defenderRetreated: boolean;
  team: PlayerTeam;
}

export interface ReplayStrikeEvent {
  kind: "strike";
  orderId: string;
  /** What launched the strike (for chip annotation only). */
  attackerLabel: string;
  origin: [number, number];
  target: [number, number];
  targetLabel: string;
  /** "air_strike" | "air_sead" | "naval_strike" | "missile" | "interdict". */
  variety: string;
  hit: boolean;
  intercepted: boolean;
  damage: number;
  attackerLoss: number;
  team: PlayerTeam;
}

export type ReplayEvent = ReplayMoveEvent | ReplayEngageEvent | ReplayStrikeEvent;

/** Convert outcomes + the staged-orders we just submitted into a flat list of
 *  replay events. Failed outcomes are skipped (the round either succeeded or
 *  was rejected wholesale, but we guard anyway). Engage defender positions
 *  come from the *pre-execute* scenario snapshot. */
export function buildReplayEvents(
  scenarioBefore: ScenarioSnapshot,
  orders: StagedOrder[],
  outcomesByTeam: Partial<Record<PlayerTeam, OrderOutcomeDTO[]>>,
): ReplayEvent[] {
  const outcomeById = new Map<string, OrderOutcomeDTO>();
  for (const team of Object.keys(outcomesByTeam) as PlayerTeam[]) {
    for (const o of outcomesByTeam[team] ?? []) outcomeById.set(o.order_id, o);
  }
  const unitById = new Map(scenarioBefore.units.map((u) => [u.id, u]));

  const events: ReplayEvent[] = [];
  for (const order of orders) {
    const outcome = outcomeById.get(order.id);
    if (!outcome || !outcome.ok) continue;

    switch (order.kind) {
      case "move":
        events.push({
          kind: "move", unitId: order.unitId, domain: "ground",
          from: order.origin, to: order.destination, team: order.team,
        });
        break;
      case "naval_move":
        events.push({
          kind: "move", unitId: order.unitId, domain: "naval",
          from: order.origin, to: order.destination, team: order.team,
        });
        break;
      case "rebase_air":
        events.push({
          kind: "move", unitId: order.unitId, domain: "air",
          from: order.origin, to: order.destination, team: order.team,
        });
        break;
      case "engage": {
        const defender = unitById.get(order.targetId);
        const attacker = unitById.get(order.attackerId);
        if (!defender || !attacker) break;
        const d = outcome.details as Record<string, unknown>;
        events.push({
          kind: "engage",
          orderId: order.id,
          attackerId: order.attackerId,
          defenderId: order.targetId,
          attackerName: order.attackerName,
          defenderName: order.targetName,
          origin: [attacker.position[0], attacker.position[1]],
          target: [defender.position[0], defender.position[1]],
          attackerStrengthLoss: numOrZero(d.attacker_strength_loss),
          defenderStrengthLoss: numOrZero(d.defender_strength_loss),
          attackerMoraleLoss: numOrZero(d.attacker_morale_loss),
          defenderMoraleLoss: numOrZero(d.defender_morale_loss),
          defenderRetreated: !!d.defender_retreated,
          team: order.team,
        });
        break;
      }
      case "air_sortie": {
        const d = outcome.details as Record<string, unknown>;
        events.push({
          kind: "strike", orderId: order.id,
          attackerLabel: order.unitName,
          origin: order.origin, target: order.targetPos,
          targetLabel: order.targetName,
          variety: order.mission === "sead" ? "air_sead" : "air_strike",
          hit: !!d.hit, intercepted: !!d.intercepted,
          damage: numOrZero(d.damage),
          attackerLoss: numOrZero(d.attacker_loss),
          team: order.team,
        });
        break;
      }
      case "naval_strike": {
        const d = outcome.details as Record<string, unknown>;
        events.push({
          kind: "strike", orderId: order.id,
          attackerLabel: order.unitName,
          origin: order.origin, target: order.targetPos,
          targetLabel: order.targetName,
          variety: "naval_strike",
          hit: !!d.hit, intercepted: !!d.intercepted,
          damage: numOrZero(d.damage),
          attackerLoss: numOrZero(d.attacker_loss),
          team: order.team,
        });
        break;
      }
      case "missile_strike": {
        const d = outcome.details as Record<string, unknown>;
        events.push({
          kind: "strike", orderId: order.id,
          attackerLabel: order.platformName,
          origin: order.origin, target: order.targetPos,
          targetLabel: order.targetName,
          variety: "missile",
          hit: !!d.hit, intercepted: !!d.intercepted,
          damage: numOrZero(d.damage),
          attackerLoss: numOrZero(d.attacker_loss),
          team: order.team,
        });
        break;
      }
      case "interdict_supply": {
        const d = outcome.details as Record<string, unknown>;
        events.push({
          kind: "strike", orderId: order.id,
          attackerLabel: order.platformName,
          origin: order.origin, target: order.targetPos,
          targetLabel: order.supplyLineName,
          variety: "interdict",
          hit: !!d.hit, intercepted: !!d.intercepted,
          damage: numOrZero(d.damage),
          attackerLoss: numOrZero(d.attacker_loss),
          team: order.team,
        });
        break;
      }
      case "entrench":
      case "resupply":
        break;
    }
  }
  return events;
}

function numOrZero(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
