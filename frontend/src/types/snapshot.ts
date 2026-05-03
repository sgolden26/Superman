import { z } from 'zod';

/** Subset of `state.json` consumed by the C2 map and summary panels. */
export const TheatreSnapshotSchema = z
  .object({
    schema_version: z.string(),
    scenario: z.object({
      id: z.string(),
      name: z.string(),
      classification: z.string(),
      clock: z.string(),
      bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    }),
    factions: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        allegiance: z.string(),
        color: z.string(),
      }),
    ),
    units: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        faction_id: z.string(),
        domain: z.string(),
        kind: z.string(),
        position: z.tuple([z.number(), z.number()]),
        callsign: z.string().optional(),
        echelon: z.string().optional(),
        strength: z.number().optional(),
        readiness: z.number().optional(),
      }),
    ),
  })
  .passthrough();

export type TheatreSnapshot = z.infer<typeof TheatreSnapshotSchema>;
