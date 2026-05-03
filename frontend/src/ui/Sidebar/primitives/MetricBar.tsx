interface Props {
  label: string;
  value: number; // 0..1
  tone?: "neutral" | "ok" | "warn" | "danger";
}

const TONE_COLORS: Record<NonNullable<Props["tone"]>, string> = {
  neutral: "var(--ink-100)",
  ok: "var(--accent-ok)",
  warn: "var(--accent-amber)",
  danger: "var(--accent-danger)",
};

function tonefor(value: number): NonNullable<Props["tone"]> {
  if (value >= 0.8) return "ok";
  if (value >= 0.6) return "neutral";
  if (value >= 0.4) return "warn";
  return "danger";
}

export function MetricBar({ label, value, tone }: Props) {
  const t = tone ?? tonefor(value);
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const color = TONE_COLORS[t];
  return (
    <div className="px-4 py-1.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider2 text-ink-200">
          {label}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-ink-50">
          {pct.toFixed(0)}%
        </span>
      </div>
      <div
        className="h-[3px] w-full overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.05)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, ${color})`,
            boxShadow: `0 0 6px ${color}55`,
          }}
        />
      </div>
    </div>
  );
}
