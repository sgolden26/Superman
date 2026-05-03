import { useAppStore, type RightTab } from "@/state/store";
import { Sidebar } from "@/ui/Sidebar/Sidebar";
import { DecisionEngine } from "@/ui/DecisionEngine/DecisionEngine";
import { PromptPanel } from "@/ui/Prompt/PromptPanel";

const TABS: { id: RightTab; label: string }[] = [
  { id: "prompt", label: "prompt" },
  { id: "context", label: "context" },
  { id: "decision", label: "decision" },
];

export function RightPanel() {
  const tab = useAppStore((s) => s.rightTab);
  const setTab = useAppStore((s) => s.setRightTab);
  const open = useAppStore((s) => s.rightPanelOpen);
  const setOpen = useAppStore((s) => s.setRightPanelOpen);

  if (!open) {
    return (
      <div className="hairline-l flex h-full w-7 shrink-0 items-start justify-center bg-ink-800 pt-2">
        <button
          onClick={() => setOpen(true)}
          className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200 hover:text-ink-50"
          title="Open right panel ( ] )"
        >
          ‹
        </button>
      </div>
    );
  }

  return (
    <aside className="hairline-l panel-surface flex h-full w-[400px] shrink-0 flex-col">
      <div className="hairline-b flex items-stretch">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`relative flex-1 px-3 py-2.5 font-mono text-[11px] uppercase tracking-wider2 transition-colors ${
              tab === t.id
                ? "text-ink-50"
                : "text-ink-200 hover:text-ink-50"
            }`}
          >
            {t.label}
            <span
              aria-hidden
              className={`absolute inset-x-3 -bottom-px h-[2px] transition-opacity ${
                tab === t.id ? "opacity-100" : "opacity-0"
              }`}
              style={{ background: "var(--accent-blue)" }}
            />
          </button>
        ))}
        <button
          onClick={() => setOpen(false)}
          className="px-3 py-2 font-mono text-[11px] uppercase tracking-wider2 text-ink-300 transition-colors hover:text-ink-50"
          title="Collapse ( ] )"
        >
          ›
        </button>
      </div>
      <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
        {tab === "prompt" ? (
          <PromptPanel />
        ) : tab === "context" ? (
          <Sidebar />
        ) : (
          <DecisionEngine />
        )}
      </div>
    </aside>
  );
}
