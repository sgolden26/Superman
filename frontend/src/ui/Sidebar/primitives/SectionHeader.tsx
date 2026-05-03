interface Props {
  label: string;
  trailing?: React.ReactNode;
}

export function SectionHeader({ label, trailing }: Props) {
  return (
    <div className="hairline-b panel-section-bg flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[9px] text-ink-300">▾</span>
        <span className="font-mono text-[10px] uppercase tracking-wider2 text-ink-100">
          {label}
        </span>
      </div>
      {trailing ? (
        <span className="font-mono text-[10px] tracking-wider2 text-ink-300">
          {trailing}
        </span>
      ) : null}
    </div>
  );
}
