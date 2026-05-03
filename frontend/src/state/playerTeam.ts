import type { Faction } from "@/types/scenario";

/** Role the operator is playing; used to gate which units can be ordered. */
export type PlayerTeam = "red" | "blue";

export function isFactionControllableByPlayerTeam(
  faction: Faction,
  team: PlayerTeam,
): boolean {
  return faction.allegiance === team;
}
