import type { Action } from "@/types/decision";

interface Props {
  actions: Action[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ActionPicker({ actions, selectedId, onSelect }: Props) {
  return (
    <div className="px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-wider2 text-mil-200">
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
                    ? "border-faction-nato bg-mil-700 text-mil-50"
                    : "border-mil-500 bg-mil-800 text-mil-100 hover:border-mil-300 hover:text-mil-50"
                }`}
              >
                <span className="block font-mono text-[10px] uppercase tracking-wider2">
                  {a.name}
                </span>
                <span className="mt-1 block text-[11px] leading-snug text-mil-200">
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
