import { z } from "zod";
import {
  orderSchema,
  playerTeamSchema,
  type OrderDTO,
  type PlayerTeamDTO,
} from "@/types/orders";

/** A single applied LLM world edit. The discriminator is `kind`; the
 *  remaining fields differ per kind. We keep the schema permissive on
 *  unknown fields so backend additions don't break the FE. */
export const worldEditSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("spawn_missile_range"),
    id: z.string(),
    faction_id: z.string(),
    name: z.string(),
    position: z.tuple([z.number(), z.number()]),
    range_km: z.number(),
    category: z.string(),
    weapon: z.string(),
  }),
  z.object({
    kind: z.literal("spawn_unit"),
    id: z.string(),
    faction_id: z.string(),
    name: z.string(),
    unit_kind: z.string(),
    position: z.tuple([z.number(), z.number()]),
    strength: z.number(),
    readiness: z.number(),
    morale: z.number(),
  }),
]);
export type WorldEditDTO = z.infer<typeof worldEditSchema>;

export const suggestionResponseSchema = z.object({
  orders: z.array(orderSchema).default([]),
  edits: z.array(worldEditSchema).default([]),
  rationale: z.string().default(""),
  warnings: z.array(z.string()).default([]),
});
export type SuggestionResponseDTO = z.infer<typeof suggestionResponseSchema>;

export interface SuggestOrdersRequest {
  prompt: string;
  issuer_team: PlayerTeamDTO;
}

/** POST a free-form intent to the LLM order suggester.
 *
 *  Throws on transport / 4xx / 5xx errors. The 503 case (key missing or SDK
 *  not installed) surfaces with a readable backend `detail` message.
 */
export async function suggestOrders(
  payload: SuggestOrdersRequest,
  url = "/api/orders/suggest",
): Promise<SuggestionResponseDTO> {
  const team = playerTeamSchema.parse(payload.issuer_team);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: payload.prompt, issuer_team: team }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (json as { detail?: string }).detail ?? `HTTP ${res.status}`;
    throw new Error(detail);
  }
  const parsed = suggestionResponseSchema.safeParse(json);
  if (!parsed.success) {
    console.error("[assistant] suggest schema mismatch", parsed.error.issues);
    throw new Error("Assistant response failed schema validation.");
  }
  return parsed.data;
}

export type { OrderDTO };
