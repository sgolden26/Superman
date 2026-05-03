import type { Action, PoliticalContext } from "@/types/decision";
import type { Faction, ScenarioSnapshot } from "@/types/scenario";
import type { PlayerTeam } from "@/state/playerTeam";

interface Props {
  scenario: ScenarioSnapshot;
  playerTeam: PlayerTeam;
  political: PoliticalContext;
  targetFaction: Faction | null;
  selectedAction: Action | null;
  /** Sizing variant. "compact" for the docked side panel (default),
   *  "comfortable" for the immersive full-screen workspace. */
  size?: "compact" | "comfortable";
}

/**
 * Always-visible scoping: who the estimate is for, raw political inputs, and
 * the active action’s political weights. Makes the link between strip/HUD
 * and the % explicit without reading the breakdown rows only.
 */
export function DecisionContextPanel({
  scenario,
  playerTeam,
  political,
  targetFaction,
  selectedAction,
  size = "compact",
}: Props) {
  const issuerId = political.issuer_faction_id;
  const issuer = issuerId
    ? scenario.factions.find((f) => f.id === issuerId)
    : null;
  const sameSide =
    targetFaction && issuerId && targetFaction.id === issuerId;

  const roomy = size === "comfortable";
  const containerCls = roomy ? "px-5 py-4" : "px-4 py-2.5";
  const headerCls = roomy
    ? "mb-2.5 font-mono text-[13px] font-semibold uppercase tracking-wider2 text-ink-100"
    : "mb-1.5 font-mono text-[10px] uppercase tracking-wider2 text-ink-200";
  const bodyCls = roomy
    ? "grid gap-2 font-mono text-[13px] font-medium leading-snug text-ink-50"
    : "grid gap-1.5 font-mono text-[10px] leading-tight text-ink-100";
  const labelCls = roomy ? "text-ink-200" : "text-ink-300";
  const sepCls = roomy ? "text-ink-400" : "text-ink-300";
  const footnoteCls = roomy
    ? "mt-1.5 border-t border-ink-600/50 pt-2 font-mono text-[12px] font-medium text-ink-100"
    : "mt-0.5 border-t border-ink-600/50 pt-1.5 text-[9px] text-ink-200";

  return (
    <div className={`hairline-b bg-ink-800/60 ${containerCls}`}>
      <div className={headerCls}>
        how this % is scoped
      </div>
      <div className={bodyCls}>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <span className={labelCls}>turn</span>
          <span className="text-ink-50">{scenario.current_turn}</span>
          <span className={sepCls}>·</span>
          <span className={labelCls}>you</span>
          <span className="uppercase text-accent-amber">{playerTeam} team</span>
          <span className={sepCls}>→</span>
          <span style={{ color: issuer?.color }}>{issuer?.name ?? issuerId ?? "—"}</span>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <span className={labelCls}>region controller (target)</span>
          <span style={{ color: targetFaction?.color }}>{targetFaction?.name ?? "—"}</span>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <span className={labelCls}>issuer pressure</span>
          {political.issuer_pressure != null ? (
            <>
              <span className="text-ink-50">{(political.issuer_pressure * 100).toFixed(0)}%</span>
              {political.issuer_deadline_turns_remaining != null && (
                <>
                  <span className={sepCls}>·</span>
                  <span
                    className={
                      political.issuer_deadline_turns_remaining <= 2
                        ? "text-accent-danger"
                        : political.issuer_deadline_turns_remaining <= 5
                          ? "text-accent-amber"
                          : "text-ink-50"
                    }
                  >
                    T-{political.issuer_deadline_turns_remaining}
                  </span>
                </>
              )}
            </>
          ) : (
            <span className={labelCls}>not in snapshot</span>
          )}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className={labelCls}>bilateral cred. (→ target)</span>
          {sameSide ? (
            <span className="text-ink-200 normal-case" title="Evaluator uses issuer→adversary tracks">
              n/a (your faction holds this region)
            </span>
          ) : political.bilateral_credibility_immediate != null ? (
            <>
              <span className="text-ink-50">
                imm {political.bilateral_credibility_immediate.toFixed(2)}
              </span>
              {political.bilateral_credibility_resolve != null && (
                <>
                  <span className={sepCls}>·</span>
                  <span className="text-ink-200">res {political.bilateral_credibility_resolve.toFixed(2)}</span>
                </>
              )}
            </>
          ) : (
            <span className={labelCls}>no track or same-side</span>
          )}
        </div>
        {selectedAction && (
          <div className={footnoteCls}>
            <span className={labelCls}>this action: </span>
            aggression bias{" "}
            <span className="text-ink-50">
              {(selectedAction.pressure_aggression_bias ?? 0) >= 0 ? "+" : ""}
              {(selectedAction.pressure_aggression_bias ?? 0).toFixed(2)}
            </span>
            <span className={sepCls}> · </span>
            cred. weight{" "}
            <span className="text-ink-50">
              {(selectedAction.credibility_weight ?? 0).toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
