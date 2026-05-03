import { z } from "zod";
import { eventCategorySchema } from "./intel";

export const actionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  base_rate: z.number().min(0).max(1),
  morale_weight: z.number(),
  trend_weight: z.number(),
  severity_weight: z.number(),
  category_sensitivities: z.record(eventCategorySchema, z.number()).default({}),
  pressure_aggression_bias: z.number().default(0),
  credibility_weight: z.number().default(0),
  wargame_note: z.string().default(""),
});
export type Action = z.infer<typeof actionSchema>;

export interface PoliticalContext {
  issuer_pressure?: number;
  issuer_deadline_turns_remaining?: number;
  bilateral_credibility_immediate?: number;
  bilateral_credibility_resolve?: number;
  issuer_faction_id?: string;
  target_faction_id?: string;
}

export type BreakdownKind = "base" | "modifier" | "category";

export type BreakdownSource =
  | "base"
  | "intel"
  | "pressure"
  | "credibility";

export interface BreakdownItem {
  label: string;
  kind: BreakdownKind;
  delta: number;
  /** Stable identifier the explain endpoint matches against. */
  key?: string;
  /** Drives grouping and emphasis in the Outcome card. */
  source?: BreakdownSource;
  /** Shown as tooltip / secondary line: micro-formula or provenance. */
  detail?: string;
}

export interface Outcome {
  action_id: string;
  region_id: string;
  probability: number;
  breakdown: BreakdownItem[];
  explanation: string;
}

// ---------------------------------------------------------------------------
// Explanation payload (POST /api/decision/explain)
// ---------------------------------------------------------------------------

export type ExplanationSourceKind =
  | "intel_event"
  | "leader_signal"
  | "action_catalog"
  | "scenario_assumption";

export interface ExplanationSource {
  label: string;
  url?: string | null;
  kind: ExplanationSourceKind;
  note?: string | null;
  // optional structured fields that the FE can render specially
  id?: string;
  category?: string;
  weight?: number;
  ts?: string;
  snippet?: string;
  type?: string;
  severity?: number;
  source?: string;
}

export interface ExplanationRowDataPolitical {
  issuer_faction_id?: string | null;
  issuer_faction_name?: string | null;
  target_faction_id?: string | null;
  target_faction_name?: string | null;
  intensity?: number;
  deadline_turn?: number | null;
  deadline_remaining?: number | null;
  current_turn?: number;
  pressure_drivers?: string[];
  aggression_bias?: number;
  immediate?: number;
  resolve?: number;
  credibility_weight?: number;
  gap_history?: Array<{
    turn: number;
    signal_severity: number;
    action_severity: number;
    gap: number;
    source: string;
    note: string;
  }>;
  recent_signals?: Array<{
    id: string;
    ts: string;
    type: string;
    severity: number;
    text: string;
    source: string;
    target_faction_id?: string;
    region_id?: string;
    source_url?: string;
    turn?: number;
  }>;
  wargame_note?: string;
}

export interface ExplanationRowDataIntel {
  morale_score?: number;
  morale_norm?: number;
  morale_weight?: number;
  morale_trend?: string;
  trend_delta?: number;
  trend_weight?: number;
  history?: number[];
  severity_sum?: number;
  severity_norm?: number;
  severity_weight?: number;
  category?: string;
  sensitivity?: number;
  drivers?: Array<{
    category: string;
    contribution: number;
    headline: string;
    event_id: string;
  }>;
  driver?: {
    category: string;
    contribution: number;
    headline: string;
    event_id: string;
  } | null;
}

export interface ExplanationRow {
  key: string;
  label: string;
  delta: number;
  kind: BreakdownKind;
  summary: string;
  math: string;
  sources: ExplanationSource[];
  disclaimer?: string | null;
  data?: ExplanationRowDataIntel & ExplanationRowDataPolitical;
}

export interface ExplanationPayload {
  action_id: string;
  region_id: string;
  region_name: string;
  issuer_team: "red" | "blue";
  issuer_faction_id: string | null;
  target_faction_id: string | null;
  action_note: string;
  action: { id: string; name: string; description: string };
  outcome: Outcome;
  rows: ExplanationRow[];
}
