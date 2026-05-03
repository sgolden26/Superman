import { z } from "zod";
import { scenarioSnapshotSchema } from "./scenario";

export const playerTeamSchema = z.enum(["red", "blue"]);
export type PlayerTeamDTO = z.infer<typeof playerTeamSchema>;

export const groundMoveModeSchema = z.enum(["foot", "vehicle"]);
export type GroundMoveModeDTO = z.infer<typeof groundMoveModeSchema>;

export const sortieMissionSchema = z.enum(["strike", "sead"]);
export type SortieMissionDTO = z.infer<typeof sortieMissionSchema>;

/** Target kinds the backend's `_resolve_strike_target` accepts. */
export const strikeTargetKindSchema = z.enum([
  "unit",
  "depot",
  "airfield",
  "naval_base",
  "missile_range",
  "supply_line",
  "city",
]);
export type StrikeTargetKindDTO = z.infer<typeof strikeTargetKindSchema>;

const lonLat = z.tuple([z.number(), z.number()]);

export const moveOrderSchema = z.object({
  order_id: z.string(),
  kind: z.literal("move"),
  issuer_team: playerTeamSchema.optional(),
  unit_id: z.string(),
  mode: groundMoveModeSchema,
  destination: lonLat,
});
export type MoveOrderDTO = z.infer<typeof moveOrderSchema>;

export const entrenchOrderSchema = z.object({
  order_id: z.string(),
  kind: z.literal("entrench"),
  issuer_team: playerTeamSchema.optional(),
  unit_id: z.string(),
});
export type EntrenchOrderDTO = z.infer<typeof entrenchOrderSchema>;

export const engageOrderSchema = z.object({
  order_id: z.string(),
  kind: z.literal("engage"),
  issuer_team: playerTeamSchema.optional(),
  attacker_id: z.string(),
  target_id: z.string(),
});
export type EngageOrderDTO = z.infer<typeof engageOrderSchema>;

export const rebaseAirOrderSchema = z.object({
  order_id: z.string(),
  kind: z.literal("rebase_air"),
  issuer_team: playerTeamSchema.optional(),
  unit_id: z.string(),
  airfield_id: z.string(),
});
export type RebaseAirOrderDTO = z.infer<typeof rebaseAirOrderSchema>;

export const airSortieOrderSchema = z.object({
  order_id: z.string(),
  kind: z.literal("air_sortie"),
  issuer_team: playerTeamSchema.optional(),
  unit_id: z.string(),
  mission: sortieMissionSchema,
  target_kind: strikeTargetKindSchema,
  target_id: z.string(),
});
export type AirSortieOrderDTO = z.infer<typeof airSortieOrderSchema>;

export const navalMoveOrderSchema = z.object({
  order_id: z.string(),
  kind: z.literal("naval_move"),
  issuer_team: playerTeamSchema.optional(),
  unit_id: z.string(),
  destination: lonLat,
});
export type NavalMoveOrderDTO = z.infer<typeof navalMoveOrderSchema>;

export const navalStrikeOrderSchema = z.object({
  order_id: z.string(),
  kind: z.literal("naval_strike"),
  issuer_team: playerTeamSchema.optional(),
  unit_id: z.string(),
  target_kind: strikeTargetKindSchema,
  target_id: z.string(),
});
export type NavalStrikeOrderDTO = z.infer<typeof navalStrikeOrderSchema>;

export const missileStrikeOrderSchema = z.object({
  order_id: z.string(),
  kind: z.literal("missile_strike"),
  issuer_team: playerTeamSchema.optional(),
  platform_id: z.string(),
  target_kind: strikeTargetKindSchema,
  target_id: z.string(),
});
export type MissileStrikeOrderDTO = z.infer<typeof missileStrikeOrderSchema>;

export const resupplyOrderSchema = z.object({
  order_id: z.string(),
  kind: z.literal("resupply"),
  issuer_team: playerTeamSchema.optional(),
  depot_id: z.string(),
  unit_id: z.string(),
});
export type ResupplyOrderDTO = z.infer<typeof resupplyOrderSchema>;

export const interdictSupplyOrderSchema = z.object({
  order_id: z.string(),
  kind: z.literal("interdict_supply"),
  issuer_team: playerTeamSchema.optional(),
  platform_kind: z.enum(["air_wing", "missile_range"]),
  platform_id: z.string(),
  supply_line_id: z.string(),
});
export type InterdictSupplyOrderDTO = z.infer<typeof interdictSupplyOrderSchema>;

/** Discriminated union; add new order kinds by extending this union. */
export const orderSchema = z.discriminatedUnion("kind", [
  moveOrderSchema,
  entrenchOrderSchema,
  engageOrderSchema,
  rebaseAirOrderSchema,
  airSortieOrderSchema,
  navalMoveOrderSchema,
  navalStrikeOrderSchema,
  missileStrikeOrderSchema,
  resupplyOrderSchema,
  interdictSupplyOrderSchema,
]);
export type OrderDTO = z.infer<typeof orderSchema>;

export const orderBatchSchema = z.object({
  issuer_team: playerTeamSchema,
  orders: z.array(orderSchema),
});
export type OrderBatchDTO = z.infer<typeof orderBatchSchema>;

export const orderOutcomeSchema = z.object({
  order_id: z.string(),
  ok: z.boolean(),
  message: z.string(),
  kind: z.string().default(""),
  details: z.record(z.string(), z.unknown()).default({}),
});
export type OrderOutcomeDTO = z.infer<typeof orderOutcomeSchema>;

export const executionResultSchema = z.object({
  ok: z.boolean(),
  outcomes: z.array(orderOutcomeSchema),
  political_summary: z.record(z.string(), z.record(z.string(), z.number())).default({}),
  snapshot: scenarioSnapshotSchema,
});
export type ExecutionResultDTO = z.infer<typeof executionResultSchema>;

export const roundExecuteRequestSchema = z.object({
  batches: z.array(orderBatchSchema).min(1),
});
export type RoundExecuteRequestDTO = z.infer<typeof roundExecuteRequestSchema>;

export const roundExecutionResultSchema = z.object({
  ok: z.boolean(),
  outcomes_by_team: z.record(playerTeamSchema, z.array(orderOutcomeSchema)).default({}),
  political_summary: z.record(z.string(), z.record(z.string(), z.number())).default({}),
  snapshot: scenarioSnapshotSchema,
});
export type RoundExecutionResultDTO = z.infer<typeof roundExecutionResultSchema>;
