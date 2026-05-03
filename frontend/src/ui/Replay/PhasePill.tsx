import { useAppStore } from "@/state/store";
import type { ReplayPhase } from "@/state/replay";

const PHASE_LABEL: Record<ReplayPhase, string> = {
  moves: "Moves",
  strikes: "Strikes",
  reports: "Damage reports",
};
const PHASE_INDEX: Record<ReplayPhase, number> = {
  moves: 1,
  strikes: 2,
  reports: 3,
};

/** Top-centre floating pill that walks the user through replay phases.
 *  Phase 1 (Moves) and Phase 2 (Strikes) auto-advance; Skip jumps early.
 *  Phase 3 (Reports) is persistent until the user clicks "Dismiss". */
export function PhasePill() {
  const replay = useAppStore((s) => s.replay);
  const skip = useAppStore((s) => s.skipReplayPhase);
  const dismiss = useAppStore((s) => s.dismissReplay);

  if (!replay) return null;

  if (replay.phase === "reports") {
    return (
      <div className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2">
        <button
          type="button"
          onClick={dismiss}
          className="pointer-events-auto rounded-full border border-slate-600 bg-slate-900/90 px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider text-slate-100 shadow-lg backdrop-blur-sm hover:bg-slate-800"
        >
          Dismiss
        </button>
      </div>
    );
  }

  const idx = PHASE_INDEX[replay.phase];
  const label = PHASE_LABEL[replay.phase];

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-slate-700/80 bg-slate-950/90 px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider text-slate-200 shadow-lg backdrop-blur-sm">
        <span className="text-slate-400">Phase {idx} of 3</span>
        <span className="text-slate-100">{label}</span>
        <button
          type="button"
          onClick={skip}
          className="rounded-sm border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-300 hover:bg-slate-800"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
