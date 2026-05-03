import type { ExplanationPayload } from "@/types/decision";
import type { RegionIntel } from "@/types/intel";
import type { PlayerTeam } from "@/state/playerTeam";

export interface ExplainRequest {
  actionId: string;
  team: PlayerTeam;
  region: RegionIntel;
}

/**
 * POST /api/decision/explain.
 *
 * The FE ships the live `RegionIntel` slice in the body so the backend's
 * explanation is deterministic with what the user is seeing on screen.
 */
export async function loadExplanation(
  req: ExplainRequest,
): Promise<ExplanationPayload> {
  const res = await fetch("/api/decision/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action_id: req.actionId,
      team: req.team,
      region_intel: req.region,
    }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { detail?: string };
      detail = body?.detail ?? "";
    } catch {
      // ignore
    }
    throw new Error(
      `POST /api/decision/explain failed: HTTP ${res.status}${detail ? ` - ${detail}` : ""}`,
    );
  }
  return (await res.json()) as ExplanationPayload;
}
