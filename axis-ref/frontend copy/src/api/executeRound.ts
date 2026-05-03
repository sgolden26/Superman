import {
  roundExecutionResultSchema,
  type RoundExecuteRequestDTO,
  type RoundExecutionResultDTO,
} from "@/types/orders";

/** POST a multi-team round to the live theatre service.
 *
 *  Throws on transport failure. Returns a `RoundExecutionResultDTO` whose
 *  `ok=false` carries per-team validation outcomes when any batch was
 *  rejected (the theatre is left untouched in that case).
 */
export async function executeRound(
  payload: RoundExecuteRequestDTO,
  url = "/api/orders/execute_round",
): Promise<RoundExecutionResultDTO> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (json as { detail?: string }).detail ?? `HTTP ${res.status}`;
    throw new Error(`executeRound failed: ${detail}`);
  }
  const parsed = roundExecutionResultSchema.safeParse(json);
  if (!parsed.success) {
    console.error("[orders] round result schema mismatch", parsed.error.issues);
    throw new Error("Round execution response failed schema validation.");
  }
  return parsed.data;
}
