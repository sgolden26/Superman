import { z } from "zod";

export const eventCategorySchema = z.enum([
  "protest",
  "military_loss",
  "economic_stress",
  "political_instability",
  "nationalist_sentiment",
]);
export type EventCategory = z.infer<typeof eventCategorySchema>;

export const moraleTrendSchema = z.enum(["rising", "steady", "declining"]);
export type MoraleTrend = z.infer<typeof moraleTrendSchema>;

export const intelEventSchema = z.object({
  id: z.string(),
  region_id: z.string(),
  ts: z.string(),
  category: eventCategorySchema,
  headline: z.string(),
  snippet: z.string().default(""),
  weight: z.number().min(-1).max(1),
  source: z.string(),
  url: z.string().url().optional(),
});
export type IntelEvent = z.infer<typeof intelEventSchema>;

export const driverSchema = z.object({
  category: eventCategorySchema,
  contribution: z.number(),
  headline: z.string(),
  event_id: z.string(),
});
export type Driver = z.infer<typeof driverSchema>;

export const regionIntelSchema = z.object({
  region_id: z.string(),
  morale_score: z.number().min(0).max(100),
  morale_trend: moraleTrendSchema,
  trend_delta: z.number(),
  history: z.array(z.number().min(0).max(100)),
  drivers: z.array(driverSchema),
  recent_events: z.array(intelEventSchema),
});
export type RegionIntel = z.infer<typeof regionIntelSchema>;

export const intelSnapshotSchema = z.object({
  intel_schema_version: z.string(),
  generated_at: z.string(),
  source: z.string(),
  tick_seq: z.number().int().nonnegative(),
  regions: z.array(regionIntelSchema),
});
export type IntelSnapshot = z.infer<typeof intelSnapshotSchema>;
