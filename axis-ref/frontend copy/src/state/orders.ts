import type { GroundMoveMode } from "@/state/groundMove";
import type { PlayerTeam } from "@/state/playerTeam";
import type {
  OrderDTO,
  OrderBatchDTO,
  SortieMissionDTO,
  StrikeTargetKindDTO,
} from "@/types/orders";

/** Discriminated union of staged orders sitting in the per-team cart.
 *
 *  Add new order kinds by extending this union and adding a corresponding
 *  builder + DTO mapping. The cart UI uses `kind` to dispatch row rendering.
 */
export type StagedOrder =
  | StagedMoveOrder
  | StagedEntrenchOrder
  | StagedEngageOrder
  | StagedRebaseAirOrder
  | StagedAirSortieOrder
  | StagedNavalMoveOrder
  | StagedNavalStrikeOrder
  | StagedMissileStrikeOrder
  | StagedResupplyOrder
  | StagedInterdictSupplyOrder;

export type StagedOrderKind = StagedOrder["kind"];

/** Provenance tag for a staged order. "user" = hand-built via map-pick or
 *  sidebar; "llm" = injected by the AssistantBar's order suggester. The
 *  cart and on-map overlay key off this to render an AI badge / glow.
 *  Treated as "user" when absent so existing staging helpers stay terse. */
export type StagedOrderSource = "user" | "llm";

interface StagedBase {
  id: string;
  team: PlayerTeam;
  source?: StagedOrderSource;
}

/** Convenience: defaults absent `source` to `"user"`. */
export function stagedOrderSource(o: StagedOrder): StagedOrderSource {
  return o.source ?? "user";
}

export interface StagedMoveOrder extends StagedBase {
  kind: "move";
  unitId: string;
  mode: GroundMoveMode;
  origin: [number, number];
  destination: [number, number];
}

export interface StagedEntrenchOrder extends StagedBase {
  kind: "entrench";
  unitId: string;
  unitName: string;
}

export interface StagedEngageOrder extends StagedBase {
  kind: "engage";
  attackerId: string;
  attackerName: string;
  targetId: string;
  targetName: string;
  rangeKm: number;
}

export interface StagedRebaseAirOrder extends StagedBase {
  kind: "rebase_air";
  unitId: string;
  unitName: string;
  airfieldId: string;
  airfieldName: string;
  origin: [number, number];
  destination: [number, number];
}

export interface StagedAirSortieOrder extends StagedBase {
  kind: "air_sortie";
  unitId: string;
  unitName: string;
  mission: SortieMissionDTO;
  targetKind: StrikeTargetKindDTO;
  targetId: string;
  targetName: string;
  origin: [number, number];
  targetPos: [number, number];
}

export interface StagedNavalMoveOrder extends StagedBase {
  kind: "naval_move";
  unitId: string;
  unitName: string;
  origin: [number, number];
  destination: [number, number];
}

export interface StagedNavalStrikeOrder extends StagedBase {
  kind: "naval_strike";
  unitId: string;
  unitName: string;
  targetKind: StrikeTargetKindDTO;
  targetId: string;
  targetName: string;
  origin: [number, number];
  targetPos: [number, number];
}

export interface StagedMissileStrikeOrder extends StagedBase {
  kind: "missile_strike";
  platformId: string;
  platformName: string;
  targetKind: StrikeTargetKindDTO;
  targetId: string;
  targetName: string;
  origin: [number, number];
  targetPos: [number, number];
}

export interface StagedResupplyOrder extends StagedBase {
  kind: "resupply";
  depotId: string;
  depotName: string;
  unitId: string;
  unitName: string;
}

export interface StagedInterdictSupplyOrder extends StagedBase {
  kind: "interdict_supply";
  platformKind: "air_wing" | "missile_range";
  platformId: string;
  platformName: string;
  supplyLineId: string;
  supplyLineName: string;
  origin: [number, number];
  targetPos: [number, number];
}

let _seq = 0;
export function newOrderId(prefix = "ord"): string {
  _seq += 1;
  return `${prefix}.${Date.now().toString(36)}.${_seq}`;
}

export function stagedOrderToDto(order: StagedOrder): OrderDTO {
  switch (order.kind) {
    case "move":
      return {
        order_id: order.id, kind: "move", unit_id: order.unitId,
        mode: order.mode, destination: order.destination,
      };
    case "entrench":
      return { order_id: order.id, kind: "entrench", unit_id: order.unitId };
    case "engage":
      return {
        order_id: order.id, kind: "engage",
        attacker_id: order.attackerId, target_id: order.targetId,
      };
    case "rebase_air":
      return {
        order_id: order.id, kind: "rebase_air",
        unit_id: order.unitId, airfield_id: order.airfieldId,
      };
    case "air_sortie":
      return {
        order_id: order.id, kind: "air_sortie",
        unit_id: order.unitId, mission: order.mission,
        target_kind: order.targetKind, target_id: order.targetId,
      };
    case "naval_move":
      return {
        order_id: order.id, kind: "naval_move",
        unit_id: order.unitId, destination: order.destination,
      };
    case "naval_strike":
      return {
        order_id: order.id, kind: "naval_strike",
        unit_id: order.unitId,
        target_kind: order.targetKind, target_id: order.targetId,
      };
    case "missile_strike":
      return {
        order_id: order.id, kind: "missile_strike",
        platform_id: order.platformId,
        target_kind: order.targetKind, target_id: order.targetId,
      };
    case "resupply":
      return {
        order_id: order.id, kind: "resupply",
        depot_id: order.depotId, unit_id: order.unitId,
      };
    case "interdict_supply":
      return {
        order_id: order.id, kind: "interdict_supply",
        platform_kind: order.platformKind, platform_id: order.platformId,
        supply_line_id: order.supplyLineId,
      };
  }
}

export function batchFromStaged(
  team: PlayerTeam,
  orders: StagedOrder[],
): OrderBatchDTO {
  return { issuer_team: team, orders: orders.map(stagedOrderToDto) };
}

export function emptyTeamMap<T>(value: () => T): Record<PlayerTeam, T> {
  return { red: value(), blue: value() };
}

/** Stable per-unit identity for "one combat-affecting order per unit" rule. */
export function ownerKey(o: StagedOrder): string | null {
  switch (o.kind) {
    case "move":
    case "entrench":
    case "rebase_air":
    case "air_sortie":
    case "naval_move":
    case "naval_strike":
      return `unit:${o.unitId}`;
    case "engage":
      return `unit:${o.attackerId}`;
    case "resupply":
      return `unit:${o.unitId}`;
    case "missile_strike":
      return `platform:${o.platformId}`;
    case "interdict_supply":
      return `platform:${o.platformId}`;
  }
}
