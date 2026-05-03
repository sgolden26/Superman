/**
 * POST /api/ai/design_scenario.
 *
 * Display-only LLM call: the backend never mutates the live theatre with the
 * returned envelope. We surface the result in the Prompt panel.
 */

export type PressureProfile = "stable" | "elevated" | "acute";
export type CredibilityProfile = "low_trust" | "fractious" | "cooperative_west";
export type ThirdPartyIntensity = "background" | "active" | "intervening";

export interface DesignScenarioKnobs {
  starting_pressure_profile?: PressureProfile;
  starting_credibility_profile?: CredibilityProfile;
  third_party_intensity?: ThirdPartyIntensity;
  global_deadline_turn?: number;
}

export interface DesignScenarioRequest {
  sponsor_problem_statement: string;
  knobs: DesignScenarioKnobs;
}

/**
 * Loose shape for the brief; exact field set is governed by the prompt MD.
 * We treat unknown fields as forward-compatible per the project convention.
 */
export interface DesignBrief {
  mode: string;
  problem_statement: string;
  aim: string;
  objectives: string[];
  desired_outcomes?: string;
  constraints?: string[];
  limitations?: string[];
  assumptions?: string[];
  concept_of_analysis?: {
    essential_questions?: string[];
    measures?: string[];
    data_collection?: string[];
  };
  bias_check_notes?: string;
  timeline_and_milestones?: string;
  schema_refs?: string[];
}

export interface InitialScenario {
  mode: "initial";
  turn_count?: number;
  global_deadline_turn?: number;
  current_turn?: number;
  contested_oblasts?: string[];
  faction_pressure?: Array<{
    faction_id: string;
    intensity: number;
    deadline_turn?: number | null;
    drivers?: string[];
  }>;
  region_pressure?: Array<{
    region_id: string;
    intensity: number;
    drivers?: string[];
  }>;
  credibility?: Array<{
    from_faction_id: string;
    to_faction_id: string;
    immediate: number;
    resolve: number;
    last_updated_turn?: number;
  }>;
  leader_signals?: Array<{
    id: string;
    speaker_faction_id: string;
    type: string;
    severity: number;
    text: string;
    target_faction_id?: string | null;
    region_id?: string | null;
    turn?: number;
  }>;
  opening_narrative?: string;
  victory_conditions?: Record<string, string>;
}

export interface DesignScenarioResponse {
  design_brief: DesignBrief;
  scenario: InitialScenario;
  out_of_scope?: string[];
  model?: string;
}

export async function designScenario(
  req: DesignScenarioRequest,
): Promise<DesignScenarioResponse> {
  const res = await fetch("/api/ai/design_scenario", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "initial",
      sponsor_problem_statement: req.sponsor_problem_statement,
      knobs: req.knobs,
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
      `POST /api/ai/design_scenario failed: HTTP ${res.status}${
        detail ? ` - ${detail}` : ""
      }`,
    );
  }
  return (await res.json()) as DesignScenarioResponse;
}
