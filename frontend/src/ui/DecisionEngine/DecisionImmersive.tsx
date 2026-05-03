import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "@/state/store";
import { evaluate } from "@/decision/evaluator";
import { buildPoliticalContext } from "@/decision/politicalContext";
import type { Action } from "@/types/decision";
import { DecisionContextPanel } from "./DecisionContextPanel";
import { DecisionStatusBadge } from "./DecisionStatusBadge";
import { FactorFlowGraph } from "./FactorFlowGraph";
import { OutcomeCard } from "./OutcomeCard";
import { RegionList } from "./RegionList";
import { resolveRegionEntity } from "@/decision/resolveRegionEntity";
import { DecisionPipMap } from "./DecisionPipMap";

export function DecisionImmersive() {
  const open = useAppStore((s) => s.decisionImmersiveOpen);
  const setImmersive = useAppStore((s) => s.setDecisionImmersiveOpen);
  const tab = useAppStore((s) => s.rightTab);
  const scenario = useAppStore((s) => s.scenario);
  const intel = useAppStore((s) => s.intel);
  const intelError = useAppStore((s) => s.intelError);
  const lastIntelLoadAt = useAppStore((s) => s.lastIntelLoadAt);
  const selection = useAppStore((s) => s.selection);
  const select = useAppStore((s) => s.select);
  const selectedActionId = useAppStore((s) => s.selectedActionId);
  const selectAction = useAppStore((s) => s.selectAction);
  const playerTeam = useAppStore((s) => s.playerTeam);
  const openArticle = useAppStore((s) => s.openArticle);

  /** Bottom outcome is shown only after the user picks an action in this session. */
  const [choseAction, setChoseAction] = useState(false);
  const onClose = useCallback(() => setImmersive(false), [setImmersive]);

  /**
   * User-resizable height for the outcome panel. Default null = falls back to
   * 42vh (parity with the previous static cap). Drag the divider between the
   * top region/graph row and the bottom panel to grow it toward full screen.
   */
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const [bottomHeight, setBottomHeight] = useState<number | null>(null);
  const draggingRef = useRef(false);

  const startBottomDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ns-resize";
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const el = splitContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const next = rect.bottom - e.clientY;
      const min = 120;
      const max = Math.max(min, rect.height - 96);
      setBottomHeight(Math.max(min, Math.min(max, next)));
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  const onActionPick = useCallback(
    (id: string) => {
      selectAction(id);
      setChoseAction(true);
    },
    [selectAction],
  );

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

  useEffect(() => {
    if (open) setChoseAction(false);
  }, [open, focusedRegionId]);

  const actions: Action[] = scenario?.actions ?? [];
  const selectedAction = useMemo(
    () => (selectedActionId ? actions.find((a) => a.id === selectedActionId) : null) ?? null,
    [actions, selectedActionId],
  );

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
    if (!choseAction || !selectedAction || !focusedRegion) return null;
    return evaluate(selectedAction, focusedRegion, politicalContext);
  }, [choseAction, selectedAction, focusedRegion, politicalContext]);

  if (!open || tab !== "decision") return null;

  return createPortal(
    <div
      className="fixed bottom-5 left-0 right-0 top-0 z-[200000] flex flex-col border-b border-ink-600 bg-ink-900"
      role="dialog"
      aria-modal="true"
      aria-label="Decision workspace"
    >
      <header className="hairline-b flex shrink-0 items-center justify-between gap-3 bg-ink-800 px-4 py-2">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
            decision workspace
          </div>
          <div className="truncate font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
            graph · intel fusion · estimated outcomes
          </div>
        </div>
        <DecisionStatusBadge
          intelLoaded={Boolean(intel)}
          intelError={intelError}
          lastIntelLoadAt={lastIntelLoadAt}
          source={intel?.source ?? null}
          tickSeq={intel?.tick_seq ?? null}
        />
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 border border-ink-500 bg-ink-800 px-2 py-1 font-mono text-[10px] uppercase tracking-wider2 text-ink-200 hover:border-ink-300 hover:text-ink-50"
          title="Close (Esc)"
        >
          close
        </button>
      </header>

      {focusedRegionId && <DecisionPipMap regionId={focusedRegionId} />}

      <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
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
          <div ref={splitContainerRef} className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex h-0 min-h-0 flex-1 flex-row gap-0 overflow-hidden">
              <div className="w-[220px] shrink-0 overflow-y-auto border-r border-ink-600 bg-ink-800/80">
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
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2">
                {focusedRegion && resolvedEntity ? (
                  <FactorFlowGraph
                    region={focusedRegion}
                    territoryName={resolvedEntity.name}
                    actions={actions}
                    selectedActionId={choseAction ? (selectedAction?.id ?? null) : null}
                    onActionSelect={onActionPick}
                    onSignalClick={openArticle}
                  />
                ) : (
                  <div className="p-4 font-mono text-[11px] text-ink-200">
                    No region with intel to graph.
                  </div>
                )}
              </div>
            </div>

            {outcome && scenario && resolvedEntity && (
              <>
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  aria-label="Resize outcome panel"
                  onMouseDown={startBottomDrag}
                  className="group flex h-3 shrink-0 cursor-ns-resize flex-col items-center justify-center gap-[3px] border-y border-ink-500 bg-ink-600 hover:bg-ink-500"
                  title="Drag to resize"
                >
                  <div className="h-0.5 w-20 rounded-full bg-ink-200 group-hover:bg-ink-50" />
                  <div className="h-0.5 w-20 rounded-full bg-ink-200 group-hover:bg-ink-50" />
                </div>
                <div
                  className="shrink-0 overflow-y-auto border-ink-600 bg-ink-800/95"
                  style={{ height: bottomHeight ?? "42vh" }}
                >
                  <div className="px-5 pt-3">
                    <div className="font-mono text-[12px] font-semibold uppercase tracking-wider2 text-ink-100">
                      if you take “{selectedAction?.name}”
                    </div>
                  </div>
                  <DecisionContextPanel
                    scenario={scenario}
                    playerTeam={playerTeam}
                    political={politicalContext ?? {}}
                    targetFaction={resolvedEntity.faction}
                    selectedAction={selectedAction}
                    size="comfortable"
                  />
                  <div className="px-2 pb-3">
                    <OutcomeCard
                      outcome={outcome}
                      expandable
                      region={focusedRegion}
                      team={playerTeam}
                      actionId={selectedAction?.id}
                      size="comfortable"
                    />
                  </div>
                </div>
              </>
            )}
            {!outcome && actions.length > 0 && !choseAction && (
              <div className="hairline-t border-ink-600 bg-ink-800/60 px-4 py-2 font-mono text-[10px] text-ink-300">
                Select a course of action in the graph to see the estimated outcome for this region.
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
