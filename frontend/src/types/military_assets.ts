import { z } from "zod";

const lonLat = z.tuple([z.number(), z.number()]);

const baseAsset = {
  id: z.string(),
  name: z.string(),
  faction_id: z.string(),
  country_id: z.string().nullable().optional(),
  available_actions: z.array(z.string()).default([]),
};

export const depotSchema = z.object({
  ...baseAsset,
  position: lonLat,
  capacity: z.number().min(0).max(1),
  fill: z.number().min(0).max(1),
});
export type Depot = z.infer<typeof depotSchema>;

export const airfieldSchema = z.object({
  ...baseAsset,
  position: lonLat,
  runway_m: z.number().int().nonnegative(),
  role: z.string(),
  based_aircraft: z.number().int().nonnegative(),
});
export type Airfield = z.infer<typeof airfieldSchema>;

export const navalBaseSchema = z.object({
  ...baseAsset,
  position: lonLat,
  pier_count: z.number().int().nonnegative(),
  home_port_for: z.array(z.string()).default([]),
});
export type NavalBase = z.infer<typeof navalBaseSchema>;

export const crossingModeSchema = z.enum(["open", "restricted", "closed"]);
export type CrossingMode = z.infer<typeof crossingModeSchema>;

export const borderCrossingSchema = z.object({
  id: z.string(),
  name: z.string(),
  faction_id: z.string(),
  position: lonLat,
  countries: z.tuple([z.string(), z.string()]),
  mode: crossingModeSchema,
  rail: z.boolean(),
  road: z.boolean(),
  available_actions: z.array(z.string()).default([]),
});
export type BorderCrossing = z.infer<typeof borderCrossingSchema>;

export const supplyLineModeSchema = z.enum(["road", "rail", "sea", "air"]);
export type SupplyLineMode = z.infer<typeof supplyLineModeSchema>;

export const supplyLineSchema = z.object({
  id: z.string(),
  name: z.string(),
  faction_id: z.string(),
  path: z.array(lonLat),
  health: z.number().min(0).max(1),
  mode: supplyLineModeSchema,
  from_id: z.string().nullable().optional(),
  to_id: z.string().nullable().optional(),
  available_actions: z.array(z.string()).default([]),
});
export type SupplyLine = z.infer<typeof supplyLineSchema>;

export const isrPlatformSchema = z.enum(["satellite", "uav", "awacs", "ground"]);
export type IsrPlatform = z.infer<typeof isrPlatformSchema>;

export const isrCoverageSchema = z.object({
  ...baseAsset,
  origin: lonLat,
  range_km: z.number().positive(),
  heading_deg: z.number(),
  beam_deg: z.number().positive().max(360),
  platform: isrPlatformSchema,
  confidence: z.number().min(0).max(1),
});
export type IsrCoverage = z.infer<typeof isrCoverageSchema>;

export const missileCategorySchema = z.enum([
  "sam",
  "cruise",
  "ballistic",
  "mlrs",
]);
export type MissileCategory = z.infer<typeof missileCategorySchema>;

export const missileRangeSchema = z.object({
  ...baseAsset,
  origin: lonLat,
  range_km: z.number().positive(),
  weapon: z.string(),
  category: missileCategorySchema,
  heading_deg: z.number(),
  beam_deg: z.number().positive().max(360),
});
export type MissileRange = z.infer<typeof missileRangeSchema>;

export const aorSchema = z.object({
  id: z.string(),
  name: z.string(),
  faction_id: z.string(),
  polygon: z.array(z.array(lonLat)),
  formation_id: z.string().nullable().optional(),
  country_id: z.string().nullable().optional(),
  available_actions: z.array(z.string()).default([]),
});
export type Aor = z.infer<typeof aorSchema>;
