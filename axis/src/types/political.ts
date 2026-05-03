import { z } from "zod";

// ---------------------------------------------------------------------------
// Leader signals
// ---------------------------------------------------------------------------

export const leaderSignalTypeSchema = z.enum([
  "ultimatum",
  "commitment",
  "threat",
  "denial",
  "reassurance",
  "demand",
]);
export type LeaderSignalType = z.infer<typeof leaderSignalTypeSchema>;

export const leaderSignalSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  speaker_faction_id: z.string(),
  type: leaderSignalTypeSchema,
  severity: z.number().min(-1).max(1),
  text: z.string(),
  target_faction_id: z.string().nullable().optional(),
  region_id: z.string().nullable().optional(),
  cameo_code: z.string().nullable().optional(),
  goldstein: z.number().min(-10).max(10).nullable().optional(),
  source: z.string().default("stub"),
  source_url: z.string().nullable().optional(),
  turn: z.number().int().nullable().optional(),
});
export type LeaderSignal = z.infer<typeof leaderSignalSchema>;

// ---------------------------------------------------------------------------
// Pressure
// ---------------------------------------------------------------------------

export const regionPressureSchema = z.object({
  region_id: z.string(),
  intensity: z.number().min(0).max(1),
  drivers: z.array(z.string()).default([]),
});
export type RegionPressure = z.infer<typeof regionPressureSchema>;

export const factionPressureSchema = z.object({
  faction_id: z.string(),
  intensity: z.number().min(0).max(1),
  deadline_turn: z.number().int().nullable().optional(),
  drivers: z.array(z.string()).default([]),
  // NATO Wargaming Handbook (HQ SACT, 2023) Fig. 7: time-bound team goal
  // expressed as a verb phrase ending in its preposition ("...by" / "...through").
  // The HUD appends the live `T-N` countdown.
  team_goal: z.string().nullable().optional(),
});
export type FactionPressure = z.infer<typeof factionPressureSchema>;

export const pressureStateSchema = z.object({
  global_deadline_turn: z.number().int().nullable().optional(),
  factions: z.array(factionPressureSchema).default([]),
  regions: z.array(regionPressureSchema).default([]),
});
export type PressureState = z.infer<typeof pressureStateSchema>;

// ---------------------------------------------------------------------------
// Credibility
// ---------------------------------------------------------------------------

export const gapEventSchema = z.object({
  turn: z.number().int(),
  signal_severity: z.number().min(-1).max(1),
  action_severity: z.number().min(-1).max(1),
  gap: z.number().min(-2).max(2),
  source: z.string(),
  note: z.string().default(""),
});
export type GapEvent = z.infer<typeof gapEventSchema>;

export const credibilityTrackSchema = z.object({
  from_faction_id: z.string(),
  to_faction_id: z.string(),
  immediate: z.number().min(-1).max(1),
  resolve: z.number().min(-1).max(1),
  last_updated_turn: z.number().int().default(0),
  history: z.array(gapEventSchema).default([]),
});
export type CredibilityTrack = z.infer<typeof credibilityTrackSchema>;
