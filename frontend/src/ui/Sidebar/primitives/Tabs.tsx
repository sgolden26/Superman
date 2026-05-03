interface TabSpec<Id extends string> {
  id: Id;
  label: string;
}

interface Props<Id extends string> {
  tabs: TabSpec<Id>[];
  active: Id;
  onChange: (id: Id) => void;
}

export function Tabs<Id extends string>({ tabs, active, onChange }: Props<Id>) {
  return (
    <div
      role="tablist"
      className="hairline-b flex flex-wrap gap-1 px-2 py-2 bg-ink-800"
    >
      {tabs.map((t) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.id)}
            className={`px-2 py-1 font-mono text-[10px] uppercase tracking-wider2 transition-colors ${
              selected
                ? "border border-ink-300 bg-ink-700 text-ink-50"
                : "border border-transparent text-ink-200 hover:text-ink-50 hover:border-ink-500"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
