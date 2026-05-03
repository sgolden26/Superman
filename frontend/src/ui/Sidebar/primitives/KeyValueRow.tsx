interface Props {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

export function KeyValueRow({ label, value, mono = true }: Props) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-1.5 text-xs">
      <span className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
        {label}
      </span>
      <span
        className={`min-w-0 truncate text-right text-ink-50 ${mono ? "font-mono text-[11px]" : "text-[12px]"}`}
      >
        {value}
      </span>
    </div>
  );
}
