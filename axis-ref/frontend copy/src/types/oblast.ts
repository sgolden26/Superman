import { z } from "zod";

export const oblastSchema = z.object({
  id: z.string(),
  iso_3166_2: z.string(),
  name: z.string(),
  country_id: z.string(),
  faction_id: z.string(),
  capital_city_id: z.string().nullable().optional(),
  population: z.number().int().nonnegative(),
  area_km2: z.number().nonnegative(),
  control: z.number().min(0).max(1),
  contested: z.boolean(),
  morale: z.number().min(0).max(1),
  civil_unrest: z.number().min(0).max(1),
  refugees_outflow: z.number().int().nonnegative(),
  available_actions: z.array(z.string()).default([]),
  centroid: z.tuple([z.number(), z.number()]).nullable().optional(),
});
export type Oblast = z.infer<typeof oblastSchema>;
