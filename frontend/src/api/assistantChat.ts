import { z } from "zod";
import { orderSchema, playerTeamSchema, type PlayerTeamDTO } from "@/types/orders";

/** Wire format for the C2 tool-calling assistant.
 *
 *  Sits behind `POST /api/assistant/chat`. The backend runs an OpenAI
 *  tool-calling loop and returns the full transcript: server tool results
 *  (`tool_calls`) plus a `directives` array of client-side actions the FE
 *  is expected to dispatch (`set_view`, `annotate_map`, `stage_orders`).
 */

export const credibilityDeltaSchema = z.object({
  from_faction_id: z.string(),
  to_faction_id: z.string(),
  immediate_before: z.number(),
  immediate_after: z.number(),
  immediate_delta: z.number(),
  resolve_before: z.number(),
  resolve_after: z.number(),
  resolve_delta: z.number(),
});
export type CredibilityDeltaDTO = z.infer<typeof credibilityDeltaSchema>;

export const pressureDeltaSchema = z.object({
  faction_id: z.string(),
  intensity_before: z.number(),
  intensity_after: z.number(),
  delta: z.number(),
});
export type PressureDeltaDTO = z.infer<typeof pressureDeltaSchema>;

export const implicationFactorSchema = z.object({
  label: z.string(),
  detail: z.string(),
  severity: z.enum(["info", "warn", "danger"]),
});
export type ImplicationFactorDTO = z.infer<typeof implicationFactorSchema>;

export const implicationsForecastSchema = z.object({
  issuer_team: playerTeamSchema,
  issuer_faction_id: z.string().nullable(),
  signal_severity: z.number(),
  action_severity: z.number(),
  gap: z.number(),
  credibility: z.array(credibilityDeltaSchema).default([]),
  pressure: z.array(pressureDeltaSchema).default([]),
  factors: z.array(implicationFactorSchema).default([]),
});
export type ImplicationsForecastDTO = z.infer<typeof implicationsForecastSchema>;

/** Loose JSON for tool arguments / results. We don't pretend to validate
 *  every shape; consumers branch on `name`. */
const looseJson = z.record(z.string(), z.unknown());

export const toolInvocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: looseJson.default({}),
  result: looseJson.default({}),
  is_directive: z.boolean().default(false),
});
export type ToolInvocationDTO = z.infer<typeof toolInvocationSchema>;

export const directiveSchema = z.object({
  name: z.string(),
  arguments: looseJson.default({}),
});
export type DirectiveDTO = z.infer<typeof directiveSchema>;

export const chatResultSchema = z.object({
  final_text: z.string().default(""),
  tool_calls: z.array(toolInvocationSchema).default([]),
  directives: z.array(directiveSchema).default([]),
  iterations: z.number().int().nonnegative().default(0),
  truncated: z.boolean().default(false),
});
export type ChatResultDTO = z.infer<typeof chatResultSchema>;

export interface AssistantChatRequest {
  prompt: string;
  issuer_team: PlayerTeamDTO;
  history?: unknown[];
}

/** POST an operator intent to the C2 assistant. Throws on transport / non-2xx. */
export async function assistantChat(
  payload: AssistantChatRequest,
  url = "/api/assistant/chat",
): Promise<ChatResultDTO> {
  const team = playerTeamSchema.parse(payload.issuer_team);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: payload.prompt,
      issuer_team: team,
      history: payload.history,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (json as { detail?: string }).detail ?? `HTTP ${res.status}`;
    throw new Error(detail);
  }
  const parsed = chatResultSchema.safeParse(json);
  if (!parsed.success) {
    console.error("[assistant] chat schema mismatch", parsed.error.issues);
    throw new Error("Assistant response failed validation.");
  }
  return parsed.data;
}

/** Helper: extract the latest implications forecast from a chat result, or
 *  null if the loop didn't call `forecast_implications`. */
export function forecastFromChat(
  result: ChatResultDTO,
): ImplicationsForecastDTO | null {
  for (let i = result.tool_calls.length - 1; i >= 0; i -= 1) {
    const tc = result.tool_calls[i];
    if (tc.name !== "forecast_implications") continue;
    const raw = (tc.result as { forecast?: unknown }).forecast;
    if (!raw) continue;
    const parsed = implicationsForecastSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
  }
  return null;
}

/** Helper: extract proposed orders from a chat result, when the assistant
 *  asked `propose_orders` but didn't follow up with `stage_orders`. */
export function proposedOrdersFromChat(result: ChatResultDTO) {
  for (let i = result.tool_calls.length - 1; i >= 0; i -= 1) {
    const tc = result.tool_calls[i];
    if (tc.name !== "propose_orders" && tc.name !== "forecast_implications") continue;
    const ordersRaw =
      (tc.result as { orders?: unknown; preview_orders?: unknown }).orders ??
      (tc.result as { preview_orders?: unknown }).preview_orders;
    if (!Array.isArray(ordersRaw)) continue;
    const parsed = z.array(orderSchema).safeParse(ordersRaw);
    if (parsed.success && parsed.data.length > 0) return parsed.data;
  }
  return [] as ReturnType<typeof orderSchema.parse>[];
}
