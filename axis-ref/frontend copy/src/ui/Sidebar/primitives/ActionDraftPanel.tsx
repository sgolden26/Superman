import { useAppStore } from "@/state/store";
import type { ActionDraft, ActionDraftKind } from "@/state/actionDraft";

const TITLE: Record<ActionDraftKind, string> = {
  engage: "Plan engagement",
  rebase_air: "Plan rebase",
  air_sortie: "Plan air sortie",
  naval_move: "Plan naval move",
  naval_strike: "Plan naval strike",
  missile_strike: "Plan missile strike",
  interdict_supply: "Plan supply interdiction",
};

const PROMPT: Record<ActionDraftKind, string> = {
  engage: "click a hostile unit inside the ring",
  rebase_air: "click a friendly airfield inside the ring",
  air_sortie: "click a target inside the ring",
  naval_move: "click a friendly port inside the ring",
  naval_strike: "click a target inside the ring",
  missile_strike: "click a target inside the missile envelope",
  interdict_supply: "click a hostile supply line inside the ring",
};

interface Props {
  draft: ActionDraft;
}

/** Bottom-of-panel drawer that appears whenever an action draft is active.
 *  Lists the candidate set, mirrors the map snap selection, and exposes
 *  "Add to orders" / "Cancel". */
export function ActionDraftPanel({ draft }: Props) {
  const setCandidate = useAppStore((s) => s.setActionDraftCandidate);
  const cancel = useAppStore((s) => s.cancelActionDraft);
  const commit = useAppStore((s) => s.commitActionDraft);
  const cartOpen = useAppStore((s) => s.setCartOpen);

  const onCommit = () => {
    const id = commit();
    if (id) cartOpen(true);
  };

  return (
    <div className="hairline-t mt-2 flex flex-col gap-2 px-3 py-2">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider2 text-faction-nato">
          {TITLE[draft.kind]}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
          range {draft.rangeKm.toFixed(0)} km · {draft.candidates.length} candidates
        </span>
      </div>
      <div className="font-mono text-[9px] uppercase tracking-wider2 text-ink-200">
        {PROMPT[draft.kind]}
      </div>

      {draft.candidates.length === 0 ? (
        <div className="font-mono text-[10px] text-ink-200">
          no valid {draft.kind === "rebase_air" || draft.kind === "naval_move" ? "destinations" : "targets"} in range
        </div>
      ) : (
        <ul className="max-h-40 overflow-y-auto border border-[var(--hairline)]">
          {draft.candidates.map((c) => {
            const active = draft.selectedCandidateId === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setCandidate(c.id)}
                  className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left transition-colors ${
                    active
                      ? "bg-faction-nato/10 text-faction-nato"
                      : "text-ink-100 hover:bg-ink-700/40"
                  }`}
                >
                  <span className="truncate font-mono text-[11px]">{c.name}</span>
                  <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
                    {c.distanceKm.toFixed(0)} km{c.hint ? ` · ${c.hint}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!draft.selectedCandidateId}
          onClick={onCommit}
          title={
            draft.selectedCandidateId
              ? "Add this to the orders cart"
              : "Pick a candidate on the map or in the list above"
          }
          className="hairline border border-accent-ok bg-accent-ok/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider2 text-accent-ok transition-colors hover:bg-accent-ok/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent-ok/10"
        >
          Add to orders
        </button>
        <button
          type="button"
          onClick={() => cancel()}
          className="hairline border border-accent-danger bg-accent-danger/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider2 text-accent-danger transition-colors hover:bg-accent-danger/20"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
