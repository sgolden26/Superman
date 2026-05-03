export function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="relative flex h-12 w-12 items-center justify-center">
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(90,169,255,0.18), transparent 70%)",
          }}
        />
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="1.2" className="text-ink-300">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v3M12 20v3M1 12h3M20 12h3" />
          </g>
        </svg>
      </div>
      <div className="mt-3 font-mono text-[10px] uppercase tracking-wider2 text-ink-300">
        no contact selected
      </div>
      <p className="mt-2 max-w-[18rem] text-[12px] leading-relaxed text-ink-100">
        Select a unit, city or territory on the map to inspect its order of
        battle, infrastructure and political posture.
      </p>
      <div className="mt-5 grid w-full max-w-[18rem] grid-cols-3 gap-2 font-mono text-[9px] uppercase tracking-wider2 text-ink-300">
        <div className="border border-[var(--hairline)] px-2 py-1.5">click</div>
        <div className="border border-[var(--hairline)] px-2 py-1.5">inspect</div>
        <div className="border border-[var(--hairline)] px-2 py-1.5">queue</div>
      </div>
    </div>
  );
}
