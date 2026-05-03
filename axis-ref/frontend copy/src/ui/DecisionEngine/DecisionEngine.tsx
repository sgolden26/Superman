import { useMemo } from "react";
import { useAppStore } from "@/state/store";
import { evaluate } from "@/decision/evaluator";
import { buildPoliticalContext } from "@/decision/politicalContext";
import type { Action } from "@/types/decision";
import { ActionPicker } from "./ActionPicker";
import { OutcomeCard } from "./OutcomeCard";
import { RegionList } from "./RegionList";
import { RegionSummary } from "./RegionSummary";
import { DecisionStatusBadge } from "./DecisionStatusBadge";
import { DecisionContextPanel } from "./DecisionContextPanel";
import { resolveRegionEntity } from "@/decision/resolveRegionEntity";

export function DecisionEngine() {
  const scenario = useAppStore((s) => s.scenario);
  const intel = useAppStore((s) => s.intel);
  const intelError = useAppStore((s) => s.intelError);
  const lastIntelLoadAt = useAppStore((s) => s.lastIntelLoadAt);
  const selection = useAppStore((s) => s.selection);
  const select = useAppStore((s) => s.select);
  const selectedActionId = useAppStore((s) => s.selectedActionId);
  const selectAction = useAppStore((s) => s.selectAction);
  const playerTeam = useAppStore((s) => s.playerTeam);

  const territoriesById = useMemo(() => {
    const map = new Map<string, NonNullable<typeof scenario>["territories"][number]>();
    if (scenario) {
      for (const t of scenario.territories) map.set(t.id, t);
    }
    return map;
  }, [scenario]);

  const factionsById = useMemo(() => {
    const map = new Map<string, NonNullable<typeof scenario>["factions"][number]>();
    if (scenario) {
      for (const f of scenario.factions) map.set(f.id, f);
    }
    return map;
  }, [scenario]);

  const oblastsById = useMemo(() => {
    const map = new Map<string, NonNullable<typeof scenario>["oblasts"][number]>();
    if (scenario) {
      for (const o of scenario.oblasts) map.set(o.id, o);
    }
    return map;
  }, [scenario]);

  const focusedRegionId = useMemo(() => {
    if (!intel) return null;
    if (selection?.kind === "territory") return selection.id;
    if (selection?.kind === "oblast") return selection.id;
    return intel.regions[0]?.region_id ?? null;
  }, [intel, selection]);

  const focusedRegion = useMemo(() => {
    if (!intel || !focusedRegionId) return null;
    return intel.regions.find((r) => r.region_id === focusedRegionId) ?? null;
  }, [intel, focusedRegionId]);

  const actions: Action[] = scenario?.actions ?? [];
  const selectedAction = useMemo(() => {
    return actions.find((a) => a.id === selectedActionId) ?? actions[0] ?? null;
  }, [actions, selectedActionId]);

  const resolvedEntity = useMemo(() => {
    if (!scenario || !focusedRegion) return null;
    return resolveRegionEntity(scenario, focusedRegion.region_id);
  }, [scenario, focusedRegion]);

  const politicalContext = useMemo(() => {
    if (!scenario) return undefined;
    const targetId = resolvedEntity?.faction?.id ?? null;
    return buildPoliticalContext(scenario, playerTeam, targetId);
  }, [scenario, playerTeam, resolvedEntity]);

  const outcome = useMemo(() => {
    if (!selectedAction || !focusedRegion) return null;
    return evaluate(selectedAction, focusedRegion, politicalContext);
  }, [selectedAction, focusedRegion, politicalContext]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-ink-800">
      <div className="hairline-b flex shrink-0 items-center justify-between px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
          decision engine
        </span>
        <DecisionStatusBadge
          intelLoaded={Boolean(intel)}
          intelError={intelError}
          lastIntelLoadAt={lastIntelLoadAt}
          source={intel?.source ?? null}
          tickSeq={intel?.tick_seq ?? null}
        />
      </div>

      <div className="h-0 min-h-0 flex-1 overflow-y-auto">
        {!scenario ? (
          <div className="px-4 py-8 text-center font-mono text-[11px] text-ink-200">
            waiting for scenario…
          </div>
        ) : !intel ? (
          <div className="px-4 py-8 text-center font-mono text-[11px] text-ink-200">
            {intelError ? (
              <span className="text-accent-danger">{intelError}</span>
            ) : (
              "loading intel feed…"
            )}
          </div>
        ) : (
          <>
            <RegionList
              regions={intel.regions}
              territoriesById={territoriesById}
              oblastsById={oblastsById}
              factionsById={factionsById}
              selectedRegionId={focusedRegionId}
              onSelect={(id) => {
                const oblast = scenario?.oblasts.find((o) => o.id === id);
                if (oblast) select({ kind: "oblast", id });
                else select({ kind: "territory", id });
              }}
            />

            {focusedRegion && resolvedEntity && (
              <RegionSummary
                region={focusedRegion}
                regionLabel={resolvedEntity.name}
                faction={resolvedEntity.faction}
              />
            )}

            {scenario && focusedRegion && resolvedEntity && (
              <DecisionContextPanel
                scenario={scenario}
                playerTeam={playerTeam}
                political={politicalContext ?? {}}
                targetFaction={resolvedEntity.faction}
                selectedAction={selectedAction}
              />
            )}

            {actions.length > 0 && (
              <ActionPicker
                actions={actions}
                selectedId={selectedAction?.id ?? null}
                onSelect={selectAction}
              />
            )}

            {outcome && <OutcomeCard outcome={outcome} />}
          </>
        )}
      </div>
    </div>
  );
}
