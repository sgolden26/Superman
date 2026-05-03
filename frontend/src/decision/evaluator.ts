import type {
  Action,
  BreakdownItem,
  Outcome,
  PoliticalContext,
} from "@/types/decision";
import type { EventCategory, MoraleTrend, RegionIntel } from "@/types/intel";

export const SEVERITY_DIVISOR = 12.0;
export const CONTRIBUTION_DIVISOR = 8.0;
export const P_FLOOR = 0.05;
export const P_CEIL = 0.95;
export const SIGNIFICANT_DELTA = 0.015;
// Group-level scalars applied at evaluation time. Intel-side contributions
// (morale, trend, severity, category drivers) are dampened; political-side
// contributions (pressure, credibility) are amplified, so political context
// outweighs morale by roughly 3:1 in per-action max swing. The Python mirror
// in `backend/axis/decision/evaluator.py` MUST keep the same values.
export const MORALE_SCALE = 1 / 3;
export const POLITICAL_SCALE = 3.0;

const CATEGORY_PHRASE: Record<EventCategory, [negative: string, positive: string]> = {
  protest: ["protest activity", "protest activity"],
  military_loss: ["recent military setbacks", "improving military posture"],
  economic_stress: ["economic stress", "easing economic stress"],
  political_instability: ["political instability", "political stabilisation"],
  nationalist_sentiment: ["subdued nationalist sentiment", "rising nationalist sentiment"],
};

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function trendSigned(trend: MoraleTrend): number {
  if (trend === "rising") return 1;
  if (trend === "declining") return -1;
  return 0;
}

function moraleLabel(moraleNorm: number): string {
  if (moraleNorm >= 0.4) return "high morale";
  if (moraleNorm <= -0.4) return "low morale";
  return "neutral morale";
}

function categoryLabel(category: EventCategory, contribution: number): string {
  const [neg, pos] = CATEGORY_PHRASE[category] ?? [category, category];
  return contribution < 0 ? neg : pos;
}

function phraseFor(item: BreakdownItem): string {
  if (item.delta === 0) return "";
  const sign = item.delta < 0 ? "−" : "+";
  const pct = Math.round(Math.abs(item.delta) * 100);
  return `${item.label} (${sign}${pct}%)`;
}

function buildExplanation(
  action: Action,
  region: RegionIntel,
  probability: number,
  breakdown: BreakdownItem[],
): string {
  const modifiers = breakdown
    .filter((b) => b.kind !== "base")
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 2);
  const pct = Math.round(probability * 100);
  const basePct = Math.round(action.base_rate * 100);
  if (modifiers.length === 0) {
    return `${action.name} in ${region.region_id}: ${pct}% (baseline).`;
  }
  let direction: string;
  if (Math.abs(probability - action.base_rate) < 0.005) direction = "Held at";
  else direction = probability < action.base_rate ? "Reduced" : "Boosted";
  const phrases = modifiers.map(phraseFor).filter(Boolean);
  const joined = phrases.join(" and ");
  return joined
    ? `${direction} from ${basePct}% baseline to ${pct}% by ${joined}.`
    : `${action.name}: ${pct}%.`;
}

export function evaluate(
  action: Action,
  region: RegionIntel,
  political?: PoliticalContext,
): Outcome {
  const moraleNorm = (region.morale_score - 50) / 50;
  const pMorale = moraleNorm * action.morale_weight * MORALE_SCALE;

  const tSigned = trendSigned(region.morale_trend);
  const pTrend = tSigned * action.trend_weight * MORALE_SCALE;

  const severitySum = region.drivers.reduce((acc, d) => acc + d.contribution, 0);
  const severityNorm = clamp(severitySum / SEVERITY_DIVISOR, -1, 1);
  const pSeverity = severityNorm * action.severity_weight * MORALE_SCALE;

  const categoryItems: BreakdownItem[] = [];
  for (const d of region.drivers) {
    const sensitivity = action.category_sensitivities[d.category] ?? 0;
    if (sensitivity === 0) continue;
    const intensity = clamp(Math.abs(d.contribution) / CONTRIBUTION_DIVISOR, 0, 1);
    const delta = sensitivity * intensity * MORALE_SCALE;
    if (Math.abs(delta) < SIGNIFICANT_DELTA) continue;
    categoryItems.push({
      label: categoryLabel(d.category, d.contribution),
      kind: "category",
      delta,
      key: `cat:${d.category}`,
      source: "intel",
    });
  }

  const pCategories = categoryItems.reduce((a, b) => a + b.delta, 0);

  const { delta: rawPressure, label: pressureLabel } = pressureDelta(action, political);
  const { delta: rawCredibility, label: credibilityLabel } = credibilityDelta(
    action,
    political,
  );
  const pPressure = rawPressure * POLITICAL_SCALE;
  const pCredibility = rawCredibility * POLITICAL_SCALE;

  const raw =
    action.base_rate +
    pMorale +
    pTrend +
    pSeverity +
    pCategories +
    pPressure +
    pCredibility;
  const probability = clamp(raw, P_FLOOR, P_CEIL);

  const breakdown: BreakdownItem[] = [
    {
      label: "base rate",
      kind: "base",
      delta: action.base_rate,
      key: "base",
      source: "base",
    },
    {
      label: moraleLabel(moraleNorm),
      kind: "modifier",
      delta: pMorale,
      key: "morale",
      source: "intel",
      detail: `morale_norm × ${action.morale_weight.toFixed(2)} (morale weight)`,
    },
  ];
  if (Math.abs(pTrend) >= SIGNIFICANT_DELTA) {
    breakdown.push({
      label: `${region.morale_trend} trend`,
      kind: "modifier",
      delta: pTrend,
      key: "trend",
      source: "intel",
      detail: `trend × ${action.trend_weight.toFixed(2)} (trend weight)`,
    });
  }
  if (Math.abs(pSeverity) >= SIGNIFICANT_DELTA) {
    breakdown.push({
      label: "recent event severity",
      kind: "modifier",
      delta: pSeverity,
      key: "severity",
      source: "intel",
      detail: `net severity norm × ${action.severity_weight.toFixed(2)} (severity weight)`,
    });
  }
  breakdown.push(...categoryItems);
  if (Math.abs(pPressure) >= SIGNIFICANT_DELTA && pressureLabel) {
    const bias = action.pressure_aggression_bias ?? 0;
    const p = political?.issuer_pressure;
    breakdown.push({
      label: pressureLabel,
      kind: "modifier",
      delta: pPressure,
      key: "pressure",
      source: "pressure",
      detail:
        p != null
          ? `${bias.toFixed(2)} (aggression bias) × ${p.toFixed(2)} (issuer pressure)`
          : undefined,
    });
  }
  if (Math.abs(pCredibility) >= SIGNIFICANT_DELTA && credibilityLabel) {
    const w = action.credibility_weight ?? 0;
    const imm = political?.bilateral_credibility_immediate;
    breakdown.push({
      label: credibilityLabel,
      kind: "modifier",
      delta: pCredibility,
      key: "credibility",
      source: "credibility",
      detail:
        imm != null
          ? `${w.toFixed(2)} (cred. weight) × ${imm.toFixed(2)} (immediate, issuer→target)`
          : undefined,
    });
  }

  const explanation = buildExplanation(action, region, probability, breakdown);

  return {
    action_id: action.id,
    region_id: region.region_id,
    probability,
    breakdown,
    explanation,
  };
}

function pressureDelta(
  action: Action,
  political: PoliticalContext | undefined,
): { delta: number; label: string | null } {
  if (!political || political.issuer_pressure == null) return { delta: 0, label: null };
  const bias = action.pressure_aggression_bias ?? 0;
  if (bias === 0) return { delta: 0, label: null };
  const delta = bias * political.issuer_pressure;
  const label =
    political.issuer_deadline_turns_remaining != null
      ? `deadline pressure (T-${political.issuer_deadline_turns_remaining})`
      : "deadline pressure";
  return { delta, label };
}

function credibilityDelta(
  action: Action,
  political: PoliticalContext | undefined,
): { delta: number; label: string | null } {
  if (!political || political.bilateral_credibility_immediate == null) {
    return { delta: 0, label: null };
  }
  const w = action.credibility_weight ?? 0;
  if (w === 0) return { delta: 0, label: null };
  const delta = w * political.bilateral_credibility_immediate;
  const src = (political.issuer_faction_id ?? "issuer").toUpperCase();
  const dst = (political.target_faction_id ?? "target").toUpperCase();
  const band =
    political.bilateral_credibility_immediate < 0
      ? "low credibility"
      : "credibility";
  return { delta, label: `${band} (${src}→${dst})` };
}
