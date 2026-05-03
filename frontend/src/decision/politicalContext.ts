import type { PoliticalContext } from "@/types/decision";
import type { ScenarioSnapshot } from "@/types/scenario";
import type { PlayerTeam } from "@/state/playerTeam";

/**
 * Build a `PoliticalContext` for the FE evaluator from the live snapshot.
 *
 * Rules:
 * - issuer faction is the first scenario faction whose allegiance matches the
 *   player's team (e.g. blue → `ua`, red → `ru`); subordinate factions on the
 *   same team (NATO under blue) are not the primary issuer for purposes of
 *   credibility, since the cart belongs to a single primary state.
 * - target faction is the de-facto controller of the focused region.
 * - pressure intensity uses the faction-level rollup if present; deadline
 *   turns remaining = `(deadline_turn ?? global) - current_turn`, clamped at 0.
 * - credibility uses the bilateral immediate/resolve from issuer to target.
 *
 * Any field that cannot be resolved is left undefined; the evaluator skips
 * those modifiers.
 */
export function buildPoliticalContext(
  scenario: ScenarioSnapshot,
  playerTeam: PlayerTeam,
  targetFactionId: string | null,
): PoliticalContext {
  const issuer = scenario.factions.find((f) => f.allegiance === playerTeam);
  if (!issuer) return {};

  const ctx: PoliticalContext = {
    issuer_faction_id: issuer.id,
    target_faction_id: targetFactionId ?? undefined,
  };

  const fp = scenario.pressure.factions.find((f) => f.faction_id === issuer.id);
  if (fp) ctx.issuer_pressure = fp.intensity;

  const deadline = fp?.deadline_turn ?? scenario.pressure.global_deadline_turn ?? null;
  if (deadline != null) {
    const remaining = Math.max(0, deadline - scenario.current_turn);
    ctx.issuer_deadline_turns_remaining = remaining;
  }

  if (targetFactionId && targetFactionId !== issuer.id) {
    const track = scenario.credibility.find(
      (c) =>
        c.from_faction_id === issuer.id && c.to_faction_id === targetFactionId,
    );
    if (track) {
      ctx.bilateral_credibility_immediate = track.immediate;
      ctx.bilateral_credibility_resolve = track.resolve;
    }
  }

  return ctx;
}
