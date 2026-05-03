import { z } from "zod";

export const regimeTypeSchema = z.enum([
  "liberal_democracy",
  "illiberal_democracy",
  "hybrid",
  "authoritarian",
  "military_junta",
]);
export type RegimeType = z.infer<typeof regimeTypeSchema>;

export const militaryPostureSchema = z.enum([
  "defensive",
  "deterrent",
  "offensive",
  "expeditionary",
]);
export type MilitaryPosture = z.infer<typeof militaryPostureSchema>;

export const inventoryStatusSchema = z.enum([
  "operational",
  "limited",
  "reserve",
  "legacy",
]);
export type InventoryStatus = z.infer<typeof inventoryStatusSchema>;

export const nuclearStatusSchema = z.enum([
  "nws",
  "umbrella_host",
  "latent",
  "none",
]);
export type NuclearStatus = z.infer<typeof nuclearStatusSchema>;

export const relationStatusSchema = z.enum([
  "allied",
  "friendly",
  "neutral",
  "strained",
  "hostile",
  "at_war",
]);
export type RelationStatus = z.infer<typeof relationStatusSchema>;

const compositionSchema = z.object({
  label: z.string(),
  share: z.number().min(0).max(1),
});
export type Composition = z.infer<typeof compositionSchema>;

const cabinetMemberSchema = z.object({
  title: z.string(),
  name: z.string(),
});
export type CabinetMember = z.infer<typeof cabinetMemberSchema>;

const governmentSchema = z.object({
  regime_type: regimeTypeSchema,
  head_of_state: z.string(),
  head_of_government: z.string(),
  cabinet: z.array(cabinetMemberSchema).default([]),
  approval_rating: z.number().min(0).max(1),
  stability_index: z.number().min(0).max(1),
  last_election: z.string().nullable().optional(),
  next_election: z.string().nullable().optional(),
});
export type Government = z.infer<typeof governmentSchema>;

const inventoryLineSchema = z.object({
  category: z.string(),
  label: z.string(),
  count: z.number().int().nonnegative(),
  status: inventoryStatusSchema,
});
export type InventoryLine = z.infer<typeof inventoryLineSchema>;

const serviceBranchSchema = z.object({
  name: z.string(),
  personnel: z.number().int().nonnegative(),
  inventory: z.array(inventoryLineSchema).default([]),
});
export type ServiceBranch = z.infer<typeof serviceBranchSchema>;

const militarySchema = z.object({
  active_personnel: z.number().int().nonnegative(),
  reserve_personnel: z.number().int().nonnegative(),
  paramilitary: z.number().int().nonnegative(),
  branches: z.array(serviceBranchSchema).default([]),
  doctrine: z.string(),
  posture: militaryPostureSchema,
  alert_level: z.number().int().min(1).max(5),
  c2_nodes: z.array(z.string()).default([]),
});
export type Military = z.infer<typeof militarySchema>;

const nuclearSchema = z.object({
  status: nuclearStatusSchema,
  warheads: z.number().int().nonnegative(),
  delivery_systems: z.array(z.string()).default([]),
  declared_posture: z.string(),
  nfu: z.boolean().nullable(),
});
export type NuclearPosture = z.infer<typeof nuclearSchema>;

const demographicsSchema = z.object({
  population: z.number().int().nonnegative(),
  median_age: z.number().nonnegative(),
  urbanisation: z.number().min(0).max(1),
  ethnic_groups: z.array(compositionSchema).default([]),
  languages: z.array(compositionSchema).default([]),
  religions: z.array(compositionSchema).default([]),
});
export type Demographics = z.infer<typeof demographicsSchema>;

const treatySchema = z.object({
  name: z.string(),
  kind: z.string(),
  parties: z.array(z.string()).default([]),
  in_force: z.boolean(),
});
export type Treaty = z.infer<typeof treatySchema>;

const bilateralRelationSchema = z.object({
  other_country_id: z.string(),
  status: relationStatusSchema,
  score: z.number().min(-1).max(1),
});
export type BilateralRelation = z.infer<typeof bilateralRelationSchema>;

const diplomacySchema = z.object({
  alliance_memberships: z.array(z.string()).default([]),
  treaties: z.array(treatySchema).default([]),
  relations: z.array(bilateralRelationSchema).default([]),
});
export type Diplomacy = z.infer<typeof diplomacySchema>;

const energySchema = z.object({
  oil_dependence: z.number().min(0).max(1),
  gas_dependence: z.number().min(0).max(1),
  top_gas_supplier: z.string(),
  pipelines: z.array(z.string()).default([]),
  key_ports: z.array(z.string()).default([]),
  rail_gauge_mm: z.number().int().positive(),
  strategic_reserves_days: z.number().int().nonnegative(),
});
export type EnergyLogistics = z.infer<typeof energySchema>;

const publicOpinionSchema = z.object({
  war_support: z.number().min(0).max(1),
  institutional_trust: z.number().min(0).max(1),
  censorship_index: z.number().min(0).max(1),
  protest_intensity: z.number().min(0).max(1),
  top_outlets: z.array(z.string()).default([]),
});
export type PublicOpinion = z.infer<typeof publicOpinionSchema>;

const borderSchema = z.object({
  other: z.string(),
  length_km: z.number().int().nonnegative(),
});
export type Border = z.infer<typeof borderSchema>;

const keyBaseSchema = z.object({
  name: z.string(),
  kind: z.string(),
  lon: z.number(),
  lat: z.number(),
  owner_country_id: z.string(),
});
export type KeyBase = z.infer<typeof keyBaseSchema>;

const geographySchema = z.object({
  area_km2: z.number().int().nonnegative(),
  land_borders: z.array(borderSchema).default([]),
  key_bases: z.array(keyBaseSchema).default([]),
});
export type Geography = z.infer<typeof geographySchema>;

export const countrySchema = z.object({
  id: z.string(),
  iso_a2: z.string().length(2),
  iso_a3: z.string().length(3),
  name: z.string(),
  official_name: z.string(),
  faction_id: z.string(),
  flag_emoji: z.string(),
  capital_city_id: z.string().nullable().optional(),
  government: governmentSchema,
  military: militarySchema,
  nuclear: nuclearSchema,
  demographics: demographicsSchema,
  diplomacy: diplomacySchema,
  energy: energySchema,
  public_opinion: publicOpinionSchema,
  geography: geographySchema,
  available_actions: z.array(z.string()).default([]),
});
export type Country = z.infer<typeof countrySchema>;

/** Metrics that can shade the territory choropleth. */
export type ChoroplethMetric =
  | "war_support"
  | "alert_level"
  | "stability_index"
  | "approval_rating"
  | "protest_intensity"
  | "censorship_index"
  | "institutional_trust";

export const CHOROPLETH_METRICS: { id: ChoroplethMetric; label: string }[] = [
  { id: "war_support", label: "War support" },
  { id: "alert_level", label: "Alert level" },
  { id: "stability_index", label: "Stability" },
  { id: "approval_rating", label: "Govt approval" },
  { id: "protest_intensity", label: "Protest intensity" },
  { id: "censorship_index", label: "Censorship" },
  { id: "institutional_trust", label: "Institutional trust" },
];

/** Normalise a metric to 0..1 for shading. Higher = "better" for the holder. */
export function metricNormalised(country: Country, metric: ChoroplethMetric): number {
  switch (metric) {
    case "war_support":
      return country.public_opinion.war_support;
    case "alert_level":
      // 1..5 -> 0..1
      return (country.military.alert_level - 1) / 4;
    case "stability_index":
      return country.government.stability_index;
    case "approval_rating":
      return country.government.approval_rating;
    case "protest_intensity":
      return country.public_opinion.protest_intensity;
    case "censorship_index":
      return country.public_opinion.censorship_index;
    case "institutional_trust":
      return country.public_opinion.institutional_trust;
  }
}

/** Display label for a raw metric value (preserves units). */
export function metricDisplay(country: Country, metric: ChoroplethMetric): string {
  switch (metric) {
    case "alert_level":
      return `${country.military.alert_level} / 5`;
    default:
      return `${Math.round(metricNormalised(country, metric) * 100)}%`;
  }
}
