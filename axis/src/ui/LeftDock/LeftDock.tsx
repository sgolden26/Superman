import { useAppStore } from "@/state/store";
import { FilterChips } from "./FilterChips";
import { OOBTree } from "./OOBTree";

export function LeftDock() {
  const open = useAppStore((s) => s.leftDockOpen);
  const setOpen = useAppStore((s) => s.setLeftDockOpen);

  if (!open) {
    return (
      <div className="seam-r deck-surface flex h-full w-7 shrink-0 items-start justify-center pt-2">
        <button
          onClick={() => setOpen(true)}
          className="font-mono text-[11px] uppercase tracking-wider2 text-mil-300 transition-colors hover:text-mil-50"
          title="Open left dock ( [ )"
        >
          ›
        </button>
      </div>
    );
  }

  return (
    <aside className="seam-r deck-surface flex h-full w-[280px] shrink-0 flex-col">
      <div className="seam-b deck-section-bg flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-mil-300">▾</span>
          <span className="font-mono text-[10px] uppercase tracking-wider2 text-mil-100">
            theatre
          </span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="font-mono text-[11px] uppercase tracking-wider2 text-mil-300 transition-colors hover:text-mil-50"
          title="Collapse ( [ )"
        >
          ‹
        </button>
      </div>

      <div className="seam-b">
        <FilterChips />
      </div>

      <div className="flex-1 overflow-y-auto">
        <OOBTree />
      </div>
    </aside>
  );
}
