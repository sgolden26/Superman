import type { Action } from "@/types/decision";

interface Props {
  actions: Action[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ActionPicker({ actions, selectedId, onSelect }: Props) {
  return (
    <div className="px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
        action
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-2">
        {actions.map((a) => {
          const active = a.id === selectedId;
          return (
            <li key={a.id}>
              <button
                onClick={() => onSelect(a.id)}
                aria-pressed={active}
                title={a.description}
                className={`w-full border px-2 py-2 text-left transition-colors ${
                  active
                    ? "border-faction-nato bg-ink-700 text-ink-50"
                    : "border-ink-500 bg-ink-800 text-ink-100 hover:border-ink-300 hover:text-ink-50"
                }`}
              >
                <span className="block font-mono text-[10px] uppercase tracking-wider2">
                  {a.name}
                </span>
                <span className="mt-1 block text-[11px] leading-snug text-ink-200">
                  {a.description}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
