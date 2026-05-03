import { z } from "zod";
import { actionSchema } from "./decision";
import { countrySchema } from "./country";
import { oblastSchema } from "./oblast";
import { frontlineSchema } from "./frontline";
import {
  airfieldSchema,
  aorSchema,
  borderCrossingSchema,
  depotSchema,
  isrCoverageSchema,
  missileRangeSchema,
  navalBaseSchema,
  supplyLineSchema,
} from "./military_assets";
import {
  credibilityTrackSchema,
  leaderSignalSchema,
  pressureStateSchema,
} from "./political";

export const allegianceSchema = z.enum(["blue", "red", "neutral"]);
export type Allegiance = z.infer<typeof allegianceSchema>;

export const unitDomainSchema = z.enum(["ground", "air", "naval"]);
export type UnitDomain = z.infer<typeof unitDomainSchema>;

export const unitKindSchema = z.enum([
  "infantry_brigade",
  "armoured_brigade",
  "air_wing",
  "naval_task_group",
]);
export type UnitKind = z.infer<typeof unitKindSchema>;

export const cityImportanceSchema = z.enum(["capital", "major", "minor"]);
export type CityImportance = z.infer<typeof cityImportanceSchema>;

const lonLat = z.tuple([z.number(), z.number()]);
const bbox = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const factionSchema = z.object({
  id: z.string(),
  name: z.string(),
  allegiance: allegianceSchema,
  color: z.string(),
});
export type Faction = z.infer<typeof factionSchema>;

export const citySchema = z.object({
  id: z.string(),
  name: z.string(),
  faction_id: z.string(),
  position: lonLat,
  population: z.number().nonnegative(),
  importance: cityImportanceSchema,
  infrastructure: z.array(z.string()).default([]),
  country_id: z.string().nullable().optional(),
});
export type City = z.infer<typeof citySchema>;

export const territorySchema = z.object({
  id: z.string(),
  name: z.string(),
  faction_id: z.string(),
  polygon: z.array(z.array(lonLat)),
  control: z.number().min(0).max(1),
  country_id: z.string().nullable().optional(),
});
export type Territory = z.infer<typeof territorySchema>;

export const unitSchema = z.object({
  id: z.string(),
  name: z.string(),
  faction_id: z.string(),
  domain: unitDomainSchema,
  kind: unitKindSchema,
  position: lonLat,
  strength: z.number().min(0).max(1),
  readiness: z.number().min(0).max(1),
  morale: z.number().min(0).max(1),
  entrenchment: z.number().min(0).max(1).default(0),
  echelon: z.string(),
  callsign: z.string(),
  country_id: z.string().nullable().optional(),
  home_base_id: z.string().nullable().optional(),
  available_actions: z.array(z.string()).default([]),
});
export type Unit = z.infer<typeof unitSchema>;

export const scenarioMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  classification: z.string(),
  clock: z.string(),
  bbox: bbox,
});
export type ScenarioMeta = z.infer<typeof scenarioMetaSchema>;

export const scenarioSnapshotSchema = z.object({
  schema_version: z.string(),
  scenario: scenarioMetaSchema,
  factions: z.array(factionSchema),
  countries: z.array(countrySchema).default([]),
  cities: z.array(citySchema),
  territories: z.array(territorySchema),
  oblasts: z.array(oblastSchema).default([]),
  units: z.array(unitSchema),
  depots: z.array(depotSchema).default([]),
  airfields: z.array(airfieldSchema).default([]),
  naval_bases: z.array(navalBaseSchema).default([]),
  border_crossings: z.array(borderCrossingSchema).default([]),
  supply_lines: z.array(supplyLineSchema).default([]),
  isr_coverages: z.array(isrCoverageSchema).default([]),
  missile_ranges: z.array(missileRangeSchema).default([]),
  aors: z.array(aorSchema).default([]),
  frontlines: z.array(frontlineSchema).default([]),
  current_turn: z.number().int().default(0),
  pressure: pressureStateSchema.default({ factions: [], regions: [] }),
  credibility: z.array(credibilityTrackSchema).default([]),
  leader_signals: z.array(leaderSignalSchema).default([]),
  actions: z.array(actionSchema).default([]),
});
export type ScenarioSnapshot = z.infer<typeof scenarioSnapshotSchema>;

export type SelectableKind =
  | "city"
  | "territory"
  | "unit"
  | "country"
  | "oblast"
  | "depot"
  | "airfield"
  | "naval_base"
  | "border_crossing"
  | "supply_line"
  | "isr_coverage"
  | "missile_range"
  | "aor"
  | "frontline";

export type Selection = { kind: SelectableKind; id: string } | null;

export type {
  Aor,
  Airfield,
  BorderCrossing,
  CrossingMode,
  Depot,
  IsrCoverage,
  IsrPlatform,
  MissileCategory,
  MissileRange,
  NavalBase,
  SupplyLine,
  SupplyLineMode,
} from "./military_assets";
export type { Frontline } from "./frontline";
export type { Oblast } from "./oblast";
export type { Country } from "./country";
export type {
  CredibilityTrack,
  FactionPressure,
  GapEvent,
  LeaderSignal,
  LeaderSignalType,
  PressureState,
  RegionPressure,
} from "./political";
