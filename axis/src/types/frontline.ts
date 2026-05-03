import { z } from "zod";

export const frontlineSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.array(z.tuple([z.number(), z.number()])),
  buffer_km: z.number().nonnegative(),
  notes: z.string().default(""),
  updated_at: z.string().nullable().optional(),
  available_actions: z.array(z.string()).default([]),
});
export type Frontline = z.infer<typeof frontlineSchema>;
