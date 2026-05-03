import type { Faction, Oblast, ScenarioSnapshot, Territory } from "@/types/scenario";

export interface ResolvedRegionEntity {
  name: string;
  territory: Territory | null;
  oblast: Oblast | null;
  faction: Faction;
}

/**
 * Intel `region_id` keys off either a `Territory.id` or an `Oblast.id` (e.g. obl.30).
 */
export function resolveRegionEntity(
  scenario: ScenarioSnapshot,
  regionId: string,
): ResolvedRegionEntity | null {
  const territory = scenario.territories.find((t) => t.id === regionId) ?? null;
  const oblast = scenario.oblasts.find((o) => o.id === regionId) ?? null;
  if (!territory && !oblast) return null;

  const byId = new Map(scenario.factions.map((f) => [f.id, f]));
  const fid = territory?.faction_id ?? oblast?.faction_id;
  const faction = (fid ? byId.get(fid) : null) ?? scenario.factions[0];
  if (!faction) return null;

  const name = territory?.name ?? oblast?.name ?? regionId;
  return { name, territory, oblast, faction };
}
