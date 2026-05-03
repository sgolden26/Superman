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
      className="seam-b flex flex-wrap gap-1 px-2 py-2 bg-mil-800"
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
                ? "border border-mil-300 bg-mil-700 text-mil-50"
                : "border border-transparent text-mil-200 hover:text-mil-50 hover:border-mil-500"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
